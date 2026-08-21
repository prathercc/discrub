import { Box, FormControl, InputLabel, MenuItem, Select, FormControlLabel, Checkbox, Chip, Slider, Typography, Divider, useTheme } from '@mui/material';
import {
  Image as ImageIcon,
  Videocam as VideoIcon,
  AudioFile as AudioIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { SortDirection } from 'discrub-core/common-enum';

interface ExportPreferencesTabProps {
  formValues: AppSettings;
  onChange: (key: DiscrubSetting, value: string) => void;
}

const MEDIA_TYPES = [
  { key: DiscrubSetting.EXPORT_MEDIA_IMAGES, label: 'Images', icon: <ImageIcon sx={{ fontSize: 16 }} /> },
  { key: DiscrubSetting.EXPORT_MEDIA_VIDEOS, label: 'Videos', icon: <VideoIcon sx={{ fontSize: 16 }} /> },
  { key: DiscrubSetting.EXPORT_MEDIA_AUDIO, label: 'Audio', icon: <AudioIcon sx={{ fontSize: 16 }} /> },
  { key: DiscrubSetting.EXPORT_MEDIA_OTHER, label: 'Other files', icon: <FileIcon sx={{ fontSize: 16 }} /> },
] as const;

const MESSAGES_PER_PAGE_MIN = 10;
const MESSAGES_PER_PAGE_MAX = 1000;
const MESSAGES_PER_PAGE_STEP = 10;
const MESSAGES_PER_PAGE_REC_MIN = 100;
const MESSAGES_PER_PAGE_REC_MAX = 500;

const getPageZoneColor = (value: number, safeColor: string): string => {
  if (value >= MESSAGES_PER_PAGE_REC_MIN && value <= MESSAGES_PER_PAGE_REC_MAX) return '#4caf50';
  if (value < MESSAGES_PER_PAGE_REC_MIN) return '#ff9800';
  return safeColor;
};

const buildPageGradient = (safeColor: string): string => {
  const range = MESSAGES_PER_PAGE_MAX - MESSAGES_PER_PAGE_MIN;
  const toPct = (v: number) => ((v - MESSAGES_PER_PAGE_MIN) / range) * 100;
  const recStart = toPct(MESSAGES_PER_PAGE_REC_MIN);
  const recEnd = toPct(MESSAGES_PER_PAGE_REC_MAX);
  const blueMid = recEnd + (100 - recEnd) * 0.5;

  return `linear-gradient(to right, `
    + `#ff9800 0%, `
    + `#4caf50 ${recStart}%, `
    + `#4caf50 ${recEnd}%, `
    + `${safeColor} ${blueMid}%, `
    + `${safeColor} 100%)`;
};

export const ExportPreferencesTab = ({ formValues, onChange }: ExportPreferencesTabProps) => {
  const theme = useTheme();
  const safeColor = theme.palette.cta.main;
  const messagesPerPage = parseInt(formValues[DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]) || 50;
  const pageColor = getPageZoneColor(messagesPerPage, safeColor);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography variant="body2" color="text.secondary">
        These are defaults. Override per-export in the export dialog.
      </Typography>

      {/* Content Section */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
        Content
      </Typography>

      <FormControl fullWidth>
        <InputLabel>Message Sort Order</InputLabel>
        <Select
          value={formValues[DiscrubSetting.EXPORT_MESSAGE_SORT_ORDER]}
          label="Message Sort Order"
          onChange={(e) => onChange(DiscrubSetting.EXPORT_MESSAGE_SORT_ORDER, e.target.value)}
        >
          <MenuItem value={SortDirection.ASCENDING}>Oldest First (Ascending)</MenuItem>
          <MenuItem value={SortDirection.DESCENDING}>Newest First (Descending)</MenuItem>
        </Select>
      </FormControl>

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Messages Per Page
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: pageColor }}>
            {messagesPerPage}
          </Typography>
        </Box>
        <Slider
          value={messagesPerPage}
          onChange={(_, v) => onChange(DiscrubSetting.EXPORT_MESSAGES_PER_PAGE, String(v as number))}
          min={MESSAGES_PER_PAGE_MIN}
          max={MESSAGES_PER_PAGE_MAX}
          step={MESSAGES_PER_PAGE_STEP}
          valueLabelDisplay="auto"
          marks={[
            { value: MESSAGES_PER_PAGE_MIN, label: `${MESSAGES_PER_PAGE_MIN}` },
            { value: MESSAGES_PER_PAGE_MAX, label: `${MESSAGES_PER_PAGE_MAX}` },
          ]}
          sx={{
            '& .MuiSlider-track': { display: 'none' },
            '& .MuiSlider-thumb': { backgroundColor: pageColor, borderColor: pageColor, border: '2px solid', zIndex: 1 },
            '& .MuiSlider-rail': { opacity: 1, background: buildPageGradient(safeColor), height: 6 },
          }}
        />
        <Typography variant="caption" color="text.secondary">
          Number of messages per HTML page. Lower values load faster in browsers.
        </Typography>
      </Box>

      <FormControlLabel
        control={
          <Checkbox
            checked={formValues[DiscrubSetting.EXPORT_SEPARATE_THREAD_AND_FORUM_POSTS] === 'true'}
            onChange={(e) =>
              onChange(DiscrubSetting.EXPORT_SEPARATE_THREAD_AND_FORUM_POSTS, e.target.checked ? 'true' : 'false')
            }
          />
        }
        label="Separate threads (fetch thread messages and export each thread as its own file)"
      />

      <Divider sx={{ opacity: 0.3 }} />

      {/* Media Section */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
        Files & Media
      </Typography>

      <FormControlLabel
        control={
          <Checkbox
            checked={formValues[DiscrubSetting.EXPORT_DOWNLOAD_MEDIA] === 'true'}
            onChange={(e) =>
              onChange(DiscrubSetting.EXPORT_DOWNLOAD_MEDIA, e.target.checked ? 'true' : 'false')
            }
          />
        }
        label="Download files for offline viewing (avatars, attachments, emojis)"
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={formValues[DiscrubSetting.EXPORT_ARTIST_MODE] === 'true'}
            onChange={(e) =>
              onChange(DiscrubSetting.EXPORT_ARTIST_MODE, e.target.checked ? 'true' : 'false')
            }
          />
        }
        label="Artist mode (organize downloaded files into folders by author)"
      />

      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          Default media types
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {MEDIA_TYPES.map(({ key, label, icon }) => {
            const active = formValues[key] !== 'false';
            return (
              <Chip
                key={key}
                icon={icon}
                label={label}
                size="small"
                variant={active ? 'filled' : 'outlined'}
                color={active ? 'primary' : 'default'}
                onClick={() => onChange(key, active ? 'false' : 'true')}
                sx={{ cursor: 'pointer' }}
              />
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ opacity: 0.3 }} />

      {/* Display Section */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
        Display
      </Typography>

      <FormControlLabel
        control={
          <Checkbox
            checked={formValues[DiscrubSetting.EXPORT_PREVIEW_MEDIA] === 'true'}
            onChange={(e) =>
              onChange(DiscrubSetting.EXPORT_PREVIEW_MEDIA, e.target.checked ? 'true' : 'false')
            }
          />
        }
        label="Preview media in export (show inline image/video thumbnails in HTML)"
      />
    </Box>
  );
};
