import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestStore, TestStore } from '@/test/test-utils';
import purgeReducer, {
  setPurgeProgress,
  resetPurge,
  selectPurge,
  selectIsPurging,
  selectPurgeProgress,
  selectPurgeError,
} from './purgeSlice';
import { initialPurgeState, PurgeProgress } from './purgeTypes';

// Mock discordService (required by purgeSlice imports)
vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(),
}));

describe('purgeSlice', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createTestStore({ purge: purgeReducer });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState();
      expect(state.purge).toEqual(initialPurgeState);
      expect(state.purge.isPurging).toBe(false);
      expect(state.purge.purgeProgress).toBeNull();
      expect(state.purge.purgeError).toBeNull();
    });
  });

  describe('reducers', () => {
    it('should set purge progress', () => {
      const progress: PurgeProgress = {
        processed: 3,
        deleted: 2,
        skipped: 1,
        editedAttachmentsOnly: 0,
        reactionsRemoved: 0,
      };

      store.dispatch(setPurgeProgress(progress));
      expect(store.getState().purge.purgeProgress).toEqual(progress);
    });

    it('should set purge progress with bulk context', () => {
      const progress: PurgeProgress = {
        processed: 50,
        deleted: 45,
        skipped: 5,
        editedAttachmentsOnly: 0,
        reactionsRemoved: 0,
        bulk: {
          currentIndex: 1,
          totalChannels: 3,
          currentChannelName: 'general',
          completedStats: { deleted: 100, skipped: 10, editedAttachmentsOnly: 0, reactionsRemoved: 0 },
        },
      };

      store.dispatch(setPurgeProgress(progress));
      expect(store.getState().purge.purgeProgress).toEqual(progress);
      expect(store.getState().purge.purgeProgress?.bulk?.currentChannelName).toBe('general');
    });

    it('should set purge progress for reactions mode', () => {
      const progress: PurgeProgress = {
        processed: 200,
        deleted: 0,
        skipped: 0,
        editedAttachmentsOnly: 0,
        reactionsRemoved: 42,
        bulk: {
          currentIndex: 0,
          totalChannels: 2,
          currentChannelName: 'random',
          completedStats: { deleted: 0, skipped: 0, editedAttachmentsOnly: 0, reactionsRemoved: 0 },
        },
      };

      store.dispatch(setPurgeProgress(progress));
      expect(store.getState().purge.purgeProgress?.reactionsRemoved).toBe(42);
    });

    it('should update purge progress incrementally', () => {
      const progress1: PurgeProgress = { processed: 1, deleted: 1, skipped: 0, editedAttachmentsOnly: 0, reactionsRemoved: 0 };
      const progress2: PurgeProgress = { processed: 3, deleted: 2, skipped: 1, editedAttachmentsOnly: 0, reactionsRemoved: 0 };
      const progress3: PurgeProgress = { processed: 5, deleted: 4, skipped: 1, editedAttachmentsOnly: 0, reactionsRemoved: 0 };

      store.dispatch(setPurgeProgress(progress1));
      expect(store.getState().purge.purgeProgress).toEqual(progress1);

      store.dispatch(setPurgeProgress(progress2));
      expect(store.getState().purge.purgeProgress).toEqual(progress2);

      store.dispatch(setPurgeProgress(progress3));
      expect(store.getState().purge.purgeProgress).toEqual(progress3);
    });

    it('should reset purge state', () => {
      store.dispatch(setPurgeProgress({ processed: 5, deleted: 3, skipped: 2, editedAttachmentsOnly: 0, reactionsRemoved: 0 }));

      // Simulate isPurging being set via thunk pending
      store.dispatch({ type: 'purge/bulkPurgeChannels/pending' });
      expect(store.getState().purge.isPurging).toBe(true);

      store.dispatch(resetPurge());

      const state = store.getState().purge;
      expect(state.isPurging).toBe(false);
      expect(state.purgeProgress).toBeNull();
      expect(state.purgeError).toBeNull();
    });

    it('should reset purge state when there is an error', () => {
      store.dispatch({
        type: 'purge/bulkPurgeChannels/rejected',
        payload: 'Some error',
      });
      expect(store.getState().purge.purgeError).toBe('Some error');

      store.dispatch(resetPurge());
      expect(store.getState().purge.purgeError).toBeNull();
    });
  });

  describe('extraReducers — bulkPurgeChannels lifecycle', () => {
    it('should set isPurging on pending', () => {
      store.dispatch({ type: 'purge/bulkPurgeChannels/pending' });
      const state = store.getState().purge;
      expect(state.isPurging).toBe(true);
      expect(state.purgeError).toBeNull();
      expect(state.purgeProgress).toBeNull();
    });

    it('should clear isPurging on fulfilled', () => {
      store.dispatch({ type: 'purge/bulkPurgeChannels/pending' });
      expect(store.getState().purge.isPurging).toBe(true);

      store.dispatch({ type: 'purge/bulkPurgeChannels/fulfilled', payload: { success: true } });
      expect(store.getState().purge.isPurging).toBe(false);
    });

    it('should set error on rejected', () => {
      store.dispatch({ type: 'purge/bulkPurgeChannels/pending' });
      store.dispatch({ type: 'purge/bulkPurgeChannels/rejected', payload: 'Network error' });

      const state = store.getState().purge;
      expect(state.isPurging).toBe(false);
      expect(state.purgeError).toBe('Network error');
    });

    it('should clear previous error on new pending', () => {
      store.dispatch({ type: 'purge/bulkPurgeChannels/rejected', payload: 'Old error' });
      expect(store.getState().purge.purgeError).toBe('Old error');

      store.dispatch({ type: 'purge/bulkPurgeChannels/pending' });
      expect(store.getState().purge.purgeError).toBeNull();
    });

    it('should clear previous progress on new pending', () => {
      store.dispatch(setPurgeProgress({ processed: 100, deleted: 90, skipped: 10, editedAttachmentsOnly: 0, reactionsRemoved: 0 }));
      expect(store.getState().purge.purgeProgress).not.toBeNull();

      store.dispatch({ type: 'purge/bulkPurgeChannels/pending' });
      expect(store.getState().purge.purgeProgress).toBeNull();
    });
  });

  describe('extraReducers — bulkPurgeDMs lifecycle', () => {
    it('should set isPurging on pending', () => {
      store.dispatch({ type: 'purge/bulkPurgeDMs/pending' });
      expect(store.getState().purge.isPurging).toBe(true);
    });

    it('should clear isPurging on fulfilled', () => {
      store.dispatch({ type: 'purge/bulkPurgeDMs/pending' });
      store.dispatch({ type: 'purge/bulkPurgeDMs/fulfilled', payload: { success: true } });
      expect(store.getState().purge.isPurging).toBe(false);
    });

    it('should set error on rejected', () => {
      store.dispatch({ type: 'purge/bulkPurgeDMs/rejected', payload: 'DM purge error' });
      expect(store.getState().purge.purgeError).toBe('DM purge error');
    });
  });

  describe('selectors', () => {
    it('selectPurge should return entire purge state', () => {
      const purgeState = selectPurge(store.getState());
      expect(purgeState).toHaveProperty('isPurging');
      expect(purgeState).toHaveProperty('purgeProgress');
      expect(purgeState).toHaveProperty('purgeError');
    });

    it('selectIsPurging should return isPurging flag', () => {
      expect(selectIsPurging(store.getState())).toBe(false);

      store.dispatch({ type: 'purge/bulkPurgeChannels/pending' });
      expect(selectIsPurging(store.getState())).toBe(true);
    });

    it('selectPurgeProgress should return purge progress', () => {
      expect(selectPurgeProgress(store.getState())).toBeNull();

      const progress: PurgeProgress = {
        processed: 5,
        deleted: 3,
        skipped: 2,
        editedAttachmentsOnly: 0,
        reactionsRemoved: 0,
      };
      store.dispatch(setPurgeProgress(progress));
      expect(selectPurgeProgress(store.getState())).toEqual(progress);
    });

    it('selectPurgeError should return purge error', () => {
      expect(selectPurgeError(store.getState())).toBeNull();

      store.dispatch({
        type: 'purge/bulkPurgeChannels/rejected',
        payload: 'Test error',
      });
      expect(selectPurgeError(store.getState())).toBe('Test error');
    });

    it('selectors should reflect state after reset', () => {
      store.dispatch(setPurgeProgress({ processed: 5, deleted: 3, skipped: 2, editedAttachmentsOnly: 0, reactionsRemoved: 0 }));
      store.dispatch({ type: 'purge/bulkPurgeChannels/rejected', payload: 'err' });

      expect(selectPurgeError(store.getState())).toBe('err');

      store.dispatch(resetPurge());

      expect(selectIsPurging(store.getState())).toBe(false);
      expect(selectPurgeProgress(store.getState())).toBeNull();
      expect(selectPurgeError(store.getState())).toBeNull();
    });
  });
});
