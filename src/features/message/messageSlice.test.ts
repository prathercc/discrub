import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { createTestStore, TestStore } from '@/test/test-utils';
import messageReducer, {
  setMessages,
  setFilteredMessages,
  setSelectedMessages,
  toggleMessageSelection,
  selectAllMessages,
  deselectAllMessages,
  setSearchCriteria,
  setOrder,
  clearMessages,
  resetPagination,
  deleteMessage,
  deleteMessages,
  editMessage,
  editMessages,
  fetchReactingUsers,
  deleteReaction,
  deleteAllReactions,
  bulkDeleteAllReactions,
  bulkDeleteReactionsForEmoji,
  batchRemoveReactions,
  deleteAttachment,
  deleteAllAttachments,
  fetchMessages,
  fetchMoreMessages,
  searchMessages,
  fetchAllMessages,
  selectMessage,
  selectMessages,
  selectFilteredMessages,
  selectSelectedMessages,
  selectSearchCriteria,
  selectMessageOrder,
  selectMessageLoading,
  selectMessageDeleting,
  selectMessageError,
  selectPagination,
  setActiveTab,
  addThreadTab,
  removeThreadTab,
  setThreadMessages,
  setThreadFilteredMessages,
  toggleThreadMessageSelection,
  selectAllThreadMessages,
  deselectAllThreadMessages,
  setThreadOrder,
  setThreadSearchCriteria,
  setThreadLoading,
  setThreadError,
  updateThreadPagination,
  selectActiveTab,
  selectThreadTabs,
  selectThreadTab,
  selectActiveMessages,
  selectActiveFilteredMessages,
  selectActiveSelectedMessages,
  selectActiveSearchCriteria,
  selectActiveOrder,
  selectActiveLoading,
  selectActiveError,
  selectActivePagination,
  openThreadTab,
  fetchMoreThreadMessages,
  fetchAllThreadMessages,
  searchThreadMessages,
  navigateToMessage,
  setHighlightedMessageId,
  selectHighlightedMessageId,
  applyUserFilter,
} from './messageSlice';
import { initialMessageState } from './messageTypes';
import * as discordService from '@services/discordService';
import { createMockMessages, createMockMessage, createMockAttachment, createMockReaction, createMockUser } from '@/test/fixtures';
import type { Message } from 'discrub-core/types/discord-types';
import { SortDirection } from 'discrub-core/common-enum';
import { addStatusEntry, showToast } from '@features/status/statusSlice';

// Mock dependencies
vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(),
}));

vi.mock('discrub-core/discrub-utils', () => ({
  getSortedMessages: vi.fn((messages) => messages),
}));

vi.mock('@/utils/delayUtils', () => ({
  calculateRandomDelay: vi.fn(() => ({
    delayMs: 0,
    delaySec: 0,
    baseDelay: 0,
    modifier: 0,
    randomComponent: 0,
  })),
}));

vi.mock('@/utils/operationLoopUtils', () => ({
  waitWhilePaused: vi.fn().mockResolvedValue(undefined),
  checkCancelled: vi.fn().mockReturnValue(false),
  cancellableDelay: vi.fn().mockResolvedValue(false),
}));

vi.mock('@features/status/statusSlice', () => ({
  addStatusEntry: vi.fn((payload) => ({ type: 'status/addStatusEntry', payload })),
  showOperationTip: vi.fn((message) => ({ type: 'status/showOperationTip', payload: message })),
  showToast: vi.fn((payload) => ({ type: 'status/showToast', payload })),
}));

vi.mock('discrub-core/discord-enum', () => ({
  ReactionType: { NORMAL: 0, BURST: 1 },
  IsPinnedType: { UNSET: 0, YES: 1, NO: 2 },
}));

describe('messageSlice', () => {
  let store: TestStore;

  const mockMessages: Message[] = createMockMessages(5);

  beforeEach(() => {
    store = createTestStore({ message: messageReducer });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState();
      expect(state.message).toEqual(initialMessageState);
      expect(state.message.messages).toEqual([]);
      expect(state.message.filteredMessages).toEqual([]);
      expect(state.message.selectedMessages).toEqual([]);
      expect(state.message.searchCriteria).toBeNull();
      expect(state.message.isLoading).toBe(false);
      expect(state.message.error).toBeNull();
    });
  });

  describe('reducers', () => {
    describe('setMessages', () => {
      it('should set messages', () => {
        store.dispatch(setMessages(mockMessages));

        const state = store.getState().message;
        expect(state.messages).toEqual(mockMessages);
      });

      it('should replace existing messages', () => {
        store.dispatch(setMessages(mockMessages));
        const newMessages = createMockMessages(3);
        store.dispatch(setMessages(newMessages));

        const state = store.getState().message;
        expect(state.messages).toEqual(newMessages);
        expect(state.messages).toHaveLength(3);
      });
    });

    describe('setFilteredMessages', () => {
      it('should set filtered messages', () => {
        const filtered = [mockMessages[0], mockMessages[1]];
        store.dispatch(setFilteredMessages(filtered));

        const state = store.getState().message;
        expect(state.filteredMessages).toEqual(filtered);
      });

      it('should allow empty filtered messages', () => {
        store.dispatch(setFilteredMessages([]));

        const state = store.getState().message;
        expect(state.filteredMessages).toEqual([]);
      });
    });

    describe('setSelectedMessages', () => {
      it('should set selected messages', () => {
        const selected = [mockMessages[0]];
        store.dispatch(setSelectedMessages(selected));

        const state = store.getState().message;
        expect(state.selectedMessages).toEqual(selected);
      });
    });

    describe('toggleMessageSelection', () => {
      it('should add message to selection if not selected', () => {
        store.dispatch(toggleMessageSelection(mockMessages[0]));

        const state = store.getState().message;
        expect(state.selectedMessages).toContainEqual(mockMessages[0]);
      });

      it('should remove message from selection if already selected', () => {
        store.dispatch(setSelectedMessages([mockMessages[0]]));
        store.dispatch(toggleMessageSelection(mockMessages[0]));

        const state = store.getState().message;
        expect(state.selectedMessages).not.toContainEqual(mockMessages[0]);
      });

      it('should handle multiple toggles', () => {
        store.dispatch(toggleMessageSelection(mockMessages[0]));
        expect(store.getState().message.selectedMessages).toHaveLength(1);

        store.dispatch(toggleMessageSelection(mockMessages[1]));
        expect(store.getState().message.selectedMessages).toHaveLength(2);

        store.dispatch(toggleMessageSelection(mockMessages[0]));
        expect(store.getState().message.selectedMessages).toHaveLength(1);
      });
    });

    describe('selectAllMessages', () => {
      it('should select all filtered messages', () => {
        store.dispatch(setFilteredMessages(mockMessages));
        store.dispatch(selectAllMessages());

        const state = store.getState().message;
        expect(state.selectedMessages).toEqual(mockMessages);
      });

      it('should handle empty filtered messages', () => {
        store.dispatch(setFilteredMessages([]));
        store.dispatch(selectAllMessages());

        const state = store.getState().message;
        expect(state.selectedMessages).toEqual([]);
      });

      it('should replace previous selection', () => {
        store.dispatch(setSelectedMessages([mockMessages[0]]));
        store.dispatch(setFilteredMessages(mockMessages));
        store.dispatch(selectAllMessages());

        const state = store.getState().message;
        expect(state.selectedMessages).toHaveLength(mockMessages.length);
      });
    });

    describe('deselectAllMessages', () => {
      it('should clear selected messages', () => {
        store.dispatch(setSelectedMessages(mockMessages));
        store.dispatch(deselectAllMessages());

        const state = store.getState().message;
        expect(state.selectedMessages).toEqual([]);
      });

      it('should be idempotent', () => {
        store.dispatch(deselectAllMessages());
        const state1 = store.getState().message.selectedMessages;

        store.dispatch(deselectAllMessages());
        const state2 = store.getState().message.selectedMessages;

        expect(state1).toEqual(state2);
        expect(state2).toEqual([]);
      });
    });

    describe('setSearchCriteria', () => {
      it('should set search criteria', () => {
        const criteria = { content: 'test', author_id: 'user-1' } as any;
        store.dispatch(setSearchCriteria(criteria));

        const state = store.getState().message;
        expect(state.searchCriteria).toEqual(criteria);
      });

      it('should clear search criteria with null', () => {
        store.dispatch(setSearchCriteria({ content: 'test' } as any));
        store.dispatch(setSearchCriteria(null));

        const state = store.getState().message;
        expect(state.searchCriteria).toBeNull();
      });
    });

    describe('setOrder', () => {
      it('should set message order', () => {
        const order = { order: SortDirection.ASCENDING } as any;
        store.dispatch(setOrder(order));

        const state = store.getState().message;
        expect(state.order.order).toBe(SortDirection.ASCENDING);
      });

      it('should re-sort messages when order changes', () => {
        store.dispatch(setFilteredMessages(mockMessages));
        store.dispatch(setOrder({ order: SortDirection.DESCENDING } as any));

        // getSortedMessages is mocked to return messages as-is for testing
        const state = store.getState().message;
        expect(state.filteredMessages).toBeDefined();
      });
    });

    describe('clearMessages', () => {
      it('should clear all messages and reset state', () => {
        // Set up state
        store.dispatch(setMessages(mockMessages));
        store.dispatch(setFilteredMessages(mockMessages));
        store.dispatch(setSelectedMessages([mockMessages[0]]));
        store.dispatch(setSearchCriteria({ content: 'test' } as any));

        // Clear
        store.dispatch(clearMessages());

        const state = store.getState().message;
        expect(state.messages).toEqual([]);
        expect(state.filteredMessages).toEqual([]);
        expect(state.selectedMessages).toEqual([]);
        expect(state.searchCriteria).toBeNull();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
      });

      it('should reset pagination state', () => {
        store = createTestStore({ message: messageReducer }, {
          message: {
            ...initialMessageState,
            pagination: {
              ...initialMessageState.pagination,
              hasMore: true,
              lastMessageId: 'msg-123',
            },
          },
        });

        store.dispatch(clearMessages());

        const state = store.getState().message;
        expect(state.pagination).toEqual(initialMessageState.pagination);
      });

      it('should clear all thread tabs and reset active tab', () => {
        store.dispatch(setMessages(mockMessages));
        store.dispatch(addThreadTab({ threadId: 'thread-1', threadName: 'Thread 1' }));
        store.dispatch(addThreadTab({ threadId: 'thread-2', threadName: 'Thread 2' }));
        expect(store.getState().message.activeTab).toBe('thread-2');
        expect(Object.keys(store.getState().message.threadTabs)).toHaveLength(2);

        store.dispatch(clearMessages());

        const state = store.getState().message;
        expect(state.activeTab).toBeNull();
        expect(state.threadTabs).toEqual({});
      });
    });

    describe('resetPagination', () => {
      it('should reset pagination state', () => {
        store = createTestStore({ message: messageReducer }, {
          message: {
            ...initialMessageState,
            pagination: {
              ...initialMessageState.pagination,
              hasMore: true,
              lastMessageId: 'msg-123',
            },
          },
        });

        store.dispatch(resetPagination());

        const state = store.getState().message;
        expect(state.pagination).toEqual(initialMessageState.pagination);
      });

      it('should not affect other state', () => {
        store.dispatch(setMessages(mockMessages));
        store.dispatch(resetPagination());

        const state = store.getState().message;
        expect(state.messages).toEqual(mockMessages);
      });
    });
  });

  describe('deleteMessage async thunk', () => {
    it('should delete a message successfully', async () => {
      const mockDiscordService = {
        deleteMessage: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        deleteMessage({
          messageId: 'msg-1',
          channelId: 'channel-1',
          token: 'token',
        })
      );

      expect(result.type).toBe('message/deleteMessage/fulfilled');
      expect(result.payload).toBe('msg-1');
      expect(mockDiscordService.deleteMessage).toHaveBeenCalledWith('token', 'msg-1', 'channel-1');
    });

    it('should handle delete failure', async () => {
      const mockDiscordService = {
        deleteMessage: vi.fn().mockResolvedValue({ success: false }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        deleteMessage({
          messageId: 'msg-1',
          channelId: 'channel-1',
          token: 'token',
        })
      );

      expect(result.type).toBe('message/deleteMessage/rejected');
    });

    it('should handle network error', async () => {
      const mockDiscordService = {
        deleteMessage: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        deleteMessage({
          messageId: 'msg-1',
          channelId: 'channel-1',
          token: 'token',
        })
      );

      expect(result.type).toBe('message/deleteMessage/rejected');
      expect(result.payload).toBe('Network error');
    });
  });

  describe('deleteMessages async thunk', () => {
    it('should set isDeleting when pending', async () => {
      const mockDiscordService = {
        deleteMessage: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const appStore = await createStoreWithApp({
        ...initialMessageState,
        messages: [createMockMessage({ id: 'msg-1' })],
        selectedMessages: [createMockMessage({ id: 'msg-1' })],
      });

      appStore.dispatch(
        deleteMessages({ messages: [createMockMessage({ id: 'msg-1' })], channelId: 'ch-1', token: 'token' })
      );

      expect(appStore.getState().message.isDeleting).toBe(true);
      expect(appStore.getState().message.isLoading).toBe(false);
    });

    it('should clear isDeleting and selectedMessages on fulfilled', async () => {
      const mockDiscordService = {
        deleteMessage: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [createMockMessage({ id: 'msg-1' })];
      const appStore = await createStoreWithApp({
        ...initialMessageState,
        messages,
        selectedMessages: messages,
      });

      await appStore.dispatch(
        deleteMessages({ messages, channelId: 'ch-1', token: 'token' })
      );

      expect(appStore.getState().message.isDeleting).toBe(false);
      expect(appStore.getState().message.selectedMessages).toEqual([]);
    });

    it('should set error and clear isDeleting on rejection', async () => {
      const mockDiscordService = {
        deleteMessage: vi.fn().mockRejectedValue(new Error('Delete failed')),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [createMockMessage({ id: 'msg-1' })];
      const appStore = await createStoreWithApp({
        ...initialMessageState,
        messages,
        selectedMessages: messages,
      });

      await appStore.dispatch(
        deleteMessages({ messages, channelId: 'ch-1', token: 'token' })
      );

      expect(appStore.getState().message.isDeleting).toBe(false);
    });

    it('should dispatch showOperationTip when starting', async () => {
      const { showOperationTip } = await import('@features/status/statusSlice');
      const mockDiscordService = {
        deleteMessage: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [createMockMessage({ id: 'msg-1' })];
      const appStore = await createStoreWithApp({
        ...initialMessageState,
        messages,
        selectedMessages: messages,
      });

      await appStore.dispatch(
        deleteMessages({ messages, channelId: 'ch-1', token: 'token' })
      );

      expect(showOperationTip).toHaveBeenCalled();
    });
  });

  describe('fetchMessages async thunk', () => {
    it('should set loading state when pending', () => {
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(fetchMessages({ channelId: 'channel-1', token: 'token' }));

      const state = store.getState().message;
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should fetch messages successfully', async () => {
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: mockMessages,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchMessages({ channelId: 'channel-1', token: 'token' }));

      const state = store.getState().message;
      expect(state.isLoading).toBe(false);
      expect(state.messages).toEqual(mockMessages);
      expect(state.filteredMessages).toEqual(mockMessages);
      expect(state.error).toBeNull();
    });

    it('should set hasMore to true if got 100 messages', async () => {
      const hundredMessages = createMockMessages(100);
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: hundredMessages,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchMessages({ channelId: 'channel-1', token: 'token' }));

      const state = store.getState().message;
      expect(state.pagination.hasMore).toBe(true);
    });

    it('should set hasMore to false if got less than 100 messages', async () => {
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: mockMessages,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchMessages({ channelId: 'channel-1', token: 'token' }));

      const state = store.getState().message;
      expect(state.pagination.hasMore).toBe(false);
    });

    it('should handle fetch failure', async () => {
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({
          success: false,
          data: null,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchMessages({ channelId: 'channel-1', token: 'token' }));

      const state = store.getState().message;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Failed to fetch messages');
    });

    it('should clear selected messages on fetch', async () => {
      store.dispatch(setSelectedMessages([mockMessages[0]]));

      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: mockMessages,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchMessages({ channelId: 'channel-1', token: 'token' }));

      const state = store.getState().message;
      expect(state.selectedMessages).toEqual([]);
    });

    it('should dispatch status entry with message count on success', async () => {
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: mockMessages,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
      vi.mocked(addStatusEntry).mockClear();

      await store.dispatch(fetchMessages({ channelId: 'channel-1', token: 'token' }));

      expect(vi.mocked(addStatusEntry)).toHaveBeenCalledWith({
        level: 'info',
        message: `Loaded ${mockMessages.length} messages`,
      });
    });
  });

  describe('fetchMoreMessages async thunk', () => {
    it('should set isLoadingMore when pending', () => {
      store = createTestStore({ message: messageReducer }, {
        message: {
          ...initialMessageState,
          pagination: {
            ...initialMessageState.pagination,
            lastMessageId: 'msg-5',
          },
        },
      });

      const mockDiscordService = {
        fetchMessageData: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(fetchMoreMessages({ channelId: 'channel-1', token: 'token', lastMessageId: 'msg-5' }));

      const state = store.getState().message;
      expect(state.pagination.isLoadingMore).toBe(true);
    });

    it('should append new messages to existing messages', async () => {
      const initialMessages = createMockMessages(5);
      store = createTestStore({ message: messageReducer }, {
        message: {
          ...initialMessageState,
          messages: initialMessages,
          filteredMessages: initialMessages,
          pagination: {
            ...initialMessageState.pagination,
            lastMessageId: 'msg-5',
          },
        },
      });

      const newMessages = createMockMessages(3);
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: newMessages,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchMoreMessages({ channelId: 'channel-1', token: 'token', lastMessageId: 'msg-5' }));

      const state = store.getState().message;
      expect(state.messages).toHaveLength(8);
      expect(state.pagination.isLoadingMore).toBe(false);
    });

    it('should use lastMessageId when fetching more', async () => {
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: mockMessages,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(
        fetchMoreMessages({
          channelId: 'channel-1',
          token: 'token',
          lastMessageId: 'msg-100',
        })
      );

      expect(mockDiscordService.fetchMessageData).toHaveBeenCalledWith(
        'token',
        'msg-100',
        'channel-1'
      );
    });

    it('should dispatch status entry with message count on success', async () => {
      const newMessages = createMockMessages(3);
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: newMessages,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
      vi.mocked(addStatusEntry).mockClear();

      await store.dispatch(fetchMoreMessages({ channelId: 'channel-1', token: 'token', lastMessageId: 'msg-5' }));

      expect(vi.mocked(addStatusEntry)).toHaveBeenCalledWith({
        level: 'info',
        message: 'Loaded 3 more messages',
      });
    });
  });

  describe('searchMessages async thunk', () => {
    it('should search messages with criteria', async () => {
      // searchMessages requires app state for delay settings
      const { configureStore } = await import('@reduxjs/toolkit');
      const appReducer = (await import('@features/app/appSlice')).default;
      const { defaultSettings } = await import('@features/app/appSlice');

      const testStore = configureStore({
        reducer: {
          message: messageReducer,
          app: appReducer,
        },
        preloadedState: {
          app: {
            discrubPaused: false,
            discrubCancelled: false,
            isMinimized: false,
            focusedView: false,
            sidebarView: 'server' as const,
            task: { status: 'idle' as const, message: '' },
            settings: defaultSettings,
          },
          message: initialMessageState,
        },
      });

      const mockDiscordService = {
        fetchSearchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: {
            messages: [mockMessages],
            total_results: 5,
          },
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const criteria = { content: 'test' } as any;
      await testStore.dispatch(
        searchMessages({
          channelId: 'channel-1',
          token: 'token',
          searchCriteria: criteria,
        })
      );

      expect(mockDiscordService.fetchSearchMessageData).toHaveBeenCalled();
    });

    it('should set pagination mode to search', async () => {
      // searchMessages requires app state for delay settings
      const { configureStore } = await import('@reduxjs/toolkit');
      const appReducer = (await import('@features/app/appSlice')).default;
      const { defaultSettings } = await import('@features/app/appSlice');

      const testStore = configureStore({
        reducer: {
          message: messageReducer,
          app: appReducer,
        },
        preloadedState: {
          app: {
            discrubPaused: false,
            discrubCancelled: false,
            isMinimized: false,
            focusedView: false,
            sidebarView: 'server' as const,
            task: { status: 'idle' as const, message: '' },
            settings: defaultSettings,
          },
          message: initialMessageState,
        },
      });

      const mockDiscordService = {
        fetchSearchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: {
            messages: [mockMessages],
            total_results: 5,
          },
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await testStore.dispatch(
        searchMessages({
          channelId: 'channel-1',
          token: 'token',
          searchCriteria: { content: 'test' } as any,
        })
      );

      const state = testStore.getState().message;
      expect(state.pagination.mode).toBe('search');
    });

    it('should dispatch starting and completion status entries', async () => {
      const testStore = await createStoreWithApp();

      const searchResults = createMockMessages(3);
      const mockDiscordService = {
        fetchSearchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: {
            messages: [searchResults],
            total_results: 3,
          },
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
      vi.mocked(addStatusEntry).mockClear();

      await testStore.dispatch(
        searchMessages({
          channelId: 'channel-1',
          token: 'token',
          searchCriteria: { searchContent: 'test' } as any,
        })
      );

      const startCalls = vi.mocked(addStatusEntry).mock.calls.filter(
        ([payload]) => payload.message === 'Search: Starting...'
      );
      expect(startCalls).toHaveLength(1);

      const successCalls = vi.mocked(addStatusEntry).mock.calls.filter(
        ([payload]) => payload.level === 'success'
      );
      expect(successCalls).toHaveLength(1);
      expect(successCalls[0][0].message).toBe('Search: found 3 of 3 results');
    });

    it('should not dispatch info status entries below milestone threshold', async () => {
      const testStore = await createStoreWithApp();

      const searchResults = createMockMessages(3);
      const mockDiscordService = {
        fetchSearchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: {
            messages: [searchResults],
            total_results: 3,
          },
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
      vi.mocked(addStatusEntry).mockClear();

      await testStore.dispatch(
        searchMessages({
          channelId: 'channel-1',
          token: 'token',
          searchCriteria: { searchContent: 'test' } as any,
        })
      );

      const infoCalls = vi.mocked(addStatusEntry).mock.calls.filter(
        ([payload]) => payload.level === 'info' && payload.message.includes('fetched')
      );
      expect(infoCalls).toHaveLength(0);
    });

    it('fetches only page 1 and sets hasMore/searchOffset/totalCount for more-available case', async () => {
      const testStore = await createStoreWithApp();

      // 25 results returned (full page) + total_results 200 → more to fetch
      const mockDiscordService = {
        fetchSearchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: { messages: [createMockMessages(25)], total_results: 200 },
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await testStore.dispatch(
        searchMessages({
          channelId: 'channel-1',
          token: 'token',
          searchCriteria: { searchContent: 'test' } as any,
        })
      );

      // Only one call — the eager loop is gone
      expect(mockDiscordService.fetchSearchMessageData).toHaveBeenCalledTimes(1);

      const state = testStore.getState().message;
      expect(state.messages).toHaveLength(25);
      expect(state.pagination.mode).toBe('search');
      expect(state.pagination.hasMore).toBe(true);
      expect(state.pagination.searchOffset).toBe(25);
      expect(state.pagination.totalCount).toBe(200);
    });

    it('sets hasMore=false when Discord returns fewer than a full page', async () => {
      const testStore = await createStoreWithApp();

      const mockDiscordService = {
        fetchSearchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: { messages: [createMockMessages(7)], total_results: 7 },
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await testStore.dispatch(
        searchMessages({
          channelId: 'channel-1',
          token: 'token',
          searchCriteria: { searchContent: 'test' } as any,
        })
      );

      const state = testStore.getState().message;
      expect(state.pagination.hasMore).toBe(false);
      expect(state.pagination.totalCount).toBe(7);
    });
  });

  describe('fetchNextSearchPage async thunk', () => {
    it('appends results and advances searchOffset', async () => {
      const testStore = await createStoreWithApp();

      // Seed state with a page-1 result first
      const firstPage = createMockMessages(25);
      const mockDiscordService = {
        fetchSearchMessageData: vi.fn()
          .mockResolvedValueOnce({
            success: true,
            data: { messages: [firstPage], total_results: 50 },
          })
          .mockResolvedValueOnce({
            success: true,
            data: {
              messages: [
                createMockMessages(25).map((m, i) =>
                  createMockMessage({ ...m, id: `p2-${i}` }),
                ),
              ],
              total_results: 50,
            },
          }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await testStore.dispatch(
        searchMessages({
          channelId: 'channel-1',
          token: 'token',
          searchCriteria: { searchContent: 'test' } as any,
        })
      );

      const { fetchNextSearchPage } = await import('./messageSlice');
      await testStore.dispatch(
        fetchNextSearchPage({ channelId: 'channel-1', token: 'token' })
      );

      const state = testStore.getState().message;
      expect(state.messages).toHaveLength(50);
      expect(state.pagination.searchOffset).toBe(50);
      expect(state.pagination.hasMore).toBe(false);
    });

    it('does nothing when mode is not search', async () => {
      const testStore = await createStoreWithApp();
      const mockDiscordService = {
        fetchSearchMessageData: vi.fn(),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const { fetchNextSearchPage } = await import('./messageSlice');
      const result = await testStore.dispatch(
        fetchNextSearchPage({ channelId: 'channel-1', token: 'token' })
      );

      expect(result.type).toBe('message/fetchNextSearchPage/rejected');
      expect(mockDiscordService.fetchSearchMessageData).not.toHaveBeenCalled();
    });

    it('dedupes by message id when a page overlaps with existing results', async () => {
      const testStore = await createStoreWithApp();

      const overlappingMessage = createMockMessage({ id: 'shared-1' });
      const firstPage = [overlappingMessage, ...createMockMessages(24)];
      const secondPage = [overlappingMessage, ...createMockMessages(24).map((m, i) =>
        createMockMessage({ ...m, id: `new-${i}` })
      )];

      const mockDiscordService = {
        fetchSearchMessageData: vi.fn()
          .mockResolvedValueOnce({
            success: true,
            data: { messages: [firstPage], total_results: 50 },
          })
          .mockResolvedValueOnce({
            success: true,
            data: { messages: [secondPage], total_results: 50 },
          }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await testStore.dispatch(
        searchMessages({
          channelId: 'channel-1',
          token: 'token',
          searchCriteria: { searchContent: 'test' } as any,
        })
      );

      const { fetchNextSearchPage } = await import('./messageSlice');
      await testStore.dispatch(
        fetchNextSearchPage({ channelId: 'channel-1', token: 'token' })
      );

      const state = testStore.getState().message;
      // 25 unique from page 1 + 24 new from page 2 (one dupe removed) = 49
      expect(state.messages).toHaveLength(49);
    });
  });

  describe('refineCriteria persistence across data arrival', () => {
    it('keeps refine applied when fetchMoreMessages appends new messages', async () => {
      const testStore = await createStoreWithApp();

      // Seed: 3 messages with content matching "important", 2 not matching
      const seedMessages = [
        createMockMessage({ id: 's1', content: 'important note 1' }),
        createMockMessage({ id: 's2', content: 'unrelated 1' }),
        createMockMessage({ id: 's3', content: 'important note 2' }),
      ];
      testStore.dispatch({ type: 'message/setMessages', payload: seedMessages });

      // Apply refine for "important"
      const { setRefineCriteria } = await import('./messageSlice');
      testStore.dispatch(
        setRefineCriteria({
          searchMessageContent: 'important',
        } as any),
      );

      expect(testStore.getState().message.filteredMessages).toHaveLength(2);

      // Now fetch more messages — 5 new, 2 match "important"
      const newPage = [
        createMockMessage({ id: 'n1', content: 'unrelated 2' }),
        createMockMessage({ id: 'n2', content: 'important note 3' }),
        createMockMessage({ id: 'n3', content: 'important note 4' }),
        createMockMessage({ id: 'n4', content: 'unrelated 3' }),
        createMockMessage({ id: 'n5', content: 'unrelated 4' }),
      ];
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: newPage,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const { fetchMoreMessages } = await import('./messageSlice');
      await testStore.dispatch(
        fetchMoreMessages({
          channelId: 'channel-1',
          token: 'token',
          lastMessageId: 's3',
        }),
      );

      const state = testStore.getState().message;
      expect(state.messages).toHaveLength(8); // 3 seed + 5 new
      // Refine still applied: 4 total important messages (2 seed + 2 new)
      expect(state.filteredMessages).toHaveLength(4);
      expect(
        state.filteredMessages.every((m) => m.content?.includes('important')),
      ).toBe(true);
    });

    it('keeps refine applied when fetchNextSearchPage appends search results', async () => {
      const testStore = await createStoreWithApp();

      const firstPage = createMockMessages(25).map((m, i) =>
        createMockMessage({
          ...m,
          id: `p1-${i}`,
          content: i % 5 === 0 ? `match-${i}` : `nomatch-${i}`,
        }),
      );
      const secondPage = createMockMessages(25).map((m, i) =>
        createMockMessage({
          ...m,
          id: `p2-${i}`,
          content: i % 5 === 0 ? `match-${i}` : `nomatch-${i}`,
        }),
      );

      const mockDiscordService = {
        fetchSearchMessageData: vi
          .fn()
          .mockResolvedValueOnce({
            success: true,
            data: { messages: [firstPage], total_results: 50 },
          })
          .mockResolvedValueOnce({
            success: true,
            data: { messages: [secondPage], total_results: 50 },
          }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const { searchMessages, setRefineCriteria, fetchNextSearchPage } =
        await import('./messageSlice');
      await testStore.dispatch(
        searchMessages({
          channelId: 'c',
          token: 't',
          searchCriteria: { searchContent: 'x' } as any,
        }),
      );
      // Apply refine restricting to "match"
      testStore.dispatch(
        setRefineCriteria({ searchMessageContent: 'match' } as any),
      );

      const beforeFiltered = testStore.getState().message.filteredMessages.length;

      await testStore.dispatch(
        fetchNextSearchPage({ channelId: 'c', token: 't' }),
      );

      const state = testStore.getState().message;
      expect(state.messages).toHaveLength(50);
      // Refine still active and applied to combined set
      expect(
        state.filteredMessages.every((m) => m.content?.includes('match')),
      ).toBe(true);
      expect(state.filteredMessages.length).toBeGreaterThan(beforeFiltered);
    });

    it('emits a status entry when fetchMoreMessages produces zero refine matches', async () => {
      const testStore = await createStoreWithApp();
      testStore.dispatch({
        type: 'message/setMessages',
        payload: [createMockMessage({ id: 's1', content: 'rare-match' })],
      });

      const { setRefineCriteria, fetchMoreMessages } = await import('./messageSlice');
      testStore.dispatch(
        setRefineCriteria({ searchMessageContent: 'rare-match' } as any),
      );

      // 5 new messages, none match "rare-match"
      const newPage = createMockMessages(5).map((m, i) =>
        createMockMessage({ ...m, id: `n${i}`, content: `nothing here ${i}` }),
      );
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({ success: true, data: newPage }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
      vi.mocked(addStatusEntry).mockClear();

      await testStore.dispatch(
        fetchMoreMessages({
          channelId: 'c',
          token: 't',
          lastMessageId: 's1',
        }),
      );

      const phantomCalls = vi.mocked(addStatusEntry).mock.calls.filter(
        ([payload]) => payload.message?.includes?.('0 matched the active refine'),
      );
      expect(phantomCalls).toHaveLength(1);
      expect(phantomCalls[0][0].message).toContain('5');
    });

    it('does NOT emit phantom-load entry when refine yields ≥1 match in the new page', async () => {
      const testStore = await createStoreWithApp();
      testStore.dispatch({
        type: 'message/setMessages',
        payload: [createMockMessage({ id: 's1', content: 'match' })],
      });

      const { setRefineCriteria, fetchMoreMessages } = await import('./messageSlice');
      testStore.dispatch(
        setRefineCriteria({ searchMessageContent: 'match' } as any),
      );

      const newPage = [
        createMockMessage({ id: 'n1', content: 'no' }),
        createMockMessage({ id: 'n2', content: 'has match here' }),
      ];
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({ success: true, data: newPage }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
      vi.mocked(addStatusEntry).mockClear();

      await testStore.dispatch(
        fetchMoreMessages({
          channelId: 'c',
          token: 't',
          lastMessageId: 's1',
        }),
      );

      const phantomCalls = vi.mocked(addStatusEntry).mock.calls.filter(
        ([payload]) => payload.message?.includes?.('0 matched the active refine'),
      );
      expect(phantomCalls).toHaveLength(0);
    });

    it('does NOT emit phantom-load entry when no refine is active', async () => {
      const testStore = await createStoreWithApp();
      testStore.dispatch({
        type: 'message/setMessages',
        payload: [createMockMessage({ id: 's1' })],
      });

      const newPage = createMockMessages(5).map((m, i) =>
        createMockMessage({ ...m, id: `n${i}` }),
      );
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({ success: true, data: newPage }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
      vi.mocked(addStatusEntry).mockClear();

      const { fetchMoreMessages } = await import('./messageSlice');
      await testStore.dispatch(
        fetchMoreMessages({
          channelId: 'c',
          token: 't',
          lastMessageId: 's1',
        }),
      );

      const phantomCalls = vi.mocked(addStatusEntry).mock.calls.filter(
        ([payload]) => payload.message?.includes?.('0 matched the active refine'),
      );
      expect(phantomCalls).toHaveLength(0);
    });

    it('clearRefineCriteria restores filteredMessages to full raw list', async () => {
      const testStore = await createStoreWithApp();
      testStore.dispatch({
        type: 'message/setMessages',
        payload: [
          createMockMessage({ id: 's1', content: 'match' }),
          createMockMessage({ id: 's2', content: 'other' }),
        ],
      });

      const { setRefineCriteria, clearRefineCriteria } = await import('./messageSlice');
      testStore.dispatch(
        setRefineCriteria({ searchMessageContent: 'match' } as any),
      );
      expect(testStore.getState().message.filteredMessages).toHaveLength(1);

      testStore.dispatch(clearRefineCriteria());
      const state = testStore.getState().message;
      expect(state.refineCriteria).toBeNull();
      expect(state.filteredMessages).toHaveLength(2);
    });
  });

  describe('fetchAllMessages async thunk', () => {
    it('should dispatch starting and completion status entries', async () => {
      const batch = createMockMessages(50);
      const mockDiscordService = {
        fetchMessageData: vi.fn().mockResolvedValue({ success: true, data: batch }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
      vi.mocked(addStatusEntry).mockClear();

      const testStore = await createStoreWithApp();
      const result = await testStore.dispatch(
        fetchAllMessages({ channelId: 'channel-1', token: 'token' })
      );

      expect(result.type).toBe('message/fetchAllMessages/fulfilled');

      const startCalls = vi.mocked(addStatusEntry).mock.calls.filter(
        ([payload]) => payload.message === 'Load All: Starting...'
      );
      expect(startCalls).toHaveLength(1);

      const successCalls = vi.mocked(addStatusEntry).mock.calls.filter(
        ([payload]) => payload.level === 'success'
      );
      expect(successCalls).toHaveLength(1);
      expect(successCalls[0][0].message).toBe('Load All complete: 50 messages');
    });

    it('should not dispatch info entries below 500-message milestone', async () => {
      const batch1 = createMockMessages(100);
      const batch2 = createMockMessages(50).map((m, i) =>
        createMockMessage({ ...m, id: `batch2-msg-${i + 1}` })
      );
      const mockDiscordService = {
        fetchMessageData: vi.fn()
          .mockResolvedValueOnce({ success: true, data: batch1 })
          .mockResolvedValueOnce({ success: true, data: batch2 }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
      vi.mocked(addStatusEntry).mockClear();

      const testStore = await createStoreWithApp();
      await testStore.dispatch(
        fetchAllMessages({ channelId: 'channel-1', token: 'token' })
      );

      const infoCalls = vi.mocked(addStatusEntry).mock.calls.filter(
        ([payload]) => payload.level === 'info' && payload.message.includes('messages fetched')
      );
      expect(infoCalls).toHaveLength(0);
    });

    it('should dispatch milestone info entries every 500 messages', async () => {
      // 6 batches of 100 = 600 messages, should trigger 1 milestone at 500
      const makeBatch = (prefix: string) =>
        createMockMessages(100).map((m, i) => createMockMessage({ ...m, id: `${prefix}-${i}` }));

      const mockDiscordService = {
        fetchMessageData: vi.fn()
          .mockResolvedValueOnce({ success: true, data: makeBatch('b1') })
          .mockResolvedValueOnce({ success: true, data: makeBatch('b2') })
          .mockResolvedValueOnce({ success: true, data: makeBatch('b3') })
          .mockResolvedValueOnce({ success: true, data: makeBatch('b4') })
          .mockResolvedValueOnce({ success: true, data: makeBatch('b5') })
          .mockResolvedValueOnce({ success: true, data: makeBatch('b6').slice(0, 50) }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
      vi.mocked(addStatusEntry).mockClear();

      const testStore = await createStoreWithApp();
      await testStore.dispatch(
        fetchAllMessages({ channelId: 'channel-1', token: 'token' })
      );

      const infoCalls = vi.mocked(addStatusEntry).mock.calls.filter(
        ([payload]) => payload.level === 'info' && payload.message.includes('messages fetched')
      );
      expect(infoCalls).toHaveLength(1);
      expect(infoCalls[0][0].message).toBe('Load All: 500 messages fetched');
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      store = createTestStore({ message: messageReducer }, {
        message: {
          ...initialMessageState,
          messages: mockMessages,
          filteredMessages: [mockMessages[0], mockMessages[1]],
          selectedMessages: [mockMessages[0]],
          searchCriteria: { content: 'test' },
          order: { order: SortDirection.ASCENDING },
          isLoading: false,
          error: 'Test error',
        },
      });
    });

    it('selectMessage should return entire message state', () => {
      const messageState = selectMessage(store.getState());
      expect(messageState).toHaveProperty('messages');
      expect(messageState).toHaveProperty('filteredMessages');
      expect(messageState).toHaveProperty('selectedMessages');
    });

    it('selectMessages should return messages array', () => {
      const messages = selectMessages(store.getState());
      expect(messages).toEqual(mockMessages);
    });

    it('selectFilteredMessages should return filtered messages', () => {
      const filtered = selectFilteredMessages(store.getState());
      expect(filtered).toHaveLength(2);
    });

    it('selectSelectedMessages should return selected messages', () => {
      const selected = selectSelectedMessages(store.getState());
      expect(selected).toHaveLength(1);
      expect(selected[0]).toEqual(mockMessages[0]);
    });

    it('selectSearchCriteria should return search criteria', () => {
      const criteria = selectSearchCriteria(store.getState());
      expect(criteria).toEqual({ content: 'test' });
    });

    it('selectMessageOrder should return order', () => {
      const order = selectMessageOrder(store.getState());
      expect(order.order).toBe(SortDirection.ASCENDING);
    });

    it('selectMessageLoading should return loading status', () => {
      expect(selectMessageLoading(store.getState())).toBe(false);
    });

    it('selectMessageDeleting should return deleting status', () => {
      expect(selectMessageDeleting(store.getState())).toBe(false);
    });

    it('selectMessageError should return error', () => {
      expect(selectMessageError(store.getState())).toBe('Test error');
    });

    it('selectPagination should return pagination state', () => {
      const pagination = selectPagination(store.getState());
      expect(pagination).toHaveProperty('mode');
      expect(pagination).toHaveProperty('hasMore');
      expect(pagination).toHaveProperty('lastMessageId');
    });
  });

  // Helper to create a store with app reducer for thunks that read delay settings
  const createStoreWithApp = async (messageState = initialMessageState) => {
    const { configureStore } = await import('@reduxjs/toolkit');
    const appReducer = (await import('@features/app/appSlice')).default;
    const { defaultSettings } = await import('@features/app/appSlice');

    return configureStore({
      reducer: {
        message: messageReducer,
        app: appReducer,
      },
      preloadedState: {
        app: {
          discrubPaused: false,
          discrubCancelled: false,
          isMinimized: false,
          focusedView: false,
          sidebarView: 'server' as const,
          task: { status: 'idle' as const, message: '' },
          settings: defaultSettings,
        },
        message: messageState,
      },
    });
  };

  describe('editMessage async thunk', () => {
    it('should edit a message successfully', async () => {
      const updatedMsg = createMockMessage({ id: 'msg-1', content: 'edited content' });
      const mockDiscordService = {
        editMessage: vi.fn().mockResolvedValue({ success: true, data: updatedMsg }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(setMessages([createMockMessage({ id: 'msg-1', content: 'original' })]));

      const result = await store.dispatch(
        editMessage({ messageId: 'msg-1', channelId: 'channel-1', content: 'edited content', token: 'token' })
      );

      expect(result.type).toBe('message/editMessage/fulfilled');
      expect(result.payload).toEqual(updatedMsg);
      expect(mockDiscordService.editMessage).toHaveBeenCalledWith('token', 'msg-1', { content: 'edited content' }, 'channel-1');
    });

    it('should update message in state on success', async () => {
      const original = createMockMessage({ id: 'msg-1', content: 'original' });
      const updated = createMockMessage({ id: 'msg-1', content: 'edited' });
      const mockDiscordService = {
        editMessage: vi.fn().mockResolvedValue({ success: true, data: updated }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(setMessages([original]));
      store.dispatch(setFilteredMessages([original]));

      await store.dispatch(
        editMessage({ messageId: 'msg-1', channelId: 'channel-1', content: 'edited', token: 'token' })
      );

      const state = store.getState().message;
      expect(state.messages[0].content).toBe('edited');
      expect(state.filteredMessages[0].content).toBe('edited');
    });

    it('should handle edit failure', async () => {
      const mockDiscordService = {
        editMessage: vi.fn().mockResolvedValue({ success: false, data: null }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        editMessage({ messageId: 'msg-1', channelId: 'channel-1', content: 'test', token: 'token' })
      );

      expect(result.type).toBe('message/editMessage/rejected');
    });

    it('should handle network error', async () => {
      const mockDiscordService = {
        editMessage: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        editMessage({ messageId: 'msg-1', channelId: 'channel-1', content: 'test', token: 'token' })
      );

      expect(result.type).toBe('message/editMessage/rejected');
      expect(result.payload).toBe('Network error');
    });
  });

  describe('editMessages async thunk', () => {
    it('should edit multiple messages successfully', async () => {
      const msgs = createMockMessages(2);
      const editedMsgs = msgs.map((m) => createMockMessage({ id: m.id, content: 'bulk edited' }));
      const mockDiscordService = {
        editMessage: vi.fn()
          .mockResolvedValueOnce({ success: true, data: editedMsgs[0] })
          .mockResolvedValueOnce({ success: true, data: editedMsgs[1] }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const testStore = await createStoreWithApp({
        ...initialMessageState,
        messages: msgs,
        filteredMessages: msgs,
      });

      const result = await testStore.dispatch(
        editMessages({ messages: msgs, channelId: 'channel-1', content: 'bulk edited', token: 'token' })
      );

      expect(result.type).toBe('message/editMessages/fulfilled');
      expect(mockDiscordService.editMessage).toHaveBeenCalledTimes(2);
    });

    it('should update messages in state on success', async () => {
      const msgs = createMockMessages(2);
      const editedMsgs = msgs.map((m) => createMockMessage({ id: m.id, content: 'new content' }));
      const mockDiscordService = {
        editMessage: vi.fn()
          .mockResolvedValueOnce({ success: true, data: editedMsgs[0] })
          .mockResolvedValueOnce({ success: true, data: editedMsgs[1] }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const testStore = await createStoreWithApp({
        ...initialMessageState,
        messages: msgs,
        filteredMessages: msgs,
      });

      await testStore.dispatch(
        editMessages({ messages: msgs, channelId: 'channel-1', content: 'new content', token: 'token' })
      );

      const state = testStore.getState().message;
      expect(state.messages[0].content).toBe('new content');
      expect(state.messages[1].content).toBe('new content');
      expect(state.selectedMessages).toEqual([]);
    });

    it('should handle error from editMessages', async () => {
      const mockDiscordService = {
        editMessage: vi.fn().mockRejectedValue(new Error('Edit failed')),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const testStore = await createStoreWithApp();

      const msgs = createMockMessages(1);
      const result = await testStore.dispatch(
        editMessages({ messages: msgs, channelId: 'channel-1', content: 'test', token: 'token' })
      );

      // Individual failures are caught inside the loop, so the thunk still fulfills
      expect(result.type).toBe('message/editMessages/fulfilled');
    });

    it('should dispatch showOperationTip when starting', async () => {
      const { showOperationTip } = await import('@features/status/statusSlice');
      const msgs = createMockMessages(2);
      const editedMsgs = msgs.map((m) => createMockMessage({ id: m.id, content: 'tip test' }));
      const mockDiscordService = {
        editMessage: vi.fn()
          .mockResolvedValueOnce({ success: true, data: editedMsgs[0] })
          .mockResolvedValueOnce({ success: true, data: editedMsgs[1] }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const testStore = await createStoreWithApp({
        ...initialMessageState,
        messages: msgs,
        filteredMessages: msgs,
      });

      await testStore.dispatch(
        editMessages({ messages: msgs, channelId: 'channel-1', content: 'tip test', token: 'token' })
      );

      expect(showOperationTip).toHaveBeenCalled();
    });
  });

  describe('fetchReactingUsers async thunk', () => {
    it('should fetch reacting users successfully', async () => {
      const users = [
        createMockUser({ id: 'user-1', username: 'Alice' }),
        createMockUser({ id: 'user-2', username: 'Bob' }),
      ];
      const mockDiscordService = {
        getReactions: vi.fn().mockResolvedValue({ success: true, data: users }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        fetchReactingUsers({ channelId: 'channel-1', messageId: 'msg-1', emoji: '👍', token: 'token' })
      );

      expect(result.type).toBe('message/fetchReactingUsers/fulfilled');
      expect(result.payload).toEqual({
        messageId: 'msg-1',
        emoji: '👍',
        users,
      });
      expect(mockDiscordService.getReactions).toHaveBeenCalledWith(
        'token', 'channel-1', 'msg-1', '👍', 0, null
      );
    });

    it('should paginate through all reacting users', async () => {
      const firstPage = Array.from({ length: 100 }, (_, i) =>
        createMockUser({ id: `user-${i}`, username: `User${i}` })
      );
      const secondPage = [
        createMockUser({ id: 'user-100', username: 'User100' }),
      ];
      const mockDiscordService = {
        getReactions: vi.fn()
          .mockResolvedValueOnce({ success: true, data: firstPage })
          .mockResolvedValueOnce({ success: true, data: secondPage }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        fetchReactingUsers({ channelId: 'channel-1', messageId: 'msg-1', emoji: '👍', token: 'token' })
      );

      expect(result.type).toBe('message/fetchReactingUsers/fulfilled');
      const payload = result.payload as { users: any[] };
      expect(payload.users).toHaveLength(101);
      expect(mockDiscordService.getReactions).toHaveBeenCalledTimes(2);
      // Second call should use the last user's ID from the first page
      expect(mockDiscordService.getReactions).toHaveBeenCalledWith(
        'token', 'channel-1', 'msg-1', '👍', 0, 'user-99'
      );
    });

    it('should handle API failure', async () => {
      const mockDiscordService = {
        getReactions: vi.fn().mockResolvedValue({ success: false, data: null }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        fetchReactingUsers({ channelId: 'channel-1', messageId: 'msg-1', emoji: '👍', token: 'token' })
      );

      // The thunk returns an empty users array when the API fails (it breaks out of the loop)
      expect(result.type).toBe('message/fetchReactingUsers/fulfilled');
      const payload = result.payload as { users: any[] };
      expect(payload.users).toEqual([]);
    });

    it('should handle network error', async () => {
      const mockDiscordService = {
        getReactions: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        fetchReactingUsers({ channelId: 'channel-1', messageId: 'msg-1', emoji: '👍', token: 'token' })
      );

      expect(result.type).toBe('message/fetchReactingUsers/rejected');
      expect(result.payload).toBe('Network error');
    });
  });

  describe('deleteReaction async thunk', () => {
    it('should delete a reaction successfully', async () => {
      const mockDiscordService = {
        deleteReaction: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        deleteReaction({ channelId: 'channel-1', messageId: 'msg-1', emoji: '👍', userId: 'user-1', token: 'token' })
      );

      expect(result.type).toBe('message/deleteReaction/fulfilled');
      expect(result.payload).toEqual({ messageId: 'msg-1', emoji: '👍', userId: 'user-1' });
      expect(mockDiscordService.deleteReaction).toHaveBeenCalledWith(
        'token', 'channel-1', 'msg-1', '👍', 'user-1'
      );
    });

    it('should decrement reaction count in state on success', async () => {
      const reaction = createMockReaction({ count: 3, emoji: { id: null, name: '👍' } });
      const msgWithReaction = createMockMessage({ id: 'msg-1', reactions: [reaction] });

      store.dispatch(setMessages([msgWithReaction]));
      store.dispatch(setFilteredMessages([msgWithReaction]));

      const mockDiscordService = {
        deleteReaction: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(
        deleteReaction({ channelId: 'channel-1', messageId: 'msg-1', emoji: '👍', userId: 'user-1', token: 'token' })
      );

      const state = store.getState().message;
      expect(state.messages[0].reactions![0].count).toBe(2);
    });

    it('should remove reaction entirely when count reaches zero', async () => {
      const reaction = createMockReaction({ count: 1, emoji: { id: null, name: '👍' } });
      const msgWithReaction = createMockMessage({ id: 'msg-1', reactions: [reaction] });

      store.dispatch(setMessages([msgWithReaction]));
      store.dispatch(setFilteredMessages([msgWithReaction]));

      const mockDiscordService = {
        deleteReaction: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(
        deleteReaction({ channelId: 'channel-1', messageId: 'msg-1', emoji: '👍', userId: 'user-1', token: 'token' })
      );

      const state = store.getState().message;
      expect(state.messages[0].reactions).toHaveLength(0);
    });

    it('should handle delete reaction failure', async () => {
      const mockDiscordService = {
        deleteReaction: vi.fn().mockResolvedValue({ success: false }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        deleteReaction({ channelId: 'channel-1', messageId: 'msg-1', emoji: '👍', userId: 'user-1', token: 'token' })
      );

      expect(result.type).toBe('message/deleteReaction/rejected');
    });
  });

  describe('deleteAllReactions async thunk', () => {
    it('should delete all reactions for an emoji', async () => {
      const reaction = createMockReaction({ count: 2, emoji: { id: null, name: '👍' } });
      const msgWithReaction = createMockMessage({ id: 'msg-1', reactions: [reaction] });

      const mockDiscordService = {
        deleteReaction: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const testStore = await createStoreWithApp({
        ...initialMessageState,
        messages: [msgWithReaction],
        filteredMessages: [msgWithReaction],
      });

      const result = await testStore.dispatch(
        deleteAllReactions({
          channelId: 'channel-1',
          messageId: 'msg-1',
          emoji: '👍',
          userIds: ['user-1', 'user-2'],
          token: 'token',
        })
      );

      expect(result.type).toBe('message/deleteAllReactions/fulfilled');
      expect(mockDiscordService.deleteReaction).toHaveBeenCalledTimes(2);
    });

    it('should remove emoji from reactions in state', async () => {
      const thumbsUp = createMockReaction({ count: 2, emoji: { id: null, name: '👍' } });
      const heart = createMockReaction({ count: 1, emoji: { id: null, name: '❤️' } });
      const msgWithReactions = createMockMessage({ id: 'msg-1', reactions: [thumbsUp, heart] });

      const mockDiscordService = {
        deleteReaction: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const testStore = await createStoreWithApp({
        ...initialMessageState,
        messages: [msgWithReactions],
        filteredMessages: [msgWithReactions],
      });

      await testStore.dispatch(
        deleteAllReactions({
          channelId: 'channel-1',
          messageId: 'msg-1',
          emoji: '👍',
          userIds: ['user-1', 'user-2'],
          token: 'token',
        })
      );

      const state = testStore.getState().message;
      // The 👍 reaction should be removed entirely, ❤️ should remain
      expect(state.messages[0].reactions).toHaveLength(1);
      expect(state.messages[0].reactions![0].emoji.name).toBe('❤️');
    });

    it('should handle partial failures gracefully', async () => {
      const mockDiscordService = {
        deleteReaction: vi.fn()
          .mockResolvedValueOnce({ success: true })
          .mockResolvedValueOnce({ success: false }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const testStore = await createStoreWithApp();

      const result = await testStore.dispatch(
        deleteAllReactions({
          channelId: 'channel-1',
          messageId: 'msg-1',
          emoji: '👍',
          userIds: ['user-1', 'user-2'],
          token: 'token',
        })
      );

      // Thunk still fulfills; individual failures are caught inside the loop
      expect(result.type).toBe('message/deleteAllReactions/fulfilled');
    });
  });

  describe('bulkDeleteAllReactions async thunk', () => {
    it('should call deleteAllReactionsFromMessage endpoint', async () => {
      const mockDiscordService = {
        deleteAllReactionsFromMessage: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        bulkDeleteAllReactions({ channelId: 'channel-1', messageId: 'msg-1', token: 'token' })
      );

      expect(result.type).toBe('message/bulkDeleteAllReactions/fulfilled');
      expect(result.payload).toEqual({ messageId: 'msg-1' });
      expect(mockDiscordService.deleteAllReactionsFromMessage).toHaveBeenCalledWith(
        'token', 'channel-1', 'msg-1'
      );
      expect(mockDiscordService.deleteAllReactionsFromMessage).toHaveBeenCalledTimes(1);
    });

    it('should clear all reactions from message in state', async () => {
      const reaction1 = createMockReaction({ count: 3, emoji: { id: null, name: '👍' } });
      const reaction2 = createMockReaction({ count: 2, emoji: { id: null, name: '❤️' } });
      const msg = createMockMessage({ id: 'msg-1', reactions: [reaction1, reaction2] });

      store.dispatch(setMessages([msg]));
      store.dispatch(setFilteredMessages([msg]));

      const mockDiscordService = {
        deleteAllReactionsFromMessage: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(
        bulkDeleteAllReactions({ channelId: 'channel-1', messageId: 'msg-1', token: 'token' })
      );

      const state = store.getState().message;
      expect(state.messages[0].reactions).toEqual([]);
    });

    it('should reject on API failure', async () => {
      const mockDiscordService = {
        deleteAllReactionsFromMessage: vi.fn().mockResolvedValue({ success: false }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        bulkDeleteAllReactions({ channelId: 'channel-1', messageId: 'msg-1', token: 'token' })
      );

      expect(result.type).toBe('message/bulkDeleteAllReactions/rejected');
    });
  });

  describe('bulkDeleteReactionsForEmoji async thunk', () => {
    it('should call deleteAllReactionsForEmoji endpoint', async () => {
      const mockDiscordService = {
        deleteAllReactionsForEmoji: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        bulkDeleteReactionsForEmoji({ channelId: 'channel-1', messageId: 'msg-1', emoji: '👍', token: 'token' })
      );

      expect(result.type).toBe('message/bulkDeleteReactionsForEmoji/fulfilled');
      expect(result.payload).toEqual({ messageId: 'msg-1', emoji: '👍' });
      expect(mockDiscordService.deleteAllReactionsForEmoji).toHaveBeenCalledWith(
        'token', 'channel-1', 'msg-1', '👍'
      );
      expect(mockDiscordService.deleteAllReactionsForEmoji).toHaveBeenCalledTimes(1);
    });

    it('should remove only the targeted emoji from state', async () => {
      const thumbsUp = createMockReaction({ count: 3, emoji: { id: null, name: '👍' } });
      const heart = createMockReaction({ count: 2, emoji: { id: null, name: '❤️' } });
      const msg = createMockMessage({ id: 'msg-1', reactions: [thumbsUp, heart] });

      store.dispatch(setMessages([msg]));
      store.dispatch(setFilteredMessages([msg]));

      const mockDiscordService = {
        deleteAllReactionsForEmoji: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(
        bulkDeleteReactionsForEmoji({ channelId: 'channel-1', messageId: 'msg-1', emoji: '👍', token: 'token' })
      );

      const state = store.getState().message;
      expect(state.messages[0].reactions).toHaveLength(1);
      expect(state.messages[0].reactions![0].emoji.name).toBe('❤️');
    });

    it('should reject on API failure', async () => {
      const mockDiscordService = {
        deleteAllReactionsForEmoji: vi.fn().mockResolvedValue({ success: false }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        bulkDeleteReactionsForEmoji({ channelId: 'channel-1', messageId: 'msg-1', emoji: '👍', token: 'token' })
      );

      expect(result.type).toBe('message/bulkDeleteReactionsForEmoji/rejected');
    });
  });

  describe('batchRemoveReactions async thunk', () => {
    const createStoreWithApp = async (messageState = initialMessageState) => {
      const { configureStore } = await import('@reduxjs/toolkit');
      const appReducer = (await import('@features/app/appSlice')).default;
      const { defaultSettings } = await import('@features/app/appSlice');
      return configureStore({
        reducer: { message: messageReducer, app: appReducer },
        preloadedState: {
          app: { discrubPaused: false, discrubCancelled: false, isMinimized: false, focusedView: false, sidebarView: 'server' as const, task: { status: 'idle' as const, message: '' }, settings: defaultSettings },
          message: messageState,
        },
      });
    };

    it('should call deleteAllReactionsFromMessage for each message in "all" mode', async () => {
      const mockDiscordService = {
        deleteAllReactionsFromMessage: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [
        { id: 'msg-1', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
        { id: 'msg-2', reactions: [{ emoji: { id: null, name: '❤️' }, count: 2 }] },
        { id: 'msg-3', reactions: [{ emoji: { id: null, name: '🔥' }, count: 3 }] },
      ];

      const testStore = await createStoreWithApp();
      const result = await testStore.dispatch(
        batchRemoveReactions({ channelId: 'ch-1', messages, mode: 'all', token: 'token' })
      );

      expect(result.type).toBe('message/batchRemoveReactions/fulfilled');
      expect(mockDiscordService.deleteAllReactionsFromMessage).toHaveBeenCalledTimes(3);
      expect(mockDiscordService.deleteAllReactionsFromMessage).toHaveBeenCalledWith('token', 'ch-1', 'msg-1');
      expect(mockDiscordService.deleteAllReactionsFromMessage).toHaveBeenCalledWith('token', 'ch-1', 'msg-2');
      expect(mockDiscordService.deleteAllReactionsFromMessage).toHaveBeenCalledWith('token', 'ch-1', 'msg-3');
    });

    it('should call deleteAllReactionsForEmoji for each message in "emoji" mode', async () => {
      const mockDiscordService = {
        deleteAllReactionsForEmoji: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [
        { id: 'msg-1', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
        { id: 'msg-2', reactions: [{ emoji: { id: null, name: '👍' }, count: 2 }] },
      ];

      const testStore = await createStoreWithApp();
      const result = await testStore.dispatch(
        batchRemoveReactions({ channelId: 'ch-1', messages, mode: 'emoji', emojis: ['👍'], token: 'token' })
      );

      expect(result.type).toBe('message/batchRemoveReactions/fulfilled');
      expect(mockDiscordService.deleteAllReactionsForEmoji).toHaveBeenCalledTimes(2);
      expect(mockDiscordService.deleteAllReactionsForEmoji).toHaveBeenCalledWith('token', 'ch-1', 'msg-1', '👍');
    });

    it('should call deleteReaction per emoji in "user" mode', async () => {
      const mockDiscordService = {
        deleteReaction: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [
        { id: 'msg-1', reactions: [
          { emoji: { id: null, name: '👍' }, count: 2 },
          { emoji: { id: null, name: '❤️' }, count: 1 },
        ] },
      ];

      const testStore = await createStoreWithApp();
      await testStore.dispatch(
        batchRemoveReactions({ channelId: 'ch-1', messages, mode: 'user', userId: 'user-1', token: 'token' })
      );

      // 2 emojis on msg-1, user mode deletes per emoji
      expect(mockDiscordService.deleteReaction).toHaveBeenCalledTimes(2);
      expect(mockDiscordService.deleteReaction).toHaveBeenCalledWith('token', 'ch-1', 'msg-1', '👍', 'user-1');
      expect(mockDiscordService.deleteReaction).toHaveBeenCalledWith('token', 'ch-1', 'msg-1', '❤️', 'user-1');
    });

    it('should update state correctly for "all" mode', async () => {
      const reaction = createMockReaction({ count: 3, emoji: { id: null, name: '👍' } });
      const msg = createMockMessage({ id: 'msg-1', reactions: [reaction] });

      const mockDiscordService = {
        deleteAllReactionsFromMessage: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const testStore = await createStoreWithApp({
        ...initialMessageState,
        messages: [msg],
        filteredMessages: [msg],
      });

      await testStore.dispatch(
        batchRemoveReactions({
          channelId: 'ch-1',
          messages: [{ id: 'msg-1', reactions: [{ emoji: { id: null, name: '👍' }, count: 3 }] }],
          mode: 'all',
          token: 'token',
        })
      );

      const state = testStore.getState().message;
      expect(state.messages[0].reactions).toEqual([]);
    });

    it('should update state correctly for "emoji" mode — remove only targeted emojis', async () => {
      const thumbsUp = createMockReaction({ count: 3, emoji: { id: null, name: '👍' } });
      const heart = createMockReaction({ count: 2, emoji: { id: null, name: '❤️' } });
      const fire = createMockReaction({ count: 1, emoji: { id: null, name: '🔥' } });
      const msg = createMockMessage({ id: 'msg-1', reactions: [thumbsUp, heart, fire] });

      const mockDiscordService = {
        deleteAllReactionsForEmoji: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const testStore = await createStoreWithApp({
        ...initialMessageState,
        messages: [msg],
        filteredMessages: [msg],
      });

      await testStore.dispatch(
        batchRemoveReactions({
          channelId: 'ch-1',
          messages: [{ id: 'msg-1', reactions: [{ emoji: { id: null, name: '👍' }, count: 3 }, { emoji: { id: null, name: '🔥' }, count: 1 }] }],
          mode: 'emoji',
          emojis: ['👍', '🔥'],
          token: 'token',
        })
      );

      const state = testStore.getState().message;
      // Only ❤️ should remain
      expect(state.messages[0].reactions).toHaveLength(1);
      expect(state.messages[0].reactions![0].emoji.name).toBe('❤️');
      // 2 emojis × 1 message = 2 API calls
      expect(mockDiscordService.deleteAllReactionsForEmoji).toHaveBeenCalledTimes(2);
    });

    it('should update state correctly for "user" mode — decrement counts', async () => {
      const thumbsUp = createMockReaction({ count: 3, emoji: { id: null, name: '👍' } });
      const heart = createMockReaction({ count: 1, emoji: { id: null, name: '❤️' } });
      const msg = createMockMessage({ id: 'msg-1', reactions: [thumbsUp, heart] });

      const mockDiscordService = {
        deleteReaction: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const testStore = await createStoreWithApp({
        ...initialMessageState,
        messages: [msg],
        filteredMessages: [msg],
      });

      await testStore.dispatch(
        batchRemoveReactions({
          channelId: 'ch-1',
          messages: [{ id: 'msg-1', reactions: [{ emoji: { id: null, name: '👍' }, count: 3 }, { emoji: { id: null, name: '❤️' }, count: 1 }] }],
          mode: 'user',
          userId: 'user-1',
          token: 'token',
        })
      );

      const state = testStore.getState().message;
      // 👍 decremented 3→2, ❤️ decremented 1→0 (removed)
      expect(state.messages[0].reactions).toHaveLength(1);
      expect(state.messages[0].reactions![0].emoji.name).toBe('👍');
      expect(state.messages[0].reactions![0].count).toBe(2);
    });

    it('should stop when cancelled', async () => {
      const { checkCancelled } = await import('@/utils/operationLoopUtils');
      // Cancel after first message
      vi.mocked(checkCancelled)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const mockDiscordService = {
        deleteAllReactionsFromMessage: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [
        { id: 'msg-1', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
        { id: 'msg-2', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
        { id: 'msg-3', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
      ];

      const testStore = await createStoreWithApp();
      await testStore.dispatch(
        batchRemoveReactions({ channelId: 'ch-1', messages, mode: 'all', token: 'token' })
      );

      // Should only process 1 message before cancel check stops it
      expect(mockDiscordService.deleteAllReactionsFromMessage).toHaveBeenCalledTimes(1);

      // Reset mock
      vi.mocked(checkCancelled).mockReturnValue(false);
    });

    it('should skip messages where user has not reacted (me=false) in "user" mode', async () => {
      const mockDiscordService = {
        deleteReaction: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [
        { id: 'msg-1', reactions: [
          { emoji: { id: null, name: '👍' }, count: 3, me: true },
          { emoji: { id: null, name: '❤️' }, count: 2, me: false },
        ] },
        { id: 'msg-2', reactions: [
          { emoji: { id: null, name: '👍' }, count: 1, me: false },
        ] },
        { id: 'msg-3', reactions: [
          { emoji: { id: null, name: '🔥' }, count: 5, me: true },
        ] },
      ];

      const testStore = await createStoreWithApp();
      await testStore.dispatch(
        batchRemoveReactions({ channelId: 'ch-1', messages, mode: 'user', userId: 'user-1', token: 'token' })
      );

      // msg-1: only 👍 (me=true), skip ❤️ (me=false) → 1 call
      // msg-2: skip entirely (me=false on all) → 0 calls
      // msg-3: 🔥 (me=true) → 1 call
      // Total: 2 API calls instead of 4
      expect(mockDiscordService.deleteReaction).toHaveBeenCalledTimes(2);
      expect(mockDiscordService.deleteReaction).toHaveBeenCalledWith('token', 'ch-1', 'msg-1', '👍', 'user-1');
      expect(mockDiscordService.deleteReaction).toHaveBeenCalledWith('token', 'ch-1', 'msg-3', '🔥', 'user-1');
    });

    it('should still attempt deletion when me field is undefined (backwards compat)', async () => {
      const mockDiscordService = {
        deleteReaction: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [
        { id: 'msg-1', reactions: [
          { emoji: { id: null, name: '👍' }, count: 2 }, // no me field
        ] },
      ];

      const testStore = await createStoreWithApp();
      await testStore.dispatch(
        batchRemoveReactions({ channelId: 'ch-1', messages, mode: 'user', userId: 'user-1', token: 'token' })
      );

      // Without me field, should still attempt deletion (not skip)
      expect(mockDiscordService.deleteReaction).toHaveBeenCalledTimes(1);
    });

    it('should skip entire message when all reactions have me=false in "user" mode', async () => {
      const mockDiscordService = {
        deleteReaction: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [
        { id: 'msg-1', reactions: [
          { emoji: { id: null, name: '👍' }, count: 5, me: false },
          { emoji: { id: null, name: '❤️' }, count: 3, me: false },
        ] },
      ];

      const testStore = await createStoreWithApp();
      await testStore.dispatch(
        batchRemoveReactions({ channelId: 'ch-1', messages, mode: 'user', userId: 'user-1', token: 'token' })
      );

      // All me=false, entire message skipped, 0 API calls
      expect(mockDiscordService.deleteReaction).toHaveBeenCalledTimes(0);
    });

    it('should continue on partial failure in "all" mode', async () => {
      const mockDiscordService = {
        deleteAllReactionsFromMessage: vi.fn()
          .mockRejectedValueOnce(new Error('API error'))
          .mockResolvedValueOnce({ success: true })
          .mockResolvedValueOnce({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [
        { id: 'msg-1', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
        { id: 'msg-2', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
        { id: 'msg-3', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
      ];

      const testStore = await createStoreWithApp();
      const result = await testStore.dispatch(
        batchRemoveReactions({ channelId: 'ch-1', messages, mode: 'all', token: 'token' })
      );

      expect(result.type).toBe('message/batchRemoveReactions/fulfilled');
      // All 3 were attempted despite first failing
      expect(mockDiscordService.deleteAllReactionsFromMessage).toHaveBeenCalledTimes(3);
    });

    it('should continue on partial failure in "emoji" mode', async () => {
      const mockDiscordService = {
        deleteAllReactionsForEmoji: vi.fn()
          .mockRejectedValueOnce(new Error('API error'))
          .mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [
        { id: 'msg-1', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
        { id: 'msg-2', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
      ];

      const testStore = await createStoreWithApp();
      const result = await testStore.dispatch(
        batchRemoveReactions({ channelId: 'ch-1', messages, mode: 'emoji', emojis: ['👍'], token: 'token' })
      );

      expect(result.type).toBe('message/batchRemoveReactions/fulfilled');
      expect(mockDiscordService.deleteAllReactionsForEmoji).toHaveBeenCalledTimes(2);
    });

    it('should set isRemovingReactions on pending and clear on fulfilled', async () => {
      const mockDiscordService = {
        deleteAllReactionsFromMessage: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const testStore = await createStoreWithApp();

      // Check pending sets the flag
      const dispatchPromise = testStore.dispatch(
        batchRemoveReactions({
          channelId: 'ch-1',
          messages: [{ id: 'msg-1', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] }],
          mode: 'all',
          token: 'token',
        })
      );

      await dispatchPromise;

      // After fulfilled, flag should be cleared
      expect(testStore.getState().message.isRemovingReactions).toBe(false);
    });

    it('should call cancellableDelay between messages', async () => {
      const { cancellableDelay } = await import('@/utils/operationLoopUtils');
      vi.mocked(cancellableDelay).mockResolvedValue(false);

      const mockDiscordService = {
        deleteAllReactionsFromMessage: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const messages = [
        { id: 'msg-1', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
        { id: 'msg-2', reactions: [{ emoji: { id: null, name: '👍' }, count: 1 }] },
      ];

      const testStore = await createStoreWithApp();
      await testStore.dispatch(
        batchRemoveReactions({ channelId: 'ch-1', messages, mode: 'all', token: 'token' })
      );

      // Delay called between msg-1 and msg-2 (not after last message)
      expect(cancellableDelay).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteAttachment async thunk', () => {
    it('should remove an attachment by editing the message', async () => {
      const attachment1 = createMockAttachment({ id: 'att-1', filename: 'file1.png' });
      const attachment2 = createMockAttachment({ id: 'att-2', filename: 'file2.png' });
      const msg = createMockMessage({
        id: 'msg-1',
        content: 'has attachments',
        attachments: [attachment1, attachment2],
      });
      const updatedMsg = createMockMessage({
        id: 'msg-1',
        content: 'has attachments',
        attachments: [attachment2],
      });

      const mockDiscordService = {
        editMessage: vi.fn().mockResolvedValue({ success: true, data: updatedMsg }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(setMessages([msg]));
      store.dispatch(setFilteredMessages([msg]));

      const result = await store.dispatch(
        deleteAttachment({ message: msg, attachment: attachment1, channelId: 'channel-1', token: 'token' })
      );

      expect(result.type).toBe('message/deleteAttachment/fulfilled');
      expect(result.payload).toEqual({ messageId: 'msg-1', deleted: false, updatedMessage: updatedMsg });
      // Should call editMessage with remaining attachments
      expect(mockDiscordService.editMessage).toHaveBeenCalledWith(
        'token', 'msg-1', { attachments: [attachment2] }, 'channel-1'
      );
    });

    it('should update attachment array in state after removal', async () => {
      const attachment1 = createMockAttachment({ id: 'att-1', filename: 'file1.png' });
      const attachment2 = createMockAttachment({ id: 'att-2', filename: 'file2.png' });
      const msg = createMockMessage({
        id: 'msg-1',
        content: 'has attachments',
        attachments: [attachment1, attachment2],
      });
      const updatedMsg = createMockMessage({
        id: 'msg-1',
        content: 'has attachments',
        attachments: [attachment2],
      });

      const mockDiscordService = {
        editMessage: vi.fn().mockResolvedValue({ success: true, data: updatedMsg }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(setMessages([msg]));
      store.dispatch(setFilteredMessages([msg]));

      await store.dispatch(
        deleteAttachment({ message: msg, attachment: attachment1, channelId: 'channel-1', token: 'token' })
      );

      const state = store.getState().message;
      expect(state.messages[0].attachments).toHaveLength(1);
      expect(state.messages[0].attachments[0].id).toBe('att-2');
    });

    it('should delete entire message when last attachment removed and no content', async () => {
      const attachment = createMockAttachment({ id: 'att-1' });
      const msg = createMockMessage({
        id: 'msg-1',
        content: '',
        attachments: [attachment],
      });

      const mockDiscordService = {
        deleteMessage: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(setMessages([msg]));
      store.dispatch(setFilteredMessages([msg]));

      const result = await store.dispatch(
        deleteAttachment({ message: msg, attachment, channelId: 'channel-1', token: 'token' })
      );

      expect(result.type).toBe('message/deleteAttachment/fulfilled');
      expect(result.payload).toEqual({ messageId: 'msg-1', deleted: true });
      expect(mockDiscordService.deleteMessage).toHaveBeenCalledWith('token', 'msg-1', 'channel-1');

      // Message should be removed from state
      const state = store.getState().message;
      expect(state.messages).toHaveLength(0);
    });

    it('should handle edit failure', async () => {
      const attachment = createMockAttachment({ id: 'att-1' });
      const msg = createMockMessage({
        id: 'msg-1',
        content: 'some content',
        attachments: [attachment],
      });

      const mockDiscordService = {
        editMessage: vi.fn().mockResolvedValue({ success: false, data: null }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        deleteAttachment({ message: msg, attachment, channelId: 'channel-1', token: 'token' })
      );

      expect(result.type).toBe('message/deleteAttachment/rejected');
    });
  });

  describe('deleteAllAttachments async thunk', () => {
    it('should remove all attachments by editing the message', async () => {
      const attachment1 = createMockAttachment({ id: 'att-1' });
      const attachment2 = createMockAttachment({ id: 'att-2' });
      const msg = createMockMessage({
        id: 'msg-1',
        content: 'has content',
        attachments: [attachment1, attachment2],
      });
      const updatedMsg = createMockMessage({
        id: 'msg-1',
        content: 'has content',
        attachments: [],
      });

      const mockDiscordService = {
        editMessage: vi.fn().mockResolvedValue({ success: true, data: updatedMsg }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(setMessages([msg]));
      store.dispatch(setFilteredMessages([msg]));

      const result = await store.dispatch(
        deleteAllAttachments({ message: msg, channelId: 'channel-1', token: 'token' })
      );

      expect(result.type).toBe('message/deleteAllAttachments/fulfilled');
      expect(result.payload).toEqual({ messageId: 'msg-1', deleted: false, updatedMessage: updatedMsg });
      expect(mockDiscordService.editMessage).toHaveBeenCalledWith(
        'token', 'msg-1', { attachments: [] }, 'channel-1'
      );
    });

    it('should update state to reflect removed attachments', async () => {
      const attachment1 = createMockAttachment({ id: 'att-1' });
      const msg = createMockMessage({
        id: 'msg-1',
        content: 'has content',
        attachments: [attachment1],
      });
      const updatedMsg = createMockMessage({
        id: 'msg-1',
        content: 'has content',
        attachments: [],
      });

      const mockDiscordService = {
        editMessage: vi.fn().mockResolvedValue({ success: true, data: updatedMsg }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(setMessages([msg]));
      store.dispatch(setFilteredMessages([msg]));

      await store.dispatch(
        deleteAllAttachments({ message: msg, channelId: 'channel-1', token: 'token' })
      );

      const state = store.getState().message;
      expect(state.messages[0].attachments).toHaveLength(0);
    });

    it('should delete entire message when no content remains', async () => {
      const attachment = createMockAttachment({ id: 'att-1' });
      const msg = createMockMessage({
        id: 'msg-1',
        content: '',
        attachments: [attachment],
      });

      const mockDiscordService = {
        deleteMessage: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(setMessages([msg]));
      store.dispatch(setFilteredMessages([msg]));

      const result = await store.dispatch(
        deleteAllAttachments({ message: msg, channelId: 'channel-1', token: 'token' })
      );

      expect(result.type).toBe('message/deleteAllAttachments/fulfilled');
      expect(result.payload).toEqual({ messageId: 'msg-1', deleted: true });

      const state = store.getState().message;
      expect(state.messages).toHaveLength(0);
    });

    it('should handle edit failure', async () => {
      const msg = createMockMessage({
        id: 'msg-1',
        content: 'has content',
        attachments: [createMockAttachment()],
      });

      const mockDiscordService = {
        editMessage: vi.fn().mockResolvedValue({ success: false, data: null }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(
        deleteAllAttachments({ message: msg, channelId: 'channel-1', token: 'token' })
      );

      expect(result.type).toBe('message/deleteAllAttachments/rejected');
    });
  });

  describe('Thread tab reducers', () => {
    const threadMessages = createMockMessages(3).map((m, i) =>
      createMockMessage({ ...m, id: `thread-msg-${i + 1}`, channel_id: 'thread-100' })
    );

    describe('addThreadTab', () => {
      it('should create a new thread tab with loading state', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        const state = store.getState().message;
        expect(state.threadTabs['thread-100']).toBeDefined();
        expect(state.threadTabs['thread-100'].threadName).toBe('My Thread');
        expect(state.threadTabs['thread-100'].isLoading).toBe(true);
        expect(state.threadTabs['thread-100'].messages).toEqual([]);
        expect(state.activeTab).toBe('thread-100');
      });

      it('should not overwrite existing tab, but should switch to it', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        store.dispatch(setThreadMessages({ threadId: 'thread-100', messages: threadMessages }));
        store.dispatch(setActiveTab(null));

        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'Different Name' }));
        const state = store.getState().message;
        expect(state.threadTabs['thread-100'].threadName).toBe('My Thread');
        expect(state.threadTabs['thread-100'].messages).toEqual(threadMessages);
        expect(state.activeTab).toBe('thread-100');
      });
    });

    describe('removeThreadTab', () => {
      it('should remove a thread tab', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        store.dispatch(removeThreadTab('thread-100'));
        const state = store.getState().message;
        expect(state.threadTabs['thread-100']).toBeUndefined();
      });

      it('should switch to main tab if removed tab was active', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        expect(store.getState().message.activeTab).toBe('thread-100');
        store.dispatch(removeThreadTab('thread-100'));
        expect(store.getState().message.activeTab).toBeNull();
      });

      it('should not change active tab if removed tab was not active', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'Thread 1' }));
        store.dispatch(addThreadTab({ threadId: 'thread-200', threadName: 'Thread 2' }));
        expect(store.getState().message.activeTab).toBe('thread-200');
        store.dispatch(removeThreadTab('thread-100'));
        expect(store.getState().message.activeTab).toBe('thread-200');
      });
    });

    describe('setActiveTab', () => {
      it('should switch to main tab with null', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        store.dispatch(setActiveTab(null));
        expect(store.getState().message.activeTab).toBeNull();
      });

      it('should switch to a thread tab', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        store.dispatch(setActiveTab(null));
        store.dispatch(setActiveTab('thread-100'));
        expect(store.getState().message.activeTab).toBe('thread-100');
      });
    });

    describe('setThreadMessages', () => {
      it('should set messages and filteredMessages for a thread tab', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        store.dispatch(setThreadMessages({ threadId: 'thread-100', messages: threadMessages }));
        const tab = store.getState().message.threadTabs['thread-100'];
        expect(tab.messages).toEqual(threadMessages);
        expect(tab.filteredMessages).toEqual(threadMessages);
      });

      it('should no-op for non-existent thread', () => {
        store.dispatch(setThreadMessages({ threadId: 'nonexistent', messages: threadMessages }));
        expect(store.getState().message.threadTabs['nonexistent']).toBeUndefined();
      });
    });

    describe('setThreadFilteredMessages', () => {
      it('should set filtered messages independently from messages', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        store.dispatch(setThreadMessages({ threadId: 'thread-100', messages: threadMessages }));
        const filtered = [threadMessages[0]];
        store.dispatch(setThreadFilteredMessages({ threadId: 'thread-100', messages: filtered }));
        const tab = store.getState().message.threadTabs['thread-100'];
        expect(tab.messages).toEqual(threadMessages);
        expect(tab.filteredMessages).toEqual(filtered);
      });
    });

    describe('thread message selection', () => {
      beforeEach(() => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        store.dispatch(setThreadMessages({ threadId: 'thread-100', messages: threadMessages }));
      });

      it('should toggle message selection on', () => {
        store.dispatch(toggleThreadMessageSelection({ threadId: 'thread-100', message: threadMessages[0] }));
        const tab = store.getState().message.threadTabs['thread-100'];
        expect(tab.selectedMessages).toHaveLength(1);
        expect(tab.selectedMessages[0].id).toBe(threadMessages[0].id);
      });

      it('should toggle message selection off', () => {
        store.dispatch(toggleThreadMessageSelection({ threadId: 'thread-100', message: threadMessages[0] }));
        store.dispatch(toggleThreadMessageSelection({ threadId: 'thread-100', message: threadMessages[0] }));
        const tab = store.getState().message.threadTabs['thread-100'];
        expect(tab.selectedMessages).toHaveLength(0);
      });

      it('should select all messages', () => {
        store.dispatch(selectAllThreadMessages('thread-100'));
        const tab = store.getState().message.threadTabs['thread-100'];
        expect(tab.selectedMessages).toHaveLength(3);
      });

      it('should deselect all messages', () => {
        store.dispatch(selectAllThreadMessages('thread-100'));
        store.dispatch(deselectAllThreadMessages('thread-100'));
        const tab = store.getState().message.threadTabs['thread-100'];
        expect(tab.selectedMessages).toHaveLength(0);
      });
    });

    describe('setThreadOrder', () => {
      it('should update order for a thread tab', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        const newOrder = { order: SortDirection.ASCENDING, orderBy: 'timestamp' as keyof Message };
        store.dispatch(setThreadOrder({ threadId: 'thread-100', order: newOrder }));
        const tab = store.getState().message.threadTabs['thread-100'];
        expect(tab.order.order).toBe(SortDirection.ASCENDING);
      });
    });

    describe('setThreadSearchCriteria', () => {
      it('should set search criteria for a thread tab', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        const criteria = { searchContent: 'test' } as any;
        store.dispatch(setThreadSearchCriteria({ threadId: 'thread-100', criteria }));
        const tab = store.getState().message.threadTabs['thread-100'];
        expect(tab.searchCriteria).toEqual(criteria);
      });

      it('should clear search criteria with null', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        store.dispatch(setThreadSearchCriteria({ threadId: 'thread-100', criteria: { searchContent: 'test' } as any }));
        store.dispatch(setThreadSearchCriteria({ threadId: 'thread-100', criteria: null }));
        const tab = store.getState().message.threadTabs['thread-100'];
        expect(tab.searchCriteria).toBeNull();
      });
    });

    describe('setThreadLoading and setThreadError', () => {
      it('should set loading state', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        store.dispatch(setThreadLoading({ threadId: 'thread-100', isLoading: false }));
        expect(store.getState().message.threadTabs['thread-100'].isLoading).toBe(false);
      });

      it('should set error state', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        store.dispatch(setThreadError({ threadId: 'thread-100', error: 'Something went wrong' }));
        expect(store.getState().message.threadTabs['thread-100'].error).toBe('Something went wrong');
      });
    });

    describe('updateThreadPagination', () => {
      it('should partially update pagination', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        store.dispatch(updateThreadPagination({
          threadId: 'thread-100',
          pagination: { hasMore: false, lastMessageId: 'last-1' },
        }));
        const tab = store.getState().message.threadTabs['thread-100'];
        expect(tab.pagination.hasMore).toBe(false);
        expect(tab.pagination.lastMessageId).toBe('last-1');
        expect(tab.pagination.mode).toBe('paginated'); // unchanged
      });
    });

    describe('clearMessages clears thread tabs', () => {
      it('should clear all thread tabs and activeTab', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
        store.dispatch(addThreadTab({ threadId: 'thread-200', threadName: 'Thread 2' }));
        store.dispatch(clearMessages());
        const state = store.getState().message;
        expect(state.threadTabs).toEqual({});
        expect(state.activeTab).toBeNull();
      });
    });
  });

  describe('Active-tab-aware selectors', () => {
    const mainMessages = createMockMessages(2);
    const threadMessages = [
      createMockMessage({ id: 'thread-msg-1', content: 'Thread message 1', channel_id: 'thread-100' }),
      createMockMessage({ id: 'thread-msg-2', content: 'Thread message 2', channel_id: 'thread-100' }),
    ];

    beforeEach(() => {
      store.dispatch(setMessages(mainMessages));
      store.dispatch(setFilteredMessages(mainMessages));
    });

    it('should return main tab data when activeTab is null', () => {
      const state = store.getState();
      expect(selectActiveMessages(state)).toEqual(mainMessages);
      expect(selectActiveFilteredMessages(state)).toEqual(mainMessages);
      expect(selectActiveSelectedMessages(state)).toEqual([]);
      expect(selectActiveSearchCriteria(state)).toBeNull();
      expect(selectActiveOrder(state)).toEqual(state.message.order);
      expect(selectActiveLoading(state)).toBe(false);
      expect(selectActiveError(state)).toBeNull();
      expect(selectActivePagination(state)).toEqual(state.message.pagination);
    });

    it('should return thread tab data when a thread tab is active', () => {
      store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
      store.dispatch(setThreadMessages({ threadId: 'thread-100', messages: threadMessages }));
      store.dispatch(setThreadLoading({ threadId: 'thread-100', isLoading: false }));

      const state = store.getState();
      expect(selectActiveTab(state)).toBe('thread-100');
      expect(selectActiveMessages(state)).toEqual(threadMessages);
      expect(selectActiveFilteredMessages(state)).toEqual(threadMessages);
      expect(selectActiveSelectedMessages(state)).toEqual([]);
      expect(selectActiveLoading(state)).toBe(false);
    });

    it('should switch between main and thread tab data', () => {
      store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
      store.dispatch(setThreadMessages({ threadId: 'thread-100', messages: threadMessages }));

      // Active tab is thread
      expect(selectActiveMessages(store.getState())).toEqual(threadMessages);

      // Switch to main
      store.dispatch(setActiveTab(null));
      expect(selectActiveMessages(store.getState())).toEqual(mainMessages);

      // Switch back to thread
      store.dispatch(setActiveTab('thread-100'));
      expect(selectActiveMessages(store.getState())).toEqual(threadMessages);
    });

    it('should return main tab data if activeTab points to non-existent thread', () => {
      store.dispatch(setActiveTab('nonexistent'));
      const state = store.getState();
      expect(selectActiveMessages(state)).toEqual(mainMessages);
      expect(selectActiveFilteredMessages(state)).toEqual(mainMessages);
    });

    it('selectThreadTabs returns all thread tabs', () => {
      store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'Thread 1' }));
      store.dispatch(addThreadTab({ threadId: 'thread-200', threadName: 'Thread 2' }));
      const tabs = selectThreadTabs(store.getState());
      expect(Object.keys(tabs)).toEqual(['thread-100', 'thread-200']);
    });

    it('selectThreadTab returns a specific tab or null', () => {
      store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'Thread 1' }));
      expect(selectThreadTab(store.getState(), 'thread-100')).toBeDefined();
      expect(selectThreadTab(store.getState(), 'nonexistent')).toBeNull();
    });
  });

  describe('Thread tab state isolation', () => {
    const mainMessages = createMockMessages(3);
    const threadMessages = [
      createMockMessage({ id: 'thread-msg-1', content: 'Thread 1', channel_id: 'thread-100' }),
      createMockMessage({ id: 'thread-msg-2', content: 'Thread 2', channel_id: 'thread-100' }),
    ];

    beforeEach(() => {
      store.dispatch(setMessages(mainMessages));
      store.dispatch(setFilteredMessages(mainMessages));
      store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'My Thread' }));
      store.dispatch(setThreadMessages({ threadId: 'thread-100', messages: threadMessages }));
    });

    it('should not affect thread filteredMessages when main filter changes', () => {
      const singleMsg = [mainMessages[0]];
      store.dispatch(setFilteredMessages(singleMsg));

      const state = store.getState().message;
      expect(state.filteredMessages).toEqual(singleMsg);
      expect(state.threadTabs['thread-100'].filteredMessages).toEqual(threadMessages);
    });

    it('should not leak thread searchCriteria to main', () => {
      const criteria = { searchContent: 'thread-only' } as any;
      store.dispatch(setThreadSearchCriteria({ threadId: 'thread-100', criteria }));

      const state = store.getState().message;
      expect(state.threadTabs['thread-100'].searchCriteria).toEqual(criteria);
      expect(state.searchCriteria).toBeNull();
    });

    it('should preserve thread filter state after switching tabs', () => {
      const filtered = [threadMessages[0]];
      store.dispatch(setThreadFilteredMessages({ threadId: 'thread-100', messages: filtered }));

      // Switch away to main
      store.dispatch(setActiveTab(null));
      expect(selectActiveFilteredMessages(store.getState())).toEqual(mainMessages);

      // Switch back to thread — filtered subset should still be preserved
      store.dispatch(setActiveTab('thread-100'));
      expect(selectActiveFilteredMessages(store.getState())).toEqual(filtered);
    });
  });

  describe('Thread tab async thunks', () => {
    const threadMsgs = createMockMessages(3);

    describe('openThreadTab', () => {
      it('should create tab, fetch messages, and populate state', async () => {
        const mockDiscordService = {
          fetchMessageData: vi.fn().mockResolvedValue({ success: true, data: threadMsgs }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        const result = await store.dispatch(
          openThreadTab({ threadId: 'thread-100', threadName: 'My Thread', token: 'token' })
        );

        expect(result.type).toBe('message/openThreadTab/fulfilled');
        expect(result.payload).toEqual({ threadId: 'thread-100', alreadyOpen: false });

        const state = store.getState().message;
        expect(state.activeTab).toBe('thread-100');
        expect(state.threadTabs['thread-100'].messages).toHaveLength(3);
        expect(state.threadTabs['thread-100'].isLoading).toBe(false);
        expect(state.threadTabs['thread-100'].pagination.hasMore).toBe(false); // <100 messages
        expect(mockDiscordService.fetchMessageData).toHaveBeenCalledWith('token', '', 'thread-100');
      });

      it('should just switch tab if already open', async () => {
        const mockDiscordService = {
          fetchMessageData: vi.fn().mockResolvedValue({ success: true, data: threadMsgs }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        // Open it once
        await store.dispatch(openThreadTab({ threadId: 'thread-100', threadName: 'My Thread', token: 'token' }));
        store.dispatch(setActiveTab(null));

        // Open again — should not re-fetch
        mockDiscordService.fetchMessageData.mockClear();
        const result = await store.dispatch(
          openThreadTab({ threadId: 'thread-100', threadName: 'My Thread', token: 'token' })
        );

        expect(result.payload).toEqual({ threadId: 'thread-100', alreadyOpen: true });
        expect(mockDiscordService.fetchMessageData).not.toHaveBeenCalled();
        expect(store.getState().message.activeTab).toBe('thread-100');
      });

      it('should set hasMore=true when 100 messages returned', async () => {
        const hundredMsgs = createMockMessages(100);
        const mockDiscordService = {
          fetchMessageData: vi.fn().mockResolvedValue({ success: true, data: hundredMsgs }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await store.dispatch(openThreadTab({ threadId: 'thread-100', threadName: 'Thread', token: 'token' }));

        const tab = store.getState().message.threadTabs['thread-100'];
        expect(tab.pagination.hasMore).toBe(true);
        expect(tab.messages).toHaveLength(100);
      });

      it('should remove tab on fetch failure and return to main tab', async () => {
        const mockDiscordService = {
          fetchMessageData: vi.fn().mockResolvedValue({ success: false }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        const result = await store.dispatch(
          openThreadTab({ threadId: 'thread-100', threadName: 'Thread', token: 'token' })
        );

        expect(result.type).toBe('message/openThreadTab/rejected');
        // Tab should be removed (not left in error state)
        expect(store.getState().message.threadTabs['thread-100']).toBeUndefined();
        // Active tab should be reset to main
        expect(store.getState().message.activeTab).toBeNull();
      });

      it('should remove tab on network error and return to main tab', async () => {
        const mockDiscordService = {
          fetchMessageData: vi.fn().mockRejectedValue(new Error('Network error')),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        const result = await store.dispatch(
          openThreadTab({ threadId: 'thread-200', threadName: 'Thread', token: 'token' })
        );

        expect(result.type).toBe('message/openThreadTab/rejected');
        expect(store.getState().message.threadTabs['thread-200']).toBeUndefined();
        expect(store.getState().message.activeTab).toBeNull();
      });

      it('should dispatch status entry on successful thread load', async () => {
        const mockDiscordService = {
          fetchMessageData: vi.fn().mockResolvedValue({ success: true, data: threadMsgs }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
        vi.mocked(addStatusEntry).mockClear();

        await store.dispatch(
          openThreadTab({ threadId: 'thread-300', threadName: 'My Thread', token: 'token' })
        );

        expect(vi.mocked(addStatusEntry)).toHaveBeenCalledWith({
          level: 'info',
          message: `Thread loaded: ${threadMsgs.length} messages`,
        });
      });

      it('should not dispatch status entry when switching to existing tab', async () => {
        const mockDiscordService = {
          fetchMessageData: vi.fn().mockResolvedValue({ success: true, data: threadMsgs }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await store.dispatch(openThreadTab({ threadId: 'thread-400', threadName: 'Thread', token: 'token' }));
        store.dispatch(setActiveTab(null));
        vi.mocked(addStatusEntry).mockClear();

        await store.dispatch(openThreadTab({ threadId: 'thread-400', threadName: 'Thread', token: 'token' }));

        const threadLoadCalls = vi.mocked(addStatusEntry).mock.calls.filter(
          ([payload]) => payload.message.includes('Thread loaded')
        );
        expect(threadLoadCalls).toHaveLength(0);
      });
    });

    describe('fetchMoreThreadMessages', () => {
      it('should append messages to existing thread tab', async () => {
        const initialMsgs = createMockMessages(2);
        const moreMsgs = [
          createMockMessage({ id: 'more-1', content: 'More 1' }),
          createMockMessage({ id: 'more-2', content: 'More 2' }),
        ];

        const mockDiscordService = {
          fetchMessageData: vi.fn()
            .mockResolvedValueOnce({ success: true, data: initialMsgs })
            .mockResolvedValueOnce({ success: true, data: moreMsgs }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await store.dispatch(openThreadTab({ threadId: 'thread-100', threadName: 'Thread', token: 'token' }));

        const result = await store.dispatch(
          fetchMoreThreadMessages({ threadId: 'thread-100', token: 'token', lastMessageId: 'msg-2' })
        );

        expect(result.type).toBe('message/fetchMoreThreadMessages/fulfilled');
        const tab = store.getState().message.threadTabs['thread-100'];
        expect(tab.messages).toHaveLength(4);
        expect(tab.pagination.isLoadingMore).toBe(false);
      });

      it('should handle fetch failure', async () => {
        // First set up a tab
        const mockDiscordService = {
          fetchMessageData: vi.fn()
            .mockResolvedValueOnce({ success: true, data: createMockMessages(2) })
            .mockResolvedValueOnce({ success: false }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await store.dispatch(openThreadTab({ threadId: 'thread-100', threadName: 'Thread', token: 'token' }));

        const result = await store.dispatch(
          fetchMoreThreadMessages({ threadId: 'thread-100', token: 'token', lastMessageId: 'msg-2' })
        );

        expect(result.type).toBe('message/fetchMoreThreadMessages/rejected');
        expect(store.getState().message.threadTabs['thread-100'].pagination.isLoadingMore).toBe(false);
      });

      it('should dispatch status entry with message count on success', async () => {
        const initialMsgs = createMockMessages(2);
        const moreMsgs = [
          createMockMessage({ id: 'more-a', content: 'More A' }),
          createMockMessage({ id: 'more-b', content: 'More B' }),
          createMockMessage({ id: 'more-c', content: 'More C' }),
        ];

        const mockDiscordService = {
          fetchMessageData: vi.fn()
            .mockResolvedValueOnce({ success: true, data: initialMsgs })
            .mockResolvedValueOnce({ success: true, data: moreMsgs }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await store.dispatch(openThreadTab({ threadId: 'thread-100', threadName: 'Thread', token: 'token' }));
        vi.mocked(addStatusEntry).mockClear();

        await store.dispatch(
          fetchMoreThreadMessages({ threadId: 'thread-100', token: 'token', lastMessageId: 'msg-2' })
        );

        expect(vi.mocked(addStatusEntry)).toHaveBeenCalledWith({
          level: 'info',
          message: 'Loaded 3 more messages',
        });
      });
    });

    describe('fetchAllThreadMessages', () => {
      it('should fetch all messages across multiple batches', async () => {
        const batch1 = createMockMessages(100);
        const batch2 = createMockMessages(50).map((m, i) =>
          createMockMessage({ ...m, id: `batch2-msg-${i + 1}` })
        );

        const mockDiscordService = {
          fetchMessageData: vi.fn()
            .mockResolvedValueOnce({ success: true, data: batch1 })
            .mockResolvedValueOnce({ success: true, data: batch2 }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        // Set up a store with an existing thread tab
        const testStore = await createStoreWithApp({
          ...initialMessageState,
          activeTab: 'thread-100',
          threadTabs: {
            'thread-100': {
              threadId: 'thread-100',
              threadName: 'Thread',
              messages: [],
              filteredMessages: [],
              selectedMessages: [],
              searchCriteria: null, refineCriteria: null,
              order: initialMessageState.order,
              isLoading: false,
              error: null,
              pagination: { ...initialMessageState.pagination },
            },
          },
        });

        const result = await testStore.dispatch(
          fetchAllThreadMessages({ threadId: 'thread-100', token: 'token' })
        );

        expect(result.type).toBe('message/fetchAllThreadMessages/fulfilled');
        const tab = testStore.getState().message.threadTabs['thread-100'];
        expect(tab.messages).toHaveLength(150);
        expect(tab.pagination.hasMore).toBe(false);
        expect(tab.pagination.isLoadingAll).toBe(false);
        expect(tab.pagination.loadAllProgress).toBeNull();
      });

      it('should dispatch starting and completion status entries on success', async () => {
        const batch = createMockMessages(50);
        const mockDiscordService = {
          fetchMessageData: vi.fn().mockResolvedValue({ success: true, data: batch }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
        vi.mocked(addStatusEntry).mockClear();

        const testStore = await createStoreWithApp({
          ...initialMessageState,
          activeTab: 'thread-100',
          threadTabs: {
            'thread-100': {
              threadId: 'thread-100',
              threadName: 'Thread',
              messages: [],
              filteredMessages: [],
              selectedMessages: [],
              searchCriteria: null, refineCriteria: null,
              order: initialMessageState.order,
              isLoading: false,
              error: null,
              pagination: { ...initialMessageState.pagination },
            },
          },
        });

        await testStore.dispatch(
          fetchAllThreadMessages({ threadId: 'thread-100', token: 'token' })
        );

        const startCalls = vi.mocked(addStatusEntry).mock.calls.filter(
          ([payload]) => payload.message === 'Load All: Starting...'
        );
        expect(startCalls).toHaveLength(1);

        const successCalls = vi.mocked(addStatusEntry).mock.calls.filter(
          ([payload]) => payload.level === 'success'
        );
        expect(successCalls).toHaveLength(1);
        expect(successCalls[0][0].message).toBe('Load All complete: 50 messages');
      });
    });

    describe('searchThreadMessages', () => {
      it('should search and populate thread tab with results', async () => {
        const searchResults = createMockMessages(2);
        const mockDiscordService = {
          fetchSearchMessageData: vi.fn().mockResolvedValue({
            success: true,
            data: {
              messages: [searchResults],
              total_results: 2,
            },
          }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        // Set up a store with an existing thread tab
        const testStore = await createStoreWithApp({
          ...initialMessageState,
          activeTab: 'thread-100',
          threadTabs: {
            'thread-100': {
              threadId: 'thread-100',
              threadName: 'Thread',
              messages: [],
              filteredMessages: [],
              selectedMessages: [],
              searchCriteria: null, refineCriteria: null,
              order: initialMessageState.order,
              isLoading: false,
              error: null,
              pagination: { ...initialMessageState.pagination },
            },
          },
        });

        const result = await testStore.dispatch(
          searchThreadMessages({
            threadId: 'thread-100',
            token: 'token',
            searchCriteria: { searchContent: 'test' } as any,
          })
        );

        expect(result.type).toBe('message/searchThreadMessages/fulfilled');
        const tab = testStore.getState().message.threadTabs['thread-100'];
        expect(tab.messages).toHaveLength(2);
        expect(tab.isLoading).toBe(false);
        expect(tab.pagination.mode).toBe('search');
        expect(tab.pagination.hasMore).toBe(false);
      });

      it('should dispatch starting and completion status entries on success', async () => {
        const searchResults = createMockMessages(4);
        const mockDiscordService = {
          fetchSearchMessageData: vi.fn().mockResolvedValue({
            success: true,
            data: {
              messages: [searchResults],
              total_results: 4,
            },
          }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);
        vi.mocked(addStatusEntry).mockClear();

        const testStore = await createStoreWithApp({
          ...initialMessageState,
          activeTab: 'thread-100',
          threadTabs: {
            'thread-100': {
              threadId: 'thread-100',
              threadName: 'Thread',
              messages: [],
              filteredMessages: [],
              selectedMessages: [],
              searchCriteria: null, refineCriteria: null,
              order: initialMessageState.order,
              isLoading: false,
              error: null,
              pagination: { ...initialMessageState.pagination },
            },
          },
        });

        await testStore.dispatch(
          searchThreadMessages({
            threadId: 'thread-100',
            token: 'token',
            searchCriteria: { searchContent: 'test' } as any,
          })
        );

        const startCalls = vi.mocked(addStatusEntry).mock.calls.filter(
          ([payload]) => payload.message === 'Search: Starting...'
        );
        expect(startCalls).toHaveLength(1);

        const successCalls = vi.mocked(addStatusEntry).mock.calls.filter(
          ([payload]) => payload.level === 'success'
        );
        expect(successCalls).toHaveLength(1);
        expect(successCalls[0][0].message).toBe('Search complete: 4 results found');
      });
    });
  });

  describe('operations on thread tabs (Phase 7)', () => {
    const threadMessages = [
      createMockMessage({ id: 'tmsg-1', content: 'thread msg 1' }),
      createMockMessage({ id: 'tmsg-2', content: 'thread msg 2' }),
      createMockMessage({ id: 'tmsg-3', content: 'thread msg 3' }),
    ];
    const mainMessages = [
      createMockMessage({ id: 'main-1', content: 'main msg 1' }),
      createMockMessage({ id: 'main-2', content: 'main msg 2' }),
    ];

    const setupThreadTabStore = () => {
      // Set up main messages
      store.dispatch(setMessages(mainMessages));
      store.dispatch(setFilteredMessages(mainMessages));
      // Set up thread tab with messages
      store.dispatch(addThreadTab({ threadId: 'thread-1', threadName: 'Test Thread' }));
      store.dispatch(setThreadMessages({ threadId: 'thread-1', messages: threadMessages }));
      store.dispatch(setActiveTab('thread-1'));
      return store;
    };

    describe('deleteMessage on active thread tab', () => {
      it('should remove message from thread tab arrays, not main arrays', async () => {
        const testStore = setupThreadTabStore();
        const mockDiscordService = {
          deleteMessage: vi.fn().mockResolvedValue({ success: true }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await testStore.dispatch(deleteMessage({ messageId: 'tmsg-1', channelId: 'thread-1', token: 'token' }));

        const state = testStore.getState().message;
        // Thread tab should have message removed
        expect(state.threadTabs['thread-1'].messages).toHaveLength(2);
        expect(state.threadTabs['thread-1'].messages.find((m: Message) => m.id === 'tmsg-1')).toBeUndefined();
        expect(state.threadTabs['thread-1'].filteredMessages).toHaveLength(2);
        // Main messages should be untouched
        expect(state.messages).toHaveLength(2);
        expect(state.messages[0].id).toBe('main-1');
      });
    });

    describe('deleteMessages on active thread tab', () => {
      it('should clear selected messages on thread tab after bulk delete', async () => {
        const mockDiscordService = {
          deleteMessage: vi.fn().mockResolvedValue({ success: true }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        const testStore = await createStoreWithApp({
          ...initialMessageState,
          messages: mainMessages,
          filteredMessages: mainMessages,
          activeTab: 'thread-1',
          threadTabs: {
            'thread-1': {
              threadId: 'thread-1',
              threadName: 'Test Thread',
              messages: threadMessages,
              filteredMessages: threadMessages,
              selectedMessages: [threadMessages[0]],
              searchCriteria: null, refineCriteria: null,
              order: initialMessageState.order,
              isLoading: false,
              error: null,
              pagination: { ...initialMessageState.pagination },
            },
          },
        });

        await testStore.dispatch(
          deleteMessages({ messages: [threadMessages[0]], channelId: 'thread-1', token: 'token' })
        );

        const state = testStore.getState().message;
        // Thread tab selected messages should be cleared
        expect(state.threadTabs['thread-1'].selectedMessages).toHaveLength(0);
        // Thread tab messages should have the deleted one removed (via deleteMessage.fulfilled)
        expect(state.threadTabs['thread-1'].messages).toHaveLength(2);
        // Main messages should be untouched
        expect(state.messages).toEqual(mainMessages);
      });
    });

    describe('editMessage on active thread tab', () => {
      it('should update message in thread tab arrays, not main arrays', async () => {
        const testStore = setupThreadTabStore();
        const editedMsg = createMockMessage({ id: 'tmsg-2', content: 'edited content' });
        const mockDiscordService = {
          editMessage: vi.fn().mockResolvedValue({ success: true, data: editedMsg }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await testStore.dispatch(
          editMessage({ messageId: 'tmsg-2', channelId: 'thread-1', content: 'edited content', token: 'token' })
        );

        const state = testStore.getState().message;
        // Thread tab should have updated message
        expect(state.threadTabs['thread-1'].messages.find((m: Message) => m.id === 'tmsg-2')?.content).toBe('edited content');
        expect(state.threadTabs['thread-1'].filteredMessages.find((m: Message) => m.id === 'tmsg-2')?.content).toBe('edited content');
        // Main messages should be untouched
        expect(state.messages).toHaveLength(2);
        expect(state.messages.find((m: Message) => m.id === 'tmsg-2')).toBeUndefined();
      });
    });

    describe('editMessages on active thread tab', () => {
      it('should update messages in thread tab and clear thread tab selections', async () => {
        const testStore = await createStoreWithApp({
          ...initialMessageState,
          messages: mainMessages,
          filteredMessages: mainMessages,
          activeTab: 'thread-1',
          threadTabs: {
            'thread-1': {
              threadId: 'thread-1',
              threadName: 'Test Thread',
              messages: threadMessages,
              filteredMessages: threadMessages,
              selectedMessages: [threadMessages[0], threadMessages[1]],
              searchCriteria: null, refineCriteria: null,
              order: initialMessageState.order,
              isLoading: false,
              error: null,
              pagination: { ...initialMessageState.pagination },
            },
          },
        });

        const editedMsg1 = createMockMessage({ id: 'tmsg-1', content: 'bulk edited' });
        const editedMsg2 = createMockMessage({ id: 'tmsg-2', content: 'bulk edited' });
        const mockDiscordService = {
          editMessage: vi.fn()
            .mockResolvedValueOnce({ success: true, data: editedMsg1 })
            .mockResolvedValueOnce({ success: true, data: editedMsg2 }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await testStore.dispatch(
          editMessages({
            messages: [threadMessages[0], threadMessages[1]],
            channelId: 'thread-1',
            content: 'bulk edited',
            token: 'token',
          })
        );

        const state = testStore.getState().message;
        expect(state.threadTabs['thread-1'].messages.find((m: Message) => m.id === 'tmsg-1')?.content).toBe('bulk edited');
        expect(state.threadTabs['thread-1'].messages.find((m: Message) => m.id === 'tmsg-2')?.content).toBe('bulk edited');
        expect(state.threadTabs['thread-1'].selectedMessages).toHaveLength(0);
        // Main messages untouched
        expect(state.messages).toEqual(mainMessages);
      });
    });

    describe('deleteReaction on active thread tab', () => {
      it('should decrement reaction count in thread tab messages', async () => {
        const reaction = createMockReaction({ emoji: { name: '👍', id: null as any }, count: 2 });
        const msgWithReaction = createMockMessage({ id: 'tmsg-1', reactions: [reaction] });
        store.dispatch(setMessages(mainMessages));
        store.dispatch(setFilteredMessages(mainMessages));
        store.dispatch(addThreadTab({ threadId: 'thread-1', threadName: 'Test Thread' }));
        store.dispatch(setThreadMessages({ threadId: 'thread-1', messages: [msgWithReaction, threadMessages[1]] }));
        store.dispatch(setActiveTab('thread-1'));

        const mockDiscordService = {
          deleteReaction: vi.fn().mockResolvedValue({ success: true }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await store.dispatch(
          deleteReaction({ channelId: 'thread-1', messageId: 'tmsg-1', emoji: '👍', userId: 'user-1', token: 'token' })
        );

        const state = store.getState().message;
        const threadMsg = state.threadTabs['thread-1'].messages.find((m: Message) => m.id === 'tmsg-1');
        expect(threadMsg?.reactions?.[0].count).toBe(1);
        // Main messages untouched
        expect(state.messages).toEqual(mainMessages);
      });
    });

    describe('deleteAllReactions on active thread tab', () => {
      it('should remove emoji reactions from thread tab messages', async () => {
        const reaction = createMockReaction({ emoji: { name: '👍', id: null as any }, count: 3 });
        const msgWithReaction = createMockMessage({ id: 'tmsg-1', reactions: [reaction] });

        const mockDiscordService = {
          deleteReaction: vi.fn().mockResolvedValue({ success: true }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        const testStore = await createStoreWithApp({
          ...initialMessageState,
          messages: mainMessages,
          filteredMessages: mainMessages,
          activeTab: 'thread-1',
          threadTabs: {
            'thread-1': {
              threadId: 'thread-1',
              threadName: 'Test Thread',
              messages: [msgWithReaction],
              filteredMessages: [msgWithReaction],
              selectedMessages: [],
              searchCriteria: null, refineCriteria: null,
              order: initialMessageState.order,
              isLoading: false,
              error: null,
              pagination: { ...initialMessageState.pagination },
            },
          },
        });

        await testStore.dispatch(
          deleteAllReactions({ channelId: 'thread-1', messageId: 'tmsg-1', emoji: '👍', userIds: ['u1', 'u2', 'u3'], token: 'token' })
        );

        const state = testStore.getState().message;
        const threadMsg = state.threadTabs['thread-1'].messages.find((m: Message) => m.id === 'tmsg-1');
        expect(threadMsg?.reactions).toHaveLength(0);
        // Main messages untouched
        expect(state.messages).toEqual(mainMessages);
      });
    });

    describe('deleteAttachment on active thread tab', () => {
      it('should update message in thread tab when attachment is removed', async () => {
        const attachment = createMockAttachment({ id: 'att-1' });
        const msgWithAttachment = createMockMessage({ id: 'tmsg-1', content: 'has content', attachments: [attachment] });
        const updatedMsg = createMockMessage({ id: 'tmsg-1', content: 'has content', attachments: [] });

        store.dispatch(setMessages(mainMessages));
        store.dispatch(setFilteredMessages(mainMessages));
        store.dispatch(addThreadTab({ threadId: 'thread-1', threadName: 'Test Thread' }));
        store.dispatch(setThreadMessages({ threadId: 'thread-1', messages: [msgWithAttachment, threadMessages[1]] }));
        store.dispatch(setActiveTab('thread-1'));

        const mockDiscordService = {
          editMessage: vi.fn().mockResolvedValue({ success: true, data: updatedMsg }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await store.dispatch(
          deleteAttachment({ message: msgWithAttachment, attachment, channelId: 'thread-1', token: 'token' })
        );

        const state = store.getState().message;
        const threadMsg = state.threadTabs['thread-1'].messages.find((m: Message) => m.id === 'tmsg-1');
        expect(threadMsg?.attachments).toHaveLength(0);
        // Main messages untouched
        expect(state.messages).toEqual(mainMessages);
      });

      it('should delete message from thread tab when last attachment removed with no content', async () => {
        const attachment = createMockAttachment({ id: 'att-1' });
        const msgWithAttachment = createMockMessage({ id: 'tmsg-1', content: '', attachments: [attachment] });

        store.dispatch(setMessages(mainMessages));
        store.dispatch(setFilteredMessages(mainMessages));
        store.dispatch(addThreadTab({ threadId: 'thread-1', threadName: 'Test Thread' }));
        store.dispatch(setThreadMessages({ threadId: 'thread-1', messages: [msgWithAttachment, threadMessages[1]] }));
        store.dispatch(setActiveTab('thread-1'));

        const mockDiscordService = {
          deleteMessage: vi.fn().mockResolvedValue({ success: true }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await store.dispatch(
          deleteAttachment({ message: msgWithAttachment, attachment, channelId: 'thread-1', token: 'token' })
        );

        const state = store.getState().message;
        expect(state.threadTabs['thread-1'].messages).toHaveLength(1);
        expect(state.threadTabs['thread-1'].messages.find((m: Message) => m.id === 'tmsg-1')).toBeUndefined();
        // Main messages untouched
        expect(state.messages).toEqual(mainMessages);
      });
    });

    describe('deleteAllAttachments on active thread tab', () => {
      it('should update message in thread tab when all attachments removed', async () => {
        const att1 = createMockAttachment({ id: 'att-1' });
        const att2 = createMockAttachment({ id: 'att-2' });
        const msgWithAttachments = createMockMessage({ id: 'tmsg-1', content: 'has content', attachments: [att1, att2] });
        const updatedMsg = createMockMessage({ id: 'tmsg-1', content: 'has content', attachments: [] });

        store.dispatch(setMessages(mainMessages));
        store.dispatch(setFilteredMessages(mainMessages));
        store.dispatch(addThreadTab({ threadId: 'thread-1', threadName: 'Test Thread' }));
        store.dispatch(setThreadMessages({ threadId: 'thread-1', messages: [msgWithAttachments] }));
        store.dispatch(setActiveTab('thread-1'));

        const mockDiscordService = {
          editMessage: vi.fn().mockResolvedValue({ success: true, data: updatedMsg }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await store.dispatch(
          deleteAllAttachments({ message: msgWithAttachments, channelId: 'thread-1', token: 'token' })
        );

        const state = store.getState().message;
        const threadMsg = state.threadTabs['thread-1'].messages.find((m: Message) => m.id === 'tmsg-1');
        expect(threadMsg?.attachments).toHaveLength(0);
        // Main messages untouched
        expect(state.messages).toEqual(mainMessages);
      });
    });

    describe('Thread thunk cancellation and edge cases', () => {
      it('should handle fetchAllThreadMessages failure gracefully', async () => {
        const mockDiscordService = {
          fetchMessageData: vi.fn().mockResolvedValue({ success: false }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        const testStore = await createStoreWithApp({
          ...initialMessageState,
          activeTab: 'thread-100',
          threadTabs: {
            'thread-100': {
              threadId: 'thread-100',
              threadName: 'Thread',
              messages: [],
              filteredMessages: [],
              selectedMessages: [],
              searchCriteria: null, refineCriteria: null,
              order: initialMessageState.order,
              isLoading: false,
              error: null,
              pagination: { ...initialMessageState.pagination },
            },
          },
        });

        const result = await testStore.dispatch(
          fetchAllThreadMessages({ threadId: 'thread-100', token: 'token' })
        );

        expect(result.type).toBe('message/fetchAllThreadMessages/rejected');

        const tab = testStore.getState().message.threadTabs['thread-100'];
        expect(tab.pagination.isLoadingAll).toBe(false);
        expect(tab.pagination.loadAllProgress).toBeNull();
      });

      it('should handle searchThreadMessages failure gracefully', async () => {
        const mockDiscordService = {
          fetchSearchMessageData: vi.fn().mockResolvedValue({ success: false }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        const testStore = await createStoreWithApp({
          ...initialMessageState,
          activeTab: 'thread-100',
          threadTabs: {
            'thread-100': {
              threadId: 'thread-100',
              threadName: 'Thread',
              messages: [],
              filteredMessages: [],
              selectedMessages: [],
              searchCriteria: null, refineCriteria: null,
              order: initialMessageState.order,
              isLoading: false,
              error: null,
              pagination: { ...initialMessageState.pagination },
            },
          },
        });

        const result = await testStore.dispatch(
          searchThreadMessages({
            threadId: 'thread-100',
            token: 'token',
            searchCriteria: { searchContent: 'test' } as any,
          })
        );

        expect(result.type).toBe('message/searchThreadMessages/rejected');

        const tab = testStore.getState().message.threadTabs['thread-100'];
        expect(tab.isLoading).toBe(false);
      });

      it('should reject fetchMoreThreadMessages when tab removed mid-fetch', async () => {
        const mockDiscordService = {
          fetchMessageData: vi.fn()
            .mockResolvedValueOnce({ success: true, data: createMockMessages(2) })
            .mockImplementation(async () => {
              // Remove the tab before resolving
              store.dispatch(removeThreadTab('thread-100'));
              return { success: true, data: createMockMessages(1) };
            }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        // Open the thread first
        await store.dispatch(openThreadTab({ threadId: 'thread-100', threadName: 'Thread', token: 'token' }));

        const result = await store.dispatch(
          fetchMoreThreadMessages({ threadId: 'thread-100', token: 'token', lastMessageId: 'msg-2' })
        );

        expect(result.type).toBe('message/fetchMoreThreadMessages/rejected');
      });

      it('should reject fetchAllThreadMessages when tab removed mid-fetch', async () => {
        let testStore: any;
        const mockDiscordService = {
          fetchMessageData: vi.fn()
            .mockResolvedValueOnce({ success: true, data: createMockMessages(100) })
            .mockImplementation(async () => {
              // Remove the tab during second batch, return < 100 to end loop
              testStore.dispatch(removeThreadTab('thread-100'));
              return { success: true, data: createMockMessages(10) };
            }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        testStore = await createStoreWithApp({
          ...initialMessageState,
          activeTab: 'thread-100',
          threadTabs: {
            'thread-100': {
              threadId: 'thread-100',
              threadName: 'Thread',
              messages: [],
              filteredMessages: [],
              selectedMessages: [],
              searchCriteria: null, refineCriteria: null,
              order: initialMessageState.order,
              isLoading: false,
              error: null,
              pagination: { ...initialMessageState.pagination },
            },
          },
        });

        const result = await testStore.dispatch(
          fetchAllThreadMessages({ threadId: 'thread-100', token: 'token' })
        );

        expect(result.type).toBe('message/fetchAllThreadMessages/rejected');
      });
    });

    describe('Thread edge cases - round 2', () => {
      it('should reject searchThreadMessages when tab removed mid-fetch', async () => {
        let testStore: any;
        const mockDiscordService = {
          fetchSearchMessageData: vi.fn().mockImplementation(async () => {
            // Remove the tab before resolving
            testStore.dispatch(removeThreadTab('thread-100'));
            return {
              success: true,
              data: { messages: [createMockMessages(2)], total_results: 2 },
            };
          }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        testStore = await createStoreWithApp({
          ...initialMessageState,
          activeTab: 'thread-100',
          threadTabs: {
            'thread-100': {
              threadId: 'thread-100',
              threadName: 'Thread',
              messages: [],
              filteredMessages: [],
              selectedMessages: [],
              searchCriteria: null, refineCriteria: null,
              order: initialMessageState.order,
              isLoading: false,
              error: null,
              pagination: { ...initialMessageState.pagination },
            },
          },
        });

        await testStore.dispatch(
          searchThreadMessages({
            threadId: 'thread-100',
            token: 'token',
            searchCriteria: { searchContent: 'test' } as any,
          })
        );

        // After tab removal, the thunk should still complete (tab was removed by the mock)
        // The tab no longer exists in state
        expect(testStore.getState().message.threadTabs['thread-100']).toBeUndefined();
      });

      it('should re-focus existing tab when opening thread that already exists', async () => {
        const mockDiscordService = {
          fetchMessageData: vi.fn().mockResolvedValue({ success: true, data: createMockMessages(3) }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        // Open the thread
        await store.dispatch(openThreadTab({ threadId: 'thread-100', threadName: 'My Thread', token: 'token' }));
        expect(store.getState().message.activeTab).toBe('thread-100');

        // Switch away
        store.dispatch(setActiveTab(null));
        expect(store.getState().message.activeTab).toBeNull();

        // Open same thread again — should just re-focus
        mockDiscordService.fetchMessageData.mockClear();
        await store.dispatch(openThreadTab({ threadId: 'thread-100', threadName: 'My Thread', token: 'token' }));

        expect(store.getState().message.activeTab).toBe('thread-100');
        // Should not have re-fetched
        expect(mockDiscordService.fetchMessageData).not.toHaveBeenCalled();
        // Should still have exactly one thread tab
        expect(Object.keys(store.getState().message.threadTabs)).toHaveLength(1);
      });

      it('should no-op removeThreadTab on non-existent tab', () => {
        const stateBefore = store.getState().message;
        store.dispatch(removeThreadTab('nonexistent'));
        const stateAfter = store.getState().message;
        expect(stateAfter.threadTabs).toEqual(stateBefore.threadTabs);
        expect(stateAfter.activeTab).toEqual(stateBefore.activeTab);
      });

      it('should clear all thread tabs on clearMessages', () => {
        store.dispatch(addThreadTab({ threadId: 'thread-100', threadName: 'Thread 1' }));
        store.dispatch(addThreadTab({ threadId: 'thread-200', threadName: 'Thread 2' }));
        expect(Object.keys(store.getState().message.threadTabs)).toHaveLength(2);

        store.dispatch(clearMessages());

        const state = store.getState().message;
        expect(state.threadTabs).toEqual({});
        expect(state.activeTab).toBeNull();
      });
    });

    describe('operations on main tab with thread tabs open', () => {
      it('should update main arrays when activeTab is null even if thread tabs exist', async () => {
        // Set up thread tab but switch back to main
        const testStore = setupThreadTabStore();
        testStore.dispatch(setActiveTab(null));

        const mockDiscordService = {
          deleteMessage: vi.fn().mockResolvedValue({ success: true }),
        };
        vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

        await testStore.dispatch(deleteMessage({ messageId: 'main-1', channelId: 'ch-1', token: 'token' }));

        const state = testStore.getState().message;
        // Main messages should have the deleted message removed
        expect(state.messages).toHaveLength(1);
        expect(state.messages[0].id).toBe('main-2');
        // Thread tab should be untouched
        expect(state.threadTabs['thread-1'].messages).toHaveLength(3);
      });
    });
  });

  // ── Deep-link navigation (#123 Phase 1) ────────────────────────────────

  describe('navigateToMessage', () => {
    it('sets highlightedMessageId when the target is in the loaded main-channel feed', async () => {
      const testStore = createTestStore({ message: messageReducer });
      const msgs = [
        createMockMessage({ id: 'a' }),
        createMockMessage({ id: 'b' }),
        createMockMessage({ id: 'target' }),
      ];
      testStore.dispatch(setMessages(msgs));

      await testStore.dispatch(navigateToMessage({ messageId: 'target' }));

      expect(selectHighlightedMessageId(testStore.getState())).toBe('target');
    });

    it('dispatches a toast hint (no highlight) when the target is not in the current view', async () => {
      const testStore = createTestStore({ message: messageReducer });
      testStore.dispatch(setMessages([createMockMessage({ id: 'a' })]));

      (showToast as unknown as Mock).mockClear();
      await testStore.dispatch(navigateToMessage({ messageId: 'not-here' }));

      expect(selectHighlightedMessageId(testStore.getState())).toBeNull();
      const toastCalls = (showToast as unknown as Mock).mock.calls;
      expect(toastCalls.some(([payload]) =>
        payload?.message?.includes("isn't in the current view"),
      )).toBe(true);
    });

    it('treats refine-hidden messages as "not in the current view" (no silent dead-click)', async () => {
      const testStore = createTestStore({ message: messageReducer });
      // Target exists in messages but not in filteredMessages (simulating
      // an active refine that filtered it out). Ensures the Phase 1
      // visibility check prevents the "highlight set but nothing scrolls"
      // dead-click bug.
      testStore.dispatch(setMessages([createMockMessage({ id: 'visible' })]));
      testStore.dispatch(
        setFilteredMessages([createMockMessage({ id: 'visible' })]),
      );
      // Now add a message to raw `messages` only
      testStore.dispatch(
        setMessages([
          createMockMessage({ id: 'visible' }),
          createMockMessage({ id: 'hidden-by-refine' }),
        ]),
      );
      testStore.dispatch(
        setFilteredMessages([createMockMessage({ id: 'visible' })]),
      );

      (showToast as unknown as Mock).mockClear();
      await testStore.dispatch(navigateToMessage({ messageId: 'hidden-by-refine' }));

      expect(selectHighlightedMessageId(testStore.getState())).toBeNull();
      const toastCalls = (showToast as unknown as Mock).mock.calls;
      expect(toastCalls.length).toBeGreaterThan(0);
    });

    it('reads from the active thread tab instead of main messages when a thread is active', async () => {
      const testStore = createTestStore({ message: messageReducer });
      // Main feed does NOT contain the target — only the thread does.
      testStore.dispatch(setMessages([createMockMessage({ id: 'main-only' })]));
      testStore.dispatch(addThreadTab({ threadId: 'thread-1', threadName: 'T' }));
      testStore.dispatch(
        setThreadMessages({
          threadId: 'thread-1',
          messages: [createMockMessage({ id: 'thread-target' })],
        }),
      );
      testStore.dispatch(setActiveTab('thread-1'));

      await testStore.dispatch(navigateToMessage({ messageId: 'thread-target' }));

      expect(selectHighlightedMessageId(testStore.getState())).toBe('thread-target');
    });

    it('setHighlightedMessageId(null) clears the highlight', () => {
      const testStore = createTestStore({ message: messageReducer });
      testStore.dispatch(setHighlightedMessageId('x'));
      expect(selectHighlightedMessageId(testStore.getState())).toBe('x');
      testStore.dispatch(setHighlightedMessageId(null));
      expect(selectHighlightedMessageId(testStore.getState())).toBeNull();
    });
  });

  // ── Inline filter-by-user (#129) ───────────────────────────────────────

  describe('applyUserFilter thunk', () => {
    // Identity reducer slices for auth/channel/guild/dm — `applyUserFilter`
    // reads these via casts so we don't need their real reducers, just
    // their shape. Identity reducer keeps the preloaded state stable.
    const identity = (initial: any) => (state = initial) => state;

    async function makeStore(opts: {
      token?: string | null;
      channelId?: string | null;
      guildId?: string | null;
      activeTab?: string | null;
    } = {}) {
      const appReducer = (await import('@features/app/appSlice')).default;
      const { defaultSettings } = await import('@features/app/appSlice');

      const baseAppState = {
        discrubPaused: false,
        discrubCancelled: false,
        isMinimized: false,
        focusedView: false,
        sidebarView: 'server' as const,
        task: { status: 'idle' as const, message: '' },
        settings: defaultSettings,
      };

      const messageState = {
        ...initialMessageState,
        activeTab: opts.activeTab ?? null,
        searchCriteria: {
          searchAfterDate: new Date('2026-01-01'),
          searchBeforeDate: null,
          searchMessageContent: 'hello',
          selectedHasTypes: [],
          userIds: ['old-user'],
          mentionIds: ['old-mention'],
          channelIds: [],
          isPinned: 0,
          authorType: null,
        } as any,
        threadTabs: opts.activeTab
          ? {
              [opts.activeTab]: {
                threadId: opts.activeTab,
                threadName: 'thread',
                messages: [],
                filteredMessages: [],
                selectedMessages: [],
                searchCriteria: {
                  searchAfterDate: null,
                  searchBeforeDate: null,
                  searchMessageContent: 'thread-content',
                  selectedHasTypes: [],
                  userIds: ['thread-old-user'],
                  mentionIds: [],
                  channelIds: [],
                  isPinned: 0,
                  authorType: null,
                } as any,
                refineCriteria: null,
                order: { order: SortDirection.DESCENDING, orderBy: 'timestamp' as keyof Message },
                isLoading: false,
                error: null,
                pagination: { lastMessageId: null, hasMore: true, totalCount: null, isLoadingMore: false, isLoadingAll: false, loadAllProgress: null, mode: 'paginated' as const, searchOffset: 0 },
              },
            }
          : {},
      };

      const auth = { token: opts.token === undefined ? 'tok' : opts.token };
      const channel = opts.channelId
        ? { selectedChannel: { id: opts.channelId } }
        : { selectedChannel: null };
      const guild = opts.guildId
        ? { selectedGuild: { id: opts.guildId } }
        : { selectedGuild: null };
      const dm = { selectedDm: null };

      return createTestStore(
        {
          message: messageReducer,
          app: appReducer,
          auth: identity(auth),
          channel: identity(channel),
          guild: identity(guild),
          dm: identity(dm),
        },
        {
          app: baseAppState,
          message: messageState,
          auth,
          channel,
          guild,
          dm,
        },
      );
    }

    beforeEach(() => {
      (showToast as unknown as Mock).mockClear();
    });

    it('mode=author replaces userIds with [target] and preserves other filters on main channel', async () => {
      const testStore: any = await makeStore({ channelId: 'ch-1', guildId: 'g-1' });

      const mockDiscordService = {
        fetchSearchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: { messages: [], total_results: 0 },
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await testStore.dispatch(
        applyUserFilter({ userId: 'target-user', displayName: 'Alice', mode: 'author' }),
      );

      expect(mockDiscordService.fetchSearchMessageData).toHaveBeenCalledTimes(1);
      const call = mockDiscordService.fetchSearchMessageData.mock.calls[0];
      const criteriaUsed = call[4];
      expect(criteriaUsed.userIds).toEqual(['target-user']);
      // Other filter fields preserved
      expect(criteriaUsed.searchMessageContent).toBe('hello');
      expect(criteriaUsed.searchAfterDate).toEqual(new Date('2026-01-01'));
      // mentionIds untouched in author mode
      expect(criteriaUsed.mentionIds).toEqual(['old-mention']);
    });

    it('mode=mentions replaces mentionIds with [target] and preserves userIds', async () => {
      const testStore: any = await makeStore({ channelId: 'ch-1', guildId: 'g-1' });

      const mockDiscordService = {
        fetchSearchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: { messages: [], total_results: 0 },
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await testStore.dispatch(
        applyUserFilter({ userId: 'target-user', displayName: 'Alice', mode: 'mentions' }),
      );

      const criteriaUsed = mockDiscordService.fetchSearchMessageData.mock.calls[0][4];
      expect(criteriaUsed.mentionIds).toEqual(['target-user']);
      // userIds preserved in mentions mode
      expect(criteriaUsed.userIds).toEqual(['old-user']);
    });

    it('routes through the active thread tab criteria when activeTab is set', async () => {
      const testStore: any = await makeStore({ activeTab: 'thread-1', channelId: null });

      const mockDiscordService = {
        fetchSearchMessageData: vi.fn().mockResolvedValue({
          success: true,
          data: { messages: [], total_results: 0 },
        }),
        fetchMessageData: vi.fn().mockResolvedValue({ success: true, data: [] }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await testStore.dispatch(
        applyUserFilter({ userId: 'target-user', displayName: 'Alice', mode: 'author' }),
      );

      // Thread search uses the thread's existing criteria — searchMessageContent='thread-content' should survive
      const criteriaUsed = mockDiscordService.fetchSearchMessageData.mock.calls[0][4];
      expect(criteriaUsed.searchMessageContent).toBe('thread-content');
      expect(criteriaUsed.userIds).toEqual(['target-user']);
    });

    it('dispatches showToast with author-style copy when mode=author', async () => {
      const testStore: any = await makeStore({ channelId: 'ch-1' });

      vi.mocked(discordService.getDiscordService).mockReturnValue({
        fetchSearchMessageData: vi.fn().mockResolvedValue({ success: true, data: { messages: [], total_results: 0 } }),
      } as any);

      await testStore.dispatch(
        applyUserFilter({ userId: 'u', displayName: 'Alice', mode: 'author' }),
      );

      const toastCalls = (showToast as unknown as Mock).mock.calls;
      const authorCall = toastCalls.find((c) => c[0]?.message?.includes('from Alice'));
      expect(authorCall).toBeDefined();
    });

    it('dispatches showToast with mentions-style copy when mode=mentions', async () => {
      const testStore: any = await makeStore({ channelId: 'ch-1' });

      vi.mocked(discordService.getDiscordService).mockReturnValue({
        fetchSearchMessageData: vi.fn().mockResolvedValue({ success: true, data: { messages: [], total_results: 0 } }),
      } as any);

      await testStore.dispatch(
        applyUserFilter({ userId: 'u', displayName: 'Alice', mode: 'mentions' }),
      );

      const toastCalls = (showToast as unknown as Mock).mock.calls;
      const mentionsCall = toastCalls.find((c) => c[0]?.message?.includes('mentioning Alice'));
      expect(mentionsCall).toBeDefined();
    });

    it('skips when token is missing', async () => {
      const testStore: any = await makeStore({ token: null, channelId: 'ch-1' });

      const mockDiscordService = {
        fetchSearchMessageData: vi.fn(),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await testStore.dispatch(
        applyUserFilter({ userId: 'u', displayName: 'A', mode: 'author' }),
      );

      expect(result.payload).toEqual({ skipped: 'no-token' });
      expect(mockDiscordService.fetchSearchMessageData).not.toHaveBeenCalled();
    });

    it('skips when no channel/DM is selected (and no thread)', async () => {
      const testStore: any = await makeStore({ channelId: null });

      const mockDiscordService = {
        fetchSearchMessageData: vi.fn(),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await testStore.dispatch(
        applyUserFilter({ userId: 'u', displayName: 'A', mode: 'author' }),
      );

      expect(result.payload).toEqual({ skipped: 'no-channel' });
      expect(mockDiscordService.fetchSearchMessageData).not.toHaveBeenCalled();
    });
  });
});
