import { Box, Typography, Chip, Select, MenuItem, Checkbox, ListItemIcon, ListItemText } from '@mui/material';
import {
  Code as CodeIcon,
  AttachFile as AttachFileIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  MusicNote as MusicNoteIcon,
  EmojiEmotions as EmojiEmotionsIcon,
  Movie as MovieIcon,
  Poll as PollIcon,
  Shortcut as ForwardIcon,
} from '@mui/icons-material';
import { HasType } from 'discrub-core/discord-enum';
import { useTranslation } from 'react-i18next';

interface MessageTypeFilterProps {
  selectedTypes: HasType[];
  onChange: (types: HasType[]) => void;
}

const typeConfig: { type: HasType; label: string; icon: React.ReactElement }[] = [
  { type: HasType.IMAGE, label: 'image', icon: <ImageIcon fontSize="small" /> },
  { type: HasType.VIDEO, label: 'video', icon: <MovieIcon fontSize="small" /> },
  { type: HasType.LINK, label: 'link', icon: <LinkIcon fontSize="small" /> },
  { type: HasType.FILE, label: 'file', icon: <AttachFileIcon fontSize="small" /> },
  { type: HasType.EMBED, label: 'embed', icon: <CodeIcon fontSize="small" /> },
  { type: HasType.SOUND, label: 'sound', icon: <MusicNoteIcon fontSize="small" /> },
  { type: HasType.POLL, label: 'poll', icon: <PollIcon fontSize="small" /> },
  { type: HasType.STICKER, label: 'sticker', icon: <EmojiEmotionsIcon fontSize="small" /> },
  { type: HasType.FORWARD, label: 'forward', icon: <ForwardIcon fontSize="small" /> },
];

/**
 * MessageTypeFilter - filter messages by content type using a dropdown with checkboxes
 */
const MessageTypeFilter = ({ selectedTypes, onChange }: MessageTypeFilterProps) => {
  const { t } = useTranslation();
  const handleToggle = (type: HasType) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    onChange(newTypes);
  };

  const handleRemove = (type: HasType) => {
    onChange(selectedTypes.filter((t) => t !== type));
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
        {t('filters.has')}
      </Typography>
      {selectedTypes.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {selectedTypes.map((type) => {
            const config = typeConfig.find((c) => c.type === type);
            return (
              <Chip
                key={type}
                label={config ? t(`filters.hasType.${config.label}`) : type}
                icon={config?.icon}
                size="small"
                color="primary"
                onDelete={() => handleRemove(type)}
                sx={{ fontWeight: 500 }}
              />
            );
          })}
        </Box>
      )}
      <Select
        multiple
        value={selectedTypes}
        displayEmpty
        size="small"
        fullWidth
        data-testid="has-filter-select"
        renderValue={() => (
          <Typography variant="body2" color="text.secondary">
            {t('filters.anyContent')}
          </Typography>
        )}
        MenuProps={{
          PaperProps: {
            sx: { maxHeight: 300 },
          },
        }}
      >
        {typeConfig.map(({ type, label, icon }) => (
          <MenuItem key={type} value={type} onClick={() => handleToggle(type)} dense>
            <Checkbox checked={selectedTypes.includes(type)} size="small" sx={{ p: 0.5 }} />
            <ListItemIcon sx={{ minWidth: 32 }}>{icon}</ListItemIcon>
            <ListItemText primary={label} />
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
};

export default MessageTypeFilter;
