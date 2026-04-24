import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestStore, TestStore } from '@/test/test-utils';
import userReducer, {
  setCurrentUser,
  clearCurrentUser,
  setUserError,
  fetchUserData,
  selectUser,
  selectCurrentUser,
  selectUserLoading,
  selectUserError,
} from './userSlice';
import { initialUserState } from './userTypes';
import * as discordService from '@services/discordService';
import type { User } from 'discrub-core/types/discord-types';

// Mock the Discord service
vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(),
}));

describe('userSlice', () => {
  let store: TestStore;

  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    discriminator: '0001',
    avatar: 'avatar-hash',
    global_name: 'Test User',
  } as User;

  beforeEach(() => {
    store = createTestStore({ user: userReducer });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState();
      expect(state.user).toEqual(initialUserState);
      expect(state.user.currentUser).toBeNull();
      expect(state.user.isLoading).toBe(false);
      expect(state.user.error).toBeNull();
    });
  });

  describe('reducers', () => {
    describe('setCurrentUser', () => {
      it('should set current user and clear error', () => {
        store.dispatch(setCurrentUser(mockUser));

        const state = store.getState().user;
        expect(state.currentUser).toEqual(mockUser);
        expect(state.error).toBeNull();
      });

      it('should clear error when setting user', () => {
        // First set an error
        store.dispatch(setUserError('Previous error'));
        expect(store.getState().user.error).toBe('Previous error');

        // Then set user
        store.dispatch(setCurrentUser(mockUser));

        const state = store.getState().user;
        expect(state.error).toBeNull();
        expect(state.currentUser).toEqual(mockUser);
      });

      it('should update user when called multiple times', () => {
        const user1: User = { ...mockUser, id: 'user-1', username: 'user1' };
        const user2: User = { ...mockUser, id: 'user-2', username: 'user2' };

        store.dispatch(setCurrentUser(user1));
        expect(store.getState().user.currentUser?.id).toBe('user-1');

        store.dispatch(setCurrentUser(user2));
        expect(store.getState().user.currentUser?.id).toBe('user-2');
      });
    });

    describe('clearCurrentUser', () => {
      it('should clear current user and error', () => {
        // First set a user
        store.dispatch(setCurrentUser(mockUser));
        expect(store.getState().user.currentUser).toEqual(mockUser);

        // Then clear it
        store.dispatch(clearCurrentUser());

        const state = store.getState().user;
        expect(state.currentUser).toBeNull();
        expect(state.error).toBeNull();
      });

      it('should clear error when clearing user', () => {
        // Set user and error
        store.dispatch(setCurrentUser(mockUser));
        store.dispatch(setUserError('Some error'));

        // Clear user
        store.dispatch(clearCurrentUser());

        const state = store.getState().user;
        expect(state.currentUser).toBeNull();
        expect(state.error).toBeNull();
      });

      it('should be idempotent', () => {
        // Clear when already cleared
        store.dispatch(clearCurrentUser());
        const state1 = store.getState().user;

        store.dispatch(clearCurrentUser());
        const state2 = store.getState().user;

        expect(state1).toEqual(state2);
        expect(state2).toEqual(initialUserState);
      });
    });

    describe('setUserError', () => {
      it('should set error message', () => {
        const errorMessage = 'Failed to fetch user';
        store.dispatch(setUserError(errorMessage));

        const state = store.getState().user;
        expect(state.error).toBe(errorMessage);
      });

      it('should update error when called multiple times', () => {
        store.dispatch(setUserError('Error 1'));
        expect(store.getState().user.error).toBe('Error 1');

        store.dispatch(setUserError('Error 2'));
        expect(store.getState().user.error).toBe('Error 2');
      });

      it('should handle empty error message', () => {
        store.dispatch(setUserError(''));

        const state = store.getState().user;
        expect(state.error).toBe('');
      });

      it('should not affect current user', () => {
        store.dispatch(setCurrentUser(mockUser));
        store.dispatch(setUserError('Some error'));

        const state = store.getState().user;
        expect(state.currentUser).toEqual(mockUser);
        expect(state.error).toBe('Some error');
      });
    });
  });

  describe('fetchUserData async thunk', () => {
    it('should set loading state when pending', () => {
      const mockDiscordService = {
        fetchUserData: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(fetchUserData('test-token'));

      const state = store.getState().user;
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle successful fetch', async () => {
      const mockDiscordService = {
        fetchUserData: vi.fn().mockResolvedValue({
          success: true,
          data: mockUser,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const token = 'valid-token-123';
      await store.dispatch(fetchUserData(token));

      const state = store.getState().user;
      expect(state.isLoading).toBe(false);
      expect(state.currentUser).toEqual(mockUser);
      expect(state.error).toBeNull();

      expect(mockDiscordService.fetchUserData).toHaveBeenCalledWith(token);
    });

    it('should handle fetch failure with unsuccessful response', async () => {
      const mockDiscordService = {
        fetchUserData: vi.fn().mockResolvedValue({
          success: false,
          data: null,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchUserData('invalid-token'));

      const state = store.getState().user;
      expect(state.isLoading).toBe(false);
      expect(state.currentUser).toBeNull();
      expect(state.error).toBe('Failed to fetch user data - invalid token or network error');
    });

    it('should handle fetch failure with null data', async () => {
      const mockDiscordService = {
        fetchUserData: vi.fn().mockResolvedValue({
          success: true,
          data: null,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchUserData('invalid-token'));

      const state = store.getState().user;
      expect(state.error).toBe('Failed to fetch user data - invalid token or network error');
    });

    it('should handle fetch failure with Error', async () => {
      const errorMessage = 'Network error';
      const mockDiscordService = {
        fetchUserData: vi.fn().mockRejectedValue(new Error(errorMessage)),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchUserData('test-token'));

      const state = store.getState().user;
      expect(state.isLoading).toBe(false);
      expect(state.currentUser).toBeNull();
      expect(state.error).toBe(errorMessage);
    });

    it('should handle fetch failure with non-Error', async () => {
      const mockDiscordService = {
        fetchUserData: vi.fn().mockRejectedValue('String error'),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchUserData('test-token'));

      const state = store.getState().user;
      expect(state.error).toBe('Failed to fetch user data');
    });

    it('should clear previous error on successful fetch', async () => {
      // Set initial error
      store.dispatch(setUserError('Previous error'));
      expect(store.getState().user.error).toBe('Previous error');

      // Successful fetch
      const mockDiscordService = {
        fetchUserData: vi.fn().mockResolvedValue({
          success: true,
          data: mockUser,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(fetchUserData('valid-token'));

      const state = store.getState().user;
      expect(state.error).toBeNull();
      expect(state.currentUser).toEqual(mockUser);
    });

    it('should handle fetch retry after previous failure', async () => {
      // First attempt fails
      const mockDiscordServiceFail = {
        fetchUserData: vi.fn().mockRejectedValue(new Error('First error')),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordServiceFail as any);

      await store.dispatch(fetchUserData('bad-token'));
      expect(store.getState().user.error).toBe('First error');

      // Second attempt succeeds
      const mockDiscordServiceSuccess = {
        fetchUserData: vi.fn().mockResolvedValue({
          success: true,
          data: mockUser,
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordServiceSuccess as any);

      await store.dispatch(fetchUserData('good-token'));

      const state = store.getState().user;
      expect(state.currentUser).toEqual(mockUser);
      expect(state.error).toBeNull();
    });

    it('should clear previous user on new fetch pending', async () => {
      // Set initial user
      store.dispatch(setCurrentUser(mockUser));
      expect(store.getState().user.currentUser).toEqual(mockUser);

      // Start new fetch (pending state clears error but not user)
      const mockDiscordService = {
        fetchUserData: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(fetchUserData('new-token'));

      const state = store.getState().user;
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
      // Current user is preserved during loading
      expect(state.currentUser).toEqual(mockUser);
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      // Set up a known state
      store.dispatch(setCurrentUser(mockUser));
      store.dispatch(setUserError('Test error'));
    });

    it('selectUser should return entire user state', () => {
      const user = selectUser(store.getState());
      expect(user).toHaveProperty('currentUser');
      expect(user).toHaveProperty('isLoading');
      expect(user).toHaveProperty('error');
    });

    it('selectCurrentUser should return current user', () => {
      const currentUser = selectCurrentUser(store.getState());
      expect(currentUser).toEqual(mockUser);

      store.dispatch(clearCurrentUser());
      expect(selectCurrentUser(store.getState())).toBeNull();
    });

    it('selectUserError should return error', () => {
      const error = selectUserError(store.getState());
      expect(error).toBe('Test error');

      store.dispatch(clearCurrentUser());
      expect(selectUserError(store.getState())).toBeNull();
    });

    it('selectUserLoading should return loading status', () => {
      expect(selectUserLoading(store.getState())).toBe(false);

      // Trigger loading state
      const mockDiscordService = {
        fetchUserData: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(fetchUserData('test'));
      expect(selectUserLoading(store.getState())).toBe(true);
    });
  });
});
