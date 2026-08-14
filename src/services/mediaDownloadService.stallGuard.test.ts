import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { streamDownloadWithStallGuard } from './mediaDownloadService';

/**
 * #232 (GitHub #12) — the stall-guard media transport.
 *
 * The old transport raced a buffered fetch against a flat 10s timer, which
 * structurally fails large attachments on slow connections (500MB in 10s
 * needs 400mbps) and never aborted the losing fetch. The stall guard only
 * gives up when NO bytes arrive for the stall window, so slow-but-alive
 * downloads always complete while dead connections still fail fast.
 */

const mockDiscordService = {
  searchDelaySecs: 0,
  deleteDelaySecs: 0,
  delayModifierSecs: 0,
  calculateRandomNumber: vi.fn((max: number, _min: number) => max),
  onRateLimit: vi.fn() as ((retryAfter: number) => void) | undefined,
};

vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(() => mockDiscordService),
}));

// ── Streaming Response fake ──────────────────────────────────────
// Chunks arrive after their per-chunk delay; `stall: true` leaves the
// final read pending forever so only the abort signal can settle it.

interface StreamOpts {
  chunkDelaysMs: number[];
  stall?: boolean;
  status?: number;
  contentType?: string;
  headers?: Record<string, string>;
}

function makeStreamingResponse(opts: StreamOpts, signal: AbortSignal) {
  const { chunkDelaysMs, stall = false, status = 200, contentType = 'image/png' } = opts;
  let i = 0;
  const reader = {
    read: () =>
      new Promise<{ done: boolean; value?: Uint8Array }>((resolve, reject) => {
        const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
        if (signal.aborted) return onAbort();
        signal.addEventListener('abort', onAbort, { once: true });
        if (i < chunkDelaysMs.length) {
          const delay = chunkDelaysMs[i++];
          setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve({ done: false, value: new Uint8Array([1, 2, 3]) });
          }, delay);
        } else if (!stall) {
          setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve({ done: true });
          }, 0);
        }
        // stall: never resolve — only the abort listener settles this read
      }),
  };
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': contentType, ...(opts.headers ?? {}) }),
    body: { getReader: () => reader },
  } as unknown as Response;
}

function mockFetchStreaming(opts: StreamOpts) {
  return vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
    Promise.resolve(makeStreamingResponse(opts, init!.signal as AbortSignal))
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  mockDiscordService.searchDelaySecs = 0;
  mockDiscordService.delayModifierSecs = 0;
  mockDiscordService.onRateLimit = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('#232 streamDownloadWithStallGuard', () => {
  it('completes a slow-but-progressing download far beyond the old 10s cap', async () => {
    // 5 chunks, 8s apart = 40s total. The old flat race died at 10s; the
    // stall guard never fires because bytes keep arriving inside the window.
    vi.stubGlobal('fetch', mockFetchStreaming({ chunkDelaysMs: [8000, 8000, 8000, 8000, 8000] }));

    const promise = streamDownloadWithStallGuard('https://cdn.discordapp.com/big-file.png');
    await vi.advanceTimersByTimeAsync(41_000);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Blob);
    expect(result.data!.size).toBe(15); // 5 chunks × 3 bytes
    expect(result.data!.type).toBe('image/png');
  });

  it('aborts when no bytes arrive for the stall window mid-body', async () => {
    // One healthy chunk, then silence — the stall timer must fire and
    // settle the pending read via the abort signal.
    vi.stubGlobal('fetch', mockFetchStreaming({ chunkDelaysMs: [1000], stall: true }));

    const promise = streamDownloadWithStallGuard('https://cdn.discordapp.com/dead-link.png');
    await vi.advanceTimersByTimeAsync(35_000);
    const result = await promise;

    expect(result).toEqual({ success: false, data: null });
  });

  it('aborts when the initial response never arrives', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          (init!.signal as AbortSignal).addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
      )
    );

    const promise = streamDownloadWithStallGuard('https://cdn.discordapp.com/black-hole.png');
    await vi.advanceTimersByTimeAsync(31_000);
    const result = await promise;

    expect(result).toEqual({ success: false, data: null });
  });

  it('fails fast on an HTTP error without retrying', async () => {
    const fetchMock = mockFetchStreaming({ chunkDelaysMs: [], status: 404 });
    vi.stubGlobal('fetch', fetchMock);

    const promise = streamDownloadWithStallGuard('https://cdn.discordapp.com/gone.png');
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('honors Retry-After on 429, surfaces it via onRateLimit, and retries', async () => {
    let call = 0;
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      call++;
      if (call === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          headers: new Headers({ 'retry-after': '3' }),
          body: null,
        } as unknown as Response);
      }
      return Promise.resolve(
        makeStreamingResponse({ chunkDelaysMs: [100] }, init!.signal as AbortSignal)
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = streamDownloadWithStallGuard('https://cdn.discordapp.com/busy.png');
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockDiscordService.onRateLimit).toHaveBeenCalledWith(3);
  });

  it('applies the jittered searchDelay pacing before fetching (lib parity)', async () => {
    mockDiscordService.searchDelaySecs = 2;
    const fetchMock = mockFetchStreaming({ chunkDelaysMs: [10] });
    vi.stubGlobal('fetch', fetchMock);

    const promise = streamDownloadWithStallGuard('https://cdn.discordapp.com/paced.png');

    // Pacing window not yet elapsed — no fetch
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const result = await promise;
    expect(result.success).toBe(true);
  });

  it('falls back to a buffered read when the environment has no body stream', async () => {
    const blob = new Blob(['buffered'], { type: 'text/plain' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: null,
        blob: () => Promise.resolve(blob),
      } as unknown as Response)
    );

    const promise = streamDownloadWithStallGuard('https://cdn.discordapp.com/no-stream.png');
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.data).toBe(blob);
  });
});
