import { useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { resetDiscrubData } from '@/extension/storage';

interface ResetDiscrubButtonProps {
  /**
   * "link" — small inline text link, intended for LandingPage where
   * the affordance must not compete with the primary Sign In flow.
   * "button" — standard error-colored button, intended for the Reset
   * tab in SettingsModal.
   */
  variant?: 'link' | 'button';
}

/**
 * Defense-in-depth escape hatch (Backlog #134). Wipes every byte of
 * Discrub data on this device + reloads. See `resetDiscrubData()` in
 * `@/extension/storage`. The confirmation modal is intentionally the
 * same in both placements (consistency over targeted friction).
 */
const ResetDiscrubButton = ({ variant = 'button' }: ResetDiscrubButtonProps) => {
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleConfirm = async () => {
    setResetting(true);
    try {
      await resetDiscrubData();
    } catch {
      // resetDiscrubData already reloads on success; if it threw before
      // reaching reload, force it so the user gets the fresh start they
      // explicitly asked for.
      window.location.reload();
    }
  };

  const trigger =
    variant === 'link' ? (
      <Link
        component="button"
        type="button"
        variant="caption"
        color="text.secondary"
        underline="hover"
        onClick={() => setOpen(true)}
        data-testid="reset-discrub-link"
      >
        Stuck? Reset data
      </Link>
    ) : (
      <Button
        variant="contained"
        color="error"
        onClick={() => setOpen(true)}
        data-testid="reset-discrub-button"
      >
        Reset data
      </Button>
    );

  return (
    <>
      {trigger}
      <Dialog
        open={open}
        onClose={resetting ? undefined : () => setOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper' } }}
      >
        <DialogTitle>Reset all Discrub data?</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              This will clear everything Discrub stores in your browser:
            </Typography>
            <Stack component="ul" spacing={0.5} sx={{ pl: 3, m: 0 }}>
              <Typography component="li" variant="body2" color="text.secondary">
                Settings and preferences
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Export presets and recent exports
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Cached user info and status log
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Imported data packages and downloaded media
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              You'll need to sign in again afterward. This cannot be undone, and only affects this device.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpen(false)}
            disabled={resetting}
            data-testid="reset-discrub-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirm}
            disabled={resetting}
            startIcon={resetting ? <CircularProgress size={16} color="inherit" /> : undefined}
            data-testid="reset-discrub-confirm"
          >
            {resetting ? 'Resetting…' : 'Reset everything'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ResetDiscrubButton;
