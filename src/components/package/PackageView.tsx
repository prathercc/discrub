import { useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import {
  Archive as ArchiveIcon,
  ArrowBack as ArrowBackIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  clearPackageDeletedCache,
  resetPackage,
  resumeStoredPackage,
  selectChannelDeletedMessageCount,
  selectPackageChannel,
  selectPackageDeletedMessageCount,
  selectPackageValidation,
  selectParsedPackage,
  selectSelectedPackageChannelId,
  selectTotalDeletedMessageCount,
} from '@features/package/packageSlice';
import { selectCurrentUser } from '@features/user/userSlice';
import { selectGuilds } from '@features/guild/guildSlice';
import { getPackageChannelLabel } from '@features/package/packageDisplayUtils';
import ImportDialog from './ImportDialog';
import PackageAnalytics from './PackageAnalytics';
import PackageMessageTable from './PackageMessageTable';

/**
 * Main-pane view shown when the "Package" sidebar tab is active.
 *
 * - No package loaded → import prompt + ImportDialog.
 * - Package loaded, no channel selected → summary + analytics.
 * - Package loaded, channel selected → channel header + PackageMessageTable.
 */
function pluralize(count: number, singular: string): string {
  const word = count === 1 ? singular : `${singular}s`;
  return `${count.toLocaleString()} ${word}`;
}

const PackageView = () => {
  const dispatch = useAppDispatch();
  const parsed = useAppSelector(selectParsedPackage);
  const validation = useAppSelector(selectPackageValidation);
  const selectedChannelId = useAppSelector(selectSelectedPackageChannelId);
  const liveGuilds = useAppSelector(selectGuilds);
  const totalDeleted = useAppSelector(selectTotalDeletedMessageCount);
  // #236: live remaining counts. Archive counts (pkg:meta) are static;
  // deletions made through Discrub are subtracted at display time only.
  const packageDeleted = useAppSelector(selectPackageDeletedMessageCount);
  const selectedChannelDeleted = useAppSelector(
    selectChannelDeletedMessageCount(selectedChannelId ?? ''),
  );
  const currentUserId = useAppSelector(selectCurrentUser)?.id ?? null;
  const [dialogOpen, setDialogOpen] = useState(false);

  // Resume a previously-streamed package automatically (#162). The
  // thunk no-ops when nothing matches the authenticated user, so this
  // is safe to fire on every mount and on auth changes.
  useEffect(() => {
    if (parsed) return;
    if (!currentUserId) return;
    void dispatch(resumeStoredPackage());
  }, [dispatch, parsed, currentUserId]);

  const leftGuilds = useMemo(() => {
    if (!parsed || !liveGuilds) return [];
    const live = new Set(liveGuilds.map((g) => g.id));
    return parsed.guilds.filter((g) => !live.has(g.id));
  }, [parsed, liveGuilds]);

  const selectedChannel = useMemo(
    () => parsed?.channels.find((c) => c.id === selectedChannelId) ?? null,
    [parsed, selectedChannelId],
  );

  if (!parsed) {
    return (
      <>
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
            gap: 2,
          }}
        >
          <ArchiveIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
          <Typography variant="h5">Import a Discord Data Package</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, textAlign: 'center' }}>
            Analyze your message history, delete old messages using IDs from
            the package, or convert it into a Discrub HTML export. Processing
            happens entirely in your browser.
          </Typography>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ mt: 1 }}
          >
            Choose ZIP file
          </Button>
        </Box>
        <ImportDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </>
    );
  }

  if (selectedChannel) {
    const remainingCount = Math.max(
      selectedChannel.messageCount - selectedChannelDeleted,
      0,
    );
    const caption = selectedChannel.isOrphan
      ? 'Messages from a server you are no longer in'
      : selectedChannel.guildName
        ? `${selectedChannel.guildName} · ${remainingCount.toLocaleString()} messages`
        : `${remainingCount.toLocaleString()} messages`;
    const captionNode = (
      <Typography variant="caption" color="text.secondary" noWrap>
        {caption}
      </Typography>
    );
    return (
      <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <IconButton
            aria-label="Back to analytics"
            size="small"
            onClick={() => dispatch(selectPackageChannel(null))}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {getPackageChannelLabel(selectedChannel)}
            </Typography>
            {selectedChannelDeleted > 0 && !selectedChannel.isOrphan ? (
              <Tooltip
                title={`${selectedChannel.messageCount.toLocaleString()} in package, ${selectedChannelDeleted.toLocaleString()} deleted via Discrub`}
              >
                {captionNode}
              </Tooltip>
            ) : (
              captionNode
            )}
          </Box>
          {selectedChannel.isOrphan && (
            <Chip label="Read only — left server" size="small" color="warning" variant="outlined" />
          )}
        </Stack>

        <PackageMessageTable channel={selectedChannel} />
      </Box>
    );
  }

  const { user, channels, guilds, totalMessages } = parsed;
  const orphanCount = channels.filter((c) => c.isOrphan).length;
  const dmCount = channels.filter((c) => c.type === 1 || c.type === 3).length;
  const nonEmptyChannels = channels.filter((c) => c.messageCount > 0).length;
  const channelsChipLabel =
    channels.length === nonEmptyChannels
      ? pluralize(channels.length, 'channel')
      : `${nonEmptyChannels.toLocaleString()} of ${channels.length.toLocaleString()} channels`;

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Avatar
          src={parsed.avatarBlobUrl}
          sx={{ width: 64, height: 64 }}
          alt={user.username}
        >
          {user.username.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5">{user.globalName ?? user.username}</Typography>
          <Typography variant="body2" color="text.secondary">
            @{user.username} · ID {user.id}
          </Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={() => dispatch(resetPackage())}>
          Close package
        </Button>
      </Stack>

      {validation?.warnings.map((w, i) => (
        <Alert key={i} severity="warning" sx={{ mb: 1 }}>
          {w}
        </Alert>
      ))}

      {leftGuilds.length > 0 && (
        <Alert severity="info" sx={{ mb: 1 }}>
          You are no longer in {leftGuilds.length} server
          {leftGuilds.length === 1 ? '' : 's'} from this package ({leftGuilds
            .map((g) => g.name)
            .slice(0, 3)
            .join(', ')}
          {leftGuilds.length > 3 ? `, +${leftGuilds.length - 3} more` : ''}).
          Messages from those channels are read-only.
        </Alert>
      )}

      {parsed.isLegacyFormat && (
        <Alert severity="info" sx={{ mb: 1 }}>
          This package predates Discord's 2025 export format change. Some
          attachment links may have already expired. Rehydrate before
          export to refresh URLs and bundle media locally.
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
        {packageDeleted > 0 ? (
          <Tooltip
            title={`${totalMessages.toLocaleString()} in package, ${packageDeleted.toLocaleString()} deleted via Discrub`}
          >
            <Chip
              label={pluralize(Math.max(totalMessages - packageDeleted, 0), 'message')}
            />
          </Tooltip>
        ) : (
          <Chip label={pluralize(totalMessages, 'message')} />
        )}
        <Chip label={channelsChipLabel} />
        <Chip label={pluralize(guilds.length, 'server')} />
        <Chip label={`${dmCount} ${dmCount === 1 ? 'DM' : 'DMs'}`} />
        {orphanCount > 0 && (
          <Chip
            label={`${orphanCount} from ${orphanCount === 1 ? 'a left server' : 'left servers'}`}
            color="warning"
            variant="outlined"
          />
        )}
        {totalDeleted > 0 && (
          <Chip
            label={`${totalDeleted.toLocaleString()} previously deleted`}
            variant="outlined"
            onDelete={() => dispatch(clearPackageDeletedCache())}
            title="Clear the deleted-message history for this user"
          />
        )}
      </Stack>

      <PackageAnalytics />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
        Select a channel from the sidebar to browse its messages.
      </Typography>
    </Box>
  );
};

export default PackageView;
