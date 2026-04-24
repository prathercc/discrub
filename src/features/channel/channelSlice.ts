import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Channel } from 'discrub-core/types/discord-types';
import { initialChannelState } from './channelTypes';
import { getDiscordService } from '@services/discordService';
import type { RootState } from '@/app/store';
import { addStatusEntry } from '@features/status/statusSlice';
import { setSelectedGuild } from '@features/guild/guildSlice';

/**
 * Channel slice - manages channel state
 */

/**
 * Fetch all channels for a guild
 */
export const fetchChannels = createAsyncThunk(
  'channel/fetchChannels',
  async (
    { guildId, token }: { guildId: string; token: string },
    { rejectWithValue }
  ) => {
    try {
      const discordService = getDiscordService();
      const response = await discordService.fetchChannels(token, guildId);

      if (!response.success || !response.data) {
        return rejectWithValue('Failed to fetch channels');
      }

      // Return channels directly (sorting can be added later if needed)
      return response.data as Channel[];
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch channels'
      );
    }
  }
);

/**
 * Fetch a single channel by ID (for thread/forum loading)
 */
export const fetchChannelById = createAsyncThunk(
  'channel/fetchChannelById',
  async (
    { channelId, token }: { channelId: string; token: string },
    { rejectWithValue }
  ) => {
    try {
      const discordService = getDiscordService();
      const response = await discordService.fetchChannel(token, channelId);

      if (!response.success || !response.data) {
        return rejectWithValue('Thread not found');
      }

      return response.data as Channel;
    } catch (error) {
      if (error instanceof Error && error.message.includes('403')) {
        return rejectWithValue('No access to this thread');
      }
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch thread'
      );
    }
  }
);

/**
 * Fetch threads/posts for a forum or media channel
 */
/**
 * Fetch threads/posts for a forum or media channel.
 * Uses Discord's threads/search endpoint (same as web client).
 * Single API call returns active + archived threads sorted by recency.
 */
export const fetchForumThreads = createAsyncThunk(
  'channel/fetchForumThreads',
  async (
    { channelId, token }: { channelId: string; token: string },
    { rejectWithValue, dispatch }
  ) => {
    try {
      dispatch(addStatusEntry({ level: 'info', message: 'Loading forum posts...' }));
      const discordService = getDiscordService();

      const response = await discordService.fetchForumThreadSearch(token, channelId, {
        sort_by: 'last_message_time',
        sort_order: 'desc',
        limit: 25,
        offset: 0,
        archived: true,
      });

      if (!response.success || !response.data) {
        return { threads: [], hasMore: false, totalResults: 0, nextOffset: 0, firstMessages: [] };
      }

      const { threads, has_more, total_results, first_messages } = response.data;

      dispatch(addStatusEntry({
        level: 'success',
        message: `Loaded ${threads.length} of ${total_results} forum posts`,
      }));

      return {
        threads,
        hasMore: has_more,
        totalResults: total_results,
        nextOffset: 25,
        firstMessages: first_messages || [],
      };
    } catch (error) {
      dispatch(addStatusEntry({ level: 'error', message: `Failed to load forum posts: ${error instanceof Error ? error.message : 'Unknown error'}` }));
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch forum threads'
      );
    }
  }
);

/**
 * Load more forum threads (paginated via offset)
 */
export const loadMoreForumThreads = createAsyncThunk(
  'channel/loadMoreForumThreads',
  async (
    { channelId, token, offset }: { channelId: string; token: string; offset: number },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const discordService = getDiscordService();

      const response = await discordService.fetchForumThreadSearch(token, channelId, {
        sort_by: 'last_message_time',
        sort_order: 'desc',
        limit: 25,
        offset,
        archived: true,
      });

      if (!response.success || !response.data) {
        return { newThreads: [], hasMore: false, nextOffset: offset, newFirstMessages: [] };
      }

      dispatch(addStatusEntry({
        level: 'info',
        message: `Loaded ${response.data.threads.length} more forum posts`,
      }));

      return {
        newThreads: response.data.threads,
        hasMore: response.data.has_more,
        nextOffset: offset + 25,
        newFirstMessages: response.data.first_messages || [],
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to load more threads'
      );
    }
  }
);

/**
 * Search forum threads by name (server-side, same endpoint Discord uses)
 */
export const searchForumThreads = createAsyncThunk(
  'channel/searchForumThreads',
  async (
    { channelId, token, name }: { channelId: string; token: string; name: string },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const discordService = getDiscordService();

      const response = await discordService.fetchForumThreadSearch(token, channelId, {
        name,
        tag_setting: 'match_some',
      });

      if (!response.success || !response.data) {
        return { threads: [], totalResults: 0, firstMessages: [] };
      }

      dispatch(addStatusEntry({
        level: 'success',
        message: `Search: Found ${response.data.total_results} post${response.data.total_results !== 1 ? 's' : ''} matching "${name}"`,
      }));

      return {
        threads: response.data.threads,
        totalResults: response.data.total_results,
        firstMessages: response.data.first_messages || [],
      };
    } catch (error) {
      dispatch(addStatusEntry({ level: 'error', message: `Forum search failed: ${error instanceof Error ? error.message : 'Unknown error'}` }));
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to search forum threads'
      );
    }
  }
);

const channelSlice = createSlice({
  name: 'channel',
  initialState: initialChannelState,
  reducers: {
    setSelectedChannel: (state, action: PayloadAction<Channel | null>) => {
      state.selectedChannel = action.payload;
    },
    clearChannels: (state) => {
      state.channels = [];
      state.selectedChannel = null;
      state.selectedChannels = [];
    },
    toggleChannelSelection: (state, action: PayloadAction<Channel>) => {
      const index = state.selectedChannels.findIndex(
        (ch: Channel) => ch.id === action.payload.id,
      );
      if (index >= 0) {
        state.selectedChannels.splice(index, 1);
      } else {
        state.selectedChannels.push(action.payload);
      }
    },
    selectAllChannels: (state, action: PayloadAction<Channel[]>) => {
      state.selectedChannels = [...action.payload];
    },
    deselectAllChannels: (state) => {
      state.selectedChannels = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Multi-select is scoped to the active guild — switching servers
      // must not carry yesterday's destructive-op targets into today.
      .addCase(setSelectedGuild, (state) => {
        state.selectedChannels = [];
      })
      .addCase(fetchChannels.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchChannels.fulfilled, (state, action) => {
        state.isLoading = false;
        state.channels = action.payload;
        state.error = null;
      })
      .addCase(fetchChannels.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Forum threads
      .addCase(fetchForumThreads.pending, (state) => {
        state.isLoadingForumThreads = true;
        state.forumThreads = [];
        state.forumFirstMessages = [];
        state.hasMoreForumThreads = false;
        state.forumThreadsTotalResults = 0;
        state.forumThreadsNextOffset = 0;
      })
      .addCase(fetchForumThreads.fulfilled, (state, action) => {
        state.isLoadingForumThreads = false;
        state.forumThreads = action.payload.threads;
        state.forumFirstMessages = action.payload.firstMessages;
        state.hasMoreForumThreads = action.payload.hasMore;
        state.forumThreadsTotalResults = action.payload.totalResults;
        state.forumThreadsNextOffset = action.payload.nextOffset;
      })
      .addCase(fetchForumThreads.rejected, (state) => {
        state.isLoadingForumThreads = false;
        state.forumThreads = [];
        state.forumFirstMessages = [];
      })
      // Load more forum threads
      .addCase(loadMoreForumThreads.pending, (state) => {
        state.isLoadingForumThreads = true;
      })
      .addCase(loadMoreForumThreads.fulfilled, (state, action) => {
        state.isLoadingForumThreads = false;
        state.forumThreads = [...state.forumThreads, ...action.payload.newThreads];
        state.forumFirstMessages = [...state.forumFirstMessages, ...action.payload.newFirstMessages];
        state.hasMoreForumThreads = action.payload.hasMore;
        state.forumThreadsNextOffset = action.payload.nextOffset;
      })
      .addCase(loadMoreForumThreads.rejected, (state) => {
        state.isLoadingForumThreads = false;
      })
      // Search forum threads
      .addCase(searchForumThreads.pending, (state) => {
        state.isLoadingForumThreads = true;
        state.forumThreads = [];
        state.forumFirstMessages = [];
      })
      .addCase(searchForumThreads.fulfilled, (state, action) => {
        state.isLoadingForumThreads = false;
        state.forumThreads = action.payload.threads;
        state.forumFirstMessages = action.payload.firstMessages;
        state.forumThreadsTotalResults = action.payload.totalResults;
        state.hasMoreForumThreads = false; // No scroll-to-load during search
        state.forumThreadsNextOffset = 0;
      })
      .addCase(searchForumThreads.rejected, (state) => {
        state.isLoadingForumThreads = false;
      });
  },
});

export const {
  setSelectedChannel,
  clearChannels,
  toggleChannelSelection,
  selectAllChannels,
  deselectAllChannels,
} = channelSlice.actions;

// Selectors
export const selectChannel = (state: RootState) => state.channel;
export const selectChannels = (state: RootState) => state.channel.channels;
export const selectSelectedChannel = (state: RootState) => state.channel.selectedChannel;
export const selectChannelLoading = (state: RootState) => state.channel.isLoading;
export const selectChannelError = (state: RootState) => state.channel.error;
export const selectSelectedChannels = (state: RootState) => state.channel.selectedChannels;
export const selectForumThreads = (state: RootState) => state.channel.forumThreads ?? [];
export const selectForumFirstMessages = (state: RootState) => state.channel.forumFirstMessages ?? [];
export const selectIsLoadingForumThreads = (state: RootState) => state.channel.isLoadingForumThreads ?? false;
export const selectHasMoreForumThreads = (state: RootState) => state.channel.hasMoreForumThreads ?? false;
export const selectForumThreadsNextOffset = (state: RootState) => state.channel.forumThreadsNextOffset ?? 0;
export const selectForumThreadsTotalResults = (state: RootState) => state.channel.forumThreadsTotalResults ?? 0;

export default channelSlice.reducer;
