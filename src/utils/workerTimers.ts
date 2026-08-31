/**
 * Throttle-immune sleep (#247).
 *
 * Every pacing wait in a long operation — per-request delays and 429/202
 * sleeps inside discrub-core, pause polls and cancellable delays here —
 * used to ride main-thread setTimeout chains. Chrome throttles those to
 * one tick per second in a background tab, and intensive throttling
 * (after ~5 minutes hidden) clamps chained timers to one tick per
 * MINUTE, so a purge pacing at ~1s/message degraded ~60× the moment the
 * tab was left alone. Timers inside a dedicated Web Worker are not
 * throttled, so the sleep is driven from one shared worker and the page
 * just resolves a promise when the worker answers.
 *
 * Falls back to plain setTimeout wherever Workers are unavailable
 * (tests, or a host that refuses worker construction).
 */

let worker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<number, () => void>();

const getWorker = (): Worker | null => {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./pacing.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number }>) => {
      const resolve = pending.get(event.data.id);
      pending.delete(event.data.id);
      resolve?.();
    };
    // A worker that dies mid-operation must not strand sleepers: resolve
    // everything pending and let future sleeps take the setTimeout path.
    worker.onerror = () => {
      for (const resolve of pending.values()) resolve();
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
};

/** Resolve after `ms`, on a worker timer when one is available. */
export const throttleImmuneSleep = (ms: number): Promise<void> => {
  const host = getWorker();
  if (!host) return new Promise((resolve) => setTimeout(resolve, ms));
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    host.postMessage({ id, ms });
  });
};

/** True when sleeps are currently worker-driven; surfaced for tests and diagnostics. */
export const isWorkerPacingActive = (): boolean => getWorker() !== null;

/** Test-only: drop the worker so the next sleep re-evaluates availability. */
export const _resetWorkerForTesting = (): void => {
  worker?.terminate();
  worker = undefined;
  pending.clear();
};
