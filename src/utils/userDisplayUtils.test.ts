import { describe, it, expect } from 'vitest';
import type { User } from 'discrub-core/types/discord-types';
import type { ExportUserMap, AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import {
  getDisplayName,
  getUserDisplayData,
  getFormattedUserInfo,
  hasUserData,
  hasUserGuildData,
} from './userDisplayUtils';

describe('userDisplayUtils', () => {
  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    discriminator: '0001',
    global_name: 'Test User Display',
  } as User;

  const mockSettings: AppSettings = {
    [DiscrubSetting.DISPLAY_NAME_LOOKUP]: 'true',
    [DiscrubSetting.SERVER_NICKNAME_LOOKUP]: 'true',
  } as AppSettings;

  const mockUserMap = {
    'user-123': {
      userName: 'testuser',
      displayName: 'Test User Cached',
      guilds: {
        'guild-1': {
          nick: 'ServerNickname',
        },
      },
    },
  } as unknown as ExportUserMap;

  describe('getDisplayName', () => {
    it('should return server nickname when in guild context', () => {
      const result = getDisplayName(mockUser, mockUserMap, 'guild-1', mockSettings);
      expect(result).toBe('ServerNickname');
    });

    it('should return cached display name when nickname not available', () => {
      const result = getDisplayName(mockUser, mockUserMap, 'guild-2', mockSettings);
      expect(result).toBe('Test User Cached');
    });

    it('should return display name from message author when no cached data', () => {
      const result = getDisplayName(mockUser, {}, null, mockSettings);
      expect(result).toBe('Test User Display');
    });

    it('should return username from cache when display name disabled', () => {
      const settings = {
        ...mockSettings,
        [DiscrubSetting.DISPLAY_NAME_LOOKUP]: 'false',
      };

      const result = getDisplayName(mockUser, mockUserMap, null, settings);
      expect(result).toBe('testuser');
    });

    it('should return username from message when no cache', () => {
      const settings = {
        ...mockSettings,
        [DiscrubSetting.DISPLAY_NAME_LOOKUP]: 'false',
      };

      const result = getDisplayName(mockUser, {}, null, settings);
      expect(result).toBe('testuser');
    });

    it('should return "Unknown" when user is undefined', () => {
      const result = getDisplayName(undefined, mockUserMap, null, mockSettings);
      expect(result).toBe('Unknown');
    });

    it('should return "Unknown" when no user data available', () => {
      const minimalUser = {
        id: 'user-999',
        discriminator: '0001',
      } as User;

      const result = getDisplayName(minimalUser, {}, null, mockSettings);
      expect(result).toBe('Unknown');
    });

    it('should skip nickname when server nickname lookup disabled', () => {
      const settings = {
        ...mockSettings,
        [DiscrubSetting.SERVER_NICKNAME_LOOKUP]: 'false',
      };

      const result = getDisplayName(mockUser, mockUserMap, 'guild-1', settings);
      expect(result).toBe('Test User Cached');
    });

    it('should handle DM context (null guildId)', () => {
      const result = getDisplayName(mockUser, mockUserMap, null, mockSettings);
      expect(result).toBe('Test User Cached');
    });

    it('should prioritize nickname over display name', () => {
      // Even with both available, nickname should win
      const result = getDisplayName(mockUser, mockUserMap, 'guild-1', mockSettings);
      expect(result).not.toBe('Test User Cached');
      expect(result).toBe('ServerNickname');
    });

    it('should handle missing guild data in cache', () => {
      const userMapWithoutGuild = {
        'user-123': {
          userName: 'testuser',
          displayName: 'Test User Cached',
        },
      } as unknown as ExportUserMap;

      const result = getDisplayName(mockUser, userMapWithoutGuild, 'guild-1', mockSettings);
      expect(result).toBe('Test User Cached');
    });

    it('should handle user without global_name', () => {
      const userWithoutGlobalName = {
        ...mockUser,
        global_name: undefined,
      } as User;

      const result = getDisplayName(userWithoutGlobalName, {}, null, mockSettings);
      expect(result).toBe('testuser');
    });
  });

  describe('getUserDisplayData', () => {
    it('should return all user data when available', () => {
      const result = getUserDisplayData('user-123', mockUserMap, 'guild-1');

      expect(result).toEqual({
        username: 'testuser',
        displayName: 'Test User Cached',
        nickname: 'ServerNickname',
      });
    });

    it('should return null for nickname in DM context', () => {
      const result = getUserDisplayData('user-123', mockUserMap, null);

      expect(result).toEqual({
        username: 'testuser',
        displayName: 'Test User Cached',
        nickname: null,
      });
    });

    it('should return null for nickname when not in cache', () => {
      const result = getUserDisplayData('user-123', mockUserMap, 'guild-2');

      expect(result).toEqual({
        username: 'testuser',
        displayName: 'Test User Cached',
        nickname: null,
      });
    });

    it('should return null values when user not in cache', () => {
      const result = getUserDisplayData('user-999', mockUserMap, 'guild-1');

      expect(result).toEqual({
        username: null,
        displayName: null,
        nickname: null,
      });
    });

    it('should handle user with no guilds data', () => {
      const userMapNoGuilds = {
        'user-123': {
          userName: 'testuser',
          displayName: 'Test User',
        },
      } as unknown as ExportUserMap;

      const result = getUserDisplayData('user-123', userMapNoGuilds, 'guild-1');

      expect(result).toEqual({
        username: 'testuser',
        displayName: 'Test User',
        nickname: null,
      });
    });

    it('should handle user with only username', () => {
      const userMapUsernameOnly = {
        'user-123': {
          userName: 'testuser',
        },
      } as unknown as ExportUserMap;

      const result = getUserDisplayData('user-123', userMapUsernameOnly, null);

      expect(result).toEqual({
        username: 'testuser',
        displayName: null,
        nickname: null,
      });
    });
  });

  describe('getFormattedUserInfo', () => {
    it('should format all available user data', () => {
      const result = getFormattedUserInfo('user-123', mockUserMap, 'guild-1');

      expect(result).toBe(
        'Username: testuser\nDisplay Name: Test User Cached\nServer Nickname: ServerNickname'
      );
    });

    it('should format username and display name only', () => {
      const result = getFormattedUserInfo('user-123', mockUserMap, null);

      expect(result).toBe('Username: testuser\nDisplay Name: Test User Cached');
    });

    it('should format username only', () => {
      const userMapUsernameOnly = {
        'user-123': {
          userName: 'testuser',
        },
      } as unknown as ExportUserMap;

      const result = getFormattedUserInfo('user-123', userMapUsernameOnly, null);

      expect(result).toBe('Username: testuser');
    });

    it('should return fallback message when no data available', () => {
      const result = getFormattedUserInfo('user-999', mockUserMap, null);

      expect(result).toBe('User information not available');
    });

    it('should return fallback message for empty cache', () => {
      const result = getFormattedUserInfo('user-123', {}, null);

      expect(result).toBe('User information not available');
    });

    it('should handle display name without username', () => {
      const userMapDisplayOnly = {
        'user-123': {
          displayName: 'Display Only',
        },
      } as unknown as ExportUserMap;

      const result = getFormattedUserInfo('user-123', userMapDisplayOnly, null);

      expect(result).toBe('Display Name: Display Only');
    });

    it('should include all fields in correct order', () => {
      const result = getFormattedUserInfo('user-123', mockUserMap, 'guild-1');
      const lines = result.split('\n');

      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain('Username');
      expect(lines[1]).toContain('Display Name');
      expect(lines[2]).toContain('Server Nickname');
    });
  });

  describe('hasUserData', () => {
    it('should return true when user exists in cache', () => {
      expect(hasUserData('user-123', mockUserMap)).toBe(true);
    });

    it('should return false when user not in cache', () => {
      expect(hasUserData('user-999', mockUserMap)).toBe(false);
    });

    it('should return false for empty cache', () => {
      expect(hasUserData('user-123', {})).toBe(false);
    });

    it('should handle edge case with empty user ID', () => {
      expect(hasUserData('', mockUserMap)).toBe(false);
    });

    it('should return true even if user data is minimal', () => {
      const minimalUserMap = {
        'user-123': {},
      } as unknown as ExportUserMap;

      expect(hasUserData('user-123', minimalUserMap)).toBe(true);
    });
  });

  describe('hasUserGuildData', () => {
    it('should return true when user has guild data', () => {
      expect(hasUserGuildData('user-123', 'guild-1', mockUserMap)).toBe(true);
    });

    it('should return false when user not in cache', () => {
      expect(hasUserGuildData('user-999', 'guild-1', mockUserMap)).toBe(false);
    });

    it('should return false when guild not in user data', () => {
      expect(hasUserGuildData('user-123', 'guild-2', mockUserMap)).toBe(false);
    });

    it('should return false when user has no guilds property', () => {
      const userMapNoGuilds = {
        'user-123': {
          userName: 'testuser',
        },
      } as unknown as ExportUserMap;

      expect(hasUserGuildData('user-123', 'guild-1', userMapNoGuilds)).toBe(false);
    });

    it('should return false for empty cache', () => {
      expect(hasUserGuildData('user-123', 'guild-1', {})).toBe(false);
    });

    it('should handle empty guild ID', () => {
      expect(hasUserGuildData('user-123', '', mockUserMap)).toBe(false);
    });

    it('should handle user with empty guilds object', () => {
      const userMapEmptyGuilds = {
        'user-123': {
          userName: 'testuser',
          guilds: {},
        },
      } as unknown as ExportUserMap;

      expect(hasUserGuildData('user-123', 'guild-1', userMapEmptyGuilds)).toBe(false);
    });

    it('should return true when guild data exists even if minimal', () => {
      const userMapMinimalGuild = {
        'user-123': {
          guilds: {
            'guild-1': {},
          },
        },
      } as unknown as ExportUserMap;

      expect(hasUserGuildData('user-123', 'guild-1', userMapMinimalGuild)).toBe(true);
    });
  });
});
