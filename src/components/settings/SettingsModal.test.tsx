import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../../test/test-utils';
import SettingsModal from './SettingsModal';
import { createBaseState } from '../../test/state-factories';
import { defaultSettings } from '@features/app/appSlice';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(() => ({})),
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

describe('SettingsModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderSettings(settings: any = defaultSettings) {
    return renderWithProviders(<SettingsModal {...defaultProps} />, {
      preloadedState: createBaseState({
        app: {
          discrubPaused: false,
          discrubCancelled: false,
          isMinimized: false,
          focusedView: false,
          kofiOverlayOpen: false,
          sidebarView: 'server' as const,
          task: { status: 'idle', message: '' },
          settings,
          previewThemeId: null,
        },
      }),
    });
  }

  describe('Rendering', () => {
    it('should render dialog title', () => {
      renderSettings();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<SettingsModal open={false} onClose={vi.fn()} />, {
        preloadedState: createBaseState(),
      });
      expect(screen.queryByText('Settings')).toBeNull();
    });
  });

  describe('Tabs', () => {
    it('should render all tab labels', () => {
      renderSettings();
      expect(screen.getByRole('tab', { name: 'Operation Delays' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Export Preferences' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'User Data' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Display' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Purge Behavior' })).toBeInTheDocument();
    });

    it('should default to first tab', () => {
      renderSettings();
      expect(screen.getByRole('tab', { name: 'Operation Delays', selected: true })).toBeInTheDocument();
    });

    it('should switch tabs on click', () => {
      renderSettings();
      fireEvent.click(screen.getByRole('tab', { name: 'Export Preferences' }));
      expect(screen.getByRole('tab', { name: 'Export Preferences', selected: true })).toBeInTheDocument();
    });

    it('should show tab content for Export Preferences', () => {
      renderSettings();
      fireEvent.click(screen.getByRole('tab', { name: 'Export Preferences' }));
      // ExportPreferencesTab should render its content
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });

    it('should show tab content for Display', () => {
      renderSettings();
      fireEvent.click(screen.getByRole('tab', { name: 'Display' }));
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should render Save, Cancel, and Reset to defaults buttons', () => {
      renderSettings();
      expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeInTheDocument();
    });

    it('Reset to defaults preserves the theme choices (they live in the hub now)', async () => {
      const { store } = renderSettings({
        ...defaultSettings,
        [DiscrubSetting.APP_THEME_MODE]: 'synthwave',
        [DiscrubSetting.APP_THEME_ANIMATIONS]: 'false',
        [DiscrubSetting.DATE_FORMAT]: 'DD/MM/YYYY',
      });

      fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

      await waitFor(() => {
        const settings = store.getState().app.settings;
        // Non-theme settings reset...
        expect(settings?.[DiscrubSetting.DATE_FORMAT]).toBe(
          defaultSettings[DiscrubSetting.DATE_FORMAT],
        );
        // ...but the hub-owned theme keys must not be clobbered.
        expect(settings?.[DiscrubSetting.APP_THEME_MODE]).toBe('synthwave');
        expect(settings?.[DiscrubSetting.APP_THEME_ANIMATIONS]).toBe('false');
      });
    });

    it('should call onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      renderWithProviders(<SettingsModal open={true} onClose={onClose} />, {
        preloadedState: createBaseState({
          app: {
            discrubPaused: false,
            discrubCancelled: false,
            isMinimized: false,
            focusedView: false,
            kofiOverlayOpen: false,
            sidebarView: 'server' as const,
            task: { status: 'idle', message: '' },
            settings: defaultSettings as any,
            previewThemeId: null,
          },
        }),
      });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Settings Initialization', () => {
    it('should use defaultSettings when settings are null', () => {
      renderSettings(null);
      // Modal renders with default settings — no errors
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });
});
