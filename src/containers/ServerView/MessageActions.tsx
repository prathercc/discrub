import { useState } from 'react';
import { Paper, Box, Button, Chip, Tooltip } from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Code as CodeIcon,
  DeleteSweep as ReactionRemoveIcon,
} from '@mui/icons-material';
import type { Message, User } from 'discrub-core/types/discord-types';
import type { HtmlFormattingContext } from 'discrub-core/types/html-formatting-types';
import DeleteConfirmModal from '@components/modals/DeleteConfirmModal';
import EditMessageModal from '@components/modals/EditMessageModal';
import EmbedModal from '@components/modals/EmbedModal';
import ReactionRemovalModal from '@components/modals/ReactionRemovalModal';

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
  onFetchReactingUsers,
}: MessageActionsProps) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [embedModalOpen, setEmbedModalOpen] = useState(false);
  const [reactionRemovalOpen, setReactionRemovalOpen] = useState(false);

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
  const editBlockedByPermission = hasNonSelfSelection;
  const deleteLockReason = isDm
    ? 'You can only delete your own messages in DMs.'
    : 'You can only delete your own messages without Manage Messages permission in this channel.';
  const editLockReason = 'You can only edit your own messages. Discord blocks editing other users\' messages.';

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

          <Tooltip title={editBlockedByPermission ? editLockReason : ''} disableHoverListener={!editBlockedByPermission}>
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon />}
                disabled={selectedCount === 0 || (selectedCount > 1 && isOperationRunning) || editBlockedByPermission}
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
    </>
  );
};

export default MessageActions;
