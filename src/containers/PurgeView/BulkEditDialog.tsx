import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Alert,
  TextField,
  useTheme,
  alpha,
  lighten,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { Edit as EditIcon } from '@mui/icons-material';
import type { Channel } from 'discrub-core/types/discord-types';
import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';
import { selectIsHeavyOperationRunning } from '@features/app/operationSelectors';
import { selectCachedUserMap } from '@features/cache/cacheSlice';
import { selectCurrentUser } from '@features/user/userSlice';
import { bulkEditChannels } from '@features/message/messageSlice';
import { countActiveFilters } from 'discrub-core/filtering';
import FilterModal from '@components/search/FilterModal';
import BulkFilterButton from '@components/search/BulkFilterButton';
import SelectedChannelsPill from '@components/dialogs/SelectedChannelsPill';

interface BulkEditDialogProps {
  open: boolean;
  onClose: () => void;
  channels: Channel[];
  mode: 'channels' | 'dms';
  guildId?: string | null;
}

/**
 * Backlog #215 — multi-channel "Edit Messages".
 *
 * The single-channel Edit Messages flow lives in ServerView/EditMessageModal.
 * This dialog extends it to the multi-select channel scaffold (#155): every
 * message the current user authored across the selected channels is rewritten
 * to the same content. Discord only permits editing your own messages, so the
 * author target is locked to self — the optional FilterModal only narrows by
 * date / content, never author. Mirrors BulkPurgeDialog's shell.
 */
const BulkEditDialog = ({ open, onClose, channels, mode, guildId }: BulkEditDialogProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const dispatch = useAppDispatch();
  const isOperationRunning = useAppSelector(selectIsHeavyOperationRunning);
  const cachedUserMap = useAppSelector(selectCachedUserMap);
  const currentUser = useAppSelector(selectCurrentUser);
  const currentUserId = currentUser?.id || '';

  const [content, setContent] = useState('');
  const [filterCriteria, setFilterCriteria] = useState<SearchCriteria | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  // Bumped on each open so the keyed FilterModal remounts fresh (mirrors the
  // stale-typed-values fix in BulkPurgeDialog).
  const [filterModalKey, setFilterModalKey] = useState(0);

  const isDmMode = mode === 'dms';
  const contextLabel = isDmMode ? 'conversation' : 'channel';
  const contextLabelPlural = isDmMode ? 'conversations' : 'channels';
  const count = channels.length;
  const filterCount = filterCriteria ? countActiveFilters(filterCriteria) : 0;

  const openFilterModal = () => {
    setFilterModalKey((k) => k + 1);
    setFilterModalOpen(true);
  };

  const handleConfirm = () => {
    dispatch(bulkEditChannels({
      channels,
      content,
      guildId,
      searchCriteria: filterCriteria,
    }));
    onClose();
  };

  const confirmLabel = `Edit ${count} ${isDmMode ? 'DM' : 'Ch.'}${count !== 1 ? 's' : ''}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 5 }}>
        Edit {isDmMode ? 'DMs' : 'Channels'}
        <Chip
          label={`${count} selected`}
          size="small"
          sx={{
            ml: 1,
            verticalAlign: 'middle',
            backgroundColor: (theme: Theme) => alpha(theme.palette.cta.main, 0.2),
            color: (theme: Theme) => (isDark ? lighten(theme.palette.primary.main, 0.4) : theme.palette.primary.main),
            fontWeight: 500,
          }}
        />
        <DialogCloseIcon onClose={onClose} />
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <SelectedChannelsPill channels={channels} mode={isDmMode ? 'dms' : 'channels'} />

          <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
            Only messages you authored can be edited; Discord rejects edits to other
            people&rsquo;s messages, so those are skipped automatically.
          </Alert>

          <TextField
            label="New content"
            placeholder="The text every matched message will be rewritten to"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            inputProps={{ 'aria-label': 'New message content' }}
          />

          <Box>
            <BulkFilterButton
              filterCount={filterCount}
              onOpen={openFilterModal}
              helperText="Optional: narrow which of your messages to edit by date range or content."
            />
          </Box>

          <Alert severity="warning" variant="outlined">
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              This action is irreversible.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Every message you authored across {count} {count === 1 ? contextLabel : contextLabelPlural}
              {filterCount > 0 ? ' matching the filter' : ''} will be overwritten with the new content.
              The original text cannot be recovered.
            </Typography>
          </Alert>

          {/* #206: long edit runs benefit from the same foreground hint as purge. */}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Large edits can run for a while. Discrub keeps your screen awake, but for very
            long runs keep this tab in the foreground and turn off your browser&rsquo;s
            battery-saver / tab-sleep so edits aren&rsquo;t paused.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="primary"
          startIcon={<EditIcon />}
          disabled={count === 0 || content.trim().length === 0 || isOperationRunning}
        >
          {confirmLabel}
        </Button>
      </DialogActions>

      <FilterModal
        key={filterModalKey}
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        onServerSearch={(criteria) => {
          setFilterCriteria(criteria);
          setFilterModalOpen(false);
        }}
        onRefine={() => { /* bulk edit has no client-side refine */ }}
        onClearSearch={() => {
          setFilterCriteria(null);
          setFilterModalOpen(false);
        }}
        onClearRefine={() => { /* no-op */ }}
        savedSearchCriteria={filterCriteria ?? undefined}
        cachedUserMap={cachedUserMap}
        currentUserId={currentUserId}
        hideRefineSection
        applyButtonLabel="Apply filters"
        // Author is locked to the current user (edit only works on own
        // messages), so hide the author picker entirely.
        hideAuthorFilters
      />
    </Dialog>
  );
};

export default BulkEditDialog;
