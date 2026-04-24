import type { Channel, Message } from 'discrub-core/types/discord-types';

/**
 * Types for channel feature
 */

export interface ChannelState {
  channels: Channel[];
  selectedChannel: Channel | null;
  selectedChannels: Channel[];
  isLoading: boolean;
  error: string | null;
  /** Threads/posts for the currently selected forum/media channel */
  forumThreads: Channel[];
  /** First message of each forum thread (preview content) */
  forumFirstMessages: Message[];
  isLoadingForumThreads: boolean;
  hasMoreForumThreads: boolean;
  forumThreadsTotalResults: number;
  forumThreadsNextOffset: number;
}

export const initialChannelState: ChannelState = {
  channels: [],
  selectedChannel: null,
  selectedChannels: [],
  isLoading: false,
  error: null,
  forumThreads: [],
  forumFirstMessages: [],
  isLoadingForumThreads: false,
  hasMoreForumThreads: false,
  forumThreadsTotalResults: 0,
  forumThreadsNextOffset: 0,
};
