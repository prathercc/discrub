import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestStore, TestStore } from '@/test/test-utils';
import channelReducer, {
  setSelectedChannel,
  clearChannels,
  toggleChannelSelection,
  selectAllChannels,
  deselectAllChannels,
  fetchChannels,
  fetchChannelById,
  selectChannel,
  selectChannels,
  selectSelectedChannel,
  selectChannelLoading,
  selectChannelError,
  selectSelectedChannels,
} from './channelSlice';
import { initialChannelState } from './channelTypes';
import * as discordService from '@services/discordService';
import type { Channel } from 'discrub-core/types/discord-types';

// Mock the Discord service
vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(),
}));

describe('channelSlice', () => {
  let store: TestStore;

  const mockChannels: Channel[] = [
    {
      id: 'channel-1',
      name: 'general',
      type: 0,
      position: 0,
    } as Channel,
    {
      id: 'channel-2',
      name: 'announcements',
      type: 0,
      position: 1,
    } as Channel,
    {
      id: 'channel-3',
      name: 'voice-channel',
      type: 2,
      position: 2,
    } as Channel,
  ];

  beforeEach(() => {
    store = createTestStore({ channel: channelReducer });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState();
      expect(state.channel).toEqual(initialChannelState);
      expect(state.channel.channels).toEqual([]);
      expect(state.channel.selectedChannel).toBeNull();
      expect(state.channel.isLoading).toBe(false);
      expect(state.channel.error).toBeNull();
    });
  });

  describe('reducers', () => {
    describe('setSelectedChannel', () => {
      it('should set selected channel', () => {
        store.dispatch(setSelectedChannel(mockChannels[0]));

        const state = store.getState().channel;
        expect(state.selectedChannel).toEqual(mockChannels[0]);
      });

      it('should update selected channel when called multiple times', () => {
        store.dispatch(setSelectedChannel(mockChannels[0]));
        expect(store.getState().channel.selectedChannel?.id).toBe('channel-1');

        store.dispatch(setSelectedChannel(mockChannels[1]));
        expect(store.getState().channel.selectedChannel?.id).toBe('channel-2');
      });

      it('should handle null channel', () => {
        // First set a channel
        store.dispatch(setSelectedChannel(mockChannels[0]));
        expect(store.getState().channel.selectedChannel).toEqual(mockChannels[0]);

        // Then set to null
        store.dispatch(setSelectedChannel(null));
        expect(store.getState().channel.selectedChannel).toBeNull();
      });

      it('should not affect channels array', () => {
        // Set up initial state with channels
        store = createTestStore({ channel: channelReducer }, { channel: {
              ...initialChannelState,
              channels: mockChannels,
            } });

        store.dispatch(setSelectedChannel(mockChannels[0]));

        const state = store.getState().channel;
        expect(state.channels).toEqual(mockChannels);
      });

      it('should handle different channel types', () => {
        // Text channel
        store.dispatch(setSelectedChannel(mockChannels[0]));
        expect(store.getState().channel.selectedChannel?.type).toBe(0);

        // Voice channel
        store.dispatch(setSelectedChannel(mockChannels[2]));
        expect(store.getState().channel.selectedChannel?.type).toBe(2);
      });
    });

    describe('clearChannels', () => {
      it('should clear channels and selected channel', () => {
        // Set up initial state
        store = createTestStore({ channel: channelReducer }, { channel: {
              ...initialChannelState,
              channels: mockChannels,
              selectedChannel: mockChannels[0],
            } });

        store.dispatch(clearChannels());

        const state = store.getState().channel;
        expect(state.channels).toEqual([]);
        expect(state.selectedChannel).toBeNull();
      });

      it('should not affect loading or error state', () => {
        // Set up initial state with error
        store = createTestStore({ channel: channelReducer }, { channel: {
              ...initialChannelState,
              channels: mockChannels,
              error: 'Some error',
              isLoading: true,
            } });

        store.dispatch(clearChannels());

        const state = store.getState().channel;
        expect(state.error).toBe('Some error');
        expect(state.isLoading).toBe(true);
      });

      it('should be idempotent', () => {
        store.dispatch(clearChannels());
        const state1 = store.getState().channel;

        store.dispatch(clearChannels());
        const state2 = store.getState().channel;

        expect(state1.channels).toEqual(state2.channels);
        expect(state1.selectedChannel).toEqual(state2.selectedChannel);
      });
    });
  });

  describe('fetchChannels async thunk', () => {
    it('should set loading state when pending', () => {
      const mockDiscordService = {
        fetchChannels: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(fetchChannels({ guildId: 'guild-1', token: 'test-token' }));

      const state = store.getState().channel;
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle successful fetch', async () => {
      const mockDiscordService = {
        fetchChannels: vi.fn().mockResolvedValue({
          success: true,
          data: mockChannels,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const params = { guildId: 'guild-1', token: 'valid-token' };
      await store.dispatch(fetchChannels(params));

      const state = store.getState().channel;
      expect(state.isLoading).toBe(false);
      expect(state.channels).toEqual(mockChannels);
      expect(state.error).toBeNull();

      expect(mockDiscordService.fetchChannels).toHaveBeenCalledWith(
        params.token,
        params.guildId
      );
    });

    it('should handle fetch failure with unsuccessful response', async () => {
      const mockDiscordService = {
        fetchChannels: vi.fn().mockResolvedValue({
          success: false,
          data: null,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchChannels({ guildId: 'guild-1', token: 'invalid-token' }));

      const state = store.getState().channel;
      expect(state.isLoading).toBe(false);
      expect(state.channels).toEqual([]);
      expect(state.error).toBe('Failed to fetch channels');
    });

    it('should handle fetch failure with null data', async () => {
      const mockDiscordService = {
        fetchChannels: vi.fn().mockResolvedValue({
          success: true,
          data: null,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchChannels({ guildId: 'guild-1', token: 'test-token' }));

      const state = store.getState().channel;
      expect(state.error).toBe('Failed to fetch channels');
    });

    it('should handle fetch failure with Error', async () => {
      const errorMessage = 'Network error';
      const mockDiscordService = {
        fetchChannels: vi.fn().mockRejectedValue(new Error(errorMessage)),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchChannels({ guildId: 'guild-1', token: 'test-token' }));

      const state = store.getState().channel;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should handle fetch failure with non-Error', async () => {
      const mockDiscordService = {
        fetchChannels: vi.fn().mockRejectedValue('String error'),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchChannels({ guildId: 'guild-1', token: 'test-token' }));

      const state = store.getState().channel;
      expect(state.error).toBe('Failed to fetch channels');
    });

    it('should clear previous error on successful fetch', async () => {
      // Set initial error
      store = createTestStore({ channel: channelReducer }, { channel: {
            ...initialChannelState,
            error: 'Previous error',
          } });

      const mockDiscordService = {
        fetchChannels: vi.fn().mockResolvedValue({
          success: true,
          data: mockChannels,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchChannels({ guildId: 'guild-1', token: 'valid-token' }));

      const state = store.getState().channel;
      expect(state.error).toBeNull();
      expect(state.channels).toEqual(mockChannels);
    });

    it('should replace previous channels on new fetch', async () => {
      // Set initial channels
      store = createTestStore({ channel: channelReducer }, { channel: {
            ...initialChannelState,
            channels: [mockChannels[0]],
          } });

      const newChannels = [mockChannels[1], mockChannels[2]];
      const mockDiscordService = {
        fetchChannels: vi.fn().mockResolvedValue({
          success: true,
          data: newChannels,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchChannels({ guildId: 'guild-1', token: 'token' }));

      const state = store.getState().channel;
      expect(state.channels).toEqual(newChannels);
      expect(state.channels).not.toContain(mockChannels[0]);
    });

    it('should fetch channels for specific guild', async () => {
      const mockDiscordService = {
        fetchChannels: vi.fn().mockResolvedValue({
          success: true,
          data: mockChannels,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchChannels({ guildId: 'guild-123', token: 'token' }));

      expect(mockDiscordService.fetchChannels).toHaveBeenCalledWith('token', 'guild-123');
    });

    it('should handle empty channels array', async () => {
      const mockDiscordService = {
        fetchChannels: vi.fn().mockResolvedValue({
          success: true,
          data: [],
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchChannels({ guildId: 'guild-1', token: 'token' }));

      const state = store.getState().channel;
      expect(state.channels).toEqual([]);
      expect(state.error).toBeNull();
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      // Set up a known state
      store = createTestStore({ channel: channelReducer }, { channel: {
            channels: mockChannels,
            selectedChannel: mockChannels[0],
            selectedChannels: [],
            isLoading: false,
            error: 'Test error',
          } });
    });

    it('selectChannel should return entire channel state', () => {
      const channel = selectChannel(store.getState());
      expect(channel).toHaveProperty('channels');
      expect(channel).toHaveProperty('selectedChannel');
      expect(channel).toHaveProperty('isLoading');
      expect(channel).toHaveProperty('error');
    });

    it('selectChannels should return channels array', () => {
      const channels = selectChannels(store.getState());
      expect(channels).toEqual(mockChannels);
    });

    it('selectSelectedChannel should return selected channel', () => {
      const selectedChannel = selectSelectedChannel(store.getState());
      expect(selectedChannel).toEqual(mockChannels[0]);

      store.dispatch(setSelectedChannel(null));
      expect(selectSelectedChannel(store.getState())).toBeNull();
    });

    it('selectChannelLoading should return loading status', () => {
      expect(selectChannelLoading(store.getState())).toBe(false);

      // Trigger loading state
      const mockDiscordService = {
        fetchChannels: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(fetchChannels({ guildId: 'guild-1', token: 'test' }));
      expect(selectChannelLoading(store.getState())).toBe(true);
    });

    it('selectChannelError should return error', () => {
      const error = selectChannelError(store.getState());
      expect(error).toBe('Test error');

      store.dispatch(clearChannels());
      // Error is preserved after clearChannels
      expect(selectChannelError(store.getState())).toBe('Test error');
    });

    it('selectSelectedChannels should return selected channels array', () => {
      expect(selectSelectedChannels(store.getState())).toEqual([]);
    });
  });

  describe('multi-select reducers', () => {
    beforeEach(() => {
      store = createTestStore({ channel: channelReducer }, {
        channel: {
          ...initialChannelState,
          channels: mockChannels,
        },
      });
    });

    describe('toggleChannelSelection', () => {
      it('should add channel to selection', () => {
        store.dispatch(toggleChannelSelection(mockChannels[0]));
        expect(selectSelectedChannels(store.getState())).toEqual([mockChannels[0]]);
      });

      it('should remove channel from selection on second toggle', () => {
        store.dispatch(toggleChannelSelection(mockChannels[0]));
        store.dispatch(toggleChannelSelection(mockChannels[0]));
        expect(selectSelectedChannels(store.getState())).toEqual([]);
      });

      it('should support selecting multiple channels', () => {
        store.dispatch(toggleChannelSelection(mockChannels[0]));
        store.dispatch(toggleChannelSelection(mockChannels[1]));
        expect(selectSelectedChannels(store.getState())).toHaveLength(2);
      });
    });

    describe('selectAllChannels', () => {
      it('should select all channels', () => {
        store.dispatch(selectAllChannels(mockChannels));
        expect(selectSelectedChannels(store.getState())).toEqual(mockChannels);
      });
    });

    describe('deselectAllChannels', () => {
      it('should deselect all channels', () => {
        store.dispatch(selectAllChannels(mockChannels));
        store.dispatch(deselectAllChannels());
        expect(selectSelectedChannels(store.getState())).toEqual([]);
      });
    });

    it('clearChannels should also clear selectedChannels', () => {
      store.dispatch(toggleChannelSelection(mockChannels[0]));
      store.dispatch(clearChannels());
      expect(selectSelectedChannels(store.getState())).toEqual([]);
    });
  });

  describe('cross-server selection persistence (#125)', () => {
    it('clears selectedChannels when the selected guild changes', async () => {
      const { setSelectedGuild } = await import('@features/guild/guildSlice');
      const guildReducer = (await import('@features/guild/guildSlice')).default;

      store = createTestStore(
        { channel: channelReducer, guild: guildReducer },
        {
          channel: {
            ...initialChannelState,
            channels: mockChannels,
            selectedChannels: [mockChannels[0], mockChannels[1]],
          },
        },
      );

      // Sanity: selections start populated (as if the user had entered
      // multi-select mode and picked channels in the previous server)
      expect(selectSelectedChannels(store.getState())).toHaveLength(2);

      // Switching servers must wipe prior multi-select state — otherwise
      // the user's old targets ride into destructive bulk ops on the new
      // server.
      store.dispatch(setSelectedGuild({ id: 'guild-2', name: 'Other Server' } as any));
      expect(selectSelectedChannels(store.getState())).toEqual([]);
    });

    it('clears selection even when guild is set to null (e.g., back-to-server-list)', async () => {
      const { setSelectedGuild } = await import('@features/guild/guildSlice');
      const guildReducer = (await import('@features/guild/guildSlice')).default;

      store = createTestStore(
        { channel: channelReducer, guild: guildReducer },
        {
          channel: {
            ...initialChannelState,
            selectedChannels: [mockChannels[0]],
          },
        },
      );

      store.dispatch(setSelectedGuild(null));
      expect(selectSelectedChannels(store.getState())).toEqual([]);
    });
  });

  describe('fetchChannelById async thunk', () => {
    it('should fetch channel by ID successfully', async () => {
      const threadChannel: Channel = {
        id: 'thread-1',
        name: 'my-thread',
        type: 11,
      } as Channel;

      const mockDiscordService = {
        fetchChannel: vi.fn().mockResolvedValue({
          success: true,
          data: threadChannel,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(fetchChannelById({ channelId: 'thread-1', token: 'test-token' }));

      expect(result.type).toBe('channel/fetchChannelById/fulfilled');
      expect(result.payload).toEqual(threadChannel);
      expect(mockDiscordService.fetchChannel).toHaveBeenCalledWith('test-token', 'thread-1');
    });

    it('should reject when thread not found (unsuccessful response)', async () => {
      const mockDiscordService = {
        fetchChannel: vi.fn().mockResolvedValue({
          success: false,
          data: null,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(fetchChannelById({ channelId: 'nonexistent', token: 'test-token' }));

      expect(result.type).toBe('channel/fetchChannelById/rejected');
      expect(result.payload).toBe('Thread not found');
    });

    it('should reject with access error when 403 forbidden', async () => {
      const mockDiscordService = {
        fetchChannel: vi.fn().mockRejectedValue(new Error('403 Forbidden')),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(fetchChannelById({ channelId: 'private-thread', token: 'test-token' }));

      expect(result.type).toBe('channel/fetchChannelById/rejected');
      expect(result.payload).toBe('No access to this thread');
    });

    it('should handle generic errors', async () => {
      const mockDiscordService = {
        fetchChannel: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(fetchChannelById({ channelId: 'thread-1', token: 'test-token' }));

      expect(result.type).toBe('channel/fetchChannelById/rejected');
      expect(result.payload).toBe('Network error');
    });

    it('should handle non-Error exceptions', async () => {
      const mockDiscordService = {
        fetchChannel: vi.fn().mockRejectedValue('Unknown failure'),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const result = await store.dispatch(fetchChannelById({ channelId: 'thread-1', token: 'test-token' }));

      expect(result.type).toBe('channel/fetchChannelById/rejected');
      expect(result.payload).toBe('Failed to fetch thread');
    });
  });
});
