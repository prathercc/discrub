import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestStore } from '../../test/test-utils';
import announcementReducer, {
  fetchAnnouncement,
  dismissAnnouncement,
  reopenAnnouncement,
  fetchAnnouncementArchiveThunk,
  selectArchiveVersion,
  fetchAnnouncementMarkdownThunk,
} from './announcementSlice';
import appReducer from '@features/app/appSlice';
import { initialAnnouncementState } from './announcementTypes';
import { initialAppState } from '@features/app/appTypes';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

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

const mockFetchAnnouncementData = vi.fn();
const mockFetchAnnouncementMarkdown = vi.fn();
const mockFetchAnnouncementArchive = vi.fn();

vi.mock('discrub-core/github-service', () => ({
  fetchAnnouncementData: (...args: unknown[]) => mockFetchAnnouncementData(...args),
  fetchAnnouncementMarkdown: (...args: unknown[]) => mockFetchAnnouncementMarkdown(...args),
  fetchAnnouncementArchive: (...args: unknown[]) => mockFetchAnnouncementArchive(...args),
}));

describe('announcementSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createStore = (settings?: Record<string, string>) => {
    const appState = {
      ...initialAppState,
      settings: settings || {},
    };
    return createTestStore(
      { announcement: announcementReducer, app: appReducer },
      { announcement: { ...initialAnnouncementState }, app: appState }
    );
  };

  describe('fetchAnnouncement', () => {
    it('should set hasNew to true when rev is different from cached', async () => {
      mockFetchAnnouncementData.mockResolvedValue({ rev: 'rev-2' });
      mockFetchAnnouncementMarkdown.mockResolvedValue('# New announcement');

      const store = createStore({ [DiscrubSetting.CACHED_ANNOUNCEMENT_REV]: 'rev-1' });
      await store.dispatch(fetchAnnouncement());

      const state = store.getState().announcement;
      expect(state.hasNew).toBe(true);
      expect(state.rev).toBe('rev-2');
      expect(state.markdown).toBe('# New announcement');
      expect(state.isLoading).toBe(false);
    });

    it('should set hasNew to false when rev matches cached and skip markdown fetch', async () => {
      mockFetchAnnouncementData.mockResolvedValue({ rev: 'rev-1' });

      const store = createStore({ [DiscrubSetting.CACHED_ANNOUNCEMENT_REV]: 'rev-1' });
      await store.dispatch(fetchAnnouncement());

      const state = store.getState().announcement;
      expect(state.hasNew).toBe(false);
      expect(state.markdown).toBeNull();
      expect(mockFetchAnnouncementMarkdown).not.toHaveBeenCalled();
    });

    it('should set hasNew to true when no cached rev exists', async () => {
      mockFetchAnnouncementData.mockResolvedValue({ rev: 'rev-1' });
      mockFetchAnnouncementMarkdown.mockResolvedValue('Welcome!');

      const store = createStore();
      await store.dispatch(fetchAnnouncement());

      const state = store.getState().announcement;
      expect(state.hasNew).toBe(true);
      expect(state.markdown).toBe('Welcome!');
    });

    it('rejects when settings have not loaded yet (race-fix)', async () => {
      // Regression guard for backlog #110: storage migration to IDB made
      // settings-load latency long enough to race with fetchAnnouncement.
      // The thunk now bails out cleanly when settings are null so a
      // previously-dismissed announcement can't pop up again on cold
      // boot. The dispatcher (MainLayout) is responsible for waiting.
      const store = createTestStore(
        { announcement: announcementReducer, app: appReducer },
        {
          announcement: { ...initialAnnouncementState },
          app: { ...initialAppState, settings: null },
        },
      );
      const result = await store.dispatch(fetchAnnouncement());
      expect(result.type).toBe('announcement/fetchAnnouncement/rejected');
      expect(mockFetchAnnouncementData).not.toHaveBeenCalled();
    });

    it('should set isLoading during fetch', async () => {
      let resolveFetch: (value: unknown) => void;
      mockFetchAnnouncementData.mockReturnValue(
        new Promise((resolve) => { resolveFetch = resolve; })
      );

      const store = createStore();
      const promise = store.dispatch(fetchAnnouncement());

      expect(store.getState().announcement.isLoading).toBe(true);

      resolveFetch!({ rev: 'rev-1' });
      mockFetchAnnouncementMarkdown.mockResolvedValue('Content');
      await promise;

      expect(store.getState().announcement.isLoading).toBe(false);
    });

    it('should handle fetch failure gracefully', async () => {
      mockFetchAnnouncementData.mockRejectedValue(new Error('Network error'));

      const store = createStore();
      await store.dispatch(fetchAnnouncement());

      const state = store.getState().announcement;
      expect(state.hasNew).toBe(false);
      expect(state.isLoading).toBe(false);
    });
    it('does not close a dialog the user reopened while the boot fetch was still pending', async () => {
      let resolveData: (value: { rev: string }) => void = () => {};
      mockFetchAnnouncementData.mockReturnValue(new Promise((resolve) => { resolveData = resolve; }));
      mockFetchAnnouncementMarkdown.mockResolvedValue('Reopened content');

      const store = createStore({ [DiscrubSetting.CACHED_ANNOUNCEMENT_REV]: 'rev-1' });
      const boot = store.dispatch(fetchAnnouncement());

      // User opens More → View Announcement before boot settles.
      await store.dispatch(fetchAnnouncementMarkdownThunk());
      store.dispatch(reopenAnnouncement());
      expect(store.getState().announcement.hasNew).toBe(true);

      // Boot resolves with "nothing new" (rev matches cached, markdown skipped).
      resolveData({ rev: 'rev-1' });
      await boot;

      const state = store.getState().announcement;
      expect(state.hasNew).toBe(true);
      expect(state.markdown).toBe('Reopened content');
      expect(state.rev).toBe('rev-1');
    });
  });

  describe('dismissAnnouncement', () => {
    it('should set hasNew to false and dismissed to true', async () => {
      mockFetchAnnouncementData.mockResolvedValue({ rev: 'rev-2' });
      mockFetchAnnouncementMarkdown.mockResolvedValue('Content');

      const store = createStore({ [DiscrubSetting.CACHED_ANNOUNCEMENT_REV]: 'rev-1' });
      await store.dispatch(fetchAnnouncement());

      expect(store.getState().announcement.hasNew).toBe(true);

      await store.dispatch(dismissAnnouncement());

      const state = store.getState().announcement;
      expect(state.hasNew).toBe(false);
      expect(state.dismissed).toBe(true);
    });

    it('should update CACHED_ANNOUNCEMENT_REV setting', async () => {
      mockFetchAnnouncementData.mockResolvedValue({ rev: 'rev-3' });
      mockFetchAnnouncementMarkdown.mockResolvedValue('Content');

      const store = createStore();
      await store.dispatch(fetchAnnouncement());
      await store.dispatch(dismissAnnouncement());

      const appSettings = store.getState().app.settings;
      expect(appSettings?.[DiscrubSetting.CACHED_ANNOUNCEMENT_REV]).toBe('rev-3');
    });
  });

  describe('reopenAnnouncement', () => {
    it('should set hasNew to true when markdown exists', async () => {
      mockFetchAnnouncementData.mockResolvedValue({ rev: 'rev-2' });
      mockFetchAnnouncementMarkdown.mockResolvedValue('Content');

      const store = createStore({ [DiscrubSetting.CACHED_ANNOUNCEMENT_REV]: 'rev-1' });
      await store.dispatch(fetchAnnouncement());
      await store.dispatch(dismissAnnouncement());

      expect(store.getState().announcement.hasNew).toBe(false);

      store.dispatch(reopenAnnouncement());

      expect(store.getState().announcement.hasNew).toBe(true);
    });

    it('should set hasNew even when no markdown is available (markdown fetched lazily)', () => {
      const store = createStore();

      store.dispatch(reopenAnnouncement());

      expect(store.getState().announcement.hasNew).toBe(true);
    });
  });

  describe('fetchAnnouncementArchiveThunk', () => {
    const ARCHIVE = [
      { version: '2.1.0', date: '2026-08-23', title: 'Discrub 2.1.0', markdown: '# 2.1.0' },
      { version: '2.0.10', date: '2026-08-16', title: 'Discrub 2.0.10', markdown: '# 2.0.10' },
    ];

    it('loads the archive and leaves the live announcement selected', async () => {
      mockFetchAnnouncementArchive.mockResolvedValue(ARCHIVE);
      const store = createStore();

      const pending = store.dispatch(fetchAnnouncementArchiveThunk());
      expect(store.getState().announcement.isLoadingArchive).toBe(true);
      await pending;

      const state = store.getState().announcement;
      expect(state.isLoadingArchive).toBe(false);
      expect(state.archive).toEqual(ARCHIVE);
      expect(state.selectedVersion).toBeNull();
      expect(state.archiveError).toBeNull();
    });

    it('is a no-op once the archive is cached or while a fetch is in flight', async () => {
      mockFetchAnnouncementArchive.mockResolvedValue(ARCHIVE);
      const store = createStore();
      const first = store.dispatch(fetchAnnouncementArchiveThunk());
      store.dispatch(fetchAnnouncementArchiveThunk());
      await first;
      await store.dispatch(dismissAnnouncement());
      await store.dispatch(fetchAnnouncementArchiveThunk());

      expect(mockFetchAnnouncementArchive).toHaveBeenCalledTimes(1);
      expect(store.getState().announcement.archive).toEqual(ARCHIVE);
    });

    it('reports an error when the archive is empty or the fetch fails, and retries next time', async () => {
      mockFetchAnnouncementArchive.mockResolvedValue([]);
      const store = createStore();
      await store.dispatch(fetchAnnouncementArchiveThunk());
      expect(store.getState().announcement.archiveError).toMatch(/No previous announcements/);
      expect(store.getState().announcement.archive).toBeNull();

      mockFetchAnnouncementArchive.mockRejectedValue(new Error('boom'));
      await store.dispatch(fetchAnnouncementArchiveThunk());
      expect(store.getState().announcement.archiveError).toMatch(/Failed to load/);
      expect(mockFetchAnnouncementArchive).toHaveBeenCalledTimes(2);
    });

    it('selectArchiveVersion accepts existing versions or null (live), nothing else', async () => {
      mockFetchAnnouncementArchive.mockResolvedValue(ARCHIVE);
      const store = createStore();
      await store.dispatch(fetchAnnouncementArchiveThunk());

      store.dispatch(selectArchiveVersion('2.0.10'));
      expect(store.getState().announcement.selectedVersion).toBe('2.0.10');
      store.dispatch(selectArchiveVersion('9.9.9'));
      expect(store.getState().announcement.selectedVersion).toBe('2.0.10');
      store.dispatch(selectArchiveVersion(null));
      expect(store.getState().announcement.selectedVersion).toBeNull();
    });

    it('dismiss returns to the live announcement but keeps the archive cached', async () => {
      mockFetchAnnouncementArchive.mockResolvedValue(ARCHIVE);
      const store = createStore();
      await store.dispatch(fetchAnnouncementArchiveThunk());
      store.dispatch(selectArchiveVersion('2.0.10'));
      await store.dispatch(dismissAnnouncement());

      const state = store.getState().announcement;
      expect(state.selectedVersion).toBeNull();
      expect(state.archive).toEqual(ARCHIVE);
    });
  });
});
