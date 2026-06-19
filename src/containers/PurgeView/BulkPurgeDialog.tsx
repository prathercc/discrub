import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Chip,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
} from '@mui/material';
import {
  DeleteSweep as PurgeIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { groupsToTypes } from '@/utils/systemMessageGroups';
import SystemMessageTypePicker from '@components/message/SystemMessageTypePicker';
import type { Channel } from 'discrub-core/types/discord-types';
import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import TourFootnote from '@components/welcome/TourFootnote';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';
import { selectSettings } from '@features/app/appSlice';
import { selectIsHeavyOperationRunning } from '@features/app/operationSelectors';
import { selectCachedUserMap } from '@features/cache/cacheSlice';
import { selectCurrentUser } from '@features/user/userSlice';
import { selectSelectedGuild, selectCurrentMemberRoles } from '@features/guild/guildSlice';
import { bulkPurgeChannels, bulkPurgeDMs } from '@features/purge/purgeSlice';
import type { PurgeMode } from '@features/purge/purgeTypes';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import UserPicker from '@components/ui/UserPicker';
import FilterModal from '@components/search/FilterModal';
import { countActiveFilters } from 'discrub-core/filtering';
import BulkFilterButton from '@components/search/BulkFilterButton';
import SelectedChannelsPill from '@components/dialogs/SelectedChannelsPill';
import { canManageMessages as channelCanManageMessages } from '@/utils/permissionUtils';

// UI-level mode — promotes "Attachments Only" to a first-class choice.
// Maps to the underlying PurgeMode + deleteAttachmentsOnly flag on dispatch.
type UiPurgeMode = 'messages' | 'attachmentsOnly' | 'reactions' | 'clearReactions';

interface BulkPurgeDialogProps {
  open: boolean;
  onClose: () => void;
  channels: Channel[];
  mode: 'channels' | 'dms';
  guildId?: string | null;
  canManageMessages?: boolean;
}

const deriveUiMode = (
  savedMode: string | undefined,
  deleteAttachmentsOnly: boolean,
  canManageMessages: boolean,
): UiPurgeMode => {
  if (savedMode === 'reactions') return 'reactions';
  if (savedMode === 'clearReactions' && canManageMessages) return 'clearReactions';
  if (deleteAttachmentsOnly) return 'attachmentsOnly';
  return 'messages';
};

const BulkPurgeDialog = ({ open, onClose, channels, mode, guildId, canManageMessages = false }: BulkPurgeDialogProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectSettings);
  const isOperationRunning = useAppSelector(selectIsHeavyOperationRunning);
  const cachedUserMap = useAppSelector(selectCachedUserMap);
  const currentUser = useAppSelector(selectCurrentUser);
  const selectedGuild = useAppSelector(selectSelectedGuild);
  const memberRoles = useAppSelector(selectCurrentMemberRoles);

  const [uiMode, setUiMode] = useState<UiPurgeMode>('messages');
  const [retainAttachedMedia, setRetainAttachedMedia] = useState(false);
  const [selectedSystemGroups, setSelectedSystemGroups] = useState<string[]>([]);
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [filterCriteria, setFilterCriteria] = useState<SearchCriteria | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  // Bumped each time we open the filter modal. Keyed FilterModal below
  // forces a fresh mount so its internal state always seeds from the
  // current savedSearchCriteria (fixes stale-typed-values-on-reopen).
  const [filterModalKey, setFilterModalKey] = useState(0);
  const openFilterModal = () => {
    setFilterModalKey((k) => k + 1);
    setFilterModalOpen(true);
  };

  const currentUserId = currentUser?.id || '';

  // Initialize from settings when dialog opens
  useEffect(() => {
    if (open && settings) {
      const rawMode = settings[DiscrubSetting.PURGE_MODE];
      const deleteAttachmentsOnlySetting =
        settings[DiscrubSetting.PURGE_DELETE_ATTACHMENTS_ONLY] === 'true';
      setUiMode(deriveUiMode(rawMode, deleteAttachmentsOnlySetting, canManageMessages));
      setRetainAttachedMedia(settings[DiscrubSetting.PURGE_RETAIN_ATTACHED_MEDIA] === 'true');
      setSelectedSystemGroups([]);
      setTargetUserIds([]);
      setFilterCriteria(null);
      setFilterModalOpen(false);
    }
  }, [open, settings, currentUserId, canManageMessages]);

  const isDmMode = mode === 'dms';
  const contextLabel = isDmMode ? 'conversation' : 'channel';
  const contextLabelPlural = isDmMode ? 'conversations' : 'channels';

  // In DM mode, restrict UserPicker to only DM participants
  const dmParticipantUserMap = useMemo(() => {
    if (!isDmMode) return cachedUserMap;

    const participantIds = new Set<string>();
    if (currentUserId) participantIds.add(currentUserId);
    channels.forEach((ch) => {
      ch.recipients?.forEach((r) => participantIds.add(r.id));
    });

    const filtered: typeof cachedUserMap = {};
    participantIds.forEach((id) => {
      if (cachedUserMap[id]) {
        filtered[id] = cachedUserMap[id];
      }
    });
    return filtered;
  }, [isDmMode, cachedUserMap, channels, currentUserId]);

  const effectiveUserMap = isDmMode ? dmParticipantUserMap : cachedUserMap;

  const isMessagesFamily = uiMode === 'messages' || uiMode === 'attachmentsOnly';
  const isReactionsFamily = uiMode === 'reactions' || uiMode === 'clearReactions';
  const isClearReactions = uiMode === 'clearReactions';

  // Targeting is hidden only for Clear All Reactions
  const showTargetSection = !isClearReactions;

  // Per-channel MANAGE_MESSAGES audit for guild mode. DMs short-circuit (no
  // guild perms apply) and the result is unused there.
  const guildPermissions = selectedGuild?.permissions;
  const guildPermissionAudit = useMemo(() => {
    if (isDmMode || !guildId || !guildPermissions) {
      return { blockedChannels: [] as Channel[], allBlocked: false, someBlocked: false };
    }
    const blocked = channels.filter(
      (ch) => !channelCanManageMessages(guildPermissions, memberRoles, ch, guildId),
    );
    return {
      blockedChannels: blocked,
      allBlocked: channels.length > 0 && blocked.length === channels.length,
      someBlocked: blocked.length > 0,
    };
  }, [isDmMode, guildId, guildPermissions, memberRoles, channels]);

  const { blockedChannels, allBlocked, someBlocked } = guildPermissionAudit;

  // In DM messages/attachments mode, in reactions without MANAGE_MESSAGES,
  // or in guild messages mode where any selected channel lacks MANAGE_MESSAGES,
  // the target is locked to the current user.
  const isTargetLockedToSelf =
    (isDmMode && isMessagesFamily)
    || (uiMode === 'reactions' && !canManageMessages)
    || (isMessagesFamily && !isDmMode && someBlocked);

  // Filter-modal-driven target for guild Messages/Attachments Only modes.
  // For DMs / self-locked reactions, target is the current user. For
  // Reactions (with MANAGE) the top-level picker still governs.
  const effectiveTargetUserIds = isTargetLockedToSelf
    ? (currentUserId ? [currentUserId] : [])
    : isMessagesFamily
      ? (filterCriteria?.userIds ?? [])
      : targetUserIds;

  const filterCount = filterCriteria ? countActiveFilters(filterCriteria) : 0;

  // Backlog #196 Phase 2 — flatten the checked group buckets into the
  // MessageType value list the purge predicate consults. Only meaningful
  // in pure Messages mode (full delete); other modes pass an empty list.
  const selectedSystemTypes = useMemo(
    () => groupsToTypes(selectedSystemGroups),
    [selectedSystemGroups],
  );

  const handleConfirm = () => {
    const underlyingMode: PurgeMode = isReactionsFamily
      ? (uiMode === 'clearReactions' ? 'clearReactions' : 'reactions')
      : 'messages';

    const purgeConfig = {
      mode: underlyingMode,
      targetUserIds: isClearReactions ? [] : effectiveTargetUserIds,
      retainAttachedMedia: uiMode === 'messages' ? retainAttachedMedia : false,
      deleteAttachmentsOnly: uiMode === 'attachmentsOnly',
      // Opt-in system-message deletion only applies to full Messages mode.
      systemMessageTypesToDelete: uiMode === 'messages' ? selectedSystemTypes : [],
    };

    // All modes now thread filterCriteria — messages family consumes it as
    // the primary target surface, reactions family uses it purely for
    // message-narrowing (orthogonal to the reactor UserPicker).
    const payloadSearchCriteria = filterCriteria;

    if (isDmMode) {
      dispatch(bulkPurgeDMs({ channels, config: purgeConfig, searchCriteria: payloadSearchCriteria }));
    } else {
      dispatch(bulkPurgeChannels({ channels, config: purgeConfig, guildId, searchCriteria: payloadSearchCriteria }));
    }

    onClose();
  };

  const getSummaryText = () => {
    const count = channels.length;
    const userCount = effectiveTargetUserIds.length;
    if (uiMode === 'messages') {
      const base = `${count} ${count === 1 ? contextLabel : contextLabelPlural} will be purged. Messages from ${userCount} user${userCount !== 1 ? 's' : ''} will be permanently deleted.`;
      const sysCount = selectedSystemGroups.length;
      if (sysCount > 0) {
        return `${base} The ${sysCount} selected system-message type${sysCount !== 1 ? 's' : ''} will also be deleted; all other system notices stay in place.`;
      }
      return base;
    }
    if (uiMode === 'attachmentsOnly') {
      return `Attachments will be stripped from messages by ${userCount} user${userCount !== 1 ? 's' : ''} across ${count} ${count === 1 ? contextLabel : contextLabelPlural}. Message text is preserved.`;
    }
    if (uiMode === 'clearReactions') {
      return `All reactions will be removed from every message in ${count} ${count === 1 ? contextLabel : contextLabelPlural}.`;
    }
    return `Reactions from ${userCount} user${userCount !== 1 ? 's' : ''} will be removed across ${count} ${count === 1 ? contextLabel : contextLabelPlural}.`;
  };

  const getConfirmLabel = () => {
    const count = channels.length;
    const noun = isDmMode ? 'DM' : 'Ch.';
    if (uiMode === 'messages') return `Purge ${count} ${noun}${count !== 1 ? 's' : ''}`;
    if (uiMode === 'attachmentsOnly') return `Strip Attachments (${count} ${noun}${count !== 1 ? 's' : ''})`;
    if (uiMode === 'clearReactions') return `Clear Reactions (${count} ${noun}${count !== 1 ? 's' : ''})`;
    return `Remove Reactions (${count} ${noun}${count !== 1 ? 's' : ''})`;
  };

  const hasNoTargetUsers = !showTargetSection
    ? false
    : effectiveTargetUserIds.length === 0;

  const targetLabel = isReactionsFamily ? 'Remove reactions from' : 'Author';

  const getLockReasonText = () => {
    if (isDmMode && isMessagesFamily) {
      return 'You can only target your own messages in DMs.';
    }
    if (isMessagesFamily && !isDmMode && someBlocked) {
      if (allBlocked) {
        return 'You can only target your own messages without Manage Messages permission in the selected channels.';
      }
      const named = blockedChannels.slice(0, 2).map((c) => `#${c.name}`).join(', ');
      const tail = blockedChannels.length > 2
        ? `Manage Messages missing in ${blockedChannels.length} of the selected channels.`
        : `Manage Messages missing in ${named}. Deselect to unlock.`;
      return `You can only target your own messages. ${tail}`;
    }
    return 'You can only remove your own reactions without Manage Messages permission.';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 5 }}>
        Purge {isDmMode ? 'DMs' : 'Channels'}
        <Chip
          label={`${channels.length} selected`}
          size="small"
          sx={{
            ml: 1,
            verticalAlign: 'middle',
            backgroundColor: 'rgba(237, 66, 69, 0.2)',
            color: isDark ? '#f5a6a8' : 'error.main',
            fontWeight: 500,
          }}
        />
        <DialogCloseIcon onClose={onClose} />
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <SelectedChannelsPill channels={channels} mode={isDmMode ? 'dms' : 'channels'} />

          {/* Mode selection — 4 first-class modes */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mb: 0.75 }}>
              <Typography variant="subtitle2">
                What to purge
                <TourFootnote stepKey="purge-mode-toggle" />
              </Typography>
            </Box>
            <ToggleButtonGroup
              exclusive
              value={uiMode}
              onChange={(_, newMode: UiPurgeMode | null) => { if (newMode !== null) setUiMode(newMode); }}
              size="small"
              fullWidth
              sx={{ flexWrap: 'wrap' }}
            >
              <ToggleButton value="messages">Messages</ToggleButton>
              <ToggleButton value="attachmentsOnly">Attachments Only</ToggleButton>
              <ToggleButton value="reactions">Reactions</ToggleButton>
              {canManageMessages && (
                <ToggleButton value="clearReactions">Clear All Reactions</ToggleButton>
              )}
            </ToggleButtonGroup>
            {uiMode === 'attachmentsOnly' && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                Strips media but preserves the message text. Discord only allows you to edit messages you authored — other users' messages can't be stripped via the API and will fail.
              </Typography>
            )}
            {uiMode === 'clearReactions' && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                Removes all reactions from every message in the selected {contextLabelPlural}. Requires Manage Messages permission.
              </Typography>
            )}
          </Box>

          {/* Target messages section — shown for all modes except Clear All Reactions */}
          {showTargetSection && (
            <>
              <Divider textAlign="left" sx={{ '& .MuiDivider-wrapper': { pl: 0 } }}>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                  Target messages
                </Typography>
              </Divider>

              <Box>
                {isTargetLockedToSelf ? (
                  <>
                    <UserPicker
                      selectedUserIds={currentUserId ? [currentUserId] : []}
                      onChange={() => {}}
                      cachedUserMap={effectiveUserMap}
                      currentUserId={currentUserId}
                      disabled
                      label={targetLabel}
                    />
                    <Alert severity="info" variant="outlined" sx={{ py: 0.5, mt: 1 }}>
                      {getLockReasonText()}
                    </Alert>
                    {(isMessagesFamily || isReactionsFamily) && (
                      <Box sx={{ mt: 1.5 }}>
                        <BulkFilterButton
                          filterCount={filterCount}
                          onOpen={openFilterModal}
                          helperText={isMessagesFamily
                            ? "Optional — narrow by date range, content, attachments, etc."
                            : "Optional — narrow which messages to scan by author, date, content, etc."}
                        />
                      </Box>
                    )}
                  </>
                ) : isMessagesFamily ? (
                  // Guild Messages / Attachments Only: filter modal is the
                  // primary target surface. Author + any narrowing goes
                  // through the modal; confirm stays disabled until the
                  // user has set at least one author there.
                  <BulkFilterButton
                    filterCount={filterCount}
                    onOpen={openFilterModal}
                    helperText="Open filters to pick the target author (required) and optionally narrow by date, content, or attachments."
                  />
                ) : (
                  <>
                    <UserPicker
                      selectedUserIds={targetUserIds}
                      onChange={setTargetUserIds}
                      cachedUserMap={effectiveUserMap}
                      currentUserId={currentUserId}
                      label={targetLabel}
                    />
                    {isReactionsFamily && (
                      <Box sx={{ mt: 1.5 }}>
                        <BulkFilterButton
                          filterCount={filterCount}
                          onOpen={openFilterModal}
                          helperText="Optional — narrow which messages to scan by author, date, content, etc. (reactor picker above is independent)."
                        />
                      </Box>
                    )}
                  </>
                )}
              </Box>
            </>
          )}

          {/* Clear All Reactions: no target picker, but still offer narrowing */}
          {isClearReactions && (
            <Box>
              <BulkFilterButton
                filterCount={filterCount}
                onOpen={openFilterModal}
                helperText="Optional — narrow which messages to clear reactions from by author, date, content, etc."
              />
            </Box>
          )}

          {/* Clear-text-keep-attachments checkbox — only meaningful in Messages mode */}
          {uiMode === 'messages' && (
            <FormControlLabel
              sx={{ m: 0, alignItems: 'flex-start' }}
              control={
                <Checkbox
                  size="small"
                  checked={retainAttachedMedia}
                  onChange={(e) => setRetainAttachedMedia(e.target.checked)}
                  inputProps={{ 'aria-label': 'Clear text, keep attachments' }}
                  sx={{ mt: '-4px' }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Clear text, keep attachments</Typography>
                  <Typography variant="caption" color="text.secondary">
                    For messages with attachments, strip the text content and preserve the media. Only works on messages you authored.
                  </Typography>
                </Box>
              }
            />
          )}

          {/* Backlog #196 Phase 2 — opt-in deletion of Discord system
              messages. Messages mode only: attachments-only / reactions
              modes can't act on contentless system events. */}
          {uiMode === 'messages' && (
            <Accordion
              disableGutters
              elevation={0}
              square
              sx={{
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                backgroundColor: 'transparent',
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2">Also delete system messages</Typography>
                {selectedSystemGroups.length > 0 && (
                  <Chip
                    label={selectedSystemGroups.length}
                    size="small"
                    color="error"
                    sx={{ ml: 1, height: 20, '& .MuiChip-label': { px: 1 } }}
                  />
                )}
              </AccordionSummary>
              <AccordionDetails>
                <SystemMessageTypePicker
                  selectedGroups={selectedSystemGroups}
                  onChange={setSelectedSystemGroups}
                  description={`By default the purge leaves Discord's automatic notices in place — the "pinned a message" trail, join and boost notices, and so on. Check any you also want removed.`}
                />
              </AccordionDetails>
            </Accordion>
          )}

          {/* Summary */}
          <Alert severity="warning" variant="outlined">
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              This action is irreversible.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getSummaryText()}
            </Typography>
          </Alert>

          {/* #206: a large purge runs for a while. Discrub now holds a screen
              wake lock so the display won't sleep mid-run, but a wake lock
              can't keep a backgrounded tab unthrottled — hence the focus hint. */}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Large purges can run for a while. Discrub keeps your screen awake,
            but for very long runs keep this tab in the foreground and turn off
            your browser&rsquo;s battery-saver / tab-sleep so deletes aren&rsquo;t paused.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          startIcon={<PurgeIcon />}
          disabled={channels.length === 0 || hasNoTargetUsers || isOperationRunning}
        >
          {getConfirmLabel()}
        </Button>
      </DialogActions>

      {/* Nested FilterModal — the target picker for Messages/Attachments
          Only modes and the optional narrowing surface elsewhere. */}
      <FilterModal
        key={filterModalKey}
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        onServerSearch={(criteria) => {
          setFilterCriteria(criteria);
          setFilterModalOpen(false);
        }}
        onRefine={() => { /* bulk purge has no client-side refine */ }}
        onClearSearch={() => {
          setFilterCriteria(null);
          setFilterModalOpen(false);
        }}
        onClearRefine={() => { /* no-op */ }}
        savedSearchCriteria={filterCriteria ?? undefined}
        cachedUserMap={effectiveUserMap}
        currentUserId={currentUserId}
        hideRefineSection
        applyButtonLabel="Apply filters"
        // Hide From + Author Type only when the message-author concept
        // itself is locked to self by the parent dialog (#137). For
        // Reactions / Clear All Reactions, the reactor is locked but
        // the message-author filter is independent and required for
        // the "remove my reactions only from the other person's
        // messages" workflow.
        hideAuthorFilters={isTargetLockedToSelf && isMessagesFamily}
      />
    </Dialog>
  );
};

export default BulkPurgeDialog;
