import { memo } from 'react';
import { Box, Typography } from '@mui/material';
import { useAppSelector } from '@/app/hooks';
import { selectExport } from '@features/export/exportSlice';
import { selectSettings } from '@features/app/appSlice';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

const ExportSummaryChip = memo(() => {
  const exportState = useAppSelector(selectExport);
  const settings = useAppSelector(selectSettings);
  const reactionsEnabled = settings?.[DiscrubSetting.REACTIONS_ENABLED] === 'true';

  const parts: string[] = [];

  // Format
  parts.push(exportState.exportFormat.toUpperCase());

  // Messages per page (not for media-only)
  if (exportState.exportFormat !== 'media') {
    parts.push(`${exportState.messagesPerPage}/page`);
  }

  // Sort order
  parts.push(exportState.sortOrder === 'ascending' ? 'Oldest first' : 'Newest first');

  // Separate threads
  if (exportState.separateThreads) {
    parts.push('Separate threads');
  }

  // Media info
  const isMediaOnly = exportState.exportFormat === 'media';
  const mediaEnabled = isMediaOnly || exportState.includeMedia;

  if (!mediaEnabled) {
    parts.push('No media');
  } else {
    const { images, videos, audio } = exportState.mediaConfig;
    if (images && videos && audio) {
      parts.push('All media');
    } else {
      const types: string[] = [];
      if (images) types.push('Images');
      if (videos) types.push('Videos');
      if (audio) types.push('Audio');
      if (types.length > 0) {
        parts.push(`Media: ${types.join(', ')}`);
      }
    }
  }

  // Artist mode
  if (exportState.artistMode && mediaEnabled) {
    parts.push('Artist mode');
  }

  // Reaction info (format-specific)
  if (exportState.exportFormat === 'html' && reactionsEnabled) {
    parts.push('Reactions: detailed');
  } else if (exportState.exportFormat !== 'media') {
    parts.push('Reactions: counts only');
  }

  // Template (HTML only, only show if non-default)
  if (exportState.exportFormat === 'html' && exportState.exportTemplate === 'discord') {
    parts.push('Discord layout');
  }

  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 0.75,
        px: 1.5,
        backgroundColor: 'rgba(114, 137, 218, 0.06)',
        border: '1px solid',
        borderColor: 'rgba(114, 137, 218, 0.3)',
        borderRadius: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {parts.join(' \u00b7 ')}
      </Typography>
    </Box>
  );
});

ExportSummaryChip.displayName = 'ExportSummaryChip';

export default ExportSummaryChip;
