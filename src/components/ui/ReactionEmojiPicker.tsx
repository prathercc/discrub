import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Tooltip,
  CircularProgress,
  InputAdornment,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DiscordEmoji from './DiscordEmoji';
import { getEmojiKey } from '@/utils/emojiUtils';
import {
  loadEmojiDataset,
  resolveEmojiInput,
  type EmojiDataset,
  type SelectableEmoji,
  type UnicodeEmoji,
} from '@/utils/emojiDataset';
import type { Emoji } from 'discrub-core/types/discord-types';
import { useTranslation } from 'react-i18next';

const EMOJI_SIZE = 22;
const EMPTY_SHORTCODES = new Map<string, UnicodeEmoji>();

interface ReactionEmojiPickerProps {
  /** Currently-selected emojis (compared by getEmojiKey). */
  selected: SelectableEmoji[];
  /** Toggle an emoji in/out of the selection. */
  onToggle: (emoji: SelectableEmoji) => void;
  /** Custom emojis for the active guild (rendered as images). */
  guildEmojis?: Emoji[];
}

interface EmojiCellProps {
  emoji: SelectableEmoji;
  tooltip: string;
  selected: boolean;
  onClick: () => void;
}

const EmojiCell = ({ emoji, tooltip, selected, onClick }: EmojiCellProps) => (
  <Tooltip title={tooltip} placement="top" arrow>
    <Box
      role="button"
      aria-label={tooltip}
      aria-pressed={selected}
      onClick={onClick}
      sx={{
        width: EMOJI_SIZE + 10,
        height: EMOJI_SIZE + 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 1,
        cursor: 'pointer',
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'transparent',
        backgroundColor: selected ? 'action.selected' : 'transparent',
        '&:hover': { backgroundColor: 'action.hover' },
      }}
    >
      <DiscordEmoji emoji={emoji} size={EMOJI_SIZE} />
    </Box>
  </Tooltip>
);

/**
 * Emoji picker for bulk-adding reactions (Backlog #202). Shows the active guild's
 * custom emojis (verified-by-construction from Discord) plus the full unicode set
 * (emojibase / iamcal-Discord shortcodes), with a name filter and a paste escape
 * hatch. Selection is controlled by the parent; this component never calls Discord.
 */
const ReactionEmojiPicker = ({ selected, onToggle, guildEmojis = [] }: ReactionEmojiPickerProps) => {
  const { t } = useTranslation();
  const [dataset, setDataset] = useState<EmojiDataset | null>(null);
  const [query, setQuery] = useState('');
  const [pasteValue, setPasteValue] = useState('');
  const [pasteError, setPasteError] = useState(false);

  useEffect(() => {
    let active = true;
    loadEmojiDataset().then((ds) => {
      if (active) setDataset(ds);
    });
    return () => {
      active = false;
    };
  }, []);

  const selectedKeys = useMemo(
    () => new Set(selected.map((e) => getEmojiKey(e))),
    [selected]
  );

  const usableGuildEmojis = useMemo(
    () => guildEmojis.filter((e) => e.available !== false && e.id && e.name),
    [guildEmojis]
  );

  const normalizedQuery = query.trim().toLowerCase();

  const filteredGuildEmojis = useMemo(() => {
    if (!normalizedQuery) return usableGuildEmojis;
    return usableGuildEmojis.filter((e) => (e.name || '').toLowerCase().includes(normalizedQuery));
  }, [usableGuildEmojis, normalizedQuery]);

  // When filtering, flatten the unicode set; otherwise keep the category sections.
  const filteredUnicode = useMemo(() => {
    if (!dataset || !normalizedQuery) return null;
    return dataset.all.filter(
      (e) =>
        e.label.toLowerCase().includes(normalizedQuery) ||
        e.shortcodes.some((c) => c.includes(normalizedQuery))
    );
  }, [dataset, normalizedQuery]);

  const handlePaste = () => {
    const resolved = resolveEmojiInput(pasteValue, dataset ?? { byShortcode: EMPTY_SHORTCODES });
    if (resolved) {
      onToggle(resolved);
      setPasteValue('');
      setPasteError(false);
    } else {
      setPasteError(true);
    }
  };

  const unicodeToSelectable = (e: UnicodeEmoji): SelectableEmoji => ({ name: e.unicode });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        size="small"
        fullWidth
        placeholder={t('emojiPicker.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
        inputProps={{ 'aria-label': t('emojiPicker.searchAria') }}
      />

      <Box
        sx={{
          maxHeight: 280,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          pr: 0.5,
        }}
      >
        {/* Server emojis */}
        {usableGuildEmojis.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {t('emojiPicker.serverEmojis')}
            </Typography>
            {filteredGuildEmojis.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.5 }}>
                {filteredGuildEmojis.map((emoji) => {
                  // usableGuildEmojis guarantees id + name are present.
                  const sel: SelectableEmoji = {
                    id: emoji.id ?? undefined,
                    name: emoji.name ?? '',
                    animated: emoji.animated ?? undefined,
                  };
                  return (
                    <EmojiCell
                      key={getEmojiKey(emoji)}
                      emoji={sel}
                      tooltip={`:${emoji.name}:`}
                      selected={selectedKeys.has(getEmojiKey(emoji))}
                      onClick={() => onToggle(sel)}
                    />
                  );
                })}
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {t('emojiPicker.noServerMatch')}
              </Typography>
            )}
          </Box>
        )}

        {/* Unicode emojis */}
        {!dataset ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2, justifyContent: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="caption" color="text.secondary">
              {t('emojiPicker.loading')}
            </Typography>
          </Box>
        ) : filteredUnicode ? (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {t('emojiPicker.allEmojis')}
            </Typography>
            {filteredUnicode.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.5 }}>
                {filteredUnicode.map((e) => {
                  const sel = unicodeToSelectable(e);
                  return (
                    <EmojiCell
                      key={e.hexcode}
                      emoji={sel}
                      tooltip={e.shortcodes[0] ? `:${e.shortcodes[0]}:` : e.label}
                      selected={selectedKeys.has(getEmojiKey(sel))}
                      onClick={() => onToggle(sel)}
                    />
                  );
                })}
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {t('emojiPicker.noMatch', { query })}
              </Typography>
            )}
          </Box>
        ) : (
          dataset.categories.map((category) => (
            <Box key={category.group}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {category.name}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.5 }}>
                {category.emojis.map((e) => {
                  const sel = unicodeToSelectable(e);
                  return (
                    <EmojiCell
                      key={e.hexcode}
                      emoji={sel}
                      tooltip={e.shortcodes[0] ? `:${e.shortcodes[0]}:` : e.label}
                      selected={selectedKeys.has(getEmojiKey(sel))}
                      onClick={() => onToggle(sel)}
                    />
                  );
                })}
              </Box>
            </Box>
          ))
        )}
      </Box>

      {/* Paste escape hatch */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <TextField
          size="small"
          fullWidth
          label={t('emojiPicker.other')}
          placeholder={t('emojiPicker.pastePlaceholder')}
          value={pasteValue}
          error={pasteError}
          helperText={pasteError ? t('emojiPicker.notRecognized') : ' '}
          onChange={(e) => {
            setPasteValue(e.target.value);
            if (pasteError) setPasteError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handlePaste();
            }
          }}
          inputProps={{ 'aria-label': t('emojiPicker.pasteAria') }}
        />
        <Button onClick={handlePaste} disabled={!pasteValue.trim()} sx={{ mt: 0.5 }}>
          Add
        </Button>
      </Box>
    </Box>
  );
};

export default ReactionEmojiPicker;
