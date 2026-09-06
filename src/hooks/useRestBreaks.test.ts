import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let mockRunning = false;
let mockPaused = false;
let mockEnabled = true;
let mockBreakUntil: number | null = null;
const dispatch = vi.fn();

vi.mock('@/app/hooks', () => ({
  useAppSelector: (selector: () => unknown) => selector(),
  useAppDispatch: () => dispatch,
}));

vi.mock('@features/app/operationSelectors', () => ({
  selectIsHeavyOperationRunning: () => mockRunning,
}));

vi.mock('@features/app/appSlice', () => ({
  selectDiscrubPaused: () => mockPaused,
  selectRestBreaksEnabled: () => mockEnabled,
  selectRestBreakUntil: () => mockBreakUntil,
  setDiscrubPaused: (payload: boolean) => ({ type: 'app/setDiscrubPaused', payload }),
  setRestBreakUntil: (payload: number | null) => ({ type: 'app/setRestBreakUntil', payload }),
}));

vi.mock('@features/status/statusSlice', () => ({
  addStatusEntry: (payload: unknown) => ({ type: 'status/addStatusEntry', payload }),
}));

import { useRestBreaks, REST_BREAK_AFTER_MS, REST_BREAK_LENGTH_MS, REST_BREAK_TICK_MS } from './useRestBreaks';

const types = () => dispatch.mock.calls.map(([a]) => (a as { type: string }).type);
const payloadOf = (type: string) =>
  dispatch.mock.calls.filter(([a]) => (a as { type: string }).type === type).map(([a]) => (a as { payload: unknown }).payload);

// Mirror what the reducers would do, so the hook sees its own writes on
// the next tick the way it does against the real store.
const applyDispatches = () => {
  for (const [action] of dispatch.mock.calls.splice(0)) {
    const a = action as { type: string; payload: unknown };
    if (a.type === 'app/setDiscrubPaused') mockPaused = a.payload as boolean;
    if (a.type === 'app/setRestBreakUntil') mockBreakUntil = a.payload as number | null;
  }
};

describe('useRestBreaks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T12:00:00Z'));
    mockRunning = false;
    mockPaused = false;
    mockEnabled = true;
    mockBreakUntil = null;
    dispatch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

  it('does nothing while no heavy operation runs', () => {
    renderHook(() => useRestBreaks());
    advance(REST_BREAK_AFTER_MS * 2);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('pauses for a rest break after the active period, then resumes', () => {
    mockRunning = true;
    const { rerender } = renderHook(() => useRestBreaks());

    advance(REST_BREAK_AFTER_MS - REST_BREAK_TICK_MS);
    expect(dispatch).not.toHaveBeenCalled();

    advance(REST_BREAK_TICK_MS);
    expect(types()).toEqual(['app/setRestBreakUntil', 'app/setDiscrubPaused', 'status/addStatusEntry']);
    expect(payloadOf('app/setDiscrubPaused')).toEqual([true]);
    const until = payloadOf('app/setRestBreakUntil')[0] as number;
    expect(until - Date.now()).toBe(REST_BREAK_LENGTH_MS);
    const entry = payloadOf('status/addStatusEntry')[0] as { level: string; message: string };
    expect(entry.level).toBe('warning');
    expect(entry.message).toContain('Rest break');
    applyDispatches();
    rerender();

    advance(REST_BREAK_LENGTH_MS - REST_BREAK_TICK_MS);
    expect(dispatch).not.toHaveBeenCalled();

    advance(REST_BREAK_TICK_MS);
    expect(types()).toEqual(['app/setDiscrubPaused', 'app/setRestBreakUntil', 'status/addStatusEntry']);
    expect(payloadOf('app/setDiscrubPaused')).toEqual([false]);
    expect(payloadOf('app/setRestBreakUntil')).toEqual([null]);
    expect((payloadOf('status/addStatusEntry')[0] as { level: string }).level).toBe('success');
    applyDispatches();
    rerender();

    // The clock restarted: the next break is a full active period away.
    advance(REST_BREAK_AFTER_MS - REST_BREAK_TICK_MS);
    expect(dispatch).not.toHaveBeenCalled();
    advance(REST_BREAK_TICK_MS);
    expect(types()).toContain('app/setRestBreakUntil');
  });

  it("does not count the user's own pauses as activity", () => {
    mockRunning = true;
    const { rerender } = renderHook(() => useRestBreaks());

    advance(REST_BREAK_AFTER_MS / 2);
    mockPaused = true;
    rerender();
    advance(REST_BREAK_AFTER_MS);
    expect(dispatch).not.toHaveBeenCalled();

    mockPaused = false;
    rerender();
    advance(REST_BREAK_AFTER_MS / 2);
    expect(types()).toContain('app/setRestBreakUntil');
  });

  it('treats Resume during a break as skipping it and restarts the clock', () => {
    mockRunning = true;
    const { rerender } = renderHook(() => useRestBreaks());
    advance(REST_BREAK_AFTER_MS);
    applyDispatches();
    rerender();
    expect(mockPaused).toBe(true);

    // User clicks Resume.
    mockPaused = false;
    rerender();
    advance(REST_BREAK_TICK_MS);
    expect(types()).toEqual(['app/setRestBreakUntil', 'status/addStatusEntry']);
    expect(payloadOf('app/setRestBreakUntil')).toEqual([null]);
    expect((payloadOf('status/addStatusEntry')[0] as { message: string }).message).toContain('skipped');
    applyDispatches();
    rerender();

    advance(REST_BREAK_AFTER_MS - REST_BREAK_TICK_MS);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('never starts a break when the setting is off, and ends one if turned off mid-break', () => {
    mockRunning = true;
    mockEnabled = false;
    const { rerender } = renderHook(() => useRestBreaks());
    advance(REST_BREAK_AFTER_MS * 3);
    expect(dispatch).not.toHaveBeenCalled();

    mockEnabled = true;
    rerender();
    advance(REST_BREAK_AFTER_MS);
    applyDispatches();
    rerender();
    expect(mockPaused).toBe(true);

    mockEnabled = false;
    rerender();
    advance(REST_BREAK_TICK_MS);
    expect(payloadOf('app/setDiscrubPaused')).toEqual([false]);
    expect(payloadOf('app/setRestBreakUntil')).toEqual([null]);
  });

  it('clears a break marker when the operation ends', () => {
    mockRunning = true;
    const { rerender } = renderHook(() => useRestBreaks());
    advance(REST_BREAK_AFTER_MS);
    applyDispatches();
    rerender();

    mockRunning = false;
    rerender();
    expect(types()).toEqual(['app/setRestBreakUntil']);
    expect(payloadOf('app/setRestBreakUntil')).toEqual([null]);
  });
});
