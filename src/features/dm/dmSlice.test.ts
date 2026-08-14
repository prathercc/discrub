import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestStore, TestStore } from '@/test/test-utils';
import dmReducer, {
  setSelectedDm,
  clearDMs,
  toggleDmSelection,
  selectAllDms,
  deselectAllDms,
  fetchDMs,
  fetchDmById,
  parseDmChannelInput,
  selectDm,
  selectDMs,
  selectSelectedDm,
  selectDmLoading,
  selectDmError,
  selectSelectedDms,
} from './dmSlice';
import { initialDmState } from './dmTypes';
import * as discordService from '@services/discordService';
import type { Channel } from 'discrub-core/types/discord-types';

// Mock the Discord service
vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(),
}));

describe('dmSlice', () => {
  let store: TestStore;

  const mockDMs: Channel[] = [
    {
      id: 'dm-1',
      name: 'User One',
      type: 1, // DM
      position: 0,
    } as Channel,
    {
      id: 'dm-2',
      name: 'User Two',
      type: 1, // DM
      position: 1,
    } as Channel,
    {
      id: 'dm-3',
      name: 'Group Chat',
      type: 3, // Group DM
      position: 2,
    } as Channel,
  ];

  beforeEach(() => {
    store = createTestStore({ dm: dmReducer });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState();
      expect(state.dm).toEqual(initialDmState);
      expect(state.dm.dms).toEqual([]);
      expect(state.dm.selectedDm).toBeNull();
      expect(state.dm.isLoading).toBe(false);
      expect(state.dm.error).toBeNull();
    });
  });

  describe('reducers', () => {
    describe('setSelectedDm', () => {
      it('should set selected DM', () => {
        store.dispatch(setSelectedDm(mockDMs[0]));

        const state = store.getState().dm;
        expect(state.selectedDm).toEqual(mockDMs[0]);
      });

      it('should update selected DM when called multiple times', () => {
        store.dispatch(setSelectedDm(mockDMs[0]));
        expect(store.getState().dm.selectedDm?.id).toBe('dm-1');

        store.dispatch(setSelectedDm(mockDMs[1]));
        expect(store.getState().dm.selectedDm?.id).toBe('dm-2');
      });

      it('should handle null DM', () => {
        // First set a DM
        store.dispatch(setSelectedDm(mockDMs[0]));
        expect(store.getState().dm.selectedDm).toEqual(mockDMs[0]);

        // Then set to null
        store.dispatch(setSelectedDm(null));
        expect(store.getState().dm.selectedDm).toBeNull();
      });

      it('should not affect DMs array', () => {
        // Set up initial state with DMs
        store = createTestStore({ dm: dmReducer }, { dm: {
              ...initialDmState,
              dms: mockDMs,
            } });

        store.dispatch(setSelectedDm(mockDMs[0]));

        const state = store.getState().dm;
        expect(state.dms).toEqual(mockDMs);
      });

      it('should handle different DM types', () => {
        // Regular DM
        store.dispatch(setSelectedDm(mockDMs[0]));
        expect(store.getState().dm.selectedDm?.type).toBe(1);

        // Group DM
        store.dispatch(setSelectedDm(mockDMs[2]));
        expect(store.getState().dm.selectedDm?.type).toBe(3);
      });
    });

    describe('clearDMs', () => {
      it('should clear DMs and selected DM', () => {
        // Set up initial state
        store = createTestStore({ dm: dmReducer }, { dm: {
              ...initialDmState,
              dms: mockDMs,
              selectedDm: mockDMs[0],
            } });

        store.dispatch(clearDMs());

        const state = store.getState().dm;
        expect(state.dms).toEqual([]);
        expect(state.selectedDm).toBeNull();
      });

      it('should not affect loading or error state', () => {
        // Set up initial state with error
        store = createTestStore({ dm: dmReducer }, { dm: {
              ...initialDmState,
              dms: mockDMs,
              error: 'Some error',
              isLoading: true,
            } });

        store.dispatch(clearDMs());

        const state = store.getState().dm;
        expect(state.error).toBe('Some error');
        expect(state.isLoading).toBe(true);
      });

      it('should be idempotent', () => {
        store.dispatch(clearDMs());
        const state1 = store.getState().dm;

        store.dispatch(clearDMs());
        const state2 = store.getState().dm;

        expect(state1.dms).toEqual(state2.dms);
        expect(state1.selectedDm).toEqual(state2.selectedDm);
      });
    });
  });

  describe('fetchDMs async thunk', () => {
    it('should set loading state when pending', () => {
      const mockDiscordService = {
        fetchDirectMessages: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(fetchDMs('test-token'));

      const state = store.getState().dm;
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle successful fetch', async () => {
      const mockDiscordService = {
        fetchDirectMessages: vi.fn().mockResolvedValue({
          success: true,
          data: mockDMs,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const token = 'valid-token-123';
      await store.dispatch(fetchDMs(token));

      const state = store.getState().dm;
      expect(state.isLoading).toBe(false);
      expect(state.dms).toEqual(mockDMs);
      expect(state.error).toBeNull();

      expect(mockDiscordService.fetchDirectMessages).toHaveBeenCalledWith(token);
    });

    it('should handle fetch failure with unsuccessful response', async () => {
      const mockDiscordService = {
        fetchDirectMessages: vi.fn().mockResolvedValue({
          success: false,
          data: null,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchDMs('invalid-token'));

      const state = store.getState().dm;
      expect(state.isLoading).toBe(false);
      expect(state.dms).toEqual([]);
      expect(state.error).toBe('Failed to fetch DMs');
    });

    it('should handle fetch failure with null data', async () => {
      const mockDiscordService = {
        fetchDirectMessages: vi.fn().mockResolvedValue({
          success: true,
          data: null,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchDMs('test-token'));

      const state = store.getState().dm;
      expect(state.error).toBe('Failed to fetch DMs');
    });

    it('should handle fetch failure with Error', async () => {
      const errorMessage = 'Network error';
      const mockDiscordService = {
        fetchDirectMessages: vi.fn().mockRejectedValue(new Error(errorMessage)),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchDMs('test-token'));

      const state = store.getState().dm;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should handle fetch failure with non-Error', async () => {
      const mockDiscordService = {
        fetchDirectMessages: vi.fn().mockRejectedValue('String error'),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchDMs('test-token'));

      const state = store.getState().dm;
      expect(state.error).toBe('Failed to fetch DMs');
    });

    it('should clear previous error on successful fetch', async () => {
      // Set initial error
      store = createTestStore({ dm: dmReducer }, { dm: {
            ...initialDmState,
            error: 'Previous error',
          } });

      const mockDiscordService = {
        fetchDirectMessages: vi.fn().mockResolvedValue({
          success: true,
          data: mockDMs,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchDMs('valid-token'));

      const state = store.getState().dm;
      expect(state.error).toBeNull();
      expect(state.dms).toEqual(mockDMs);
    });

    it('should replace previous DMs on new fetch', async () => {
      // Set initial DMs
      store = createTestStore({ dm: dmReducer }, { dm: {
            ...initialDmState,
            dms: [mockDMs[0]],
          } });

      const newDMs = [mockDMs[1], mockDMs[2]];
      const mockDiscordService = {
        fetchDirectMessages: vi.fn().mockResolvedValue({
          success: true,
          data: newDMs,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchDMs('token'));

      const state = store.getState().dm;
      expect(state.dms).toEqual(newDMs);
      expect(state.dms).not.toContain(mockDMs[0]);
    });

    it('should handle empty DMs array', async () => {
      const mockDiscordService = {
        fetchDirectMessages: vi.fn().mockResolvedValue({
          success: true,
          data: [],
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchDMs('token'));

      const state = store.getState().dm;
      expect(state.dms).toEqual([]);
      expect(state.error).toBeNull();
    });

    it('should handle mix of regular and group DMs', async () => {
      const mixedDMs = mockDMs; // Contains both type 1 and type 3
      const mockDiscordService = {
        fetchDirectMessages: vi.fn().mockResolvedValue({
          success: true,
          data: mixedDMs,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchDMs('token'));

      const state = store.getState().dm;
      expect(state.dms).toEqual(mixedDMs);
      expect(state.dms.some((dm: Channel) => dm.type === 1)).toBe(true);
      expect(state.dms.some((dm: Channel) => dm.type === 3)).toBe(true);
    });
  });

  describe('fetchDmById async thunk (#240)', () => {
    const closedDm = {
      id: 'dm-closed',
      type: 1,
      recipients: [],
    } as unknown as Channel;

    const mockFetchChannel = (fetchChannel: ReturnType<typeof vi.fn>) => {
      const svc = { fetchChannel };
      vi.mocked(discordService.getDiscordService).mockReturnValue(svc as any);
      return svc;
    };

    it('fetches a DM channel by id and prepends it to state.dms', async () => {
      store = createTestStore({ dm: dmReducer }, { dm: { ...initialDmState, dms: mockDMs } });
      const svc = mockFetchChannel(
        vi.fn().mockResolvedValue({ success: true, data: closedDm })
      );

      const result = await store.dispatch(
        fetchDmById({ channelId: 'dm-closed', token: 'test-token' })
      );

      expect(result.type).toBe('dm/fetchDmById/fulfilled');
      expect(result.payload).toEqual(closedDm);
      expect(svc.fetchChannel).toHaveBeenCalledWith('test-token', 'dm-closed');

      const state = store.getState().dm;
      expect(state.dms).toHaveLength(4);
      expect(state.dms[0]).toEqual(closedDm);
    });

    it('accepts a group DM (type 3)', async () => {
      const groupDm = { id: 'g-closed', type: 3, recipients: [] } as unknown as Channel;
      mockFetchChannel(vi.fn().mockResolvedValue({ success: true, data: groupDm }));

      const result = await store.dispatch(
        fetchDmById({ channelId: 'g-closed', token: 'test-token' })
      );

      expect(result.type).toBe('dm/fetchDmById/fulfilled');
      expect(store.getState().dm.dms[0]).toEqual(groupDm);
    });

    it('dedupes by id, replacing the existing entry in place', async () => {
      store = createTestStore({ dm: dmReducer }, { dm: { ...initialDmState, dms: mockDMs } });
      const updated = { ...mockDMs[1], name: 'Renamed User Two' } as Channel;
      mockFetchChannel(vi.fn().mockResolvedValue({ success: true, data: updated }));

      await store.dispatch(fetchDmById({ channelId: 'dm-2', token: 'test-token' }));

      const state = store.getState().dm;
      expect(state.dms).toHaveLength(3);
      expect(state.dms[1]).toEqual(updated);
      expect(state.dms.filter((dm: Channel) => dm.id === 'dm-2')).toHaveLength(1);
    });

    it('rejects a non-DM channel type without touching state.dms', async () => {
      store = createTestStore({ dm: dmReducer }, { dm: { ...initialDmState, dms: mockDMs } });
      const guildText = { id: 'chan-1', type: 0 } as unknown as Channel;
      mockFetchChannel(vi.fn().mockResolvedValue({ success: true, data: guildText }));

      const result = await store.dispatch(
        fetchDmById({ channelId: 'chan-1', token: 'test-token' })
      );

      expect(result.type).toBe('dm/fetchDmById/rejected');
      expect(result.payload).toBe('Channel is not a DM');
      expect(store.getState().dm.dms).toEqual(mockDMs);
    });

    it('rejects with a distinguishable error on 403', async () => {
      mockFetchChannel(vi.fn().mockRejectedValue(new Error('Request failed: 403 Forbidden')));

      const result = await store.dispatch(
        fetchDmById({ channelId: 'dm-x', token: 'test-token' })
      );

      expect(result.type).toBe('dm/fetchDmById/rejected');
      expect(result.payload).toBe('No access to this channel');
    });

    it('rejects with "Channel not found" on 404', async () => {
      mockFetchChannel(vi.fn().mockRejectedValue(new Error('Request failed: 404 Not Found')));

      const result = await store.dispatch(
        fetchDmById({ channelId: 'dm-x', token: 'test-token' })
      );

      expect(result.type).toBe('dm/fetchDmById/rejected');
      expect(result.payload).toBe('Channel not found');
    });

    it('rejects with "Channel not found" on an unsuccessful response', async () => {
      mockFetchChannel(vi.fn().mockResolvedValue({ success: false, data: null }));

      const result = await store.dispatch(
        fetchDmById({ channelId: 'dm-x', token: 'test-token' })
      );

      expect(result.type).toBe('dm/fetchDmById/rejected');
      expect(result.payload).toBe('Channel not found');
    });

    it('never touches the shared isLoading/error state (would unmount the dialog)', async () => {
      // Pending: isLoading must stay false or DMList swaps to its skeleton.
      mockFetchChannel(vi.fn().mockImplementation(() => new Promise(() => {})));
      store.dispatch(fetchDmById({ channelId: 'dm-x', token: 'test-token' }));
      expect(store.getState().dm.isLoading).toBe(false);

      // Rejected: error stays local to the dialog, not in the slice.
      mockFetchChannel(vi.fn().mockRejectedValue(new Error('Request failed: 404')));
      await store.dispatch(fetchDmById({ channelId: 'dm-y', token: 'test-token' }));
      expect(store.getState().dm.isLoading).toBe(false);
      expect(store.getState().dm.error).toBeNull();
    });
  });

  describe('parseDmChannelInput (#240)', () => {
    it('accepts a raw 17-20 digit snowflake', () => {
      expect(parseDmChannelInput('10293847561029384')).toBe('10293847561029384'); // 17
      expect(parseDmChannelInput('10293847561029384756')).toBe('10293847561029384756'); // 20
    });

    it('trims surrounding whitespace', () => {
      expect(parseDmChannelInput('  1029384756102938475  ')).toBe('1029384756102938475');
    });

    it('rejects snowflakes outside 17-20 digits', () => {
      expect(parseDmChannelInput('1029384756102938')).toBeNull(); // 16
      expect(parseDmChannelInput('102938475610293847561')).toBeNull(); // 21
    });

    it('extracts the channel id from a discord.com/channels/@me URL', () => {
      expect(
        parseDmChannelInput('https://discord.com/channels/@me/1029384756102938475')
      ).toBe('1029384756102938475');
    });

    it('extracts the CHANNEL id when the URL carries a trailing message id', () => {
      expect(
        parseDmChannelInput(
          'https://discord.com/channels/@me/1029384756102938475/1129384756102938475'
        )
      ).toBe('1029384756102938475');
    });

    it('accepts discordapp.com and PTB/Canary hosts', () => {
      expect(
        parseDmChannelInput('https://discordapp.com/channels/@me/1029384756102938475')
      ).toBe('1029384756102938475');
      expect(
        parseDmChannelInput('https://ptb.discord.com/channels/@me/1029384756102938475')
      ).toBe('1029384756102938475');
    });

    it('rejects guild channel URLs (no @me segment)', () => {
      expect(
        parseDmChannelInput(
          'https://discord.com/channels/10293847561029384756/1029384756102938475'
        )
      ).toBeNull();
    });

    it('rejects garbage and empty input', () => {
      expect(parseDmChannelInput('hello world')).toBeNull();
      expect(parseDmChannelInput('')).toBeNull();
      expect(parseDmChannelInput('12345abc678901234567')).toBeNull();
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      // Set up a known state
      store = createTestStore({ dm: dmReducer }, { dm: {
            dms: mockDMs,
            selectedDm: mockDMs[0],
            selectedDms: [],
            isLoading: false,
            error: 'Test error',
          } });
    });

    it('selectDm should return entire DM state', () => {
      const dm = selectDm(store.getState());
      expect(dm).toHaveProperty('dms');
      expect(dm).toHaveProperty('selectedDm');
      expect(dm).toHaveProperty('isLoading');
      expect(dm).toHaveProperty('error');
    });

    it('selectDMs should return DMs array', () => {
      const dms = selectDMs(store.getState());
      expect(dms).toEqual(mockDMs);
    });

    it('selectSelectedDm should return selected DM', () => {
      const selectedDm = selectSelectedDm(store.getState());
      expect(selectedDm).toEqual(mockDMs[0]);

      store.dispatch(setSelectedDm(null));
      expect(selectSelectedDm(store.getState())).toBeNull();
    });

    it('selectDmLoading should return loading status', () => {
      expect(selectDmLoading(store.getState())).toBe(false);

      // Trigger loading state
      const mockDiscordService = {
        fetchDirectMessages: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(fetchDMs('test'));
      expect(selectDmLoading(store.getState())).toBe(true);
    });

    it('selectDmError should return error', () => {
      const error = selectDmError(store.getState());
      expect(error).toBe('Test error');

      store.dispatch(clearDMs());
      // Error is preserved after clearDMs
      expect(selectDmError(store.getState())).toBe('Test error');
    });

    it('selectSelectedDms should return selected DMs array', () => {
      expect(selectSelectedDms(store.getState())).toEqual([]);
    });
  });

  describe('multi-select reducers', () => {
    beforeEach(() => {
      store = createTestStore({ dm: dmReducer }, {
        dm: {
          ...initialDmState,
          dms: mockDMs,
        },
      });
    });

    describe('toggleDmSelection', () => {
      it('should add DM to selection', () => {
        store.dispatch(toggleDmSelection(mockDMs[0]));
        expect(selectSelectedDms(store.getState())).toEqual([mockDMs[0]]);
      });

      it('should remove DM from selection on second toggle', () => {
        store.dispatch(toggleDmSelection(mockDMs[0]));
        store.dispatch(toggleDmSelection(mockDMs[0]));
        expect(selectSelectedDms(store.getState())).toEqual([]);
      });

      it('should support selecting multiple DMs', () => {
        store.dispatch(toggleDmSelection(mockDMs[0]));
        store.dispatch(toggleDmSelection(mockDMs[1]));
        expect(selectSelectedDms(store.getState())).toHaveLength(2);
      });
    });

    describe('selectAllDms', () => {
      it('should select all DMs', () => {
        store.dispatch(selectAllDms(mockDMs));
        expect(selectSelectedDms(store.getState())).toEqual(mockDMs);
      });
    });

    describe('deselectAllDms', () => {
      it('should deselect all DMs', () => {
        store.dispatch(selectAllDms(mockDMs));
        store.dispatch(deselectAllDms());
        expect(selectSelectedDms(store.getState())).toEqual([]);
      });
    });

    it('clearDMs should also clear selectedDms', () => {
      store.dispatch(toggleDmSelection(mockDMs[0]));
      store.dispatch(clearDMs());
      expect(selectSelectedDms(store.getState())).toEqual([]);
    });
  });
});
