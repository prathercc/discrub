import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { throttleImmuneSleep, isWorkerPacingActive, _resetWorkerForTesting } from './workerTimers';

/** A stand-in Worker that answers each {id, ms} with a zero-delay {id}. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static failConstruction = false;
  onmessage: ((event: { data: { id: number } }) => void) | null = null;
  onerror: (() => void) | null = null;
  posted: { id: number; ms: number }[] = [];
  terminated = false;

  constructor() {
    if (FakeWorker.failConstruction) throw new Error('no workers here');
    FakeWorker.instances.push(this);
  }

  postMessage(data: { id: number; ms: number }) {
    this.posted.push(data);
    queueMicrotask(() => this.onmessage?.({ data: { id: data.id } }));
  }

  terminate() {
    this.terminated = true;
  }
}

describe('throttleImmuneSleep', () => {
  const originalWorker = globalThis.Worker;

  beforeEach(() => {
    FakeWorker.instances = [];
    FakeWorker.failConstruction = false;
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
    _resetWorkerForTesting();
  });

  afterEach(() => {
    _resetWorkerForTesting();
    vi.unstubAllGlobals();
    globalThis.Worker = originalWorker;
  });

  it('drives sleeps through one shared worker', async () => {
    await throttleImmuneSleep(50);
    await throttleImmuneSleep(70);
    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0].posted).toEqual([
      { id: expect.any(Number), ms: 50 },
      { id: expect.any(Number), ms: 70 },
    ]);
    expect(isWorkerPacingActive()).toBe(true);
  });

  it('falls back to setTimeout when worker construction fails', async () => {
    FakeWorker.failConstruction = true;
    const start = Date.now();
    await throttleImmuneSleep(30);
    expect(Date.now() - start).toBeGreaterThanOrEqual(25);
    expect(isWorkerPacingActive()).toBe(false);
  });

  it('resolves everything pending and falls back for good if the worker dies', async () => {
    const hang = new Promise<void>((resolve) => {
      // Post a sleep whose answer never comes, then kill the worker.
      void throttleImmuneSleep(10_000).then(resolve);
    });
    const worker = FakeWorker.instances[0];
    expect(worker).toBeDefined();
    worker.onmessage = null; // swallow the reply
    worker.onerror?.();
    await hang; // resolved by the error handler, not the timer
    // A dead worker is not rebuilt — later sleeps take the setTimeout path.
    expect(isWorkerPacingActive()).toBe(false);
    const start = Date.now();
    await throttleImmuneSleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
    expect(FakeWorker.instances).toHaveLength(1);
  });
});
