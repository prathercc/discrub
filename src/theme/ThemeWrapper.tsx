import { useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { GlobalStyles } from '@mui/material';
import { useAppSelector } from '@/app/hooks';
import { selectSettings, selectPreviewThemeId } from '@features/app/appSlice';
import { selectHasThemes, selectSupporter } from '@features/supporter/supporterSlice';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { getThemeById, findThemeDescriptor, resolveThemeIdFromSetting } from './theme';
import { globalStyles } from './globalStyles';

interface ThemeWrapperProps {
  children: React.ReactNode;
}

const ThemeWrapper = ({ children }: ThemeWrapperProps) => {
  const settings = useAppSelector(selectSettings);
  const themeModeSetting = settings?.[DiscrubSetting.APP_THEME_MODE];
  // Transient override from the Settings theme picker's live preview.
  // 'auto' previews through the same detection path as the saved setting.
  const previewThemeId = useAppSelector(selectPreviewThemeId);
  const isSupporter = useAppSelector(selectHasThemes);
  const supporterInitialized = useAppSelector(selectSupporter).initialized;

  const themeId = useMemo(() => {
    let id = resolveThemeIdFromSetting(previewThemeId ?? themeModeSetting);
    // A stored supporter theme without a valid key falls back to auto
    // (setting untouched — re-claiming brings the theme straight back).
    // Previews stay unrestricted: hovering locked themes is the pitch.
    // Until key verification resolves on boot, honor the stored choice
    // so legitimate supporters never see a theme flash.
    if (!previewThemeId && supporterInitialized && !isSupporter) {
      if (findThemeDescriptor(id)?.tier === 'supporter') {
        id = resolveThemeIdFromSetting('auto');
      }
    }
    return id;
  }, [previewThemeId, themeModeSetting, supporterInitialized, isSupporter]);

  const theme = useMemo(() => getThemeById(themeId), [themeId]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={globalStyles} />
      {children}
    </ThemeProvider>
  );
};

export default ThemeWrapper;
