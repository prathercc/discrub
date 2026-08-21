import { describe, it, expect } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { screen, renderWithProviders } from '@/test/test-utils';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { defaultSettings } from '@features/app/appSlice';
import { initialAppState } from '@features/app/appTypes';
import { initialExportState } from '@features/export/exportTypes';
import ThemeAccentStrip from './ThemeAccentStrip';
import { getThemeById, darkTheme } from './theme';

const renderStrip = (
  themeId: string | undefined,
  opts: { animations?: string; exporting?: boolean } = {},
) => {
  const theme = themeId ? getThemeById(themeId) : darkTheme;
  const settings = {
    ...defaultSettings,
    ...(opts.animations !== undefined
      ? { [DiscrubSetting.APP_THEME_ANIMATIONS]: opts.animations }
      : {}),
  };
  return renderWithProviders(
    <ThemeProvider theme={theme}>
      <ThemeAccentStrip />
    </ThemeProvider>,
    {
      preloadedState: {
        app: { ...initialAppState, settings },
        ...(opts.exporting
          ? { export: { ...initialExportState, isExporting: true } }
          : {}),
      } as any,
    },
  );
};

describe('ThemeAccentStrip', () => {
  it('renders nothing for free themes', () => {
    renderStrip(undefined);
    expect(screen.queryByTestId('theme-accent-strip')).not.toBeInTheDocument();
  });

  it('renders the strip for a supporter theme with animations on', () => {
    renderStrip('synthwave');
    const strip = screen.getByTestId('theme-accent-strip');
    expect(strip).toHaveAttribute('data-animated', 'true');
  });

  it('stays visible but static when theme animations are disabled', () => {
    renderStrip('synthwave', { animations: 'false' });
    const strip = screen.getByTestId('theme-accent-strip');
    expect(strip).toHaveAttribute('data-animated', 'false');
  });

  it('pauses while a heavy operation is running', () => {
    renderStrip('abyss', { exporting: true });
    const strip = screen.getByTestId('theme-accent-strip');
    expect(strip).toHaveAttribute('data-animated', 'false');
  });

  it('is hidden from assistive tech', () => {
    renderStrip('ember');
    expect(screen.getByTestId('theme-accent-strip')).toHaveAttribute('aria-hidden', 'true');
  });
});
