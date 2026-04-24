import type { User } from 'discrub-core/types/discord-types';

/**
 * Types for user feature
 */

export interface UserState {
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
}

export const initialUserState: UserState = {
  currentUser: null,
  isLoading: false,
  error: null,
};
