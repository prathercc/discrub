import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { initialAuthState } from './authTypes';
import { fetchUserData } from '@features/user/userSlice';
import type { RootState } from '@/app/store';

/**
 * Auth slice - manages authentication state
 * Token is stored in memory only (not persisted) for security
 */

/**
 * Async thunk to authenticate user with Discord token
 * Validates token by attempting to fetch user data
 */
export const authenticateWithToken = createAsyncThunk(
  'auth/authenticateWithToken',
  async (token: string, { dispatch, rejectWithValue }) => {
    try {
      // Validate token by fetching user data
      await dispatch(fetchUserData(token)).unwrap();
      return token;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to authenticate'
      );
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },
    clearToken: (state) => {
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      state.manuallyLoggedOut = true;
    },
    clearManualLogout: (state) => {
      state.manuallyLoggedOut = false;
    },
    setAuthError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isAuthenticated = false;
      state.token = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(authenticateWithToken.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(authenticateWithToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload;
        state.isAuthenticated = true;
        state.error = null;
        state.manuallyLoggedOut = false;
      })
      .addCase(authenticateWithToken.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.token = null;
        state.isAuthenticated = false;
      });
  },
});

export const { setToken, clearToken, setAuthError, clearManualLogout } = authSlice.actions;

// Selectors
export const selectAuth = (state: RootState) => state.auth;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectAuthToken = (state: RootState) => state.auth.token;
export const selectAuthError = (state: RootState) => state.auth.error;
export const selectAuthLoading = (state: RootState) => state.auth.isLoading;
export const selectManuallyLoggedOut = (state: RootState) => state.auth.manuallyLoggedOut;

export default authSlice.reducer;
