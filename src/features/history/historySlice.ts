import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storage } from '@/extension/storage';
import type { RootState } from '@/app/store';
import type { RecentExport } from '@features/export/exportTypes';

/**
 * Slice for recent-export history.
 *
 * Storage layout (Discrub-history database):
 *
 *   <timestampMs> → RecentExport object   (one row per export)
 *
 * Keys are millisecond timestamps so DevTools sorts them naturally by
 * recency. Retention is capped to `MAX_RECENT_EXPORTS`; older rows are
 * pruned on each insert.
 */

const MAX_RECENT_EXPORTS = 50;

export interface HistoryState {
  /** Most-recent-first list of export records. */
  exports: RecentExport[];
  isLoaded: boolean;
}

const initialState: HistoryState = {
  exports: [],
  isLoaded: false,
};

/** Load every recent export. Sorted newest-first. */
export const loadRecentExports = createAsyncThunk(
  'history/loadRecentExports',
  async (_, { rejectWithValue }) => {
    try {
      const entries = await storage.history.entries<RecentExport>();
      // Keys are timestamps as strings; parse + sort descending.
      const sorted = entries
        .map(([key, record]) => ({ key, record }))
        .sort((a, b) => Number(b.key) - Number(a.key))
        .map(({ record }) => record);
      return sorted;
    } catch (error) {
      console.error('Failed to load recent exports:', error);
      return rejectWithValue('Failed to load recent exports');
    }
  },
);

/**
 * Append a new export record. Trims the oldest rows beyond
 * MAX_RECENT_EXPORTS in the same operation.
 */
export const addRecentExport = createAsyncThunk<RecentExport, RecentExport>(
  'history/addRecentExport',
  async (record, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const key = String(Date.now());
      await storage.history.set(key, record);

      // Prune anything older than MAX_RECENT_EXPORTS to keep the DB tidy.
      const currentCount = state.history.exports.length;
      if (currentCount + 1 > MAX_RECENT_EXPORTS) {
        const allKeys = await storage.history.keys();
        const sortedDesc = allKeys.sort((a, b) => Number(b) - Number(a));
        const toRemove = sortedDesc.slice(MAX_RECENT_EXPORTS);
        await Promise.all(toRemove.map((k) => storage.history.remove(k)));
      }

      return record;
    } catch (error) {
      console.error('Failed to add recent export:', error);
      return rejectWithValue('Failed to add recent export');
    }
  },
);

/** Clear every recent export record. One IDB clear. */
export const clearRecentExports = createAsyncThunk(
  'history/clearRecentExports',
  async (_, { rejectWithValue }) => {
    try {
      await storage.history.clear();
      return;
    } catch (error) {
      console.error('Failed to clear recent exports:', error);
      return rejectWithValue('Failed to clear recent exports');
    }
  },
);

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadRecentExports.fulfilled, (state, action) => {
        state.exports = action.payload;
        state.isLoaded = true;
      })
      .addCase(loadRecentExports.rejected, (state) => {
        state.isLoaded = true;
      })
      .addCase(addRecentExport.fulfilled, (state, action) => {
        state.exports = [action.payload, ...state.exports].slice(
          0,
          MAX_RECENT_EXPORTS,
        );
      })
      .addCase(clearRecentExports.fulfilled, (state) => {
        state.exports = [];
      });
  },
});

/* ─────── Selectors ─────── */

export const selectHistoryState = (state: RootState) => state.history;
export const selectRecentExports = (state: RootState) => state.history.exports;
export const selectHistoryLoaded = (state: RootState) => state.history.isLoaded;

export default historySlice.reducer;
