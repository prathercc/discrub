import { useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { GlobalStyles } from '@mui/material';
import { useAppSelector } from '@/app/hooks';
import { selectSettings } from '@features/app/appSlice';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { getThemeByMode } from './theme';
import { globalStyles } from './globalStyles';
import { isExtensionMode } from '@/extension/messaging';

/**
 * Resolve the effective theme mode from the setting value.
 * 'auto' detects from Discord (extension) or system preference (web app).
 */
function resolveThemeMode(settingValue: string | undefined): 'dark' | 'light' {
  if (settingValue === 'light') return 'light';
  if (settingValue === 'dark') return 'dark';

  // Auto-detect
  if (isExtensionMode()) {
    // Try to detect Discord's theme from the page
    try {
      const htmlEl = document.documentElement;
      if (htmlEl.classList.contains('theme-light')) return 'light';
    } catch {
      // Fall through to system preference
    }
  }

  // Fall back to system preference
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }

  return 'dark';
}

interface ThemeWrapperProps {
  children: React.ReactNode;
}

const ThemeWrapper = ({ children }: ThemeWrapperProps) => {
  const settings = useAppSelector(selectSettings);
  const themeModeSetting = settings?.[DiscrubSetting.APP_THEME_MODE];

  const theme = useMemo(
    () => getThemeByMode(resolveThemeMode(themeModeSetting)),
    [themeModeSetting]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={globalStyles} />
      {children}
    </ThemeProvider>
  );
};

export default ThemeWrapper;
