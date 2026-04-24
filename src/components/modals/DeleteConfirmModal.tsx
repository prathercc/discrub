import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  messageCount: number;
}

/**
 * DeleteConfirmModal - confirmation dialog for deleting messages
 */
const DeleteConfirmModal = ({
  open,
  onClose,
  onConfirm,
  messageCount,
}: DeleteConfirmModalProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          animation: 'fade-in-scale 300ms ease',
          backgroundImage:
            'linear-gradient(135deg, rgba(240, 71, 71, 0.08) 0%, transparent 100%), linear-gradient(135deg, rgba(114, 137, 218, 0.08) 0%, transparent 100%)',
        },
      }}
    >
      <DialogTitle>Delete Messages</DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          Are you sure you want to delete {messageCount} message{messageCount !== 1 ? 's' : ''}?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmModal;
