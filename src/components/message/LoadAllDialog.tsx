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
import { Trans } from 'react-i18next';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const activeTab = useAppSelector(selectActiveTab);
  const searchCriteria = useAppSelector(selectActiveSearchCriteria);
  const pagination = useAppSelector(selectActivePagination);
  const scope = activeTab ? 'thread' : contextLabel === 'conversation' ? 'dm' : 'channel';

  const isFilteredSearch =
    pagination.mode === 'search' && !!searchCriteria && countActiveFilters(searchCriteria) > 0;
  const filterCount = isFilteredSearch && searchCriteria
    ? countActiveFilters(searchCriteria)
    : 0;

  const title = isFilteredSearch ? t('loadAll.titleFiltered') : t('loadAll.title');
  const alertCopy = isFilteredSearch
    ? t('loadAll.alertFiltered', { count: filterCount, scope: t('loadAll.scope', { context: scope }) })
    : t('loadAll.alert', { context: scope });

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
          <Trans i18nKey="loadAll.currentlyLoaded" values={{ count: messages.length }} components={{ strong: <strong /> }} />
        </DialogContentText>
        <DialogContentText sx={{ mt: 1 }}>
          {isFilteredSearch ? t('loadAll.willFiltered') : t('loadAll.will')}
        </DialogContentText>
        <Box component="ul" sx={{ mt: 1, pl: 3 }}>
          <li>
            <Typography variant="body2">
              {t('loadAll.bulletBatches')}
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              {t('loadAll.bulletMinutes', { context: scope })}
            </Typography>
          </li>
          <li>
            <Typography variant="body2">{t('loadAll.bulletScroll')}</Typography>
          </li>
        </Box>
        <DialogContentText sx={{ mt: 2 }}>
          {t('loadAll.confirmQuestion')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button onClick={onConfirm} variant="contained" color="primary">
          {t('loadAll.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoadAllDialog;
