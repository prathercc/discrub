import { describe, it, expect, vi } from 'vitest';
import {
  waitWhilePaused,
  checkCancelled,
  cancellableDelay,
  withTransientRetry,
} from './operationLoopUtils';
import type { RootState } from '@/app/store';
import { initialAppState } from '@features/app/appTypes';

function createMockGetState(overrides: Partial<RootState['app']> = {}): () => RootState {
  const appState = { ...initialAppState, ...overrides };
  return () => ({ app: appState } as RootState);
}

describe('waitWhilePaused', () => {
  it('resolves immediately when not paused', async () => {
    const getState = createMockGetState({ discrubPaused: false });
    await waitWhilePaused(getState);
    // If we reach here, it resolved
    expect(true).toBe(true);
  });

  it('blocks while paused and resumes on unpause', async () => {
    let paused = true;
    const getState = () =>
      ({
        app: { ...initialAppState, discrubPaused: paused, discrubCancelled: false },
      }) as RootState;

    const start = Date.now();
    const promise = waitWhilePaused(getState);

    setTimeout(() => {
      paused = false;
    }, 100);

    await promise;
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });

  it('resolves when cancelled while paused', async () => {
    let cancelled = false;
    const getState = () =>
      ({
        app: { ...initialAppState, discrubPaused: true, discrubCancelled: cancelled },
      }) as RootState;

    const promise = waitWhilePaused(getState);

    setTimeout(() => {
      cancelled = true;
    }, 100);

    await promise;
    // Should have resolved due to cancellation
    expect(true).toBe(true);
  });
});

describe('cancellableDelay', () => {
  it('completes the full delay and returns false when not cancelled', async () => {
    const getState = createMockGetState({ discrubCancelled: false, discrubPaused: false });
    const start = Date.now();
    const result = await cancellableDelay(400, getState);
    const elapsed = Date.now() - start;
    expect(result).toBe(false);
    expect(elapsed).toBeGreaterThanOrEqual(350);
  });

  it('returns true early when cancelled during delay', async () => {
    let cancelled = false;
    const getState = () =>
      ({
        app: { ...initialAppState, discrubPaused: false, discrubCancelled: cancelled },
      }) as RootState;

    const start = Date.now();
    setTimeout(() => { cancelled = true; }, 100);
    const result = await cancellableDelay(2000, getState);
    const elapsed = Date.now() - start;
    expect(result).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it('pauses during delay and resumes', async () => {
    let paused = true;
    const getState = () =>
      ({
        app: { ...initialAppState, discrubPaused: paused, discrubCancelled: false },
      }) as RootState;

    const start = Date.now();
    setTimeout(() => { paused = false; }, 300);
    const result = await cancellableDelay(200, getState);
    const elapsed = Date.now() - start;
    expect(result).toBe(false);
    // Should take at least 300ms (paused) + ~200ms (delay)
    expect(elapsed).toBeGreaterThanOrEqual(400);
  });
});

describe('checkCancelled', () => {
  it('returns false when not cancelled', () => {
    const getState = createMockGetState({ discrubCancelled: false });
    expect(checkCancelled(getState)).toBe(false);
  });

  it('returns true when cancelled', () => {
    const getState = createMockGetState({ discrubCancelled: true });
    expect(checkCancelled(getState)).toBe(true);
  });
});

describe('withTransientRetry', () => {
  it('returns the first success without retrying', async () => {
    const getState = createMockGetState();
    const fn = vi.fn().mockResolvedValue({ success: true, status: 200, data: 'ok' });
    const onRetry = vi.fn();

    const result = await withTransientRetry(fn, { getState, onRetry, baseDelayMs: 10 });

    expect(result).toEqual({ success: true, status: 200, data: 'ok' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('retries transient failures then returns success', async () => {
    const getState = createMockGetState();
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ success: false, status: undefined })
      .mockResolvedValueOnce({ success: false, status: 503 })
      .mockResolvedValueOnce({ success: true, status: 200, data: 'recovered' });
    const onRetry = vi.fn();

    const result = await withTransientRetry(fn, {
      getState,
      onRetry,
      baseDelayMs: 10,
      maxDelayMs: 50,
    });

    expect(result).toEqual({ success: true, status: 200, data: 'recovered' });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0][0]).toBe(1);
    expect(onRetry.mock.calls[1][0]).toBe(2);
  });

  it('returns the final failure when retries are exhausted', async () => {
    const getState = createMockGetState();
    const fn = vi.fn().mockResolvedValue({ success: false, status: undefined });
    const onRetry = vi.fn();

    const result = await withTransientRetry(fn, {
      getState,
      onRetry,
      maxRetries: 3,
      baseDelayMs: 5,
    });

    expect(result).toEqual({ success: false, status: undefined });
    expect(fn).toHaveBeenCalledTimes(4);
    expect(onRetry).toHaveBeenCalledTimes(3);
  });

  it('does not retry permanent 4xx failures', async () => {
    const getState = createMockGetState();
    const cases = [401, 403, 404, 400];
    for (const status of cases) {
      const fn = vi.fn().mockResolvedValue({ success: false, status });
      const onRetry = vi.fn();
      const result = await withTransientRetry(fn, { getState, onRetry, baseDelayMs: 5 });
      expect(result).toEqual({ success: false, status });
      expect(fn).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    }
  });

  it('honors a custom shouldRetry predicate', async () => {
    const getState = createMockGetState();
    const fn = vi.fn().mockResolvedValue({ success: false, status: 404 });
    const onRetry = vi.fn();

    const result = await withTransientRetry(fn, {
      getState,
      onRetry,
      baseDelayMs: 5,
      maxRetries: 2,
      shouldRetry: (r) => r.status === 404,
    });

    expect(result).toEqual({ success: false, status: 404 });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('aborts mid-backoff when cancelled and returns the last failure', async () => {
    let cancelled = false;
    const getState = () =>
      ({
        app: { ...initialAppState, discrubPaused: false, discrubCancelled: cancelled },
      }) as RootState;
    const fn = vi.fn().mockResolvedValue({ success: false, status: 500 });

    setTimeout(() => {
      cancelled = true;
    }, 50);

    const start = Date.now();
    const result = await withTransientRetry(fn, {
      getState,
      baseDelayMs: 5000,
      maxRetries: 3,
    });
    const elapsed = Date.now() - start;

    expect(result).toEqual({ success: false, status: 500 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeLessThan(500);
  });

  it('aborts mid-backoff when signal aborts', async () => {
    const getState = createMockGetState();
    const controller = new AbortController();
    const fn = vi.fn().mockResolvedValue({ success: false, status: 500 });

    setTimeout(() => controller.abort(), 50);

    const start = Date.now();
    const result = await withTransientRetry(fn, {
      getState,
      signal: controller.signal,
      baseDelayMs: 5000,
      maxRetries: 3,
    });
    const elapsed = Date.now() - start;

    expect(result).toEqual({ success: false, status: 500 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeLessThan(500);
  });

  it('caps backoff at maxDelayMs', async () => {
    const getState = createMockGetState();
    const fn = vi.fn().mockResolvedValue({ success: false, status: 500 });
    const onRetry = vi.fn();

    await withTransientRetry(fn, {
      getState,
      onRetry,
      baseDelayMs: 1000,
      maxDelayMs: 50,
      maxRetries: 4,
    });

    expect(onRetry).toHaveBeenCalledTimes(4);
    for (const call of onRetry.mock.calls) {
      expect(call[1]).toBeLessThanOrEqual(50);
    }
  });
});
