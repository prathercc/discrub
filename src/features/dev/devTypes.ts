export interface SeedVarietyOptions {
  includeMentions: boolean;
  includeReactions: boolean;
  includeReplies: boolean;
  includeEdits: boolean;
  includePins: boolean;
}

export interface SeedProgress {
  /** Index of the channel currently being seeded (0-based). */
  channelIndex: number;
  totalChannels: number;
  currentChannelName: string;
  /** Messages successfully posted in the current channel. */
  current: number;
  /** Target message count for the current channel. */
  total: number;
  /** Cumulative posts across all channels in this run. */
  totalPosted: number;
  /** Cumulative errors across all channels in this run. */
  totalErrors: number;
}

export interface DevState {
  isSeeding: boolean;
  seedProgress: SeedProgress | null;
  seedError: string | null;
}

export const initialDevState: DevState = {
  isSeeding: false,
  seedProgress: null,
  seedError: null,
};
