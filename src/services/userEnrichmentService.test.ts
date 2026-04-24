import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserEnrichmentServiceWrapper } from './userEnrichmentService';
import { createMockMessages, createMockUser } from '@/test/fixtures';
import type { Message } from 'discrub-core/types/discord-types';
import type { ExportUserMap, AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

// Mock dependencies
vi.mock('discrub-core/messages', () => ({
  UserDataEnrichmentService: vi.fn(),
  DiscordServiceAdapter: vi.fn(),
}));

describe('userEnrichmentService', () => {
  let service: UserEnrichmentServiceWrapper;
  let mockEnrichUserData: ReturnType<typeof vi.fn>;
  let mockSettings: AppSettings;
  let mockMessages: Message[];
  let mockUserMap: ExportUserMap;
  let mockEnrichedUserMap: ExportUserMap;

  beforeEach(async () => {
    service = new UserEnrichmentServiceWrapper();

    // Setup default mock settings
    mockSettings = {
      [DiscrubSetting.DISPLAY_NAME_LOOKUP]: 'true',
      [DiscrubSetting.SERVER_NICKNAME_LOOKUP]: 'true',
      [DiscrubSetting.APP_USER_DATA_REFRESH_RATE]: '100',
      [DiscrubSetting.REACTIONS_ENABLED]: 'true',
    } as AppSettings;

    // Setup mock messages
    mockMessages = createMockMessages(3);

    // Setup existing user map
    mockUserMap = {
      'user-123': {
        userName: 'olduser',
        displayName: 'Old Display',
        avatar: null,
        guilds: {},
        timestamp: 0,
      },
    };

    // Setup enriched user map
    mockEnrichedUserMap = {
      'user-123': {
        userName: 'testuser',
        displayName: 'Test User',
        avatar: null,
        guilds: {
          'guild-1': {
            roles: [],
            nick: 'TestNick',
            joinedAt: null,
            timestamp: 0,
          },
        },
        timestamp: 0,
      },
      'user-456': {
        userName: 'newuser',
        displayName: 'New User',
        avatar: null,
        guilds: {},
        timestamp: 0,
      },
    };

    // Setup mock enrichUserData
    mockEnrichUserData = vi.fn().mockResolvedValue({
      userMap: mockEnrichedUserMap,
      reactionMap: {},
    });

    // Get the mocked modules and reset/reconfigure them
    const { UserDataEnrichmentService, DiscordServiceAdapter } = await import('discrub-core/messages');

    // Reset all mocks to clear previous test state
    vi.mocked(UserDataEnrichmentService).mockClear();
    vi.mocked(DiscordServiceAdapter).mockClear();

    // Reconfigure the mocks for this test
    vi.mocked(DiscordServiceAdapter).mockReturnValue({} as any);
    vi.mocked(UserDataEnrichmentService).mockImplementation(() => ({
      enrichUserData: mockEnrichUserData,
    }) as any);
  });

  describe('enrichMessages', () => {
    it('should return existing map when both settings disabled', async () => {
      const settings = {
        ...mockSettings,
        [DiscrubSetting.DISPLAY_NAME_LOOKUP]: 'false',
        [DiscrubSetting.SERVER_NICKNAME_LOOKUP]: 'false',
      };

      const result = await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        settings,
        mockUserMap
      );

      expect(result.userMap).toBe(mockUserMap);
      expect(mockEnrichUserData).not.toHaveBeenCalled();
    });

    it('should enrich when display name lookup enabled', async () => {
      const settings = {
        ...mockSettings,
        [DiscrubSetting.DISPLAY_NAME_LOOKUP]: 'true',
        [DiscrubSetting.SERVER_NICKNAME_LOOKUP]: 'false',
      };

      const result = await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        settings,
        mockUserMap
      );

      expect(result.userMap).toEqual(mockEnrichedUserMap);
      expect(mockEnrichUserData).toHaveBeenCalledWith(mockMessages, 'guild-1');
    });

    it('should enrich when server nickname lookup enabled', async () => {
      const settings = {
        ...mockSettings,
        [DiscrubSetting.DISPLAY_NAME_LOOKUP]: 'false',
        [DiscrubSetting.SERVER_NICKNAME_LOOKUP]: 'true',
      };

      const result = await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        settings,
        mockUserMap
      );

      expect(result.userMap).toEqual(mockEnrichedUserMap);
      expect(mockEnrichUserData).toHaveBeenCalledWith(mockMessages, 'guild-1');
    });

    it('should enrich when both settings enabled', async () => {
      const result = await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(result.userMap).toEqual(mockEnrichedUserMap);
      expect(mockEnrichUserData).toHaveBeenCalledWith(mockMessages, 'guild-1');
    });

    it('should handle null guild ID for DMs', async () => {
      const result = await service.enrichMessages(
        mockMessages,
        null,
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(result.userMap).toEqual(mockEnrichedUserMap);
      expect(mockEnrichUserData).toHaveBeenCalledWith(mockMessages, null);
    });

    it('should create DiscordServiceAdapter with settings', async () => {
      const { DiscordServiceAdapter } = await import('discrub-core/messages');

      await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(DiscordServiceAdapter).toHaveBeenCalledWith(mockSettings);
    });

    it('should create UserDataEnrichmentService with config', async () => {
      const { UserDataEnrichmentService, DiscordServiceAdapter } = await import('discrub-core/messages');
      const mockAdapter = {};
      (DiscordServiceAdapter as any).mockReturnValue(mockAdapter);

      await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(UserDataEnrichmentService).toHaveBeenCalledWith({
        apiClient: mockAdapter,
        token: 'token-123',
        settings: {
          displayNameLookup: true,
          serverNickNameLookup: true,
          userDataRefreshRate: 100,
          reactionsEnabled: true,
        },
        existingUserMap: mockUserMap,
        existingReactionMap: undefined,
        onProgress: undefined,
        onStatus: undefined,
      });
    });

    it('should parse userDataRefreshRate as integer', async () => {
      const { UserDataEnrichmentService } = await import('discrub-core/messages');
      const settings = {
        ...mockSettings,
        [DiscrubSetting.APP_USER_DATA_REFRESH_RATE]: '250',
      };

      await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        settings,
        mockUserMap
      );

      const config = (UserDataEnrichmentService as any).mock.calls[0][0];
      expect(config.settings.userDataRefreshRate).toBe(250);
    });

    it('should default userDataRefreshRate to 0 if not set', async () => {
      const { UserDataEnrichmentService } = await import('discrub-core/messages');
      const settings: Record<string, string> = {
        ...mockSettings,
      };
      delete settings[DiscrubSetting.APP_USER_DATA_REFRESH_RATE];

      await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        settings as AppSettings,
        mockUserMap
      );

      const config = (UserDataEnrichmentService as any).mock.calls[0][0];
      expect(config.settings.userDataRefreshRate).toBe(0);
    });

    it('should pass progress callback', async () => {
      const { UserDataEnrichmentService } = await import('discrub-core/messages');
      const onProgress = vi.fn();

      await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap,
        onProgress
      );

      const config = (UserDataEnrichmentService as any).mock.calls[0][0];
      expect(config.onProgress).toBe(onProgress);
    });

    it('should pass status callback', async () => {
      const { UserDataEnrichmentService } = await import('discrub-core/messages');
      const onStatus = vi.fn();

      await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap,
        undefined,
        onStatus
      );

      const config = (UserDataEnrichmentService as any).mock.calls[0][0];
      expect(config.onStatus).toBe(onStatus);
    });

    it('should pass both callbacks', async () => {
      const { UserDataEnrichmentService } = await import('discrub-core/messages');
      const onProgress = vi.fn();
      const onStatus = vi.fn();

      await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap,
        onProgress,
        onStatus
      );

      const config = (UserDataEnrichmentService as any).mock.calls[0][0];
      expect(config.onProgress).toBe(onProgress);
      expect(config.onStatus).toBe(onStatus);
    });

    it('should handle error and return existing map', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockEnrichUserData.mockRejectedValue(new Error('API Error'));

      const result = await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(result.userMap).toBe(mockUserMap);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to enrich user data:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('should handle error from DiscordServiceAdapter', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { DiscordServiceAdapter } = await import('discrub-core/messages');

      // Temporarily change the mock implementation
      void (DiscordServiceAdapter as any).getMockImplementation();
      (DiscordServiceAdapter as any).mockImplementationOnce(() => {
        throw new Error('Adapter Error');
      });

      const result = await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(result.userMap).toBe(mockUserMap);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle empty messages array', async () => {
      const result = await service.enrichMessages(
        [],
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(result.userMap).toEqual(mockEnrichedUserMap);
      expect(mockEnrichUserData).toHaveBeenCalledWith([], 'guild-1');
    });

    it('should handle messages with multiple authors', async () => {
      const multiAuthorMessages: Message[] = [
        createMockMessages(1)[0],
        {
          ...createMockMessages(1)[0],
          id: 'msg-2',
          author: createMockUser({ id: 'user-456', username: 'user2' }),
        },
        {
          ...createMockMessages(1)[0],
          id: 'msg-3',
          author: createMockUser({ id: 'user-789', username: 'user3' }),
        },
      ];

      const result = await service.enrichMessages(
        multiAuthorMessages,
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(result.userMap).toEqual(mockEnrichedUserMap);
      expect(mockEnrichUserData).toHaveBeenCalledWith(multiAuthorMessages, 'guild-1');
    });

    it('should preserve existing user map data', async () => {
      const existingMap: ExportUserMap = {
        'user-old': {
          userName: 'olduser',
          displayName: 'Old User',
          avatar: null,
          guilds: {
            'guild-old': {
              roles: [],
              nick: 'OldNick',
              joinedAt: null,
              timestamp: 0,
            },
          },
          timestamp: 0,
        },
      };

      await service.enrichMessages(
        mockMessages,
        'guild-1',
        'token-123',
        mockSettings,
        existingMap
      );

      const { UserDataEnrichmentService } = await import('discrub-core/messages');
      const config = (UserDataEnrichmentService as any).mock.calls[0][0];
      expect(config.existingUserMap).toEqual(existingMap);
    });
  });

  describe('enrichUserIds', () => {
    it('should create minimal messages from user IDs', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      const result = await service.enrichUserIds(
        userIds,
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(result.userMap).toEqual(mockEnrichedUserMap);
      expect(mockEnrichUserData).toHaveBeenCalled();

      // Verify minimal messages were created
      const calledMessages = mockEnrichUserData.mock.calls[0][0] as Message[];
      expect(calledMessages).toHaveLength(3);
      expect(calledMessages[0].author.id).toBe('user-1');
      expect(calledMessages[1].author.id).toBe('user-2');
      expect(calledMessages[2].author.id).toBe('user-3');
    });

    it('should create messages with correct structure', async () => {
      const userIds = ['user-test'];

      await service.enrichUserIds(
        userIds,
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      const calledMessages = mockEnrichUserData.mock.calls[0][0] as Message[];
      const msg = calledMessages[0];

      expect(msg).toMatchObject({
        id: 'user-test',
        channel_id: '',
        author: {
          id: 'user-test',
          username: '',
          discriminator: '',
          global_name: null,
          avatar: null,
        },
        content: '',
        tts: false,
        mention_everyone: false,
        mentions: [],
        attachments: [],
        embeds: [],
        pinned: false,
        type: 0,
      });

      expect(msg.timestamp).toBeTruthy();
      expect(msg.edited_timestamp).toBeNull();
    });

    it('should handle empty user IDs array', async () => {
      const result = await service.enrichUserIds(
        [],
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(result.userMap).toEqual(mockEnrichedUserMap);
      expect(mockEnrichUserData).toHaveBeenCalledWith([], 'guild-1');
    });

    it('should handle null guild ID for DMs', async () => {
      const userIds = ['user-1', 'user-2'];

      const result = await service.enrichUserIds(
        userIds,
        null,
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(result.userMap).toEqual(mockEnrichedUserMap);
      expect(mockEnrichUserData).toHaveBeenCalledWith(expect.any(Array), null);
    });

    it('should pass progress callback', async () => {
      const { UserDataEnrichmentService } = await import('discrub-core/messages');
      const onProgress = vi.fn();

      await service.enrichUserIds(
        ['user-1'],
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap,
        onProgress
      );

      const config = (UserDataEnrichmentService as any).mock.calls[0][0];
      expect(config.onProgress).toBe(onProgress);
    });

    it('should pass status callback', async () => {
      const { UserDataEnrichmentService } = await import('discrub-core/messages');
      const onStatus = vi.fn();

      await service.enrichUserIds(
        ['user-1'],
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap,
        undefined,
        onStatus
      );

      const config = (UserDataEnrichmentService as any).mock.calls[0][0];
      expect(config.onStatus).toBe(onStatus);
    });

    it('should pass both callbacks', async () => {
      const { UserDataEnrichmentService } = await import('discrub-core/messages');
      const onProgress = vi.fn();
      const onStatus = vi.fn();

      await service.enrichUserIds(
        ['user-1'],
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap,
        onProgress,
        onStatus
      );

      const config = (UserDataEnrichmentService as any).mock.calls[0][0];
      expect(config.onProgress).toBe(onProgress);
      expect(config.onStatus).toBe(onStatus);
    });

    it('should handle error and return existing map', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockEnrichUserData.mockRejectedValue(new Error('API Error'));

      const result = await service.enrichUserIds(
        ['user-1'],
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(result.userMap).toBe(mockUserMap);
      // enrichUserIds calls enrichMessages, which catches the error first
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to enrich user data:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('should handle settings disabled', async () => {
      const settings = {
        ...mockSettings,
        [DiscrubSetting.DISPLAY_NAME_LOOKUP]: 'false',
        [DiscrubSetting.SERVER_NICKNAME_LOOKUP]: 'false',
      };

      const result = await service.enrichUserIds(
        ['user-1'],
        'guild-1',
        'token-123',
        settings,
        mockUserMap
      );

      // Should return existing map without calling enrichUserData
      expect(result.userMap).toBe(mockUserMap);
      expect(mockEnrichUserData).not.toHaveBeenCalled();
    });

    it('should handle single user ID', async () => {
      const result = await service.enrichUserIds(
        ['user-single'],
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(result.userMap).toEqual(mockEnrichedUserMap);

      const calledMessages = mockEnrichUserData.mock.calls[0][0] as Message[];
      expect(calledMessages).toHaveLength(1);
      expect(calledMessages[0].author.id).toBe('user-single');
    });

    it('should handle large number of user IDs', async () => {
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      const result = await service.enrichUserIds(
        userIds,
        'guild-1',
        'token-123',
        mockSettings,
        mockUserMap
      );

      expect(result.userMap).toEqual(mockEnrichedUserMap);

      const calledMessages = mockEnrichUserData.mock.calls[0][0] as Message[];
      expect(calledMessages).toHaveLength(100);
      expect(calledMessages[0].author.id).toBe('user-0');
      expect(calledMessages[99].author.id).toBe('user-99');
    });

    it('should preserve existing user map', async () => {
      const existingMap: ExportUserMap = {
        'user-existing': {
          userName: 'existing',
          displayName: 'Existing User',
          avatar: null,
          guilds: {},
          timestamp: 0,
        },
      };

      await service.enrichUserIds(
        ['user-1'],
        'guild-1',
        'token-123',
        mockSettings,
        existingMap
      );

      const { UserDataEnrichmentService } = await import('discrub-core/messages');
      const config = (UserDataEnrichmentService as any).mock.calls[0][0];
      expect(config.existingUserMap).toEqual(existingMap);
    });
  });

  describe('singleton pattern', () => {
    it('should export singleton instance', async () => {
      const { userEnrichmentService } = await import('./userEnrichmentService');
      expect(userEnrichmentService).toBeInstanceOf(UserEnrichmentServiceWrapper);
    });

    it('should export class for testing', () => {
      expect(UserEnrichmentServiceWrapper).toBeDefined();
      expect(typeof UserEnrichmentServiceWrapper).toBe('function');
    });
  });

  describe('failedUserIds filtering', () => {
    it('should pass failedUserIds as skipUserIds to enrichment service config', async () => {
      const failedUserIds = ['failed-user-1', 'failed-user-2'];
      await service.enrichMessages(
        mockMessages,
        'guild-1',
        'test-token',
        mockSettings,
        mockUserMap,
        undefined,
        undefined,
        failedUserIds
      );

      // Verify the enrichment service was constructed with skipUserIds
      const { UserDataEnrichmentService } = await import('discrub-core/messages');
      const constructorCalls = (UserDataEnrichmentService as any).mock.calls;
      const lastConfig = constructorCalls[constructorCalls.length - 1][0];
      expect(lastConfig.skipUserIds).toEqual(failedUserIds);
    });

    it('should not filter when failedUserIds is empty', async () => {
      await service.enrichMessages(
        mockMessages,
        'guild-1',
        'test-token',
        mockSettings,
        mockUserMap,
        undefined,
        undefined,
        []
      );

      const calledMessages = mockEnrichUserData.mock.calls[0][0] as Message[];
      expect(calledMessages.length).toBe(mockMessages.length);
    });

    it('should not filter when failedUserIds is undefined', async () => {
      await service.enrichMessages(
        mockMessages,
        'guild-1',
        'test-token',
        mockSettings,
        mockUserMap,
        undefined,
        undefined,
        undefined
      );

      const calledMessages = mockEnrichUserData.mock.calls[0][0] as Message[];
      expect(calledMessages.length).toBe(mockMessages.length);
    });
  });
});
