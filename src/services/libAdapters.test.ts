import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createShouldStop, createProgressManager, createNotificationManager } from './libAdapters';
import type { RootState } from '@/app/store';
import { initialAppState } from '@features/app/appTypes';

function createMockGetState(overrides: Partial<RootState['app']> = {}): () => RootState {
  const appState = { ...initialAppState, ...overrides };
  return () => ({ app: appState } as RootState);
}

describe('createShouldStop', () => {
  it('returns false when not paused and not cancelled', async () => {
    const getState = createMockGetState({ discrubPaused: false, discrubCancelled: false });
    const shouldStop = createShouldStop(getState);
    expect(await shouldStop()).toBe(false);
  });

  it('returns true when cancelled', async () => {
    const getState = createMockGetState({ discrubPaused: false, discrubCancelled: true });
    const shouldStop = createShouldStop(getState);
    expect(await shouldStop()).toBe(true);
  });

  it('waits while paused then returns false on unpause', async () => {
    let paused = true;
    const getState = () =>
      ({
        app: { ...initialAppState, discrubPaused: paused, discrubCancelled: false },
      }) as RootState;

    const shouldStop = createShouldStop(getState);
    const promise = shouldStop();

    // Unpause after a short delay
    setTimeout(() => {
      paused = false;
    }, 100);

    const result = await promise;
    expect(result).toBe(false);
  });

  it('returns true when cancelled while paused', async () => {
    let cancelled = false;
    const getState = () =>
      ({
        app: { ...initialAppState, discrubPaused: true, discrubCancelled: cancelled },
      }) as RootState;

    const shouldStop = createShouldStop(getState);
    const promise = shouldStop();

    // Cancel after a short delay
    setTimeout(() => {
      cancelled = true;
    }, 100);

    const result = await promise;
    expect(result).toBe(true);
  });
});

describe('createProgressManager', () => {
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn();
  });

  it('does not dispatch when setIsModifying called with true', () => {
    const pm = createProgressManager(dispatch);
    pm.setIsModifying(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch when setIsModifying called with false', () => {
    const pm = createProgressManager(dispatch);
    pm.setIsModifying(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch when setModifyEntity called', () => {
    const pm = createProgressManager(dispatch);
    pm.setModifyEntity({ id: 'msg-123' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch when setModifyEntity called with no id', () => {
    const pm = createProgressManager(dispatch);
    pm.setModifyEntity({});
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('createNotificationManager', () => {
  it('dispatches status entry on notify', async () => {
    const dispatch = vi.fn();
    const nm = createNotificationManager(dispatch);
    await nm.notify('Rate limited, waiting...', 3000);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          level: 'info',
          message: 'Rate limited, waiting...',
        }),
      }),
    );
  });
});
