import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import LandingPage from './LandingPage';
import { createBaseState } from '../../test/state-factories';

// Mock extension messaging
vi.mock('@/extension/messaging', () => ({
  isExtensionMode: vi.fn(() => false),
  requestDiscordToken: vi.fn().mockResolvedValue({ success: false, error: 'No token' }),
}));

vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(() => ({
    validateToken: vi.fn().mockResolvedValue({ id: 'user-1', username: 'testuser' }),
    fetchCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1', username: 'testuser' }),
  })),
}));

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

describe('LandingPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Reset import.meta.env mock
    vi.stubEnv('VITE_DISCORD_TOKEN', '');
    // Reset isExtensionMode to false (may have been changed by Extension Mode tests)
    const { isExtensionMode } = await import('@/extension/messaging');
    vi.mocked(isExtensionMode).mockReturnValue(false);
  });

  describe('Rendering', () => {
    it('should render the welcome title', () => {
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState(),
      });
      expect(screen.getByText(/Welcome to Discrub/)).toBeInTheDocument();
    });

    it('should render the token input field', () => {
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState(),
      });
      expect(screen.getByLabelText(/Discord Token/)).toBeInTheDocument();
    });

    it('should render the Sign In button', () => {
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState(),
      });
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });

    it('should render help link', () => {
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState(),
      });
      expect(screen.getByText('How to find my Discord token?')).toBeInTheDocument();
    });

    it('should render disclaimer text', () => {
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState(),
      });
      expect(screen.getByText(/This is an unofficial tool/)).toBeInTheDocument();
    });
  });

  describe('Token Input', () => {
    it('should allow entering a token', () => {
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState(),
      });
      const input = screen.getByLabelText(/Discord Token/);
      fireEvent.change(input, { target: { value: 'my-test-token' } });
      expect((input as HTMLInputElement).value).toBe('my-test-token');
    });

    it('should disable Sign In when token is empty', () => {
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState(),
      });
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled();
    });

    it('should enable Sign In when token is entered', () => {
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState(),
      });
      const input = screen.getByLabelText(/Discord Token/);
      fireEvent.change(input, { target: { value: 'my-token' } });
      expect(screen.getByRole('button', { name: 'Sign In' })).not.toBeDisabled();
    });
  });

  describe('Error Display', () => {
    it('should show auth error when present', () => {
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState({
          auth: { token: null, isAuthenticated: false, isLoading: false, error: 'Invalid token', manuallyLoggedOut: false },
        }),
      });
      expect(screen.getByText('Invalid token')).toBeInTheDocument();
    });

    it('should show helper text about invalid token on error', () => {
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState({
          auth: { token: null, isAuthenticated: false, isLoading: false, error: 'Bad token', manuallyLoggedOut: false },
        }),
      });
      expect(screen.getByText(/Invalid token - please check and try again/)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should disable token input while loading', () => {
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState({
          auth: { token: null, isAuthenticated: false, isLoading: true, error: null, manuallyLoggedOut: false },
        }),
      });
      expect(screen.getByLabelText(/Discord Token/)).toBeDisabled();
    });

    it('should show spinner instead of Sign In text while loading', () => {
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState({
          auth: { token: null, isAuthenticated: false, isLoading: true, error: null, manuallyLoggedOut: false },
        }),
      });
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Extension Mode', () => {
    it('should show authenticating screen during auto-auth in extension mode', async () => {
      const { isExtensionMode } = await import('@/extension/messaging');
      vi.mocked(isExtensionMode).mockReturnValue(true);

      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState(),
      });

      // In extension mode with auto-auth loading, the authenticating screen appears
      expect(screen.getByText(/Authenticating with Discord/)).toBeInTheDocument();
    });
  });

  describe('Sign In', () => {
    it('should dispatch authenticateWithToken when form is submitted', async () => {
      const { store } = renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState(),
      });

      const input = screen.getByLabelText(/Discord Token/);
      fireEvent.change(input, { target: { value: 'test-token' } });
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

      // Auth state should be loading after dispatch
      await vi.waitFor(() => {
        const state = store.getState();
        expect(state.auth.isLoading).toBe(true);
      });
    });
  });
});
