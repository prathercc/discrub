import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../test/test-utils';
import ServerList from './ServerList';
import { createBaseState } from '../../test/state-factories';
import { createMockGuild } from '../../test/fixtures';

// Mock discordService so fetchGuilds thunk doesn't hit the network
vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(() => ({
    fetchGuilds: vi.fn().mockResolvedValue([]),
    fetchChannels: vi.fn().mockResolvedValue({ success: true, data: [] }),
    fetchRoles: vi.fn().mockResolvedValue({ success: true, data: [] }),
    fetchGuildUser: vi.fn().mockResolvedValue({ success: true, data: { roles: [] } }),
  })),
}));

// Mock storage for settings middleware
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

describe('ServerList', () => {
  const guilds = [
    createMockGuild({ id: 'g1', name: 'Alpha Server', icon: 'abc123' }),
    createMockGuild({ id: 'g2', name: 'Beta Server', icon: null }),
    createMockGuild({ id: 'g3', name: 'Gamma Server', icon: null }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner when guilds are loading', () => {
      renderWithProviders(<ServerList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds: [], selectedGuild: null, roles: [], isLoading: true, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      expect(screen.queryByText('Loading servers...')).not.toBeInTheDocument();
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('should show "No servers found" when no guilds exist and no token', () => {
      renderWithProviders(<ServerList />, {
        preloadedState: createBaseState({
          auth: { token: null, isAuthenticated: false, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds: [], selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      expect(screen.getByText('No servers found')).toBeInTheDocument();
    });

    it('should show filter-specific empty state when filter matches nothing', () => {
      renderWithProviders(<ServerList filterText="nonexistent" />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      expect(screen.getByText(/No servers matching "nonexistent"/)).toBeInTheDocument();
    });
  });

  describe('Guild Rendering', () => {
    it('should render all guilds', () => {
      renderWithProviders(<ServerList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      expect(screen.getByText('Alpha Server')).toBeInTheDocument();
      expect(screen.getByText('Beta Server')).toBeInTheDocument();
      expect(screen.getByText('Gamma Server')).toBeInTheDocument();
    });

    it('should render "Servers" header', () => {
      renderWithProviders(<ServerList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      expect(screen.getByText('Servers')).toBeInTheDocument();
    });

    it('should render guild avatar with icon URL when icon exists', () => {
      renderWithProviders(<ServerList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      const avatarImg = screen.getAllByRole('img')[0];
      expect(avatarImg).toHaveAttribute('src', expect.stringContaining('cdn.discordapp.com'));
    });
  });

  describe('Filtering', () => {
    it('should filter guilds by name', () => {
      renderWithProviders(<ServerList filterText="Alpha" />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      expect(screen.getByText('Alpha Server')).toBeInTheDocument();
      expect(screen.queryByText('Beta Server')).toBeNull();
      expect(screen.queryByText('Gamma Server')).toBeNull();
    });

    it('should filter case-insensitively', () => {
      renderWithProviders(<ServerList filterText="beta" />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      expect(screen.getByText('Beta Server')).toBeInTheDocument();
    });

    it('should show all guilds when filter is empty', () => {
      renderWithProviders(<ServerList filterText="" />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      expect(screen.getByText('Alpha Server')).toBeInTheDocument();
      expect(screen.getByText('Beta Server')).toBeInTheDocument();
      expect(screen.getByText('Gamma Server')).toBeInTheDocument();
    });

    it('should show all guilds when filter is whitespace', () => {
      renderWithProviders(<ServerList filterText="   " />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      expect(screen.getByText('Alpha Server')).toBeInTheDocument();
    });
  });

  describe('Copy Names', () => {
    it('should render copy button in header', () => {
      renderWithProviders(<ServerList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      expect(screen.getByLabelText('Copy server names')).toBeInTheDocument();
    });

    it('should copy server names to clipboard when copy button clicked', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      renderWithProviders(<ServerList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      fireEvent.click(screen.getByLabelText('Copy server names'));
      expect(writeText).toHaveBeenCalledWith('Alpha Server\nBeta Server\nGamma Server');
    });

    it('should dispatch toast after copying', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      const { store } = renderWithProviders(<ServerList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      fireEvent.click(screen.getByLabelText('Copy server names'));
      expect(store.getState().status.toast.isVisible).toBe(true);
      expect(store.getState().status.toast.message).toBe('Copied to clipboard');
    });

    it('should only copy filtered guilds when filter is active', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      renderWithProviders(<ServerList filterText="Alpha" />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      fireEvent.click(screen.getByLabelText('Copy server names'));
      expect(writeText).toHaveBeenCalledWith('Alpha Server');
    });
  });

  describe('Selection', () => {
    it('should dispatch setSelectedGuild when a guild is clicked', () => {
      const { store } = renderWithProviders(<ServerList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: null, roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      fireEvent.click(screen.getByText('Beta Server'));
      const state = store.getState();
      expect(state.guild.selectedGuild?.id).toBe('g2');
    });

    it('should mark selected guild item as selected', () => {
      renderWithProviders(<ServerList />, {
        preloadedState: createBaseState({
          auth: { token: 'test-token', isAuthenticated: true, isLoading: false, error: null, manuallyLoggedOut: false },
          guild: { guilds, selectedGuild: guilds[1], roles: [], isLoading: false, error: null, currentMemberRoles: [], memberRolesCache: {} },
        }),
      });
      const betaButton = screen.getByText('Beta Server').closest('[role="button"]');
      expect(betaButton).toHaveClass('Mui-selected');
    });
  });
});
