import { useState } from 'react';
import { Box, Chip, Collapse, Typography } from '@mui/material';
import {
  BrokenImage as BrokenImageIcon,
  Videocam as VideoIcon,
  AudioFile as AudioIcon,
  InsertDriveFile as FileIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import type { MediaCategorySummary } from '@/utils/mediaUtils';
import type { Attachment } from 'discrub-core/types/discord-types';

const MAX_PER_CATEGORY = 8;
const MAX_TOTAL = 20;

const CATEGORY_LABELS: Record<string, string> = {
  images: 'Images',
  videos: 'Videos',
  audio: 'Audio',
  other: 'Other',
};

interface MediaPreviewPanelProps {
  summaries: MediaCategorySummary[];
}

const ImageThumbnail = ({ attachment }: { attachment: Attachment }) => {
  const [error, setError] = useState(false);
  const src = attachment.proxy_url || attachment.url;

  if (error) {
    return (
      <Box
        sx={{
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'action.hover',
          borderRadius: 0.5,
        }}
      >
        <BrokenImageIcon fontSize="small" color="disabled" />
      </Box>
    );
  }

  return (
    <img
      src={src}
      alt={attachment.filename || 'image'}
      loading="lazy"
      onError={() => setError(true)}
      style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
    />
  );
};

const MediaPreviewPanel = ({ summaries }: MediaPreviewPanelProps) => {
  const [expanded, setExpanded] = useState(false);

  const hasContent = summaries.some((s) => s.attachments.length > 0);
  if (!hasContent) return null;

  // Calculate per-category limits respecting MAX_TOTAL across all categories
  let totalRemaining = MAX_TOTAL;
  const categoryLimits = summaries.map((s) => {
    const limit = Math.min(s.attachments.length, MAX_PER_CATEGORY, totalRemaining);
    totalRemaining -= limit;
    return limit;
  });

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.75,
          cursor: 'pointer',
          '&:hover': { backgroundColor: 'action.hover' },
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={500}>
          Preview attachments
        </Typography>
        {expanded ? (
          <ExpandLessIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        ) : (
          <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        )}
      </Box>

      <Collapse in={expanded} timeout="auto">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, px: 1.5, pb: 1.5 }}>
          {summaries.map((summary, idx) => {
            if (summary.attachments.length === 0) return null;
            const limit = categoryLimits[idx];
            const shown = summary.attachments.slice(0, limit);
            const remaining = summary.attachments.length - limit;

            return (
              <Box key={summary.category}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block', textTransform: 'capitalize' }}>
                  {CATEGORY_LABELS[summary.category] || summary.category}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                  {shown.map((att, i) => {
                    if (summary.category === 'images') {
                      return <ImageThumbnail key={i} attachment={att} />;
                    }

                    const Icon = summary.category === 'videos'
                      ? VideoIcon
                      : summary.category === 'audio'
                      ? AudioIcon
                      : FileIcon;

                    return (
                      <Chip
                        key={i}
                        icon={<Icon fontSize="small" />}
                        label={att.filename || 'file'}
                        size="small"
                        variant="outlined"
                        sx={{ maxWidth: 160, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                      />
                    );
                  })}
                  {remaining > 0 && (
                    <Chip
                      label={`+${remaining} more`}
                      size="small"
                      variant="outlined"
                      color="default"
                    />
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
};

export default MediaPreviewPanel;
