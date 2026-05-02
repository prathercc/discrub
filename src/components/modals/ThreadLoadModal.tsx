import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
} from '@mui/material';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';

interface ThreadLoadModalProps {
  open: boolean;
  onClose: () => void;
  onLoad: (threadId: string) => void;
}

const ThreadLoadModal = ({ open, onClose, onLoad }: ThreadLoadModalProps) => {
  const [threadId, setThreadId] = useState('');

  const handleLoad = () => {
    const trimmed = threadId.trim();
    if (trimmed) {
      onLoad(trimmed);
      setThreadId('');
    }
  };

  const handleClose = () => {
    setThreadId('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && threadId.trim()) {
      handleLoad();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pr: 5 }}>
        Load Thread
        <DialogCloseIcon onClose={handleClose} />
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Enter a thread or forum post ID to load its messages.
          </Typography>
          <TextField
            autoFocus
            label="Thread / Forum Post ID"
            value={threadId}
            onChange={(e) => setThreadId(e.target.value.replace(/\D/g, ''))}
            onKeyDown={handleKeyDown}
            size="small"
            fullWidth
            placeholder="e.g. 1234567890"
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleLoad}
          variant="contained"
          disabled={!threadId.trim()}
        >
          Load
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ThreadLoadModal;
