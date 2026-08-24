import { useEffect, useState } from 'react';
import { Box, Button, Chip, Collapse, IconButton, Link, Typography, Tooltip } from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { storage } from '@/extension/storage';
import { BOTS, BOT_IDEA_MAILTO, CORKBOARD_COLLAPSED_STORAGE_KEY, type BotEntry } from './bots';
import RetrostatMark from './RetrostatMark';

/**
 * "What else we make": a pinboard strip on the WelcomePanel showing the
 * Prather Bytecraft Discord bots. Deliberately styled unlike the feature
 * cards (those are what Discrub does) so it reads as a board, not a banner.
 *
 * - Data-driven from `bots.ts`; one pinned card per bot plus one sticky note.
 * - Collapsible; the folded state persists in `Discrub-state` and the board
 *   never re-expands on its own.
 * - No animation loops, no autoplay. Hover lifts a card slightly.
 */

const MARKS: Record<string, (size: number) => React.ReactNode> = {
  retrostat: (size) => <RetrostatMark size={size} />,
};

/** Small seeded tilt so the pins look hand-placed but never move between renders. */
const tiltFor = (index: number) => [-1.6, 1.2, -0.8, 1.8][index % 4];

const Pin = () => (
  <Box
    aria-hidden
    sx={{
      position: 'absolute',
      top: -7,
      left: '50%',
      width: 14,
      height: 14,
      ml: '-7px',
      borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 35%, #ff8a80, #c62828 70%)',
      boxShadow: '0 2px 3px rgba(0,0,0,0.45)',
    }}
  />
);

const PinnedCard = ({ bot, index }: { bot: BotEntry; index: number }) => (
  <Box
    data-testid={`corkboard-bot-${bot.id}`}
    sx={{
      position: 'relative',
      width: { xs: '100%', sm: 300 },
      p: 2,
      pt: 2.25,
      borderRadius: 1,
      bgcolor: 'background.paper',
      color: 'text.primary',
      transform: `rotate(${tiltFor(index)}deg)`,
      transition: 'transform 160ms ease, box-shadow 160ms ease',
      boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
      '&:hover': {
        transform: `rotate(${tiltFor(index)}deg) translateY(-3px)`,
        boxShadow: '0 10px 20px rgba(0,0,0,0.4)',
      },
    }}
  >
    <Pin />
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
      {MARKS[bot.id]?.(40)}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {bot.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
          {bot.tagline}
        </Typography>
      </Box>
    </Box>
    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5, mb: 1.25 }}>
      {bot.pitch}
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
      {bot.chips.map((chip) => (
        <Chip key={chip} label={chip} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
      ))}
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
      <Button
        variant="contained"
        size="small"
        component="a"
        href={bot.installUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ textTransform: 'none', fontWeight: 600 }}
      >
        Add to Discord
      </Button>
      <Link
        href={bot.pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        underline="hover"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: '0.8rem', fontWeight: 600 }}
      >
        Learn more <OpenIcon sx={{ fontSize: 14 }} />
      </Link>
    </Box>
  </Box>
);

interface StickyNoteProps {
  testId: string;
  tilt: number;
  tint: string;
  children: React.ReactNode;
}

const StickyNote = ({ testId, tilt, tint, children }: StickyNoteProps) => (
  <Box
    data-testid={testId}
    sx={{
      position: 'relative',
      width: { xs: '100%', sm: 190 },
      alignSelf: { xs: 'stretch', sm: 'flex-start' },
      p: 1.75,
      pt: 2,
      bgcolor: tint,
      color: '#2b2400',
      transform: `rotate(${tilt}deg)`,
      boxShadow: '0 6px 12px rgba(0,0,0,0.3)',
      fontFamily: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
      fontSize: '0.9rem',
      lineHeight: 1.35,
      '& a': { color: 'inherit', fontWeight: 700, textDecorationThickness: 2 },
    }}
  >
    <Pin />
    {children}
  </Box>
);

const BotsCorkboard = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    storage.state
      .get<boolean>(CORKBOARD_COLLAPSED_STORAGE_KEY)
      .then((value) => {
        if (!cancelled) setCollapsed(Boolean(value));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    storage.state.set(CORKBOARD_COLLAPSED_STORAGE_KEY, next).catch(() => {});
  };

  if (BOTS.length === 0) return null;
  const sticker = BOTS.find((bot) => bot.sticker)?.sticker;

  return (
    <Box data-testid="bots-corkboard" sx={{ mb: 5, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          From the Discrub team
        </Typography>
        <Tooltip title={collapsed ? 'Show the board' : 'Hide the board'}>
          <IconButton
            size="small"
            onClick={toggle}
            aria-label={collapsed ? 'Show the board' : 'Hide the board'}
            aria-expanded={!collapsed}
            sx={{
              transform: collapsed ? 'rotate(-90deg)' : 'none',
              transition: 'transform 160ms ease',
            }}
          >
            <ExpandIcon />
          </IconButton>
        </Tooltip>
      </Box>
      <Collapse in={loaded && !collapsed} timeout={160} unmountOnExit>
        <Box
          sx={(theme) => ({
            position: 'relative',
            width: 'fit-content',
            maxWidth: '100%',
            mx: 'auto',
            minWidth: { sm: 560 },
            p: { xs: 2, sm: 3 },
            pt: { xs: 3, sm: 3.5 },
            borderRadius: 2,
            border: '6px solid',
            borderColor: theme.palette.mode === 'dark' ? '#4a3524' : '#8a6a4a',
            backgroundColor: theme.palette.mode === 'dark' ? '#7a5a3c' : '#c9a57c',
            backgroundImage:
              'radial-gradient(rgba(0,0,0,0.18) 1px, transparent 1.4px), radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1.4px)',
            backgroundSize: '9px 9px, 13px 13px',
            backgroundPosition: '0 0, 4px 6px',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.25)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: { xs: 3, sm: 4 },
          })}
        >
          {BOTS.map((bot, index) => (
            <PinnedCard key={bot.id} bot={bot} index={index} />
          ))}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              mt: { xs: 0, sm: 1.5 },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            {sticker && (
              <StickyNote testId="corkboard-sticky" tilt={2.2} tint="#fff3a3">
                {sticker}
              </StickyNote>
            )}
            <StickyNote testId="corkboard-idea" tilt={-1.5} tint="#b9e6ff">
              Have an idea for a bot?{' '}
              <Link href={BOT_IDEA_MAILTO} underline="always">
                Tell me about it.
              </Link>
            </StickyNote>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

export default BotsCorkboard;
