import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, renderWithProviders } from '@/test/test-utils';
import ThemePicker from './ThemePicker';
import { THEME_DESCRIPTORS, type ThemeDescriptor } from '@/theme/theme';

const supporterDescriptor: ThemeDescriptor = {
  id: 'test-supporter',
  name: 'Test Supporter',
  base: 'dark',
  tier: 'supporter',
  palette: THEME_DESCRIPTORS[0].palette,
};

const rosterWithSupporter = [...THEME_DESCRIPTORS, supporterDescriptor];

describe('ThemePicker', () => {
  let onChange: ReturnType<typeof vi.fn>;
  let onAnimationsChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
    onAnimationsChange = vi.fn();
  });

  const renderPicker = (props: Partial<React.ComponentProps<typeof ThemePicker>> = {}) =>
    renderWithProviders(
      <ThemePicker
        value="auto"
        onChange={onChange}
        animationsValue="true"
        onAnimationsChange={onAnimationsChange}
        {...props}
      />,
    );

  it('renders the Auto card plus one card per registry theme', () => {
    renderPicker();
    expect(screen.getByTestId('theme-card-auto')).toBeInTheDocument();
    for (const d of THEME_DESCRIPTORS) {
      expect(screen.getByTestId(`theme-card-${d.id}`)).toBeInTheDocument();
    }
  });

  it('marks the current form value as selected', () => {
    renderPicker({ value: 'discord-light' });
    expect(screen.getByTestId('theme-selected-discord-light')).toBeInTheDocument();
    expect(screen.queryByTestId('theme-selected-auto')).not.toBeInTheDocument();
  });

  it('resolves legacy alias values to their canonical theme', () => {
    renderPicker({ value: 'dark' });
    expect(screen.getByTestId('theme-selected-discord-dark')).toBeInTheDocument();
  });

  it('treats unknown stored values as auto', () => {
    renderPicker({ value: 'not-a-theme' });
    expect(screen.getByTestId('theme-selected-auto')).toBeInTheDocument();
  });

  it('hovering a card sets the live preview; leaving reverts to the selection', () => {
    const { store } = renderPicker({ value: 'auto' });
    const card = screen.getByTestId('theme-card-discord-light');

    fireEvent.mouseEnter(card);
    expect(store.getState().app.previewThemeId).toBe('discord-light');

    fireEvent.mouseLeave(card);
    expect(store.getState().app.previewThemeId).toBe('auto');
  });

  it('clicking an unlocked card selects it and keeps it previewed', () => {
    const { store } = renderPicker({ value: 'auto' });
    fireEvent.click(screen.getByTestId('theme-card-discord-dark'));
    expect(onChange).toHaveBeenCalledWith('discord-dark');
    expect(store.getState().app.previewThemeId).toBe('discord-dark');
  });

  it('shows a lock badge on supporter themes when not a supporter', () => {
    renderPicker({ descriptors: rosterWithSupporter, isSupporter: false });
    expect(screen.getByTestId('theme-locked-test-supporter')).toBeInTheDocument();
  });

  it('locked cards hover-preview but cannot be selected', () => {
    const { store } = renderPicker({ descriptors: rosterWithSupporter, isSupporter: false });
    const locked = screen.getByTestId('theme-card-test-supporter');

    fireEvent.mouseEnter(locked);
    expect(store.getState().app.previewThemeId).toBe('test-supporter');

    fireEvent.click(locked);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.mouseLeave(locked);
    expect(store.getState().app.previewThemeId).toBe('auto');
  });

  it('clicking a locked card opens the Supporter dialog', () => {
    const { store } = renderPicker({ descriptors: rosterWithSupporter, isSupporter: false });
    fireEvent.click(screen.getByTestId('theme-card-test-supporter'));
    expect(store.getState().supporter.dialogOpen).toBe(true);
  });

  it('supporter themes unlock when isSupporter is true', () => {
    renderPicker({ descriptors: rosterWithSupporter, isSupporter: true });
    expect(screen.queryByTestId('theme-locked-test-supporter')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('theme-card-test-supporter'));
    expect(onChange).toHaveBeenCalledWith('test-supporter');
  });

  it('keyboard focus previews like hover', () => {
    const { store } = renderPicker({ value: 'auto' });
    const card = screen.getByTestId('theme-card-discord-dark');

    fireEvent.focus(card);
    expect(store.getState().app.previewThemeId).toBe('discord-dark');

    fireEvent.blur(card);
    expect(store.getState().app.previewThemeId).toBe('auto');
  });

  it('renders the theme animations toggle and reports changes as strings', () => {
    renderPicker({ animationsValue: 'true' });
    const checkbox = screen.getByRole('checkbox', { name: 'Theme animations' });
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(onAnimationsChange).toHaveBeenCalledWith('false');
  });

  it('reflects a disabled animations value', () => {
    renderPicker({ animationsValue: 'false' });
    expect(screen.getByRole('checkbox', { name: 'Theme animations' })).not.toBeChecked();
  });
});
