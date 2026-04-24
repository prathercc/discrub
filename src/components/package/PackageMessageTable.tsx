import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Link,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import type { Theme } from '@mui/material';
import { formatContentAsHtml } from 'discrub-core/html-formatting-utils';
import type { HtmlFormattingContext } from 'discrub-core/types/html-formatting-types';
import {
  AutoAwesome as EnrichedIcon,
  DeleteForever as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  InsertDriveFile as AttachmentIcon,
  Refresh as RefreshIcon,
  Reply as ReplyIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  applyLocalMessageEdits,
  clearChannelMessageSelection,
  deletePackageMessages,
  dismissDeleteResult,
  enrichPackageChannel,
  hydrateCachedEnrichment,
  loadPackageChannelMessages,
  selectAllChannelMessages,
  selectActiveEnrichmentChannelId,
  selectChannelDeletedMessageIds,
  selectChannelEnrichedMessages,
  selectChannelEnrichmentLastFetched,
  selectChannelEnrichmentMisses,
  selectChannelEnrichmentProgress,
  selectChannelEnrichmentStatus,
  selectChannelSelectedMessageIds,
  selectDeleteError,
  selectDeleteProgress,
  selectDeleteResult,
  selectDeleteStatus,
  selectIsPackageChannelLoading,
  selectIsPackageReadOnly,
  selectPackageChannelMessages,
  selectPackageExportStatus,
  selectParsedPackage,
  toggleMessageSelection,
  type EnrichmentStatus,
} from '@features/package/packageSlice';
import { selectSearchDelay } from '@features/app/appSlice';
import { setDiscrubCancelled } from '@features/app/appSlice';
import { selectIsHeavyOperationRunning } from '@features/app/operationSelectors';
import type { Message } from 'discrub-core/types/discord-types';
import { selectAuthToken } from '@features/auth/authSlice';
import { editMessages } from '@features/message/messageSlice';
import { toDiscordMessage } from '@features/package/packageMessageAdapter';
import type {
  PackageChannel,
  PackageMessage,
} from '@features/package/packageTypes';
import { parseDiscordTimestamp } from '@/utils/packageAnalyticsUtils';
import EditMessageModal from '@components/modals/EditMessageModal';
import ExportDialog from '@containers/ExportView/ExportDialog';

interface PackageMessageTableProps {
  channel: PackageChannel;
}

const PackageMessageTable = ({ channel }: PackageMessageTableProps) => {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const parsed = useAppSelector(selectParsedPackage);
  const messages = useAppSelector(selectPackageChannelMessages(channel.id));
  const deletedIds = useAppSelector(selectChannelDeletedMessageIds(channel.id));
  const isLoading = useAppSelector(selectIsPackageChannelLoading);
  const selectedIds = useAppSelector(selectChannelSelectedMessageIds(channel.id));
  const readOnly = useAppSelector(selectIsPackageReadOnly);
  const token = useAppSelector(selectAuthToken);
  const deleteStatus = useAppSelector(selectDeleteStatus);
  const deleteResult = useAppSelector(selectDeleteResult);
  const deleteProgress = useAppSelector(selectDeleteProgress);
  const deleteError = useAppSelector(selectDeleteError);
  const exportStatus = useAppSelector(selectPackageExportStatus);
  const enrichedMap = useAppSelector(selectChannelEnrichedMessages(channel.id));
  const enrichmentMisses = useAppSelector(selectChannelEnrichmentMisses(channel.id));
  const enrichmentStatus = useAppSelector(selectChannelEnrichmentStatus(channel.id));
  const enrichmentProgress = useAppSelector(selectChannelEnrichmentProgress(channel.id));
  const enrichmentLastFetched = useAppSelector(
    selectChannelEnrichmentLastFetched(channel.id),
  );
  const activeEnrichmentChannelId = useAppSelector(selectActiveEnrichmentChannelId);
  const searchDelay = useAppSelector(selectSearchDelay);
  const isHeavyOpRunning = useAppSelector(selectIsHeavyOperationRunning);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (messages === undefined) {
      void dispatch(loadPackageChannelMessages(channel.id));
    }
  }, [channel.id, messages, dispatch]);

  /**
   * Cache-only hydrate: if the user has previously rehydrated this
   * channel, surface those results immediately when they return so
   * they see "Refresh" rather than a cold "Rehydrate" button. The
   * thunk is a cheap IDB read when a cache exists, and a no-op when
   * it doesn't — so no API traffic is generated here.
   */
  useEffect(() => {
    if (enrichmentStatus === 'idle') {
      void dispatch(hydrateCachedEnrichment({ channelId: channel.id }));
    }
  }, [channel.id, enrichmentStatus, dispatch]);

  /**
   * Messages that the user previously deleted (or that Discord returned
   * 404 for during delete / enrichment) stay visible in the table but
   * render with the `gone` visual treatment (see `MessageKindChip` and
   * the row-level warning tint). This preserves source context and
   * makes "what happened to this message" glanceable — unlike hiding,
   * which silently removed rows and left users confused.
   */
  const sorted = useMemo(() => {
    if (!messages) return [];
    return [...messages].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [messages]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  /**
   * Formatting context for Discord content rendering. Tier 1: only the
   * package owner and known package channels resolve — other mentions
   * fall back to "Unknown User" / "unknown-channel". Tier 2: once
   * rehydrated, every `mentions: User[]` array from live messages
   * contributes to the userMap, so named mention chips resolve to
   * display names instead of placeholder text.
   */
  const formattingContext: HtmlFormattingContext = useMemo(() => {
    const userMap: Record<string, { userName?: string; displayName?: string }> = {};
    if (parsed?.user) {
      userMap[parsed.user.id] = {
        userName: parsed.user.username,
        displayName: parsed.user.globalName ?? parsed.user.username,
      };
    }
    // Pull named users from enriched message `mentions` arrays and
    // authors of referenced (reply-target) messages.
    if (enrichedMap) {
      Object.values(enrichedMap).forEach((live) => {
        live.mentions?.forEach((u) => {
          if (u?.id && !userMap[u.id]) {
            userMap[u.id] = {
              userName: u.username ?? undefined,
              displayName: u.global_name ?? u.username ?? undefined,
            };
          }
        });
        const ref = live.referenced_message?.author;
        if (ref?.id && !userMap[ref.id]) {
          userMap[ref.id] = {
            userName: ref.username ?? undefined,
            displayName: ref.global_name ?? ref.username ?? undefined,
          };
        }
      });
    }
    const channelMap: Record<string, { name: string }> = {};
    parsed?.channels.forEach((c) => {
      if (c.name) channelMap[c.id] = { name: c.name };
    });
    return { userMap, channelMap, guildRoles: [], emojiMap: {}, sanitizedName: '' };
  }, [parsed, enrichedMap]);

  const authorName = parsed?.user.globalName ?? parsed?.user.username ?? 'You';
  const avatarInitial = (parsed?.user.username ?? '?').charAt(0).toUpperCase();
  /**
   * Prefer the in-package `avatar.png` (rendered as a blob URL during
   * parse). Fall back to Discord's CDN if the package lacks an avatar or
   * the blob failed to create — the current user's avatar is public, so
   * `cdn.discordapp.com/avatars/{id}/{hash}.png` works without auth.
   */
  const avatarSrc =
    parsed?.avatarBlobUrl ??
    (parsed?.user.id && parsed?.user.avatarHash
      ? `https://cdn.discordapp.com/avatars/${parsed.user.id}/${parsed.user.avatarHash}.png?size=64`
      : undefined);

  /** Stable dispatcher — receives the message ID via closure on the row. */
  const handleToggle = useCallback(
    (messageId: string) => {
      dispatch(toggleMessageSelection({ channelId: channel.id, messageId }));
    },
    [dispatch, channel.id],
  );

  /**
   * Build O(1) lookup sets for per-row kind resolution. `deletedIdSet`
   * is the union of two sources:
   *   - `deletedIds`: messages the user deleted (or 404'd during delete)
   *   - `enrichmentMisses.deleted`: 404s discovered during rehydration
   * Both mean "this message is gone on Discord", so they share the same
   * visual treatment and uninteractable state.
   */
  const deletedIdSet = useMemo(
    () => new Set([...deletedIds, ...enrichmentMisses.deleted]),
    [deletedIds, enrichmentMisses.deleted],
  );
  const forbiddenIdSet = useMemo(
    () => new Set(enrichmentMisses.forbidden),
    [enrichmentMisses.forbidden],
  );

  const isEnriching = enrichmentStatus === 'running';
  const enrichmentRunOnThisChannel = activeEnrichmentChannelId === channel.id;
  // Block starting a new enrichment whenever another heavy op is
  // running (purge/export/delete/…) — our own in-flight run on this
  // channel is fine (the banner handles it as the running state).
  const anotherOpBlocking = isHeavyOpRunning && !enrichmentRunOnThisChannel;
  const canEnrich =
    !!token &&
    !channel.isOrphan &&
    !readOnly &&
    !anotherOpBlocking &&
    !activeEnrichmentChannelId;
  // Distinct reason string so the banner's tooltip can explain
  // exactly why the button is disabled.
  const enrichDisabledReason = !token
    ? 'Sign in to rehydrate'
    : channel.isOrphan
      ? "You're no longer in this server — can't rehydrate"
      : readOnly
        ? 'Package is read-only (different user) — rehydration disabled'
        : activeEnrichmentChannelId
          ? `Another channel (${activeEnrichmentChannelId}) is rehydrating — wait for it to finish`
          : anotherOpBlocking
            ? 'Another operation is running — wait for it to finish'
            : null;

  const handleEnrich = useCallback(
    (refresh: boolean = false) => {
      if (!canEnrich) return;
      void dispatch(enrichPackageChannel({ channelId: channel.id, refresh }));
    },
    [canEnrich, dispatch, channel.id],
  );

  const handleCancelEnrichment = useCallback(() => {
    dispatch(setDiscrubCancelled(true));
  }, [dispatch]);

  const canDelete = !readOnly && !channel.isOrphan && !!token;
  const deleteDisabledReason = !token
    ? 'Sign in to delete messages'
    : readOnly
      ? 'Package is read-only (mismatched user)'
      : channel.isOrphan
        ? "You are no longer in this server — can't delete"
        : null;

  // Rows known to be gone on Discord can't be selected — exclude them
  // from bulk select-all and from the header checkbox's "all / some"
  // state so the UI reflects what the user can actually act on.
  const selectableIds = useMemo(
    () => sorted
      .filter((m) => !deletedIdSet.has(m.id) && !forbiddenIdSet.has(m.id))
      .map((m) => m.id),
    [sorted, deletedIdSet, forbiddenIdSet],
  );
  const selectableCount = selectableIds.length;

  const handleSelectAll = () => {
    if (selectedIds.length > 0 && selectedIds.length >= selectableCount) {
      dispatch(clearChannelMessageSelection(channel.id));
    } else {
      dispatch(
        selectAllChannelMessages({
          channelId: channel.id,
          messageIds: selectableIds,
        }),
      );
    }
  };

  const handleConfirmDelete = () => {
    setConfirmOpen(false);
    void dispatch(deletePackageMessages({ channelId: channel.id }));
  };

  const selectedMessages = useMemo(
    () => sorted.filter((m) => selectedSet.has(m.id)),
    [sorted, selectedSet],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 12,
  });

  const handleEditSave = async (content: string) => {
    if (!token || !parsed) return;
    setEditOpen(false);
    const messages = selectedMessages.map((pm) =>
      toDiscordMessage(pm, channel.id, parsed.user),
    );
    const ids = messages.map((m) => m.id);
    await dispatch(editMessages({ messages, channelId: channel.id, content, token }));
    // Update local cache to reflect new content. The ZIP is immutable, so
    // re-reading the CSV would overwrite the edit; we patch the in-memory
    // copy instead. A fresh package import will show the old content until
    // the user re-downloads from Discord.
    dispatch(applyLocalMessageEdits({ channelId: channel.id, messageIds: ids, content }));
    dispatch(clearChannelMessageSelection(channel.id));
  };

  if (messages === undefined) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 6 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            {isLoading ? 'Loading messages…' : 'Preparing…'}
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (sorted.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          This channel has no messages in the package.
        </Typography>
      </Box>
    );
  }

  const isDeleting = deleteStatus === 'running';

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          mb: 1.5,
          px: 1,
          py: 0.75,
          borderRadius: 1,
          backgroundColor: 'action.hover',
        }}
      >
        <Checkbox
          size="small"
          checked={
            selectedIds.length > 0 &&
            selectableCount > 0 &&
            selectedIds.length >= selectableCount
          }
          indeterminate={
            selectedIds.length > 0 && selectedIds.length < selectableCount
          }
          onChange={handleSelectAll}
          disabled={isDeleting || selectableCount === 0}
          inputProps={{ 'aria-label': 'Select all messages' }}
        />
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {selectedIds.length > 0
            ? `${selectedIds.length.toLocaleString()} selected`
            : `${sorted.length.toLocaleString()} messages`}
          {deletedIds.length > 0 && (
            <Typography
              component="span"
              variant="caption"
              color="warning.main"
              sx={{ ml: 1 }}
            >
              ({deletedIds.length.toLocaleString()} previously deleted)
            </Typography>
          )}
        </Typography>

        <Tooltip title={deleteDisabledReason ?? ''} disableHoverListener={canDelete}>
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              disabled={!canDelete || selectedIds.length === 0 || isDeleting}
              onClick={() => setEditOpen(true)}
            >
              Edit selected
            </Button>
          </span>
        </Tooltip>

        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadIcon />}
          disabled={isDeleting || exportStatus === 'running' || sorted.length === 0}
          onClick={() => setExportOpen(true)}
        >
          {exportStatus === 'running' ? 'Exporting…' : 'Export'}
        </Button>

        <Tooltip title={deleteDisabledReason ?? ''} disableHoverListener={canDelete}>
          <span>
            <Button
              color="error"
              size="small"
              variant="contained"
              startIcon={<DeleteIcon />}
              disabled={!canDelete || selectedIds.length === 0 || isDeleting}
              onClick={() => setConfirmOpen(true)}
            >
              Delete selected
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {deleteError && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => dispatch(dismissDeleteResult())}>
          {deleteError}
        </Alert>
      )}

      {deleteResult && (
        <Alert
          severity={deleteResult.failed > 0 ? 'warning' : 'success'}
          sx={{ mb: 1 }}
          onClose={() => dispatch(dismissDeleteResult())}
        >
          Deleted {deleteResult.deleted}, already gone {deleteResult.alreadyGone},
          forbidden {deleteResult.forbidden}, failed {deleteResult.failed}
          {deleteResult.cancelled ? ' — cancelled' : ''}.
        </Alert>
      )}

      {isDeleting && (
        <Box sx={{ mb: 1 }}>
          <LinearProgress
            variant={deleteProgress ? 'determinate' : 'indeterminate'}
            value={
              deleteProgress
                ? (deleteProgress.current / Math.max(1, deleteProgress.total)) * 100
                : undefined
            }
          />
          <Typography variant="caption" color="text.secondary">
            {deleteProgress
              ? `Deleting ${deleteProgress.current} of ${deleteProgress.total}`
              : 'Starting delete…'}
          </Typography>
        </Box>
      )}

      <EnrichmentBanner
        messageCount={sorted.length}
        status={enrichmentStatus}
        progress={enrichmentProgress}
        lastFetched={enrichmentLastFetched}
        enrichedCount={enrichedMap ? Object.keys(enrichedMap).length : 0}
        missDeletedCount={enrichmentMisses.deleted.length}
        missForbiddenCount={enrichmentMisses.forbidden.length}
        canEnrich={canEnrich}
        disabledReason={enrichDisabledReason}
        isEnriching={isEnriching}
        thisChannelIsActive={enrichmentRunOnThisChannel}
        searchDelayMs={searchDelay}
        onStart={() => handleEnrich(false)}
        onRefresh={() => handleEnrich(true)}
        onCancel={handleCancelEnrichment}
      />

      <Paper
        variant="outlined"
        ref={scrollRef}
        sx={{
          overflow: 'auto',
          // Fill remaining viewport height below the toolbar so the virtualizer
          // can size its scroll container. Without a fixed height every row
          // gets rendered because the parent is intrinsically sized.
          flexGrow: 1,
          minHeight: 0,
          height: 'calc(100vh - 280px)',
        }}
      >
        <Box
          sx={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: 'relative',
            width: '100%',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const msg = sorted[virtualRow.index];
            return (
              <Box
                key={msg.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MessageRow
                  message={msg}
                  authorName={authorName}
                  avatarInitial={avatarInitial}
                  avatarSrc={avatarSrc}
                  selected={selectedSet.has(msg.id)}
                  onToggle={handleToggle}
                  disabled={isDeleting}
                  canSelect={canDelete}
                  formattingContext={formattingContext}
                  isDark={isDark}
                  theme={theme}
                  enriched={enrichedMap?.[msg.id]}
                  gone={
                    deletedIdSet.has(msg.id)
                      ? 'deleted'
                      : forbiddenIdSet.has(msg.id)
                        ? 'forbidden'
                        : null
                  }
                />
              </Box>
            );
          })}
        </Box>
      </Paper>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        exportContext={{ source: 'package', channelId: channel.id }}
      />

      <EditMessageModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={(content) => void handleEditSave(content)}
        message={null}
        messages={
          parsed
            ? selectedMessages.map((pm) => toDiscordMessage(pm, channel.id, parsed.user))
            : []
        }
        messageCount={selectedIds.length}
      />

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
          <WarningIcon sx={{ color: 'error.main', fontSize: 28 }} />
          <Box>
            <Typography variant="h6" component="div" sx={{ lineHeight: 1.2 }}>
              Delete {selectedIds.length.toLocaleString()}{' '}
              {selectedIds.length === 1 ? 'message' : 'messages'}?
            </Typography>
            <Typography variant="caption" color="text.secondary">
              This cannot be undone.
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Each message will be removed from Discord one at a time, honoring
            your configured delay between deletes.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDelete}
            startIcon={<DeleteIcon />}
          >
            Delete {selectedIds.length.toLocaleString()}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

/* ────────── MessageRow ────────── */

interface MessageRowProps {
  message: PackageMessage;
  authorName: string;
  avatarInitial: string;
  avatarSrc?: string;
  selected: boolean;
  onToggle: (messageId: string) => void;
  disabled: boolean;
  canSelect: boolean;
  formattingContext: HtmlFormattingContext;
  isDark: boolean;
  theme: Theme;
  /** Live message from Tier 2 rehydration, if this row was enriched. */
  enriched?: Message;
  /**
   * Set when rehydration discovered the message is no longer reachable
   * on Discord. `'deleted'` = 404 (or response returned neighbors but
   * not the target), `'forbidden'` = 403 (user left the server etc).
   */
  gone?: 'deleted' | 'forbidden' | null;
}

const MessageRow = memo(function MessageRow({
  message,
  authorName,
  avatarInitial,
  avatarSrc,
  selected,
  onToggle,
  disabled,
  canSelect,
  formattingContext,
  isDark,
  theme,
  enriched,
  gone,
}: MessageRowProps) {
  const parsedDate = parseDiscordTimestamp(message.timestamp);
  const displayTime = parsedDate ? parsedDate.toLocaleString() : message.timestamp;
  const handleChange = useCallback(() => onToggle(message.id), [onToggle, message.id]);

  // Rows marked gone (deleted on Discord) are not actionable — they
  // can't be deleted again, re-enriched, or selected for bulk ops.
  const isGone = gone === 'deleted' || gone === 'forbidden';
  const rowSelectable = canSelect && !isGone;

  /**
   * Clicking anywhere on the row toggles selection. We stop propagation
   * on the attachment link so it still opens in a new tab without also
   * toggling the checkbox, and skip when the user has text selected
   * (dragging to copy content shouldn't flip the selection state).
   */
  const handleRowClick = useCallback(() => {
    if (disabled || !rowSelectable) return;
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) return;
    onToggle(message.id);
  }, [disabled, rowSelectable, onToggle, message.id]);

  // Faint warning tint + reduced opacity makes gone rows glanceable
  // without hiding the source content. Selected state takes precedence
  // visually so users aren't confused about what's selected.
  const goneBg = gone === 'deleted'
    ? 'rgba(255, 167, 38, 0.08)'
    : gone === 'forbidden'
      ? 'rgba(255, 167, 38, 0.05)'
      : undefined;

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      onClick={handleRowClick}
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        cursor: rowSelectable && !disabled ? 'pointer' : 'default',
        backgroundColor: selected
          ? 'action.selected'
          : goneBg ?? 'transparent',
        opacity: isGone ? 0.7 : 1,
        '&:hover': {
          backgroundColor: selected
            ? 'action.selected'
            : isGone
              ? goneBg
              : 'action.hover',
        },
      }}
    >
      <Checkbox
        size="small"
        checked={selected}
        onChange={handleChange}
        onClick={(e) => e.stopPropagation()}
        disabled={disabled || !rowSelectable}
        sx={{ mt: 0.25 }}
        inputProps={{ 'aria-label': `Select message ${message.id}` }}
      />
      <Avatar
        src={avatarSrc}
        alt={authorName}
        sx={{ width: 36, height: 36, mt: 0.5 }}
      >
        {avatarInitial}
      </Avatar>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {authorName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {displayTime}
          </Typography>
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ fontFamily: 'monospace' }}
          >
            {message.id}
          </Typography>
          <MessageKindChip enriched={!!enriched} gone={gone ?? null} />
        </Stack>
        {enriched?.type === 19 && enriched.referenced_message && (
          <ReplyQuote
            referenced={enriched.referenced_message}
            formattingContext={formattingContext}
          />
        )}
        {enriched?.type === 19 && enriched.message_reference &&
          !enriched.referenced_message && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 0.5,
                pl: 1,
                borderLeft: '2px solid',
                borderColor: 'text.disabled',
                opacity: 0.5,
              }}
            >
              <ReplyIcon sx={{ fontSize: 12, transform: 'scaleX(-1)' }} />
              <Typography variant="caption" color="text.disabled" fontStyle="italic">
                Original message was deleted
              </Typography>
            </Box>
          )}
        {(enriched?.content ?? message.content) && (
          <Box
            sx={{
              mt: 0.25,
              fontSize: '0.875rem',
              lineHeight: 1.5,
              color: 'text.primary',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              '& strong': { fontWeight: 700 },
              '& em': { fontStyle: 'italic' },
              '& u': { textDecoration: 'underline' },
              '& del': { textDecoration: 'line-through', opacity: 0.6 },
              '& a': {
                color: isDark ? '#00b0f4' : '#0969da',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              },
              '& .user-mention': {
                background: isDark ? 'rgba(88, 101, 242, 0.3)' : 'rgba(88, 101, 242, 0.15)',
                color: isDark ? '#c9d1ff' : theme.palette.primary.main,
                padding: '0 4px',
                borderRadius: '3px',
                fontWeight: 500,
              },
              '& .channel-mention': {
                background: isDark ? 'rgba(60, 66, 112, 0.5)' : 'rgba(60, 66, 112, 0.15)',
                color: isDark ? '#b5c7ff' : theme.palette.primary.dark,
                padding: '0 4px',
                borderRadius: '3px',
                fontWeight: 500,
              },
              '& .role-mention': {
                background: isDark ? 'rgba(88, 101, 242, 0.3)' : 'rgba(88, 101, 242, 0.15)',
                color: isDark ? '#c9d1ff' : theme.palette.primary.main,
                padding: '0 4px',
                borderRadius: '3px',
                fontWeight: 500,
              },
              '& .everyone-mention': {
                background: isDark ? 'rgba(250, 166, 26, 0.3)' : 'rgba(250, 166, 26, 0.15)',
                color: isDark ? '#faa61a' : '#b47615',
                padding: '0 4px',
                borderRadius: '3px',
                fontWeight: 600,
              },
              '& img.emoji': {
                width: '20px',
                height: '20px',
                verticalAlign: 'middle',
                margin: '0 2px',
                display: 'inline-block',
              },
              '& .inline-code': {
                background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.08)',
                color: isDark ? '#eb459e' : '#c4175c',
                padding: '2px 4px',
                borderRadius: '3px',
                fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                fontSize: '85%',
              },
              '& .code-block': {
                background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.08)',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: '6px',
                padding: '8px 10px',
                margin: '6px 0',
                overflowX: 'auto',
                fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                fontSize: '85%',
                '& code': { background: 'transparent' },
              },
              '& .spoiler': {
                background: theme.palette.action.disabledBackground,
                color: 'transparent',
                borderRadius: '3px',
                padding: '0 2px',
                cursor: 'pointer',
                userSelect: 'none',
              },
              '& .spoiler-revealed': {
                background: 'rgba(88, 101, 242, 0.2)',
                color: `${theme.palette.text.primary} !important`,
              },
              '& .discord-heading': {
                fontWeight: 700,
                margin: '4px 0 2px',
              },
              '& h1.discord-heading': { fontSize: '1.2em' },
              '& h2.discord-heading': { fontSize: '1.1em' },
              '& h3.discord-heading': { fontSize: '1em' },
            }}
            dangerouslySetInnerHTML={{
              __html: formatContentAsHtml(
                enriched?.content ?? message.content,
                formattingContext,
              ),
            }}
          />
        )}
        {message.attachment && <AttachmentLink url={message.attachment} />}
        {enriched?.reactions && enriched.reactions.length > 0 && (
          <ReactionsRow reactions={enriched.reactions} />
        )}
        {enriched?.embeds && enriched.embeds.length > 0 && (
          <EmbedsChip count={enriched.embeds.length} />
        )}
      </Box>
    </Stack>
  );
});

const AttachmentLink = ({ url }: { url: string }) => {
  const filename = useMemo(() => {
    try {
      const path = new URL(url).pathname;
      return decodeURIComponent(path.split('/').pop() ?? url);
    } catch {
      return url;
    }
  }, [url]);

  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{
        mt: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        backgroundColor: 'action.hover',
        display: 'inline-flex',
        maxWidth: '100%',
      }}
    >
      <AttachmentIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        underline="hover"
        variant="caption"
        onClick={(e) => e.stopPropagation()}
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={`${filename} (CDN link may be expired)`}
      >
        {filename}
      </Link>
    </Stack>
  );
};

/* ────────── Enrichment UI helpers ────────── */

/**
 * Small inline badge shown in every message row. Glanceable indicator
 * of whether the row is source-only (Tier 1), enriched with live data
 * (Tier 2), or known-gone (API said 404/403 during rehydration).
 */
const MessageKindChip = memo(function MessageKindChip({
  enriched,
  gone,
}: {
  enriched: boolean;
  gone: 'deleted' | 'forbidden' | null;
}) {
  if (gone === 'deleted') {
    return (
      <Tooltip title="This message was deleted on Discord — only the package snapshot remains." arrow>
        <Typography
          variant="caption"
          sx={{
            color: 'warning.main',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.25,
          }}
        >
          <WarningIcon sx={{ fontSize: 12 }} /> unavailable
        </Typography>
      </Tooltip>
    );
  }
  if (gone === 'forbidden') {
    return (
      <Tooltip title="You no longer have access to this channel — rehydration was forbidden." arrow>
        <Typography
          variant="caption"
          sx={{
            color: 'warning.main',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.25,
          }}
        >
          <WarningIcon sx={{ fontSize: 12 }} /> forbidden
        </Typography>
      </Tooltip>
    );
  }
  if (enriched) {
    return (
      <Tooltip title="Rehydrated — live reactions, mentions, and embeds from Discord." arrow>
        <Typography
          variant="caption"
          sx={{
            color: 'primary.main',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.25,
          }}
        >
          <EnrichedIcon sx={{ fontSize: 12 }} /> enriched
        </Typography>
      </Tooltip>
    );
  }
  return (
    <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
      source
    </Typography>
  );
});

/**
 * Reply quote banner, shown above the content of a type-19 reply when
 * the package message has been rehydrated. Mirrors the visual treatment
 * used by the live MessageTable so package rehydration feels 1:1 with
 * the live view.
 */
const ReplyQuote = memo(function ReplyQuote({
  referenced,
  formattingContext,
}: {
  referenced: NonNullable<Message['referenced_message']>;
  formattingContext: HtmlFormattingContext;
}) {
  const refAuthor =
    referenced.author?.global_name ||
    referenced.author?.username ||
    'Unknown';
  const refContent = referenced.content ?? '';
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        mt: 0.5,
        pl: 1,
        borderLeft: '2px solid',
        borderColor: 'text.disabled',
        opacity: 0.75,
      }}
    >
      <ReplyIcon sx={{ fontSize: 12, transform: 'scaleX(-1)' }} />
      <Typography variant="caption" fontWeight={600} noWrap>
        {refAuthor}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        sx={{ flex: 1, minWidth: 0 }}
        dangerouslySetInnerHTML={{
          __html: refContent
            ? formatContentAsHtml(refContent, formattingContext)
            : '(attachment)',
        }}
      />
    </Box>
  );
});

/**
 * Compact chip row showing reaction emoji + count, positioned below the
 * message content. Uses unicode emoji when available; falls back to an
 * `<img>` from the Discord CDN for custom emoji.
 */
const ReactionsRow = memo(function ReactionsRow({
  reactions,
}: {
  reactions: NonNullable<Message['reactions']>;
}) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.5 }}>
      {reactions.map((r, i) => {
        const emoji = r.emoji;
        const key = emoji?.id ? `${emoji.id}` : (emoji?.name ?? String(i));
        return (
          <Box
            key={key}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              backgroundColor: 'action.hover',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            {emoji?.id ? (
              <Box
                component="img"
                src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'webp'}?size=32`}
                alt={emoji.name ?? ''}
                sx={{ width: 16, height: 16, verticalAlign: 'middle' }}
              />
            ) : (
              <span>{emoji?.name ?? '?'}</span>
            )}
            <span>{r.count ?? 0}</span>
          </Box>
        );
      })}
    </Stack>
  );
});

/**
 * Lightweight "N embed(s)" chip — full embed rendering is a future
 * enhancement; for now we just surface the presence and count so users
 * know the live message carried rich content.
 */
const EmbedsChip = memo(function EmbedsChip({ count }: { count: number }) {
  return (
    <Box
      sx={{
        mt: 0.75,
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        backgroundColor: 'action.hover',
        fontSize: '0.75rem',
        color: 'text.secondary',
      }}
    >
      {count} {count === 1 ? 'embed' : 'embeds'}
    </Box>
  );
});

/* ────────── Channel-header enrichment banner ────────── */

interface EnrichmentBannerProps {
  messageCount: number;
  status: EnrichmentStatus;
  progress: { current: number; total: number } | null;
  lastFetched: number | null;
  enrichedCount: number;
  missDeletedCount: number;
  missForbiddenCount: number;
  canEnrich: boolean;
  /** Specific reason the button is disabled — shown as tooltip. */
  disabledReason: string | null;
  isEnriching: boolean;
  thisChannelIsActive: boolean;
  /** Search delay in ms — drives the ETA estimate. */
  searchDelayMs: number;
  onStart: () => void;
  onRefresh: () => void;
  onCancel: () => void;
}

function formatEta(totalMessages: number, searchDelayMs: number): string {
  if (totalMessages <= 0) return '<1s';
  const totalSec = (totalMessages * searchDelayMs) / 1000;
  if (totalSec < 60) return `~${Math.max(1, Math.round(totalSec))}s`;
  const mins = Math.round(totalSec / 60);
  return `~${mins} min`;
}

function formatDaysAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return 'today';
  const days = Math.round(diffMs / day);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const EnrichmentBanner = memo(function EnrichmentBanner({
  messageCount,
  status,
  progress,
  lastFetched,
  enrichedCount,
  missDeletedCount,
  missForbiddenCount,
  canEnrich,
  disabledReason,
  isEnriching,
  thisChannelIsActive,
  searchDelayMs,
  onStart,
  onRefresh,
  onCancel,
}: EnrichmentBannerProps) {
  if (isEnriching && thisChannelIsActive) {
    const pct = progress
      ? (progress.current / Math.max(1, progress.total)) * 100
      : 0;
    return (
      <Box
        sx={{
          mb: 1,
          px: 1.5,
          py: 1,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'primary.main',
          backgroundColor: 'action.hover',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <EnrichedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            Rehydrating {progress?.current ?? 0} of {progress?.total ?? messageCount}…
          </Typography>
          <Button size="small" variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Stack>
        <LinearProgress
          variant={progress ? 'determinate' : 'indeterminate'}
          value={pct}
          sx={{ mt: 1 }}
        />
      </Box>
    );
  }

  if (status === 'done' && lastFetched) {
    return (
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          mb: 1,
          px: 1.5,
          py: 0.75,
          borderRadius: 1,
          backgroundColor: 'action.hover',
        }}
      >
        <EnrichedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography variant="caption" sx={{ flexGrow: 1 }}>
          Rich data loaded {formatDaysAgo(lastFetched)} — {enrichedCount} enriched
          {missDeletedCount > 0 && `, ${missDeletedCount} deleted`}
          {missForbiddenCount > 0 && `, ${missForbiddenCount} forbidden`}
        </Typography>
        <Tooltip
          title={disabledReason ?? ''}
          disableHoverListener={canEnrich}
        >
          <span>
            <Button
              size="small"
              variant="text"
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              disabled={!canEnrich}
            >
              Refresh
            </Button>
          </span>
        </Tooltip>
      </Stack>
    );
  }

  // idle | cancelled | failed — offer to start (or retry) rehydration.
  // A Retry after cancel/failure must force a re-run (bypass any
  // partial cache) — otherwise the short-circuit would immediately
  // resurrect whatever partial data the previous run saved.
  const verb = status === 'cancelled' || status === 'failed' ? 'Retry' : 'Load';
  const retryOrStart = status === 'cancelled' || status === 'failed' ? onRefresh : onStart;
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        mb: 1,
        px: 1.5,
        py: 0.75,
        borderRadius: 1,
        backgroundColor: 'action.hover',
      }}
    >
      <EnrichedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
      <Typography variant="caption" sx={{ flexGrow: 1 }}>
        {status === 'cancelled'
          ? 'Rehydration cancelled — '
          : status === 'failed'
            ? 'Rehydration failed — '
            : ''}
        Rehydrate to see reactions, mentions, and fresh CDN URLs.
      </Typography>
      <Tooltip
        title={disabledReason ?? ''}
        disableHoverListener={canEnrich}
      >
        <span>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EnrichedIcon />}
            disabled={!canEnrich}
            onClick={retryOrStart}
          >
            {verb} rich data · {formatEta(messageCount, searchDelayMs)}
          </Button>
        </span>
      </Tooltip>
    </Stack>
  );
});

export default PackageMessageTable;
