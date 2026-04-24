import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import LoadAllDialog from './LoadAllDialog';
import { createBaseState } from '../../test/state-factories';
import { createMockMessage } from '../../test/fixtures';

vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(() => ({})),
}));

vi.mock('@/extension/storage', () => {
  function makeAdapter() {
    return {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockResolvedValue([]),
      getMany: vi.fn().mockResolvedValue([]),
      setMany: vi.fn().mockResolvedValue(undefined),
      entries: vi.fn().mockResolvedValue([]),
    };
  }
  return {
    storage: {
      settings: makeAdapter(),
      state: makeAdapter(),
      presets: makeAdapter(),
      cache: makeAdapter(),
      history: makeAdapter(),
      statuslog: makeAdapter(),
      package: makeAdapter(),
      media: makeAdapter(),
    },
    migrateAllStorage: vi.fn().mockResolvedValue(undefined),
  };
});

describe('LoadAllDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    contextLabel: 'channel',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Confirmation State', () => {
    it('should render dialog title', () => {
      renderWithProviders(<LoadAllDialog {...defaultProps} />, {
        preloadedState: createBaseState(),
      });
      expect(screen.getByText('Load All Messages')).toBeInTheDocument();
    });

    it('should show warning alert', () => {
      renderWithProviders(<LoadAllDialog {...defaultProps} />, {
        preloadedState: createBaseState(),
      });
      expect(screen.getByText(/load all messages from this channel/)).toBeInTheDocument();
    });

    it('should show currently loaded message count', () => {
      const messages = [createMockMessage({ id: 'm1' }), createMockMessage({ id: 'm2' })];
      renderWithProviders(<LoadAllDialog {...defaultProps} />, {
        preloadedState: createBaseState({
          message: {
            messages,
            filteredMessages: messages,
            selectedMessages: [],
            searchCriteria: null,
            order: { order: 'desc' as any, orderBy: 'timestamp' },
            isLoading: false,
            isEditing: false,
            error: null,
            pagination: {
              lastMessageId: null,
              hasMore: false,
              totalCount: null,
              isLoadingMore: false,
              isLoadingAll: false,
              loadAllProgress: null,
              mode: 'paginated' as any,
            },
          } as any,
        }),
      });
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should show confirmation question', () => {
      renderWithProviders(<LoadAllDialog {...defaultProps} />, {
        preloadedState: createBaseState(),
      });
      expect(screen.getByText('Are you sure you want to continue?')).toBeInTheDocument();
    });

    it('should render Cancel and Load All buttons', () => {
      renderWithProviders(<LoadAllDialog {...defaultProps} />, {
        preloadedState: createBaseState(),
      });
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load All' })).toBeInTheDocument();
    });

    it('should call onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      renderWithProviders(<LoadAllDialog {...defaultProps} onClose={onClose} />, {
        preloadedState: createBaseState(),
      });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalled();
    });

    it('should call onConfirm when Load All is clicked', () => {
      const onConfirm = vi.fn();
      renderWithProviders(<LoadAllDialog {...defaultProps} onConfirm={onConfirm} />, {
        preloadedState: createBaseState(),
      });
      fireEvent.click(screen.getByRole('button', { name: 'Load All' }));
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe('Context-aware text', () => {
    it('should show "channel" when contextLabel is channel', () => {
      renderWithProviders(<LoadAllDialog {...defaultProps} />, {
        preloadedState: createBaseState(),
      });
      expect(screen.getByText(/this channel/)).toBeInTheDocument();
    });

    it('should show "conversation" when contextLabel is conversation', () => {
      renderWithProviders(<LoadAllDialog {...defaultProps} contextLabel="conversation" />, {
        preloadedState: createBaseState(),
      });
      expect(screen.getByText(/this conversation/)).toBeInTheDocument();
      expect(screen.getByText(/for conversations with thousands/)).toBeInTheDocument();
    });

    it('should show "thread" when activeTab is set', () => {
      renderWithProviders(<LoadAllDialog {...defaultProps} />, {
        preloadedState: createBaseState({
          message: {
            messages: [],
            filteredMessages: [],
            selectedMessages: [],
            searchCriteria: null,
            order: { order: 'desc' as any, orderBy: 'timestamp' },
            isLoading: false,
            isEditing: false,
            error: null,
            pagination: {
              lastMessageId: null,
              hasMore: false,
              totalCount: null,
              isLoadingMore: false,
              isLoadingAll: false,
              loadAllProgress: null,
              mode: 'paginated' as any,
            },
            activeTab: 'thread-123',
            threadTabs: {
              'thread-123': {
                threadId: 'thread-123',
                threadName: 'Test Thread',
                messages: [],
                filteredMessages: [],
                selectedMessages: [],
                searchCriteria: null,
                order: { order: 'desc' as any, orderBy: 'timestamp' },
                isLoading: false,
                error: null,
                pagination: {
                  lastMessageId: null,
                  hasMore: false,
                  totalCount: null,
                  isLoadingMore: false,
                  isLoadingAll: false,
                  loadAllProgress: null,
                  mode: 'paginated' as any,
                },
              },
            },
          } as any,
        }),
      });
      expect(screen.getByText(/this thread/)).toBeInTheDocument();
      expect(screen.getByText(/for threads with thousands/)).toBeInTheDocument();
    });
  });
});
