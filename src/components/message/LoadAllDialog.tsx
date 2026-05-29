import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useAppSelector } from '@/app/hooks';
import {
  selectActiveMessages,
  selectActiveTab,
  selectActiveSearchCriteria,
  selectActivePagination,
} from '@features/message/messageSlice';
import { countActiveFilters } from 'discrub-core/filtering';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';

interface LoadAllDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  contextLabel: string;
}

/**
 * LoadAllDialog component - confirmation dialog before loading all messages
 */
const LoadAllDialog = ({ open, onClose, onConfirm, contextLabel }: LoadAllDialogProps) => {
  const messages = useAppSelector(selectActiveMessages);
  const activeTab = useAppSelector(selectActiveTab);
  const searchCriteria = useAppSelector(selectActiveSearchCriteria);
  const pagination = useAppSelector(selectActivePagination);
  const label = activeTab ? 'thread' : contextLabel;
  const labelPlural = activeTab ? 'threads' : `${contextLabel}s`;

  const isFilteredSearch =
    pagination.mode === 'search' && !!searchCriteria && countActiveFilters(searchCriteria) > 0;
  const filterCount = isFilteredSearch && searchCriteria
    ? countActiveFilters(searchCriteria)
    : 0;

  const title = isFilteredSearch ? 'Load All Filtered Messages' : 'Load All Messages';
  const alertCopy = isFilteredSearch
    ? `This will load every message in this ${label} that matches your active filter${filterCount === 1 ? '' : 's'} (${filterCount} active). Clear filters first if you want every message.`
    : `This will load all messages from this ${label}, which may take a significant amount of time for large ${labelPlural}.`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          {title}
        </Box>
        <DialogCloseIcon onClose={onClose} />
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {alertCopy}
        </Alert>
        <DialogContentText>
          Currently loaded: <strong>{messages.length}</strong> messages
        </DialogContentText>
        <DialogContentText sx={{ mt: 1 }}>
          {isFilteredSearch ? 'Loading all filtered messages will:' : 'Loading all messages will:'}
        </DialogContentText>
        <Box component="ul" sx={{ mt: 1, pl: 3 }}>
          <li>
            <Typography variant="body2">
              Fetch messages in batches of 100 with delays to avoid rate limiting
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              May take several minutes for {labelPlural} with thousands of messages
            </Typography>
          </li>
          <li>
            <Typography variant="body2">Disable infinite scroll</Typography>
          </li>
        </Box>
        <DialogContentText sx={{ mt: 2 }}>
          Are you sure you want to continue?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={onConfirm} variant="contained" color="primary">
          Load All
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoadAllDialog;
