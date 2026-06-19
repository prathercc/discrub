import { useState } from 'react';
import { Paper, Box, Button, Chip, Tooltip } from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Code as CodeIcon,
  DeleteSweep as ReactionRemoveIcon,
  AddReaction as ReactionAddIcon,
} from '@mui/icons-material';
import type { Emoji, Message, User } from 'discrub-core/types/discord-types';
import type { HtmlFormattingContext } from 'discrub-core/types/html-formatting-types';
import { isSystemMessageType } from 'discrub-core/system-messages';
import type { SelectableEmoji } from '@/utils/emojiDataset';
import DeleteConfirmModal from '@components/modals/DeleteConfirmModal';
import EditMessageModal from '@components/modals/EditMessageModal';
import EmbedModal from '@components/modals/EmbedModal';
import ReactionRemovalModal from '@components/modals/ReactionRemovalModal';
import AddReactionsModal from '@components/modals/AddReactionsModal';

interface MessageActionsProps {
  selectedMessages: Message[];
  onDelete: (messages: Message[]) => Promise<void>;
  onEdit: (message: Message, newContent: string) => Promise<void>;
  onBulkEdit?: (messages: Message[], newContent: string) => Promise<void>;
  formattingContext: HtmlFormattingContext;
  isOperationRunning?: boolean;
  canManageMessages?: boolean;
  currentUserId?: string;
  currentUsername?: string;
  fetchDelayMs?: number;
  isDm?: boolean;
  onBatchRemoveReactions?: (params: {
    messages: Message[];
    mode: 'all' | 'emoji' | 'user';
    emojis?: string[];
    userId?: string;
  }) => void;
  onBatchAddReactions?: (params: { messages: Message[]; emojis: SelectableEmoji[] }) => void;
  guildEmojis?: Emoji[];
  onFetchReactingUsers?: (messageId: string, emoji: string) => Promise<User[]>;
}

/**
 * MessageActions - toolbar for message operations
 */
const MessageActions = ({
  selectedMessages,
  onDelete,
  onEdit,
  onBulkEdit,
  formattingContext,
  isOperationRunning = false,
  canManageMessages = false,
  currentUserId,
  currentUsername,
  fetchDelayMs,
  isDm = false,
  onBatchRemoveReactions,
  onBatchAddReactions,
  guildEmojis,
  onFetchReactingUsers,
}: MessageActionsProps) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [embedModalOpen, setEmbedModalOpen] = useState(false);
  const [reactionRemovalOpen, setReactionRemovalOpen] = useState(false);
  const [addReactionsOpen, setAddReactionsOpen] = useState(false);

  const selectedCount = selectedMessages.length;
  const singleMessage = selectedCount === 1 ? selectedMessages[0] : null;

  // Discord requires MANAGE_MESSAGES to delete messages authored by others,
  // and PATCH (edit) is author-only regardless of permission. Surface both
  // constraints up front so users hit a disabled control with explanation
  // instead of a 403 in the status log.
  const hasNonSelfSelection = currentUserId
    ? selectedMessages.some((m) => m.author?.id !== currentUserId)
    : false;
  const deleteBlockedByPermission = hasNonSelfSelection && !canManageMessages;
  // System messages (pin/join/boost notices etc.) carry no editable body —
  // Discord's PATCH endpoint only accepts your own DEFAULT/REPLY messages.
  // Now that they're selectable in the feed (#196 Phase 3), guard Edit so a
  // mixed selection doesn't offer an action that can only 403. Delete stays
  // available — removing system messages is the whole point of #196.
  const hasSystemSelection = selectedMessages.some((m) => isSystemMessageType(m.type));
  const editBlocked = hasNonSelfSelection || hasSystemSelection;
  const deleteLockReason = isDm
    ? 'You can only delete your own messages in DMs.'
    : 'You can only delete your own messages without Manage Messages permission in this channel.';
  const editLockReason = hasSystemSelection
    ? "System messages (pins, joins, boosts, etc.) can't be edited."
    : 'You can only edit your own messages. Discord blocks editing other users\' messages.';

  const handleDelete = async () => {
    setDeleteModalOpen(false);
    await onDelete(selectedMessages);
  };

  const handleEdit = async (newContent: string) => {
    setEditModalOpen(false);
    if (selectedCount === 1 && singleMessage) {
      await onEdit(singleMessage, newContent);
    } else if (selectedCount > 1 && onBulkEdit) {
      await onBulkEdit(selectedMessages, newContent);
    }
  };

  return (
    <>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`${selectedCount} selected`}
            color={selectedCount > 0 ? 'primary' : 'default'}
          />

          <Tooltip title={deleteBlockedByPermission ? deleteLockReason : ''} disableHoverListener={!deleteBlockedByPermission}>
            <span>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                disabled={selectedCount === 0 || isOperationRunning || deleteBlockedByPermission}
                onClick={() => setDeleteModalOpen(true)}
              >
                Delete
              </Button>
            </span>
          </Tooltip>

          <Tooltip title={editBlocked ? editLockReason : ''} disableHoverListener={!editBlocked}>
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon />}
                disabled={selectedCount === 0 || (selectedCount > 1 && isOperationRunning) || editBlocked}
                onClick={() => setEditModalOpen(true)}
              >
                Edit
              </Button>
            </span>
          </Tooltip>

          {singleMessage?.embeds && singleMessage.embeds.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<CodeIcon />}
              onClick={() => setEmbedModalOpen(true)}
            >
              Embeds ({singleMessage.embeds.length})
            </Button>
          )}

          {onBatchAddReactions && (
            <Button
              variant="outlined"
              size="small"
              color="primary"
              startIcon={<ReactionAddIcon />}
              // Adding your own reaction only needs Add Reactions perm, which
              // Discord enforces per message — no manage-messages gate here.
              disabled={selectedCount === 0 || isOperationRunning}
              onClick={() => setAddReactionsOpen(true)}
            >
              Add Reactions
            </Button>
          )}

          {onBatchRemoveReactions && (
            <Button
              variant="outlined"
              size="small"
              color="warning"
              startIcon={<ReactionRemoveIcon />}
              disabled={selectedCount === 0 || isOperationRunning || !selectedMessages.some((m) =>
                (m.reactions || []).some((r) => canManageMessages || r.me)
              )}
              onClick={() => setReactionRemovalOpen(true)}
            >
              Remove Reactions
            </Button>
          )}
        </Box>
      </Paper>

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        messageCount={selectedCount}
      />

      <EditMessageModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleEdit}
        message={singleMessage}
        messages={selectedMessages}
        messageCount={selectedCount}
      />

      <EmbedModal
        open={embedModalOpen}
        onClose={() => setEmbedModalOpen(false)}
        message={singleMessage}
        formattingContext={formattingContext}
      />

      {onBatchRemoveReactions && (
        <ReactionRemovalModal
          open={reactionRemovalOpen}
          onClose={() => setReactionRemovalOpen(false)}
          selectedMessages={selectedMessages}
          canManageMessages={canManageMessages}
          currentUserId={currentUserId}
          currentUsername={currentUsername}
          fetchDelayMs={fetchDelayMs}
          onConfirm={onBatchRemoveReactions}
          onFetchReactingUsers={onFetchReactingUsers}
        />
      )}

      {onBatchAddReactions && (
        <AddReactionsModal
          open={addReactionsOpen}
          onClose={() => setAddReactionsOpen(false)}
          selectedMessages={selectedMessages}
          guildEmojis={guildEmojis}
          onConfirm={onBatchAddReactions}
        />
      )}
    </>
  );
};

export default MessageActions;
