import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Channel } from 'discrub-core/types/discord-types';
import { ChannelType } from 'discrub-core/discord-enum';
import { initialChannelState } from './channelTypes';
import { getDiscordService } from '@services/discordService';
import type { RootState } from '@/app/store';
import { addStatusEntry } from '@features/status/statusSlice';
import { setSelectedGuild } from '@features/guild/guildSlice';
import { t } from '@/i18n';

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
 * Discover all threads (active + archived public + archived private/joined)
 * for a single channel. Used by the ThreadLoadModal to surface threads
 * whose type-21 starter message has been deleted from the parent channel —
 * those threads still exist on Discord but are invisible in our message
 * feed because nothing renders them. See backlog #150.
 *
 * Returns the merged + de-duplicated list. Sorted newest-first by the
 * thread's `archive_timestamp` (or its own snowflake when not archived)
 * so the most recently active threads appear at the top.
 *
 * Voice (type 2) and Stage (type 13) channels do not support threads —
 * Discord 400s the thread endpoints on those types — so we short-circuit
 * to an empty list. Forum / media channels have their own listing flow
 * (`fetchForumThreads`) and are out of scope for this thunk; callers
 * should branch on type before dispatching.
 */
export const fetchChannelThreads = createAsyncThunk(
  'channel/fetchChannelThreads',
  async (
    {
      channel,
      guildId,
      token,
      force = false,
    }: { channel: Channel; guildId: string; token: string; force?: boolean },
    { getState },
  ) => {
    if (
      channel.type === ChannelType.GUILD_VOICE ||
      channel.type === ChannelType.GUILD_STAGE_VOICE
    ) {
      return [] as Channel[];
    }

    // In-session cache (#165). Auto-discover from ThreadLoadModal
    // passes force=false; the manual Refresh icon passes force=true.
    // Cache miss falls through to the live fetch below.
    if (!force) {
      const cached = (getState() as RootState).channel
        .discoveredThreadsByChannel[channel.id];
      if (cached) return cached;
    }

    const discordService = getDiscordService();
    const seen = new Map<string, Channel>();

    // Active threads: scoped to guild, filter to children of this channel.
    try {
      const activeResp = await discordService.fetchActiveGuildThreads(token, guildId);
      if (activeResp.success && activeResp.data) {
        for (const t of activeResp.data.threads as Channel[]) {
          if (t.parent_id === channel.id) seen.set(t.id, t);
        }
      }
    } catch {
      /* non-fatal — fall through to archived */
    }

    // Archived public — first page only for v1; pagination is a follow-up
    // if we ever surface a "load older threads" affordance in the modal.
    try {
      const publicResp = await discordService.fetchPublicThreads(token, channel.id);
      if (publicResp.success && publicResp.data) {
        for (const t of publicResp.data.threads as Channel[]) {
          if (!seen.has(t.id)) seen.set(t.id, t);
        }
      }
    } catch {
      /* non-fatal — public archive may be empty / restricted */
    }

    // Archived private — try MANAGE_THREADS endpoint first, fall back to
    // joined-only (mirrors the discoverThreadsForChannels pattern in
    // purgeSlice). 403 / 404 from either is a normal "no access", not an
    // error worth surfacing here.
    try {
      const privateResp = await discordService.fetchPrivateThreads(token, channel.id);
      if (privateResp.success && privateResp.data) {
        for (const t of privateResp.data.threads as Channel[]) {
          if (!seen.has(t.id)) seen.set(t.id, t);
        }
      } else {
        const joinedResp = await discordService.fetchJoinedPrivateArchivedThreads(
          token,
          channel.id,
        );
        if (joinedResp.success && joinedResp.data) {
          for (const t of joinedResp.data.threads as Channel[]) {
            if (!seen.has(t.id)) seen.set(t.id, t);
          }
        }
      }
    } catch {
      /* non-fatal */
    }

    // Sort: active threads first (they're the ones the user is most likely
    // to want to revisit), then archived. Within each bucket newest-first
    // by snowflake (active) or `archive_timestamp` (archived). Mixing the
    // two time bases in a single comparator would be wrong (snowflake
    // shifts to ms-since-Discord-epoch; archive_timestamp is unix ms), so
    // bucket-then-sort sidesteps the conversion.
    const all = Array.from(seen.values());
    all.sort((a, b) => {
      const aArchived = !!(a as any).thread_metadata?.archived;
      const bArchived = !!(b as any).thread_metadata?.archived;
      if (aArchived !== bArchived) return aArchived ? 1 : -1;
      if (aArchived) {
        const at = Date.parse((a as any).thread_metadata?.archive_timestamp ?? '');
        const bt = Date.parse((b as any).thread_metadata?.archive_timestamp ?? '');
        return (bt || 0) - (at || 0);
      }
      // Active: compare snowflake IDs as BigInt to avoid 53-bit truncation.
      const aId = BigInt(a.id);
      const bId = BigInt(b.id);
      return aId < bId ? 1 : aId > bId ? -1 : 0;
    });

    return all;
  },
);

/**
 * Fetch threads/posts for a forum or media channel
 */
/**
 * Fetch threads/posts for a forum or media channel.
 * Uses Discord's threads/search endpoint (same as web client).
 * Single API call returns active + archived threads sorted by recency.
 *
 * NOTE: do NOT pass `archived` here. Discord treats it as a strict
 * filter (`true` → archived only, `false` → active only); omitting it
 * returns the union — which matches the native client's "active +
 * OLDER POSTS" view. (Backlog #151.)
 */
export const fetchForumThreads = createAsyncThunk(
  'channel/fetchForumThreads',
  async (
    { channelId, token }: { channelId: string; token: string },
    { rejectWithValue, dispatch }
  ) => {
    try {
      dispatch(addStatusEntry({ level: 'info', message: t('status.channel.loadingForumPosts') }));
      const discordService = getDiscordService();

      const response = await discordService.fetchForumThreadSearch(token, channelId, {
        sort_by: 'last_message_time',
        sort_order: 'desc',
        limit: 25,
        offset: 0,
      });

      if (!response.success || !response.data) {
        return { threads: [], hasMore: false, totalResults: 0, nextOffset: 0, firstMessages: [] };
      }

      const { threads, has_more, total_results, first_messages } = response.data;

      dispatch(addStatusEntry({
        level: 'success',
        message: t('status.channel.loadedForumPosts', { count: threads.length, total: total_results }),
      }));

      return {
        threads,
        hasMore: has_more,
        totalResults: total_results,
        nextOffset: 25,
        firstMessages: first_messages || [],
      };
    } catch (error) {
      dispatch(addStatusEntry({ level: 'error', message: t('status.channel.forumLoadFailed', { error: error instanceof Error ? error.message : t('status.channel.unknownError') }) }));
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
        // Omit `archived` — see fetchForumThreads note above (#151).
      });

      if (!response.success || !response.data) {
        return { newThreads: [], hasMore: false, nextOffset: offset, newFirstMessages: [] };
      }

      dispatch(addStatusEntry({
        level: 'info',
        message: t('status.channel.loadedMoreForumPosts', { count: response.data.threads.length }),
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
        message: t('status.channel.forumSearchFound', { count: response.data.total_results, name }),
      }));

      return {
        threads: response.data.threads,
        totalResults: response.data.total_results,
        firstMessages: response.data.first_messages || [],
      };
    } catch (error) {
      dispatch(addStatusEntry({ level: 'error', message: t('status.channel.forumSearchFailed', { error: error instanceof Error ? error.message : t('status.channel.unknownError') }) }));
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
    // #218: Shift+Click range select — ADDS the range to the current
    // selection (union, never deselects), matching the familiar
    // file-explorer convention.
    selectChannelsInRange: (state, action: PayloadAction<Channel[]>) => {
      const existing = new Set(state.selectedChannels.map((c: Channel) => c.id));
      for (const channel of action.payload) {
        if (!existing.has(channel.id)) {
          state.selectedChannels.push(channel);
        }
      }
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
      // In-session thread-discovery cache (#165). Populates on every
      // fulfilled fetch — including cache hits, where the payload is
      // identical to what's already there (idempotent). The cache is
      // intentionally not cleared on .pending so a stale list keeps
      // rendering while a Refresh re-fetch is in flight.
      .addCase(fetchChannelThreads.fulfilled, (state, action) => {
        const channelId = action.meta.arg.channel.id;
        state.discoveredThreadsByChannel[channelId] = action.payload;
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
  selectChannelsInRange,
} = channelSlice.actions;

// Selectors
export const selectChannel = (state: RootState) => state.channel;
export const selectChannels = (state: RootState) => state.channel.channels;
export const selectSelectedChannel = (state: RootState) => state.channel.selectedChannel;
export const selectChannelLoading = (state: RootState) => state.channel.isLoading;
export const selectChannelError = (state: RootState) => state.channel.error;
export const selectSelectedChannels = (state: RootState) => state.channel.selectedChannels;
export const selectForumThreads = (state: RootState) => state.channel.forumThreads ?? [];
/**
 * Per-channel cached discovered threads (#165). Returns undefined for
 * channels that haven't been queried yet — callers distinguish "no
 * cache" (undefined) from "cache says empty list" ([]).
 */
export const selectDiscoveredThreadsForChannel = (channelId: string | null | undefined) =>
  (state: RootState): Channel[] | undefined =>
    channelId ? state.channel.discoveredThreadsByChannel[channelId] : undefined;
export const selectForumFirstMessages = (state: RootState) => state.channel.forumFirstMessages ?? [];
export const selectIsLoadingForumThreads = (state: RootState) => state.channel.isLoadingForumThreads ?? false;
export const selectHasMoreForumThreads = (state: RootState) => state.channel.hasMoreForumThreads ?? false;
export const selectForumThreadsNextOffset = (state: RootState) => state.channel.forumThreadsNextOffset ?? 0;
export const selectForumThreadsTotalResults = (state: RootState) => state.channel.forumThreadsTotalResults ?? 0;

export default channelSlice.reducer;
