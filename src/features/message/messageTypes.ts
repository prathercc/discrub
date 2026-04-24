import type { Message } from 'discrub-core/types/discord-types';
import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import { SortDirection } from 'discrub-core/common-enum';

/**
 * Types for message feature
 */

export interface MessageOrder {
  order: SortDirection;
  orderBy: keyof Message;
}

export interface PaginationState {
  lastMessageId: string | null;
  hasMore: boolean;
  totalCount: number | null;
  isLoadingMore: boolean;
  isLoadingAll: boolean;
  loadAllProgress: {
    current: number;
    total: number;
    message: string;
  } | null;
  mode: 'paginated' | 'all' | 'search';
  /**
   * Offset-based cursor for the next search page fetch. Only meaningful when
   * mode === 'search'. Discord's search endpoint uses `offset` (not
   * last-message-id) for pagination and caps each query at 5000 matches.
   */
  searchOffset: number;
}

export interface ThreadTabState {
  threadId: string;
  threadName: string;
  messages: Message[];
  filteredMessages: Message[];
  selectedMessages: Message[];
  searchCriteria: SearchCriteria | null;
  /** Client-side refine applied on top of the raw message list. Kept here
   *  (not in a component ref) so data-arrival reducers can re-apply it
   *  automatically when new pages stream in. */
  refineCriteria: SearchCriteria | null;
  order: MessageOrder;
  isLoading: boolean;
  error: string | null;
  pagination: PaginationState;
}

export interface MessageState {
  messages: Message[];
  filteredMessages: Message[];
  selectedMessages: Message[];
  searchCriteria: SearchCriteria | null;
  /** Client-side refine applied on top of the raw message list. See
   *  ThreadTabState.refineCriteria for rationale. */
  refineCriteria: SearchCriteria | null;
  order: MessageOrder;
  isLoading: boolean;
  isDeleting: boolean;
  isEditing: boolean;
  isEnriching: boolean;
  isRemovingReactions: boolean;
  error: string | null;
  pagination: PaginationState;
  activeTab: string | null;
  threadTabs: Record<string, ThreadTabState>;
  /**
   * When a user clicks a reply bar or pinned-message notice, the target
   * message ID is stored here so MessageFeed can scroll it into view and
   * flash-highlight its row. Cleared ~2s after the scroll.
   */
  highlightedMessageId: string | null;
}

export const initialPaginationState: PaginationState = {
  lastMessageId: null,
  hasMore: true,
  totalCount: null,
  isLoadingMore: false,
  isLoadingAll: false,
  loadAllProgress: null,
  mode: 'paginated',
  searchOffset: 0,
};

export const initialMessageState: MessageState = {
  messages: [],
  filteredMessages: [],
  selectedMessages: [],
  searchCriteria: null,
  refineCriteria: null,
  order: {
    order: SortDirection.DESCENDING,
    orderBy: 'timestamp',
  },
  isLoading: false,
  isDeleting: false,
  isEditing: false,
  isEnriching: false,
  isRemovingReactions: false,
  error: null,
  pagination: initialPaginationState,
  activeTab: null,
  threadTabs: {},
  highlightedMessageId: null,
};
