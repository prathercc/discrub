import { useMediaQuery, useTheme } from '@mui/material';

/**
 * Long dialogs (Export, Bulk Export/Purge, Settings, Themes hub, Filters)
 * go edge-to-edge below MUI `sm` (600px) so a phone gets the full
 * viewport height instead of a 32px-inset card. Pass the result straight
 * to `<Dialog fullScreen={...}>`.
 */
export const useFullScreenDialog = (): boolean => {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
};
