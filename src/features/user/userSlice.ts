import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { User } from 'discrub-core/types/discord-types';
import { initialUserState } from './userTypes';
import { getDiscordService } from '@services/discordService';
import type { RootState } from '@/app/store';

/**
 * User slice - manages current user state
 */

/**
 * Async thunk to fetch current user data from Discord
 */
export const fetchUserData = createAsyncThunk(
  'user/fetchUserData',
  async (token: string, { rejectWithValue }) => {
    try {
      const discordService = getDiscordService();
      const response = await discordService.fetchUserData(token);

      if (!response.success || !response.data) {
        return rejectWithValue('Failed to fetch user data - invalid token or network error');
      }

      return response.data as User;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch user data'
      );
    }
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState: initialUserState,
  reducers: {
    setCurrentUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
      state.error = null;
    },
    clearCurrentUser: (state) => {
      state.currentUser = null;
      state.error = null;
    },
    setUserError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentUser = action.payload;
        state.error = null;
      })
      .addCase(fetchUserData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.currentUser = null;
      });
  },
});

export const { setCurrentUser, clearCurrentUser, setUserError } = userSlice.actions;

// Selectors
export const selectUser = (state: RootState) => state.user;
export const selectCurrentUser = (state: RootState) => state.user.currentUser;
export const selectUserLoading = (state: RootState) => state.user.isLoading;
export const selectUserError = (state: RootState) => state.user.error;

export default userSlice.reducer;
