import { useState, useEffect, useMemo } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Checkbox,
  Box,
  Collapse,
  Alert,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  setExportFormat,
  setMessagesPerPage,
  setSeparateThreads,
  setIncludeMedia,
  setMediaConfig,
  setArtistMode,
  setSortOrder,
  setPreviewMedia,
  setExportTemplate,
  selectExport,
} from '@features/export/exportSlice';
import type { ExportFormat, ExportTemplate } from '@features/export/exportTypes';
import type { MediaCategorySummary } from '@/utils/mediaUtils';
import { formatBytes, getTotalMediaSize, SIZE_WARNING_THRESHOLD } from '@/utils/mediaUtils';
import MediaBreakdownBar from './MediaBreakdownBar';
import MediaPreviewPanel from './MediaPreviewPanel';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { isExtensionMode } from '@/extension/messaging';
import { selectSettings, updateSetting } from '@features/app/appSlice';

interface ExportSettingsAccordionProps {
  isBulk: boolean;
  mediaSummary?: MediaCategorySummary[];
  onFormatChange?: (format: ExportFormat) => void;
  /**
   * Hide options that only apply to live Discord channels. Packages
   * don't carry thread-reference metadata in their CSVs, and package
   * rehydration handles reactions via its own API loop.
   */
  packageMode?: boolean;
}

const ExportSettingsAccordion = ({ isBulk, mediaSummary, onFormatChange, packageMode = false }: ExportSettingsAccordionProps) => {
  const dispatch = useAppDispatch();
  const exportState = useAppSelector(selectExport);
  const settings = useAppSelector(selectSettings);

  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    formatOutput: true,
    content: false,
    media: false,
  });

  const isMediaOnly = exportState.exportFormat === 'media';
  const mediaEnabled = isMediaOnly || exportState.includeMedia;

  // Filter summaries by enabled media types
  const enabledSummaries = useMemo(() => {
    if (!mediaSummary) return [];
    const { images, videos, audio, other } = exportState.mediaConfig;
    return mediaSummary.filter((s) => {
      if (s.category === 'images') return images;
      if (s.category === 'videos') return videos;
      if (s.category === 'audio') return audio;
      if (s.category === 'other') return other;
      return false;
    });
  }, [mediaSummary, exportState.mediaConfig]);

  const enabledSize = useMemo(() => getTotalMediaSize(enabledSummaries), [enabledSummaries]);
  const showSizeWarning = mediaEnabled && enabledSize > SIZE_WARNING_THRESHOLD;
  const largestCategory = useMemo(
    () => enabledSummaries.length > 0
      ? enabledSummaries.reduce((a, b) => (a.totalBytes > b.totalBytes ? a : b))
      : null,
    [enabledSummaries]
  );

  // Auto-expand media section when media is enabled
  useEffect(() => {
    if (mediaEnabled && !expandedPanels.media) {
      setExpandedPanels((prev) => ({ ...prev, media: true }));
    }
  }, [mediaEnabled]);

  const handlePanelChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedPanels((prev) => ({ ...prev, [panel]: isExpanded }));
  };

  const handleFormatChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFormat = event.target.value as ExportFormat;
    dispatch(setExportFormat(newFormat));

    // When switching away from Media Only, restore includeMedia from settings
    if (newFormat !== 'media' && isMediaOnly) {
      const includeMedia = settings?.[DiscrubSetting.EXPORT_DOWNLOAD_MEDIA] === 'true';
      dispatch(setIncludeMedia(includeMedia));
    }

    onFormatChange?.(newFormat);
  };

  const handleMessagesPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    if (value > 0) {
      dispatch(setMessagesPerPage(value));
    }
  };

  const getMediaLabel = (category: string) => {
    if (!mediaSummary || isBulk) return category;

    const summary = mediaSummary.find((s) => s.category === category.toLowerCase());
    if (!summary) return `${category} (0 files)`;

    const parts: string[] = [];
    if (summary.count > 0) {
      parts.push(`${summary.count} file${summary.count !== 1 ? 's' : ''}, ${formatBytes(summary.totalBytes)}`);
    }
    if (summary.embedCount > 0) {
      if (summary.count > 0) {
        parts.push(`+ ${summary.embedCount} embed${summary.embedCount !== 1 ? 's' : ''}`);
      } else {
        parts.push(`${summary.embedCount} embed${summary.embedCount !== 1 ? 's' : ''}`);
      }
    }

    if (parts.length > 0) return `${category} (${parts.join(' ')})`;
    return `${category} (0 files)`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Format & Output */}
      <Accordion
        expanded={expandedPanels.formatOutput}
        onChange={handlePanelChange('formatOutput')}
        TransitionProps={{ unmountOnExit: false }}
        disableGutters
        elevation={0}
        sx={{ '&:before': { display: 'none' }, backgroundColor: 'transparent' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2">Format & Output</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl component="fieldset">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {[
                  { value: 'html', label: isBulk ? 'HTML' : 'HTML - Styled webpage with avatars and formatting' },
                  { value: 'csv', label: isBulk ? 'CSV' : 'CSV - Spreadsheet compatible format' },
                  { value: 'json', label: isBulk ? 'JSON' : 'JSON - Raw data format for analysis' },
                  { value: 'media', label: isBulk ? 'Media Only' : 'Media Only - Download attachments without message content' },
                ].map(({ value, label }) => (
                  <FormControlLabel
                    key={value}
                    value={value}
                    control={
                      <Checkbox
                        checked={exportState.exportFormat === value}
                        onChange={handleFormatChange}
                        value={value}
                        size="small"
                        sx={{ '& .MuiSvgIcon-root': { fontSize: 18 } }}
                      />
                    }
                    label={<Typography variant="body2">{label}</Typography>}
                    sx={{ ml: 0 }}
                  />
                ))}
              </Box>
            </FormControl>

            <TextField
              label="Messages per page"
              type="number"
              value={exportState.messagesPerPage}
              onChange={handleMessagesPerPageChange}
              disabled={isMediaOnly}
              size="small"
              inputProps={{ min: 1, max: 1000 }}
              helperText="Split large exports into multiple pages"
            />

            <FormControl size="small">
              <InputLabel>Sort Order</InputLabel>
              <Select
                value={exportState.sortOrder}
                label="Sort Order"
                onChange={(e) => dispatch(setSortOrder(e.target.value as 'ascending' | 'descending'))}
              >
                <MenuItem value="ascending">Oldest First</MenuItem>
                <MenuItem value="descending">Newest First</MenuItem>
              </Select>
            </FormControl>

            {exportState.exportFormat === 'html' && (
              <FormControl size="small">
                <InputLabel>Template</InputLabel>
                <Select
                  value={exportState.exportTemplate}
                  label="Template"
                  onChange={(e) => {
                    const newTemplate = e.target.value as ExportTemplate;
                    dispatch(setExportTemplate(newTemplate));
                    dispatch(updateSetting({ key: DiscrubSetting.EXPORT_TEMPLATE, value: newTemplate }));
                  }}
                >
                  <MenuItem value="standard">Standard</MenuItem>
                  <MenuItem value="discord">Discord Layout</MenuItem>
                </Select>
                {exportState.exportTemplate === 'discord' && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    Wraps your export in a Discord-like interface with server sidebar and channel navigation
                  </Typography>
                )}
              </FormControl>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Content — live channels only. Package CSVs don't carry thread
          refs, so the separate-threads pipeline has nothing to fetch. */}
      {!packageMode && (
        <Accordion
          expanded={expandedPanels.content}
          onChange={handlePanelChange('content')}
          TransitionProps={{ unmountOnExit: false }}
          disableGutters
          elevation={0}
          sx={{ '&:before': { display: 'none' }, backgroundColor: 'transparent' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2">Content</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportState.separateThreads}
                  onChange={(e) => {
                    dispatch(setSeparateThreads(e.target.checked));
                  }}
                  disabled={isMediaOnly}
                />
              }
              label="Download threads (fetch and export thread messages into individual files)"
            />
          </AccordionDetails>
        </Accordion>
      )}

      {/* Media */}
      <Accordion
        expanded={expandedPanels.media}
        onChange={handlePanelChange('media')}
        TransitionProps={{ unmountOnExit: false }}
        disableGutters
        elevation={0}
        sx={{ '&:before': { display: 'none' }, backgroundColor: 'transparent' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2">Files & Media</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={isMediaOnly ? true : exportState.includeMedia}
                  onChange={(e) => {
                    dispatch(setIncludeMedia(e.target.checked));
                  }}
                  disabled={isMediaOnly}
                />
              }
              label="Download files for offline viewing (avatars, attachments, emojis)"
            />

            <Collapse in={mediaEnabled} timeout="auto">
              <Box sx={{ pl: 4, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                  Media types to include:
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={exportState.mediaConfig.images}
                      onChange={(e) => dispatch(setMediaConfig({ images: e.target.checked }))}
                    />
                  }
                  label={<Typography variant="body2">{getMediaLabel('Images')}</Typography>}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={exportState.mediaConfig.videos}
                      onChange={(e) => dispatch(setMediaConfig({ videos: e.target.checked }))}
                    />
                  }
                  label={<Typography variant="body2">{getMediaLabel('Videos')}</Typography>}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={exportState.mediaConfig.audio}
                      onChange={(e) => dispatch(setMediaConfig({ audio: e.target.checked }))}
                    />
                  }
                  label={<Typography variant="body2">{getMediaLabel('Audio')}</Typography>}
                />
                {isExtensionMode() && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={exportState.mediaConfig.other}
                        onChange={(e) => dispatch(setMediaConfig({ other: e.target.checked }))}
                      />
                    }
                    label={<Typography variant="body2">{getMediaLabel('Other files')}</Typography>}
                  />
                )}
              </Box>

              <Box sx={{ pl: 4, mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                  Display options:
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={exportState.artistMode}
                      onChange={(e) => dispatch(setArtistMode(e.target.checked))}
                    />
                  }
                  label={<Typography variant="body2">Artist mode (organize media by author)</Typography>}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={exportState.previewMedia}
                      onChange={(e) => dispatch(setPreviewMedia(e.target.checked))}
                    />
                  }
                  label={<Typography variant="body2">Preview media in export</Typography>}
                />
              </Box>

              {/* Breakdown bar + preview + size warning (single-channel only) */}
              {mediaSummary && !isBulk && (
                <Box sx={{ pl: 4, mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <MediaBreakdownBar summaries={enabledSummaries} />
                  <MediaPreviewPanel summaries={enabledSummaries} />
                </Box>
              )}

              <Collapse in={showSizeWarning}>
                <Box sx={{ pl: 4, mt: 1 }}>
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    Estimated media size is {formatBytes(enabledSize)}.
                    {largestCategory && ` ${largestCategory.category} accounts for ${Math.round((largestCategory.totalBytes / enabledSize) * 100)}% — consider unchecking it to reduce download size.`}
                  </Alert>
                </Box>
              </Collapse>
            </Collapse>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default ExportSettingsAccordion;
