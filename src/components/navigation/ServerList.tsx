import { useEffect, useMemo, useState, useRef } from 'react';
import {
  List,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Box,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Folder as FolderIcon,
  ContentCopy as CopyIcon,
  Verified as VerifiedIcon,
  Star as OwnerIcon,
} from '@mui/icons-material';
import type { Guild } from 'discrub-core/types/discord-types';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectGuilds,
  selectSelectedGuild,
  selectGuildLoading,
  fetchGuilds,
  fetchCurrentMember,
  fetchRoles,
  setSelectedGuild,
} from '@features/guild/guildSlice';
import { fetchChannels, setSelectedChannel } from '@features/channel/channelSlice';
import { clearMessages } from '@features/message/messageSlice';
import { addStatusEntry, showToast } from '@features/status/statusSlice';
import { selectAuthToken } from '@features/auth/authSlice';
import ListSkeleton from '@components/ui/ListSkeleton';
import EmptyState from '@components/ui/EmptyState';

const PAGE_SIZE = 50;

interface ServerListProps {
  filterText?: string;
}

/**
 * ServerList component - displays all guilds/servers
 */
const ServerList = ({ filterText = '' }: ServerListProps) => {
  const dispatch = useAppDispatch();
  const guilds = useAppSelector(selectGuilds);
  const selectedGuild = useAppSelector(selectSelectedGuild);
  const isLoading = useAppSelector(selectGuildLoading);
  const token = useAppSelector(selectAuthToken);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Filter guilds by name
  const filteredGuilds = useMemo(() => {
    if (!filterText.trim()) return guilds;

    const searchLower = filterText.toLowerCase().trim();
    return guilds.filter((guild) =>
      guild.name?.toLowerCase().includes(searchLower)
    );
  }, [guilds, filterText]);

  const visible = filteredGuilds.slice(0, visibleCount);

  // Fetch guilds on mount (ref prevents strict mode double-fetch)
  const guildsFetched = useRef(false);
  useEffect(() => {
    if (token && guilds.length === 0 && !guildsFetched.current) {
      guildsFetched.current = true;
      dispatch(addStatusEntry({ level: 'info', message: 'Loading servers...' }));
      dispatch(fetchGuilds(token))
        .unwrap()
        .then((result) => {
          dispatch(addStatusEntry({ level: 'info', message: `Loaded ${result.length} server${result.length !== 1 ? 's' : ''}` }));
        })
        .catch(() => {
          // Error already handled by rejected case in guildSlice
        });
    }
  }, [dispatch, token, guilds.length]);

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filterText]);

  // Scroll-to-load: listen on nearest scrollable ancestor
  useEffect(() => {
    if (visibleCount >= filteredGuilds.length) return;

    const handleScroll = () => {
      const scrollEl = document.querySelector('[data-server-scroll]');
      if (!scrollEl) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      if (scrollHeight - scrollTop - clientHeight < 100) {
        setVisibleCount((prev) => prev + PAGE_SIZE);
      }
    };

    const scrollEl = document.querySelector('[data-server-scroll]');
    scrollEl?.addEventListener('scroll', handleScroll);
    return () => scrollEl?.removeEventListener('scroll', handleScroll);
  }, [visibleCount, filteredGuilds.length]);

  const handleGuildClick = async (guild: Guild) => {
    if (!token) return;

    // Clear previous server's state before loading new server
    dispatch(setSelectedChannel(null));
    dispatch(clearMessages());
    dispatch(setSelectedGuild(guild));
    dispatch(addStatusEntry({ level: 'info', message: `Loading server: ${guild.name}` }));
    // Fetch channels, current member roles, and guild roles in parallel
    dispatch(fetchCurrentMember({ guildId: guild.id, token }));
    dispatch(fetchRoles({ guildId: guild.id, token }));
    await dispatch(fetchChannels({ guildId: guild.id, token }));
  };

  const handleCopyNames = () => {
    const names = filteredGuilds
      .map((guild) => guild.name)
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(names);
    dispatch(showToast({ level: 'success', message: 'Copied to clipboard' }));
  };

  if (isLoading) {
    return <ListSkeleton rows={6} avatar />;
  }

  if (filteredGuilds.length === 0 && filterText.trim()) {
    return <EmptyState message={`No servers matching "${filterText}"`} icon={<FolderIcon />} />;
  }

  if (filteredGuilds.length === 0) {
    return <EmptyState message="No servers found" icon={<FolderIcon />} />;
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
          Servers
        </Typography>
        <Tooltip title="Copy server names">
          <IconButton
            size="small"
            onClick={handleCopyNames}
            aria-label="Copy server names"
          >
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <List>
        {visible.map((guild) => (
          <ListItemButton
            key={guild.id}
            selected={selectedGuild?.id === guild.id}
            onClick={() => handleGuildClick(guild)}
            sx={{
              transition: 'opacity 200ms ease',
              ...(selectedGuild && selectedGuild.id !== guild.id && {
                opacity: 0.4,
                '&:hover': {
                  opacity: 0.6,
                },
              }),
            }}
          >
            <ListItemAvatar>
              <Avatar
                src={
                  guild.icon
                    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                    : undefined
                }
                sx={{ width: 40, height: 40 }}
              >
                {guild.name?.[0]?.toUpperCase()}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" noWrap sx={{ fontSize: '0.9rem' }}>
                    {guild.name}
                  </Typography>
                  {guild.owner && (
                    <Tooltip title="You own this server" enterDelay={0} arrow>
                      <OwnerIcon sx={{ fontSize: 13, color: '#ffd700', flexShrink: 0 }} />
                    </Tooltip>
                  )}
                  {guild.features?.includes('VERIFIED') && (
                    <Tooltip title="Verified server" enterDelay={0} arrow>
                      <VerifiedIcon sx={{ fontSize: 13, color: 'primary.main', flexShrink: 0 }} />
                    </Tooltip>
                  )}
                  {guild.features?.includes('PARTNERED') && !guild.features?.includes('VERIFIED') && (
                    <Tooltip title="Partnered server" enterDelay={0} arrow>
                      <VerifiedIcon sx={{ fontSize: 13, color: 'text.disabled', flexShrink: 0 }} />
                    </Tooltip>
                  )}
                </Box>
              }
            />
          </ListItemButton>
        ))}
      </List>

    </Box>
  );
};

export default ServerList;
