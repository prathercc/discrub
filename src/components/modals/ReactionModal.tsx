import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Avatar,
  IconButton,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  DeleteSweep as DeleteAllIcon,
} from '@mui/icons-material';
import type { Message, User } from 'discrub-core/types/discord-types';
import { getEmojiKey } from '@/utils/emojiUtils';
import DiscordEmoji from '@components/ui/DiscordEmoji';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';

interface ReactionModalProps {
  open: boolean;
  onClose: () => void;
  message: Message | null;
  onDeleteReaction?: (emoji: string, userId: string) => Promise<void>;
  onFetchReactingUsers?: (emoji: string) => Promise<User[]>;
  canManageMessages?: boolean;
  currentUserId?: string;
  onBulkDeleteAllReactions?: () => Promise<void>;
  onBulkDeleteReactionsForEmoji?: (emoji: string) => Promise<void>;
}

/**
 * ReactionModal - displays and manages message reactions in a two-panel layout
 */
const ReactionModal = ({
  open,
  onClose,
  message,
  onDeleteReaction,
  onFetchReactingUsers,
  canManageMessages,
  currentUserId,
  onBulkDeleteAllReactions,
  onBulkDeleteReactionsForEmoji,
}: ReactionModalProps) => {
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [reactingUsers, setReactingUsers] = useState<Record<string, User[]>>({});
  const [loadingEmoji, setLoadingEmoji] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [removedEmojiKeys, setRemovedEmojiKeys] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const reactions = message?.reactions;
  const hasReactions = reactions && reactions.length > 0;


  // Auto-select first emoji on open
  useEffect(() => {
    if (open && hasReactions && !selectedEmoji) {
      const firstKey = getEmojiKey(reactions[0].emoji);
      setSelectedEmoji(firstKey);
      if (onFetchReactingUsers) {
        setLoadingEmoji(firstKey);
        onFetchReactingUsers(firstKey)
          .then((users) => {
            setReactingUsers((prev) => ({ ...prev, [firstKey]: users }));
          })
          .catch(() => {})
          .finally(() => setLoadingEmoji(null));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional trigger set
  }, [open, hasReactions]);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setSelectedEmoji(null);
      setReactingUsers({});
      setLoadingEmoji(null);
      setDeletingUserId(null);
      setRemovedEmojiKeys(new Set());
      setBulkDeleting(false);
    }
  }, [open]);

  if (!message || !hasReactions) {
    return null;
  }

  const handleTabClick = async (emoji: { id?: string | null; name?: string | null }) => {
    const key = getEmojiKey(emoji);
    setSelectedEmoji(key);

    if (onFetchReactingUsers) {
      setLoadingEmoji(key);
      try {
        const users = await onFetchReactingUsers(key);
        setReactingUsers((prev) => ({ ...prev, [key]: users }));
      } catch {
        // Error handled by parent
      } finally {
        setLoadingEmoji(null);
      }
    }
  };

  const removeEmojiTab = (key: string) => {
    const newRemoved = new Set(removedEmojiKeys);
    newRemoved.add(key);
    setRemovedEmojiKeys(newRemoved);

    const remaining = (reactions || []).filter(
      (r) => !newRemoved.has(getEmojiKey(r.emoji)),
    );
    if (remaining.length === 0) {
      onClose();
    } else {
      const nextKey = getEmojiKey(remaining[0].emoji);
      setSelectedEmoji(nextKey);
      if (onFetchReactingUsers) {
        setLoadingEmoji(nextKey);
        onFetchReactingUsers(nextKey)
          .then((users) => {
            setReactingUsers((prev) => ({ ...prev, [nextKey]: users }));
          })
          .catch(() => {})
          .finally(() => setLoadingEmoji(null));
      }
    }
  };

  const handleDeleteReaction = async (emojiKey: string, userId: string) => {
    if (!onDeleteReaction) return;
    setDeletingUserId(userId);
    await onDeleteReaction(emojiKey, userId);
    setDeletingUserId(null);
    const remaining = (reactingUsers[emojiKey] || []).filter(
      (u) => u.id !== userId,
    );
    setReactingUsers((prev) => ({ ...prev, [emojiKey]: remaining }));
    if (remaining.length === 0) {
      removeEmojiTab(emojiKey);
    }
  };

  const handleDeleteAll = async (emojiKey: string) => {
    if (!onDeleteReaction) return;
    const users = [...(reactingUsers[emojiKey] || [])];
    for (const user of users) {
      setDeletingUserId(user.id);
      await onDeleteReaction(emojiKey, user.id);
      const remaining = (reactingUsers[emojiKey] || []).filter(
        (u) => u.id !== user.id,
      );
      setReactingUsers((prev) => ({ ...prev, [emojiKey]: remaining }));
    }
    setDeletingUserId(null);
    removeEmojiTab(emojiKey);
  };

  const handleBulkDeleteForEmoji = async (emojiKey: string) => {
    if (!onBulkDeleteReactionsForEmoji) return;
    setBulkDeleting(true);
    await onBulkDeleteReactionsForEmoji(emojiKey);
    setBulkDeleting(false);
    removeEmojiTab(emojiKey);
  };

  const handleBulkDeleteAll = async () => {
    if (!onBulkDeleteAllReactions) return;
    setBulkDeleting(true);
    await onBulkDeleteAllReactions();
    setBulkDeleting(false);
    onClose();
  };


  const isInteractive = !!onDeleteReaction;
  const isBusy = deletingUserId !== null || bulkDeleting;
  const selectedUsers = selectedEmoji ? reactingUsers[selectedEmoji] || [] : [];
  const isLoading = selectedEmoji === loadingEmoji;
  const visibleReactions = (reactions || []).filter(
    (r) => !removedEmojiKeys.has(getEmojiKey(r.emoji)),
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          animation: 'fade-in-scale 300ms ease',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, pr: 5 }}>
        Reactions
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {canManageMessages && onBulkDeleteAllReactions && (
            <Button
              size="small"
              color="error"
              disabled={isBusy}
              startIcon={bulkDeleting ? <CircularProgress size={14} /> : <DeleteAllIcon />}
              onClick={handleBulkDeleteAll}
            >
              Remove All
            </Button>
          )}
        </Box>
        <DialogCloseIcon onClose={onClose} />
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', minHeight: 200, maxHeight: 400 }}>
          {/* Left panel — emoji tabs */}
          <Box
            sx={{
              width: 120,
              flexShrink: 0,
              borderRight: '1px solid',
              borderColor: 'divider',
              overflowY: 'auto',
            }}
          >
            <List disablePadding>
              {visibleReactions.map((reaction, index) => {
                const key = getEmojiKey(reaction.emoji);
                return (
                  <ListItemButton
                    key={index}
                    selected={selectedEmoji === key}
                    onClick={() => handleTabClick(reaction.emoji)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 1.5,
                      px: 1.5,
                    }}
                  >
                    <DiscordEmoji emoji={reaction.emoji} />
                    <Typography variant="caption" color="text.secondary">
                      {reaction.count}
                    </Typography>
                  </ListItemButton>
                );
              })}
            </List>
          </Box>

          {/* Right panel — user list */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 0.5 }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : selectedEmoji && !onFetchReactingUsers ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  User list not available
                </Typography>
              </Box>
            ) : selectedUsers.length > 0 ? (
              <>
                <List dense disablePadding>
                  {selectedUsers.map((user) => (
                    <ListItem
                      key={user.id}
                      secondaryAction={
                        isInteractive && (canManageMessages || user.id === currentUserId) && (
                          deletingUserId === user.id ? (
                            <CircularProgress size={18} sx={{ mr: 0.5 }} />
                          ) : (
                            <IconButton
                              edge="end"
                              aria-label="delete reaction"
                              size="small"
                              color="error"
                              disabled={isBusy}
                              onClick={() => handleDeleteReaction(selectedEmoji!, user.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )
                        )
                      }
                    >
                      <ListItemAvatar>
                        <Avatar
                          src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=32` : undefined}
                          sx={{ width: 32, height: 32 }}
                        >
                          {(user.username || '?')[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={user.global_name || user.username}
                        secondary={user.username}
                      />
                    </ListItem>
                  ))}
                </List>
                {selectedUsers.length > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1, pb: 0.5 }}>
                    {canManageMessages && onBulkDeleteReactionsForEmoji ? (
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        disabled={isBusy}
                        startIcon={bulkDeleting ? <CircularProgress size={14} /> : <DeleteAllIcon />}
                        onClick={() => handleBulkDeleteForEmoji(selectedEmoji!)}
                      >
                        Remove All
                      </Button>
                    ) : isInteractive && canManageMessages ? (
                      <Button
                        size="small"
                        color="error"
                        disabled={isBusy}
                        startIcon={<DeleteAllIcon />}
                        onClick={() => handleDeleteAll(selectedEmoji!)}
                      >
                        Remove All
                      </Button>
                    ) : null}
                  </Box>
                )}
              </>
            ) : selectedEmoji && !isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No users
                </Typography>
              </Box>
            ) : null}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReactionModal;
