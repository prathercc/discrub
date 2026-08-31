import { useEffect } from 'react';
import { useAppSelector } from '@/app/hooks';
import { selectIsOperationRunning } from '@features/app/operationSelectors';

/**
 * Holds a Web Lock while an operation runs (#247). Chromium exempts pages
 * holding a Web Lock from intensive timer throttling, so this backs up the
 * worker-driven pacing in `workerTimers.ts`: even a stray main-thread
 * timeout keeps ticking at the 1/second background rate instead of
 * 1/minute. No-ops quietly where the Locks API is missing.
 */
export function useOperationThrottleOptOut() {
  const isOperationRunning = useAppSelector(selectIsOperationRunning);

  useEffect(() => {
    if (!isOperationRunning || !navigator.locks?.request) return;

    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    navigator.locks.request('discrub-operation-running', { mode: 'shared' }, () => held).catch(() => undefined);

    return () => release?.();
  }, [isOperationRunning]);
}
