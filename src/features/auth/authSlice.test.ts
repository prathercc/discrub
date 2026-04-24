import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestStore, TestStore } from '@/test/test-utils';
import authReducer, {
  setToken,
  clearToken,
  setAuthError,
  authenticateWithToken,
  selectAuth,
  selectIsAuthenticated,
  selectAuthToken,
  selectAuthError,
  selectAuthLoading,
} from './authSlice';
import { initialAuthState } from './authTypes';
import userReducer from '@features/user/userSlice';
import * as discordService from '@services/discordService';

// Mock the Discord service
vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(),
}));

describe('authSlice', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createTestStore({ auth: authReducer, user: userReducer });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState();
      expect(state.auth).toEqual(initialAuthState);
      expect(state.auth.token).toBeNull();
      expect(state.auth.isAuthenticated).toBe(false);
      expect(state.auth.isLoading).toBe(false);
      expect(state.auth.error).toBeNull();
    });
  });

  describe('reducers', () => {
    describe('setToken', () => {
      it('should set token and mark as authenticated', () => {
        const token = 'test-token-123';
        store.dispatch(setToken(token));

        const state = store.getState().auth;
        expect(state.token).toBe(token);
        expect(state.isAuthenticated).toBe(true);
        expect(state.error).toBeNull();
      });

      it('should clear error when setting token', () => {
        // First set an error
        store.dispatch(setAuthError('Previous error'));
        expect(store.getState().auth.error).toBe('Previous error');

        // Then set token
        store.dispatch(setToken('new-token'));

        const state = store.getState().auth;
        expect(state.error).toBeNull();
        expect(state.isAuthenticated).toBe(true);
      });

      it('should handle empty string token', () => {
        store.dispatch(setToken(''));

        const state = store.getState().auth;
        expect(state.token).toBe('');
        expect(state.isAuthenticated).toBe(true);
      });

      it('should update token when called multiple times', () => {
        store.dispatch(setToken('token-1'));
        expect(store.getState().auth.token).toBe('token-1');

        store.dispatch(setToken('token-2'));
        expect(store.getState().auth.token).toBe('token-2');
      });
    });

    describe('clearToken', () => {
      it('should clear token and reset authentication state', () => {
        // First set a token
        store.dispatch(setToken('test-token'));
        expect(store.getState().auth.isAuthenticated).toBe(true);

        // Then clear it
        store.dispatch(clearToken());

        const state = store.getState().auth;
        expect(state.token).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.error).toBeNull();
      });

      it('should clear error when clearing token', () => {
        // Set token and error
        store.dispatch(setToken('test-token'));
        store.dispatch(setAuthError('Some error'));

        // Clear token
        store.dispatch(clearToken());

        const state = store.getState().auth;
        expect(state.error).toBeNull();
      });

      it('should be idempotent', () => {
        // Clear when already cleared
        store.dispatch(clearToken());
        const state1 = store.getState().auth;

        store.dispatch(clearToken());
        const state2 = store.getState().auth;

        expect(state1).toEqual(state2);
        expect(state2).toEqual({ ...initialAuthState, manuallyLoggedOut: true });
      });
    });

    describe('setAuthError', () => {
      it('should set error and clear authentication', () => {
        const errorMessage = 'Authentication failed';
        store.dispatch(setAuthError(errorMessage));

        const state = store.getState().auth;
        expect(state.error).toBe(errorMessage);
        expect(state.isAuthenticated).toBe(false);
        expect(state.token).toBeNull();
      });

      it('should clear token when setting error', () => {
        // First set a token
        store.dispatch(setToken('test-token'));
        expect(store.getState().auth.token).toBe('test-token');

        // Then set error
        store.dispatch(setAuthError('Token invalid'));

        const state = store.getState().auth;
        expect(state.token).toBeNull();
        expect(state.isAuthenticated).toBe(false);
      });

      it('should handle empty error message', () => {
        store.dispatch(setAuthError(''));

        const state = store.getState().auth;
        expect(state.error).toBe('');
        expect(state.isAuthenticated).toBe(false);
      });

      it('should update error when called multiple times', () => {
        store.dispatch(setAuthError('Error 1'));
        expect(store.getState().auth.error).toBe('Error 1');

        store.dispatch(setAuthError('Error 2'));
        expect(store.getState().auth.error).toBe('Error 2');
      });
    });
  });

  describe('authenticateWithToken async thunk', () => {
    it('should set loading state when pending', () => {
      const mockDiscordService = {
        fetchUserData: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(authenticateWithToken('test-token'));

      const state = store.getState().auth;
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle successful authentication', async () => {
      const mockDiscordService = {
        fetchUserData: vi.fn().mockResolvedValue({
          success: true,
          data: { id: 'user-123', username: 'testuser' },
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      const token = 'valid-token-123';
      await store.dispatch(authenticateWithToken(token));

      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.token).toBe(token);
      expect(state.isAuthenticated).toBe(true);
      expect(state.error).toBeNull();

      expect(mockDiscordService.fetchUserData).toHaveBeenCalledWith(token);
    });

    it('should handle authentication failure with API error', async () => {
      const mockDiscordService = {
        fetchUserData: vi.fn().mockRejectedValue(new Error('Invalid token')),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(authenticateWithToken('invalid-token'));

      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      // userSlice converts Error to string via rejectWithValue('Invalid token')
      // Then unwrap() throws that string, authSlice catches it, sees it's not an Error
      // and uses the fallback message 'Failed to authenticate'
      expect(state.error).toBe('Failed to authenticate');
    });

    it('should handle authentication failure with non-Error', async () => {
      const mockDiscordService = {
        fetchUserData: vi.fn().mockRejectedValue('String error'),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(authenticateWithToken('invalid-token'));

      const state = store.getState().auth;
      expect(state.error).toBe('Failed to authenticate');
    });

    it('should clear previous error on successful authentication', async () => {
      // Set initial error
      store.dispatch(setAuthError('Previous error'));
      expect(store.getState().auth.error).toBe('Previous error');

      // Successful authentication
      const mockDiscordService = {
        fetchUserData: vi.fn().mockResolvedValue({
          success: true,
          data: { id: 'user-123' },
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      await store.dispatch(authenticateWithToken('valid-token'));

      const state = store.getState().auth;
      expect(state.error).toBeNull();
      expect(state.isAuthenticated).toBe(true);
    });

    it('should handle authentication attempt after previous failure', async () => {
      // First attempt fails
      const mockDiscordServiceFail = {
        fetchUserData: vi.fn().mockRejectedValue(new Error('First error')),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordServiceFail as any);

      await store.dispatch(authenticateWithToken('bad-token'));
      expect(store.getState().auth.error).toBe('Failed to authenticate');

      // Second attempt succeeds
      const mockDiscordServiceSuccess = {
        fetchUserData: vi.fn().mockResolvedValue({
          success: true,
          data: { id: 'user-123' },
        }),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordServiceSuccess as any);

      await store.dispatch(authenticateWithToken('good-token'));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.error).toBeNull();
      expect(state.token).toBe('good-token');
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      // Set up a known state
      store.dispatch(setToken('test-token'));
      store.dispatch(setAuthError('Test error'));
    });

    it('selectAuth should return entire auth state', () => {
      const auth = selectAuth(store.getState());
      expect(auth).toHaveProperty('token');
      expect(auth).toHaveProperty('isAuthenticated');
      expect(auth).toHaveProperty('isLoading');
      expect(auth).toHaveProperty('error');
    });

    it('selectIsAuthenticated should return authentication status', () => {
      expect(selectIsAuthenticated(store.getState())).toBe(false); // Error was set, which clears auth

      store.dispatch(setToken('valid-token'));
      expect(selectIsAuthenticated(store.getState())).toBe(true);
    });

    it('selectAuthToken should return token', () => {
      const state = store.getState();
      const token = selectAuthToken(state);
      expect(token).toBeNull(); // Error was set, which clears token

      store.dispatch(setToken('my-token'));
      expect(selectAuthToken(store.getState())).toBe('my-token');
    });

    it('selectAuthError should return error', () => {
      const error = selectAuthError(store.getState());
      expect(error).toBe('Test error');

      store.dispatch(clearToken());
      expect(selectAuthError(store.getState())).toBeNull();
    });

    it('selectAuthLoading should return loading status', () => {
      expect(selectAuthLoading(store.getState())).toBe(false);

      // Trigger loading state
      const mockDiscordService = {
        fetchUserData: vi.fn().mockImplementation(() => new Promise(() => {})),
      };
      vi.mocked(discordService.getDiscordService).mockReturnValue(mockDiscordService as any);

      store.dispatch(authenticateWithToken('test'));
      expect(selectAuthLoading(store.getState())).toBe(true);
    });
  });
});
