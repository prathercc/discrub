import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { storage } from '@/extension/storage';
import type { RootState } from '@/app/store';
import { DEFAULT_HOTKEYS } from './defaults';
import type { HotkeyActionId, HotkeyBinding, HotkeysState } from './types';

/**
 * Single IndexedDB key that holds the entire hotkey state ({enabled,
 * bindings}). One read on boot, one write on each mutation. We keep it
 * out of `defaultSettings` so adding/removing actions doesn't churn the
 * settings shape — hotkey config is its own concern.
 */
const STORAGE_KEY = 'hotkeys';

const initialState: HotkeysState = {
  enabled: true,
  bindings: { ...DEFAULT_HOTKEYS },
};

/**
 * Hydrate from IDB on boot. Missing key → defaults. Stored bindings
 * are merged on top of defaults so that adding a new action in code
 * doesn't leave it unbound for users who already have a stored map.
 */
export const loadHotkeys = createAsyncThunk(
  'hotkeys/load',
  async (_, { rejectWithValue }) => {
    try {
      const stored = await storage.settings.get<Partial<HotkeysState>>(STORAGE_KEY);
      return {
        enabled: stored?.enabled ?? true,
        bindings: { ...DEFAULT_HOTKEYS, ...(stored?.bindings ?? {}) },
      } satisfies HotkeysState;
    } catch (err) {
      console.error('Failed to load hotkeys:', err);
      return rejectWithValue('Failed to load hotkeys');
    }
  },
);

async function persist(state: HotkeysState): Promise<void> {
  await storage.settings.set(STORAGE_KEY, state);
}

/**
 * Update one binding. Optimistically applies in-memory state on
 * `.pending`, then persists; mirrors the appSlice.updateSetting
 * pattern so two rapid rebinds don't read stale state.
 */
export const setHotkeyBinding = createAsyncThunk(
  'hotkeys/setBinding',
  async (
    { actionId, key }: { actionId: HotkeyActionId; key: HotkeyBinding },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as RootState;
      const next: HotkeysState = {
        enabled: state.hotkeys.enabled,
        bindings: { ...state.hotkeys.bindings, [actionId]: key },
      };
      await persist(next);
      return next;
    } catch (err) {
      console.error('Failed to set hotkey:', err);
      return rejectWithValue('Failed to set hotkey');
    }
  },
);

/**
 * Reset a single action's binding to its compile-time default.
 * Distinct from `clearHotkeyBinding` (which would unbind entirely);
 * users want "give me the default back", not "leave it blank".
 */
export const resetHotkeyBinding = createAsyncThunk(
  'hotkeys/resetBinding',
  async (actionId: HotkeyActionId, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const next: HotkeysState = {
        enabled: state.hotkeys.enabled,
        bindings: { ...state.hotkeys.bindings, [actionId]: DEFAULT_HOTKEYS[actionId] },
      };
      await persist(next);
      return next;
    } catch (err) {
      console.error('Failed to reset hotkey:', err);
      return rejectWithValue('Failed to reset hotkey');
    }
  },
);

/** Reset every binding to defaults; preserves the master `enabled`. */
export const resetAllHotkeys = createAsyncThunk(
  'hotkeys/resetAll',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const next: HotkeysState = {
        enabled: state.hotkeys.enabled,
        bindings: { ...DEFAULT_HOTKEYS },
      };
      await persist(next);
      return next;
    } catch (err) {
      console.error('Failed to reset all hotkeys:', err);
      return rejectWithValue('Failed to reset all hotkeys');
    }
  },
);

/** Master enable/disable. Doesn't touch the bindings map. */
export const setHotkeysEnabled = createAsyncThunk(
  'hotkeys/setEnabled',
  async (enabled: boolean, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const next: HotkeysState = {
        enabled,
        bindings: state.hotkeys.bindings,
      };
      await persist(next);
      return next;
    } catch (err) {
      console.error('Failed to toggle hotkeys:', err);
      return rejectWithValue('Failed to toggle hotkeys');
    }
  },
);

const hotkeysSlice = createSlice({
  name: 'hotkeys',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadHotkeys.fulfilled, (state, action: PayloadAction<HotkeysState>) => {
        state.enabled = action.payload.enabled;
        state.bindings = action.payload.bindings;
      })
      // Optimistic in-memory update on `.pending` so a rapid sequence
      // of rebinds reads the latest values rather than the closure's
      // stale snapshot. The IDB write happens inside the thunk; on
      // failure we keep the in-memory state (it'll re-write next time).
      .addCase(setHotkeyBinding.pending, (state, action) => {
        const { actionId, key } = action.meta.arg;
        state.bindings[actionId] = key;
      })
      .addCase(setHotkeyBinding.fulfilled, (state, action: PayloadAction<HotkeysState>) => {
        state.bindings = action.payload.bindings;
      })
      .addCase(resetHotkeyBinding.pending, (state, action) => {
        const id = action.meta.arg;
        state.bindings[id] = DEFAULT_HOTKEYS[id];
      })
      .addCase(resetHotkeyBinding.fulfilled, (state, action: PayloadAction<HotkeysState>) => {
        state.bindings = action.payload.bindings;
      })
      .addCase(resetAllHotkeys.pending, (state) => {
        state.bindings = { ...DEFAULT_HOTKEYS };
      })
      .addCase(resetAllHotkeys.fulfilled, (state, action: PayloadAction<HotkeysState>) => {
        state.bindings = action.payload.bindings;
      })
      .addCase(setHotkeysEnabled.pending, (state, action) => {
        state.enabled = action.meta.arg;
      })
      .addCase(setHotkeysEnabled.fulfilled, (state, action: PayloadAction<HotkeysState>) => {
        state.enabled = action.payload.enabled;
      });
  },
});

export default hotkeysSlice.reducer;

// ─── Selectors ──────────────────────────────────────────────────────
export const selectHotkeys = (state: RootState) => state.hotkeys;
export const selectHotkeysEnabled = (state: RootState) => state.hotkeys.enabled;
export const selectHotkeyBindings = (state: RootState) => state.hotkeys.bindings;

/**
 * Memoization-friendly selector for a single action's binding. Stable
 * reference per actionId so React Tooltip wrappers don't re-render on
 * unrelated bindings changing.
 */
export const selectHotkeyBinding = (actionId: HotkeyActionId) => (state: RootState): HotkeyBinding =>
  state.hotkeys.bindings[actionId];
