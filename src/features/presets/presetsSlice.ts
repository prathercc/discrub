import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { storage } from '@/extension/storage';
import type { RootState } from '@/app/store';
import type { ExportPreset } from '@features/export/exportTypes';

/**
 * Slice for user-created export presets.
 *
 * Storage layout (Discrub-presets database):
 *
 *   <presetId> → ExportPreset object   (one row per preset)
 *
 * Built-in presets are NOT persisted — they're hard-coded in
 * `exportTypes::BUILT_IN_PRESETS` and merged in at read time by the UI.
 * This slice holds only the user-created ones.
 */

export interface PresetsState {
  /** Map of preset ID → preset record. */
  presets: Record<string, ExportPreset>;
  isLoaded: boolean;
}

const initialState: PresetsState = {
  presets: {},
  isLoaded: false,
};

/** Load every user preset on app boot. One IDB transaction. */
export const loadPresets = createAsyncThunk(
  'presets/load',
  async (_, { rejectWithValue }) => {
    try {
      const entries = await storage.presets.entries<ExportPreset>();
      const presets: Record<string, ExportPreset> = {};
      for (const [id, preset] of entries) {
        presets[id] = preset;
      }
      return presets;
    } catch (error) {
      console.error('Failed to load presets:', error);
      return rejectWithValue('Failed to load presets');
    }
  },
);

/** Insert or update a single preset. Single-row write. */
export const savePreset = createAsyncThunk<ExportPreset, ExportPreset>(
  'presets/save',
  async (preset, { rejectWithValue }) => {
    try {
      await storage.presets.set(preset.id, preset);
      return preset;
    } catch (error) {
      console.error('Failed to save preset:', error);
      return rejectWithValue('Failed to save preset');
    }
  },
);

/** Remove a single preset by ID. Single-row write. */
export const removePreset = createAsyncThunk<string, string>(
  'presets/remove',
  async (presetId, { rejectWithValue }) => {
    try {
      await storage.presets.remove(presetId);
      return presetId;
    } catch (error) {
      console.error('Failed to remove preset:', error);
      return rejectWithValue('Failed to remove preset');
    }
  },
);

const presetsSlice = createSlice({
  name: 'presets',
  initialState,
  reducers: {
    /** In-memory addition without persistence (for transient UI state). */
    setPresetsInMemory: (
      state,
      action: PayloadAction<Record<string, ExportPreset>>,
    ) => {
      state.presets = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPresets.fulfilled, (state, action) => {
        state.presets = action.payload;
        state.isLoaded = true;
      })
      .addCase(loadPresets.rejected, (state) => {
        state.isLoaded = true;
      })
      .addCase(savePreset.fulfilled, (state, action) => {
        state.presets[action.payload.id] = action.payload;
      })
      .addCase(removePreset.fulfilled, (state, action) => {
        delete state.presets[action.payload];
      });
  },
});

export const { setPresetsInMemory } = presetsSlice.actions;

/* ─────── Selectors ─────── */

export const selectPresetsState = (state: RootState) => state.presets;
export const selectPresetsMap = (state: RootState) => state.presets.presets;
export const selectPresetsLoaded = (state: RootState) => state.presets.isLoaded;

/** All user-created presets as a sorted array (alpha by name). */
export const selectUserPresets = (state: RootState): ExportPreset[] =>
  Object.values(state.presets.presets).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

/** Look up one preset by ID (returns undefined if missing). */
export const selectPresetById =
  (id: string) =>
  (state: RootState): ExportPreset | undefined =>
    state.presets.presets[id];

export default presetsSlice.reducer;
