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
