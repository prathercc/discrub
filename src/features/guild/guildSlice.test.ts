import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestStore, TestStore } from '@/test/test-utils';
import guildReducer, {
  setSelectedGuild,
  clearGuilds,
  fetchGuilds,
  fetchRoles,
  selectGuild,
  selectGuilds,
  selectSelectedGuild,
  selectRoles,
  selectGuildLoading,
  selectGuildError,
} from './guildSlice';
import { initialGuildState } from './guildTypes';
import * as discordService from '@services/discordService';
import type { Guild, Role } from 'discrub-core/types/discord-types';

// Mock the Discord service
vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(),
}));

describe('guildSlice', () => {
  let store: TestStore;

  const mockGuilds: Guild[] = [
    {
      id: 'guild-1',
      name: 'Test Guild 1',
      icon: 'icon-1',
      owner: false,
      permissions: '0',
    } as Guild,
    {
      id: 'guild-2',
      name: 'Test Guild 2',
      icon: 'icon-2',
      owner: true,
      permissions: '0',
    } as Guild,
  ];

  const mockRoles: Role[] = [
    {
      id: 'role-1',
      name: 'Admin',
      color: 0xff0000,
      permissions: '8',
      position: 2,
    } as Role,
    {
      id: 'role-2',
      name: 'Member',
      color: 0x00ff00,
      permissions: '0',
      position: 1,
    } as Role,
  ];

  beforeEach(() => {
    store = createTestStore({ guild: guildReducer });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState();
      expect(state.guild).toEqual(initialGuildState);
      expect(state.guild.guilds).toEqual([]);
      expect(state.guild.selectedGuild).toBeNull();
      expect(state.guild.roles).toEqual([]);
      expect(state.guild.isLoading).toBe(false);
      expect(state.guild.error).toBeNull();
    });
  });

  describe('reducers', () => {
    describe('setSelectedGuild', () => {
      it('should set selected guild', () => {
        store.dispatch(setSelectedGuild(mockGuilds[0]));

        const state = store.getState().guild;
        expect(state.selectedGuild).toEqual(mockGuilds[0]);
      });

      it('should update selected guild when called multiple times', () => {
        store.dispatch(setSelectedGuild(mockGuilds[0]));
        expect(store.getState().guild.selectedGuild?.id).toBe('guild-1');

        store.dispatch(setSelectedGuild(mockGuilds[1]));
        expect(store.getState().guild.selectedGuild?.id).toBe('guild-2');
      });

      it('should handle null guild', () => {
        // First set a guild
        store.dispatch(setSelectedGuild(mockGuilds[0]));
        expect(store.getState().guild.selectedGuild).toEqual(mockGuilds[0]);

        // Then set to null
        store.dispatch(setSelectedGuild(null));
        expect(store.getState().guild.selectedGuild).toBeNull();
      });

      it('should not affect guilds or roles', () => {
        // Set up initial state with guilds and roles
        store = createTestStore({ guild: guildReducer }, { guild: {
              ...initialGuildState,
              guilds: mockGuilds,
              roles: mockRoles,
            } });

        store.dispatch(setSelectedGuild(mockGuilds[0]));

        const state = store.getState().guild;
        expect(state.guilds).toEqual(mockGuilds);
        expect(state.roles).toEqual(mockRoles);
      });
    });

    describe('clearGuilds', () => {
      it('should clear guilds, selected guild, and roles', () => {
        // Set up initial state
        store = createTestStore({ guild: guildReducer }, { guild: {
              ...initialGuildState,
              guilds: mockGuilds,
              selectedGuild: mockGuilds[0],
              roles: mockRoles,
            } });

        store.dispatch(clearGuilds());

        const state = store.getState().guild;
        expect(state.guilds).toEqual([]);
        expect(state.selectedGuild).toBeNull();
        expect(state.roles).toEqual([]);
      });

      it('should not affect loading or error state', () => {
        // Set up initial state with error
        store = createTestStore({ guild: guildReducer }, { guild: {
              ...initialGuildState,
              guilds: mockGuilds,
              error: 'Some error',
              isLoading: true,
            } });

        store.dispatch(clearGuilds());

        const state = store.getState().guild;
        expect(state.error).toBe('Some error');
        expect(state.isLoading).toBe(true);
      });

      it('should be idempotent', () => {
        store.dispatch(clearGuilds());
        const state1 = store.getState().guild;

        store.dispatch(clearGuilds());
        const state2 = store.getState().guild;

        expect(state1.guilds).toEqual(state2.guilds);
        expect(state1.selectedGuild).toEqual(state2.selectedGuild);
        expect(state1.roles).toEqual(state2.roles);
      });
    });
  });

  describe('fetchGuilds async thunk', () => {
    it('should set loading state when pending', () => {
      const mockDiscordService = {
        fetchGuilds: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(fetchGuilds('test-token'));

      const state = store.getState().guild;
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle successful fetch', async () => {
      const mockDiscordService = {
        fetchGuilds: vi.fn().mockResolvedValue({
          success: true,
          data: mockGuilds,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const token = 'valid-token-123';
      await store.dispatch(fetchGuilds(token));

      const state = store.getState().guild;
      expect(state.isLoading).toBe(false);
      expect(state.guilds).toEqual(mockGuilds);
      expect(state.error).toBeNull();

      expect(mockDiscordService.fetchGuilds).toHaveBeenCalledWith(token);
    });

    it('should handle fetch failure with unsuccessful response', async () => {
      const mockDiscordService = {
        fetchGuilds: vi.fn().mockResolvedValue({
          success: false,
          data: null,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchGuilds('invalid-token'));

      const state = store.getState().guild;
      expect(state.isLoading).toBe(false);
      expect(state.guilds).toEqual([]);
      expect(state.error).toBe('Failed to fetch guilds');
    });

    it('should handle fetch failure with null data', async () => {
      const mockDiscordService = {
        fetchGuilds: vi.fn().mockResolvedValue({
          success: true,
          data: null,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchGuilds('test-token'));

      const state = store.getState().guild;
      expect(state.error).toBe('Failed to fetch guilds');
    });

    it('should handle fetch failure with Error', async () => {
      const errorMessage = 'Network error';
      const mockDiscordService = {
        fetchGuilds: vi.fn().mockRejectedValue(new Error(errorMessage)),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchGuilds('test-token'));

      const state = store.getState().guild;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should handle fetch failure with non-Error', async () => {
      const mockDiscordService = {
        fetchGuilds: vi.fn().mockRejectedValue('String error'),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchGuilds('test-token'));

      const state = store.getState().guild;
      expect(state.error).toBe('Failed to fetch guilds');
    });

    it('should clear previous error on successful fetch', async () => {
      // Set initial error
      store = createTestStore({ guild: guildReducer }, { guild: {
            ...initialGuildState,
            error: 'Previous error',
          } });

      const mockDiscordService = {
        fetchGuilds: vi.fn().mockResolvedValue({
          success: true,
          data: mockGuilds,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchGuilds('valid-token'));

      const state = store.getState().guild;
      expect(state.error).toBeNull();
      expect(state.guilds).toEqual(mockGuilds);
    });

    it('should replace previous guilds on new fetch', async () => {
      // Set initial guilds
      store = createTestStore({ guild: guildReducer }, { guild: {
            ...initialGuildState,
            guilds: [mockGuilds[0]],
          } });

      const newGuilds = [mockGuilds[1]];
      const mockDiscordService = {
        fetchGuilds: vi.fn().mockResolvedValue({
          success: true,
          data: newGuilds,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchGuilds('token'));

      const state = store.getState().guild;
      expect(state.guilds).toEqual(newGuilds);
      expect(state.guilds).not.toContain(mockGuilds[0]);
    });
  });

  describe('fetchRoles async thunk', () => {
    it('should set loading state when pending', () => {
      const mockDiscordService = {
        fetchRoles: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(fetchRoles({ guildId: 'guild-1', token: 'test-token' }));

      const state = store.getState().guild;
      expect(state.isLoading).toBe(true);
    });

    it('should handle successful fetch', async () => {
      const mockDiscordService = {
        fetchRoles: vi.fn().mockResolvedValue({
          success: true,
          data: mockRoles,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const params = { guildId: 'guild-1', token: 'valid-token' };
      await store.dispatch(fetchRoles(params));

      const state = store.getState().guild;
      expect(state.isLoading).toBe(false);
      expect(state.roles).toEqual(mockRoles);

      expect(mockDiscordService.fetchRoles).toHaveBeenCalledWith(
        params.guildId,
        params.token
      );
    });

    it('should handle fetch failure with unsuccessful response', async () => {
      const mockDiscordService = {
        fetchRoles: vi.fn().mockResolvedValue({
          success: false,
          data: null,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchRoles({ guildId: 'guild-1', token: 'invalid-token' }));

      const state = store.getState().guild;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Failed to fetch roles');
    });

    it('should handle fetch failure with null data', async () => {
      const mockDiscordService = {
        fetchRoles: vi.fn().mockResolvedValue({
          success: true,
          data: null,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchRoles({ guildId: 'guild-1', token: 'test-token' }));

      const state = store.getState().guild;
      expect(state.error).toBe('Failed to fetch roles');
    });

    it('should handle fetch failure with Error', async () => {
      const errorMessage = 'Permission denied';
      const mockDiscordService = {
        fetchRoles: vi.fn().mockRejectedValue(new Error(errorMessage)),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchRoles({ guildId: 'guild-1', token: 'test-token' }));

      const state = store.getState().guild;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should handle fetch failure with non-Error', async () => {
      const mockDiscordService = {
        fetchRoles: vi.fn().mockRejectedValue('String error'),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchRoles({ guildId: 'guild-1', token: 'test-token' }));

      const state = store.getState().guild;
      expect(state.error).toBe('Failed to fetch roles');
    });

    it('should fetch roles for specific guild', async () => {
      const mockDiscordService = {
        fetchRoles: vi.fn().mockResolvedValue({
          success: true,
          data: mockRoles,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchRoles({ guildId: 'guild-123', token: 'token' }));

      expect(mockDiscordService.fetchRoles).toHaveBeenCalledWith('guild-123', 'token');
    });

    it('should replace previous roles on new fetch', async () => {
      // Set initial roles
      store = createTestStore({ guild: guildReducer }, { guild: {
            ...initialGuildState,
            roles: [mockRoles[0]],
          } });

      const newRoles = [mockRoles[1]];
      const mockDiscordService = {
        fetchRoles: vi.fn().mockResolvedValue({
          success: true,
          data: newRoles,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchRoles({ guildId: 'guild-1', token: 'token' }));

      const state = store.getState().guild;
      expect(state.roles).toEqual(newRoles);
      expect(state.roles).not.toContain(mockRoles[0]);
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      // Set up a known state
      store = createTestStore({ guild: guildReducer }, { guild: {
            guilds: mockGuilds,
            selectedGuild: mockGuilds[0],
            roles: mockRoles,
            isLoading: false,
            error: 'Test error',
          } });
    });

    it('selectGuild should return entire guild state', () => {
      const guild = selectGuild(store.getState());
      expect(guild).toHaveProperty('guilds');
      expect(guild).toHaveProperty('selectedGuild');
      expect(guild).toHaveProperty('roles');
      expect(guild).toHaveProperty('isLoading');
      expect(guild).toHaveProperty('error');
    });

    it('selectGuilds should return guilds array', () => {
      const guilds = selectGuilds(store.getState());
      expect(guilds).toEqual(mockGuilds);
    });

    it('selectSelectedGuild should return selected guild', () => {
      const selectedGuild = selectSelectedGuild(store.getState());
      expect(selectedGuild).toEqual(mockGuilds[0]);

      store.dispatch(setSelectedGuild(null));
      expect(selectSelectedGuild(store.getState())).toBeNull();
    });

    it('selectRoles should return roles array', () => {
      const roles = selectRoles(store.getState());
      expect(roles).toEqual(mockRoles);
    });

    it('selectGuildLoading should return loading status', () => {
      expect(selectGuildLoading(store.getState())).toBe(false);

      // Trigger loading state
      const mockDiscordService = {
        fetchGuilds: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(fetchGuilds('test'));
      expect(selectGuildLoading(store.getState())).toBe(true);
    });

    it('selectGuildError should return error', () => {
      const error = selectGuildError(store.getState());
      expect(error).toBe('Test error');

      store.dispatch(clearGuilds());
      // Error is preserved after clearGuilds
      expect(selectGuildError(store.getState())).toBe('Test error');
    });
  });
});
