import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  useTheme,
} from '@mui/material';
import {
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  bulkExportChannels,
  bulkExportDMs,
  resetExport,
  initializeExportFromSettings,
  selectExport,
} from '@features/export/exportSlice';
import type { ExportConfig } from '@features/export/exportTypes';
import type { Channel } from 'discrub-core/types/discord-types';
import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import { selectAuthToken } from '@features/auth/authSlice';
import { selectSettings } from '@features/app/appSlice';
import { selectIsHeavyOperationRunning } from '@features/app/operationSelectors';
import { selectCachedUserMap } from '@features/cache/cacheSlice';
import { selectCurrentUser } from '@features/user/userSlice';
import ExportSettingsAccordion from './ExportSettingsAccordion';
import ExportSummaryChip from './ExportSummaryChip';
import PresetSelector from './PresetSelector';
import FilterModal, { countActiveFilters } from '@components/search/FilterModal';
import DialogCloseIcon from '@components/ui/DialogCloseIcon';
import BulkFilterButton from '@components/search/BulkFilterButton';
import SelectedChannelsPill from '@components/dialogs/SelectedChannelsPill';

interface BulkExportDialogProps {
  open: boolean;
  onClose: () => void;
  channels: Channel[];
  mode: 'channels' | 'dms';
  guildId?: string | null;
}

/**
 * BulkExportDialog - configure and export multiple channels/DMs
 */
const BulkExportDialog = ({ open, onClose, channels, mode, guildId }: BulkExportDialogProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const dispatch = useAppDispatch();
  const exportState = useAppSelector(selectExport);
  const token = useAppSelector(selectAuthToken);
  const settings = useAppSelector(selectSettings);
  const isOperationRunning = useAppSelector(selectIsHeavyOperationRunning);
  const cachedUserMap = useAppSelector(selectCachedUserMap);
  const currentUser = useAppSelector(selectCurrentUser);
  // Initialize export preferences from settings as soon as they're
  // available. Settings load is async (IDB-backed) so this effect must
  // re-fire when null → populated to avoid the dialog opening with
  // unrelated slice-default values that get later "restored" out from
  // under the user. The reducer is idempotent and the effect short-
  // circuits once settings is non-null + initialized.
  const initFromSettings = useRef(false);
  useEffect(() => {
    if (initFromSettings.current) return;
    if (settings === null) return;
    initFromSettings.current = true;
    dispatch(initializeExportFromSettings(settings));
  }, [settings, dispatch]);

  // Reset stale export progress when dialog opens (preserves user's format/template choices)
  useEffect(() => {
    if (open) {
      dispatch(resetExport());
    }
  }, [open, dispatch]);

  const [filterCriteria, setFilterCriteria] = useState<SearchCriteria | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  // Bumped each time we open the filter modal. Forces FilterModal to
  // remount so its internal useState seeds from the current
  // savedSearchCriteria — otherwise typed-but-not-applied values
  // survive outer-dialog close/reopen cycles.
  const [filterModalKey, setFilterModalKey] = useState(0);

  // Reset filter state when the dialog re-opens — each bulk export
  // session starts from an unfiltered state by default.
  useEffect(() => {
    if (open) {
      setFilterCriteria(null);
      setFilterModalOpen(false);
    }
  }, [open]);

  const filterCount = filterCriteria ? countActiveFilters(filterCriteria) : 0;

  const openFilterModal = () => {
    setFilterModalKey((k) => k + 1);
    setFilterModalOpen(true);
  };

  const isMediaOnly = exportState.exportFormat === 'media';

  const handleExport = () => {
    if (!token || channels.length === 0 || isOperationRunning) return;

    // Build ExportConfig — dateFormat/timeFormat from settings, rest from exportState
    const exportConfig: ExportConfig = {
      artistMode: exportState.artistMode,
      sortOrder: exportState.sortOrder,
      previewMedia: exportState.previewMedia,
      dateFormat: settings?.dateFormat || 'MM/dd/yyyy',
      timeFormat: settings?.timeFormat || 'h:mm aa',
      exportTemplate: exportState.exportTemplate,
    };

    const params = {
      channels,
      token,
      format: exportState.exportFormat,
      messagesPerPage: exportState.messagesPerPage,
      separateThreads: exportState.separateThreads,
      includeMedia: isMediaOnly ? true : exportState.includeMedia,
      guildId: guildId || null,
      mediaConfig: (isMediaOnly || exportState.includeMedia) ? exportState.mediaConfig : undefined,
      exportConfig,
      searchCriteria: filterCriteria,
    };

    if (mode === 'channels') {
      dispatch(bulkExportChannels(params));
    } else {
      dispatch(bulkExportDMs(params));
    }

    // Close dialog immediately — progress shown in TopBar
    onClose();
  };

  const handleClose = () => {
    dispatch(resetExport());
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 5 }}>
        Bulk Export {mode === 'channels' ? 'Channels' : 'DMs'}
        <Chip
          label={`${channels.length} selected`}
          size="small"
          sx={{
            ml: 1,
            verticalAlign: 'middle',
            backgroundColor: 'rgba(88, 101, 242, 0.2)',
            color: isDark ? '#c9d1ff' : 'primary.main',
            fontWeight: 500,
          }}
        />
        <DialogCloseIcon onClose={handleClose} />
      </DialogTitle>
      <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <SelectedChannelsPill channels={channels} mode={mode} />

          <PresetSelector />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Narrow messages (optional)
            </Typography>
            <BulkFilterButton
              filterCount={filterCount}
              onOpen={openFilterModal}
              helperText="Limit the export to messages matching filters (date range, content, author, attachments, mentions). Leave empty to export everything."
            />
          </Box>

          <ExportSettingsAccordion isBulk={true} />

          {exportState.exportError && (
            <Typography color="error" variant="body2">
              Error: {exportState.exportError}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 0.5, px: 2, py: 1 }}>
        <ExportSummaryChip />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant="outlined" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            variant="contained"
            startIcon={<DownloadIcon />}
            disabled={channels.length === 0 || isOperationRunning}
          >
            Export {channels.length} {mode === 'channels' ? 'Channel' : 'DM'}{channels.length !== 1 ? 's' : ''}
          </Button>
        </Box>
      </DialogActions>

      <FilterModal
        key={filterModalKey}
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        onServerSearch={(criteria) => {
          setFilterCriteria(criteria);
          setFilterModalOpen(false);
        }}
        onRefine={() => { /* bulk export has no client-side refine */ }}
        onClearSearch={() => {
          setFilterCriteria(null);
          setFilterModalOpen(false);
        }}
        onClearRefine={() => { /* no-op */ }}
        savedSearchCriteria={filterCriteria ?? undefined}
        cachedUserMap={cachedUserMap}
        currentUserId={currentUser?.id || ''}
        hideRefineSection
        applyButtonLabel="Apply filters"
      />
    </Dialog>
  );
};

export default BulkExportDialog;
