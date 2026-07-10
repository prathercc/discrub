import { describe, it, expect } from 'vitest';
import type { User } from 'discrub-core/types/discord-types';
import type { ExportUserMap, AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { getDisplayName, isDeletedUserEntry } from './userDisplayUtils';

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
});

describe('isDeletedUserEntry (#223)', () => {
  const entry = (userName: string | null, displayName: string | null = null): ExportUserMap[string] => ({
    userName,
    displayName,
    avatar: null,
    guilds: {},
    timestamp: 1,
  });

  it('detects a post-pomelo deleted-account placeholder username', () => {
    expect(isDeletedUserEntry(entry('deleted_user_a1b2c3d4'))).toBe(true);
  });

  it('detects the legacy "Deleted User" display name', () => {
    expect(isDeletedUserEntry(entry(null, 'Deleted User'))).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isDeletedUserEntry(entry('Deleted_User_ABC123'))).toBe(true);
  });

  it('does not flag ordinary users', () => {
    expect(isDeletedUserEntry(entry('livemember', 'Live Member'))).toBe(false);
  });

  it('does not flag users whose name merely contains "deleted"', () => {
    expect(isDeletedUserEntry(entry('not_deleted_user'))).toBe(false);
    expect(isDeletedUserEntry(entry('deleteduser'))).toBe(false);
  });

  it('returns false for a missing cache entry', () => {
    expect(isDeletedUserEntry(undefined)).toBe(false);
  });
});
