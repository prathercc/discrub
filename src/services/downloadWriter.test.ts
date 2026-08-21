import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('drip-fs', () => ({ createStreamingDownload: vi.fn(async () => ({ tag: 'drip' })) }));

import { createStreamingDownload } from 'drip-fs';
import { createBlobDownloadWriter, createDownloadWriter, isIOSSafari } from './downloadWriter';

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
    vi.mocked(createStreamingDownload).mockReset();
    vi.mocked(createStreamingDownload).mockResolvedValue({ tag: 'drip' } as never);
  });
  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
    vi.restoreAllMocks();
  });

  it('delegates to drip-fs everywhere (desktop), passing the part cap as size when known', async () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (X11; Linux) Chrome/126', configurable: true });
    const w = await createDownloadWriter('x.zip');
    expect(createStreamingDownload).toHaveBeenCalledWith('x.zip');
    await createDownloadWriter('y.zip', 4 * 1024 ** 3);
    expect(createStreamingDownload).toHaveBeenLastCalledWith('y.zip', { size: 4 * 1024 ** 3 });
    expect((w as unknown as { tag: string }).tag).toBe('drip');
  });

  it('delegates to drip-fs on iOS too (1.1 stages through OPFS itself)', async () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/126', configurable: true });
    const w = await createDownloadWriter('x.zip');
    expect(createStreamingDownload).toHaveBeenCalledWith('x.zip');
    expect((w as unknown as { tag: string }).tag).toBe('drip');
  });

  it('falls back to the Blob writer only on iOS when drip-fs throws', async () => {
    vi.mocked(createStreamingDownload).mockRejectedValue(new Error('no OPFS'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', configurable: true });
    const w = await createDownloadWriter('x.zip');
    expect(w.bytesWritten).toBe(0);
    expect(console.warn).toHaveBeenCalled();

    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (X11; Linux) Chrome/126', configurable: true });
    await expect(createDownloadWriter('x.zip')).rejects.toThrow('no OPFS');
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
