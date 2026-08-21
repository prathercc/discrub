import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('drip-fs', () => ({ createStreamingDownload: vi.fn(async () => ({ tag: 'drip' })) }));

import { createStreamingDownload } from 'drip-fs';
import { createBlobDownloadWriter, createDownloadWriter, createTabStreamWriter, isIOSSafari } from './downloadWriter';

const nav = (overrides: Partial<Navigator>): Navigator =>
  ({ userAgent: '', platform: '', maxTouchPoints: 0, ...overrides }) as Navigator;

describe('isIOSSafari', () => {
  it('detects iPhone and iPad user agents', () => {
    expect(isIOSSafari(nav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }))).toBe(true);
    expect(isIOSSafari(nav({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' }))).toBe(true);
  });

  it('detects iPadOS that reports a desktop Mac UA via touch points', () => {
    expect(isIOSSafari(nav({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 }))).toBe(true);
  });

  it('is false for desktop Chrome and macOS Safari', () => {
    expect(isIOSSafari(nav({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/126', platform: 'Win32' }))).toBe(false);
    expect(isIOSSafari(nav({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', platform: 'MacIntel', maxTouchPoints: 0 }))).toBe(false);
  });
});

describe('createDownloadWriter', () => {
  const originalUA = navigator.userAgent;
  beforeEach(() => {
    vi.mocked(createStreamingDownload).mockClear();
  });
  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
  });

  it('uses drip-fs streaming off iOS', async () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (X11; Linux) Chrome/126', configurable: true });
    const w = await createDownloadWriter('x.zip');
    expect(createStreamingDownload).toHaveBeenCalledWith('x.zip');
    expect((w as unknown as { tag: string }).tag).toBe('drip');
  });

  it('on iOS without a controlling service worker, uses the Blob writer and never calls drip-fs', async () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/126', configurable: true });
    const w = await createDownloadWriter('x.zip');
    expect(createStreamingDownload).not.toHaveBeenCalled();
    expect(w.bytesWritten).toBe(0);
  });
});

describe('createTabStreamWriter (iOS new-tab stream)', () => {
  const installSW = (respond: (port: MessagePort) => void) => {
    const postMessage = vi.fn((_: unknown, transfer: Transferable[]) => {
      respond(transfer[0] as MessagePort);
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { controller: { postMessage } },
      configurable: true,
    });
    return postMessage;
  };
  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    vi.restoreAllMocks();
  });

  it('returns null when no service worker controls the page', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    expect(await createTabStreamWriter('x.zip')).toBeNull();
  });

  it('opens the SW download URL in a new tab and streams chunks over the port', async () => {
    const swPost = installSW((port) => port.postMessage({ download: 'https://app/sw/123/x.zip' }));
    const opened = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const w = await createTabStreamWriter('x.zip');
    expect(w).not.toBeNull();
    expect(swPost).toHaveBeenCalledWith({ filename: 'x.zip' }, [expect.any(MessagePort)]);
    expect(opened).toHaveBeenCalledWith('https://app/sw/123/x.zip', '_blank');

    const received: unknown[] = [];
    const clientPort = (swPost.mock.calls[0][1] as MessagePort[])[0];
    clientPort.onmessage = (e) => received.push(e.data);
    await w!.write(new Uint8Array([1, 2]));
    await w!.close();
    await new Promise((r) => setTimeout(r, 20));
    expect(w!.bytesWritten).toBe(2);
    expect(ArrayBuffer.isView(received[0] as ArrayBufferView)).toBe(true);
    expect((received[0] as Uint8Array).byteLength).toBe(2);
    expect(received[1]).toBe('end');
  });

  it('returns null and aborts the pending stream when the popup is blocked', async () => {
    const swPost = installSW((port) => port.postMessage({ download: 'https://app/sw/1/x.zip' }));
    vi.spyOn(window, 'open').mockReturnValue(null);
    const received: unknown[] = [];
    const w = await createTabStreamWriter('x.zip');
    const clientPort = (swPost.mock.calls[0][1] as MessagePort[])[0];
    clientPort.onmessage = (e) => received.push(e.data);
    await new Promise((r) => setTimeout(r, 20));
    expect(w).toBeNull();
    expect(received).toContain('abort');
  });
});

describe('createBlobDownloadWriter', () => {
  it('buffers chunks, reports progress, and saves via a download anchor on close', async () => {
    const progress: number[] = [];
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers();

    const w = createBlobDownloadWriter('export.zip', (b) => progress.push(b));
    await w.write(new Uint8Array([1, 2, 3]));
    await w.write(new Uint8Array([4]));
    expect(progress).toEqual([3, 4]);
    expect(w.bytesWritten).toBe(4);

    await w.close();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const anchor = document.querySelector('a[download="export.zip"]') as HTMLAnchorElement;
    expect(anchor).not.toBeNull();
    expect(anchor.href).toContain('blob:x');
    expect(click).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download="export.zip"]')).toBeNull();

    await expect(w.write(new Uint8Array([5]))).rejects.toThrow(/closed/);
    vi.useRealTimers();
    click.mockRestore();
  });
});
