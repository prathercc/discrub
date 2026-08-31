import { describe, it, expect, vi, beforeEach } from 'vitest';

let sleepCalls: number[] = [];
let oversleepMs = 0;
let now = 0;
let paused = false;
let cancelledFlag = false;

// Deterministic sleep: records the asked-for chunk and, when oversleepMs is
// set, advances the mocked clock far past it (a throttled tab's oversleep).
vi.mock('./workerTimers', () => ({
  throttleImmuneSleep: (ms: number) => {
    sleepCalls.push(ms);
    now += oversleepMs || ms;
    return Promise.resolve();
  },
}));

vi.mock('@features/app/appSlice', () => ({
  selectDiscrubPaused: () => paused,
  selectDiscrubCancelled: () => cancelledFlag,
}));

import { cancellableDelay } from './operationLoopUtils';
import type { RootState } from '@/app/store';

const getState = () => ({}) as RootState;

describe('cancellableDelay (#247 wall-clock accounting)', () => {
  beforeEach(() => {
    sleepCalls = [];
    oversleepMs = 0;
    now = 1_000_000;
    paused = false;
    cancelledFlag = false;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  it('sleeps in 200ms chunks until the wall clock says done', async () => {
    const cancelled = await cancellableDelay(1000, getState);
    expect(cancelled).toBe(false);
    expect(sleepCalls).toEqual([200, 200, 200, 200, 200]);
  });

  it('credits an oversleeping chunk in full instead of stacking more sleeps', async () => {
    // One throttled chunk really slept 60s; a 1s delay must finish after it.
    oversleepMs = 60_000;
    const cancelled = await cancellableDelay(1000, getState);
    expect(cancelled).toBe(false);
    expect(sleepCalls).toHaveLength(1);
  });

  it('never asks for a chunk longer than the time remaining', async () => {
    const cancelled = await cancellableDelay(300, getState);
    expect(cancelled).toBe(false);
    expect(sleepCalls).toEqual([200, 100]);
  });

  it('reports cancellation from state without sleeping', async () => {
    cancelledFlag = true;
    const cancelled = await cancellableDelay(1000, getState);
    expect(cancelled).toBe(true);
    expect(sleepCalls).toHaveLength(0);
  });
});
