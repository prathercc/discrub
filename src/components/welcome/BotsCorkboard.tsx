import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Chip, Collapse, IconButton, Link, Typography, Tooltip } from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  ExpandMore as ExpandIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { storage } from '@/extension/storage';
import { BOTS, BOT_IDEA_MAILTO, CORKBOARD_COLLAPSED_STORAGE_KEY, type BotEntry } from './bots';
import RetrostatMark from './RetrostatMark';
import ScourMark from './ScourMark';
import DeveloperCard from './DeveloperCard';

/**
 * "What else we make": a pinboard strip on the WelcomePanel showing the
 * Prather Bytecraft Discord bots. Deliberately styled unlike the feature
 * cards (those are what Discrub does) so it reads as a board, not a banner.
 *
 * - Data-driven from `bots.ts`; one pinned card per bot, a Discord-style
 *   message from the developer (`DeveloperCard`), plus sticky notes.
 * - Collapsible; the folded state persists in `Discrub-state` and the board
 *   never re-expands on its own.
 * - No animation loops, no autoplay. Hover lifts a card slightly.
 * - A red thread runs from each bot's sticker note to that bot's pin, drawn
 *   as an SVG overlay from measured pin positions (re-measured on resize).
 */

const MARKS: Record<string, (size: number) => React.ReactNode> = {
  retrostat: (size) => <RetrostatMark size={size} />,
  scour: (size) => <ScourMark size={size} />,
};

/** Small seeded tilt so the pins look hand-placed but never move between renders. */
const tiltFor = (index: number) => [-1.6, 1.2, -0.8, 1.8][index % 4];

const Pin = ({ id }: { id?: string }) => (
  <Box
    aria-hidden
    data-pin={id}
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
    <Pin id={`bot-${bot.id}`} />
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
  pinId?: string;
  children: React.ReactNode;
}

const StickyNote = ({ testId, tilt, tint, pinId, children }: StickyNoteProps) => (
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
    <Pin id={pinId} />
    {children}
  </Box>
);

interface Thread {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Measures the pins named in `pairs` relative to the board and returns one
 * thread per pair that resolved. Re-measures whenever the board resizes
 * (wrapping changes pin positions) and hides nothing on failure: a pair whose
 * pins are missing just has no thread.
 */
const useThreads = (boardRef: React.RefObject<HTMLDivElement | null>, pairs: [string, string][], active: boolean) => {
  const [threads, setThreads] = useState<Thread[]>([]);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board || !active) {
      setThreads([]);
      return;
    }
    const measure = () => {
      const origin = board.getBoundingClientRect();
      const center = (id: string) => {
        const el = board.querySelector<HTMLElement>(`[data-pin="${id}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - origin.left, y: r.top + r.height / 2 - origin.top };
      };
      setThreads(
        pairs.flatMap(([from, to]) => {
          const a = center(from);
          const b = center(to);
          return a && b ? [{ from, to, x1: a.x, y1: a.y, x2: b.x, y2: b.y }] : [];
        })
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, [boardRef, pairs, active]);

  return threads;
};

/** Slack the thread like real string: a quadratic curve sagging below the pins. */
const threadPath = ({ x1, y1, x2, y2 }: Thread) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const sag = 10 + Math.hypot(dx, dy) * 0.06;
  const cx = (x1 + x2) / 2;
  const cy = Math.max(y1, y2) + sag;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
};

const Threads = ({ threads }: { threads: Thread[] }) => (
  <Box
    component="svg"
    aria-hidden
    data-testid="corkboard-threads"
    sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
  >
    {threads.map((thread) => (
      <g key={`${thread.from}->${thread.to}`} data-testid={`corkboard-thread-${thread.from}-${thread.to}`}>
        <path d={threadPath(thread)} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={2.5} transform="translate(0 1.5)" />
        <path d={threadPath(thread)} fill="none" stroke="#c62828" strokeWidth={1.6} strokeLinecap="round" />
      </g>
    ))}
  </Box>
);

const BotsCorkboard = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const open = loaded && !collapsed;
  const activeBot = BOTS[Math.min(activeIndex, BOTS.length - 1)];
  // One carousel slot: only the active bot's card is pinned, so only its
  // sticker (when it has one) gets a thread.
  const threadPairs = useMemo<[string, string][]>(
    () => (activeBot?.sticker ? [[`sticky-${activeBot.id}`, `bot-${activeBot.id}`]] : []),
    [activeBot],
  );
  const threads = useThreads(boardRef, threadPairs, open);

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

  if (BOTS.length === 0 || !activeBot) return null;
  const showControls = BOTS.length > 1;
  const step = (delta: number) => setActiveIndex((i) => (i + delta + BOTS.length) % BOTS.length);

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
      <Collapse in={open} timeout={160} unmountOnExit>
        <Box
          ref={boardRef}
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
          <Threads threads={threads} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, width: { xs: '100%', sm: 'auto' } }}>
            <PinnedCard key={activeBot.id} bot={activeBot} index={activeIndex} />
            {showControls && (
              <Box
                data-testid="corkboard-carousel-controls"
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}
              >
                <IconButton
                  size="small"
                  onClick={() => step(-1)}
                  aria-label="Previous bot"
                  data-testid="corkboard-prev"
                  sx={{ color: 'rgba(0,0,0,0.55)', '&:hover': { color: '#2b2400' } }}
                >
                  <PrevIcon fontSize="small" />
                </IconButton>
                {BOTS.map((bot, index) => (
                  <Box
                    key={bot.id}
                    component="button"
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Show ${bot.name}`}
                    aria-current={index === activeIndex}
                    data-testid={`corkboard-dot-${bot.id}`}
                    sx={{
                      width: 11,
                      height: 11,
                      p: 0,
                      borderRadius: '50%',
                      border: '1px solid rgba(0,0,0,0.4)',
                      cursor: 'pointer',
                      background:
                        index === activeIndex
                          ? 'radial-gradient(circle at 35% 35%, #ff8a80, #c62828 70%)'
                          : 'rgba(0,0,0,0.25)',
                      boxShadow: index === activeIndex ? '0 1px 2px rgba(0,0,0,0.45)' : 'none',
                    }}
                  />
                ))}
                <IconButton
                  size="small"
                  onClick={() => step(1)}
                  aria-label="Next bot"
                  data-testid="corkboard-next"
                  sx={{ color: 'rgba(0,0,0,0.55)', '&:hover': { color: '#2b2400' } }}
                >
                  <NextIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              mt: { xs: 0, sm: 1.5 },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            {activeBot.sticker && (
              <StickyNote testId="corkboard-sticky" tilt={2.2} tint="#fff3a3" pinId={`sticky-${activeBot.id}`}>
                {activeBot.sticker}
              </StickyNote>
            )}
            <StickyNote testId="corkboard-idea" tilt={-1.5} tint="#b9e6ff">
              Have an idea for a bot?{' '}
              <Link href={BOT_IDEA_MAILTO} underline="always">
                Tell me about it.
              </Link>
            </StickyNote>
          </Box>
          <DeveloperCard pin={<Pin />} tilt={1.4} />
        </Box>
      </Collapse>
    </Box>
  );
};

export default BotsCorkboard;
