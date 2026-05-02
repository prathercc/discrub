import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  Collapse,
} from '@mui/material';
import type { Message } from 'discrub-core/types/discord-types';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';

interface EditMessageModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (newContent: string) => void;
  message: Message | null;
  messages?: Message[];
  messageCount: number;
}

/**
 * EditMessageModal - dialog for editing one or more messages
 * Single mode (messageCount === 1): pre-populates with existing content
 * Bulk mode (messageCount > 1): empty field, sets all messages to the same content
 */
const hasAttachmentsOrEmbeds = (msg: Message) =>
  (msg.attachments && msg.attachments.length > 0) ||
  (msg.embeds && msg.embeds.length > 0);

const EditMessageModal = ({
  open,
  onClose,
  onSave,
  message,
  messages = [],
  messageCount,
}: EditMessageModalProps) => {
  const [content, setContent] = useState(message?.content || '');
  const isBulkMode = messageCount > 1;
  const isEmpty = !content.trim();

  // In single mode, check the one message; in bulk mode, check if any lack attachments/embeds
  const hasBareBareMessages = isBulkMode
    ? messages.some((m) => !hasAttachmentsOrEmbeds(m))
    : message != null && !hasAttachmentsOrEmbeds(message);
  const wouldFailEmpty = isEmpty && hasBareBareMessages;

  useEffect(() => {
    if (open) {
      setContent(message?.content || '');
    }
  }, [open, message]);

  const handleSave = () => {
    onSave(content);
    if (isBulkMode) setContent('');
  };

  const handleClose = () => {
    if (isBulkMode) setContent('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          animation: 'fade-in-scale 300ms ease',
        },
      }}
    >
      <DialogTitle sx={{ pr: 5 }}>
        {isBulkMode ? 'Bulk Edit' : 'Edit Message'}
        <DialogCloseIcon onClose={handleClose} />
      </DialogTitle>
      <DialogContent>
        {isBulkMode && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Editing {messageCount} message{messageCount !== 1 ? 's' : ''}
          </Typography>
        )}
        <TextField
          autoFocus={isBulkMode}
          fullWidth
          multiline
          {...(isBulkMode ? { minRows: 3 } : { rows: 6 })}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          label={isBulkMode ? 'New content' : 'Message Content'}
          variant="outlined"
          sx={isBulkMode ? undefined : { mt: 2 }}
        />
        <Collapse in={wouldFailEmpty}>
          <Alert severity="error" sx={{ mt: 2 }}>
            {isBulkMode
              ? 'Some selected messages have no attachments or embeds. Discord requires non-empty content for these messages.'
              : 'This message has no attachments or embeds. Discord requires non-empty content.'}
          </Alert>
        </Collapse>
        <Collapse in={isEmpty && !wouldFailEmpty}>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Saving with empty content will clear message text. Attachments and embeds will be preserved.
          </Alert>
        </Collapse>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={wouldFailEmpty}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditMessageModal;
