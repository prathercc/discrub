import type { StatusLogEntry } from './statusTypes';

/**
 * Synthetic id used for entries persisted before sessionId was added
 * (#126). They get grouped into a single "Earlier activity" bucket.
 */
export const LEGACY_SESSION_ID = 'legacy';

export interface SessionGroup {
  sessionId: string;
  entries: StatusLogEntry[];
  startTime: number;
  endTime: number;
}

/**
 * Group consecutive entries by sessionId, preserving the input order.
 * Assumes entries are already sorted ascending by timestamp; the panel's
 * chronological rendering relies on the caller's order being authoritative.
 */
export function groupEntriesBySession(entries: StatusLogEntry[]): SessionGroup[] {
  const groups: SessionGroup[] = [];
  let current: SessionGroup | null = null;

  for (const entry of entries) {
    const groupId = entry.sessionId ?? LEGACY_SESSION_ID;
    if (!current || current.sessionId !== groupId) {
      current = {
        sessionId: groupId,
        entries: [],
        startTime: entry.timestamp,
        endTime: entry.timestamp,
      };
      groups.push(current);
    }
    current.entries.push(entry);
    current.endTime = entry.timestamp;
  }

  return groups;
}
