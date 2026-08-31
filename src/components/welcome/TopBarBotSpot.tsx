import { useEffect, useState } from 'react';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import {
  SkipPrevious as PrevIcon,
  SkipNext as NextIcon,
  Add as AddIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { BOTS, installUrlFor } from './bots';
import RetrostatMark from './RetrostatMark';
import ScourMark from './ScourMark';
import VestedMark from './VestedMark';

/**
 * EXPLORATION (backlog: TopBar compact bot carousel, filed 2026-08-31;
 * owner picked the mini-card variant 2026-08-31 and asked for a
 * music-player layout). A compact bot spotlight for the TopBar's empty
 * middle once the user leaves the welcome screen: skip-previous and
 * skip-next flank the corkboard card header at bar height, with a blurple
 * "DISCORD BOT" pill echoing Discord's own in-client APP badge (our
 * styling, not Discord's mark, so no trademark art is redrawn).
 *
 * Same rotation manners as the corkboard: slow ambient flips, a manual
 * skip earns a longer grace before rotation resumes, reduced-motion sits
 * still, and the slot is a fixed-size crossfade so the bar never reflows.
 */

const MARKS: Record<string, (size: number) => React.ReactNode> = {
  retrostat: (size) => <RetrostatMark size={size} />,
  scour: (size) => <ScourMark size={size} />,
  vested: (size) => <VestedMark size={size} />,
};

/** Slow ambient rotation; chrome must whisper, not wave. */
const ROTATE_MS = 30000;

/** After a manual skip, the pause before ambient rotation resumes. */
const MANUAL_RESUME_MS = 20000;

/** Discord's in-client bot badge blurple. */
const BLURPLE = '#5865F2';

interface TopBarBotSpotProps {
  /** Storybook knob: rotate faster so the crossfade is visible. */
  rotateMs?: number;
}

const TopBarBotSpot = ({ rotateMs = ROTATE_MS }: TopBarBotSpotProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [interactions, setInteractions] = useState(0);
  // Never flip while the pointer is over the spot; a card swapping under
  // a cursor aimed at Add would be the worst possible moment.
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (BOTS.length < 2 || hovered) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setActiveIndex((i) => (i + 1) % BOTS.length);
      timer = setTimeout(tick, rotateMs);
    };
    timer = setTimeout(tick, interactions > 0 ? MANUAL_RESUME_MS : rotateMs);
    return () => clearTimeout(timer);
  }, [rotateMs, interactions, hovered]);

  if (BOTS.length === 0) return null;

  const step = (delta: number) => {
    setInteractions((n) => n + 1);
    setActiveIndex((i) => (i + delta + BOTS.length) % BOTS.length);
  };

  const arrowSx = {
    p: 0.25,
    color: 'text.secondary',
    '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
  } as const;

  return (
    <Box
      data-testid="topbar-bot-spot"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
        py: 0.5,
        borderRadius: 1,
        bgcolor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
      }}
    >
      <IconButton size="small" onClick={() => step(-1)} aria-label="Previous bot" data-testid="bot-spot-prev" sx={arrowSx}>
        <PrevIcon sx={{ fontSize: 18 }} />
      </IconButton>

      {/* maxWidth keeps the longest tagline from arm-wrestling the rest of
          the bar; noWrap below turns the loss into an ellipsis. */}
      <Box sx={{ display: 'grid', minWidth: 0, maxWidth: 300 }}>
        {BOTS.map((bot, index) => {
          const active = index === activeIndex;
          return (
            <Box
              key={bot.id}
              data-testid={active ? 'bot-spot-card' : undefined}
              aria-hidden={!active}
              style={{ visibility: active ? 'visible' : 'hidden' }}
              sx={{
                gridArea: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 0,
                px: 0.5,
                opacity: active ? 1 : 0,
                transition: 'opacity 400ms ease, visibility 400ms',
              }}
            >
              {MARKS[bot.id]?.(28)}
              <Box sx={{ minWidth: 0, lineHeight: 1.1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                  <Typography component="span" noWrap sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    {bot.name}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      flexShrink: 0,
                      px: 0.6,
                      py: 0.1,
                      borderRadius: 0.5,
                      bgcolor: BLURPLE,
                      color: '#ffffff',
                      fontSize: '0.55rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      lineHeight: 1.6,
                    }}
                  >
                    DISCORD BOT
                  </Typography>
                </Box>
                <Typography component="span" noWrap sx={{ display: 'block', color: 'text.secondary', fontSize: '0.72rem' }}>
                  {bot.tagline}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Actions for the active bot: install (counted with its own
          placement source) and the bot's page. Same crossfade stack so
          the hrefs always match the visible card. */}
      <Box sx={{ display: 'grid', flexShrink: 0 }}>
        {BOTS.map((bot, index) => {
          const active = index === activeIndex;
          return (
            <Box
              key={bot.id}
              aria-hidden={!active}
              style={{ visibility: active ? 'visible' : 'hidden' }}
              sx={{
                gridArea: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                opacity: active ? 1 : 0,
                transition: 'opacity 400ms ease, visibility 400ms',
                pointerEvents: active ? 'auto' : 'none',
              }}
            >
              <Tooltip title={`Add ${bot.name} to your server`} enterDelay={0} arrow>
                <Button
                  size="small"
                  variant="contained"
                  component="a"
                  href={installUrlFor(bot.id, 'discrub-topbar')}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                  data-testid={active ? 'bot-spot-add' : undefined}
                  sx={{
                    minWidth: 0,
                    px: 1,
                    py: 0.25,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    lineHeight: 1.4,
                    '& .MuiButton-startIcon': { mr: 0.4 },
                  }}
                >
                  Add
                </Button>
              </Tooltip>
              <Tooltip title={`About ${bot.name}`} enterDelay={0} arrow>
                <IconButton
                  size="small"
                  component="a"
                  href={bot.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`About ${bot.name}`}
                  data-testid={active ? 'bot-spot-info' : undefined}
                  sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                >
                  <InfoIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          );
        })}
      </Box>

      <IconButton size="small" onClick={() => step(1)} aria-label="Next bot" data-testid="bot-spot-next" sx={arrowSx}>
        <NextIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
};

export default TopBarBotSpot;
