import { useEffect, useMemo, useState, useRef } from 'react';
import {
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Box,
  Typography,
  Checkbox,
  Divider,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import DmAvatar from '@/components/ui/DmAvatar';
import {
  Message as MessageIcon,
  CheckBox as SelectModeIcon,
  CheckBoxOutlineBlank as SelectModeOffIcon,
  Groups as GroupsIcon,
  Tag as TagIcon,
} from '@mui/icons-material';
import MultiSelectControls from './MultiSelectControls';
import type { Channel } from 'discrub-core/types/discord-types';
import TourButton from '@components/welcome/TourButton';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectDMs,
  selectSelectedDm,
  selectDmLoading,
  selectSelectedDms,
  fetchDMs,
  fetchDmById,
  parseDmChannelInput,
  setSelectedDm,
  toggleDmSelection,
  selectAllDms,
  deselectAllDms,
  selectDmsInRange,
} from '@features/dm/dmSlice';
import { selectAuthToken } from '@features/auth/authSlice';
import { fetchMessages, clearMessages } from '@features/message/messageSlice';
import { addStatusEntry, showToast } from '@features/status/statusSlice';
import { setSelectedChannel } from '@features/channel/channelSlice';
import ListSkeleton from '@components/ui/ListSkeleton';
import EmptyState from '@components/ui/EmptyState';
import { timeAgo } from '@/utils/timeAgo';
import BulkExportDialog from '@containers/ExportView/BulkExportDialog';
import BulkPurgeDialog from '@containers/PurgeView/BulkPurgeDialog';
import BulkEditDialog from '@containers/PurgeView/BulkEditDialog';

const PAGE_SIZE = 50;

interface OpenDmByIdDialogProps {
  open: boolean;
  onClose: () => void;
  /** Resolve = channel opened + selected; reject = show the inline error. */
  onOpenChannel: (channelId: string) => Promise<void>;
}

/**
 * "Open DM by ID" dialog (#240). GET /users/@me/channels omits CLOSED DM
 * conversations (e.g. one with a deleted account), so the sidebar list can
 * never surface them — but the channel still exists and the user often has
 * its ID from a discord.com/channels/@me/<id> URL. This dialog accepts the
 * raw snowflake or the pasted URL and hands the parsed ID to the parent.
 * Session-only: nothing here is persisted.
 */
const OpenDmByIdDialog = ({
  open,
  onClose,
  onOpenChannel,
}: OpenDmByIdDialogProps) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleClose = () => {
    if (busy) return;
    setValue('');
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    const channelId = parseDmChannelInput(value);
    if (!channelId) {
      setError(
        'Enter a 17-20 digit channel ID or a discord.com/channels/@me link.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onOpenChannel(channelId);
      setBusy(false);
      setValue('');
      onClose();
    } catch {
      setBusy(false);
      setError(
        "Couldn't open that channel. Check the ID and that you were a member of the conversation.",
      );
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Open DM by ID</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Closed conversations (for example, with a deleted account) never
          appear in the DM list, but one can be opened directly using its
          channel ID or a discord.com/channels/@me link.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Channel ID or link"
          placeholder="e.g. 1029384756102938475"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirm();
            }
          }}
          error={!!error}
          helperText={error ?? ' '}
          disabled={busy}
          inputProps={{ 'data-testid': 'open-dm-by-id-input' }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={busy || !value.trim()}
          variant="contained"
          data-testid="open-dm-by-id-confirm"
        >
          Open
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface DMListProps {
  filterText?: string;
}

/**
 * DMList component - displays all DM channels
 */
const DMList = ({ filterText = '' }: DMListProps) => {
  const dispatch = useAppDispatch();
  const dms = useAppSelector(selectDMs);
  const selectedDm = useAppSelector(selectSelectedDm);
  const selectedDms = useAppSelector(selectSelectedDms);
  const isLoading = useAppSelector(selectDmLoading);
  const token = useAppSelector(selectAuthToken);

  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [bulkExportOpen, setBulkExportOpen] = useState(false);
  const [bulkPurgeOpen, setBulkPurgeOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [openByIdOpen, setOpenByIdOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // #227: type 3 = GROUP_DM. A group stays a group no matter how many
  // recipients remain — Discord shows its custom name (when set) as the
  // primary label, so we do too.
  const isGroupDm = (dm: Channel) => dm.type === 3;

  const getDmName = (dm: Channel) => {
    if (isGroupDm(dm) && dm.name) {
      return dm.name;
    }
    if (dm.recipients && dm.recipients.length > 0) {
      return dm.recipients.map((r) => r.username).join(', ');
    }
    return isGroupDm(dm) ? 'Group DM' : 'Direct Message';
  };

  const getDmDisplayName = (dm: Channel) => {
    // Groups never borrow a single recipient's display name (#227) — that's
    // exactly how a dying group masquerades as a 1:1 DM.
    if (isGroupDm(dm)) return null;
    if (dm.recipients && dm.recipients.length === 1) {
      const r = dm.recipients[0];
      if (r.global_name && r.global_name !== r.username) return r.global_name;
    }
    return null;
  };

  // Member count shown on group rows: remaining recipients + you.
  const getGroupMemberCount = (dm: Channel) => (dm.recipients?.length ?? 0) + 1;

  const getDmLastActive = (dm: Channel): string | null => {
    const lastMsgId = dm.last_message_id;
    if (!lastMsgId) return null;
    try {
      const timestamp = new Date(Number(BigInt(lastMsgId) >> 22n) + 1420070400000).toISOString();
      return timeAgo(timestamp);
    } catch {
      return null;
    }
  };

  const filteredDMs = useMemo(() => {
    if (!filterText.trim()) return dms;

    const searchLower = filterText.toLowerCase().trim();
    return dms.filter((dm) => {
      // Match the custom group name AND member usernames — a named group's
      // primary label is its name (#227), but people still look for groups
      // by who's in them.
      if (getDmName(dm).toLowerCase().includes(searchLower)) return true;
      return (dm.recipients ?? []).some(
        (r) =>
          r.username?.toLowerCase().includes(searchLower) ||
          r.global_name?.toLowerCase().includes(searchLower),
      );
    });
  }, [dms, filterText]);

  const visible = filteredDMs.slice(0, visibleCount);

  // Fetch DMs on mount (ref prevents strict mode double-fetch)
  const dmsFetched = useRef(false);
  useEffect(() => {
    if (token && dms.length === 0 && !dmsFetched.current) {
      dmsFetched.current = true;
      dispatch(addStatusEntry({ level: 'info', message: 'Loading DMs...' }));
      dispatch(fetchDMs(token))
        .unwrap()
        .then((result) => {
          dispatch(addStatusEntry({ level: 'info', message: `Loaded ${result.length} conversation${result.length !== 1 ? 's' : ''}` }));
        })
        .catch(() => {
          // Error already handled by rejected case in dmSlice
        });
    }
  }, [dispatch, token, dms.length]);

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filterText]);

  // #218: Shift+Click range anchor — id of the last plainly-clicked row in
  // multi-select mode (see ChannelList for the pattern rationale).
  const rangeAnchorIdRef = useRef<string | null>(null);

  // Normal single-select navigation. Shared by row clicks and the
  // Open-DM-by-ID flow (#240) so a channel opened by ID lights up the
  // whole DM workflow exactly like a clicked row.
  const selectDmAndLoad = async (dm: Channel) => {
    if (!token) return;
    dispatch(setSelectedChannel(null));
    dispatch(clearMessages());
    dispatch(setSelectedDm(dm));
    dispatch(addStatusEntry({ level: 'info', message: `Loading conversation with ${getDmName(dm)}` }));

    await dispatch(
      fetchMessages({
        channelId: dm.id,
        token,
      })
    );
  };

  const handleDmClick = async (dm: Channel, event?: React.MouseEvent) => {
    if (!token) return;

    if (multiSelectMode) {
      if (event?.shiftKey && rangeAnchorIdRef.current) {
        const anchorIdx = visible.findIndex((d) => d.id === rangeAnchorIdRef.current);
        const clickIdx = visible.findIndex((d) => d.id === dm.id);
        if (anchorIdx !== -1 && clickIdx !== -1) {
          const [from, to] =
            anchorIdx <= clickIdx ? [anchorIdx, clickIdx] : [clickIdx, anchorIdx];
          dispatch(selectDmsInRange(visible.slice(from, to + 1)));
          return;
        }
      }
      dispatch(toggleDmSelection(dm));
      rangeAnchorIdRef.current = dm.id;
      return;
    }

    await selectDmAndLoad(dm);
  };

  // #240: fetch a closed/hidden DM by its channel ID, then select it like a
  // clicked row. Throws (via unwrap) on 403/404/non-DM so the dialog can
  // show its inline error. Message loading is intentionally NOT awaited:
  // the dialog should close as soon as the channel is confirmed.
  const handleOpenChannelById = async (channelId: string) => {
    if (!token) throw new Error('Not authenticated');
    const channel = await dispatch(fetchDmById({ channelId, token })).unwrap();
    dispatch(addStatusEntry({ level: 'info', message: `Opened DM channel ${channel.id} by ID` }));
    void selectDmAndLoad(channel);
  };

  const handleCopySelectedNames = () => {
    const names = selectedDms
      .map((dm) => getDmName(dm))
      .filter(Boolean)
      .join('\n');
    if (!names) return;
    navigator.clipboard.writeText(names);
    dispatch(showToast({ level: 'success', message: 'Copied to clipboard' }));
  };

  const handleToggleMultiSelect = () => {
    if (multiSelectMode) {
      dispatch(deselectAllDms());
    }
    rangeAnchorIdRef.current = null;
    setMultiSelectMode(!multiSelectMode);
  };

  const isDmSelected = (dm: Channel) =>
    selectedDms.some((d) => d.id === dm.id);

  if (isLoading) {
    return <ListSkeleton rows={6} avatar />;
  }

  // #240: empty states render BELOW the header instead of replacing the
  // whole component — the exact user who needs "Open DM by ID" (every DM
  // closed / hidden) would otherwise never see the affordance.
  const emptyState =
    filteredDMs.length === 0 ? (
      <EmptyState
        message={
          filterText.trim()
            ? `No DMs matching "${filterText}"`
            : 'No direct messages found'
        }
        icon={<MessageIcon />}
      />
    ) : null;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1 }}>
        <Typography
          variant="caption"
          sx={{
            flex: 1,
            color: 'text.secondary',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          Direct Messages
        </Typography>
        <Tooltip title="Open DM by ID">
          <IconButton
            size="small"
            aria-label="Open DM by ID"
            data-testid="open-dm-by-id-button"
            onClick={() => setOpenByIdOpen(true)}
            sx={{ mr: 0.5, color: 'text.secondary' }}
          >
            <TagIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <TourButton
          stepKey="multi-select-toggle"
          size="small"
          onClick={handleToggleMultiSelect}
          variant={multiSelectMode ? 'contained' : 'outlined'}
          color={multiSelectMode ? 'primary' : 'inherit'}
          aria-label="Toggle multi-select"
          data-tour="multi-select-toggle"
          startIcon={multiSelectMode ? <SelectModeIcon fontSize="small" /> : <SelectModeOffIcon fontSize="small" />}
          sx={{ textTransform: 'none', minWidth: 0, px: 1, fontSize: '0.75rem' }}
        >
          Multi-select
        </TourButton>
      </Box>

      {emptyState ?? (
        <>
      <MultiSelectControls
        active={multiSelectMode}
        selectedCount={selectedDms.length}
        totalCount={filteredDMs.length}
        allSelected={filteredDMs.length > 0 && selectedDms.length === filteredDMs.length}
        onToggleAll={() =>
          dispatch(
            filteredDMs.length > 0 && selectedDms.length === filteredDMs.length
              ? deselectAllDms()
              : selectAllDms(filteredDMs),
          )
        }
        onExport={() => setBulkExportOpen(true)}
        onPurge={() => setBulkPurgeOpen(true)}
        onEdit={() => setBulkEditOpen(true)}
        onCopyNames={handleCopySelectedNames}
        noun="conversations"
      />

      <Divider />
      <List>
        {visible.map((dm) => (
          <ListItemButton
            key={dm.id}
            selected={multiSelectMode ? isDmSelected(dm) : selectedDm?.id === dm.id}
            onClick={(e) => handleDmClick(dm, e)}
            // Shift+Click must not smear a text selection across rows (#218).
            onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
          >
            {multiSelectMode && (
              <Checkbox
                size="small"
                checked={isDmSelected(dm)}
                tabIndex={-1}
                disableRipple
                sx={{ p: 0, mr: 1 }}
              />
            )}
            <ListItemAvatar>
              <DmAvatar dm={dm} size={40} />
            </ListItemAvatar>
            <ListItemText
              primary={getDmDisplayName(dm) || getDmName(dm)}
              secondary={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {/* #227: groups are visually distinct from 1:1 DMs even
                      when only one (or zero) recipients remain. */}
                  {isGroupDm(dm) && (
                    <Typography
                      component="span"
                      variant="caption"
                      data-testid="group-dm-indicator"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: 'text.secondary', fontSize: '0.7rem', fontWeight: 600 }}
                    >
                      <GroupsIcon sx={{ fontSize: 13 }} />
                      Group · {getGroupMemberCount(dm)} member{getGroupMemberCount(dm) !== 1 ? 's' : ''}
                    </Typography>
                  )}
                  {/* A named group's primary label is its custom name, so
                      surface the members here — otherwise they appear
                      nowhere on the row. */}
                  {isGroupDm(dm) && dm.name && (dm.recipients?.length ?? 0) > 0 && (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ color: 'text.disabled', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
                    >
                      {dm.recipients!.map((r) => r.username).join(', ')}
                    </Typography>
                  )}
                  {getDmDisplayName(dm) && (
                    <Typography component="span" variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                      {getDmName(dm)}
                    </Typography>
                  )}
                  {getDmLastActive(dm) && (
                    <Typography component="span" variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                      {getDmLastActive(dm)}
                    </Typography>
                  )}
                </Box>
              }
              primaryTypographyProps={{
                noWrap: true,
                fontSize: '0.9rem',
              }}
            />
          </ListItemButton>
        ))}
      </List>
        </>
      )}

      <BulkExportDialog
        open={bulkExportOpen}
        onClose={() => setBulkExportOpen(false)}
        channels={selectedDms}
        mode="dms"
      />

      <BulkPurgeDialog
        open={bulkPurgeOpen}
        onClose={() => setBulkPurgeOpen(false)}
        channels={selectedDms}
        mode="dms"
      />

      <BulkEditDialog
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        channels={selectedDms}
        mode="dms"
      />

      <OpenDmByIdDialog
        open={openByIdOpen}
        onClose={() => setOpenByIdOpen(false)}
        onOpenChannel={handleOpenChannelById}
      />

    </Box>
  );
};

export default DMList;
