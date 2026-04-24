import { describe, it, expect } from 'vitest';
import { waitWhilePaused, checkCancelled, cancellableDelay } from './operationLoopUtils';
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
