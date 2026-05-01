import { describe, it, expect } from 'vitest';
import { groupEntriesBySession, LEGACY_SESSION_ID } from './statusGrouping';
import type { StatusLogEntry } from './statusTypes';

const make = (
  id: string,
  timestamp: number,
  message: string,
  sessionId?: string,
): StatusLogEntry => ({
  id,
  timestamp,
  level: 'info',
  message,
  sessionId,
});

describe('groupEntriesBySession', () => {
  it('returns an empty array for empty input', () => {
    expect(groupEntriesBySession([])).toEqual([]);
  });

  it('puts contiguous same-session entries into one group', () => {
    const entries = [
      make('0', 1000, 'one', 'session-A'),
      make('1', 2000, 'two', 'session-A'),
      make('2', 3000, 'three', 'session-A'),
    ];
    const groups = groupEntriesBySession(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].sessionId).toBe('session-A');
    expect(groups[0].entries).toHaveLength(3);
    expect(groups[0].startTime).toBe(1000);
    expect(groups[0].endTime).toBe(3000);
  });

  it('splits into multiple groups when sessionId changes', () => {
    const entries = [
      make('0', 1000, 'A1', 'session-A'),
      make('1', 2000, 'A2', 'session-A'),
      make('2', 3000, 'B1', 'session-B'),
      make('3', 4000, 'B2', 'session-B'),
    ];
    const groups = groupEntriesBySession(entries);
    expect(groups).toHaveLength(2);
    expect(groups[0].sessionId).toBe('session-A');
    expect(groups[0].entries.map((e) => e.message)).toEqual(['A1', 'A2']);
    expect(groups[1].sessionId).toBe('session-B');
    expect(groups[1].entries.map((e) => e.message)).toEqual(['B1', 'B2']);
  });

  it('treats entries without a sessionId as the LEGACY group', () => {
    const entries = [
      make('0', 1000, 'old1'),
      make('1', 2000, 'old2'),
      make('2', 3000, 'fresh', 'session-A'),
    ];
    const groups = groupEntriesBySession(entries);
    expect(groups).toHaveLength(2);
    expect(groups[0].sessionId).toBe(LEGACY_SESSION_ID);
    expect(groups[0].entries.map((e) => e.message)).toEqual(['old1', 'old2']);
    expect(groups[1].sessionId).toBe('session-A');
  });

  it('creates separate groups when sessions interleave (rare clock-skew case)', () => {
    const entries = [
      make('0', 1000, 'A1', 'session-A'),
      make('1', 2000, 'B1', 'session-B'),
      make('2', 3000, 'A2', 'session-A'),
    ];
    const groups = groupEntriesBySession(entries);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.sessionId)).toEqual(['session-A', 'session-B', 'session-A']);
  });

  it('records correct start and end times per group', () => {
    const entries = [
      make('0', 1500, 'one', 'session-A'),
      make('1', 1700, 'two', 'session-A'),
      make('2', 5000, 'three', 'session-B'),
    ];
    const groups = groupEntriesBySession(entries);
    expect(groups[0].startTime).toBe(1500);
    expect(groups[0].endTime).toBe(1700);
    expect(groups[1].startTime).toBe(5000);
    expect(groups[1].endTime).toBe(5000);
  });
});
