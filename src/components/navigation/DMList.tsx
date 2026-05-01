import { useEffect, useMemo, useState, useRef } from 'react';
import {
  List,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Box,
  Button,
  Typography,
  IconButton,
  Checkbox,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Message as MessageIcon,
  CheckBox as SelectModeIcon,
  CheckBoxOutlineBlank as SelectModeOffIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import MultiSelectControls from './MultiSelectControls';
import type { Channel } from 'discrub-core/types/discord-types';
import TourSpot from '@components/welcome/TourSpot';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectDMs,
  selectSelectedDm,
  selectDmLoading,
  selectSelectedDms,
  fetchDMs,
  setSelectedDm,
  toggleDmSelection,
  selectAllDms,
  deselectAllDms,
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

const PAGE_SIZE = 50;

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const getDmName = (dm: Channel) => {
    if (dm.recipients && dm.recipients.length > 0) {
      return dm.recipients.map((r) => r.username).join(', ');
    }
    return 'Direct Message';
  };

  const getDmDisplayName = (dm: Channel) => {
    if (dm.recipients && dm.recipients.length === 1) {
      const r = dm.recipients[0];
      if (r.global_name && r.global_name !== r.username) return r.global_name;
    }
    return null;
  };

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

  const getDmAvatar = (dm: Channel) => {
    if (dm.recipients && dm.recipients.length > 0) {
      const recipient = dm.recipients[0];
      if (recipient.avatar) {
        return `https://cdn.discordapp.com/avatars/${recipient.id}/${recipient.avatar}.png`;
      }
    }
    return undefined;
  };

  const filteredDMs = useMemo(() => {
    if (!filterText.trim()) return dms;

    const searchLower = filterText.toLowerCase().trim();
    return dms.filter((dm) => {
      const dmName = getDmName(dm);
      return dmName.toLowerCase().includes(searchLower);
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

  const handleDmClick = async (dm: Channel) => {
    if (!token) return;

    if (multiSelectMode) {
      dispatch(toggleDmSelection(dm));
      return;
    }

    // Normal single-select navigation
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

  const handleCopyNames = () => {
    const names = filteredDMs
      .map((dm) => getDmName(dm))
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(names);
    dispatch(showToast({ level: 'success', message: 'Copied to clipboard' }));
  };

  const handleToggleMultiSelect = () => {
    if (multiSelectMode) {
      dispatch(deselectAllDms());
    }
    setMultiSelectMode(!multiSelectMode);
  };

  const isDmSelected = (dm: Channel) =>
    selectedDms.some((d) => d.id === dm.id);

  if (isLoading) {
    return <ListSkeleton rows={6} avatar />;
  }

  if (filteredDMs.length === 0 && filterText.trim()) {
    return <EmptyState message={`No DMs matching "${filterText}"`} icon={<MessageIcon />} />;
  }

  if (filteredDMs.length === 0) {
    return <EmptyState message="No direct messages found" icon={<MessageIcon />} />;
  }

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
        <Tooltip title="Copy DM names">
          <IconButton
            size="small"
            onClick={handleCopyNames}
            aria-label="Copy DM names"
          >
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          onClick={handleToggleMultiSelect}
          variant={multiSelectMode ? 'contained' : 'text'}
          color={multiSelectMode ? 'primary' : 'inherit'}
          aria-label="Toggle multi-select"
          data-tour="multi-select-toggle"
          startIcon={multiSelectMode ? <SelectModeIcon fontSize="small" /> : <SelectModeOffIcon fontSize="small" />}
          sx={{ textTransform: 'none', minWidth: 0, px: 1, fontSize: '0.75rem' }}
        >
          Multi-select
        </Button>
        <TourSpot stepKey="multi-select-toggle" size="compact" placement="bottom" />
      </Box>

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
        noun="conversations"
      />

      <Divider />
      <List>
        {visible.map((dm) => (
          <ListItemButton
            key={dm.id}
            selected={multiSelectMode ? isDmSelected(dm) : selectedDm?.id === dm.id}
            onClick={() => handleDmClick(dm)}
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
              <Avatar src={getDmAvatar(dm)} sx={{ width: 40, height: 40 }}>
                {getDmName(dm)?.[0]?.toUpperCase()}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={getDmDisplayName(dm) || getDmName(dm)}
              secondary={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
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

    </Box>
  );
};

export default DMList;
