import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaDownloadService } from './mediaDownloadService';
import { createMockMessage } from '@/test/fixtures';
import type { Message, Guild } from 'discrub-core/types/discord-types';
import type { StreamingZipService } from './streamingZipService';

// Mock dependencies
vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(),
}));

vi.mock('filenamify', () => ({
  default: vi.fn((str: string) => str.replace(/[^a-zA-Z0-9._-]/g, '_')),
}));

vi.mock('@/extension/messaging', () => ({
  isExtensionMode: vi.fn(() => false),
}));

describe('mediaDownloadService', () => {
  let service: MediaDownloadService;
  let mockZipService: StreamingZipService;
  let mockDiscordService: any;
  let mockOnProgress: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // #232 transport seam: forward to the downloadFile stub lazily so the
    // orchestration tests keep their existing per-test stubs verbatim.
    service = new MediaDownloadService((url: string) => mockDiscordService.downloadFile(url));
    vi.clearAllMocks();

    // Mock zip service — addFile echoes the stored path like the real one (#224)
    mockZipService = {
      addFile: vi.fn().mockImplementation(async (_blob: Blob, filePath: string) => filePath),
    } as any;

    // Mock Discord service
    mockDiscordService = {
      downloadFile: vi.fn(),
    };

    const { getDiscordService } = await import('@services/discordService');
    vi.mocked(getDiscordService).mockReturnValue(mockDiscordService);

    // Mock progress callback
    mockOnProgress = vi.fn();
  });

  describe('downloadAllMedia', () => {
    it('should download all media types in sequence', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          author: {
            id: 'user-1',
            username: 'user1',
            discriminator: '0001',
            avatar: 'avatar123',
            global_name: null,
          },
          attachments: [{ id: 'att-1', url: 'https://cdn.discordapp.com/file.png', filename: 'file.png' }],
          content: 'Test <:emoji:123456>',
        } as any,
      ];

      const guild: Guild = {
        id: 'guild-1',
        name: 'Test Guild',
        roles: [{ id: 'role-1', name: 'Admin', icon: 'icon123' }],
      } as any;

      // Mock successful downloads
      const mockBlob = new Blob(['data'], { type: 'image/png' });
      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: mockBlob,
      });

      const maps = await service.downloadAllMedia(
        messages,
        guild,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      // Verify all download types were called
      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'avatars' })
      );
      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'attachments' })
      );
      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'emojis' })
      );
      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'roles' })
      );

      // Verify maps were populated
      expect(maps.avatarMap).toBeDefined();
      expect(maps.mediaMap).toBeDefined();
      expect(maps.emojiMap).toBeDefined();
      expect(maps.roleMap).toBeDefined();
    });

    it('should skip role icons for DM exports (null guild)', async () => {
      const messages: Message[] = [createMockMessage()];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-dm',
        mockZipService,
        mockOnProgress
      );

      // Should not have role progress
      const roleCalls = mockOnProgress.mock.calls.filter(
        (call) => call[0].stage === 'roles'
      );
      expect(roleCalls.length).toBe(0);
    });

    it('should handle empty messages array', async () => {
      const maps = await service.downloadAllMedia(
        [],
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(maps.avatarMap).toEqual({});
      expect(maps.mediaMap).toEqual({});
      expect(maps.emojiMap).toEqual({});
    });
  });

  describe('downloadAvatars', () => {
    it('should download unique user avatars', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          author: {
            id: 'user-1',
            username: 'user1',
            discriminator: '0001',
            avatar: 'avatar123',
            global_name: null,
          },
        } as any,
        {
          ...createMockMessage(),
          author: {
            id: 'user-2',
            username: 'user2',
            discriminator: '0002',
            avatar: 'avatar456',
            global_name: null,
          },
        } as any,
      ];

      const mockBlob = new Blob(['data'], { type: 'image/png' });
      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: mockBlob,
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const maps = service.getMaps();
      expect(Object.keys(maps.avatarMap)).toHaveLength(2);
      expect(maps.avatarMap['user-1/avatar123']).toContain('avatars/user-1/avatar123');
      expect(maps.avatarMap['user-2/avatar456']).toContain('avatars/user-2/avatar456');
    });

    it('should deduplicate same user avatar across messages', async () => {
      const author = {
        id: 'user-1',
        username: 'user1',
        discriminator: '0001',
        avatar: 'avatar123',
        global_name: null,
      };

      const messages: Message[] = [
        { ...createMockMessage(), author } as any,
        { ...createMockMessage(), author } as any,
        { ...createMockMessage(), author } as any,
      ];

      const mockBlob = new Blob(['data'], { type: 'image/png' });
      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: mockBlob,
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      // Should only download once
      const downloadCalls = mockDiscordService.downloadFile.mock.calls.filter((call: any[]) =>
        call[0].includes('avatars')
      );
      expect(downloadCalls).toHaveLength(1);
    });

    it('should handle avatar download failure gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages: Message[] = [
        {
          ...createMockMessage(),
          author: {
            id: 'user-1',
            username: 'user1',
            discriminator: '0001',
            avatar: 'avatar123',
            global_name: null,
          },
        } as any,
      ];

      mockDiscordService.downloadFile.mockRejectedValue(new Error('Network error'));

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download avatar')
      );

      const maps = service.getMaps();
      expect(maps.avatarMap['user-1/avatar123']).toBeUndefined();

      consoleWarnSpy.mockRestore();
    });

    it('should skip users without avatars', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          author: {
            id: 'user-1',
            username: 'user1',
            discriminator: '0001',
            avatar: null,
            global_name: null,
          },
        } as any,
      ];

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(mockDiscordService.downloadFile).not.toHaveBeenCalled();
    });

    it('should report progress correctly', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          author: { id: 'user-1', username: 'user1', discriminator: '0001', avatar: 'avatar1', global_name: null },
        } as any,
        {
          ...createMockMessage(),
          author: { id: 'user-2', username: 'user2', discriminator: '0002', avatar: 'avatar2', global_name: null },
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const avatarProgressCalls = mockOnProgress.mock.calls.filter(
        (call) => call[0].stage === 'avatars'
      );

      expect(avatarProgressCalls[0][0]).toMatchObject({
        stage: 'avatars',
        current: 1,
        total: 2,
        message: 'Downloading avatar 1/2',
      });

      expect(avatarProgressCalls[1][0]).toMatchObject({
        stage: 'avatars',
        current: 2,
        total: 2,
        message: 'Downloading avatar 2/2',
      });
    });

    it('should skip the file when the transport reports failure (#232 stall abort)', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          author: {
            id: 'user-1',
            username: 'user1',
            discriminator: '0001',
            avatar: 'avatar123',
            global_name: null,
          },
        } as any,
      ];

      // The stall guard resolves { success: false } after aborting a dead
      // download — timeout mechanics live in the transport's own spec.
      mockDiscordService.downloadFile.mockResolvedValue({ success: false, data: null });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const maps = service.getMaps();
      expect(maps.avatarMap['user-1/avatar123']).toBeUndefined();
    });

    it('should download reaction-user avatars when reactionMap is provided', async () => {
      // Message author has avatar
      const messages: Message[] = [
        {
          ...createMockMessage(),
          id: 'msg-1',
          author: { id: 'author-1', username: 'author', discriminator: '0', avatar: 'author_hash', global_name: null },
        } as any,
      ];

      // Reaction user with avatar (different user than author)
      const reactionMap = {
        'msg-1': {
          '👍': [{ id: 'reactor-1', burst: false, avatar: 'reactor_hash' }],
        },
      };

      const mockBlob = new Blob(['data'], { type: 'image/png' });
      mockDiscordService.downloadFile.mockResolvedValue({ success: true, data: mockBlob });

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        undefined, undefined, undefined, reactionMap,
      );

      const maps = service.getMaps();
      // Both author and reactor avatars should be downloaded
      expect(Object.keys(maps.avatarMap)).toHaveLength(2);
      expect(maps.avatarMap['author-1/author_hash']).toBeDefined();
      expect(maps.avatarMap['reactor-1/reactor_hash']).toBeDefined();
      // 2 CDN fetches for avatars (no rate-limited API calls)
      const avatarCalls = mockDiscordService.downloadFile.mock.calls.filter(
        (call: any[]) => call[0].includes('avatars')
      );
      expect(avatarCalls).toHaveLength(2);
    });

    it('should deduplicate reactor avatars with message author avatars', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          id: 'msg-1',
          author: { id: 'user-1', username: 'user1', discriminator: '0', avatar: 'shared_hash', global_name: null },
        } as any,
      ];

      // Same user reacted — avatar already covered by message author
      const reactionMap = {
        'msg-1': {
          '👍': [{ id: 'user-1', burst: false, avatar: 'shared_hash' }],
        },
      };

      const mockBlob = new Blob(['data'], { type: 'image/png' });
      mockDiscordService.downloadFile.mockResolvedValue({ success: true, data: mockBlob });

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        undefined, undefined, undefined, reactionMap,
      );

      // Only 1 download — deduplicated via Set
      const avatarCalls = mockDiscordService.downloadFile.mock.calls.filter(
        (call: any[]) => call[0].includes('avatars')
      );
      expect(avatarCalls).toHaveLength(1);
      expect(Object.keys(service.getMaps().avatarMap)).toHaveLength(1);
    });

    it('should skip reaction users without avatars', async () => {
      const messages: Message[] = [
        { ...createMockMessage(), id: 'msg-1' } as any,
      ];

      const reactionMap = {
        'msg-1': {
          '👍': [
            { id: 'reactor-no-avatar', burst: false },  // no avatar field
            { id: 'reactor-null-avatar', burst: false, avatar: null },
          ],
        },
      };

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        undefined, undefined, undefined, reactionMap,
      );

      // No avatar downloads (message author has no avatar, reactors have no avatar)
      expect(mockDiscordService.downloadFile).not.toHaveBeenCalled();
    });

    it('should include reaction-user avatars in progress count', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          id: 'msg-1',
          author: { id: 'author-1', username: 'a', discriminator: '0', avatar: 'hash_a', global_name: null },
        } as any,
      ];

      const reactionMap = {
        'msg-1': {
          '👍': [{ id: 'reactor-1', burst: false, avatar: 'hash_r' }],
        },
      };

      const mockBlob = new Blob(['data'], { type: 'image/png' });
      mockDiscordService.downloadFile.mockResolvedValue({ success: true, data: mockBlob });

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        undefined, undefined, undefined, reactionMap,
      );

      const avatarProgress = mockOnProgress.mock.calls.filter(
        (call) => call[0].stage === 'avatars'
      );
      // Total should be 2 (1 author + 1 reactor)
      expect(avatarProgress).toHaveLength(2);
      expect(avatarProgress[0][0].total).toBe(2);
      expect(avatarProgress[1][0].total).toBe(2);
    });
  });

  describe('downloadAttachments', () => {
    it('should download message attachments using proxy_url when available', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [
            { id: 'att-1', url: 'https://cdn.discordapp.com/file1.png', proxy_url: 'https://media.discordapp.net/file1.png', filename: 'file1.png' },
            { id: 'att-2', url: 'https://cdn.discordapp.com/file2.jpg', proxy_url: 'https://media.discordapp.net/file2.jpg', filename: 'file2.jpg' },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(mockDiscordService.downloadFile).toHaveBeenCalledTimes(2);
      expect(mockDiscordService.downloadFile).toHaveBeenCalledWith(
        'https://media.discordapp.net/file1.png'
      );
      expect(mockDiscordService.downloadFile).toHaveBeenCalledWith(
        'https://media.discordapp.net/file2.jpg'
      );
    });

    it('gives same-message attachments unique zip paths even in the same millisecond (#224)', async () => {
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890);
      try {
        const messages: Message[] = [
          {
            ...createMockMessage(),
            attachments: [
              { id: 'att-1', url: 'https://cdn.discordapp.com/a.png', filename: 'a.png' },
              { id: 'att-2', url: 'https://cdn.discordapp.com/b.png', filename: 'b.png' },
            ],
          } as any,
        ];

        mockDiscordService.downloadFile.mockResolvedValue({
          success: true,
          data: new Blob(['data'], { type: 'image/png' }),
        });

        await service.downloadAllMedia(messages, null, 'test-channel', mockZipService, mockOnProgress);

        const attachmentPaths = (mockZipService.addFile as any).mock.calls
          .map((c: any[]) => c[1])
          .filter((p: string) => p.includes('/media/'));
        expect(attachmentPaths).toHaveLength(2);
        expect(new Set(attachmentPaths).size).toBe(2);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it('records the path the zip actually stored when a colliding entry was renamed (#224)', async () => {
      (mockZipService.addFile as any).mockImplementation(async (_blob: Blob, filePath: string) =>
        filePath.includes('/media/') ? filePath.replace(/(\.[^./]+)$/, '-2$1') : filePath
      );

      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [
            { id: 'att-1', url: 'https://cdn.discordapp.com/a.png', filename: 'a.png' },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(messages, null, 'test-channel', mockZipService, mockOnProgress);

      const { mediaMap } = service.getMaps();
      const recorded = Object.values(mediaMap);
      expect(recorded).toHaveLength(1);
      expect(recorded[0]).toMatch(/^media\/attachments\/.*-2\.png$/);
    });

    it('should fall back to url when proxy_url is not available', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [
            { id: 'att-1', url: 'https://cdn.discordapp.com/file.png', filename: 'file.png' },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(mockDiscordService.downloadFile).toHaveBeenCalledWith(
        'https://cdn.discordapp.com/file.png'
      );
    });

    it('should use url directly in extension mode', async () => {
      const { isExtensionMode } = await import('@/extension/messaging');
      vi.mocked(isExtensionMode).mockReturnValue(true);

      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [
            { id: 'att-1', url: 'https://cdn.discordapp.com/file.png', proxy_url: 'https://media.discordapp.net/file.png', filename: 'file.png' },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(mockDiscordService.downloadFile).toHaveBeenCalledWith(
        'https://cdn.discordapp.com/file.png'
      );

      vi.mocked(isExtensionMode).mockReturnValue(false);
    });

    it('should download embed images', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          embeds: [
            {
              image: { url: 'https://cdn.discordapp.com/embed-image.png' },
            },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const maps = service.getMaps();
      const embedImageUrl = 'https://cdn.discordapp.com/embed-image.png';
      expect(maps.mediaMap[embedImageUrl]).toContain('embed-images');
    });

    it('should download embed videos', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          embeds: [
            {
              video: { url: 'https://cdn.discordapp.com/embed-video.mp4' },
            },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'video/mp4' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const maps = service.getMaps();
      const embedVideoUrl = 'https://cdn.discordapp.com/embed-video.mp4';
      expect(maps.mediaMap[embedVideoUrl]).toContain('embed-videos');
    });

    it('falls back to the direct URL when the proxy URL download fails (Tenor mp4 case)', async () => {
      const directUrl = 'https://media.tenor.com/abc/video.mp4';
      const proxyUrl = 'https://images-ext-1.discordapp.net/external/xyz/video.mp4';
      const messages: Message[] = [
        {
          ...createMockMessage(),
          embeds: [
            {
              video: { url: directUrl, proxy_url: proxyUrl },
            },
          ],
        } as any,
      ];

      // First call (proxy URL) returns nothing — mimics Discord's media proxy
      // failing for external video CDNs. Second call (direct URL) succeeds.
      mockDiscordService.downloadFile.mockImplementation((requestedUrl: string) => {
        if (requestedUrl === proxyUrl) {
          return Promise.resolve({ success: false, data: null });
        }
        return Promise.resolve({
          success: true,
          data: new Blob(['data'], { type: 'video/mp4' }),
        });
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const maps = service.getMaps();
      expect(maps.mediaMap[directUrl]).toContain('embed-videos');
      // Both the proxy and direct URLs were attempted in order
      const calls = (mockDiscordService.downloadFile as any).mock.calls;
      expect(calls.some(([u]: [string]) => u === proxyUrl)).toBe(true);
      expect(calls.some(([u]: [string]) => u === directUrl)).toBe(true);
    });

    it('does not retry the direct URL when it equals the proxy URL', async () => {
      const url = 'https://cdn.discordapp.com/only-url.png';
      const messages: Message[] = [
        {
          ...createMockMessage(),
          embeds: [
            {
              image: { url },
            },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: false,
        data: null,
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      // downloadFile is called exactly once because downloadUrl === url
      // (no proxy_url in the embed, so no second-attempt URL to fall back to)
      const calls = (mockDiscordService.downloadFile as any).mock.calls.filter(
        ([u]: [string]) => u === url,
      );
      expect(calls).toHaveLength(1);
    });

    it('should download embed thumbnails', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          embeds: [
            {
              thumbnail: { url: 'https://cdn.discordapp.com/thumb.png' },
            },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const maps = service.getMaps();
      const thumbUrl = 'https://cdn.discordapp.com/thumb.png';
      expect(maps.mediaMap[thumbUrl]).toContain('embed-thumbnails');
    });

    it('should handle attachment download failure', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [{ id: 'att-1', url: 'https://cdn.discordapp.com/file.png', filename: 'file.png' }],
        } as any,
      ];

      mockDiscordService.downloadFile.mockRejectedValue(new Error('Network error'));

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download attachment'),
        expect.objectContaining({
          original: 'https://cdn.discordapp.com/file.png',
        }),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should report progress for attachments', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [
            { id: 'att-1', url: 'https://cdn.discordapp.com/file1.png', filename: 'file1.png' },
            { id: 'att-2', url: 'https://cdn.discordapp.com/file2.png', filename: 'file2.png' },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const attachmentProgressCalls = mockOnProgress.mock.calls.filter(
        (call) => call[0].stage === 'attachments'
      );

      expect(attachmentProgressCalls[0][0]).toMatchObject({
        stage: 'attachments',
        current: 1,
        total: 2,
      });
    });

    // #214: forwarded messages carry their real media inside
    // message_snapshots[].message — those attachments/embeds must be
    // downloaded and URL-mapped exactly like top-level media.
    it('downloads attachments from a forwarded message snapshot', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          content: '',
          attachments: [],
          embeds: [],
          message_snapshots: [
            {
              message: {
                content: '',
                attachments: [
                  {
                    id: 'snap-att-1',
                    url: 'https://cdn.discordapp.com/snap-file.png',
                    proxy_url: 'https://media.discordapp.net/snap-file.png',
                    filename: 'snap-file.png',
                  },
                ],
                embeds: [],
              },
            },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      const maps = await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(mockDiscordService.downloadFile).toHaveBeenCalledWith(
        'https://media.discordapp.net/snap-file.png'
      );
      // The original CDN URL becomes a key in the media map so the HTML
      // emitter can rewrite the forwarded link to the local copy.
      expect(maps.mediaMap['https://cdn.discordapp.com/snap-file.png']).toBeDefined();
    });

    it('downloads embed images from a forwarded message snapshot', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          content: '',
          attachments: [],
          embeds: [],
          message_snapshots: [
            {
              message: {
                content: '',
                attachments: [],
                embeds: [
                  {
                    image: {
                      url: 'https://cdn.discordapp.com/snap-embed.png',
                      proxy_url: 'https://media.discordapp.net/snap-embed.png',
                    },
                  },
                ],
              },
            },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      const maps = await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(mockDiscordService.downloadFile).toHaveBeenCalledWith(
        'https://media.discordapp.net/snap-embed.png'
      );
      expect(maps.mediaMap['https://cdn.discordapp.com/snap-embed.png']).toBeDefined();
    });
  });

  describe('downloadEmojis', () => {
    it('should extract and download custom emojis from content', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          content: 'Hello <:emoji1:123456> world <:emoji2:789012>',
        },
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/webp' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const maps = service.getMaps();
      expect(maps.emojiMap['123456']).toContain('emojis/123456');
      expect(maps.emojiMap['789012']).toContain('emojis/789012');
    });

    it('should extract animated emojis', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          content: 'Animated <a:emoji:123456>',
        },
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/webp' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(mockDiscordService.downloadFile).toHaveBeenCalledWith(
        'https://media.discordapp.net/emojis/123456.webp?animated=true'
      );
    });

    it('should extract emojis from reactions', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          reactions: [
            { emoji: { id: '123456', name: 'emoji1' }, count: 5 },
            { emoji: { id: '789012', name: 'emoji2' }, count: 3 },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/webp' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const maps = service.getMaps();
      expect(maps.emojiMap['123456']).toBeDefined();
      expect(maps.emojiMap['789012']).toBeDefined();
    });

    it('should deduplicate emojis across messages', async () => {
      const messages: Message[] = [
        { ...createMockMessage(), content: 'Test <:emoji:123456>' },
        { ...createMockMessage(), content: 'Another <:emoji:123456>' },
        { ...createMockMessage(), content: 'More <:emoji:123456>' },
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/webp' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const downloadCalls = mockDiscordService.downloadFile.mock.calls.filter((call: any[]) =>
        call[0].includes('emojis')
      );
      expect(downloadCalls).toHaveLength(1);
    });

    it('should handle emoji download failure', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages: Message[] = [
        {
          ...createMockMessage(),
          content: 'Test <:emoji:123456>',
        },
      ];

      mockDiscordService.downloadFile.mockRejectedValue(new Error('Network error'));

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download emoji')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle messages without emojis', async () => {
      const messages: Message[] = [
        { ...createMockMessage(), content: 'No emojis here' },
      ];

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const emojiProgressCalls = mockOnProgress.mock.calls.filter(
        (call) => call[0].stage === 'emojis'
      );
      // Should report empty progress (0/0) when no emojis found
      expect(emojiProgressCalls).toHaveLength(1);
      expect(emojiProgressCalls[0][0]).toMatchObject({
        stage: 'emojis',
        current: 0,
        total: 0,
      });
    });
  });

  describe('downloadRoleIcons', () => {
    it('should download role icons for guild exports', async () => {
      const guild: Guild = {
        id: 'guild-1',
        name: 'Test Guild',
        roles: [
          { id: 'role-1', name: 'Admin', icon: 'icon123' },
          { id: 'role-2', name: 'Mod', icon: 'icon456' },
        ],
      } as any;

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        [],
        guild,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(mockDiscordService.downloadFile).toHaveBeenCalledWith(
        'https://cdn.discordapp.com/role-icons/role-1/icon123.webp?size=20'
      );
      expect(mockDiscordService.downloadFile).toHaveBeenCalledWith(
        'https://cdn.discordapp.com/role-icons/role-2/icon456.webp?size=20'
      );
    });

    it('should skip roles without icons', async () => {
      const guild: Guild = {
        id: 'guild-1',
        name: 'Test Guild',
        roles: [
          { id: 'role-1', name: 'Everyone' }, // No icon
          { id: 'role-2', name: 'Admin', icon: 'icon123' },
        ],
      } as any;

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        [],
        guild,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(mockDiscordService.downloadFile).toHaveBeenCalledTimes(1);
    });

    it('should handle role icon download failure', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const guild: Guild = {
        id: 'guild-1',
        name: 'Test Guild',
        roles: [{ id: 'role-1', name: 'Admin', icon: 'icon123' }],
      } as any;

      mockDiscordService.downloadFile.mockRejectedValue(new Error('Network error'));

      await service.downloadAllMedia(
        [],
        guild,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download role icon')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('mediaConfig filtering', () => {
    it('should skip image attachments when mediaConfig.images is false', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [
            { id: 'att-1', url: 'https://cdn.discordapp.com/file.png', filename: 'file.png' },
            { id: 'att-2', url: 'https://cdn.discordapp.com/file.mp4', filename: 'file.mp4' },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'video/mp4' }),
      });

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        { images: false, videos: true, audio: true, other: true }
      );

      // Only video should be downloaded (not the png)
      const attachmentCalls = mockDiscordService.downloadFile.mock.calls.filter((c: any[]) =>
        c[0].includes('file')
      );
      expect(attachmentCalls).toHaveLength(1);
      expect(attachmentCalls[0][0]).toContain('file.mp4');
    });

    it('should skip video attachments when mediaConfig.videos is false', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [
            { id: 'att-1', url: 'https://cdn.discordapp.com/file.mp4', filename: 'file.mp4' },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'video/mp4' }),
      });

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        { images: true, videos: false, audio: true, other: true }
      );

      const attachmentProgressCalls = mockOnProgress.mock.calls.filter(
        (call) => call[0].stage === 'attachments'
      );
      expect(attachmentProgressCalls[0][0].total).toBe(0);
    });

    it('should download everything when all types enabled', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [
            { id: 'att-1', url: 'https://cdn.discordapp.com/file.png', filename: 'file.png' },
            { id: 'att-2', url: 'https://cdn.discordapp.com/file.mp4', filename: 'file.mp4' },
            { id: 'att-3', url: 'https://cdn.discordapp.com/file.mp3', filename: 'file.mp3' },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        { images: true, videos: true, audio: true, other: true }
      );

      const attachmentProgressCalls = mockOnProgress.mock.calls.filter(
        (call) => call[0].stage === 'attachments'
      );
      expect(attachmentProgressCalls[attachmentProgressCalls.length - 1][0].total).toBe(3);
    });
  });

  describe('artist mode', () => {
    it('should organize media by author username when artistMode is true', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          author: { id: 'u1', username: 'alice', discriminator: '0001', avatar: null, global_name: null },
          attachments: [
            { id: 'att-1', url: 'https://cdn.discordapp.com/file1.png', filename: 'file1.png' },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        undefined, true
      );

      const maps = service.getMaps();
      const mediaPath = maps.mediaMap['https://cdn.discordapp.com/file1.png'];
      expect(mediaPath).toContain('media/alice/');
    });

    it('should organize by type folder when artistMode is false', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          author: { id: 'u1', username: 'alice', discriminator: '0001', avatar: null, global_name: null },
          attachments: [
            { id: 'att-1', url: 'https://cdn.discordapp.com/file1.png', filename: 'file1.png' },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        undefined, false
      );

      const maps = service.getMaps();
      const mediaPath = maps.mediaMap['https://cdn.discordapp.com/file1.png'];
      expect(mediaPath).toContain('media/attachments/');
    });
  });

  describe('getFileExtension', () => {
    it('should detect PNG', () => {
      const blob = new Blob(['data'], { type: 'image/png' });
      const ext = (service as any).getFileExtension(blob);
      expect(ext).toBe('png');
    });

    it('should detect JPEG', () => {
      const blob = new Blob(['data'], { type: 'image/jpeg' });
      const ext = (service as any).getFileExtension(blob);
      expect(ext).toBe('jpg');
    });

    it('should detect GIF', () => {
      const blob = new Blob(['data'], { type: 'image/gif' });
      const ext = (service as any).getFileExtension(blob);
      expect(ext).toBe('gif');
    });

    it('should detect WebP', () => {
      const blob = new Blob(['data'], { type: 'image/webp' });
      const ext = (service as any).getFileExtension(blob);
      expect(ext).toBe('webp');
    });

    it('should detect MP4', () => {
      const blob = new Blob(['data'], { type: 'video/mp4' });
      const ext = (service as any).getFileExtension(blob);
      expect(ext).toBe('mp4');
    });

    it('should detect MP3', () => {
      const blob = new Blob(['data'], { type: 'audio/mpeg' });
      const ext = (service as any).getFileExtension(blob);
      expect(ext).toBe('mp3');
    });

    it('should detect PDF', () => {
      const blob = new Blob(['data'], { type: 'application/pdf' });
      const ext = (service as any).getFileExtension(blob);
      expect(ext).toBe('pdf');
    });

    it('should return null for unknown MIME types', () => {
      const blob = new Blob(['data'], { type: 'application/unknown' });
      const ext = (service as any).getFileExtension(blob);
      expect(ext).toBeNull();
    });
  });

  describe('getExtensionFromFilename', () => {
    it('should extract extension from filename', () => {
      const ext = (service as any).getExtensionFromFilename('file.png');
      expect(ext).toBe('png');
    });

    it('should handle multiple dots', () => {
      const ext = (service as any).getExtensionFromFilename('my.file.name.jpg');
      expect(ext).toBe('jpg');
    });

    it('should return "bin" for files without extension', () => {
      const ext = (service as any).getExtensionFromFilename('filename');
      expect(ext).toBe('bin');
    });

    it('should handle empty string', () => {
      const ext = (service as any).getExtensionFromFilename('');
      expect(ext).toBe('bin');
    });
  });

  describe('downloadWithTimeout', () => {
    it('should return blob on successful download', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          author: { id: 'user-1', username: 'user1', discriminator: '0001', avatar: 'avatar123', global_name: null },
        } as any,
      ];

      const mockBlob = new Blob(['data'], { type: 'image/png' });
      mockDiscordService.downloadFile.mockResolvedValue({ success: true, data: mockBlob });

      await service.downloadAllMedia(messages, null, 'test-channel', mockZipService, mockOnProgress);

      const maps = service.getMaps();
      expect(maps.avatarMap['user-1/avatar123']).toBeDefined();
      expect(mockZipService.addFile).toHaveBeenCalled();
    });

    it('should return null on download failure', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages: Message[] = [
        {
          ...createMockMessage(),
          author: { id: 'user-1', username: 'user1', discriminator: '0001', avatar: 'avatar123', global_name: null },
        } as any,
      ];

      mockDiscordService.downloadFile.mockRejectedValue(new Error('Network error'));

      await service.downloadAllMedia(messages, null, 'test-channel', mockZipService, mockOnProgress);

      const maps = service.getMaps();
      expect(maps.avatarMap['user-1/avatar123']).toBeUndefined();
      expect(mockZipService.addFile).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should return null when the transport gives up on a stalled download (#232)', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const messages: Message[] = [
        {
          ...createMockMessage(),
          author: { id: 'user-1', username: 'user1', discriminator: '0001', avatar: 'avatar123', global_name: null },
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({ success: false, data: null });

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress
      );

      const maps = service.getMaps();
      expect(maps.avatarMap['user-1/avatar123']).toBeUndefined();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('non-media file downloads', () => {
    it('should download non-media files via CDN url in extension mode', async () => {
      const { isExtensionMode } = await import('@/extension/messaging');
      vi.mocked(isExtensionMode).mockReturnValue(true);

      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [
            {
              id: 'att-1',
              url: 'https://cdn.discordapp.com/attachments/123/456/report.pdf?ex=abc&hm=cdn_sig',
              proxy_url: 'https://media.discordapp.net/attachments/123/456/report.pdf?ex=abc&hm=proxy_sig',
              filename: 'report.pdf',
            },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['pdf-data'], { type: 'application/pdf' }),
      });

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        { images: false, videos: false, audio: false, other: true }
      );

      expect(mockDiscordService.downloadFile).toHaveBeenCalledWith(
        'https://cdn.discordapp.com/attachments/123/456/report.pdf?ex=abc&hm=cdn_sig'
      );
      expect(mockZipService.addFile).toHaveBeenCalled();

      vi.mocked(isExtensionMode).mockReturnValue(false);
    });

    it('should skip non-media files in web app mode even if other is true', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [
            {
              id: 'att-1',
              url: 'https://cdn.discordapp.com/attachments/123/456/report.pdf',
              proxy_url: 'https://media.discordapp.net/attachments/123/456/report.pdf',
              filename: 'report.pdf',
            },
          ],
        } as any,
      ];

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        { images: true, videos: true, audio: true, other: true }
      );

      // Web app mode (default mock) — non-media files should be skipped entirely
      expect(mockDiscordService.downloadFile).not.toHaveBeenCalled();
    });

    it('should skip non-media files in extension mode when other is disabled', async () => {
      const { isExtensionMode } = await import('@/extension/messaging');
      vi.mocked(isExtensionMode).mockReturnValue(true);

      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [
            { id: 'att-1', url: 'https://cdn.discordapp.com/attachments/123/456/report.pdf', filename: 'report.pdf' },
          ],
        } as any,
      ];

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        { images: true, videos: true, audio: true, other: false }
      );

      expect(mockDiscordService.downloadFile).not.toHaveBeenCalled();

      vi.mocked(isExtensionMode).mockReturnValue(false);
    });

    it('should use filename extension for unknown MIME types in extension mode', async () => {
      const { isExtensionMode } = await import('@/extension/messaging');
      vi.mocked(isExtensionMode).mockReturnValue(true);

      const messages: Message[] = [
        {
          ...createMockMessage(),
          attachments: [
            {
              id: 'att-1',
              url: 'https://cdn.discordapp.com/attachments/123/456/archive.zip',
              filename: 'archive.zip',
            },
          ],
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['zip-data'], { type: 'application/octet-stream' }),
      });

      await service.downloadAllMedia(
        messages, null, 'test-channel', mockZipService, mockOnProgress,
        { images: false, videos: false, audio: false, other: true }
      );

      const maps = service.getMaps();
      const path = maps.mediaMap['https://cdn.discordapp.com/attachments/123/456/archive.zip'];
      expect(path).toContain('.zip');

      vi.mocked(isExtensionMode).mockReturnValue(false);
    });
  });

  describe('getMaps', () => {
    it('should return media maps', () => {
      const maps = service.getMaps();
      expect(maps).toHaveProperty('avatarMap');
      expect(maps).toHaveProperty('mediaMap');
      expect(maps).toHaveProperty('emojiMap');
      expect(maps).toHaveProperty('roleMap');
    });

    it('should return populated maps after downloads', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          author: {
            id: 'user-1',
            username: 'user1',
            discriminator: '0001',
            avatar: 'avatar123',
            global_name: null,
          },
        } as any,
      ];

      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(
        messages,
        null,
        'test-channel',
        mockZipService,
        mockOnProgress
      );

      const maps = service.getMaps();
      expect(Object.keys(maps.avatarMap).length).toBeGreaterThan(0);
    });
  });

  describe('downloadStickers (#213)', () => {
    it('downloads raster stickers to stickers/{id}.{ext} and skips Lottie', async () => {
      const messages: Message[] = [
        {
          ...createMockMessage(),
          sticker_items: [
            { id: 's-png', name: 'wave', format_type: 1 },
            { id: 's-gif', name: 'dance', format_type: 4 },
            { id: 's-lottie', name: 'sparkle', format_type: 3 },
          ],
        } as any,
      ];
      mockDiscordService.downloadFile.mockResolvedValue({
        success: true,
        data: new Blob(['data'], { type: 'image/png' }),
      });

      await service.downloadAllMedia(messages, null, 'test-channel', mockZipService, mockOnProgress);

      const stickerPaths = (mockZipService.addFile as any).mock.calls
        .map((c: any[]) => c[1])
        .filter((p: string) => p.includes('/stickers/'));
      expect(stickerPaths).toContain('test-channel/stickers/s-png.png');
      expect(stickerPaths).toContain('test-channel/stickers/s-gif.gif');
      // Lottie is never downloaded (can't be rasterized).
      expect(stickerPaths.some((p: string) => p.includes('s-lottie'))).toBe(false);
    });
  });
});
