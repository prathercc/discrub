import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Message, Channel } from 'discrub-core/types/discord-types';
import { getThreadsFromMessages } from 'discrub-core/discrub-utils';
import { initialExportState, resolveMaxZipPartBytes } from './exportTypes';
import type { ExportFormat, MediaConfig, ExportConfig, ExportProgress, MediaDownloadProgress, ExportSettingsSnapshot, RecentExport } from './exportTypes';
import { getExportService, generateExportReadme, generatePlainTextReadme } from '@services/exportService';
import { StreamingZipService } from '@services/streamingZipService';
import type { StreamingZipOptions } from '@services/streamingZipService';
import { getDiscordService } from '@services/discordService';
import { reactionEnrichmentService } from '@services/reactionEnrichmentService';
import { replyEnrichmentService } from '@services/replyEnrichmentService';
import type { ExportReactionMap, SearchCriteria, SearchIterationPage } from 'discrub-core/types/discrub-types';
import type { RootState } from '@/app/store';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';

export type ExportDispatch = ThunkDispatch<RootState, unknown, UnknownAction>;
import { selectCachedUserMap } from '@features/cache/cacheSlice';
import { selectAuthToken } from '@features/auth/authSlice';
import { selectSearchDelay, selectDelayModifier, selectSettings } from '@features/app/appSlice';
import { addRecentExport } from '@features/history/historySlice';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { IsPinnedType } from 'discrub-core/discord-enum';
import { calculateRandomDelay } from '@/utils/delayUtils';
import { waitWhilePaused, checkCancelled, cancellableDelay, createShouldContinue, CancelledError } from '@/utils/operationLoopUtils';
import { iterateSearchMessagesRedux, nextMilestone } from '@/utils/searchPagination';
import { addStatusEntry, showOperationTip } from '@features/status/statusSlice';

// #207 Arm B: a blank criteria so applyPreset can merge a restored date range
// into the export window even when none was set yet.
const EMPTY_EXPORT_CRITERIA: SearchCriteria = {
  searchAfterDate: null,
  searchBeforeDate: null,
  searchMessageContent: null,
  selectedHasTypes: [],
  userIds: [],
  mentionIds: [],
  channelIds: [],
  isPinned: IsPinnedType.UNSET,
  authorType: null,
};

/**
 * Build a map of channel/DM IDs → unique sanitized folder names.
 * Appends the entity ID as suffix when multiple names sanitize to the same string,
 * preventing folder collisions on case-insensitive file systems.
 */
export function buildUniqueFolderNames(items: { id: string; name: string }[]): Map<string, string> {
  const sanitize = (name: string) => name.replace(/[^a-z0-9]/gi, '_').toLowerCase().replace(/_+/g, '_').replace(/^_|_$/g, '');
  const nameToIds = new Map<string, string[]>();

  // Group by sanitized name to find collisions
  for (const item of items) {
    const sanitized = sanitize(item.name);
    const ids = nameToIds.get(sanitized) || [];
    ids.push(item.id);
    nameToIds.set(sanitized, ids);
  }

  // Build final map: append ID suffix only when there's a collision
  const result = new Map<string, string>();
  for (const item of items) {
    const sanitized = sanitize(item.name);
    const ids = nameToIds.get(sanitized)!;
    result.set(item.id, ids.length > 1 ? `${sanitized}_${item.id}` : sanitized);
  }
  return result;
}

/**
 * Fetch reaction user data for messages if REACTIONS_ENABLED setting is true.
 * Returns the ExportReactionMap or undefined if disabled/unavailable.
 */
async function fetchReactionData(
  messages: Message[],
  token: string,
  getState: () => RootState,
  dispatch: ExportDispatch,
): Promise<ExportReactionMap | undefined> {
  const settings = selectSettings(getState());
  if (settings?.[DiscrubSetting.REACTIONS_ENABLED] !== 'true') return undefined;

  const messagesWithReactions = messages.filter((m) => m.reactions && m.reactions.length > 0);
  if (messagesWithReactions.length === 0) return undefined;

  const totalReactors = messagesWithReactions.reduce(
    (sum, m) => sum + (m.reactions?.reduce((s, r) => s + (r.count || 0), 0) || 0), 0
  );
  const totalEmojis = messagesWithReactions.reduce(
    (sum, m) => sum + (m.reactions?.length || 0), 0
  );

  dispatch(addStatusEntry({
    level: 'info',
    message: `Export: Fetching reaction details — ${messagesWithReactions.length} messages, ${totalEmojis} reactions, ~${totalReactors} total reactors. This may take a while.`,
  }));

  try {
    const { DiscordServiceAdapter, ReactionEnrichmentService } = await import('discrub-core/messages');
    const apiClient = new DiscordServiceAdapter(settings);

    const reactionService = new ReactionEnrichmentService({
      apiClient,
      token,
      settings: {
        reactionsEnabled: true,
        displayNameLookup: false,
        serverNickNameLookup: false,
        userDataRefreshRate: 0,
      },
      onProgress: (progress) => {
        // Only log milestones to avoid flooding the status log
        if (progress.current === 1 || progress.current === progress.total || progress.current % 10 === 0) {
          dispatch(addStatusEntry({
            level: 'info',
            message: `Reactions: ${progress.current}/${progress.total} messages processed`,
          }));
        }
      },
      shouldStop: async () => {
        // Wait while paused, return true if cancelled
        await waitWhilePaused(getState);
        return checkCancelled(getState);
      },
    });

    const result = await reactionService.generateReactionMap(messagesWithReactions);

    const reactionCount = Object.keys(result.reactionMap).length;
    if (reactionCount > 0) {
      dispatch(addStatusEntry({ level: 'success', message: `Export: Collected reaction data for ${reactionCount} messages` }));
    }

    return result.reactionMap;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    dispatch(addStatusEntry({ level: 'warning', message: `Export: Could not fetch reaction data — ${msg}` }));
    return undefined;
  }
}

/**
 * Emit milestone status-log entries for the media-download / zip-build
 * phase of an export. Called from every variant's `onProgress` hook so
 * single-channel and bulk exports surface the same cadence of updates.
 *
 * Attachments: every 10th + first + last. Avatars/emojis: only at
 * completion (batched, finishes fast). Html page generation: every 5
 * pages + last. Finalizing: one entry on entry.
 *
 * `scope` is appended to each message (e.g. ` in #general`) so users
 * can disambiguate which channel is progressing when multiple run.
 */
export function logMediaProgress(
  progress: MediaDownloadProgress,
  dispatch: ExportDispatch,
  scope: string = '',
) {
  const { stage, current, total } = progress;
  if (total <= 0) return;

  if (stage === 'attachments') {
    if (current === 1 || current === total || current % 10 === 0) {
      dispatch(addStatusEntry({
        level: 'info',
        message: `Export: Downloaded ${current}/${total} attachments${scope}`,
      }));
    }
  } else if (stage === 'avatars') {
    // Fire at first, every 10th, and last — large avatar sets (40+) were
    // previously silent for 45s+ since only the completion entry fired.
    if (current === 1 || current === total || current % 10 === 0) {
      const label = current === total
        ? `Downloaded ${total} avatar${total === 1 ? '' : 's'}`
        : `Downloaded ${current}/${total} avatars`;
      dispatch(addStatusEntry({
        level: 'info',
        message: `Export: ${label}${scope}`,
      }));
    }
  } else if (stage === 'emojis') {
    // Same cadence as avatars — 48 emojis took 53s silent in the dogfood
    // log. Milestones convert that into ~6 entries across the window.
    if (current === 1 || current === total || current % 10 === 0) {
      const label = current === total
        ? `Downloaded ${total} emoji${total === 1 ? '' : 's'}`
        : `Downloaded ${current}/${total} emojis`;
      dispatch(addStatusEntry({
        level: 'info',
        message: `Export: ${label}${scope}`,
      }));
    }
  } else if (stage === 'html') {
    // Built page N of M. Log milestones so multi-page exports don't go
    // silent during HTML generation (can take seconds for huge pages).
    if (current === 1 || current === total || current % 5 === 0) {
      dispatch(addStatusEntry({
        level: 'info',
        message: `Export: Built page ${current}/${total}${scope}`,
      }));
    }
  } else if (stage === 'finalizing' && current === 1) {
    dispatch(addStatusEntry({
      level: 'info',
      message: `Export: Finalizing archive${scope}…`,
    }));
  }
}

/**
 * Build an ExportSettingsSnapshot from the current export state
 */
function buildConfigSnapshot(state: RootState): ExportSettingsSnapshot {
  const exp = state.export;
  return {
    format: exp.exportFormat,
    messagesPerPage: exp.messagesPerPage,
    separateThreads: exp.separateThreads,
    includeMedia: exp.includeMedia,
    mediaConfig: { ...exp.mediaConfig },
    artistMode: exp.artistMode,
    sortOrder: exp.sortOrder,
    previewMedia: exp.previewMedia,
    textOptions: { ...exp.textOptions },
    maxZipPartBytes: exp.maxZipPartBytes,
  };
}

/**
 * Build the zip-splitting options for an export (#207 Arm A): the resolved
 * per-part byte limit plus status-log hooks that announce a new part file and
 * warn on any single file too large for a 32-bit zip.
 */
function buildZipOptions(
  getState: () => RootState,
  dispatch: ExportDispatch,
): StreamingZipOptions {
  return {
    maxPartBytes: resolveMaxZipPartBytes(getState().export),
    onPartStart: ({ partIndex, fileName }) => {
      // The first part is the normal case; only announce continuations.
      if (partIndex >= 2) {
        dispatch(addStatusEntry({
          level: 'info',
          message: `Export reached the size limit — continuing in a new file (${fileName})`,
        }));
      }
    },
    onOversizeFile: ({ fileName, size }) => {
      const gb = (size / 1_000_000_000).toFixed(1);
      dispatch(addStatusEntry({
        level: 'warning',
        message: `${fileName} is ${gb} GB on its own — too large for one zip file and may not open correctly.`,
      }));
    },
    onPathCollision: ({ requestedPath, finalPath }) => {
      dispatch(addStatusEntry({
        level: 'warning',
        message: `Two files wanted the name ${requestedPath} — saved the second as ${finalPath} and kept going.`,
      }));
    },
  };
}

/**
 * Record a recent export entry. Persisted via the historySlice (its own
 * IDB database `Discrub-history`); retention capping happens there.
 *
 * Wrapped in try/catch — recording is best-effort and must never break
 * an export.
 */
function recordRecentExport(
  dispatch: ExportDispatch,
  _getState: () => RootState,
  entry: Omit<RecentExport, 'id' | 'timestamp'>,
) {
  try {
    const newEntry: RecentExport = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    void dispatch(addRecentExport(newEntry));
  } catch {
    // Best-effort — don't break exports if storage isn't available
    console.warn('Failed to record recent export history');
  }
}

/**
 * Export slice - manages export state and operations
 */

interface ExportMessagesParams {
  messages: Message[];
  channelName: string;
  format: ExportFormat;
  messagesPerPage: number;
  separateThreads: boolean;
  includeMedia: boolean;
  guildId?: string | null;
  mediaConfig?: MediaConfig;
  exportConfig?: ExportConfig;
}

/**
 * Export messages to ZIP file
 */
export const exportMessages = createAsyncThunk<
  { success: true },
  ExportMessagesParams,
  { state: RootState; rejectValue: string }
>(
  'export/exportMessages',
  async (params, { rejectWithValue, dispatch, getState }) => {
    const { messages, channelName, format, messagesPerPage, separateThreads, includeMedia, guildId, mediaConfig, exportConfig } = params;

    dispatch(showOperationTip('Export Operation Queued'));
    dispatch(addStatusEntry({
      level: 'info',
      message: `Export: Starting ${format.toUpperCase()} export of ${messages.length} messages from ${channelName}`,
    }));

    const shouldContinue = createShouldContinue(getState);

    try {
      const exportService = getExportService();

      // Get cached user map from state
      const state = getState();
      const cachedUserMap = selectCachedUserMap(state);

      if (format === 'media') {
        // Media-only export — download attachments into ZIP, no content files
        await exportService.exportMediaOnly(
          messages,
          channelName,
          mediaConfig,
          (progress) => {
            if (typeof progress === 'object') {
              dispatch(setExportProgress(progress));
            }
          },
          exportConfig,
          shouldContinue,
          undefined, // externalZipService
          buildZipOptions(getState, dispatch)
        );
      } else {
        // Extract thread Channel objects from messages for thread separation
        const threads = separateThreads ? getThreadsFromMessages(messages, []) : [];

        // Fetch thread reply messages if separateThreads is enabled.
        // Single-channel export receives messages pre-filtered by the
        // in-table search; thread fetches stay on the list endpoint
        // (unfiltered — existing behavior).
        let allMessages = messages;
        if (separateThreads && threads.length > 0) {
          const token = selectAuthToken(getState());
          if (token) {
            const searchDelay = selectSearchDelay(getState());
            const delayModifier = selectDelayModifier(getState());
            const threadMsgs = await fetchThreadMessages(
              messages, null, token, getState, dispatch,
              searchDelay, delayModifier, null,
            );
            allMessages = [...messages, ...threadMsgs];
          }
        }

        // Fetch reaction user data for HTML exports (other formats use counts only)
        let reactionMap: ExportReactionMap | undefined;
        if (format === 'html') {
          try {
            const token = selectAuthToken(getState());
            if (token) {
              reactionMap = await fetchReactionData(allMessages, token, getState, dispatch as ExportDispatch);
            }
          } catch {
            // Non-fatal — continue without reaction data
          }
        }

        // Get guild data for Discord shell template and role colors
        let selectedGuild = null;
        let guildRoles: any[] = [];
        try {
          const { selectSelectedGuild, selectRoles } = await import('@features/guild/guildSlice');
          selectedGuild = selectSelectedGuild(getState()) || null;
          guildRoles = selectRoles(getState()) || [];
        } catch { /* guild slice may not be available in tests */ }

        // Standard export with optional media
        await exportService.exportToZip(
          allMessages,
          channelName,
          format,
          messagesPerPage,
          includeMedia,
          selectedGuild || null,
          cachedUserMap,
          guildId || null,
          (progress) => {
            if (typeof progress === 'object') {
              dispatch(setExportProgress(progress));
              logMediaProgress(progress, dispatch as ExportDispatch);
            }
          },
          mediaConfig,
          exportConfig,
          shouldContinue,
          undefined, // externalZipService
          separateThreads,
          threads,
          reactionMap,
          guildRoles,
          state.export.textOptions,
          buildZipOptions(getState, dispatch),
        );
      }

      dispatch(addStatusEntry({
        level: 'success',
        message: `Export: Completed ${channelName} (${messages.length} messages)`,
      }));

      // Record recent export history
      recordRecentExport(dispatch, getState, {
        channelName,
        isBulk: false,
        config: buildConfigSnapshot(getState()),
      });

      return { success: true };
    } catch (error) {
      if (error instanceof CancelledError) {
        dispatch(addStatusEntry({
          level: 'warning',
          message: `Export: Cancelled — ${channelName}`,
        }));
        return rejectWithValue('Export cancelled');
      }
      const errorMsg = error instanceof Error ? error.message : 'Failed to export messages';
      dispatch(addStatusEntry({
        level: 'error',
        message: `Export: Failed on ${channelName} — ${errorMsg}`,
      }));
      return rejectWithValue(errorMsg);
    }
  }
);

/**
 * Any non-null narrowing filter present? If so, bulk export switches to
 * Discord's search endpoint; empty criteria keeps the existing list path.
 */
const hasAnyFilter = (c: SearchCriteria | null | undefined): boolean => {
  if (!c) return false;
  return (
    (c.userIds?.length ?? 0) > 0 ||
    (c.mentionIds?.length ?? 0) > 0 ||
    (c.selectedHasTypes?.length ?? 0) > 0 ||
    !!c.searchMessageContent ||
    !!c.searchAfterDate ||
    !!c.searchBeforeDate
  );
};

/**
 * Fetch all messages for a single channel (internal helper, doesn't affect message slice state).
 *
 * Two paths:
 * - **No filter** (criteria null / all defaults): the original list-messages
 *   endpoint with `before=` cursor pagination. Fetches every message in the channel.
 * - **Filter present** (#112): Discord's `/messages/search` endpoint via the
 *   shared search iterator. The iterator advances the search window via
 *   `searchBeforeDate` cap-shifts (#188), so there is no per-query match cap
 *   to cross. Emits status-log entries (start, per-100-msg milestones,
 *   completion) unless `logContext.silent` is set.
 */
async function fetchAllChannelMessages(
  channelId: string,
  guildId: string | null,
  token: string,
  getState: () => RootState,
  dispatch: ExportDispatch,
  searchDelay: number,
  delayModifier: number,
  searchCriteria: SearchCriteria | null | undefined,
  logContext?: { channelLabel: string; silent?: boolean },
): Promise<Message[]> {
  const discordService = getDiscordService();

  if (hasAnyFilter(searchCriteria)) {
    const label = logContext?.channelLabel ?? channelId;
    const silent = logContext?.silent === true;
    const allMessages: Message[] = [];
    let milestoneThreshold = 100;
    let announcedTotal = false;

    if (!silent) {
      dispatch(addStatusEntry({
        level: 'info',
        message: `Searching ${label} for matching messages…`,
      }));
    }

    // Track the last page so we can surface the iterator's `incomplete`
    // flag after the loop (#169). Bulk export is a read-only consumer:
    // it must walk until `total_results` is exhausted, not stop on
    // dedup-empty pages like purge does.
    let lastPage: SearchIterationPage | undefined;

    try {
      for await (const page of iterateSearchMessagesRedux({
        token,
        channelId,
        guildId,
        criteria: searchCriteria as SearchCriteria,
        getState,
      })) {
        if (checkCancelled(getState)) break;
        lastPage = page;

        if (!announcedTotal && !silent) {
          announcedTotal = true;
          if (page.totalResults > 0) {
            dispatch(addStatusEntry({
              level: 'info',
              message: `Discord reports ${page.totalResults.toLocaleString()} matching message${page.totalResults === 1 ? '' : 's'} in ${label}`,
            }));
          }
        }

        allMessages.push(...page.messages);

        if (!silent && page.aggregatedCount >= milestoneThreshold) {
          const totalLabel = page.totalResults > 0
            ? `${page.aggregatedCount.toLocaleString()} of ${page.totalResults.toLocaleString()}`
            : `${page.aggregatedCount.toLocaleString()}`;
          dispatch(addStatusEntry({
            level: 'info',
            message: `Fetched ${totalLabel} matching messages in ${label}`,
          }));
          milestoneThreshold = nextMilestone(page.aggregatedCount);
        }
      }
    } catch (err) {
      if (!silent) {
        dispatch(addStatusEntry({
          level: 'warning',
          message: `Search fetch failed in ${label}: ${err instanceof Error ? err.message : String(err)}`,
        }));
      }
      throw err;
    }

    // #169: surface the iterator's safety-valve trip. When `incomplete`
    // is set, Discord's search index ran out of new matches before
    // `total_results` was exhausted (typically eventual-consistency lag
    // or an undocumented offset cap). Without this entry the user sees
    // a clean success log even though the export is missing data.
    if (lastPage?.incomplete && !silent) {
      const missing = Math.max(0, lastPage.totalResults - lastPage.aggregatedCount);
      dispatch(addStatusEntry({
        level: 'warning',
        message: `Discord stopped returning results at ${lastPage.aggregatedCount.toLocaleString()} of ${lastPage.totalResults.toLocaleString()} matches in ${label}. Export may be missing ${missing.toLocaleString()} message${missing === 1 ? '' : 's'} (known Discord search-index limitation).`,
      }));
    }

    if (!silent) {
      dispatch(addStatusEntry({
        level: 'success',
        message: `Loaded ${allMessages.length.toLocaleString()} matching message${allMessages.length === 1 ? '' : 's'} from ${label}`,
      }));
    }

    // Pass 1 reaction enrichment (#163): the search-criteria branch
    // pulls from Discord's search endpoint, which omits reactions. Without
    // this, every search-criteria-driven export silently drops reactions
    // for the entire matched set. The unfiltered path below uses the
    // /messages list endpoint which includes reactions inline, so no
    // Pass 1 needed there.
    const settings = selectSettings(getState());
    // Heartbeat counter (#170): the lib's `resolveMessageReactions` fires
    // `onStatus` once per AROUND-batch API call (dedup-aware via trackMap),
    // so we count invocations and surface a milestone every 10. Without
    // this, large exports go silent for minutes between "fetching reaction
    // data for N messages" and "Fetching reaction details" while the lib
    // runs the AROUND loop.
    let batchesScanned = 0;
    const reactionEnriched = await reactionEnrichmentService.enrichMessages(
      allMessages,
      token,
      settings,
      {
        shouldStop: async () => {
          await waitWhilePaused(getState);
          return checkCancelled(getState);
        },
        onWillEnrich: (count) => dispatch(addStatusEntry({
          level: 'info',
          message: `Bulk export: fetching reaction data for ${count} message${count === 1 ? '' : 's'} in ${logContext?.channelLabel ?? channelId}…`,
        })),
        onStatus: () => {
          batchesScanned++;
          if (batchesScanned === 1 || batchesScanned % 10 === 0) {
            dispatch(addStatusEntry({
              level: 'info',
              message: `Reaction discovery: ${batchesScanned} batch${batchesScanned === 1 ? '' : 'es'} scanned in ${logContext?.channelLabel ?? channelId}`,
            }));
          }
        },
      },
    );
    // Pass 2 reply parent enrichment (#194): bulk export search branch
    // needs the same enrichment so type-19 replies in the export render
    // with their referenced_message intact instead of the "Original
    // message was deleted" fallback.
    return await replyEnrichmentService.enrichMessages(
      reactionEnriched,
      token,
      settings,
      {
        shouldStop: async () => {
          await waitWhilePaused(getState);
          return checkCancelled(getState);
        },
        onWillEnrich: (count) => dispatch(addStatusEntry({
          level: 'info',
          message: `Bulk export: resolving reply parents for ${count} message${count === 1 ? '' : 's'} in ${logContext?.channelLabel ?? channelId}…`,
        })),
      },
    );
  }

  // Unfiltered path — list endpoint.
  const label = logContext?.channelLabel ?? channelId;
  const silent = logContext?.silent === true;
  let allMessages: Message[] = [];
  let lastMessageId = '';
  let hasMore = true;
  // 500-step cadence (#167) — busy channels can pull tens of thousands of
  // messages, so a finer cadence would flood the status log. Matches the
  // pattern in `messageSlice.ts` `fetchAllMessages`.
  let nextLogBoundary = 500;

  if (!silent) {
    dispatch(addStatusEntry({
      level: 'info',
      message: `Loading messages from ${label}…`,
    }));
  }

  while (hasMore) {
    await waitWhilePaused(getState);
    if (checkCancelled(getState)) break;

    const response = await discordService.fetchMessageData(token, lastMessageId, channelId);

    if (!response.success || !response.data) {
      throw new Error(`Failed to fetch messages for channel ${channelId}`);
    }

    const messages = response.data as Message[];
    allMessages = [...allMessages, ...messages];

    if (!silent && allMessages.length >= nextLogBoundary) {
      dispatch(addStatusEntry({
        level: 'info',
        message: `Loaded ${allMessages.length.toLocaleString()} messages from ${label}`,
      }));
      nextLogBoundary = allMessages.length + 500 - (allMessages.length % 500);
    }

    if (messages.length < 100) {
      hasMore = false;
    } else {
      lastMessageId = messages[messages.length - 1].id;
      const delayCalc = calculateRandomDelay(searchDelay, delayModifier);
      const wasCancelled = await cancellableDelay(delayCalc.delayMs, getState);
      if (wasCancelled) break;
    }
  }

  if (!silent) {
    dispatch(addStatusEntry({
      level: 'success',
      message: `Loaded ${allMessages.length.toLocaleString()} message${allMessages.length === 1 ? '' : 's'} from ${label}`,
    }));
  }

  return allMessages;
}

/**
 * Fetch messages from all threads found in the given messages.
 * Thread replies live in separate channels; this fetches them so they
 * can be included in thread-separated exports.
 */
async function fetchThreadMessages(
  messages: Message[],
  guildId: string | null,
  token: string,
  getState: () => RootState,
  dispatch: ExportDispatch,
  searchDelay: number,
  delayModifier: number,
  searchCriteria: SearchCriteria | null | undefined,
): Promise<Message[]> {
  const threads = getThreadsFromMessages(messages, []);
  if (threads.length === 0) return [];

  let threadMessages: Message[] = [];

  for (const thread of threads) {
    await waitWhilePaused(getState);
    if (checkCancelled(getState)) break;

    const threadName = thread.name || `thread-${thread.id}`;
    dispatch(addStatusEntry({
      level: 'info',
      message: `Fetching thread messages: ${threadName}`,
    }));

    const msgs = await fetchAllChannelMessages(
      thread.id,
      guildId,
      token,
      getState,
      dispatch,
      searchDelay,
      delayModifier,
      searchCriteria,
      // Threads usually have few matches and the wrapping entry above
      // already identifies the thread; keep detailed logging quiet.
      { channelLabel: `thread "${threadName}"`, silent: true },
    );

    threadMessages = [...threadMessages, ...msgs];
  }

  return threadMessages;
}

interface BulkExportParams {
  channels: Channel[];
  token: string;
  format: ExportFormat;
  messagesPerPage: number;
  separateThreads: boolean;
  includeMedia: boolean;
  guildId?: string | null;
  mediaConfig?: MediaConfig;
  exportConfig?: ExportConfig;
  // Optional FilterModal-sourced narrowing (#112). Empty / absent = pull
  // every message via the list endpoint (existing behavior). Any filter
  // set → route through Discord's search endpoint for that channel.
  searchCriteria?: SearchCriteria | null;
}

/**
 * Bulk export multiple channels sequentially
 */
export const bulkExportChannels = createAsyncThunk<
  { success: true; errors?: string[] },
  BulkExportParams,
  { state: RootState; rejectValue: string }
>(
  'export/bulkExportChannels',
  async (params, { rejectWithValue, dispatch, getState }) => {
    const { channels, token, format, messagesPerPage, separateThreads, includeMedia, guildId, mediaConfig, exportConfig, searchCriteria } = params;
    const errors: string[] = [];
    const shouldContinue = createShouldContinue(getState);

    dispatch(showOperationTip('Bulk Export Operation Queued'));

    // Snapshot settings at start — prevents mid-operation changes from causing inconsistency
    const initialState = getState();
    const searchDelay = selectSearchDelay(initialState);
    const delayModifier = selectDelayModifier(initialState);
    const cachedUserMap = selectCachedUserMap(initialState);

    // Get guild roles for role colors in HTML exports + the selected guild
    // for role-icon downloads (#171). Without selectedGuild,
    // mediaDownloadService.downloadRoleIcons short-circuits and the export
    // links role icons remotely instead of bundling them locally.
    let guildRoles: any[] = [];
    let selectedGuild: any = null;
    try {
      const { selectRoles, selectSelectedGuild } = await import('@features/guild/guildSlice');
      guildRoles = selectRoles(getState()) || [];
      selectedGuild = selectSelectedGuild(getState()) || null;
    } catch { /* guild slice may not be available in tests */ }

    const zipService = new StreamingZipService('bulk-export', buildZipOptions(getState, dispatch));
    const exportedChannels: { id: string; name: string; filename: string }[] = [];

    // Pre-compute unique folder names to prevent collisions
    const folderNames = buildUniqueFolderNames(
      channels.map((ch) => ({ id: ch.id, name: ch.name || `channel-${ch.id}` }))
    );

    try {
      for (let i = 0; i < channels.length; i++) {
        await waitWhilePaused(getState);
        if (checkCancelled(getState)) break;

        const channel = channels[i];
        const channelName = channel.name || `channel-${channel.id}`;
        const folderName = folderNames.get(channel.id) || channelName;

        const bulkContext = {
          currentIndex: i,
          totalChannels: channels.length,
          currentChannelName: channelName,
        };

        dispatch(setExportProgress({
          stage: 'avatars',
          current: 0,
          total: 0,
          bulk: bulkContext,
        }));

        dispatch(addStatusEntry({
          level: 'info',
          message: `Bulk export: Starting channel ${i + 1}/${channels.length} — ${channelName}`,
        }));

        try {
          // Fetch all messages for this channel
          const messages = await fetchAllChannelMessages(
            channel.id,
            guildId || null,
            token,
            getState,
            dispatch,
            searchDelay,
            delayModifier,
            searchCriteria,
            { channelLabel: `#${channelName}` },
          );

          if (checkCancelled(getState)) break;

          if (messages.length === 0) {
            dispatch(addStatusEntry({
              level: 'warning',
              message: searchCriteria
                ? `Bulk export: No messages match the filters in ${channelName}, skipping`
                : `Bulk export: No messages in ${channelName}, skipping`,
            }));
            continue;
          }

          // Export this channel's messages into the shared zip
          const exportService = getExportService();

          const onProgress = (progress: number | MediaDownloadProgress) => {
            if (typeof progress === 'number') return;
            dispatch(setExportProgress({ ...progress, bulk: bulkContext }));
            logMediaProgress(progress, dispatch as ExportDispatch, ` in #${channelName}`);
          };

          // Fetch thread reply messages if separateThreads is enabled
          let allMessages = messages;
          if (separateThreads && format !== 'media') {
            const threadMsgs = await fetchThreadMessages(
              messages, guildId || null, token, getState, dispatch,
              searchDelay, delayModifier, searchCriteria,
            );
            if (threadMsgs.length > 0) allMessages = [...messages, ...threadMsgs];
          }

          if (format === 'media') {
            await exportService.exportMediaOnly(messages, folderName, mediaConfig, onProgress, exportConfig, shouldContinue, zipService);
          } else {
            const threads = separateThreads ? getThreadsFromMessages(messages, []) : [];

            // Fetch reaction user data for HTML exports only
            const reactionMap = format === 'html'
              ? await fetchReactionData(allMessages, token, getState, dispatch as ExportDispatch)
              : undefined;

            await exportService.exportToZip(
              allMessages, folderName, format, messagesPerPage, includeMedia,
              selectedGuild, cachedUserMap, guildId || null, onProgress, mediaConfig, exportConfig, shouldContinue, zipService,
              separateThreads, threads, reactionMap, guildRoles, initialState.export.textOptions,
            );
          }

          const sanitized = folderName;
          exportedChannels.push({
            id: channel.id,
            name: channelName,
            filename: `${sanitized}/${sanitized}-page-1.html`,
          });

          dispatch(addStatusEntry({
            level: 'success',
            message: `Bulk export: Completed ${channelName} (${allMessages.length} messages)`,
          }));
        } catch (error) {
          if (error instanceof CancelledError) break;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${channelName}: ${errorMsg}`);
          dispatch(addStatusEntry({
            level: 'error',
            message: `Bulk export: Failed on ${channelName} — ${errorMsg}`,
          }));
          // Continue with next channel
        }

        // Delay between channels
        if (i < channels.length - 1) {
          const delayCalc = calculateRandomDelay(searchDelay, delayModifier);
          const wasCancelled = await cancellableDelay(delayCalc.delayMs, getState);
          if (wasCancelled) break;
        }
      }

      // Generate Discord shell wrapper for bulk HTML exports
      if (format === 'html' && exportConfig?.exportTemplate === 'discord' && exportedChannels.length > 0) {
        const { generateDiscordShellBulk } = await import('@services/exportDiscordShell');
        const { format: formatDate } = await import('date-fns');
        const { selectSelectedGuild } = await import('@features/guild/guildSlice');
        const selectedGuild = selectSelectedGuild(getState());
        const shellHtml = generateDiscordShellBulk({
          serverName: selectedGuild?.name || 'Server',
          serverIcon: selectedGuild?.icon && guildId ? `https://cdn.discordapp.com/icons/${guildId}/${selectedGuild.icon}.png` : undefined,
          channels: exportedChannels,
          activeChannelId: exportedChannels[0].id,
          isDM: false,
          exportDate: formatDate(new Date(), 'MMMM d, yyyy'),
          exportedChannelIds: exportedChannels.map((c) => c.id),
        });
        const shellBlob = new Blob([shellHtml], { type: 'text/html' });
        await zipService.addFile(shellBlob, 'shell.html');
      }

      // Add README
      if (format === 'text') {
        const readmeTxt = generatePlainTextReadme({ isBulk: true });
        await zipService.addFile(
          new Blob([readmeTxt], { type: 'text/plain;charset=utf-8' }),
          'README.txt',
        );
      } else {
        const readmeHtml = generateExportReadme({
          format,
          isDiscordShell: format === 'html' && exportConfig?.exportTemplate === 'discord',
          isBulk: true,
        });
        await zipService.addFile(new Blob([readmeHtml], { type: 'text/html' }), 'README.html');
      }

      await zipService.finalize();

      // Record recent export history (even with partial failures)
      recordRecentExport(dispatch, getState, {
        channelName: `${channels.length} channels`,
        isBulk: true,
        channelCount: channels.length,
        config: buildConfigSnapshot(getState()),
      });

      if (errors.length > 0) {
        return { success: true, errors };
      }
      return { success: true };
    } catch (error) {
      await zipService.cancel();
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to bulk export channels'
      );
    }
  }
);

/**
 * Bulk export multiple DM channels sequentially
 */
export const bulkExportDMs = createAsyncThunk<
  { success: true; errors?: string[] },
  BulkExportParams,
  { state: RootState; rejectValue: string }
>(
  'export/bulkExportDMs',
  async (params, { rejectWithValue, dispatch, getState }) => {
    const { channels, token, format, messagesPerPage, separateThreads, includeMedia, mediaConfig, exportConfig, searchCriteria } = params;
    const errors: string[] = [];
    const shouldContinue = createShouldContinue(getState);

    dispatch(showOperationTip('Bulk Export Operation Queued'));

    // Snapshot settings at start — prevents mid-operation changes from causing inconsistency
    const initialState = getState();
    const searchDelay = selectSearchDelay(initialState);
    const delayModifier = selectDelayModifier(initialState);
    const cachedUserMap = selectCachedUserMap(initialState);

    const zipService = new StreamingZipService('bulk-export', buildZipOptions(getState, dispatch));
    const exportedDMs: { id: string; name: string; filename: string }[] = [];

    // Pre-compute unique folder names to prevent collisions
    const folderNames = buildUniqueFolderNames(
      channels.map((dm) => ({ id: dm.id, name: dm.recipients?.map(r => r.username).join(', ') || `dm-${dm.id}` }))
    );

    try {
      for (let i = 0; i < channels.length; i++) {
        await waitWhilePaused(getState);
        if (checkCancelled(getState)) break;

        const dm = channels[i];
        const dmName = dm.recipients?.map(r => r.username).join(', ') || `dm-${dm.id}`;
        const folderName = folderNames.get(dm.id) || dmName;

        const bulkContext = {
          currentIndex: i,
          totalChannels: channels.length,
          currentChannelName: dmName,
        };

        dispatch(setExportProgress({
          stage: 'avatars',
          current: 0,
          total: 0,
          bulk: bulkContext,
        }));

        dispatch(addStatusEntry({
          level: 'info',
          message: `Bulk export: Starting DM ${i + 1}/${channels.length} — ${dmName}`,
        }));

        try {
          const messages = await fetchAllChannelMessages(
            dm.id,
            null, // DMs have no guild
            token,
            getState,
            dispatch,
            searchDelay,
            delayModifier,
            searchCriteria,
            { channelLabel: `DM with ${dmName}` },
          );

          if (checkCancelled(getState)) break;

          if (messages.length === 0) {
            dispatch(addStatusEntry({
              level: 'warning',
              message: searchCriteria
                ? `Bulk export: No messages match the filters in ${dmName}, skipping`
                : `Bulk export: No messages in ${dmName}, skipping`,
            }));
            continue;
          }

          const exportService = getExportService();

          const onProgress = (progress: number | MediaDownloadProgress) => {
            if (typeof progress === 'number') return;
            dispatch(setExportProgress({ ...progress, bulk: bulkContext }));
            logMediaProgress(progress, dispatch as ExportDispatch, ` in DM with ${dmName}`);
          };

          // Fetch thread reply messages if separateThreads is enabled
          let allMessages = messages;
          if (separateThreads && format !== 'media') {
            const threadMsgs = await fetchThreadMessages(
              messages, null, token, getState, dispatch,
              searchDelay, delayModifier, searchCriteria,
            );
            if (threadMsgs.length > 0) allMessages = [...messages, ...threadMsgs];
          }

          if (format === 'media') {
            await exportService.exportMediaOnly(messages, folderName, mediaConfig, onProgress, exportConfig, shouldContinue, zipService);
          } else {
            const threads = separateThreads ? getThreadsFromMessages(messages, []) : [];

            // Fetch reaction user data for HTML exports only
            const reactionMap = format === 'html'
              ? await fetchReactionData(allMessages, token, getState, dispatch as ExportDispatch)
              : undefined;

            await exportService.exportToZip(
              allMessages, folderName, format, messagesPerPage, includeMedia,
              null, cachedUserMap, null, onProgress, mediaConfig, exportConfig, shouldContinue, zipService,
              separateThreads, threads, reactionMap, [], initialState.export.textOptions,
            );
          }

          dispatch(addStatusEntry({
            level: 'success',
            message: `Bulk export: Completed ${dmName} (${allMessages.length} messages)`,
          }));

          const sanitized = folderName;
          exportedDMs.push({
            id: dm.id,
            name: dmName,
            filename: `${sanitized}/${sanitized}-page-1.html`,
          });
        } catch (error) {
          if (error instanceof CancelledError) break;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${dmName}: ${errorMsg}`);
          dispatch(addStatusEntry({
            level: 'error',
            message: `Bulk export: Failed on ${dmName} — ${errorMsg}`,
          }));
        }

        if (i < channels.length - 1) {
          const delayCalc = calculateRandomDelay(searchDelay, delayModifier);
          const wasCancelled = await cancellableDelay(delayCalc.delayMs, getState);
          if (wasCancelled) break;
        }
      }

      // Generate Discord shell wrapper for bulk DM HTML exports
      if (format === 'html' && exportConfig?.exportTemplate === 'discord' && exportedDMs.length > 0) {
        const { generateDiscordShellBulk } = await import('@services/exportDiscordShell');
        const { format: formatDate } = await import('date-fns');
        const shellHtml = generateDiscordShellBulk({
          serverName: 'Direct Messages',
          channels: exportedDMs,
          activeChannelId: exportedDMs[0].id,
          isDM: true,
          dmRecipients: exportedDMs.map((d) => ({ name: d.name })),
          exportDate: formatDate(new Date(), 'MMMM d, yyyy'),
          exportedChannelIds: exportedDMs.map((d) => d.id),
        });
        const shellBlob = new Blob([shellHtml], { type: 'text/html' });
        await zipService.addFile(shellBlob, 'shell.html');
      }

      // Add README
      if (format === 'text') {
        const readmeTxt = generatePlainTextReadme({ isBulk: true });
        await zipService.addFile(
          new Blob([readmeTxt], { type: 'text/plain;charset=utf-8' }),
          'README.txt',
        );
      } else {
        const readmeHtml = generateExportReadme({
          format,
          isDiscordShell: format === 'html' && exportConfig?.exportTemplate === 'discord',
          isBulk: true,
        });
        await zipService.addFile(new Blob([readmeHtml], { type: 'text/html' }), 'README.html');
      }

      await zipService.finalize();

      // Record recent export history (even with partial failures)
      recordRecentExport(dispatch, getState, {
        channelName: `${channels.length} DMs`,
        isBulk: true,
        channelCount: channels.length,
        config: buildConfigSnapshot(getState()),
      });

      if (errors.length > 0) {
        return { success: true, errors };
      }
      return { success: true };
    } catch (error) {
      await zipService.cancel();
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to bulk export DMs'
      );
    }
  }
);

const exportSlice = createSlice({
  name: 'export',
  initialState: initialExportState,
  reducers: {
    setExportFormat: (state, action: PayloadAction<ExportFormat>) => {
      state.exportFormat = action.payload;
      // Auto-enable media for media-only format
      if (action.payload === 'media') {
        state.includeMedia = true;
      }
    },
    setMediaConfig: (state, action: PayloadAction<Partial<MediaConfig>>) => {
      state.mediaConfig = { ...state.mediaConfig, ...action.payload };
    },
    setMessagesPerPage: (state, action: PayloadAction<number>) => {
      state.messagesPerPage = action.payload;
    },
    setSeparateThreads: (state, action: PayloadAction<boolean>) => {
      state.separateThreads = action.payload;
    },
    setIncludeMedia: (state, action: PayloadAction<boolean>) => {
      state.includeMedia = action.payload;
    },
    setExportProgress: (state, action: PayloadAction<ExportProgress>) => {
      state.exportProgress = action.payload;
    },
    setTotalPages: (state, action: PayloadAction<number>) => {
      state.totalPages = action.payload;
    },
    setArtistMode: (state, action: PayloadAction<boolean>) => {
      state.artistMode = action.payload;
    },
    setSortOrder: (state, action: PayloadAction<'ascending' | 'descending'>) => {
      state.sortOrder = action.payload;
    },
    setPreviewMedia: (state, action: PayloadAction<boolean>) => {
      state.previewMedia = action.payload;
    },
    // #207 Arm A: max bytes per zip part before splitting; null = single zip.
    setMaxZipPartBytes: (state, action: PayloadAction<number | null>) => {
      state.maxZipPartBytes = action.payload;
    },
    setExportTemplate: (state, action: PayloadAction<import('./exportTypes').ExportTemplate>) => {
      state.exportTemplate = action.payload;
    },
    setTextOptions: (
      state,
      action: PayloadAction<Partial<import('./exportTypes').TextFormatOptions>>,
    ) => {
      state.textOptions = { ...state.textOptions, ...action.payload };
    },
    // #207 Arm B: the active export filter/date window, lifted from
    // BulkExportDialog local state so a preset can restore it.
    setExportCriteria: (state, action: PayloadAction<SearchCriteria | null>) => {
      state.exportCriteria = action.payload;
    },
    applyPreset: (state, action: PayloadAction<ExportSettingsSnapshot>) => {
      const preset = action.payload;
      state.exportFormat = preset.format;
      state.messagesPerPage = preset.messagesPerPage;
      state.separateThreads = preset.separateThreads;
      state.includeMedia = preset.includeMedia;
      state.mediaConfig = { ...preset.mediaConfig };
      state.artistMode = preset.artistMode;
      state.sortOrder = preset.sortOrder;
      state.previewMedia = preset.previewMedia;
      if (preset.textOptions) {
        state.textOptions = { ...preset.textOptions };
      }
      // #207 Arm A: undefined (preset saved before this existed) → safe default.
      state.maxZipPartBytes = resolveMaxZipPartBytes(preset);
      // #207 Arm B: only presets explicitly saved with a date range carry one.
      // Restore it by merging the bounds into the current export criteria
      // (keeping any author/content/etc. the user already set); presets
      // without a date range leave the current window untouched.
      if (preset.dateRange) {
        const { after, before } = preset.dateRange;
        state.exportCriteria = {
          ...(state.exportCriteria ?? EMPTY_EXPORT_CRITERIA),
          searchAfterDate: after ? new Date(after) : null,
          searchBeforeDate: before ? new Date(before) : null,
        };
      }
    },
    initializeExportFromSettings: (state, action: PayloadAction<Record<string, any> | null>) => {
      const settings = action.payload;
      if (!settings) return;

      // Format
      const format = settings.exportFormat;
      if (
        format === 'html' ||
        format === 'csv' ||
        format === 'json' ||
        format === 'media' ||
        format === 'text'
      ) {
        state.exportFormat = format;
      } else {
        state.exportFormat = 'html';
      }

      // Messages per page
      const mpp = parseInt(settings.exportMessagesPerPage);
      state.messagesPerPage = mpp > 0 ? mpp : 100;

      // Separate threads
      state.separateThreads = settings.exportSeparateThreadAndForumPosts === 'true';

      // Include media
      state.includeMedia = settings.exportDownloadMedia_2 === 'true';

      // Media config per-type
      state.mediaConfig = {
        images: settings.exportMediaImages !== 'false',
        videos: settings.exportMediaVideos !== 'false',
        audio: settings.exportMediaAudio !== 'false',
        other: settings.exportMediaOther !== 'false',
      };

      // Artist mode
      state.artistMode = settings.exportUseArtistMode === 'true';

      // Sort order
      state.sortOrder = settings.exportMessageSortOrder === 'asc' ? 'ascending' : 'descending';

      // Preview media
      state.previewMedia = settings.exportPreviewMedia_2 !== 'false';

      // Export template
      const template = settings[DiscrubSetting.EXPORT_TEMPLATE];
      if (template === 'discord' || template === 'standard') {
        state.exportTemplate = template;
      }


    },
    resetExport: (state) => {
      state.isExporting = false;
      state.exportProgress = null;
      state.exportTotal = 0;
      state.currentPage = 0;
      state.totalPages = 0;
      state.exportError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(exportMessages.pending, (state) => {
        state.isExporting = true;
        state.exportError = null;
        state.exportProgress = null;
      })
      .addCase(exportMessages.fulfilled, (state) => {
        state.isExporting = false;
        state.exportProgress = null;
      })
      .addCase(exportMessages.rejected, (state, action) => {
        state.isExporting = false;
        state.exportError = action.payload as string;
      })
      // Bulk export channels
      .addCase(bulkExportChannels.pending, (state) => {
        state.isExporting = true;
        state.exportError = null;
        state.exportProgress = null;
      })
      .addCase(bulkExportChannels.fulfilled, (state) => {
        state.isExporting = false;
        state.exportProgress = null;
      })
      .addCase(bulkExportChannels.rejected, (state, action) => {
        state.isExporting = false;
        state.exportError = action.payload as string;
      })
      // Bulk export DMs
      .addCase(bulkExportDMs.pending, (state) => {
        state.isExporting = true;
        state.exportError = null;
        state.exportProgress = null;
      })
      .addCase(bulkExportDMs.fulfilled, (state) => {
        state.isExporting = false;
        state.exportProgress = null;
      })
      .addCase(bulkExportDMs.rejected, (state, action) => {
        state.isExporting = false;
        state.exportError = action.payload as string;
      });
  },
});

export const {
  setExportFormat,
  setMessagesPerPage,
  setSeparateThreads,
  setIncludeMedia,
  setMediaConfig,
  setExportProgress,
  setTotalPages,
  setArtistMode,
  setSortOrder,
  setPreviewMedia,
  setMaxZipPartBytes,
  setExportTemplate,
  setTextOptions,
  setExportCriteria,
  applyPreset,
  initializeExportFromSettings,
  resetExport,
} = exportSlice.actions;

// Selectors
export const selectExport = (state: RootState) => state.export;
export const selectIsExporting = (state: RootState) => state.export.isExporting;
export const selectExportProgress = (state: RootState) => state.export.exportProgress;
export const selectExportFormat = (state: RootState) => state.export.exportFormat;
export const selectTextOptions = (state: RootState) => state.export.textOptions;
export const selectExportError = (state: RootState) => state.export.exportError;
export const selectExportCriteria = (state: RootState) => state.export.exportCriteria;

export default exportSlice.reducer;
