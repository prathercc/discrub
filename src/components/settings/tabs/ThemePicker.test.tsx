import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, renderWithProviders } from '@/test/test-utils';
import ThemeGrid from './ThemePicker';
import { THEME_DESCRIPTORS, type ThemeDescriptor } from '@/theme/theme';

const supporterDescriptor: ThemeDescriptor = {
  id: 'test-supporter',
  name: 'Test Supporter',
  base: 'dark',
  tier: 'supporter',
  palette: THEME_DESCRIPTORS[0].palette,
};

const rosterWithSupporter = [...THEME_DESCRIPTORS, supporterDescriptor];

describe('ThemeGrid', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  const renderGrid = (props: Partial<React.ComponentProps<typeof ThemeGrid>> = {}) =>
    renderWithProviders(<ThemeGrid value="auto" onChange={onChange} {...props} />);

  it('renders the Auto card plus one card per registry theme', () => {
    renderGrid();
    expect(screen.getByTestId('theme-card-auto')).toBeInTheDocument();
    for (const d of THEME_DESCRIPTORS) {
      expect(screen.getByTestId(`theme-card-${d.id}`)).toBeInTheDocument();
    }
  });

  it('marks the current form value as selected', () => {
    renderGrid({ value: 'discord-light' });
    expect(screen.getByTestId('theme-selected-discord-light')).toBeInTheDocument();
    expect(screen.queryByTestId('theme-selected-auto')).not.toBeInTheDocument();
  });

  it('resolves legacy alias values to their canonical theme', () => {
    renderGrid({ value: 'dark' });
    expect(screen.getByTestId('theme-selected-discord-dark')).toBeInTheDocument();
  });

  it('treats unknown stored values as auto', () => {
    renderGrid({ value: 'not-a-theme' });
    expect(screen.getByTestId('theme-selected-auto')).toBeInTheDocument();
  });

  it('clicking an unlocked card selects it and keeps it previewed', () => {
    const { store } = renderGrid({ value: 'auto' });
    fireEvent.click(screen.getByTestId('theme-card-discord-dark'));
    expect(onChange).toHaveBeenCalledWith('discord-dark');
    expect(store.getState().app.previewThemeId).toBe('discord-dark');
  });

  it('the eye starts a sticky preview that survives the pointer leaving', () => {
    const { store } = renderGrid({ value: 'auto' });
    const eye = screen.getByTestId('theme-preview-discord-light');

    fireEvent.click(eye);
    expect(store.getState().app.previewThemeId).toBe('discord-light');

    // Sticky: wandering off the card must NOT revert the preview.
    fireEvent.mouseLeave(screen.getByTestId('theme-card-discord-light'));
    expect(store.getState().app.previewThemeId).toBe('discord-light');
  });

  it('the eye toggles: a second click reverts to the selection', () => {
    const { store } = renderGrid({ value: 'auto' });
    const eye = screen.getByTestId('theme-preview-discord-light');

    fireEvent.click(eye);
    expect(store.getState().app.previewThemeId).toBe('discord-light');
    fireEvent.click(eye);
    expect(store.getState().app.previewThemeId).toBe('auto');
  });

  it('shows the preview bar with Apply and Stop while previewing an unlocked theme', () => {
    const { store } = renderGrid({ value: 'auto' });
    expect(screen.queryByTestId('theme-preview-bar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('theme-preview-discord-light'));
    const bar = screen.getByTestId('theme-preview-bar');
    expect(bar).toHaveTextContent('Previewing');
    expect(bar).toHaveTextContent('Light Original');

    fireEvent.click(screen.getByTestId('theme-preview-apply'));
    expect(onChange).toHaveBeenCalledWith('discord-light');
    expect(store.getState().app.previewThemeId).toBe('discord-light');
  });

  it('Stop in the preview bar reverts to the selection', () => {
    const { store } = renderGrid({ value: 'auto' });
    fireEvent.click(screen.getByTestId('theme-preview-discord-light'));
    fireEvent.click(screen.getByTestId('theme-preview-stop'));
    expect(store.getState().app.previewThemeId).toBe('auto');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a lock badge on supporter themes when not a supporter', () => {
    renderGrid({ descriptors: rosterWithSupporter, isSupporter: false });
    expect(screen.getByTestId('theme-locked-test-supporter')).toBeInTheDocument();
  });

  it('clicking a locked card toggles its preview instead of selecting', () => {
    const { store } = renderGrid({ descriptors: rosterWithSupporter, isSupporter: false });
    const locked = screen.getByTestId('theme-card-test-supporter');

    fireEvent.click(locked);
    expect(store.getState().app.previewThemeId).toBe('test-supporter');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(locked);
    expect(store.getState().app.previewThemeId).toBe('auto');
  });

  it('the preview bar marks a locked theme and offers no Apply', () => {
    renderGrid({ descriptors: rosterWithSupporter, isSupporter: false });
    fireEvent.click(screen.getByTestId('theme-preview-test-supporter'));

    const bar = screen.getByTestId('theme-preview-bar');
    expect(bar).toHaveTextContent('Locked');
    expect(screen.queryByTestId('theme-preview-apply')).not.toBeInTheDocument();
    expect(screen.getByTestId('theme-preview-stop')).toBeInTheDocument();
  });

  it('supporter themes unlock when isSupporter is true', () => {
    renderGrid({ descriptors: rosterWithSupporter, isSupporter: true });
    expect(screen.queryByTestId('theme-locked-test-supporter')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('theme-card-test-supporter'));
    expect(onChange).toHaveBeenCalledWith('test-supporter');
  });

  it('previewing the currently selected theme is a visual no-op (no bar)', () => {
    renderGrid({ value: 'discord-dark' });
    fireEvent.click(screen.getByTestId('theme-preview-discord-dark'));
    expect(screen.queryByTestId('theme-preview-bar')).not.toBeInTheDocument();
  });
});
