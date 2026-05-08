import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestStore, TestStore } from '@/test/test-utils';
import exportReducer, {
  buildUniqueFolderNames,
  exportMessages,
  setExportFormat,
  setMessagesPerPage,
  setSeparateThreads,
  setIncludeMedia,
  setExportProgress,
  setTotalPages,
  setArtistMode,
  setSortOrder,
  setPreviewMedia,
  applyPreset,
  initializeExportFromSettings,
  resetExport,
  selectExport,
  selectIsExporting,
  selectExportProgress,
  selectExportFormat,
  selectExportError,
} from './exportSlice';
import cacheReducer from '@features/cache/cacheSlice';
import { initialExportState, MediaDownloadProgress } from './exportTypes';
import { createMockMessages } from '@/test/fixtures';
import * as exportService from '@services/exportService';

// Mock the export service
vi.mock('@services/exportService', () => ({
  getExportService: vi.fn(() => ({
    exportToZip: vi.fn(),
    exportMediaOnly: vi.fn(),
  })),
  generateExportReadme: vi.fn(() => 'README'),
}));

vi.mock('@services/reactionEnrichmentService', () => ({
  reactionEnrichmentService: {
    enrichMessages: vi.fn().mockImplementation(async (msgs) => msgs),
  },
}));

// Bulk-export-with-searchCriteria reaches into the search iterator,
// constructs a StreamingZipService, and pulls from discordService.
// These mocks let the bulk thunk run synthetically without touching
// the network or the filesystem; existing tests don't call any of
// these surfaces, so the mocks are harmless to other suites in this
// file.
vi.mock('@/utils/searchPagination', async () => {
  const actual = await vi.importActual<any>('@/utils/searchPagination');
  return {
    ...actual,
    iterateSearchMessagesRedux: vi.fn(),
  };
});

vi.mock('@services/streamingZipService', () => ({
  StreamingZipService: class {
    async addFile() {}
    async finalize() {}
    dispose() {}
  },
}));

vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(() => ({
    fetchMessageData: vi.fn(),
    fetchSearchMessageData: vi.fn(),
    iterateSearchResults: async function* () {},
  })),
}));

// Skip the real per-page delay (1s default) so unfiltered-branch walk
// tests don't wait seconds per page. Existing tests didn't need this
// because they don't reach the delay path.
vi.mock('@/utils/delayUtils', () => ({
  calculateRandomDelay: vi.fn(() => ({ delayMs: 0, delaySec: 0, baseDelay: 0, modifier: 0, randomComponent: 0 })),
}));
vi.mock('@/utils/operationLoopUtils', async () => {
  const actual = await vi.importActual<any>('@/utils/operationLoopUtils');
  return {
    ...actual,
    cancellableDelay: vi.fn().mockResolvedValue(false),
    waitWhilePaused: vi.fn().mockResolvedValue(undefined),
  };
});

describe('exportSlice', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createTestStore({ export: exportReducer, cache: cacheReducer });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState();
      expect(state.export).toEqual(initialExportState);
      expect(state.export.isExporting).toBe(false);
      expect(state.export.exportFormat).toBe('html');
      expect(state.export.messagesPerPage).toBe(100);
      expect(state.export.separateThreads).toBe(false);
      expect(state.export.includeMedia).toBe(true);
    });
  });

  describe('reducers', () => {
    it('should set export format', () => {
      store.dispatch(setExportFormat('csv'));
      expect(store.getState().export.exportFormat).toBe('csv');

      store.dispatch(setExportFormat('json'));
      expect(store.getState().export.exportFormat).toBe('json');

      store.dispatch(setExportFormat('html'));
      expect(store.getState().export.exportFormat).toBe('html');
    });

    it('should set messages per page', () => {
      store.dispatch(setMessagesPerPage(50));
      expect(store.getState().export.messagesPerPage).toBe(50);

      store.dispatch(setMessagesPerPage(200));
      expect(store.getState().export.messagesPerPage).toBe(200);
    });

    it('should set separate threads flag', () => {
      expect(store.getState().export.separateThreads).toBe(false);

      store.dispatch(setSeparateThreads(true));
      expect(store.getState().export.separateThreads).toBe(true);

      store.dispatch(setSeparateThreads(false));
      expect(store.getState().export.separateThreads).toBe(false);
    });

    it('should set include media flag', () => {
      expect(store.getState().export.includeMedia).toBe(true);

      store.dispatch(setIncludeMedia(false));
      expect(store.getState().export.includeMedia).toBe(false);

      store.dispatch(setIncludeMedia(true));
      expect(store.getState().export.includeMedia).toBe(true);
    });

    it('should set export progress', () => {
      const progress: MediaDownloadProgress = {
        stage: 'avatars',
        current: 5,
        total: 10,
        message: 'Downloading avatars...',
      };

      store.dispatch(setExportProgress(progress));
      expect(store.getState().export.exportProgress).toEqual(progress);
    });

    it('should update export progress stages', () => {
      const stages: MediaDownloadProgress['stage'][] = [
        'avatars',
        'attachments',
        'emojis',
        'roles',
        'html',
        'finalizing',
      ];

      stages.forEach((stage, index) => {
        const progress: MediaDownloadProgress = {
          stage,
          current: index + 1,
          total: stages.length,
        };

        store.dispatch(setExportProgress(progress));
        expect(store.getState().export.exportProgress?.stage).toBe(stage);
      });
    });

    it('should set total pages', () => {
      store.dispatch(setTotalPages(5));
      expect(store.getState().export.totalPages).toBe(5);

      store.dispatch(setTotalPages(10));
      expect(store.getState().export.totalPages).toBe(10);
    });

    it('should reset export state', () => {
      // Set some state first
      store.dispatch(setExportFormat('csv'));
      store.dispatch(setMessagesPerPage(50));
      store.dispatch(setTotalPages(5));
      store.dispatch(setExportProgress({
        stage: 'avatars',
        current: 5,
        total: 10,
      }));

      // Reset should only reset certain fields
      store.dispatch(resetExport());

      const state = store.getState().export;
      expect(state.isExporting).toBe(false);
      expect(state.exportProgress).toBeNull();
      expect(state.exportTotal).toBe(0);
      expect(state.currentPage).toBe(0);
      expect(state.totalPages).toBe(0);
      expect(state.exportError).toBeNull();

      // These should remain unchanged
      expect(state.exportFormat).toBe('csv');
      expect(state.messagesPerPage).toBe(50);
    });
  });

  describe('exportMessages async thunk', () => {
    it('should handle successful export', async () => {
      const mockExportService = {
        exportToZip: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(exportService.getExportService).mockReturnValue(mockExportService as any);

      const messages = createMockMessages(5);
      const params = {
        messages,
        channelName: 'test-channel',
        format: 'html' as const,
        messagesPerPage: 100,
        separateThreads: false,
        includeMedia: true,
      };

      const result = await store.dispatch(exportMessages(params));

      expect(result.type).toBe('export/exportMessages/fulfilled');
      expect(result.payload).toEqual({ success: true });
      expect(mockExportService.exportToZip).toHaveBeenCalledWith(
        messages,
        'test-channel',
        'html',
        100,
        true,
        null,
        {},
        null,
        expect.any(Function),
        undefined,
        undefined,
        expect.any(Function),
        undefined,
        false,
        [],
        undefined,
        [],
      );

      const state = store.getState().export;
      expect(state.isExporting).toBe(false);
      expect(state.exportError).toBeNull();
    });

    it('should set isExporting to true when pending', async () => {
      const mockExportService = {
        exportToZip: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
      };
      vi.mocked(exportService.getExportService).mockReturnValue(mockExportService as any);

      const messages = createMockMessages(5);
      const params = {
        messages,
        channelName: 'test-channel',
        format: 'html' as const,
        messagesPerPage: 100,
        separateThreads: false,
        includeMedia: true,
      };

      store.dispatch(exportMessages(params));

      // Check immediately after dispatch (pending state)
      const state = store.getState().export;
      expect(state.isExporting).toBe(true);
      expect(state.exportError).toBeNull();
      expect(state.exportProgress).toBeNull();
    });

    it('should handle export error', async () => {
      const mockExportService = {
        exportToZip: vi.fn().mockRejectedValue(new Error('Export failed')),
      };
      vi.mocked(exportService.getExportService).mockReturnValue(mockExportService as any);

      const messages = createMockMessages(5);
      const params = {
        messages,
        channelName: 'test-channel',
        format: 'html' as const,
        messagesPerPage: 100,
        separateThreads: false,
        includeMedia: true,
      };

      const result = await store.dispatch(exportMessages(params));

      expect(result.type).toBe('export/exportMessages/rejected');
      expect(result.payload).toBe('Export failed');

      const state = store.getState().export;
      expect(state.isExporting).toBe(false);
      expect(state.exportError).toBe('Export failed');
    });

    it('should handle non-Error exceptions', async () => {
      const mockExportService = {
        exportToZip: vi.fn().mockRejectedValue('String error'),
      };
      vi.mocked(exportService.getExportService).mockReturnValue(mockExportService as any);

      const messages = createMockMessages(5);
      const params = {
        messages,
        channelName: 'test-channel',
        format: 'html' as const,
        messagesPerPage: 100,
        separateThreads: false,
        includeMedia: true,
      };

      const result = await store.dispatch(exportMessages(params));

      expect(result.type).toBe('export/exportMessages/rejected');
      expect(result.payload).toBe('Failed to export messages');
    });

    it('should dispatch progress updates during export', async () => {
      let capturedProgressUpdates: MediaDownloadProgress[] = [];

      const mockExportService = {
        exportToZip: vi.fn().mockImplementation(async (
          _messages,
          _channelName,
          _format,
          _messagesPerPage,
          _includeMedia,
          _guild,
          _cachedUserMap,
          _guildId,
          progressCallback
        ) => {
          // Simulate progress updates
          const progress1 = { stage: 'avatars' as const, current: 5, total: 10 };
          const progress2 = { stage: 'attachments' as const, current: 10, total: 10 };

          progressCallback(progress1);
          capturedProgressUpdates.push(progress1);

          progressCallback(progress2);
          capturedProgressUpdates.push(progress2);
        }),
      };
      vi.mocked(exportService.getExportService).mockReturnValue(mockExportService as any);

      const messages = createMockMessages(5);
      const params = {
        messages,
        channelName: 'test-channel',
        format: 'html' as const,
        messagesPerPage: 100,
        separateThreads: false,
        includeMedia: true,
      };

      await store.dispatch(exportMessages(params));

      // After export completes, exportProgress is set to null
      // But we can verify the progress callbacks were called
      expect(capturedProgressUpdates).toHaveLength(2);
      expect(capturedProgressUpdates[0]).toEqual({
        stage: 'avatars',
        current: 5,
        total: 10,
      });
      expect(capturedProgressUpdates[1]).toEqual({
        stage: 'attachments',
        current: 10,
        total: 10,
      });

      // exportProgress is null after successful completion
      const state = store.getState().export;
      expect(state.exportProgress).toBeNull();
    });

    it('should not dispatch non-object progress updates', async () => {
      const mockExportService = {
        exportToZip: vi.fn().mockImplementation(async (
          _messages,
          _channelName,
          _format,
          _messagesPerPage,
          _includeMedia,
          _guild,
          _cachedUserMap,
          _guildId,
          progressCallback
        ) => {
          // Try to pass a number (should be ignored)
          progressCallback(5);
        }),
      };
      vi.mocked(exportService.getExportService).mockReturnValue(mockExportService as any);

      const messages = createMockMessages(5);
      const params = {
        messages,
        channelName: 'test-channel',
        format: 'html' as const,
        messagesPerPage: 100,
        separateThreads: false,
        includeMedia: true,
      };

      await store.dispatch(exportMessages(params));

      // Progress should still be null since number was ignored
      const state = store.getState().export;
      expect(state.exportProgress).toBeNull();
    });

    it('should use cached user map from state', async () => {
      const mockExportService = {
        exportToZip: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(exportService.getExportService).mockReturnValue(mockExportService as any);

      // Set up cached user data
      const mockUserMap = {
        'user1': { userName: 'Test User', timestamp: Date.now() },
      };
      store.dispatch({ type: 'cache/setUserMapInMemory', payload: mockUserMap });

      const messages = createMockMessages(5);
      const params = {
        messages,
        channelName: 'test-channel',
        format: 'html' as const,
        messagesPerPage: 100,
        separateThreads: false,
        includeMedia: true,
      };

      await store.dispatch(exportMessages(params));

      // Verify cachedUserMap was passed to exportService
      expect(mockExportService.exportToZip).toHaveBeenCalledWith(
        messages,
        'test-channel',
        'html',
        100,
        true,
        null,
        mockUserMap,
        null,
        expect.any(Function),
        undefined,
        undefined,
        expect.any(Function),
        undefined,
        false,
        [],
        undefined,
        [],
      );
    });

    it('should pass guildId when provided', async () => {
      const mockExportService = {
        exportToZip: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(exportService.getExportService).mockReturnValue(mockExportService as any);

      const messages = createMockMessages(5);
      const params = {
        messages,
        channelName: 'test-channel',
        format: 'csv' as const,
        messagesPerPage: 50,
        separateThreads: true,
        includeMedia: false,
        guildId: 'guild-123',
      };

      await store.dispatch(exportMessages(params));

      expect(mockExportService.exportToZip).toHaveBeenCalledWith(
        messages,
        'test-channel',
        'csv',
        50,
        false,
        null,
        {},
        'guild-123',
        expect.any(Function),
        undefined,
        undefined,
        expect.any(Function),
        undefined,
        true,
        [],
        undefined,
        [],
      );
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      store.dispatch(setExportFormat('csv'));
      store.dispatch(setMessagesPerPage(50));
      store.dispatch(setExportProgress({
        stage: 'avatars',
        current: 5,
        total: 10,
      }));
    });

    it('selectExport should return entire export state', () => {
      const exportState = selectExport(store.getState());
      expect(exportState).toHaveProperty('isExporting');
      expect(exportState).toHaveProperty('exportFormat');
      expect(exportState).toHaveProperty('exportProgress');
    });

    it('selectIsExporting should return isExporting flag', () => {
      expect(selectIsExporting(store.getState())).toBe(false);
    });

    it('selectExportProgress should return export progress', () => {
      const progress = selectExportProgress(store.getState());
      expect(progress).toEqual({
        stage: 'avatars',
        current: 5,
        total: 10,
      });
    });

    it('selectExportFormat should return export format', () => {
      expect(selectExportFormat(store.getState())).toBe('csv');
    });

    it('selectExportError should return export error', () => {
      expect(selectExportError(store.getState())).toBeNull();

      // Set an error state by simulating a rejected export
      store.dispatch({
        type: 'export/exportMessages/rejected',
        payload: 'Test error',
      });

      expect(selectExportError(store.getState())).toBe('Test error');
    });
  });

  describe('new Phase 1 reducers', () => {
    it('setArtistMode updates state', () => {
      store.dispatch(setArtistMode(true));
      expect(store.getState().export.artistMode).toBe(true);
      store.dispatch(setArtistMode(false));
      expect(store.getState().export.artistMode).toBe(false);
    });

    it('setSortOrder updates state', () => {
      store.dispatch(setSortOrder('ascending'));
      expect(store.getState().export.sortOrder).toBe('ascending');
      store.dispatch(setSortOrder('descending'));
      expect(store.getState().export.sortOrder).toBe('descending');
    });

    it('setPreviewMedia updates state', () => {
      store.dispatch(setPreviewMedia(false));
      expect(store.getState().export.previewMedia).toBe(false);
      store.dispatch(setPreviewMedia(true));
      expect(store.getState().export.previewMedia).toBe(true);
    });

    it('applyPreset sets all export state fields atomically', () => {
      store.dispatch(applyPreset({
        format: 'json',
        messagesPerPage: 500,
        separateThreads: true,
        includeMedia: true,
        mediaConfig: { images: true, videos: false, audio: false, other: false },
        artistMode: true,
        sortOrder: 'ascending',
        previewMedia: false,
      }));

      const state = store.getState().export;
      expect(state.exportFormat).toBe('json');
      expect(state.messagesPerPage).toBe(500);
      expect(state.separateThreads).toBe(true);
      expect(state.includeMedia).toBe(true);
      expect(state.mediaConfig.videos).toBe(false);
      expect(state.artistMode).toBe(true);
      expect(state.sortOrder).toBe('ascending');
      expect(state.previewMedia).toBe(false);
    });

    it('applyPreset with format=media does not auto-enable includeMedia', () => {
      // First set includeMedia to false
      store.dispatch(setIncludeMedia(false));

      // Apply preset with media format but includeMedia explicitly false
      store.dispatch(applyPreset({
        format: 'media',
        messagesPerPage: 100,
        separateThreads: false,
        includeMedia: false,
        mediaConfig: { images: true, videos: true, audio: true, other: true },
        artistMode: false,
        sortOrder: 'descending',
        previewMedia: true,
      }));

      // Should respect the preset value, not the setExportFormat side effect
      expect(store.getState().export.includeMedia).toBe(false);
      expect(store.getState().export.exportFormat).toBe('media');
    });

    it('initializeExportFromSettings reads all export settings', () => {
      store.dispatch(initializeExportFromSettings({
        exportFormat: 'csv',
        exportMessagesPerPage: '200',
        exportSeparateThreadAndForumPosts: 'false',
        exportDownloadMedia_2: 'true',
        exportMediaImages: 'true',
        exportMediaVideos: 'false',
        exportMediaAudio: 'true',
        exportMediaOther: 'false',
        exportUseArtistMode: 'true',
        exportMessageSortOrder: 'asc',
        exportPreviewMedia_2: 'false',
      }));

      const state = store.getState().export;
      expect(state.exportFormat).toBe('csv');
      expect(state.messagesPerPage).toBe(200);
      expect(state.separateThreads).toBe(false);
      expect(state.includeMedia).toBe(true);
      expect(state.mediaConfig.images).toBe(true);
      expect(state.mediaConfig.videos).toBe(false);
      expect(state.mediaConfig.audio).toBe(true);
      expect(state.mediaConfig.other).toBe(false);
      expect(state.artistMode).toBe(true);
      expect(state.sortOrder).toBe('ascending');
      expect(state.previewMedia).toBe(false);
    });

    it('initializeExportFromSettings restores export template', () => {
      store.dispatch(initializeExportFromSettings({
        exportTemplate: 'discord',
      }));

      const state = store.getState().export;
      expect(state.exportTemplate).toBe('discord');
    });

    it('initializeExportFromSettings does not auto-apply persisted preset (Option A)', () => {
      // Simulate: user selected "Spreadsheet export" preset (CSV) then changed format to JSON
      store.dispatch(initializeExportFromSettings({
        exportFormat: 'json', // user's manual override
        exportSelectedPreset: 'builtin-spreadsheet', // persisted preset ID
      }));

      const state = store.getState().export;
      // Individual settings should take precedence — preset is cosmetic only
      expect(state.exportFormat).toBe('json');
    });

    it('initializeExportFromSettings with missing settings uses defaults', () => {
      store.dispatch(initializeExportFromSettings({}));

      const state = store.getState().export;
      expect(state.exportFormat).toBe('html');
      expect(state.messagesPerPage).toBe(100);
      expect(state.mediaConfig.images).toBe(true);
      expect(state.previewMedia).toBe(true);
      expect(state.exportTemplate).toBe('discord');
    });

    it('initializeExportFromSettings with null does nothing', () => {
      store.dispatch(setExportFormat('csv'));
      store.dispatch(initializeExportFromSettings(null));
      expect(store.getState().export.exportFormat).toBe('csv');
    });

    it('resetExport only clears operation state', () => {
      // Set config
      store.dispatch(setExportFormat('csv'));
      store.dispatch(setArtistMode(true));
      store.dispatch(setSortOrder('ascending'));
      store.dispatch(setMessagesPerPage(500));

      // Set operation state
      store.dispatch(setExportProgress({
        stage: 'avatars', current: 5, total: 10,
      }));

      // Reset
      store.dispatch(resetExport());

      const state = store.getState().export;
      // Operation state cleared
      expect(state.isExporting).toBe(false);
      expect(state.exportProgress).toBeNull();
      expect(state.exportError).toBeNull();

      // Config preserved
      expect(state.exportFormat).toBe('csv');
      expect(state.artistMode).toBe(true);
      expect(state.sortOrder).toBe('ascending');
      expect(state.messagesPerPage).toBe(500);
    });
  });

  describe('buildUniqueFolderNames', () => {
    it('returns sanitized names when no collisions', () => {
      const result = buildUniqueFolderNames([
        { id: '1', name: 'general' },
        { id: '2', name: 'announcements' },
      ]);
      expect(result.get('1')).toBe('general');
      expect(result.get('2')).toBe('announcements');
    });

    it('appends ID suffix when case-insensitive names collide', () => {
      const result = buildUniqueFolderNames([
        { id: '100', name: 'General' },
        { id: '200', name: 'general' },
      ]);
      expect(result.get('100')).toBe('general_100');
      expect(result.get('200')).toBe('general_200');
    });

    it('appends ID suffix when special characters cause collision', () => {
      const result = buildUniqueFolderNames([
        { id: '100', name: 'my-channel' },
        { id: '200', name: 'my_channel' },
      ]);
      expect(result.get('100')).toBe('my_channel_100');
      expect(result.get('200')).toBe('my_channel_200');
    });

    it('handles mixed collisions and unique names', () => {
      const result = buildUniqueFolderNames([
        { id: '1', name: 'unique-channel' },
        { id: '2', name: 'General' },
        { id: '3', name: 'general' },
      ]);
      expect(result.get('1')).toBe('unique_channel');
      expect(result.get('2')).toBe('general_2');
      expect(result.get('3')).toBe('general_3');
    });

    it('collapses multiple underscores from special characters', () => {
      const result = buildUniqueFolderNames([
        { id: '1', name: '💬┆general' },
      ]);
      expect(result.get('1')).toBe('general');
    });

    it('strips leading/trailing underscores', () => {
      const result = buildUniqueFolderNames([
        { id: '1', name: '#channel!' },
      ]);
      expect(result.get('1')).toBe('channel');
    });

    it('handles empty names with fallback', () => {
      const result = buildUniqueFolderNames([
        { id: '1', name: 'channel-1' },
        { id: '2', name: '' },
      ]);
      expect(result.get('2')).toBeDefined();
    });

    it('handles three-way collision', () => {
      const result = buildUniqueFolderNames([
        { id: '1', name: 'Info' },
        { id: '2', name: 'info' },
        { id: '3', name: 'INFO' },
      ]);
      expect(result.get('1')).toBe('info_1');
      expect(result.get('2')).toBe('info_2');
      expect(result.get('3')).toBe('info_3');
    });
  });

  describe('Pass 1 reaction enrichment contract for bulk export with searchCriteria (#163)', () => {
    // Bulk-export-with-searchCriteria flows through fetchAllChannelMessages →
    // iterateSearchMessagesRedux → Discord search endpoint, which omits
    // reactions. Pass 1 must run on the aggregated messages before the
    // export pipeline fans them out to per-channel zips, otherwise both
    // bulkExportChannels and bulkExportDMs silently drop reactions for
    // search-loaded sets — same shape as the live-feed bug at the four
    // search thunks.

    it('runs reactionEnrichmentService.enrichMessages on iterator output when searchCriteria is active', async () => {
      const { configureStore } = await import('@reduxjs/toolkit');
      const { default: exportReducer, bulkExportChannels } = await import('./exportSlice');
      const appReducer = (await import('@features/app/appSlice')).default;
      const { defaultSettings } = await import('@features/app/appSlice');
      const authReducer = (await import('@features/auth/authSlice')).default;
      const statusReducer = (await import('@features/status/statusSlice')).default;
      const historyReducer = (await import('@features/history/historySlice')).default;
      const { reactionEnrichmentService } = await import('@services/reactionEnrichmentService');
      const { iterateSearchMessagesRedux } = await import('@/utils/searchPagination');

      vi.mocked(iterateSearchMessagesRedux).mockImplementation(async function* () {
        yield {
          messages: [
            {
              id: 'sm-1',
              channel_id: 'ch-1',
              timestamp: '2026-01-01T00:00:00.000Z',
              author: { id: 'u', username: 'u', discriminator: '0', global_name: null, avatar: null },
              content: 'hi',
              mentions: [],
              attachments: [],
              embeds: [],
              pinned: false,
              type: 0,
              mention_everyone: false,
              edited_timestamp: null,
              tts: false,
              reactions: undefined,
            } as any,
          ],
          totalResults: 1,
          pageIndex: 0,
          aggregatedCount: 1,
          crossedQueryBoundary: false,
        };
      });

      const testStore = configureStore({
        reducer: {
          export: exportReducer,
          app: appReducer,
          auth: authReducer,
          status: statusReducer,
          history: historyReducer,
          cache: cacheReducer,
        } as any,
        preloadedState: {
          app: {
            discrubPaused: false,
            discrubCancelled: false,
            isMinimized: false,
            focusedView: false,
            sidebarView: 'server' as const,
            task: { status: 'idle' as const, message: '' },
            settings: defaultSettings,
          },
        } as any,
      });

      vi.mocked(reactionEnrichmentService.enrichMessages).mockClear();

      await testStore.dispatch(
        bulkExportChannels({
          channels: [{ id: 'ch-1', name: 'general' } as any],
          token: 'token',
          format: 'html',
          messagesPerPage: 100,
          separateThreads: false,
          includeMedia: false,
          guildId: 'g-1',
          searchCriteria: { searchMessageContent: 'x' } as any,
        })
      );

      // The exact call count depends on whether the export's per-format
      // pass also enriches; what matters is that AT LEAST ONE call lands
      // with the iterator's messages, proving search-criteria bulk
      // exports flow through Pass 1 enrichment.
      const calls = vi.mocked(reactionEnrichmentService.enrichMessages).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      const firstCallMessages = calls[0][0];
      expect(firstCallMessages.length).toBeGreaterThan(0);
      expect(firstCallMessages[0].id).toBe('sm-1');
      expect(firstCallMessages[0].reactions).toBeUndefined();
    });
  });

  describe('Bulk export unfiltered branch status log milestones (#167)', () => {
    // The unfiltered branch of fetchAllChannelMessages walks the channel
    // history endpoint with no inherent feedback. #167 adds a "Loading
    // messages from X…" entry on entry, per-500-message milestones during
    // the walk, and a "Loaded N messages from X" success entry on exit.
    // Mirrors the search-criteria branch's pattern.

    it('emits start, milestone, and success entries during an unfiltered bulk-export channel walk', async () => {
      const { configureStore } = await import('@reduxjs/toolkit');
      const { default: exportReducer, bulkExportChannels } = await import('./exportSlice');
      const appReducer = (await import('@features/app/appSlice')).default;
      const { defaultSettings } = await import('@features/app/appSlice');
      const authReducer = (await import('@features/auth/authSlice')).default;
      const statusReducer = (await import('@features/status/statusSlice')).default;
      const historyReducer = (await import('@features/history/historySlice')).default;
      const { getDiscordService } = await import('@services/discordService');

      // Build a fake fetchMessageData that streams ~600 messages across
      // pages of 100, so we cross the first 500-msg milestone before
      // hitting the < 100 short-page terminator.
      let cursor = 0;
      const TOTAL = 600;
      vi.mocked(getDiscordService).mockReturnValue({
        fetchMessageData: vi.fn().mockImplementation(async () => {
          const remaining = TOTAL - cursor;
          if (remaining <= 0) return { success: true, data: [] };
          const pageSize = Math.min(100, remaining);
          const data = Array.from({ length: pageSize }, (_, i) => ({
            id: `${cursor + i + 1}`,
            channel_id: 'ch-unfiltered',
            timestamp: '2026-01-01T00:00:00.000Z',
            author: { id: 'u', username: 'u', discriminator: '0', global_name: null, avatar: null },
            content: 'msg',
            mentions: [],
            attachments: [],
            embeds: [],
            pinned: false,
            type: 0,
            mention_everyone: false,
            edited_timestamp: null,
            tts: false,
            reactions: [],
          }));
          cursor += pageSize;
          return { success: true, data };
        }),
        fetchSearchMessageData: vi.fn(),
        iterateSearchResults: async function* () {},
      } as any);

      const testStore = configureStore({
        reducer: {
          export: exportReducer,
          app: appReducer,
          auth: authReducer,
          status: statusReducer,
          history: historyReducer,
          cache: cacheReducer,
        } as any,
        preloadedState: {
          app: {
            discrubPaused: false,
            discrubCancelled: false,
            isMinimized: false,
            focusedView: false,
            sidebarView: 'server' as const,
            task: { status: 'idle' as const, message: '' },
            settings: defaultSettings,
          },
        } as any,
      });

      await testStore.dispatch(
        bulkExportChannels({
          channels: [{ id: 'ch-unfiltered', name: 'unfiltered-channel' } as any],
          token: 'token',
          format: 'html',
          messagesPerPage: 100,
          separateThreads: false,
          includeMedia: false,
          guildId: 'g-1',
          // No searchCriteria → unfiltered branch.
        })
      );

      const entries = testStore.getState().status.entries.map((e: any) => e.message);

      // Start entry referencing the channel label.
      expect(entries.some((m: string) => m.includes('Loading messages from #unfiltered-channel'))).toBe(true);
      // 500-message milestone (boundary crossed at 500 of 600).
      expect(entries.some((m: string) => m.includes('Loaded 500 messages from #unfiltered-channel'))).toBe(true);
      // Final success entry with full count.
      expect(entries.some((m: string) =>
        m.includes('Loaded 600 messages from #unfiltered-channel') &&
        // The success-level entry is the final one; looser match here.
        true
      )).toBe(true);
    });
  });
});
