import type { RootState } from '@/app/store';
import { selectDiscrubPaused, selectDiscrubCancelled } from '@features/app/appSlice';

/**
 * Error thrown when an operation is cancelled by the user.
 */
export class CancelledError extends Error {
  constructor() {
    super('Operation cancelled');
    this.name = 'CancelledError';
  }
}

/**
 * Waits in a polling loop while the operation is paused.
 * Resolves immediately if not paused or when unpaused.
 * Also resolves if cancelled while paused.
 */
export const waitWhilePaused = async (getState: () => RootState): Promise<void> => {
  while (selectDiscrubPaused(getState())) {
    await new Promise((r) => setTimeout(r, 200));
    if (selectDiscrubCancelled(getState())) return;
  }
};

/**
 * Returns true if the operation has been cancelled.
 */
export const checkCancelled = (getState: () => RootState): boolean => {
  return selectDiscrubCancelled(getState());
};

/**
 * Waits for the specified duration in small increments, checking for
 * cancellation and pause at each step. Returns true if cancelled.
 */
export const cancellableDelay = async (
  delayMs: number,
  getState: () => RootState,
): Promise<boolean> => {
  const interval = 200;
  let elapsed = 0;
  while (elapsed < delayMs) {
    if (checkCancelled(getState)) return true;
    await waitWhilePaused(getState);
    if (checkCancelled(getState)) return true;
    const remaining = delayMs - elapsed;
    await new Promise((r) => setTimeout(r, Math.min(interval, remaining)));
    elapsed += interval;
  }
  return checkCancelled(getState);
};

/**
 * Creates a shouldContinue callback for use in export/media services.
 * Awaits while paused, throws CancelledError if cancelled.
 */
export const createShouldContinue = (getState: () => RootState) => {
  return async (): Promise<void> => {
    await waitWhilePaused(getState);
    if (checkCancelled(getState)) {
      throw new CancelledError();
    }
  };
};
