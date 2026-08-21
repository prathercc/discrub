import { useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { GlobalStyles } from '@mui/material';
import { useAppSelector } from '@/app/hooks';
import { selectSettings, selectPreviewThemeId } from '@features/app/appSlice';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { getThemeById, findThemeDescriptor, DISCORD_DARK_ID, DISCORD_LIGHT_ID } from './theme';
import { globalStyles } from './globalStyles';
import { isExtensionMode } from '@/extension/messaging';

/**
 * Resolve the effective theme id from the setting value. Explicit ids
 * (including legacy 'dark'/'light' values) resolve through the registry;
 * 'auto' — and any unknown id — detects from Discord (extension) or
 * system preference (web app) and picks the matching Discord theme.
 */
function resolveThemeId(settingValue: string | undefined): string {
  if (settingValue && settingValue !== 'auto') {
    const descriptor = findThemeDescriptor(settingValue);
    if (descriptor) return descriptor.id;
  }

  // Auto-detect
  if (isExtensionMode()) {
    // Try to detect Discord's theme from the page
    try {
      const htmlEl = document.documentElement;
      if (htmlEl.classList.contains('theme-light')) return DISCORD_LIGHT_ID;
    } catch {
      // Fall through to system preference
    }
  }

  // Fall back to system preference
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return DISCORD_LIGHT_ID;
  }

  return DISCORD_DARK_ID;
}

interface ThemeWrapperProps {
  children: React.ReactNode;
}

const ThemeWrapper = ({ children }: ThemeWrapperProps) => {
  const settings = useAppSelector(selectSettings);
  const themeModeSetting = settings?.[DiscrubSetting.APP_THEME_MODE];
  // Transient override from the Settings theme picker's live preview.
  // 'auto' previews through the same detection path as the saved setting.
  const previewThemeId = useAppSelector(selectPreviewThemeId);

  const theme = useMemo(
    () => getThemeById(resolveThemeId(previewThemeId ?? themeModeSetting)),
    [previewThemeId, themeModeSetting]
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
