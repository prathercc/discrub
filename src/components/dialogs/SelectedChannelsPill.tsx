import { useMemo, useState } from 'react';
import { Box, Collapse, Typography, useTheme } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { Channel, Guild } from 'discrub-core/types/discord-types';

interface SelectedChannelsPillProps {
  channels?: Channel[];
  /** #255 — selected servers, used when mode is 'servers'. */
  guilds?: Guild[];
  /**
   * 'channels' = guild text channels (#name prefix)
   * 'dms'      = DMs (recipient usernames, no prefix)
   * 'servers'  = whole servers (#255 multi-server purge)
   */
  mode: 'channels' | 'dms' | 'servers';
}

/**
 * Compact selected-channels summary used at the top of bulk dialogs
 * (BulkPurgeDialog, BulkExportDialog). Shows count + first 3 names
 * inline; click to expand the full list. Keeps destructive / heavy
 * operations above the fold on standard viewports.
 */
const SelectedChannelsPill = ({ channels = [], guilds = [], mode }: SelectedChannelsPillProps) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const isDmMode = mode === 'dms';
  const isServerMode = mode === 'servers';
  const contextLabel = isServerMode ? 'server' : isDmMode ? 'conversation' : 'channel';
  const contextLabelPlural = isServerMode ? 'servers' : isDmMode ? 'conversations' : 'channels';

  const getChannelName = (channel: Channel) => {
    if (isDmMode) {
      return channel.recipients?.map((r) => r.username).join(', ') || 'Direct Message';
    }
    return channel.name || `channel-${channel.id}`;
  };

  const getChannelLabel = (channel: Channel) =>
    isDmMode ? getChannelName(channel) : `# ${getChannelName(channel)}`;

  // Servers and channels share one label list so the rest of the pill
  // (count, summary, expanded list) needs no mode branches.
  const labels = isServerMode
    ? guilds.map((g) => g.name || `server-${g.id}`)
    : channels.map(getChannelLabel);
  const count = labels.length;

  const summary = useMemo(() => {
    const names = labels;
    const visible = names.slice(0, 3);
    const remaining = names.length - visible.length;
    const joined = visible.join(', ');
    return remaining > 0 ? `${joined}, +${remaining} more` : joined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, guilds, isDmMode, isServerMode]);

  return (
    <Box>
      <Box
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        aria-expanded={expanded}
        aria-label={isServerMode ? 'Selected servers' : isDmMode ? 'Selected conversations' : 'Selected channels'}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 0.75,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: 'action.hover',
          cursor: 'pointer',
          '&:hover': { backgroundColor: 'action.selected' },
          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}` },
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
          {count} {count === 1 ? contextLabel : contextLabelPlural}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {summary}
        </Typography>
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            color: 'text.secondary',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
          }}
        />
      </Box>
      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 0.5,
            maxHeight: 140,
            overflow: 'auto',
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
            p: 1,
          }}
        >
          {labels.map((label, index) => (
            <Typography
              key={`${index}-${label}`}
              variant="body2"
              sx={{
                py: 0.25,
                px: 1,
                borderRadius: 0.5,
                backgroundColor: index % 2 === 0 ? 'transparent' : 'action.hover',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {label}
            </Typography>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

export default SelectedChannelsPill;
