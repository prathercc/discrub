import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import LandingPage from './LandingPage';
import { createBaseState } from '../../test/state-factories';
import { initialSupporterState } from '@features/supporter/supporterTypes';
import type { SupporterKeyPayload } from '@services/supporterKeyService';

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
    vi.stubEnv('VITE_HOSTED_GATE', '');
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

  describe('Hosted gate (VITE_HOSTED_GATE=true)', () => {
    const DAY_S = 24 * 60 * 60;
    const nowS = Math.floor(Date.now() / 1000);
    const hostedPayload: SupporterKeyPayload = {
      v: 2,
      kid: '2026-2',
      jti: 'jti-h',
      name: 'Aaron P.',
      eh: 'hash',
      ent: { themes: nowS + 30 * DAY_S, hosted: nowS + 30 * DAY_S },
      iat: nowS,
      exp: nowS + 30 * DAY_S,
    };
    const themesOnlyPayload: SupporterKeyPayload = {
      ...hostedPayload,
      jti: 'jti-t',
      ent: { themes: nowS + 30 * DAY_S },
    };

    const renderGate = (supporter: Partial<typeof initialSupporterState>) =>
      renderWithProviders(<LandingPage />, {
        preloadedState: createBaseState({
          supporter: { ...initialSupporterState, initialized: true, ...supporter },
        }) as never,
      });

    beforeEach(() => {
      vi.stubEnv('VITE_HOSTED_GATE', 'true');
    });

    it('is absent from the ordinary build', () => {
      vi.stubEnv('VITE_HOSTED_GATE', '');
      renderGate({});
      expect(screen.queryByTestId('hosted-gate')).toBeNull();
    });

    it('asks for a supporter key (masked) and keeps Sign In disabled without one', () => {
      renderGate({});
      expect(screen.getAllByText(/Bleeding Edge/).length).toBeGreaterThan(0);
      const keyField = screen.getByTestId('hosted-gate-key');
      expect(keyField).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText(/Discord Token/)).toHaveAttribute('type', 'password');
      fireEvent.change(screen.getByLabelText(/Discord Token/), { target: { value: 'tok' } });
      expect(screen.getByTestId('landing-sign-in')).toBeDisabled();
      expect(screen.getByTestId('hosted-gate-help')).toHaveTextContent(/requires a supporter key/);
      expect(screen.getByTestId('hosted-gate-kofi-monthly')).toHaveAttribute(
        'href',
        'https://ko-fi.com/prathercc/tiers',
      );
      expect(screen.getByTestId('hosted-gate-kofi-yearly')).toHaveAttribute(
        'href',
        'https://ko-fi.com/s/3b0ad65948',
      );
      expect(screen.getByTestId('bleeding-title')).toHaveTextContent('Discrub Bleeding Edge');
      expect(screen.getByTestId('bleeding-caption')).toHaveTextContent(/Early access build v\d+\.\d+\.\d+/);
      expect(screen.getAllByTestId('bleeding-drip').length).toBeGreaterThan(2);
      expect(screen.queryByText('Welcome to Discrub')).toBeNull();
    });

    it('lets a hosted-entitled key through and shows it as remembered', () => {
      renderGate({ keyStatus: 'valid', payload: hostedPayload });
      expect(screen.getByTestId('hosted-gate-key-status')).toHaveTextContent(
        /Aaron P\., Bleeding Edge included/,
      );
      expect(screen.queryByTestId('hosted-gate-key')).toBeNull();
      fireEvent.change(screen.getByLabelText(/Discord Token/), { target: { value: 'tok' } });
      expect(screen.getByTestId('landing-sign-in')).not.toBeDisabled();
    });

    it('tells a themes-only key holder that Bleeding Edge is a separate tier', () => {
      renderGate({ keyStatus: 'valid', payload: themesOnlyPayload });
      expect(screen.getByTestId('hosted-gate-key-status')).toHaveTextContent(
        /covers themes\. Bleeding Edge is a separate tier/,
      );
      fireEvent.change(screen.getByLabelText(/Discord Token/), { target: { value: 'tok' } });
      expect(screen.getByTestId('landing-sign-in')).toBeDisabled();
    });

    it('"Forget my key" removes the key and brings the field back', async () => {
      const { store } = renderGate({ keyStatus: 'valid', payload: hostedPayload });
      fireEvent.click(screen.getByTestId('hosted-gate-forget-key'));
      await vi.waitFor(() => {
        expect(store.getState().supporter.keyStatus).toBe('none');
      });
      expect(screen.getByTestId('hosted-gate-key')).toBeInTheDocument();
    });
  });
});
