export type PurgeMode = 'messages' | 'reactions' | 'clearReactions';

export interface BulkPurgeContext {
  currentIndex: number;
  totalChannels: number;
  currentChannelName: string;
  completedStats: {
    deleted: number;
    skipped: number;
    reactionsRemoved: number;
    // Messages-mode-only counters. Optional so reactions-mode dispatches
    // don't have to carry zeros they'll never touch.
    editedAttachmentsOnly?: number;
    failed?: number;
  };
}

export interface PurgeProgress {
  processed: number;
  deleted: number;
  skipped: number;
  reactionsRemoved: number;
  // Messages-mode-only counters. Optional so reactions-mode dispatches
  // don't have to carry zeros they'll never touch.
  editedAttachmentsOnly?: number;
  failed?: number;
  bulk?: BulkPurgeContext;
}

export interface PurgeConfig {
  mode: PurgeMode;
  targetUserIds: string[];
  retainAttachedMedia: boolean;
  deleteAttachmentsOnly: boolean;
  // Backlog #196 Phase 2 — opt-in set of Discord MessageType values
  // (as enum string values, e.g. "6" for CHANNEL_PINNED_MESSAGE) that
  // the purge should delete despite being system messages. Empty/omitted
  // preserves the default behavior of skipping every non-DEFAULT,
  // non-REPLY type. Purge-scope decision, set in BulkPurgeDialog — not a
  // search filter.
  systemMessageTypesToDelete?: string[];
  // #233 — leave archived threads untouched. Deleting inside an archived
  // thread REQUIRES un-archiving it first (Discord error 50083), which
  // resurfaces the thread for every member until it's re-archived at the
  // end of the run. When set, messages in archived threads are skipped
  // (and counted) instead of waking the thread. Guild mode only — DMs
  // have no threads.
  skipArchivedThreads?: boolean;
  // #239 — "Keep messages with files or links". When set, any message
  // carrying an attachment or an http(s) link (shared predicate:
  // messageHasFileOrLink in messageFiltering.ts) is skipped entirely —
  // not deleted, not content-cleared — and counted so the summary can
  // report how many were preserved. Wins over retainAttachedMedia: a
  // message both options could claim stays fully intact. Messages mode
  // only, mirroring retainAttachedMedia's gating.
  preserveMediaAndLinks?: boolean;
}

export interface PurgeState {
  isPurging: boolean;
  purgeProgress: PurgeProgress | null;
  purgeError: string | null;
}

export const initialPurgeState: PurgeState = {
  isPurging: false,
  purgeProgress: null,
  purgeError: null,
};
