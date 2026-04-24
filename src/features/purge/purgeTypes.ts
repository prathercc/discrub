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
