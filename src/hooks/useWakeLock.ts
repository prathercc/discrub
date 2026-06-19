import { useEffect, useRef } from 'react';
import { useAppSelector } from '@/app/hooks';
import { selectIsOperationRunning } from '@features/app/operationSelectors';

/**
 * Hold a Screen Wake Lock while any long operation (purge, export, load-all) is
 * running, so the display doesn't sleep mid-run. A sleeping screen lets the
 * browser throttle/suspend the `setTimeout` pacing that drives the delete loop,
 * stalling it — the #206 report ("deletion pauses when the PC screen turns
 * off"). The lock auto-releases when the tab is hidden, so we re-acquire on
 * `visibilitychange`. No-op where the API is unsupported (non-secure context,
 * Firefox without the flag, older browsers, jsdom).
 *
 * Caveat: a screen wake lock keeps the *display* awake; it does not exempt a
 * *backgrounded* tab from timer throttling when the user switches away. That's
 * the (deferred) Web Worker offload arm — this solves the "screen off" half.
 */
export function useWakeLock(): void {
  const isOperationRunning = useAppSelector(selectIsOperationRunning);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!isOperationRunning) return;
    const wakeLock = navigator.wakeLock;
    if (!wakeLock || typeof wakeLock.request !== 'function') return;

    let cancelled = false;

    const acquire = async () => {
      if (cancelled || sentinelRef.current) return;
      try {
        const sentinel = await wakeLock.request('screen');
        if (cancelled) {
          void Promise.resolve(sentinel.release()).catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        // The browser releases the lock when the tab is hidden; drop our ref
        // so the visibilitychange handler can re-acquire it on return.
        sentinel.addEventListener('release', () => {
          sentinelRef.current = null;
        });
      } catch {
        // request() rejects when the document isn't visible or UA policy
        // blocks it; visibilitychange retries once the tab is foregrounded.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) void Promise.resolve(sentinel.release()).catch(() => {});
    };
  }, [isOperationRunning]);
}
