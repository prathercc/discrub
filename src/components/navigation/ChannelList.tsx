import { useMemo, useState } from 'react';
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Button,
  Typography,
  Divider,
  IconButton,
  Chip,
  Checkbox,
  Tooltip,
} from '@mui/material';
import {
  Tag as TextChannelIcon,
  VolumeUp as VoiceChannelIcon,
  Forum as ForumIcon,
  Folder as CategoryIcon,
  CheckBox as SelectModeIcon,
  CheckBoxOutlineBlank as SelectModeOffIcon,
  SelectAll as SelectAllIcon,
  Download as DownloadIcon,
  DeleteSweep as PurgeIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as CollapseIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import type { Channel } from 'discrub-core/types/discord-types';
import { ChannelType } from 'discrub-core/discord-enum';
import TourSpot from '@components/welcome/TourSpot';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectChannels,
  selectSelectedChannel,
  selectChannelLoading,
  selectSelectedChannels,
  setSelectedChannel,
  toggleChannelSelection,
  selectAllChannels,
  deselectAllChannels,
  fetchForumThreads,
} from '@features/channel/channelSlice';
import { selectSelectedGuild, selectCurrentMemberRoles } from '@features/guild/guildSlice';
import { canAccessChannel, canManageMessages } from '@/utils/permissionUtils';
import { selectAuthToken } from '@features/auth/authSlice';
import { fetchMessages, clearMessages } from '@features/message/messageSlice';
import { addStatusEntry, showToast } from '@features/status/statusSlice';
import { setSelectedDm } from '@features/dm/dmSlice';
import ListSkeleton from '@components/ui/ListSkeleton';
import EmptyState from '@components/ui/EmptyState';
import BulkExportDialog from '@containers/ExportView/BulkExportDialog';
import BulkPurgeDialog from '@containers/PurgeView/BulkPurgeDialog';

interface ChannelListProps {
  filterText?: string;
}

/**
 * ChannelList component - displays channels for selected guild
 */
const ChannelList = ({ filterText = '' }: ChannelListProps) => {
  const dispatch = useAppDispatch();
  const channels = useAppSelector(selectChannels);
  const selectedChannel = useAppSelector(selectSelectedChannel);
  const selectedChannels = useAppSelector(selectSelectedChannels);
  const selectedGuild = useAppSelector(selectSelectedGuild);
  const memberRoles = useAppSelector(selectCurrentMemberRoles);
  const isLoading = useAppSelector(selectChannelLoading);
  const token = useAppSelector(selectAuthToken);
  const guildPermissions = selectedGuild?.permissions;

  // Guild-level MANAGE_MESSAGES check (ignoring per-channel overwrites — conservative for multi-channel ops)
  const hasManageMessages = useMemo(() => {
    if (!selectedGuild?.id || !guildPermissions) return false;
    const dummyChannel = { id: '', type: 0 } as import('discrub-core/types/discord-types').Channel;
    return canManageMessages(guildPermissions, memberRoles, dummyChannel, selectedGuild.id);
  }, [guildPermissions, memberRoles, selectedGuild?.id]);

  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [bulkExportOpen, setBulkExportOpen] = useState(false);
  const [bulkPurgeOpen, setBulkPurgeOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const handleChannelClick = async (channel: Channel) => {
    if (!token || !selectedGuild) return;

    // Only allow channels that contain fetchable messages
    const messageChannelTypes = [
      ChannelType.GUILD_TEXT,
      ChannelType.GUILD_ANNOUNCEMENT,
      ChannelType.GUILD_FORUM,
      ChannelType.GUILD_MEDIA,
    ];
    if (!messageChannelTypes.includes(channel.type)) {
      return;
    }

    if (multiSelectMode) {
      dispatch(toggleChannelSelection(channel));
      return;
    }

    // Normal single-select navigation
    dispatch(setSelectedDm(null));
    dispatch(clearMessages());
    dispatch(setSelectedChannel(channel));
    const isForumType = channel.type === ChannelType.GUILD_FORUM || channel.type === ChannelType.GUILD_MEDIA;
    dispatch(addStatusEntry({ level: 'info', message: `Loading ${isForumType ? 'forum posts' : 'messages'} for #${channel.name}` }));

    // Forum/media channels: fetch threads instead of messages
    if (isForumType) {
      await dispatch(
        fetchForumThreads({
          channelId: channel.id,
          token,
        })
      );
    } else {
      await dispatch(
        fetchMessages({
          guildId: selectedGuild.id,
          channelId: channel.id,
          token,
        })
      );
    }
  };

  const handleCopyNames = () => {
    const names = filteredChannels
      .map((ch) => ch.name)
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(names);
    dispatch(showToast({ level: 'success', message: 'Copied to clipboard' }));
  };

  const handleToggleMultiSelect = () => {
    if (multiSelectMode) {
      dispatch(deselectAllChannels());
    }
    setMultiSelectMode(!multiSelectMode);
  };

  const getChannelIcon = (type: ChannelType) => {
    switch (type) {
      case ChannelType.GUILD_TEXT:
      case ChannelType.GUILD_ANNOUNCEMENT:
        return <TextChannelIcon fontSize="small" />;
      case ChannelType.GUILD_VOICE:
      case ChannelType.GUILD_STAGE_VOICE:
        return <VoiceChannelIcon fontSize="small" />;
      case ChannelType.GUILD_FORUM:
      case ChannelType.GUILD_MEDIA:
        return <ForumIcon fontSize="small" />;
      case ChannelType.GUILD_CATEGORY:
        return <CategoryIcon fontSize="small" />;
      default:
        return <TextChannelIcon fontSize="small" />;
    }
  };

  // Channel types that support fetching messages
  const messageChannelTypes = [
    ChannelType.GUILD_TEXT,
    ChannelType.GUILD_ANNOUNCEMENT,
    ChannelType.GUILD_FORUM,
    ChannelType.GUILD_MEDIA,
  ];

  // Channel types to display (includes voice for visibility, but they'll be disabled)
  const displayChannelTypes = [
    ...messageChannelTypes,
    ChannelType.GUILD_VOICE,
    ChannelType.GUILD_STAGE_VOICE,
  ];
  const textChannels = channels.filter((ch) => displayChannelTypes.includes(ch.type));

  const filteredChannels = useMemo(() => {
    if (!filterText.trim()) return textChannels;

    const searchLower = filterText.toLowerCase().trim();
    return textChannels.filter((channel) =>
      channel.name?.toLowerCase().includes(searchLower)
    );
  }, [textChannels, filterText]);

  // Build category map from all channels (including type 4 categories)
  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    channels.forEach((ch) => {
      if (ch.type === ChannelType.GUILD_CATEGORY) {
        map[ch.id] = ch.name || 'Unknown Category';
      }
    });
    return map;
  }, [channels]);

  // Group filtered channels by category
  const groupedChannels = useMemo(() => {
    const groups: { categoryId: string | null; categoryName: string; channels: Channel[] }[] = [];
    const byCategory: Record<string, Channel[]> = {};
    const uncategorized: Channel[] = [];

    filteredChannels.forEach((ch) => {
      const parentId = (ch as any).parent_id;
      if (parentId && categoryMap[parentId]) {
        if (!byCategory[parentId]) byCategory[parentId] = [];
        byCategory[parentId].push(ch);
      } else {
        uncategorized.push(ch);
      }
    });

    // Add uncategorized channels first
    if (uncategorized.length > 0) {
      groups.push({ categoryId: null, categoryName: '', channels: uncategorized });
    }

    // Add categorized groups sorted by category position
    const categoryOrder = channels
      .filter((ch) => ch.type === ChannelType.GUILD_CATEGORY)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    categoryOrder.forEach((cat) => {
      if (byCategory[cat.id] && byCategory[cat.id].length > 0) {
        groups.push({
          categoryId: cat.id,
          categoryName: categoryMap[cat.id],
          channels: byCategory[cat.id].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
        });
      }
    });

    return groups;
  }, [filteredChannels, categoryMap, channels]);

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  if (!selectedGuild) {
    return <EmptyState message="Select a server to view channels" icon="📁" />;
  }

  if (isLoading) {
    return <ListSkeleton rows={8} icon />;
  }

  if (channels.length === 0) {
    return <EmptyState message="No channels found" icon={<TextChannelIcon />} />;
  }

  if (filteredChannels.length === 0 && filterText.trim()) {
    return (
      <Box>
        <Typography
          variant="caption"
          sx={{
            px: 2,
            py: 1,
            display: 'block',
            color: 'text.secondary',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {selectedGuild.name}
        </Typography>
        <Divider />
        <EmptyState
          message={`No channels matching "${filterText}"`}
          icon={<TextChannelIcon />}
        />
      </Box>
    );
  }

  const isChannelSelected = (channel: Channel) =>
    selectedChannels.some((c) => c.id === channel.id);

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
          {selectedGuild.name}
        </Typography>
        <Tooltip title="Copy channel names">
          <IconButton
            size="small"
            onClick={handleCopyNames}
            aria-label="Copy channel names"
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
          {multiSelectMode ? 'Done' : 'Multi-select'}
        </Button>
        <TourSpot stepKey="multi-select-toggle" size="compact" placement="bottom" />
      </Box>

      {multiSelectMode && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 2, pb: 1, flexWrap: 'wrap' }}>
          <Chip
            label={`${selectedChannels.length} selected`}
            size="small"
            color={selectedChannels.length > 0 ? 'primary' : 'default'}
          />
          <Button
            size="small"
            onClick={() => {
              const accessibleChannels = filteredChannels.filter((ch) => {
                const isVoice = ch.type === ChannelType.GUILD_VOICE || ch.type === ChannelType.GUILD_STAGE_VOICE;
                return !isVoice && canAccessChannel(guildPermissions, memberRoles, ch, selectedGuild?.id || '');
              });
              dispatch(selectedChannels.length === accessibleChannels.length && accessibleChannels.length > 0 ? deselectAllChannels() : selectAllChannels(accessibleChannels));
            }}
            aria-label={selectedChannels.length > 0 ? 'Deselect all channels' : 'Select all channels'}
            startIcon={<SelectAllIcon fontSize="small" />}
            sx={{ textTransform: 'none', minWidth: 0, px: 1, fontSize: '0.72rem' }}
          >
            {selectedChannels.length > 0 && selectedChannels.length === filteredChannels.length ? 'Deselect all' : 'Select all'}
          </Button>
          {selectedChannels.length > 0 && (
            <>
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={() => setBulkExportOpen(true)}
                aria-label="Export selected channels"
                startIcon={<DownloadIcon fontSize="small" />}
                sx={{ textTransform: 'none', minWidth: 0, px: 1, fontSize: '0.72rem' }}
              >
                Export
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={() => setBulkPurgeOpen(true)}
                aria-label="Purge selected channels"
                startIcon={<PurgeIcon fontSize="small" />}
                sx={{ textTransform: 'none', minWidth: 0, px: 1, fontSize: '0.72rem' }}
              >
                Purge
              </Button>
            </>
          )}
        </Box>
      )}

      <Divider />
      <List dense>
        {groupedChannels.map((group) => (
          <Box key={group.categoryId || '__uncategorized__'}>
            {group.categoryId && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 1,
                  pt: 1.5,
                  pb: 0.25,
                  cursor: 'pointer',
                  '&:hover': { color: 'text.primary' },
                  color: 'text.secondary',
                }}
                onClick={() => toggleCategory(group.categoryId!)}
              >
                {collapsedCategories.has(group.categoryId) ? (
                  <CollapseIcon sx={{ fontSize: 14, mr: 0.25 }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 14, mr: 0.25 }} />
                )}
                <Typography
                  variant="caption"
                  sx={{
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    letterSpacing: '0.02em',
                  }}
                >
                  {group.categoryName}
                </Typography>
              </Box>
            )}
            {(!group.categoryId || !collapsedCategories.has(group.categoryId)) &&
              group.channels.map((channel) => {
                const isVoiceChannel = channel.type === ChannelType.GUILD_VOICE || channel.type === ChannelType.GUILD_STAGE_VOICE;
                const hasAccess = !isVoiceChannel && canAccessChannel(
                  guildPermissions,
                  memberRoles,
                  channel,
                  selectedGuild?.id || '',
                );

                return (
                <ListItemButton
                  key={channel.id}
                  selected={multiSelectMode ? isChannelSelected(channel) : selectedChannel?.id === channel.id}
                  onClick={() => hasAccess && handleChannelClick(channel)}
                  disabled={!hasAccess}
                  sx={{
                    ...(!hasAccess && {
                      opacity: 0.4,
                      cursor: 'default',
                    }),
                  }}
                >
                  {multiSelectMode && hasAccess && (
                    <Checkbox
                      size="small"
                      checked={isChannelSelected(channel)}
                      tabIndex={-1}
                      disableRipple
                      sx={{ p: 0, mr: 1 }}
                    />
                  )}
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {hasAccess ? getChannelIcon(channel.type) : <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
                  </ListItemIcon>
                  <ListItemText
                    primary={channel.name}
                    primaryTypographyProps={{
                      noWrap: true,
                      fontSize: '0.875rem',
                    }}
                  />
                </ListItemButton>
                );
              })}
          </Box>
        ))}
      </List>

      <BulkExportDialog
        open={bulkExportOpen}
        onClose={() => setBulkExportOpen(false)}
        channels={selectedChannels}
        mode="channels"
        guildId={selectedGuild.id}
      />

      <BulkPurgeDialog
        open={bulkPurgeOpen}
        onClose={() => setBulkPurgeOpen(false)}
        channels={selectedChannels}
        mode="channels"
        guildId={selectedGuild.id}
        canManageMessages={hasManageMessages}
      />

    </Box>
  );
};

export default ChannelList;
