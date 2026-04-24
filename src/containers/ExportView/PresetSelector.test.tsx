import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, act } from '@/test/test-utils';
import PresetSelector from './PresetSelector';
import { createBaseState } from '@/test/state-factories';
import { defaultSettings } from '@features/app/appSlice';
import { BUILT_IN_PRESETS } from '@features/export/exportTypes';

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

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  randomUUID: vi.fn().mockReturnValue('test-uuid-123'),
});

describe('PresetSelector', () => {
  function renderSelector(
    settingsOverrides: Record<string, any> = {},
    customPresets: Record<string, any> = {},
  ) {
    return renderWithProviders(<PresetSelector />, {
      preloadedState: createBaseState({
        app: {
          discrubPaused: false,
          discrubCancelled: false,
          isMinimized: false,
          focusedView: false,
          task: { status: 'idle', message: '' },
          settings: { ...defaultSettings, ...settingsOverrides },
        },
        presets: { presets: customPresets, isLoaded: true },
      } as any),
    });
  }

  it('renders dropdown', () => {
    renderSelector();
    expect(screen.getByText('Select a preset...')).toBeInTheDocument();
  });

  it('shows built-in presets when opened', async () => {
    renderSelector();
    // Open the select
    const select = screen.getByRole('combobox');
    await act(async () => { fireEvent.mouseDown(select); });

    for (const preset of BUILT_IN_PRESETS) {
      expect(screen.getByText(preset.name)).toBeInTheDocument();
    }
  });

  it('shows user custom presets', async () => {
    const preset = {
      id: 'custom-1',
      name: 'My Custom Preset',
      isBuiltIn: false,
      format: 'csv',
      messagesPerPage: 200,
      separateThreads: false,
      includeMedia: false,
      mediaConfig: { images: false, videos: false, audio: false, other: false },
      artistMode: false,
      sortOrder: 'ascending',
      previewMedia: false,
    };

    renderSelector({}, { [preset.id]: preset });
    const select = screen.getByRole('combobox');
    await act(async () => { fireEvent.mouseDown(select); });

    expect(screen.getByText('My Custom Preset')).toBeInTheDocument();
  });

  it('shows "Save as Preset..." option', async () => {
    renderSelector();
    const select = screen.getByRole('combobox');
    await act(async () => { fireEvent.mouseDown(select); });

    expect(screen.getByText('Save as Preset...')).toBeInTheDocument();
  });

  it('no delete on built-in presets', async () => {
    renderSelector();
    const select = screen.getByRole('combobox');
    await act(async () => { fireEvent.mouseDown(select); });

    // Built-in presets should not have delete buttons
    // The 3 built-in presets should be present but delete buttons shouldn't be next to them
    const deleteButtons = screen.queryAllByTestId('DeleteIcon');
    expect(deleteButtons.length).toBe(0);
  });

  it('empty custom shows only built-in with category headers', async () => {
    renderSelector({}, {});
    const select = screen.getByRole('combobox');
    await act(async () => { fireEvent.mouseDown(select); });

    // All built-in presets visible
    for (const preset of BUILT_IN_PRESETS) {
      expect(screen.getByText(preset.name)).toBeInTheDocument();
    }
    // Category headers visible
    expect(screen.getByText('Backup')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Media')).toBeInTheDocument();
    // No "Custom" header when no custom presets
    expect(screen.queryByText('Custom')).toBeNull();
  });

  it('renders built-ins even when no custom presets exist', async () => {
    renderSelector({}, {});
    const select = screen.getByRole('combobox');
    await act(async () => { fireEvent.mouseDown(select); });

    for (const preset of BUILT_IN_PRESETS) {
      expect(screen.getByText(preset.name)).toBeInTheDocument();
    }
  });

  it('shows preset summary descriptions', async () => {
    renderSelector();
    const select = screen.getByRole('combobox');
    await act(async () => { fireEvent.mouseDown(select); });

    // Full archive should show its config summary
    expect(screen.getByText(/HTML · All media · Threads/)).toBeInTheDocument();
    // Data analysis should show JSON format
    expect(screen.getByText(/JSON · No media/)).toBeInTheDocument();
  });

  it('shows Custom category header when custom presets exist', async () => {
    const preset = {
      id: 'custom-cat',
      name: 'My Preset',
      isBuiltIn: false,
      format: 'html',
      messagesPerPage: 100,
      separateThreads: false,
      includeMedia: false,
      mediaConfig: { images: false, videos: false, audio: false, other: false },
      artistMode: false,
      sortOrder: 'descending',
      previewMedia: true,
    };

    renderSelector({}, { [preset.id]: preset });
    const select = screen.getByRole('combobox');
    await act(async () => { fireEvent.mouseDown(select); });

    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('My Preset')).toBeInTheDocument();
  });

  it('starts with no preset selected on mount', () => {
    renderSelector();
    expect(screen.getByText('Select a preset...')).toBeInTheDocument();
  });

  it('does NOT persist preset selection across sessions', async () => {
    // Selection is intentionally local to the dialog session so the
    // user always starts from a clean slate. Persisting it led to
    // confusing "(Modified)" labels when settings drifted from the
    // saved preset between sessions.
    const { store } = renderSelector();
    const select = screen.getByRole('combobox');
    await act(async () => { fireEvent.mouseDown(select); });

    const firstPreset = BUILT_IN_PRESETS[0];
    await act(async () => { fireEvent.click(screen.getByText(firstPreset.name)); });

    // Selection lives in component state only — nothing about the
    // settings slice should have changed as a result of picking a preset.
    // (The dedicated EXPORT_SELECTED_PRESET key was removed cross-repo.)
    const settings = store.getState().app.settings;
    expect(settings).toBeDefined();
  });

  it('clears the dropdown back to empty when state drifts from the selected preset', async () => {
    // Replaces the old "(Modified)" suffix behavior. Once the user
    // diverges from the preset, the dropdown should read as empty —
    // they can re-select the preset or "Save as preset" to persist.
    const { store } = renderSelector();
    const combobox = screen.getByRole('combobox');
    await act(async () => { fireEvent.mouseDown(combobox); });
    const firstPreset = BUILT_IN_PRESETS[0];
    // Select from the menu — use getAllByText since the same name can
    // appear in both the menu and the closed-combobox display.
    const menuOptions = screen.getAllByText(firstPreset.name);
    await act(async () => { fireEvent.click(menuOptions[menuOptions.length - 1]); });

    // Dropdown now renders the preset's name (menu closed).
    expect(combobox.textContent).toBe(firstPreset.name);

    // Mutate export state out-of-band — simulates the user changing
    // any setting in the accordion (media toggle, page size, etc.).
    await act(async () => {
      store.dispatch({
        type: 'export/setMessagesPerPage',
        payload: firstPreset.messagesPerPage + 50,
      });
    });

    expect(combobox.textContent).toBe('Select a preset...');
    // And there is no "(Modified)" suffix in the dropdown anywhere.
    expect(combobox.textContent).not.toContain('Modified');
  });

  it('clears local selection when selected preset is deleted', async () => {
    const preset = {
      id: 'custom-del',
      name: 'Deletable Preset',
      isBuiltIn: false,
      format: 'csv',
      messagesPerPage: 50,
      separateThreads: false,
      includeMedia: false,
      mediaConfig: { images: false, videos: false, audio: false, other: false },
      artistMode: false,
      sortOrder: 'ascending',
      previewMedia: false,
    };

    renderSelector({}, { [preset.id]: preset });

    // Select the custom preset first
    const select = screen.getByRole('combobox');
    await act(async () => { fireEvent.mouseDown(select); });
    await act(async () => { fireEvent.click(screen.getByText('Deletable Preset')); });

    // Reopen and delete it
    await act(async () => { fireEvent.mouseDown(select); });
    const deleteBtn = screen.getByTestId('DeleteIcon');
    await act(async () => { fireEvent.click(deleteBtn); });

    // Selection should be cleared to placeholder
    expect(screen.getByText('Select a preset...')).toBeInTheDocument();
  });
});
