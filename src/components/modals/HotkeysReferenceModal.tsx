import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { useAppSelector } from '@/app/hooks';
import { selectHotkeysEnabled, selectHotkeyBindings } from '@features/hotkeys/hotkeysSlice';
import { formatBindingForDisplay } from '@features/hotkeys/keyMatcher';
import { buildScopeGroups } from '@features/hotkeys/scopeGroups';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';

interface HotkeysReferenceModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Read-only "what shortcuts are available?" modal triggered by `?`.
 *
 * Lists every registered hotkey grouped by scope, with the live
 * binding next to each label. Customization happens elsewhere
 * (Settings → Hotkeys); this modal is the discoverability surface.
 *
 * When the master toggle is off, an info banner makes that explicit
 * so the user understands why the listed shortcuts aren't firing.
 */
export const HotkeysReferenceModal = ({ open, onClose }: HotkeysReferenceModalProps) => {
  const theme = useTheme();
  const enabled = useAppSelector(selectHotkeysEnabled);
  const bindings = useAppSelector(selectHotkeyBindings);
  const groups = buildScopeGroups();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 5 }}>
        Keyboard Shortcuts
        <DialogCloseIcon onClose={onClose} />
      </DialogTitle>
      <DialogContent sx={{ overflow: 'auto' }}>
        {!enabled && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Hotkeys are currently disabled. Re-enable them in Settings → Hotkeys
            to start using the shortcuts below.
          </Alert>
        )}

        <Stack spacing={2}>
          {groups.map((group) => (
            <Box key={group.scope}>
              <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {group.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {group.blurb}
              </Typography>
              <Stack spacing={0.5}>
                {group.actions.map((action) => {
                  const binding = bindings[action.id];
                  return (
                    <Stack
                      key={action.id}
                      direction="row"
                      alignItems="center"
                      spacing={2}
                      sx={{
                        py: 0.75,
                        px: 1,
                        borderRadius: 1,
                        backgroundColor: theme.palette.action.hover,
                      }}
                    >
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {action.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {action.description}
                        </Typography>
                      </Box>
                      <Chip
                        label={binding ? formatBindingForDisplay(binding) : 'Unbound'}
                        size="small"
                        variant="outlined"
                        sx={{ minWidth: 90, fontFamily: 'monospace' }}
                      />
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 3, textAlign: 'center' }}
        >
          Shortcuts are inactive while typing in inputs and forms. Customize
          bindings in Settings → Hotkeys.
        </Typography>
      </DialogContent>
    </Dialog>
  );
};

export default HotkeysReferenceModal;
