import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import DMList from './DMList';
import { createBaseState } from '../../test/state-factories';
import { createMockUser, createMockChannel } from '../../test/fixtures';

vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(() => ({
    fetchDMs: vi.fn().mockResolvedValue([]),
    fetchMessages: vi.fn().mockResolvedValue({ messages: [], hasMore: false }),
  })),
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

const dmWithRecipient = {
  id: 'dm-1',
  type: 1,
  last_message_id: 'msg-100',
  recipients: [createMockUser({ id: 'u1', username: 'Alice', avatar: 'avt1' })],
} as any;

const dmWithMultiRecipients = {
  id: 'dm-2',
  type: 1,
  last_message_id: 'msg-200',
  recipients: [
    createMockUser({ id: 'u2', username: 'Bob', avatar: null }),
    createMockUser({ id: 'u3', username: 'Charlie', avatar: null }),
  ],
} as any;

const dmWithNoRecipients = {
  id: 'dm-3',
  type: 1,
  last_message_id: null,
  recipients: [],
} as any;

describe('DMList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner when DMs are loading', () => {
      renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: null, isAuthenticated: false, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [], selectedDm: null, selectedDms: [], isLoading: true, error: null },
        }),
      });
      expect(screen.queryByText('Loading DMs...')).not.toBeInTheDocument();
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('should show "No direct messages found" when no DMs exist and no token', () => {
      renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: null, isAuthenticated: false, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      expect(screen.getByText('No direct messages found')).toBeInTheDocument();
    });

    it('should show filter empty state when filter matches nothing', () => {
      renderWithProviders(<DMList filterText="nobody" />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      expect(screen.getByText(/No DMs matching "nobody"/)).toBeInTheDocument();
    });
  });

  describe('DM Rendering', () => {
    it('should render DM recipient usernames', () => {
      renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient, dmWithMultiRecipients], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob, Charlie')).toBeInTheDocument();
    });

    it('should show "Direct Message" for DMs with no recipients', () => {
      renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithNoRecipients], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      expect(screen.getByText('Direct Message')).toBeInTheDocument();
    });

    it('should render "Direct Messages" header', () => {
      renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      expect(screen.getByText('Direct Messages')).toBeInTheDocument();
    });

    it('should render avatar with CDN URL when recipient has avatar', () => {
      renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', expect.stringContaining('cdn.discordapp.com'));
    });
  });

  describe('Filtering', () => {
    it('should filter DMs by recipient name', () => {
      renderWithProviders(<DMList filterText="Alice" />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient, dmWithMultiRecipients], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('Bob, Charlie')).toBeNull();
    });

    it('should filter case-insensitively', () => {
      renderWithProviders(<DMList filterText="alice" />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('should dispatch setSelectedDm when a DM is clicked', () => {
      const { store } = renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient, dmWithMultiRecipients], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      fireEvent.click(screen.getByText('Alice'));
      expect(store.getState().dm.selectedDm?.id).toBe('dm-1');
    });

    it('should clear channel selection on DM click', () => {
      const { store } = renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          channel: { channels: [], selectedChannel: createMockChannel(), selectedChannels: [], isLoading: false, error: null, forumThreads: [], forumFirstMessages: [], isLoadingForumThreads: false, hasMoreForumThreads: false, forumThreadsTotalResults: 0, forumThreadsNextOffset: 0 },
          dm: { dms: [dmWithRecipient], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      fireEvent.click(screen.getByText('Alice'));
      expect(store.getState().channel.selectedChannel).toBeNull();
    });

    it('should mark selected DM as selected', () => {
      renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient, dmWithMultiRecipients], selectedDm: dmWithRecipient, selectedDms: [], isLoading: false, error: null },
        }),
      });
      const aliceButton = screen.getByText('Alice').closest('[role="button"]');
      expect(aliceButton).toHaveClass('Mui-selected');
    });
  });

  describe('Copy Names', () => {
    it('should render copy button in header', () => {
      renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient, dmWithMultiRecipients], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      expect(screen.getByLabelText('Copy DM names')).toBeInTheDocument();
    });

    it('should copy DM recipient names to clipboard when copy button clicked', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient, dmWithMultiRecipients], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      fireEvent.click(screen.getByLabelText('Copy DM names'));
      expect(writeText).toHaveBeenCalledWith('Alice\nBob, Charlie');
    });

    it('should dispatch toast after copying', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      const { store } = renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient, dmWithMultiRecipients], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      fireEvent.click(screen.getByLabelText('Copy DM names'));
      expect(store.getState().status.toast.isVisible).toBe(true);
      expect(store.getState().status.toast.message).toBe('Copied to clipboard');
    });
  });

  /**
   * Bug fix: the contextual tour's step 1 targets
   * `[data-tour="multi-select-toggle"]`. When the user lands in DM view
   * directly on cold boot, the ChannelList (which had the attribute) is
   * NOT rendered — without the same attribute on DMList's toggle, the
   * tour would fire with a missing target and leave an orphaned gray
   * overlay blocking all clicks.
   */
  describe('Tour target attribute', () => {
    it('multi-select toggle carries the data-tour attribute for Joyride', () => {
      const dm = createMockChannel({ id: 'dm-1', name: null, type: 1 });
      renderWithProviders(<DMList filterText="" />, {
        preloadedState: createBaseState({
          auth: { token: 't', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dm], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      const button = screen.getByLabelText('Toggle multi-select');
      expect(button.getAttribute('data-tour')).toBe('multi-select-toggle');
    });
  });
});
