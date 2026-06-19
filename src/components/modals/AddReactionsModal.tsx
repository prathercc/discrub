import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
} from '@mui/material';
import { AddReaction as AddReactionIcon } from '@mui/icons-material';
import type { Emoji, Message } from 'discrub-core/types/discord-types';
import { getEmojiKey } from '@/utils/emojiUtils';
import DiscordEmoji from '@components/ui/DiscordEmoji';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';
import ReactionEmojiPicker from '@components/ui/ReactionEmojiPicker';
import type { SelectableEmoji } from '@/utils/emojiDataset';

interface AddReactionsModalProps {
  open: boolean;
  onClose: () => void;
  selectedMessages: Message[];
  guildEmojis?: Emoji[];
  onConfirm: (params: { messages: Message[]; emojis: SelectableEmoji[] }) => void;
}

/**
 * AddReactionsModal — bulk-add one or more reactions to the selected messages
 * (Backlog #202). Hosts the ReactionEmojiPicker, previews the chosen emojis, and
 * shows a live "M messages × N emojis = T reactions" cost before confirming.
 */
const AddReactionsModal = ({
  open,
  onClose,
  selectedMessages,
  guildEmojis = [],
  onConfirm,
}: AddReactionsModalProps) => {
  const [selectedEmojis, setSelectedEmojis] = useState<SelectableEmoji[]>([]);

  // Reset the selection each time the modal opens.
  useEffect(() => {
    if (open) setSelectedEmojis([]);
  }, [open]);

  const toggleEmoji = (emoji: SelectableEmoji) => {
    const key = getEmojiKey(emoji);
    setSelectedEmojis((prev) =>
      prev.some((e) => getEmojiKey(e) === key)
        ? prev.filter((e) => getEmojiKey(e) !== key)
        : [...prev, emoji]
    );
  };

  const messageCount = selectedMessages.length;
  const emojiCount = selectedEmojis.length;
  const totalReactions = messageCount * emojiCount;

  const handleConfirm = () => {
    if (!emojiCount || !messageCount) return;
    onConfirm({ messages: selectedMessages, emojis: selectedEmojis });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 5 }}>
        Add Reactions
        <DialogCloseIcon onClose={onClose} />
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
          <ReactionEmojiPicker
            selected={selectedEmojis}
            onToggle={toggleEmoji}
            guildEmojis={guildEmojis}
          />

          {/* Selected preview */}
          {emojiCount > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                Selected:
              </Typography>
              {selectedEmojis.map((emoji) => (
                <DiscordEmoji key={getEmojiKey(emoji)} emoji={emoji} size={20} />
              ))}
            </Box>
          )}

          {/* Live cost */}
          <Typography variant="body2" color={totalReactions > 0 ? 'text.primary' : 'text.secondary'}>
            {totalReactions > 0
              ? `${messageCount} message${messageCount !== 1 ? 's' : ''} × ${emojiCount} emoji${emojiCount !== 1 ? 's' : ''} = ${totalReactions} reaction${totalReactions !== 1 ? 's' : ''}`
              : 'Pick at least one emoji to add.'}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<AddReactionIcon />}
          onClick={handleConfirm}
          disabled={!emojiCount || !messageCount}
        >
          Add{totalReactions > 0 ? ` ${totalReactions}` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddReactionsModal;
