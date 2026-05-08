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
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectHotkeysEnabled,
  selectHotkeyBindings,
  setHotkeysEnabled,
  setHotkeyBinding,
  resetHotkeyBinding,
  resetAllHotkeys,
} from '@features/hotkeys/hotkeysSlice';
import { eventToBinding, formatBindingForDisplay } from '@features/hotkeys/keyMatcher';
import { findHotkeyConflicts, findConflictingActions } from '@features/hotkeys/conflicts';
import { getHotkeyMeta } from '@features/hotkeys/defaults';
import { buildScopeGroups, getScopeBlurb } from '@features/hotkeys/scopeGroups';
import type { HotkeyActionId, HotkeyMeta } from '@features/hotkeys/types';

/**
 * Settings tab for the #144 hotkey customization system.
 *
 * Self-contained: hotkey state lives in its own slice and persists
 * immediately on every dispatch, so this tab doesn't participate in
 * SettingsModal's batched formValues/save flow. The modal's "Save"
 * button has no effect here; rebinds and the master toggle take
 * effect as soon as the user releases the key.
 */
export const HotkeysTab = () => {
  const dispatch = useAppDispatch();
  const enabled = useAppSelector(selectHotkeysEnabled);
  const bindings = useAppSelector(selectHotkeyBindings);
  const [search, setSearch] = useState('');

  const conflicts = useMemo(() => findHotkeyConflicts(bindings), [bindings]);

  // Filter the registry by the search box; group AFTER filtering so a
  // narrowed search still respects scope ordering and skips empty
  // groups.
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
            onChange={(e) => dispatch(setHotkeysEnabled(e.target.checked))}
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
          onClick={() => dispatch(resetAllHotkeys())}
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
}

/**
 * Single row in the Hotkeys tab. Renders the action label + scope
 * blurb on the left and the rebind chip + reset on the right. Enters
 * "capture mode" on chip click; pressing a key (or chord) shows the
 * proposed binding and offers Save / Cancel. Esc cancels capture mode
 * locally — the document-level handler is bypassed via stopPropagation.
 */
const HotkeyRow = ({ action, binding, conflictingActionIds, disabled }: HotkeyRowProps) => {
  const dispatch = useAppDispatch();
  const allBindings = useAppSelector(selectHotkeyBindings);
  const theme = useTheme();
  const [capturing, setCapturing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  // While capturing, override the global keydown so chord captures
  // (e.g. mod+,) don't trigger their bound actions. Capture phase
  // listener runs before the bubbled HotkeyProvider listener.
  useEffect(() => {
    if (!capturing) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setCapturing(false);
        setPending(null);
        return;
      }
      const captured = eventToBinding(e);
      if (captured) setPending(captured);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [capturing]);

  const save = () => {
    if (pending) {
      dispatch(setHotkeyBinding({ actionId: action.id, key: pending }));
    }
    setCapturing(false);
    setPending(null);
  };

  const cancel = () => {
    setCapturing(false);
    setPending(null);
  };

  // When capturing, show the proposed binding's conflict info so the
  // user sees the override warning *before* committing the rebind.
  const pendingConflicts = pending
    ? findConflictingActions(allBindings, action.id, pending)
    : [];

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
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                label={pending ? formatBindingForDisplay(pending) : 'Press a key…'}
                size="small"
                color={pending ? 'primary' : 'default'}
                variant={pending ? 'filled' : 'outlined'}
                sx={{
                  minWidth: 110,
                  animation: pending ? 'none' : 'pulse 1s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              />
              {pending && (
                <Button size="small" onClick={save}>
                  Save
                </Button>
              )}
              <Button size="small" onClick={cancel} color="inherit">
                Cancel
              </Button>
            </Stack>
          )}
          <IconButton
            size="small"
            onClick={() => dispatch(resetHotkeyBinding(action.id))}
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

      {capturing && pendingConflicts.length > 0 && (
        <Alert
          severity="warning"
          icon={<ConflictIcon fontSize="small" />}
          sx={{ mt: 1, py: 0 }}
        >
          Saving will override:{' '}
          {pendingConflicts.map((id) => getHotkeyMeta(id).label).join(', ')}.
        </Alert>
      )}
    </Box>
  );
};

export default HotkeysTab;
