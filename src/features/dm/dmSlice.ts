import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Channel } from 'discrub-core/types/discord-types';
import { ChannelType } from 'discrub-core/discord-enum';
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

/**
 * Extract a DM channel snowflake from user input (#240).
 *
 * Accepts either a raw 17-20 digit channel ID or a pasted
 * `discord.com/channels/@me/<id>` URL (discordapp.com and PTB/Canary
 * subdomains included). A URL copied while a message is focused carries a
 * trailing message snowflake (`/channels/@me/<channel>/<message>`) — the
 * CHANNEL id is the one right after `@me/`, so that's what we capture.
 *
 * Returns the snowflake string, or null when the input parses as neither.
 */
export const parseDmChannelInput = (raw: string): string | null => {
  const input = raw.trim();
  if (/^\d{17,20}$/.test(input)) return input;
  const match = input.match(
    /discord(?:app)?\.com\/channels\/@me\/(\d{17,20})(?:[/?#]|$)/i,
  );
  return match ? match[1] : null;
};

/**
 * Fetch a single DM channel by ID (#240).
 *
 * GET /users/@me/channels only returns OPEN DMs — a conversation the user
 * closed (e.g. with a deleted account) is invisible there even though the
 * channel still exists and `GET /channels/{id}` can fetch it. This thunk is
 * the "Open DM by ID" escape hatch: fetch the channel, verify it really is
 * a DM (type 1) or group DM (type 3), and upsert it into `state.dms` for
 * the session.
 *
 * Deliberately session-only (nothing persisted) and deliberately does NOT
 * touch the shared `isLoading`/`error` fields: flipping `isLoading` would
 * swap DMList to its skeleton and unmount the very dialog that dispatched
 * us. The dialog owns its own busy/error presentation via `.unwrap()`.
 *
 * Rejection payloads are distinguishable: 'No access to this channel'
 * (403), 'Channel not found' (404 / empty response), 'Channel is not a DM'
 * (wrong type, e.g. a guild text channel ID).
 */
export const fetchDmById = createAsyncThunk(
  'dm/fetchDmById',
  async (
    { channelId, token }: { channelId: string; token: string },
    { rejectWithValue }
  ) => {
    try {
      const discordService = getDiscordService();
      const response = await discordService.fetchChannel(token, channelId);

      if (!response.success || !response.data) {
        return rejectWithValue('Channel not found');
      }

      const channel = response.data as Channel;
      if (
        channel.type !== ChannelType.DM &&
        channel.type !== ChannelType.GROUP_DM
      ) {
        return rejectWithValue('Channel is not a DM');
      }

      return channel;
    } catch (error) {
      if (error instanceof Error && error.message.includes('403')) {
        return rejectWithValue('No access to this channel');
      }
      if (error instanceof Error && error.message.includes('404')) {
        return rejectWithValue('Channel not found');
      }
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch channel'
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
      })
      // #240: upsert the fetched channel — replace in place when the DM is
      // already listed (dedupe by id), otherwise prepend so the just-opened
      // conversation is immediately visible at the top of the sidebar.
      // No pending/rejected handlers on purpose (see thunk doc comment).
      .addCase(fetchDmById.fulfilled, (state, action) => {
        const index = state.dms.findIndex(
          (dm: Channel) => dm.id === action.payload.id,
        );
        if (index >= 0) {
          state.dms[index] = action.payload;
        } else {
          state.dms.unshift(action.payload);
        }
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
