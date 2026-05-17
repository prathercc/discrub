import type { RootState } from '@/app/store';
import { selectDiscrubPaused, selectDiscrubCancelled } from '@features/app/appSlice';

/**
 * Error thrown when an operation is cancelled by the user.
 *
 * Optionally carries an `partialResult` field — a snapshot of the
 * function's in-flight accumulator at the moment of the cancel
 * throw. The caller's catch block can read it to recover work
 * completed before the cancel signal (#140), e.g. so a "X reactions
 * removed" summary reflects what really happened rather than zero.
 */
export class CancelledError extends Error {
  partialResult?: unknown;
  constructor(partialResult?: unknown) {
    super('Operation cancelled');
    this.name = 'CancelledError';
    this.partialResult = partialResult;
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
 * cancellation and pause at each step. Returns true if cancelled (by
 * either the Discrub cancel flag or, when provided, an AbortSignal).
 */
export const cancellableDelay = async (
  delayMs: number,
  getState: () => RootState,
  signal?: AbortSignal,
): Promise<boolean> => {
  const interval = 200;
  let elapsed = 0;
  while (elapsed < delayMs) {
    if (signal?.aborted || checkCancelled(getState)) return true;
    await waitWhilePaused(getState);
    if (signal?.aborted || checkCancelled(getState)) return true;
    const remaining = delayMs - elapsed;
    await new Promise((r) => setTimeout(r, Math.min(interval, remaining)));
    elapsed += interval;
  }
  return signal?.aborted || checkCancelled(getState);
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

/**
 * Minimal response shape required by withTransientRetry. Matches
 * discrub-core's APIResponse<T> ({ success, status?, data? }); kept
 * minimal here so any caller that returns the same envelope works.
 */
export interface RetryableResponse {
  success: boolean;
  status?: number;
}

export interface TransientRetryOptions<T extends RetryableResponse> {
  /** Max retries after the initial attempt. Default 5 (so up to 6 total calls). */
  maxRetries?: number;
  /** First backoff delay. Doubles each retry, capped at maxDelayMs. */
  baseDelayMs?: number;
  /** Backoff cap. Default 30000 (30s). */
  maxDelayMs?: number;
  /** Predicate to decide whether a failed response is transient. */
  shouldRetry?: (response: T) => boolean;
  /** Fires before each backoff sleep with (1-indexed retry number, delayMs, response). */
  onRetry?: (retryNumber: number, delayMs: number, response: T) => void;
  /** State accessor so backoff sleep can honor Pause/Cancel. */
  getState: () => RootState;
  /** Optional thunk signal so backoff sleep can honor abort. */
  signal?: AbortSignal;
}

/**
 * True for failed responses that withTransientRetry would have
 * retried: network errors (status undefined) and server-side
 * transients (5xx, 408 timeout, 425 too-early). 4xx (auth/perms/
 * not-found/bad-request) is permanent and not retried. 429 is
 * handled inside the lib and never bubbles here.
 *
 * Exported so consumers can distinguish "exhausted retries on a
 * transient" (pause + ask user to fix network) from "hard fail"
 * (reject the thunk) after withTransientRetry returns.
 */
export const isTransientApiFailure = (response: RetryableResponse): boolean => {
  if (response.success) return false;
  if (response.status === undefined) return true;
  if (response.status >= 500) return true;
  if (response.status === 408 || response.status === 425) return true;
  return false;
};

/**
 * Wraps an APIResponse-returning function with bounded transient
 * retry. Up to `maxRetries` retries on transient failure with
 * exponential backoff. Backoff sleep is Pause/Cancel/signal-aware so
 * the user can still cancel mid-wait. Returns the final response —
 * the caller decides what to do with terminal failure (e.g. pause
 * the operation so the user can fix the network).
 */
export const withTransientRetry = async <T extends RetryableResponse>(
  fn: () => Promise<T>,
  opts: TransientRetryOptions<T>,
): Promise<T> => {
  const maxRetries = opts.maxRetries ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const maxDelayMs = opts.maxDelayMs ?? 30000;
  const shouldRetry = opts.shouldRetry ?? isTransientApiFailure;

  let lastResponse: T = { success: false } as T;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (opts.signal?.aborted || checkCancelled(opts.getState)) return lastResponse;

    lastResponse = await fn();
    if (lastResponse.success || !shouldRetry(lastResponse)) return lastResponse;
    if (attempt === maxRetries) return lastResponse;

    const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
    opts.onRetry?.(attempt + 1, delayMs, lastResponse);
    const cancelled = await cancellableDelay(delayMs, opts.getState, opts.signal);
    if (cancelled) return lastResponse;
  }
  return lastResponse;
};
