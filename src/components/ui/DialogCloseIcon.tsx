import { IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface DialogCloseIconProps {
  onClose: () => void;
  disabled?: boolean;
  /** Override the default `aria-label` ("Close"). */
  label?: string;
}

/**
 * Standardized dialog close affordance: small X icon, top-right of the
 * containing header. Place inside a DialogTitle (or a custom header that
 * has `position: relative`, which DialogTitle implicitly does).
 *
 * Use alongside an actions-row "Cancel" button on workflow dialogs;
 * info-only dialogs may rely on this alone.
 */
const DialogCloseIcon = ({ onClose, disabled = false, label = 'Close' }: DialogCloseIconProps) => (
  <IconButton
    onClick={onClose}
    aria-label={label}
    size="small"
    disabled={disabled}
    sx={{
      position: 'absolute',
      top: 8,
      right: 8,
      color: 'text.disabled',
      zIndex: 1,
      '&:hover': { color: 'text.secondary' },
    }}
  >
    <CloseIcon fontSize="small" />
  </IconButton>
);

export default DialogCloseIcon;
