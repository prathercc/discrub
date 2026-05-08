import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  RestartAlt as ResetIcon,
  Edit as EditIcon,
  WarningAmberOutlined as ConflictIcon,
} from '@mui/icons-material';
import { eventToBinding, formatBindingForDisplay } from '@features/hotkeys/keyMatcher';
import { findHotkeyConflicts } from '@features/hotkeys/conflicts';
import { DEFAULT_HOTKEYS, getHotkeyMeta } from '@features/hotkeys/defaults';
import { buildScopeGroups, getScopeBlurb } from '@features/hotkeys/scopeGroups';
import type { HotkeyActionId, HotkeyMeta, HotkeysState } from '@features/hotkeys/types';

interface HotkeysTabProps {
  /**
   * Working-copy of the hotkey state. Lives in SettingsModal alongside
   * the AppSettings form so the dialog's "Save Settings" button is the
   * single commit point for every change in the modal — no per-row
   * Save buttons (the previous version had two competing Saves which
   * confused users).
   */
  formHotkeys: HotkeysState;
  /** Receives the new full state on any edit (rebind / reset / toggle). */
  onHotkeysChange: (next: HotkeysState) => void;
}

/**
 * Settings tab for the #144 hotkey customization system.
 *
 * Reads from / writes to a local form state passed by SettingsModal.
 * Capture-mode rebind auto-commits to the form on key release; the
 * dialog's footer button is the only place where edits actually
 * persist to Redux + IDB. Esc cancels capture without changing form
 * state.
 */
export const HotkeysTab = ({ formHotkeys, onHotkeysChange }: HotkeysTabProps) => {
  const { enabled, bindings } = formHotkeys;
  const [search, setSearch] = useState('');

  const conflicts = useMemo(() => findHotkeyConflicts(bindings), [bindings]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const allGroups = buildScopeGroups();
    if (!q) return allGroups;
    return allGroups
      .map((g) => ({
        ...g,
        actions: g.actions.filter(
          (a) =>
            a.label.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q) ||
            (bindings[a.id] ?? '').toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.actions.length > 0);
  }, [search, bindings]);

  const setBinding = (actionId: HotkeyActionId, key: string) => {
    onHotkeysChange({ ...formHotkeys, bindings: { ...bindings, [actionId]: key } });
  };
  const resetBinding = (actionId: HotkeyActionId) => {
    setBinding(actionId, DEFAULT_HOTKEYS[actionId]);
  };
  const resetAll = () => {
    onHotkeysChange({ ...formHotkeys, bindings: { ...DEFAULT_HOTKEYS } });
  };
  const setEnabled = (next: boolean) => {
    onHotkeysChange({ ...formHotkeys, enabled: next });
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Enable hotkeys
            </Typography>
            <Typography variant="body2" color="text.secondary">
              When off, all keyboard shortcuts below are inactive. System keys
              (Esc to close dialogs, Tab to navigate) still work.
            </Typography>
          </Box>
          <Switch
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            inputProps={{ 'aria-label': 'Enable hotkeys' }}
          />
        </Stack>
      </Box>

      {!enabled && (
        <Alert severity="info">
          Hotkeys are off. Toggle above to re-enable. The bindings below stay
          intact and will resume when you flip the switch back on.
        </Alert>
      )}

      <TextField
        size="small"
        placeholder="Find a hotkey…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        disabled={!enabled}
      />

      {filteredGroups.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          No shortcuts match "{search}".
        </Typography>
      )}

      {filteredGroups.map((group) => (
        <Box key={group.scope}>
          <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            {group.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {group.blurb}
          </Typography>
          <Stack spacing={0.5}>
            {group.actions.map((action) => (
              <HotkeyRow
                key={action.id}
                action={action}
                binding={bindings[action.id]}
                conflictingActionIds={
                  conflicts.get(bindings[action.id])?.filter((id) => id !== action.id) ?? []
                }
                disabled={!enabled}
                onRebind={(k) => setBinding(action.id, k)}
                onReset={() => resetBinding(action.id)}
              />
            ))}
          </Stack>
        </Box>
      ))}

      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="outlined"
          size="small"
          startIcon={<ResetIcon />}
          onClick={resetAll}
        >
          Reset all hotkeys
        </Button>
      </Stack>
    </Stack>
  );
};

interface HotkeyRowProps {
  action: HotkeyMeta;
  binding: string;
  conflictingActionIds: HotkeyActionId[];
  disabled: boolean;
  onRebind: (newBinding: string) => void;
  onReset: () => void;
}

/**
 * Single row in the Hotkeys tab. Capture mode now auto-commits the
 * captured key to the form on press — no per-row Save button. Esc
 * cancels capture without committing.
 */
const HotkeyRow = ({
  action,
  binding,
  conflictingActionIds,
  disabled,
  onRebind,
  onReset,
}: HotkeyRowProps) => {
  const theme = useTheme();
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!capturing) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        // Esc during capture cancels without changing the binding.
        // The smart-stack Esc would otherwise close the SettingsModal
        // entirely, which would be surprising mid-rebind.
        setCapturing(false);
        return;
      }
      const captured = eventToBinding(e);
      if (!captured) return; // pure modifier press, keep listening
      onRebind(captured);
      setCapturing(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [capturing, onRebind]);

  return (
    <Box
      sx={{
        py: 1,
        px: 1.5,
        borderRadius: 1,
        backgroundColor: theme.palette.action.hover,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {action.label}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {action.description}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
            {getScopeBlurb(action.scope)}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} alignItems="center">
          {!capturing && (
            <Chip
              label={binding ? formatBindingForDisplay(binding) : 'Unbound'}
              size="small"
              variant="outlined"
              icon={<EditIcon />}
              onClick={() => !disabled && setCapturing(true)}
              clickable={!disabled}
              disabled={disabled}
              sx={{ minWidth: 90 }}
              data-testid={`hotkey-chip-${action.id}`}
            />
          )}
          {capturing && (
            <Chip
              label="Press a key…"
              size="small"
              color="primary"
              variant="outlined"
              sx={{
                minWidth: 110,
                animation: 'pulse 1s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }}
            />
          )}
          <IconButton
            size="small"
            onClick={onReset}
            disabled={disabled || binding === action.defaultKey}
            aria-label={`Reset ${action.label} to default`}
            title={`Reset ${action.label} to default`}
          >
            <ResetIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {!capturing && conflictingActionIds.length > 0 && (
        <Alert
          severity="warning"
          icon={<ConflictIcon fontSize="small" />}
          sx={{ mt: 1, py: 0 }}
        >
          Also bound to:{' '}
          {conflictingActionIds.map((id) => getHotkeyMeta(id).label).join(', ')}.
          One of them won't fire.
        </Alert>
      )}
    </Box>
  );
};

export default HotkeysTab;
