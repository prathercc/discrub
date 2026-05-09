import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  configureStore,
  type ThunkDispatch,
  type UnknownAction,
} from '@reduxjs/toolkit';
import packageReducer, {
  exportPackageChannel,
  importPackage,
  loadPackageChannelMessages,
  __testHelpers__,
} from './packageSlice';
import authReducer from '@features/auth/authSlice';
import userReducer from '@features/user/userSlice';
import appReducer from '@features/app/appSlice';
import statusReducer from '@features/status/statusSlice';
import { buildFixturePackage } from '@/test/package-fixtures';
import type { RootState } from '@/app/store';
import type { ExportConfig } from '@features/export/exportTypes';

const mockExportToZip = vi.fn();

vi.mock('@/services/exportService', () => ({
  getExportService: vi.fn(() => ({
    exportToZip: mockExportToZip,
  })),
}));

const defaultConfig: ExportConfig = {
  artistMode: false,
  sortOrder: 'descending',
  previewMedia: false,
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  exportTemplate: 'discord',
};

function exportArgs(channelId: string, overrides: Record<string, unknown> = {}) {
  return {
    channelId,
    format: 'html' as const,
    messagesPerPage: 500,
    includeMedia: false,
    exportConfig: defaultConfig,
    ...overrides,
  };
}

function makeStore(currentUserId = '253286221395001345') {
  const store = configureStore({
    reducer: {
      package: packageReducer,
      auth: authReducer,
      user: userReducer,
      app: appReducer,
      status: statusReducer,
    },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  }) as unknown as {
    dispatch: ThunkDispatch<RootState, unknown, UnknownAction>;
    getState: () => RootState;
  };
  store.dispatch({
    type: 'user/setCurrentUser',
    payload: { id: currentUserId, username: 'tester' },
  });
  return store;
}

describe('packageSlice — exportPackageChannel', () => {
  beforeEach(() => {
    mockExportToZip.mockReset();
    mockExportToZip.mockResolvedValue(undefined);
    __testHelpers__.storeSourceFile(null);
  });

  async function primedStore() {
    const store = makeStore();
    const blob = await buildFixturePackage();
    await store.dispatch(importPackage(blob));
    return store;
  }

  it('exports a cached channel via exportService.exportToZip', async () => {
    const store = await primedStore();
    await store.dispatch(loadPackageChannelMessages('200'));

    const action = await store.dispatch(exportPackageChannel(exportArgs("200")));
    expect(action.type).toBe('package/exportChannel/fulfilled');

    expect(mockExportToZip).toHaveBeenCalledTimes(1);
    const [messages, channelName, format, , includeMedia] =
      mockExportToZip.mock.calls[0];
    expect(Array.isArray(messages)).toBe(true);
    expect(messages).toHaveLength(3);
    expect(channelName).toBe('general');
    expect(format).toBe('html');
    expect(includeMedia).toBe(false);

    expect(store.getState().package.exportStatus).toBe('ready');
  });

  it('lazily loads messages when the channel is not cached', async () => {
    const store = await primedStore();

    const action = await store.dispatch(exportPackageChannel(exportArgs("200")));
    expect(action.type).toBe('package/exportChannel/fulfilled');
    expect(mockExportToZip).toHaveBeenCalledTimes(1);
  });

  it('rejects when the channel is not in the package', async () => {
    const store = await primedStore();

    const action = await store.dispatch(exportPackageChannel(exportArgs("not-there")));
    expect(action.type).toBe('package/exportChannel/rejected');
    expect(mockExportToZip).not.toHaveBeenCalled();
  });

  it('rejects when no package is loaded', async () => {
    const store = makeStore();
    const action = await store.dispatch(exportPackageChannel(exportArgs("200")));
    expect(action.type).toBe('package/exportChannel/rejected');
  });

  it('surfaces export service failures via exportError', async () => {
    mockExportToZip.mockRejectedValueOnce(new Error('ZIP write failed'));
    const store = await primedStore();
    await store.dispatch(loadPackageChannelMessages('200'));

    await store.dispatch(exportPackageChannel(exportArgs("200")));
    const state = store.getState().package;
    expect(state.exportStatus).toBe('error');
    expect(state.exportError).toMatch(/ZIP write failed/);
  });

  it('uses enriched messages instead of CSV-adapted ones when available', async () => {
    const store = await primedStore();
    await store.dispatch(loadPackageChannelMessages('200'));
    // Inject enrichment state directly — no API round-trip in the test.
    store.dispatch({
      type: 'package/hydrateEnrichmentFromCache',
      payload: {
        channelId: '200',
        cache: {
          lastFetched: 1,
          messages: {
            '1': { id: '1', content: 'ENRICHED-1', reactions: [] },
            '2': { id: '2', content: 'ENRICHED-2', reactions: [] },
          },
          misses: { deleted: [], forbidden: [] },
        },
      },
    });

    await store.dispatch(exportPackageChannel(exportArgs("200")));

    const [messages] = mockExportToZip.mock.calls[0];
    expect(messages.map((m: { id: string; content: string }) => m.content)).toEqual([
      'ENRICHED-1',
      'ENRICHED-2',
      // Message '3' has no enrichment entry — falls back to CSV content.
      expect.stringContaining('multi'),
    ]);
  });

  it('honors includeMedia=true even without rehydration (post-2025 packages have permanent URLs)', async () => {
    // Pre-fix: the slice clamped includeMedia to false when no enrichment
    // was present, on the (formerly true) assumption that package URLs
    // were ephemeral. Discord's post-2025-06-14 format ships
    // permanently-signed URLs with the `uc=dp` discriminator, so the
    // clamp is no longer needed and would prevent a valid media bundle.
    const store = await primedStore();
    await store.dispatch(loadPackageChannelMessages('200'));

    await store.dispatch(
      exportPackageChannel(exportArgs("200", { includeMedia: true })),
    );
    const [, , , , includeMedia] = mockExportToZip.mock.calls[0];
    expect(includeMedia).toBe(true);
  });

  it('honors includeMedia once the channel is enriched', async () => {
    const store = await primedStore();
    await store.dispatch(loadPackageChannelMessages('200'));
    store.dispatch({
      type: 'package/hydrateEnrichmentFromCache',
      payload: {
        channelId: '200',
        cache: {
          lastFetched: 1,
          messages: { '1': { id: '1', content: 'hi' } },
          misses: { deleted: [], forbidden: [] },
        },
      },
    });

    await store.dispatch(
      exportPackageChannel(exportArgs("200", { includeMedia: true })),
    );
    const [, , , , includeMedia] = mockExportToZip.mock.calls[0];
    expect(includeMedia).toBe(true);
  });

  it('rehydrateFirst is a no-op when the channel is already cached', async () => {
    // Spy on the enrichment thunk via a dispatch log.
    const store = await primedStore();
    await store.dispatch(loadPackageChannelMessages('200'));
    store.dispatch({
      type: 'package/hydrateEnrichmentFromCache',
      payload: {
        channelId: '200',
        cache: {
          lastFetched: 1,
          messages: { '1': { id: '1', content: 'hi' } },
          misses: { deleted: [], forbidden: [] },
        },
      },
    });

    const dispatched: string[] = [];
    const original = store.dispatch;
    (store as unknown as { dispatch: typeof original }).dispatch = ((
      action: unknown,
    ) => {
      if (typeof action === 'object' && action && 'type' in action) {
        dispatched.push((action as { type: string }).type);
      }
      return original(action as never);
    }) as typeof original;

    await store.dispatch(
      exportPackageChannel(exportArgs('200', { rehydrateFirst: true })),
    );

    // No new enrichment loop started — cache hit short-circuits.
    expect(dispatched).not.toContain('package/enrichChannel/pending');
    expect(mockExportToZip).toHaveBeenCalledTimes(1);
  });

  it('passes a non-undefined onProgress and shouldContinue (#162 progress + cancel wiring)', async () => {
    // exportToZip's signature, in order:
    //   messages, channelName, format, messagesPerPage, includeMedia,
    //   guild, cachedUserMap, guildId, onProgress, mediaConfig,
    //   exportConfig, shouldContinue
    // Pre-fix the slice passed undefined for onProgress and never built
    // a shouldContinue, leaving the status log near-empty for the
    // duration of media downloads and Pause/Cancel as silent no-ops.
    const store = await primedStore();
    await store.dispatch(loadPackageChannelMessages('200'));
    await store.dispatch(exportPackageChannel(exportArgs('200')));

    const args = mockExportToZip.mock.calls[0];
    const onProgress = args[8];
    const shouldContinue = args[11];
    expect(typeof onProgress).toBe('function');
    expect(typeof shouldContinue).toBe('function');
  });

  it('routes media-progress events through to the status log (logMediaProgress wiring)', async () => {
    // Trigger the onProgress callback the slice supplies, then assert
    // the status log gained the corresponding "Downloaded X/N
    // attachments" entry.
    const store = await primedStore();
    await store.dispatch(loadPackageChannelMessages('200'));
    await store.dispatch(exportPackageChannel(exportArgs('200')));

    const onProgress = mockExportToZip.mock.calls[0][8];
    onProgress({ stage: 'attachments', current: 1, total: 50 });
    onProgress({ stage: 'attachments', current: 10, total: 50 });

    const messages = (store.getState().status as { entries: Array<{ message: string }> }).entries
      .map((e) => e.message);
    expect(messages.some((m) => m.includes('Downloaded 1/50 attachments'))).toBe(true);
    expect(messages.some((m) => m.includes('Downloaded 10/50 attachments'))).toBe(true);
  });

  it('format="media" without rehydration proceeds (uc=dp URLs work without it)', async () => {
    // Pre-fix: the slice rejected media-only exports when no enrichment
    // existed, believing every URL would 403. Post-2025-06-14 packages
    // ship permanently-signed URLs that work without rehydration; the
    // export now proceeds and downloads from package URLs directly.
    const mockExportMediaOnly = vi.fn().mockResolvedValue(undefined);
    const { getExportService } = await import('@/services/exportService');
    (getExportService as unknown as { mockImplementation: (fn: () => unknown) => void })
      .mockImplementation(() => ({
        exportToZip: mockExportToZip,
        exportMediaOnly: mockExportMediaOnly,
      }));

    const store = await primedStore();
    await store.dispatch(loadPackageChannelMessages('200'));
    const action = await store.dispatch(
      exportPackageChannel(
        exportArgs('200', { format: 'media', includeMedia: true }),
      ),
    );
    expect(action.type).toBe('package/exportChannel/fulfilled');
    expect(mockExportMediaOnly).toHaveBeenCalledTimes(1);
  });

  it('routes format="media" to exportMediaOnly instead of exportToZip', async () => {
    const mockExportMediaOnly = vi.fn().mockResolvedValue(undefined);
    // Rebuild the service mock for this test to expose exportMediaOnly.
    const { getExportService } = await import('@/services/exportService');
    (getExportService as unknown as { mockImplementation: (fn: () => unknown) => void })
      .mockImplementation(() => ({
        exportToZip: mockExportToZip,
        exportMediaOnly: mockExportMediaOnly,
      }));

    const store = await primedStore();
    await store.dispatch(loadPackageChannelMessages('200'));
    // Enrich so media gating passes.
    store.dispatch({
      type: 'package/hydrateEnrichmentFromCache',
      payload: {
        channelId: '200',
        cache: {
          lastFetched: 1,
          messages: { '1': { id: '1', content: 'hi' } },
          misses: { deleted: [], forbidden: [] },
        },
      },
    });

    await store.dispatch(
      exportPackageChannel(
        exportArgs("200", { format: 'media', includeMedia: true }),
      ),
    );
    expect(mockExportMediaOnly).toHaveBeenCalledTimes(1);
    expect(mockExportToZip).not.toHaveBeenCalled();
  });
});
