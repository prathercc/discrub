import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import {
  validatePackage,
} from '@/services/packageParseService';
import {
  streamPackageToStorage,
  loadChannelMessagesFromStorage,
  resumePackageFromStorage,
  clearPackageContents,
  hasStoredPackage,
} from '@/services/packageStreamService';
import { getDiscordService } from '@/services/discordService';
import { getExportService } from '@/services/exportService';
import {
  CancelledError,
  cancellableDelay,
  checkCancelled,
  createShouldContinue,
  waitWhilePaused,
} from '@/utils/operationLoopUtils';
import {
  logMediaProgress,
  setExportProgress,
  type ExportDispatch,
} from '@features/export/exportSlice';
import type { MediaDownloadProgress } from '@features/export/exportTypes';
import { calculateRandomDelay } from '@/utils/delayUtils';
import { addStatusEntry } from '@features/status/statusSlice';
import {
  selectDelayModifier,
  selectDeleteDelay,
  selectSearchDelay,
  setDiscrubCancelled,
} from '@features/app/appSlice';
import { storage } from '@/extension/storage';
import {
  formatDeleteSummary,
  formatRehydrateLogSummary,
} from '@features/package/packageStatusCopy';
import { IsPinnedType, QueryStringParam } from 'discrub-core/discord-enum';
import type {
  Message,
  SearchMessageResult,
} from 'discrub-core/types/discord-types';
import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import { toDiscordMessage } from './packageMessageAdapter';
import {
  enrichmentCache,
  type EnrichedChannelCache,
} from './enrichmentCache';
import type { RootState } from '@/app/store';
import type {
  PackageMessage,
  PackageValidationResult,
  ParsedPackage,
} from './packageTypes';

/**
 * Maximum number of channels whose parsed messages are kept in memory
 * at once. When exceeded, the least-recently-accessed channel is evicted.
 */
const LOADED_CHANNELS_LIMIT = 5;
/**
 * Live `Message` objects are heavier than CSV rows (reactions arrays,
 * embeds, mentions, attachments), so we keep fewer in memory at once.
 * The IDB cache still holds everything; eviction just frees the JS
 * heap — re-entering an evicted channel re-hydrates from IDB instantly.
 */
const ENRICHED_CHANNELS_LIMIT = 5;

export type PackageStatus =
  | 'idle'
  | 'parsing'
  | 'ready'
  | 'error';

export type TimelineStatus = 'idle' | 'loading' | 'ready' | 'error';
export type DeleteStatus = 'idle' | 'running' | 'ready' | 'error';
export type PackageExportStatus = 'idle' | 'running' | 'ready' | 'error';
export type EnrichmentStatus =
  | 'idle'
  | 'running'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface EnrichmentResult {
  channelId: string;
  fromCache: boolean;
  enriched: number;
  deleted: number;
  forbidden: number;
  cancelled: boolean;
  /**
   * Set when preflight returns 404 on the guild/channel search
   * endpoint — strong evidence the whole channel is gone. Distinct
   * from `cancelled` so the UI can render the appropriate status.
   */
  channelInaccessible?: boolean;
  /** HTTP status code when `channelInaccessible === true`. */
  inaccessibleStatus?: number;
}

export interface DeleteResult {
  /** Messages that returned 2xx (server accepted the delete). */
  deleted: number;
  /** Messages Discord said were already gone (404). */
  alreadyGone: number;
  /** Messages blocked by permissions (403) — typical for orphan channels. */
  forbidden: number;
  /** Unexpected errors (network, 5xx). */
  failed: number;
  /** User cancelled mid-run. */
  cancelled: boolean;
  /** IDs that should be treated as gone (successful deletes + 404s). */
  confirmedGoneIds: string[];
}

export interface PackageState {
  status: PackageStatus;
  parsed: ParsedPackage | null;
  validation: PackageValidationResult | null;
  error: string | null;
  selectedChannelId: string | null;
  loadedChannels: Record<string, PackageMessage[]>;
  loadedOrder: string[];
  loadingChannelId: string | null;
  /** Per-channel message selection (message IDs chosen for delete). */
  selectedMessageIds: Record<string, string[]>;
  timelineStatus: TimelineStatus;
  timelineTimestamps: string[];
  timelineProgress: { current: number; total: number } | null;
  timelineError: string | null;
  deleteStatus: DeleteStatus;
  deleteProgress: { current: number; total: number } | null;
  deleteResult: DeleteResult | null;
  deleteError: string | null;
  exportStatus: PackageExportStatus;
  exportError: string | null;
  /**
   * Per-channel map of message IDs that have been successfully deleted
   * (or discovered already-gone via 404) during this or any previous
   * session with the same authenticated user. Persisted to local
   * storage so re-importing the same package doesn't resurrect rows
   * the user already cleaned up.
   */
  deletedMessageIds: Record<string, string[]>;
  /**
   * Tier 2 rehydration state — per-channel enrichment results fetched
   * from Discord's API. A channel with no entry here is Tier 1 (source
   * only). When a channel has been enriched, rows render with live
   * reactions / mentions / embeds / fresh CDN URLs from `live`.
   */
  enrichmentStatus: Record<string, EnrichmentStatus>;
  enrichmentProgress: Record<string, { current: number; total: number }>;
  /** channelId → messageId → live Message. Missing IDs are still source-only. */
  enrichedMessages: Record<string, Record<string, Message>>;
  enrichmentMisses: Record<string, { deleted: string[]; forbidden: string[] }>;
  enrichmentError: Record<string, string | null>;
  enrichmentLastFetched: Record<string, number>;
  /** LRU ordering of channelIds in `enrichedMessages`; oldest first. */
  enrichedOrder: string[];
  /**
   * Only one channel may enrich at a time — Discord's per-endpoint rate
   * limits would otherwise interfere with live operations (exports,
   * deletes). Non-null means an enrichment loop is actively running.
   */
  activeEnrichmentChannelId: string | null;
}

export const initialPackageState: PackageState = {
  status: 'idle',
  parsed: null,
  validation: null,
  error: null,
  selectedChannelId: null,
  loadedChannels: {},
  loadedOrder: [],
  loadingChannelId: null,
  selectedMessageIds: {},
  timelineStatus: 'idle',
  timelineTimestamps: [],
  timelineProgress: null,
  timelineError: null,
  deleteStatus: 'idle',
  deleteProgress: null,
  deleteResult: null,
  deleteError: null,
  exportStatus: 'idle',
  exportError: null,
  deletedMessageIds: {},
  enrichmentStatus: {},
  enrichmentProgress: {},
  enrichedMessages: {},
  enrichmentMisses: {},
  enrichmentError: {},
  enrichmentLastFetched: {},
  enrichedOrder: [],
  activeEnrichmentChannelId: null,
};

/** Per-user IDB key for the deleted-message cache (lives in Discrub-package). */
function deletedCacheKey(userId: string): string {
  return `deleted:${userId}`;
}

/**
 * Reads the persisted deleted-message map for the given user.
 * Returns an empty map on any read/parse error.
 */
async function readDeletedCache(
  userId: string,
): Promise<Record<string, string[]>> {
  const value = await storage.package.get<Record<string, string[]>>(
    deletedCacheKey(userId),
  );
  return value && typeof value === 'object' ? value : {};
}

async function writeDeletedCache(
  userId: string,
  map: Record<string, string[]>,
): Promise<void> {
  try {
    await storage.package.set(deletedCacheKey(userId), map);
  } catch {
    /* storage is best-effort */
  }
}

/**
 * No more module-level File reference (#162). Once `streamPackageToStorage`
 * has run, every read goes through IndexedDB. The original File handle
 * is dropped on the floor by `importPackage` and not retained anywhere.
 */

/**
 * Cache-only hydrate: if an enrichment cache already exists in IDB for
 * the given channel, copy it into Redux. No network calls, no loop.
 * Intended to fire on channel open so users returning to a previously
 * rehydrated channel see their results immediately (with a "Refresh"
 * button) instead of a cold "Rehydrate" button.
 *
 * No-ops when: no authenticated user, no parsed package, no cache
 * present, or enrichment is already loaded/running for this channel.
 */
export const hydrateCachedEnrichment = createAsyncThunk<
  { channelId: string; hydrated: boolean },
  { channelId: string },
  { state: RootState }
>('package/hydrateCachedEnrichment', async ({ channelId }, { getState, dispatch }) => {
  const state = getState();
  const userId = state.package.parsed?.user.id;
  if (!userId) return { channelId, hydrated: false };

  // Skip if something already populated state for this channel — we
  // don't want to clobber a fresh in-progress enrichment's deltas.
  const already =
    state.package.enrichedMessages[channelId] !== undefined ||
    state.package.enrichmentStatus[channelId] === 'running';
  if (already) return { channelId, hydrated: false };

  const cached = await enrichmentCache.get(userId, channelId);
  if (!cached) return { channelId, hydrated: false };

  dispatch(hydrateEnrichmentFromCache({ channelId, cache: cached }));
  return { channelId, hydrated: true };
});

/**
 * Hydrate the per-channel deletedMessageIds map from persisted storage
 * for the given user. Dispatched automatically after a successful
 * import; safe to re-dispatch anytime.
 */
export const hydratePackageDeletedCache = createAsyncThunk<
  Record<string, string[]>,
  { userId: string },
  { state: RootState }
>('package/hydrateDeletedCache', async ({ userId }) => {
  return readDeletedCache(userId);
});

/**
 * Full package reset — wipes in-memory state AND purges the per-user
 * IDB entries (streamed package + enrichment cache). Use this instead
 * of the raw `clearPackage` reducer when a user clicks "Clear package"
 * or switches packages, so Discrub-package doesn't accumulate orphaned
 * records.
 */
export const resetPackage = createAsyncThunk<
  void,
  void,
  { state: RootState }
>('package/reset', async (_, { getState, dispatch }) => {
  const userId = getState().package.parsed?.user.id;
  if (userId) {
    try {
      await Promise.all([
        clearPackageContents(userId),
        enrichmentCache.clearAll(userId),
      ]);
    } catch {
      /* storage is best-effort — UI proceeds either way */
    }
  }
  dispatch(clearPackage());
});

/** Remove the persisted deleted-message history for the current user. */
export const clearPackageDeletedCache = createAsyncThunk<
  void,
  void,
  { state: RootState }
>('package/clearDeletedCache', async (_, { getState }) => {
  const userId = getState().package.parsed?.user.id;
  if (!userId) return;
  await writeDeletedCache(userId, {});
});

/** Parse a Discord data package file and validate it against the current auth. */
export const importPackage = createAsyncThunk<
  { parsed: ParsedPackage; validation: PackageValidationResult },
  File | Blob,
  { state: RootState; rejectValue: string }
>('package/import', async (file, { getState, dispatch, rejectWithValue }) => {
  try {
    // Stream once into IndexedDB (#162). After this returns, every
    // subsequent channel/avatar read is an O(1) IDB lookup; the
    // original File handle is no longer needed.
    const parsed = await streamPackageToStorage(file);
    const state = getState();
    const authedUserId = state.user?.currentUser?.id ?? null;
    const validation = validatePackage(parsed, authedUserId);

    if (!validation.ok) {
      // Clean up the partially-imported package — we don't want orphan
      // pkg:* keys for a user we won't grant capabilities to.
      try {
        await clearPackageContents(parsed.user.id);
      } catch { /* best-effort */ }
      return rejectWithValue(validation.errors.join(' ') || 'Invalid package');
    }

    // Hydrate the persisted deleted-message cache for this user so
    // already-purged messages stay hidden across sessions.
    void dispatch(hydratePackageDeletedCache({ userId: parsed.user.id }));

    return { parsed, validation };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to parse package');
  }
});

/**
 * Resume a previously-streamed package from IndexedDB without touching
 * a File handle. Returns null payload if no stored package matches the
 * current user, otherwise hydrates `state.package.parsed` so the UI
 * shows the package without a re-upload.
 */
export const resumeStoredPackage = createAsyncThunk<
  { parsed: ParsedPackage; validation: PackageValidationResult } | null,
  void,
  { state: RootState; rejectValue: string }
>('package/resume', async (_, { getState, dispatch, rejectWithValue }) => {
  try {
    const authedUserId = getState().user?.currentUser?.id ?? null;
    if (!authedUserId) return null;
    const parsed = await resumePackageFromStorage(authedUserId);
    if (!parsed) return null;
    const validation = validatePackage(parsed, authedUserId);
    if (!validation.ok) return null;

    void dispatch(hydratePackageDeletedCache({ userId: parsed.user.id }));
    return { parsed, validation };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to resume package');
  }
});

/** True iff IDB holds a stored package for the authenticated user. */
export async function hasResumablePackage(userId: string): Promise<boolean> {
  return hasStoredPackage(userId);
}

/** Lazily load (or return cached) parsed messages for one channel. */
export const loadPackageChannelMessages = createAsyncThunk<
  { channelId: string; messages: PackageMessage[] },
  string,
  { state: RootState; rejectValue: string }
>('package/loadChannel', async (channelId, { getState, rejectWithValue }) => {
  const cached = getState().package.loadedChannels[channelId];
  if (cached) return { channelId, messages: cached };

  const userId = getState().package.parsed?.user.id;
  if (!userId) return rejectWithValue('No package loaded');

  try {
    const messages = await loadChannelMessagesFromStorage(userId, channelId);
    return { channelId, messages };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to load channel');
  }
});

/**
 * One-shot pass that loads every channel's CSV, extracts just the
 * timestamp strings, and stores them on `state.timelineTimestamps`. Used
 * by the analytics view to compute month/year/hour buckets without
 * holding full message content in memory.
 *
 * Emits progress via `package/loadAllTimestamps/progress` action so the
 * analytics view can show a progress bar.
 */
export const loadAllPackageTimestamps = createAsyncThunk<
  string[],
  void,
  { state: RootState; rejectValue: string }
>('package/loadAllTimestamps', async (_, { getState, dispatch, rejectWithValue }) => {
  const parsed = getState().package.parsed;
  if (!parsed) return rejectWithValue('No package loaded');
  const userId = parsed.user.id;

  const timestamps: string[] = [];
  const total = parsed.channels.length;

  for (let i = 0; i < total; i++) {
    const channel = parsed.channels[i];
    dispatch(setTimelineProgress({ current: i, total }));

    try {
      const cached = getState().package.loadedChannels[channel.id];
      const messages = cached ?? (await loadChannelMessagesFromStorage(userId, channel.id));
      for (const m of messages) timestamps.push(m.timestamp);
    } catch {
      // Skip unreadable channels rather than aborting the whole load.
    }
  }

  dispatch(setTimelineProgress({ current: total, total }));
  return timestamps;
});

/**
 * Deletes the messages currently selected in one package channel using
 * the Discord API. Honors the user's delete delay + pause/cancel flags
 * via the same helpers the purge loop uses. Tolerates per-message 404
 * (already deleted) and 403 (e.g. orphan channel) without aborting the
 * run — summarized outcomes land in `state.deleteResult`.
 */
export const deletePackageMessages = createAsyncThunk<
  DeleteResult,
  { channelId: string },
  { state: RootState; rejectValue: string }
>('package/deleteMessages', async ({ channelId }, { getState, dispatch, rejectWithValue }) => {
  const state = getState();
  const token = state.auth.token;
  if (!token) return rejectWithValue('Not authenticated');

  const validation = state.package.validation;
  if (!validation || validation.readOnly) {
    return rejectWithValue('Package is in read-only mode');
  }

  const channel = state.package.parsed?.channels.find((c) => c.id === channelId);
  if (!channel) return rejectWithValue('Channel not found in package');
  if (channel.isOrphan) return rejectWithValue("You are no longer in this server — messages can't be deleted");

  // Filter out messages we already know don't exist on Discord — either
  // because this user deleted them previously or because rehydration
  // confirmed a 404. Selection-time UI disables these rows as well;
  // this is the belt to that suspenders guard so any stale selection
  // (e.g., pre-rehydrate → rehydrate → delete) doesn't waste API calls.
  const rawIds = state.package.selectedMessageIds[channelId] ?? [];
  const goneSet = new Set<string>([
    ...(state.package.deletedMessageIds[channelId] ?? []),
    ...(state.package.enrichmentMisses[channelId]?.deleted ?? []),
  ]);
  const ids = rawIds.filter((id) => !goneSet.has(id));
  if (ids.length === 0) {
    if (rawIds.length > 0) {
      return rejectWithValue(
        'All selected messages were already gone on Discord.',
      );
    }
    return rejectWithValue('No messages selected.');
  }

  const deleteDelay = selectDeleteDelay(state);
  const delayModifier = selectDelayModifier(state);
  const discordService = getDiscordService();

  const result: DeleteResult = {
    deleted: 0,
    alreadyGone: 0,
    forbidden: 0,
    failed: 0,
    cancelled: false,
    confirmedGoneIds: [],
  };

  dispatch(addStatusEntry({
    level: 'info',
    message: `Deleting ${ids.length} message${ids.length === 1 ? '' : 's'} from this channel.`,
  }));

  try {
    for (let i = 0; i < ids.length; i++) {
      await waitWhilePaused(getState);
      if (checkCancelled(getState)) throw new CancelledError();

      dispatch(setDeleteProgress({ current: i, total: ids.length }));

      const messageId = ids[i];
      try {
        // discrub-core's `discordService.deleteMessage` does NOT throw
        // on HTTP errors; its `withRetry` wrapper catches and returns a
        // `{ success, status }` object. We inspect that. The catch is
        // kept for genuinely-thrown exceptions (CancelledError surfacing
        // through the await chain, programming errors, etc.).
        const apiResult = await discordService.deleteMessage(token, messageId, channelId);
        if (apiResult.success) {
          result.deleted += 1;
          result.confirmedGoneIds.push(messageId);
        } else if (apiResult.status === 404) {
          result.alreadyGone += 1;
          result.confirmedGoneIds.push(messageId);
        } else if (apiResult.status === 403) {
          result.forbidden += 1;
        } else {
          result.failed += 1;
          dispatch(addStatusEntry({
            level: 'error',
            message: `Couldn't delete message ${messageId} (HTTP ${apiResult.status ?? 'unknown'}).`,
          }));
        }
      } catch (err) {
        if (err instanceof CancelledError) throw err;
        const status = extractHttpStatus(err);
        if (status === 404) {
          result.alreadyGone += 1;
          result.confirmedGoneIds.push(messageId);
        } else if (status === 403) {
          result.forbidden += 1;
        } else {
          result.failed += 1;
          dispatch(addStatusEntry({
            level: 'error',
            message: `Couldn't delete message ${messageId}: ${err instanceof Error ? err.message : 'unknown error'}.`,
          }));
        }
      }

      // Delay between deletes — unless we're on the last one.
      if (i < ids.length - 1) {
        const calc = calculateRandomDelay(deleteDelay, delayModifier);
        const wasCancelled = await cancellableDelay(calc.delayMs, getState);
        if (wasCancelled) throw new CancelledError();
      }
    }
  } catch (err) {
    if (err instanceof CancelledError) {
      result.cancelled = true;
    } else {
      dispatch(addStatusEntry({
        level: 'error',
        message: `Delete stopped: ${err instanceof Error ? err.message : 'unknown error'}`,
      }));
    }
  }

  dispatch(setDeleteProgress({ current: ids.length, total: ids.length }));
  dispatch(addStatusEntry({
    level: result.failed > 0 ? 'warning' : 'success',
    message: formatDeleteSummary(result),
  }));

  // Persist the updated deleted-message cache so the history survives
  // reloads. We read the post-reducer state by reading the current map
  // plus this run's confirmedGoneIds merged in.
  const userId = state.package.parsed?.user.id;
  if (userId && result.confirmedGoneIds.length > 0) {
    const existingMap = state.package.deletedMessageIds;
    const existing = existingMap[channelId] ?? [];
    const merged = Array.from(new Set([...existing, ...result.confirmedGoneIds]));
    await writeDeletedCache(userId, { ...existingMap, [channelId]: merged });
  }

  return result;
});

/** Best-effort HTTP-status extraction for errors surfaced by discord-service/fetch. */
function extractHttpStatus(err: unknown): number | null {
  if (err && typeof err === 'object') {
    const maybe = err as { status?: number; statusCode?: number; response?: { status?: number } };
    if (typeof maybe.status === 'number') return maybe.status;
    if (typeof maybe.statusCode === 'number') return maybe.statusCode;
    if (maybe.response && typeof maybe.response.status === 'number') return maybe.response.status;
  }
  const message = err instanceof Error ? err.message : String(err ?? '');
  const match = message.match(/\b(\d{3})\b/);
  return match ? Number(match[1]) : null;
}

/**
 * Export one package channel to a ZIP.
 *
 * When enriched live messages exist (Tier 2), we prefer them over the
 * package-adapted shapes so exports match the live app's message
 * rendering (reactions, edits, replies). For media downloads, package
 * attachment URLs (post-2025-06-14, with the `uc=dp` discriminator) are
 * permanently-signed by Discord and work without rehydration —
 * `includeMedia` flows directly through to mediaDownloadService and
 * downloads them locally. Pre-2025 packages have ephemeral URLs that
 * may 403; users are warned via the legacy-format banner at import time
 * and can opt into rehydration before export to refresh URLs.
 *
 * Parameters mirror `exportMessages` so the same ExportDialog can drive
 * both live and package exports with `exportContext: 'package'`.
 */
export interface ExportPackageChannelParams {
  channelId: string;
  format: 'html' | 'csv' | 'json' | 'media';
  messagesPerPage: number;
  includeMedia: boolean;
  mediaConfig?: import('@features/export/exportTypes').MediaConfig;
  exportConfig: import('@features/export/exportTypes').ExportConfig;
  /**
   * If true and the channel hasn't been rehydrated yet, run
   * `enrichPackageChannel` before exporting. No-op when cached.
   */
  rehydrateFirst?: boolean;
}

export const exportPackageChannel = createAsyncThunk<
  { channelId: string },
  ExportPackageChannelParams,
  { state: RootState; rejectValue: string }
>(
  'package/exportChannel',
  async (params, { getState, dispatch, rejectWithValue }) => {
    const {
      channelId,
      format,
      messagesPerPage,
      includeMedia,
      mediaConfig,
      exportConfig,
      rehydrateFirst,
    } = params;

    let state = getState();
    const parsed = state.package.parsed;
    if (!parsed) return rejectWithValue('No package loaded');

    const channel = parsed.channels.find((c) => c.id === channelId);
    if (!channel) return rejectWithValue('Channel not found in package');

    // Ensure CSV messages are loaded (needed to know the set of IDs to
    // export even when we then prefer enriched objects).
    let packageMessages = state.package.loadedChannels[channelId];
    if (!packageMessages) {
      try {
        packageMessages = await loadChannelMessagesFromStorage(parsed.user.id, channelId);
      } catch (err) {
        return rejectWithValue(err instanceof Error ? err.message : 'Failed to read channel');
      }
    }
    if (packageMessages.length === 0) {
      return rejectWithValue('Channel has no messages to export');
    }

    // Optional pre-enrichment: run the API loop first so downstream
    // export sees live reactions/mentions/embeds and fresh CDN URLs.
    if (rehydrateFirst && !state.package.enrichedMessages[channelId]) {
      await dispatch(enrichPackageChannel({ channelId }));
      state = getState();
    }

    const enrichedMap = state.package.enrichedMessages[channelId];

    // Discord's post-2025-06-14 package format ships permanently-signed
    // CDN URLs (the `uc=dp` discriminator), so a media-only export
    // against the package URLs is now a valid path even without
    // rehydration. Pre-2025 packages have ephemeral URLs that may 403
    // — users get the legacy-format banner at import time + a per-URL
    // download warning during export, but we don't gate the operation.
    const discordMessages: Message[] = packageMessages.map((pm) => {
      const live = enrichedMap?.[pm.id];
      // Enriched message wins; fall back to package-adapted shape.
      return live ?? (toDiscordMessage(pm, channelId, parsed.user) as Message);
    });

    const channelName =
      channel.name ?? (channel.type === 1 ? 'Direct Message' : channel.id);

    dispatch(addStatusEntry({
      level: 'info',
      message: `Package export: starting ${format.toUpperCase()} export for "${channelName}" (${discordMessages.length} messages)`,
    }));

    const exportService = getExportService();

    // Mirror the live export's progress + cancel wiring (#162). Without
    // these, package exports were silent for the entire media-download
    // phase (a 784-message DM with attachments produced 2 status-log
    // lines for 2:45 of work) and Pause/Cancel were no-ops.
    const shouldContinue = createShouldContinue(getState);
    const scope = ` for "${channelName}"`;
    const onProgress = (progress: number | MediaDownloadProgress) => {
      if (typeof progress === 'object') {
        dispatch(setExportProgress(progress));
        logMediaProgress(progress, dispatch as ExportDispatch, scope);
      }
    };

    try {
      if (format === 'media') {
        await exportService.exportMediaOnly(
          discordMessages,
          channelName,
          mediaConfig,
          onProgress,
          exportConfig,
          shouldContinue,
        );
      } else {
        await exportService.exportToZip(
          discordMessages,
          channelName,
          format,
          messagesPerPage,
          includeMedia,
          null,  // guild
          {},    // cachedUserMap — package userMap is minimal
          channel.guildId ?? null,
          onProgress,
          mediaConfig,
          exportConfig,
          shouldContinue,
        );
      }

      dispatch(addStatusEntry({
        level: 'success',
        message: `Package export: completed "${channelName}"`,
      }));
      return { channelId };
    } catch (err) {
      if (err instanceof CancelledError) {
        dispatch(addStatusEntry({
          level: 'warning',
          message: `Package export: cancelled${scope}`,
        }));
        return rejectWithValue('Cancelled');
      }
      const msg = err instanceof Error ? err.message : 'Unknown export failure';
      dispatch(addStatusEntry({ level: 'error', message: `Package export failed: ${msg}` }));
      return rejectWithValue(msg);
    }
  },
);

/**
 * Author-scoped search preflight for package rehydration.
 *
 * The insight: a package only contains the user's own messages, so a
 * single Discord search filtered by `author_id={userId}` + the date
 * range of the package messages can mass-fetch live copies of most
 * messages in ~1 call per 25 messages instead of 1 call per message.
 *
 * Returns a map of `{messageId → live Message}` for messages the search
 * found. Messages absent from the search aren't marked deleted here —
 * the caller still verifies them via the per-message AROUND loop, which
 * handles indexing-lag edge cases and any messages outside the search
 * window. On 403 (no search permission) or other errors the map is
 * empty and the caller transparently falls back to the AROUND loop.
 *
 * Honors pause/cancel at page boundaries. Paces pages with the same
 * search delay the main loop uses.
 */
const SEARCH_PREFLIGHT_MAX_OFFSET = 5000;
const SEARCH_PREFLIGHT_PAGE_SIZE = 25;
// Widen the min/max snowflake bounds by this many ms on each side to
// absorb clock skew between package export time and Discord's internal
// snowflake-vs-timestamp rounding. A minute is ~2^16 ms — small
// compared to typical channel histories, generous vs. worst-case skew.
const SEARCH_PREFLIGHT_DATE_BUFFER_MS = 60_000;

async function runSearchPreflight(args: {
  token: string;
  userId: string;
  channelId: string;
  guildId: string | null;
  messages: PackageMessage[];
  searchDelay: number;
  delayModifier: number;
  getState: () => RootState;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatch: (action: any) => void;
  /**
   * Called after each successful page. Receives the total found-so-far
   * count and the new messages from this page that are in the package
   * — letting the caller paint live progress + chips during preflight
   * (instead of the user staring at "0 of 0" for the whole search).
   */
  onPageComplete?: (args: {
    foundSoFar: number;
    packageHitsOnThisPage: Message[];
    /**
     * Cumulative count of search results whose IDs match the package.
     * `foundSoFar` includes user messages outside the package (other
     * channels overlapping the date range, deleted messages re-indexed,
     * etc.), so it overstates the cache-hit budget for the AROUND loop.
     * Use `packageHitsSoFar` for any per-package progress display.
     */
    packageHitsSoFar: number;
  }) => void;
}): Promise<{
  foundById: Map<string, Message>;
  status:
    | 'ok'
    | 'forbidden'
    | 'not-found'
    | 'error'
    | 'cap-exceeded'
    | 'skipped';
  httpStatus?: number;
  pages: number;
  totalFound: number;
  packageHitsTotal: number;
}> {
  const {
    token,
    userId,
    channelId,
    guildId,
    messages,
    searchDelay,
    delayModifier,
    getState,
    onPageComplete,
  } = args;
  const foundById = new Map<string, Message>();
  // Lookup for "is this message in the package?" — drives which
  // preflight results are worth dispatching as enrichment deltas.
  const packageIdSet = new Set(messages.map((m) => m.id));
  let packageHitsTotal = 0;
  if (messages.length === 0) {
    return {
      foundById,
      status: 'skipped',
      pages: 0,
      totalFound: 0,
      packageHitsTotal: 0,
    };
  }

  // Derive date bounds from the package's timestamps. ISO-8601 sorts
  // lexicographically, so simple min/max works without Date parsing.
  let minTs = messages[0].timestamp;
  let maxTs = messages[0].timestamp;
  for (const m of messages) {
    if (m.timestamp < minTs) minTs = m.timestamp;
    if (m.timestamp > maxTs) maxTs = m.timestamp;
  }
  const minDate = new Date(
    new Date(minTs).getTime() - SEARCH_PREFLIGHT_DATE_BUFFER_MS,
  );
  const maxDate = new Date(
    new Date(maxTs).getTime() + SEARCH_PREFLIGHT_DATE_BUFFER_MS,
  );
  if (
    Number.isNaN(minDate.getTime()) ||
    Number.isNaN(maxDate.getTime())
  ) {
    // Bad timestamps in the package — skip preflight rather than
    // sending nonsense bounds to Discord.
    return {
      foundById,
      status: 'skipped',
      pages: 0,
      totalFound: 0,
      packageHitsTotal: 0,
    };
  }

  const criteria: SearchCriteria = {
    searchBeforeDate: maxDate,
    searchAfterDate: minDate,
    searchMessageContent: null,
    selectedHasTypes: [],
    userIds: [userId],
    mentionIds: [],
    channelIds: [],
    isPinned: IsPinnedType.UNSET,
  };

  const discordService = getDiscordService();
  let offset = 0;
  let pages = 0;
  let status: 'ok' | 'forbidden' | 'not-found' | 'error' | 'cap-exceeded' = 'ok';
  let httpStatus: number | undefined;

  while (offset <= SEARCH_PREFLIGHT_MAX_OFFSET) {
    await waitWhilePaused(getState);
    if (checkCancelled(getState)) throw new CancelledError();

    const response = await discordService.fetchSearchMessageData(
      token,
      offset,
      channelId,
      guildId,
      criteria,
    );
    pages += 1;

    if (!response.success) {
      httpStatus = response.status;
      // 404 on guild/channel search means the resource itself is gone
      // from the user's perspective — a stronger signal than 403
      // (which is just "no permission on this action"). Callers use
      // this to abort rather than fall through to AROUND, since every
      // per-message call will 404 for the same reason.
      status =
        response.status === 403
          ? 'forbidden'
          : response.status === 404
            ? 'not-found'
            : 'error';
      break;
    }
    if (!response.data) {
      status = 'error';
      break;
    }

    const searchResult = response.data as SearchMessageResult;
    const rawMessages = searchResult.messages ?? [];
    const rawCount = rawMessages.length;
    // Search returns either Message[] or Message[][] depending on
    // how Discord felt that millisecond — handle both shapes.
    const flat = Array.isArray(rawMessages[0])
      ? (rawMessages as unknown as Message[][]).flat()
      : (rawMessages as Message[]);

    const packageHitsOnThisPage: Message[] = [];
    for (const m of flat) {
      if (m?.id && !foundById.has(m.id)) {
        foundById.set(m.id, m);
        if (packageIdSet.has(m.id)) {
          packageHitsOnThisPage.push(m);
          packageHitsTotal += 1;
        }
      }
    }
    onPageComplete?.({
      foundSoFar: foundById.size,
      packageHitsOnThisPage,
      packageHitsSoFar: packageHitsTotal,
    });

    if (rawCount < SEARCH_PREFLIGHT_PAGE_SIZE) break;
    offset += rawCount;
    if (offset > SEARCH_PREFLIGHT_MAX_OFFSET) {
      status = 'cap-exceeded';
      break;
    }

    const calc = calculateRandomDelay(searchDelay, delayModifier);
    const wasCancelled = await cancellableDelay(calc.delayMs, getState);
    if (wasCancelled) throw new CancelledError();
  }

  return {
    foundById,
    status,
    httpStatus,
    pages,
    totalFound: foundById.size,
    packageHitsTotal,
  };
}

/**
 * Tier 2 rehydration: fetch real `Message` objects from Discord for
 * every package message in the given channel. Writes results to both
 * Redux state (live UI) and `enrichmentCache` (IDB — survives reload).
 *
 * Flow:
 *  1. Reject if another channel is currently enriching (Discord's rate
 *     limits don't like parallel per-channel loops, and the user
 *     shouldn't accidentally kick off multiple long runs).
 *  2. Unless `refresh === true`, short-circuit to the IDB cache if
 *     present — a previously enriched channel loads instantly.
 *  3. Ensure messages are loaded (lazy CSV read).
 *  4. Loop every message, calling
 *     `fetchMessageData(token, msgId, channelId, AROUND)`. Discord
 *     returns up to 50 messages around the target — we filter for the
 *     exact ID. Missing = treat as deleted.
 *  5. 404 → `misses.deleted`, 403 → `misses.forbidden`. Other errors
 *     are logged and the loop continues (one bad message shouldn't
 *     abort the whole rehydration).
 *  6. Pause/cancel honored via the shared `waitWhilePaused` /
 *     `checkCancelled` / `cancellableDelay` helpers.
 *  7. Progress dispatched throttled (every 10 msgs or 500ms) to keep
 *     Redux dispatches bounded on large channels.
 *  8. On cancel: save partial results, fulfill with `cancelled: true`.
 *  9. On success: persist full result to IDB, fulfill with counts.
 *
 * Rate limits are handled globally via `DiscordService.onRateLimit`
 * (wired in `discordService.ts`), so this thunk doesn't need its own
 * retry logic — `fetchMessageData` already waits internally.
 */
export const enrichPackageChannel = createAsyncThunk<
  EnrichmentResult,
  { channelId: string; refresh?: boolean },
  { state: RootState; rejectValue: string }
>(
  'package/enrichChannel',
  async (
    { channelId, refresh = false },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState();
    const token = state.auth.token;
    if (!token) return rejectWithValue('Not authenticated');

    const parsed = state.package.parsed;
    if (!parsed) return rejectWithValue('No package loaded');

    const userId = parsed.user.id;
    const channel = parsed.channels.find((c) => c.id === channelId);
    if (!channel) return rejectWithValue('Channel not found in package');

    // Belt-and-suspenders reset: the MainLayout `isOperationRunning`
    // effect also resets this flag when the previous op finished, but
    // effect scheduling can race with a fast second dispatch. Resetting
    // at thunk entry guarantees the loop doesn't immediately abort
    // from a sticky flag left behind by a previous cancelled op.
    dispatch(setDiscrubCancelled(false));

    // Cache short-circuit — the IDB layer already returns null on miss,
    // so this is just a one-shot lookup.
    if (!refresh) {
      const cached = await enrichmentCache.get(userId, channelId);
      if (cached) {
        dispatch(hydrateEnrichmentFromCache({ channelId, cache: cached }));
        return {
          channelId,
          fromCache: true,
          enriched: Object.keys(cached.messages).length,
          deleted: cached.misses.deleted.length,
          forbidden: cached.misses.forbidden.length,
          cancelled: false,
        };
      }
    }

    // Lazy-load messages if not already cached in Redux.
    let messages = getState().package.loadedChannels[channelId];
    if (!messages) {
      await dispatch(loadPackageChannelMessages(channelId));
      messages = getState().package.loadedChannels[channelId];
      if (!messages) return rejectWithValue('Failed to load channel messages');
    }
    if (messages.length === 0) {
      return rejectWithValue('Channel has no messages to rehydrate');
    }

    const searchDelay = selectSearchDelay(getState());
    const delayModifier = selectDelayModifier(getState());
    const discordService = getDiscordService();

    // Read the previous cache up front — we use it both for skip logic
    // (don't re-fetch messages we already know are 404'd) and later for
    // the cancelled-don't-overwrite path.
    const previousCache = await enrichmentCache.get(userId, channelId);

    // "Known-gone" set: messages we're certain no longer exist on Discord,
    // either because the user deleted them (persisted delete cache) or
    // because a previous enrichment pass confirmed 404. Skipping these
    // avoids pointless API calls. Forbidden (403) is NOT in this set —
    // access can be regained, so refresh retries them.
    const knownDeleted = new Set<string>([
      ...(state.package.deletedMessageIds[channelId] ?? []),
      ...(previousCache?.misses.deleted ?? []),
    ]);

    // Session-scoped cache of messages returned in the neighbor windows
    // of prior `fetchMessageData(AROUND)` calls. Discord returns up to 50
    // messages per call; previously we extracted only the target and
    // discarded the rest. With this cache, densely packed channels only
    // pay for 1 API call per ~50 messages.
    const windowCache = new Map<string, Message>();

    const enriched: Record<string, Message> = {};
    const misses: { deleted: string[]; forbidden: string[] } = {
      deleted: [],
      forbidden: [],
    };
    let cancelled = false;
    // Set when preflight reports the guild/channel itself is 404 —
    // running the AROUND loop would just produce 191 more 404s and
    // poison the "deleted" cache with false positives. Better to
    // abort and tell the user clearly.
    let channelInaccessible = false;
    let channelInaccessibleStatus: number | undefined;

    const channelLabel = channel.name ?? channelId;
    dispatch(
      addStatusEntry({
        level: 'info',
        message: `Loading rich data for "${channelLabel}" (${messages.length.toLocaleString()} ${messages.length === 1 ? 'message' : 'messages'}).`,
      }),
    );

    // Paint the real total up front — otherwise the UI displays
    // "0 of 0…" for the entire preflight phase (which can be tens of
    // API calls for large channels). We'll advance `current` during
    // preflight and again during the main loop.
    dispatch(
      setEnrichmentProgress({
        channelId,
        current: 0,
        total: messages.length,
      }),
    );

    // Monotonic progress counter — preflight drives most of it via
    // foundById.size, then the main loop fills any gaps. Tracked
    // outside the loop so main-loop dispatches can't regress the bar.
    let progressCurrent = 0;

    // Progress dispatch throttling — cap Redux traffic on large channels.
    let lastDispatchedAt = Date.now();
    let lastDispatchedIndex = 0;
    const PROGRESS_EVERY_N = 10;
    const PROGRESS_EVERY_MS = 500;

    // Accumulator for live delta dispatches. Each iteration pushes its
    // resolution into this buffer; the throttle below flushes it so
    // chips light up during the run instead of waiting for completion.
    const pendingDelta: {
      enriched: Record<string, Message>;
      deleted: string[];
      forbidden: string[];
    } = { enriched: {}, deleted: [], forbidden: [] };
    const flushDelta = () => {
      const hasAny =
        Object.keys(pendingDelta.enriched).length > 0 ||
        pendingDelta.deleted.length > 0 ||
        pendingDelta.forbidden.length > 0;
      if (!hasAny) return;
      dispatch(
        mergeEnrichmentDelta({
          channelId,
          enriched: pendingDelta.enriched,
          deleted: [...pendingDelta.deleted],
          forbidden: [...pendingDelta.forbidden],
        }),
      );
      pendingDelta.enriched = {};
      pendingDelta.deleted = [];
      pendingDelta.forbidden = [];
    };

    try {
      // Author-scoped search preflight: one call per 25 messages
      // instead of one per message. Messages not covered still fall
      // through to the AROUND loop below, so preflight failure never
      // breaks correctness — worst case, we do what we used to do.
      try {
        const preflight = await runSearchPreflight({
          token,
          userId,
          channelId,
          guildId: channel.guildId ?? null,
          messages,
          searchDelay,
          delayModifier,
          getState,
          dispatch,
          onPageComplete: ({ packageHitsSoFar, packageHitsOnThisPage }) => {
            // Advance the progress bar as pages come in so the UI
            // doesn't sit at 0/N for the whole preflight. Use the
            // package-overlap count (not foundById.size) so the bar
            // reflects real cache-hit budget; foundById can include
            // messages outside the package, which would clamp progress
            // to messages.length and freeze the bar through the entire
            // AROUND loop.
            progressCurrent = Math.min(packageHitsSoFar, messages.length);
            dispatch(
              setEnrichmentProgress({
                channelId,
                current: progressCurrent,
                total: messages.length,
              }),
            );
            // Paint chips live — every message returned by search that
            // is in our package can be flipped to "enriched" now.
            if (packageHitsOnThisPage.length > 0) {
              const enrichedPatch: Record<string, Message> = {};
              for (const msg of packageHitsOnThisPage) {
                enrichedPatch[msg.id] = msg;
              }
              dispatch(
                mergeEnrichmentDelta({
                  channelId,
                  enriched: enrichedPatch,
                  deleted: [],
                  forbidden: [],
                }),
              );
            }
          },
        });
        for (const [id, msg] of preflight.foundById) {
          windowCache.set(id, msg);
        }
        // Always log a channel-scan summary so users can verify the
        // optimization ran. The bulk-search step lets us skip per-message
        // API calls when Discord returned the message in a search page.
        if (preflight.status === 'ok' || preflight.status === 'cap-exceeded') {
          dispatch(
            addStatusEntry({
              level: 'info',
              message:
                `Channel scan matched ${preflight.packageHitsTotal.toLocaleString()} ` +
                `of ${messages.length.toLocaleString()} package ` +
                `${messages.length === 1 ? 'message' : 'messages'}.`,
            }),
          );
        }
        if (preflight.status === 'forbidden') {
          dispatch(
            addStatusEntry({
              level: 'info',
              message:
                "Channel scan unavailable (no permission). " +
                'Checking messages one-by-one.',
            }),
          );
        } else if (preflight.status === 'cap-exceeded') {
          dispatch(
            addStatusEntry({
              level: 'warning',
              message:
                'Channel scan returned 5,000 messages, the most Discord allows in a single search. ' +
                'Checking the rest one-by-one.',
            }),
          );
        } else if (preflight.status === 'not-found') {
          // 404 on the guild/channel search endpoint means the resource
          // is gone from the user's perspective (left/kicked/deleted).
          // The AROUND loop would produce N more 404s — abort instead.
          channelInaccessible = true;
          channelInaccessibleStatus = preflight.httpStatus;
          dispatch(
            addStatusEntry({
              level: 'error',
              message:
                "This channel is no longer accessible on Discord. You may have " +
                'left or been removed from this server, or the server was ' +
                'deleted. Package data is still viewable below.',
            }),
          );
        } else if (preflight.status === 'error') {
          dispatch(
            addStatusEntry({
              level: 'warning',
              message:
                'Channel scan failed. Checking messages one-by-one.',
            }),
          );
        }
      } catch (err) {
        // Cancellation bubbles up to the outer catch so `cancelled`
        // is set and partial results still persist appropriately.
        if (err instanceof CancelledError) throw err;
        // Any other preflight failure is non-fatal — fall through.
        dispatch(
          addStatusEntry({
            level: 'info',
            message:
              'Channel scan unavailable. Checking messages one-by-one.',
          }),
        );
      }

      // Skip the per-message AROUND loop entirely when preflight
      // confirmed the channel is inaccessible. Each call would 404
      // for the same reason and pollute the "deleted" set.
      const loopLength = channelInaccessible ? 0 : messages.length;
      for (let i = 0; i < loopLength; i++) {
        await waitWhilePaused(getState);
        if (checkCancelled(getState)) throw new CancelledError();

        const targetId = messages[i].id;
        let madeApiCall = false;

        if (knownDeleted.has(targetId)) {
          // Already confirmed gone (user delete or prior 404). Preserve
          // the status in the new misses map so the visual "unavailable"
          // cue survives this enrichment pass without a wasted API call.
          misses.deleted.push(targetId);
          pendingDelta.deleted.push(targetId);
        } else if (windowCache.has(targetId)) {
          // A prior AROUND call returned this message as a neighbor of
          // another target — use the cached live message for free.
          const hit = windowCache.get(targetId)!;
          enriched[targetId] = hit;
          pendingDelta.enriched[targetId] = hit;
        } else {
          madeApiCall = true;
          try {
            const response = await discordService.fetchMessageData(
              token,
              targetId,
              channelId,
              QueryStringParam.AROUND,
            );
            if (response.success && response.data) {
              // Cache the whole window so subsequent iterations can
              // short-circuit when their target is already in the window.
              for (const msg of response.data) {
                windowCache.set(msg.id, msg);
              }
              const hit = windowCache.get(targetId);
              if (hit) {
                enriched[targetId] = hit;
                pendingDelta.enriched[targetId] = hit;
              } else {
                // API returned neighboring messages but not the target —
                // message was deleted on Discord since the package export.
                misses.deleted.push(targetId);
                pendingDelta.deleted.push(targetId);
              }
            } else if (response.status === 404) {
              misses.deleted.push(targetId);
              pendingDelta.deleted.push(targetId);
            } else if (response.status === 403) {
              misses.forbidden.push(targetId);
              pendingDelta.forbidden.push(targetId);
            }
            // Other failures (5xx / network): drop silently — they'll
            // stay source-only and can be retried by the user.
          } catch (err) {
            const status = extractHttpStatus(err);
            if (status === 404) {
              misses.deleted.push(targetId);
              pendingDelta.deleted.push(targetId);
            } else if (status === 403) {
              misses.forbidden.push(targetId);
              pendingDelta.forbidden.push(targetId);
            }
            // else: continue loop, this message stays as source.
          }
        }

        const now = Date.now();
        if (
          i - lastDispatchedIndex >= PROGRESS_EVERY_N ||
          now - lastDispatchedAt >= PROGRESS_EVERY_MS
        ) {
          // Never regress the bar — preflight may have already
          // advanced it past i+1 by finding most messages already.
          progressCurrent = Math.max(progressCurrent, i + 1);
          dispatch(
            setEnrichmentProgress({
              channelId,
              current: progressCurrent,
              total: messages.length,
            }),
          );
          // Paint chips as results come in. Flushed on the same
          // throttle as progress so UI traffic stays bounded.
          flushDelta();
          lastDispatchedIndex = i;
          lastDispatchedAt = now;
        }

        // Only pay the configured per-message delay when we actually
        // hit the Discord API. Cache hits and known-gone skips cost
        // microseconds and don't consume rate-limit budget.
        if (madeApiCall && i < messages.length - 1) {
          const calc = calculateRandomDelay(searchDelay, delayModifier);
          const wasCancelled = await cancellableDelay(calc.delayMs, getState);
          if (wasCancelled) throw new CancelledError();
        }
      }
    } catch (err) {
      if (err instanceof CancelledError) {
        cancelled = true;
      } else {
        // Unexpected exception — persist what we have and fulfill
        // rather than rejecting, so partial results survive.
        dispatch(
          addStatusEntry({
            level: 'error',
            message: `Package rehydration error: ${err instanceof Error ? err.message : 'unknown'}`,
          }),
        );
      }
    }

    // Final progress snapshot — but don't falsely jump to 100% if the
    // run was cancelled or aborted due to channel inaccessibility.
    if (!cancelled && !channelInaccessible) {
      dispatch(
        setEnrichmentProgress({
          channelId,
          current: messages.length,
          total: messages.length,
        }),
      );
    }

    const enrichedCount = Object.keys(enriched).length;

    // Persist semantics:
    //   - Completed successfully → always write new result
    //   - Cancelled + no previous cache → write partial so the work
    //     isn't completely lost
    //   - Cancelled + previous cache exists → DON'T overwrite.
    //   - Channel inaccessible → DON'T overwrite. We have zero new
    //     data and would only poison the cache with false positives.
    // `previousCache` was read up front for skip-logic; reuse it here.
    const shouldPersist =
      !channelInaccessible && (!cancelled || !previousCache);
    if (shouldPersist) {
      const cache: EnrichedChannelCache = {
        lastFetched: Date.now(),
        messages: enriched,
        misses,
      };
      await enrichmentCache.put(userId, channelId, cache);
      // Mirror the persisted cache into Redux state so UI sees the same
      // data without a second IDB read. This also collapses any
      // progressive deltas into the canonical final shape.
      dispatch(hydrateEnrichmentFromCache({ channelId, cache }));
    } else if (previousCache) {
      // Cancelled refresh or inaccessible-channel abort with a previous
      // full cache — restore state to match the preserved IDB cache.
      // Without this, in-flight `mergeEnrichmentDelta` dispatches (or
      // the initial cache-hit hydrate) would leave Redux in a hybrid
      // shape even though we're intentionally keeping the old cache.
      dispatch(
        hydrateEnrichmentFromCache({ channelId, cache: previousCache }),
      );
    }
    if (channelInaccessible) {
      // Distinct completion entry so the user understands the run
      // didn't just silently finish — the channel is the problem.
      dispatch(
        addStatusEntry({
          level: 'error',
          message:
            `Couldn't load rich data for "${channelLabel}": ` +
            `the channel is no longer accessible on Discord.`,
        }),
      );
    } else if (cancelled && !shouldPersist) {
      // Refresh cancelled but we kept the previous cache — be explicit
      // so users don't think they lost their rich data.
      const keptCount = Object.keys(previousCache?.messages ?? {}).length;
      dispatch(
        addStatusEntry({
          level: 'info',
          message:
            `Refresh cancelled for "${channelLabel}". ` +
            `Kept the previous rich data (${keptCount.toLocaleString()} ${keptCount === 1 ? 'message' : 'messages'}).`,
        }),
      );
    } else {
      dispatch(
        addStatusEntry({
          level: misses.forbidden.length > 0 ? 'warning' : 'success',
          message: formatRehydrateLogSummary({
            channelLabel,
            enriched: enrichedCount,
            unavailable: misses.deleted.length,
            noAccess: misses.forbidden.length,
            cancelled,
          }),
        }),
      );
    }

    return {
      channelId,
      fromCache: false,
      enriched: enrichedCount,
      deleted: misses.deleted.length,
      forbidden: misses.forbidden.length,
      cancelled,
      channelInaccessible,
      inaccessibleStatus: channelInaccessibleStatus,
    };
  },
  {
    /**
     * Enrichment is strictly serialized — if another channel is already
     * running, don't even dispatch .pending (which would otherwise fire
     * before our guard check and overwrite `activeEnrichmentChannelId`).
     * `condition` returning false causes RTK to skip the thunk entirely;
     * dispatch() resolves to a `condition`-rejected action with no state
     * side effects.
     */
    condition: ({ channelId }, { getState }) => {
      const activeId = (getState() as RootState).package
        .activeEnrichmentChannelId;
      return !activeId || activeId === channelId;
    },
  },
);

const packageSlice = createSlice({
  name: 'package',
  initialState: initialPackageState,
  reducers: {
    selectPackageChannel(state, action: PayloadAction<string | null>) {
      state.selectedChannelId = action.payload;
    },
    setTimelineProgress(
      state,
      action: PayloadAction<{ current: number; total: number }>,
    ) {
      state.timelineProgress = action.payload;
    },
    setDeleteProgress(
      state,
      action: PayloadAction<{ current: number; total: number }>,
    ) {
      state.deleteProgress = action.payload;
    },
    toggleMessageSelection(
      state,
      action: PayloadAction<{ channelId: string; messageId: string }>,
    ) {
      const { channelId, messageId } = action.payload;
      const current = state.selectedMessageIds[channelId] ?? [];
      const idx = current.indexOf(messageId);
      if (idx === -1) {
        state.selectedMessageIds[channelId] = [...current, messageId];
      } else {
        const next = [...current];
        next.splice(idx, 1);
        if (next.length === 0) delete state.selectedMessageIds[channelId];
        else state.selectedMessageIds[channelId] = next;
      }
    },
    selectAllChannelMessages(
      state,
      action: PayloadAction<{ channelId: string; messageIds: string[] }>,
    ) {
      const { channelId, messageIds } = action.payload;
      state.selectedMessageIds[channelId] = [...messageIds];
    },
    clearChannelMessageSelection(state, action: PayloadAction<string>) {
      delete state.selectedMessageIds[action.payload];
    },
    dismissDeleteResult(state) {
      state.deleteResult = null;
      state.deleteError = null;
      state.deleteStatus = 'idle';
    },
    setEnrichmentProgress(
      state,
      action: PayloadAction<{ channelId: string; current: number; total: number }>,
    ) {
      const { channelId, current, total } = action.payload;
      state.enrichmentProgress[channelId] = { current, total };
    },
    /**
     * Populate enriched state from a previously persisted cache — called
     * when a channel was enriched in an earlier session and we're
     * short-circuiting the API loop. Maintains an LRU ordering over
     * `enrichedMessages` so the in-memory footprint stays bounded — IDB
     * still holds everything, so evicted channels re-hydrate instantly.
     */
    hydrateEnrichmentFromCache(
      state,
      action: PayloadAction<{ channelId: string; cache: EnrichedChannelCache }>,
    ) {
      const { channelId, cache } = action.payload;
      state.enrichedMessages[channelId] = cache.messages;
      state.enrichmentMisses[channelId] = {
        deleted: [...cache.misses.deleted],
        forbidden: [...cache.misses.forbidden],
      };
      state.enrichmentStatus[channelId] = 'done';
      state.enrichmentLastFetched[channelId] = cache.lastFetched;
      state.enrichmentError[channelId] = null;

      // LRU: put this channelId at the tail.
      state.enrichedOrder = state.enrichedOrder.filter((id) => id !== channelId);
      state.enrichedOrder.push(channelId);

      // Evict oldest when over the limit — but never evict the
      // currently-active one (rare race if another enrichment is
      // mid-flight and user opens a 6th channel).
      while (state.enrichedOrder.length > ENRICHED_CHANNELS_LIMIT) {
        const oldest = state.enrichedOrder[0];
        if (oldest === state.activeEnrichmentChannelId) break;
        state.enrichedOrder.shift();
        delete state.enrichedMessages[oldest];
        delete state.enrichmentMisses[oldest];
        delete state.enrichmentStatus[oldest];
        delete state.enrichmentLastFetched[oldest];
        delete state.enrichmentError[oldest];
      }
    },
    /**
     * Incremental merge of enrichment results mid-run so the UI paints
     * "enriched"/"unavailable" chips progressively instead of all-at-once
     * when the loop finishes. Thunk throttles dispatch to the same
     * cadence as `setEnrichmentProgress` to keep Redux traffic bounded.
     *
     * Unlike `hydrateEnrichmentFromCache`, this preserves existing state
     * (refresh keeps stale enriched rows visible) and appends deltas.
     * Eviction is intentionally skipped — the final hydrate call at the
     * end of the thunk handles LRU and persistence.
     */
    mergeEnrichmentDelta(
      state,
      action: PayloadAction<{
        channelId: string;
        enriched: Record<string, Message>;
        deleted: string[];
        forbidden: string[];
      }>,
    ) {
      const { channelId, enriched, deleted, forbidden } = action.payload;

      if (!state.enrichedMessages[channelId]) {
        state.enrichedMessages[channelId] = {};
      }
      Object.assign(state.enrichedMessages[channelId], enriched);

      if (!state.enrichmentMisses[channelId]) {
        state.enrichmentMisses[channelId] = { deleted: [], forbidden: [] };
      }
      if (deleted.length > 0) {
        const existing = new Set(state.enrichmentMisses[channelId].deleted);
        for (const id of deleted) existing.add(id);
        state.enrichmentMisses[channelId].deleted = [...existing];
      }
      if (forbidden.length > 0) {
        const existing = new Set(state.enrichmentMisses[channelId].forbidden);
        for (const id of forbidden) existing.add(id);
        state.enrichmentMisses[channelId].forbidden = [...existing];
      }

      // LRU bump so this actively-enriching channel doesn't get evicted
      // by a concurrent hydrate on another channel.
      state.enrichedOrder = state.enrichedOrder.filter((id) => id !== channelId);
      state.enrichedOrder.push(channelId);
    },
    /** Drop enrichment state for one channel (used before a refresh). */
    clearChannelEnrichmentState(state, action: PayloadAction<string>) {
      const channelId = action.payload;
      delete state.enrichedMessages[channelId];
      delete state.enrichmentMisses[channelId];
      delete state.enrichmentStatus[channelId];
      delete state.enrichmentProgress[channelId];
      delete state.enrichmentLastFetched[channelId];
      delete state.enrichmentError[channelId];
      state.enrichedOrder = state.enrichedOrder.filter((id) => id !== channelId);
    },
    applyLocalMessageEdits(
      state,
      action: PayloadAction<{ channelId: string; messageIds: string[]; content: string }>,
    ) {
      const { channelId, messageIds, content } = action.payload;
      const cached = state.loadedChannels[channelId];
      if (!cached) return;
      const idSet = new Set(messageIds);
      state.loadedChannels[channelId] = cached.map((m) =>
        idSet.has(m.id) ? { ...m, content } : m,
      );
    },
    clearPackage(state) {
      if (state.parsed?.avatarBlobUrl) {
        try {
          URL.revokeObjectURL(state.parsed.avatarBlobUrl);
        } catch {
          /* ignore */
        }
      }
      Object.assign(state, initialPackageState);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(importPackage.pending, (state) => {
        state.status = 'parsing';
        state.error = null;
      })
      .addCase(importPackage.fulfilled, (state, action) => {
        state.status = 'ready';
        state.parsed = action.payload.parsed;
        state.validation = action.payload.validation;
        state.error = null;
        state.selectedChannelId = null;
        state.loadedChannels = {};
        state.loadedOrder = [];
        // `deletedMessageIds` gets hydrated by the hydratePackageDeletedCache
        // thunk which runs right after a successful import.
        state.deletedMessageIds = {};
      })
      .addCase(importPackage.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload ?? 'Unknown error';
        state.parsed = null;
        state.validation = null;
      })
      .addCase(resumeStoredPackage.fulfilled, (state, action) => {
        if (!action.payload) return; // nothing to resume
        state.status = 'ready';
        state.parsed = action.payload.parsed;
        state.validation = action.payload.validation;
        state.error = null;
        state.selectedChannelId = null;
        state.loadedChannels = {};
        state.loadedOrder = [];
        state.deletedMessageIds = {};
      })
      .addCase(loadPackageChannelMessages.pending, (state, action) => {
        state.loadingChannelId = action.meta.arg;
      })
      .addCase(loadPackageChannelMessages.fulfilled, (state, action) => {
        const { channelId, messages } = action.payload;
        state.loadedChannels[channelId] = messages;

        // LRU: move/insert channelId at the end of loadedOrder.
        state.loadedOrder = state.loadedOrder.filter((id) => id !== channelId);
        state.loadedOrder.push(channelId);

        while (state.loadedOrder.length > LOADED_CHANNELS_LIMIT) {
          const evictId = state.loadedOrder.shift();
          if (evictId) delete state.loadedChannels[evictId];
        }

        state.loadingChannelId = null;
      })
      .addCase(loadPackageChannelMessages.rejected, (state) => {
        state.loadingChannelId = null;
      })
      .addCase(loadAllPackageTimestamps.pending, (state) => {
        state.timelineStatus = 'loading';
        state.timelineError = null;
        state.timelineTimestamps = [];
      })
      .addCase(loadAllPackageTimestamps.fulfilled, (state, action) => {
        state.timelineStatus = 'ready';
        state.timelineTimestamps = action.payload;
        state.timelineProgress = null;
      })
      .addCase(loadAllPackageTimestamps.rejected, (state, action) => {
        state.timelineStatus = 'error';
        state.timelineError = action.payload ?? 'Failed to build timeline';
        state.timelineProgress = null;
      })
      .addCase(deletePackageMessages.pending, (state) => {
        state.deleteStatus = 'running';
        state.deleteError = null;
        state.deleteResult = null;
        state.deleteProgress = null;
      })
      .addCase(deletePackageMessages.fulfilled, (state, action) => {
        state.deleteStatus = 'ready';
        state.deleteResult = action.payload;
        state.deleteProgress = null;

        const channelId = action.meta.arg.channelId;
        const goneIds = action.payload.confirmedGoneIds;

        // Merge into the persistent deleted set for this channel.
        const existing = state.deletedMessageIds[channelId] ?? [];
        const merged = Array.from(new Set([...existing, ...goneIds]));
        state.deletedMessageIds[channelId] = merged;

        // Clear selection (they're gone or intended to be).
        delete state.selectedMessageIds[channelId];

        // Intentionally keep confirmed-gone messages in `loadedChannels`.
        // The table renders them with the `gone` visual treatment via
        // `deletedMessageIds`, so users can see *what* was deleted and
        // its original content — rather than rows silently vanishing.
      })
      .addCase(deletePackageMessages.rejected, (state, action) => {
        state.deleteStatus = 'error';
        state.deleteError = action.payload ?? 'Delete failed';
        state.deleteProgress = null;
      })
      .addCase(exportPackageChannel.pending, (state) => {
        state.exportStatus = 'running';
        state.exportError = null;
      })
      .addCase(exportPackageChannel.fulfilled, (state) => {
        state.exportStatus = 'ready';
      })
      .addCase(exportPackageChannel.rejected, (state, action) => {
        state.exportStatus = 'error';
        state.exportError = action.payload ?? 'Export failed';
      })
      .addCase(hydratePackageDeletedCache.fulfilled, (state, action) => {
        state.deletedMessageIds = action.payload;
      })
      .addCase(clearPackageDeletedCache.fulfilled, (state) => {
        state.deletedMessageIds = {};
      })
      .addCase(enrichPackageChannel.pending, (state, action) => {
        const { channelId } = action.meta.arg;
        state.activeEnrichmentChannelId = channelId;
        state.enrichmentStatus[channelId] = 'running';
        state.enrichmentError[channelId] = null;
        state.enrichmentProgress[channelId] = { current: 0, total: 0 };
        // NOTE: we intentionally do NOT wipe existing enrichedMessages
        // here even on `refresh: true`. Keeping old data visible during
        // the refresh avoids the UX flicker where every row flashes back
        // to the `source` chip for the duration of the API loop. The
        // old data is overwritten by hydrateEnrichmentFromCache only on
        // successful completion — cancelled/failed runs leave it intact.
      })
      .addCase(enrichPackageChannel.fulfilled, (state, action) => {
        const { channelId, cancelled, channelInaccessible, inaccessibleStatus } =
          action.payload;
        // Messages, misses, and lastFetched are already populated by
        // the thunk's dispatch of hydrateEnrichmentFromCache (both the
        // cache-hit path and the normal path). Here we just finalize
        // the status if the run was cancelled (hydrate leaves it at
        // 'done') and release the serialization lock.
        if (channelInaccessible) {
          state.enrichmentStatus[channelId] = 'failed';
          state.enrichmentError[channelId] =
            `Channel no longer accessible on Discord (HTTP ${inaccessibleStatus ?? 404})`;
        } else if (cancelled) {
          state.enrichmentStatus[channelId] = 'cancelled';
        }
        state.activeEnrichmentChannelId = null;
      })
      .addCase(enrichPackageChannel.rejected, (state, action) => {
        const channelId = action.meta.arg.channelId;
        state.enrichmentStatus[channelId] = 'failed';
        state.enrichmentError[channelId] =
          action.payload ?? action.error.message ?? 'Enrichment failed';
        state.activeEnrichmentChannelId = null;
      });
  },
});

export const {
  selectPackageChannel,
  setTimelineProgress,
  setDeleteProgress,
  toggleMessageSelection,
  selectAllChannelMessages,
  clearChannelMessageSelection,
  dismissDeleteResult,
  applyLocalMessageEdits,
  clearPackage,
  setEnrichmentProgress,
  hydrateEnrichmentFromCache,
  mergeEnrichmentDelta,
  clearChannelEnrichmentState,
} = packageSlice.actions;
export default packageSlice.reducer;

/* ────────── selectors ────────── */

export const selectPackageStatus = (state: RootState) => state.package.status;
export const selectParsedPackage = (state: RootState) => state.package.parsed;
export const selectPackageValidation = (state: RootState) => state.package.validation;
export const selectPackageError = (state: RootState) => state.package.error;
export const selectSelectedPackageChannelId = (state: RootState) =>
  state.package.selectedChannelId;
export const selectPackageChannelMessages =
  (channelId: string | null) =>
  (state: RootState): PackageMessage[] | undefined =>
    channelId ? state.package.loadedChannels[channelId] : undefined;
export const selectIsPackageChannelLoading = (state: RootState) =>
  state.package.loadingChannelId !== null;
export const selectIsPackageReadOnly = (state: RootState) =>
  state.package.validation?.readOnly ?? true;
export const selectTimelineStatus = (state: RootState) =>
  state.package.timelineStatus;
export const selectTimelineTimestamps = (state: RootState) =>
  state.package.timelineTimestamps;
export const selectTimelineProgress = (state: RootState) =>
  state.package.timelineProgress;
export const selectTimelineError = (state: RootState) =>
  state.package.timelineError;
export const selectChannelSelectedMessageIds =
  (channelId: string) =>
  (state: RootState): string[] =>
    state.package.selectedMessageIds[channelId] ?? [];
export const selectDeleteStatus = (state: RootState) => state.package.deleteStatus;
export const selectDeleteProgress = (state: RootState) => state.package.deleteProgress;
export const selectDeleteResult = (state: RootState) => state.package.deleteResult;
export const selectDeleteError = (state: RootState) => state.package.deleteError;
export const selectPackageExportStatus = (state: RootState) =>
  state.package.exportStatus;
export const selectChannelDeletedMessageIds =
  (channelId: string) =>
  (state: RootState): string[] =>
    state.package.deletedMessageIds[channelId] ?? [];
export const selectTotalDeletedMessageCount = (state: RootState): number =>
  Object.values(state.package.deletedMessageIds).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
export const selectPackageExportError = (state: RootState) =>
  state.package.exportError;

/* ────────── enrichment selectors ────────── */

export const selectActiveEnrichmentChannelId = (state: RootState) =>
  state.package.activeEnrichmentChannelId;
export const selectChannelEnrichmentStatus =
  (channelId: string) =>
  (state: RootState): EnrichmentStatus =>
    state.package.enrichmentStatus[channelId] ?? 'idle';
export const selectChannelEnrichmentProgress =
  (channelId: string) => (state: RootState) =>
    state.package.enrichmentProgress[channelId] ?? null;
export const selectChannelEnrichedMessages =
  (channelId: string) =>
  (state: RootState): Record<string, Message> | undefined =>
    state.package.enrichedMessages[channelId];
export const selectChannelEnrichmentMisses =
  (channelId: string) => (state: RootState) =>
    state.package.enrichmentMisses[channelId] ?? {
      deleted: [],
      forbidden: [],
    };
export const selectChannelEnrichmentError =
  (channelId: string) =>
  (state: RootState): string | null =>
    state.package.enrichmentError[channelId] ?? null;
export const selectChannelEnrichmentLastFetched =
  (channelId: string) =>
  (state: RootState): number | null =>
    state.package.enrichmentLastFetched[channelId] ?? null;

/** Test-only helper. */
/**
 * Test helpers retained as no-ops for backwards compatibility with
 * existing packageSlice.test.ts. The post-#162 architecture has no
 * module-level File reference; tests that previously called
 * `storeSourceFile(null)` to simulate "lost source" should instead
 * clear `pkg:msgs:*` keys via `storage.package.remove(...)`.
 */
export const __testHelpers__ = {
  storeSourceFile: (_file: File | Blob | null) => { /* no-op since #162 */ },
  getSourceFile: (): File | Blob | null => null,
};
