/**
 * Types for authentication feature
 */

export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  manuallyLoggedOut: boolean;
}

export const initialAuthState: AuthState = {
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  manuallyLoggedOut: false,
};
