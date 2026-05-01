import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import { storage } from '@/extension/storage';
import type { StatusLogEntry, ToastAction } from './statusTypes';
import { StatusLevel, initialStatusState } from './statusTypes';

/**
 * Status log slice.
 *
 * Storage layout (Discrub-statuslog database):
 *
 *   <timestampMs> → StatusLogEntry  (one row per entry, browseable in DevTools)
 *
 * Hydration is async (`loadStatusLog` thunk) — boot dispatches it and
 * the panel briefly shows empty until the read resolves. Trade-off
 * accepted as part of moving every persistent store to IndexedDB.
 */

let nextId = 0;

/**
 * One id per page-load. Stamped on every `addStatusEntry` so the panel
 * can group entries by session (#126). Tests can override via
 * `_setCurrentSessionIdForTesting`.
 */
function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

let currentSessionId = generateSessionId();

/** Test-only escape hatch — control session id for grouping tests. */
export function _setCurrentSessionIdForTesting(id: string | null): void {
  currentSessionId = id ?? generateSessionId();
}

/** Read the current page-load session id (used by StatusPanel grouping). */
export function getCurrentSessionId(): string {
  return currentSessionId;
}

/**
 * Load every persisted status entry on app boot. One IDB transaction.
 * Sorted ascending by timestamp so the panel renders in chronological
 * order without per-render sorting.
 */
export const loadStatusLog = createAsyncThunk(
  'status/loadStatusLog',
  async (_, { rejectWithValue }) => {
    try {
      const all = await storage.statuslog.entries<StatusLogEntry>();
      const sorted = all
        .map(([_key, entry]) => entry)
        .sort((a, b) => a.timestamp - b.timestamp);
      // Seed nextId so newly-added entries don't collide with persisted ones.
      nextId = sorted.length > 0
        ? Math.max(...sorted.map((e) => Number(e.id) || 0)) + 1
        : 0;
      return sorted;
    } catch (error) {
      console.error('Failed to load status log:', error);
      return rejectWithValue('Failed to load status log');
    }
  },
);

/**
 * Best-effort persistence helpers — fire-and-forget, never block the
 * Redux dispatch they originate from. Failures are logged via the
 * adapter; we can't surface storage errors to the UI from a reducer.
 */
function persistEntry(entry: StatusLogEntry): void {
  void storage.statuslog.set(String(entry.timestamp) + '-' + entry.id, entry);
}

function persistTrim(removedKeys: string[]): void {
  removedKeys.forEach((k) => void storage.statuslog.remove(k));
}

function persistClear(): void {
  void storage.statuslog.clear();
}

const statusSlice = createSlice({
  name: 'status',
  initialState: initialStatusState,
  reducers: {
    addStatusEntry: (
      state,
      action: PayloadAction<{ level: StatusLevel; message: string }>,
    ) => {
      const entry: StatusLogEntry = {
        id: String(nextId++),
        timestamp: Date.now(),
        level: action.payload.level,
        message: action.payload.message,
        sessionId: currentSessionId,
      };
      state.entries.push(entry);
      persistEntry(entry);

      // Trim from the front if exceeding max — also trim the persisted store.
      if (state.entries.length > state.maxEntries) {
        const overflow = state.entries.length - state.maxEntries;
        const removed = state.entries.slice(0, overflow);
        state.entries = state.entries.slice(overflow);
        persistTrim(removed.map((e) => String(e.timestamp) + '-' + e.id));
      }
    },
    clearStatusLog: (state) => {
      state.entries = [];
      persistClear();
    },
    showOperationTip: (state, action: PayloadAction<string>) => {
      state.operationTip.isVisible = true;
      state.operationTip.message = action.payload;
    },
    hideOperationTip: (state) => {
      state.operationTip.isVisible = false;
    },
    showToast: (
      state,
      action: PayloadAction<{
        level: StatusLevel;
        message: string;
        duration?: number;
        action?: ToastAction;
      }>,
    ) => {
      state.toast.isVisible = true;
      state.toast.level = action.payload.level;
      state.toast.message = action.payload.message;
      state.toast.duration = action.payload.duration ?? 3000;
      state.toast.action = action.payload.action;
    },
    hideToast: (state) => {
      state.toast.isVisible = false;
      state.toast.action = undefined;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadStatusLog.fulfilled, (state, action) => {
      // Merge persisted history with anything synchronously dispatched
      // during boot (e.g. the "New session established" marker fired
      // from main.tsx before the IDB read resolves). Dedupe by the same
      // composite key the storage layer uses so a re-load doesn't
      // double-count rows that are already in memory.
      const keyOf = (e: StatusLogEntry) => `${e.timestamp}-${e.id}`;
      const existingKeys = new Set(state.entries.map(keyOf));
      const merged: StatusLogEntry[] = [
        ...action.payload.filter((e) => !existingKeys.has(keyOf(e))),
        ...state.entries,
      ].sort((a, b) => a.timestamp - b.timestamp);
      state.entries = merged.slice(-state.maxEntries);
    });
  },
});

export const {
  addStatusEntry,
  clearStatusLog,
  showOperationTip,
  hideOperationTip,
  showToast,
  hideToast,
} = statusSlice.actions;

// Selectors
export const selectStatusEntries = (state: RootState) => state.status.entries;
export const selectStatusCount = (state: RootState) => state.status.entries.length;
export const selectOperationTip = (state: RootState) => state.status.operationTip;
export const selectToast = (state: RootState) => state.status.toast;

export default statusSlice.reducer;
