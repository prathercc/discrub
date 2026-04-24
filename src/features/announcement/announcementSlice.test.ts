import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestStore } from '../../test/test-utils';
import announcementReducer, { fetchAnnouncement, dismissAnnouncement, reopenAnnouncement } from './announcementSlice';
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

vi.mock('discrub-core/github-service', () => ({
  fetchAnnouncementData: (...args: unknown[]) => mockFetchAnnouncementData(...args),
  fetchAnnouncementMarkdown: (...args: unknown[]) => mockFetchAnnouncementMarkdown(...args),
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
});
