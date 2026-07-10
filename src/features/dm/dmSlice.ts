import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Channel } from 'discrub-core/types/discord-types';
import { initialDmState } from './dmTypes';
import { getDiscordService } from '@services/discordService';
import type { RootState } from '@/app/store';

/**
 * DM slice - manages direct message channel state
 */

/**
 * Fetch all DM channels for the current user
 */
export const fetchDMs = createAsyncThunk(
  'dm/fetchDMs',
  async (token: string, { rejectWithValue }) => {
    try {
      const discordService = getDiscordService();
      const response = await discordService.fetchDirectMessages(token);

      if (!response.success || !response.data) {
        return rejectWithValue('Failed to fetch DMs');
      }

      return response.data as Channel[];
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch DMs'
      );
    }
  }
);

const dmSlice = createSlice({
  name: 'dm',
  initialState: initialDmState,
  reducers: {
    setSelectedDm: (state, action: PayloadAction<Channel | null>) => {
      state.selectedDm = action.payload;
    },
    clearDMs: (state) => {
      state.dms = [];
      state.selectedDm = null;
      state.selectedDms = [];
    },
    toggleDmSelection: (state, action: PayloadAction<Channel>) => {
      const index = state.selectedDms.findIndex(
        (dm: Channel) => dm.id === action.payload.id,
      );
      if (index >= 0) {
        state.selectedDms.splice(index, 1);
      } else {
        state.selectedDms.push(action.payload);
      }
    },
    selectAllDms: (state, action: PayloadAction<Channel[]>) => {
      state.selectedDms = [...action.payload];
    },
    deselectAllDms: (state) => {
      state.selectedDms = [];
    },
    // #218: Shift+Click range select — union, never deselects (mirrors
    // channelSlice.selectChannelsInRange).
    selectDmsInRange: (state, action: PayloadAction<Channel[]>) => {
      const existing = new Set(state.selectedDms.map((dm: Channel) => dm.id));
      for (const dm of action.payload) {
        if (!existing.has(dm.id)) {
          state.selectedDms.push(dm);
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDMs.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDMs.fulfilled, (state, action) => {
        state.isLoading = false;
        state.dms = action.payload;
        state.error = null;
      })
      .addCase(fetchDMs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setSelectedDm,
  clearDMs,
  toggleDmSelection,
  selectAllDms,
  deselectAllDms,
  selectDmsInRange,
} = dmSlice.actions;

// Selectors
export const selectDm = (state: RootState) => state.dm;
export const selectDMs = (state: RootState) => state.dm.dms;
export const selectSelectedDm = (state: RootState) => state.dm.selectedDm;
export const selectDmLoading = (state: RootState) => state.dm.isLoading;
export const selectDmError = (state: RootState) => state.dm.error;
export const selectSelectedDms = (state: RootState) => state.dm.selectedDms;

export default dmSlice.reducer;
