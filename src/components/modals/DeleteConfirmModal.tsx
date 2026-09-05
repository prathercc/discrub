import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  alpha,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          animation: 'fade-in-scale 300ms ease',
          backgroundImage: (theme: Theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.08)} 0%, transparent 100%), linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 100%)`,
        },
      }}
    >
      <DialogTitle sx={{ pr: 5 }}>
        {t('deleteModal.title')}
        <DialogCloseIcon onClose={onClose} />
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          {t('deleteModal.confirm', { count: messageCount })}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t('deleteModal.cannotUndo')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('deleteModal.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
        >
          {t('deleteModal.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmModal;
