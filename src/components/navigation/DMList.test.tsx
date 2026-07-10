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
          channel: { channels: [], selectedChannel: createMockChannel(), selectedChannels: [], isLoading: false, error: null, forumThreads: [], forumFirstMessages: [], isLoadingForumThreads: false, hasMoreForumThreads: false, forumThreadsTotalResults: 0, forumThreadsNextOffset: 0, discoveredThreadsByChannel: {} },
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

  describe('Group DM distinction (#227)', () => {
    const groupDm = (over: Record<string, unknown>) =>
      ({
        id: 'g1',
        type: 3,
        name: null,
        last_message_id: null,
        recipients: [createMockUser({ id: 'u9', username: 'granddemon', global_name: 'GrandDemon', avatar: null })],
        ...over,
      }) as any;

    const renderWithDms = (dms: any[]) =>
      renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms, selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });

    it('marks a one-remaining-recipient group as a group, not a 1:1 DM', () => {
      renderWithDms([groupDm({})]);
      expect(screen.getByTestId('group-dm-indicator')).toHaveTextContent('Group · 2 members');
      // Groups never borrow the recipient's display name as the row title.
      expect(screen.queryByText('GrandDemon')).not.toBeInTheDocument();
      expect(screen.getByText('granddemon')).toBeInTheDocument();
    });

    it('shows the custom group name as the primary label when set', () => {
      renderWithDms([groupDm({ name: 'the lads' })]);
      expect(screen.getByText('the lads')).toBeInTheDocument();
    });

    it('labels an emptied group as "Group DM" with a member count of 1', () => {
      renderWithDms([groupDm({ recipients: [] })]);
      expect(screen.getByText('Group DM')).toBeInTheDocument();
      expect(screen.getByTestId('group-dm-indicator')).toHaveTextContent('Group · 1 member');
    });

    it('does not mark a 1:1 DM as a group', () => {
      renderWithDms([dmWithRecipient]);
      expect(screen.queryByTestId('group-dm-indicator')).not.toBeInTheDocument();
    });
  });

  describe('Shift+Click range select (#218)', () => {
    const mkDm = (id: string, name: string) =>
      ({
        id,
        type: 1,
        last_message_id: null,
        recipients: [createMockUser({ id: `u-${id}`, username: name, avatar: null })],
      }) as any;
    const dms = [mkDm('d1', 'alice'), mkDm('d2', 'bella'), mkDm('d3', 'carol'), mkDm('d4', 'dana')];

    const renderInMultiSelect = () => {
      const utils = renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms, selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      fireEvent.click(screen.getByLabelText('Toggle multi-select'));
      return utils;
    };

    it('selects the whole range between the anchor and a shift-clicked row', () => {
      const { store } = renderInMultiSelect();
      fireEvent.click(screen.getByText('alice'));
      fireEvent.click(screen.getByText('dana'), { shiftKey: true });
      const ids = store.getState().dm.selectedDms.map((d: any) => d.id).sort();
      expect(ids).toEqual(['d1', 'd2', 'd3', 'd4']);
    });

    it('selects a backwards range and unions with the existing selection', () => {
      const { store } = renderInMultiSelect();
      fireEvent.click(screen.getByText('dana'));   // toggle + anchor
      fireEvent.click(screen.getByText('bella'), { shiftKey: true }); // range b→d
      const ids = store.getState().dm.selectedDms.map((d: any) => d.id).sort();
      expect(ids).toEqual(['d2', 'd3', 'd4']);
    });
  });

  describe('Copy Names (multi-select toolbar)', () => {
    it('does not render the Copy button when nothing is selected', () => {
      renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient, dmWithMultiRecipients], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      expect(screen.queryByTestId('multi-select-copy')).toBeNull();
    });

    it('copies only the selected DM recipient names when Copy is clicked in multi-select mode', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient, dmWithMultiRecipients], selectedDm: null, selectedDms: [dmWithRecipient], isLoading: false, error: null },
        }),
      });
      fireEvent.click(screen.getByLabelText('Toggle multi-select'));
      fireEvent.click(screen.getByTestId('multi-select-copy'));
      // Only the selected DM ("Alice") makes it to the clipboard, not "Bob, Charlie"
      expect(writeText).toHaveBeenCalledWith('Alice');
    });

    it('dispatches a toast after copying selected DM names', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      const { store } = renderWithProviders(<DMList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dmWithRecipient, dmWithMultiRecipients], selectedDm: null, selectedDms: [dmWithRecipient], isLoading: false, error: null },
        }),
      });
      fireEvent.click(screen.getByLabelText('Toggle multi-select'));
      fireEvent.click(screen.getByTestId('multi-select-copy'));
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

  /**
   * #135 hard requirement: the Multi-select toggle label stays
   * "Multi-select" in both states. State is conveyed by the button's
   * variant + icon swap, not by switching the text to "Done".
   */
  describe('Multi-select toggle label', () => {
    it('reads "Multi-select" both before and after enabling multi-select mode', () => {
      const dm = createMockChannel({ id: 'dm-1', name: null, type: 1 });
      renderWithProviders(<DMList filterText="" />, {
        preloadedState: createBaseState({
          auth: { token: 't', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          dm: { dms: [dm], selectedDm: null, selectedDms: [], isLoading: false, error: null },
        }),
      });
      const button = screen.getByLabelText('Toggle multi-select');
      expect(button).toHaveTextContent('Multi-select');
      fireEvent.click(button);
      expect(button).toHaveTextContent('Multi-select');
      expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    });
  });
});
