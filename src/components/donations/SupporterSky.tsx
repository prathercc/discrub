import { memo, useMemo, useState } from 'react';
import { Box, Dialog, IconButton, Stack, Tooltip, Typography, alpha } from '@mui/material';
import { OpenInFull as ExpandIcon, CloseFullscreen as CollapseIcon } from '@mui/icons-material';
import type { Donation } from 'discrub-core/types/discrub-types';
import {
  CONSTELLATION_TIERS,
  TIER_STAR_SIZE,
  aggregateSupporters,
  daysSinceJoined,
  displayName,
  findNewestStar,
  formatTotal,
  isGenericName,
  isNewSupporter,
  mulberry32,
  pickNovaIds,
  placeStars,
  type PlacedStar,
} from './constellation';

/**
 * The Supporter Constellation, ported from the pratherbytecraft.com
 * Supporter Wall (2026-08-31, owner ask): the same night sky, fed by the
 * same donation data the drawer already holds, with every star in the
 * same seeded spot as on the site. Mini mode fills the drawer's Sky tab
 * top to bottom; the expand control opens the full-screen sky.
 */

const FLAME = '#ff9d5c';
const NOVA = '#7ce8c4';

interface DustMote {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

function makeDust(count: number): DustMote[] {
  const rng = mulberry32(7);
  return Array.from({ length: count }, () => ({
    x: rng() * 100,
    y: rng() * 100,
    size: 1 + rng() * 1.4,
    opacity: 0.08 + rng() * 0.16,
  }));
}

const DUST = makeDust(110);

const twinkleSx = (dur: number, delay: number) => ({
  animation: `supporterTwinkle ${dur}s ease-in-out ${delay}s infinite`,
  '@keyframes supporterTwinkle': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.45 },
  },
});

function StarVisual({ star }: { star: PlacedStar }) {
  const { tier, size, supporter } = star;
  const glow = supporter.isActiveSubscriber
    ? `0 0 ${size * 1.5}px ${alpha(tier.color, 0.9)}, 0 0 ${size * 3}px ${alpha(FLAME, 0.65)}`
    : `0 0 ${size * 1.2}px ${alpha(tier.color, tier.key === 'bit' ? 0.35 : 0.7)}`;

  if (tier.key === 'gigabyte' || tier.key === 'megabyte') {
    // Four-point sparkle for the top tiers.
    return (
      <Box sx={{ filter: `drop-shadow(0 0 ${size / 2}px ${alpha(tier.color, 0.9)})${supporter.isActiveSubscriber ? ` drop-shadow(0 0 ${size}px ${alpha(FLAME, 0.7)})` : ''}` }}>
        <Box
          sx={{
            width: size,
            height: size,
            backgroundColor: tier.color,
            clipPath: 'polygon(50% 0%, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0% 50%, 40% 40%)',
          }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ width: size, height: size, borderRadius: '50%', backgroundColor: tier.color, boxShadow: glow }} />
  );
}

interface StarDotProps {
  star: PlacedStar;
  isActive: boolean;
  onEnter: (star: PlacedStar) => void;
  onLeave: () => void;
  onToggle: (star: PlacedStar) => void;
}

// Memoized so a hover only re-renders the star gaining and the star
// losing the active state, not all ~200 of them.
const StarDot = memo(function StarDot({ star, isActive, onEnter, onLeave, onToggle }: StarDotProps) {
  return (
    <Box
      data-testid="sky-star"
      onMouseEnter={() => onEnter(star)}
      onMouseLeave={onLeave}
      onClick={() => onToggle(star)}
      sx={{
        position: 'absolute',
        left: `${star.x}%`,
        top: `${star.y}%`,
        transform: 'translate(-50%, -50%)',
        width: Math.max(22, star.size + 14),
        height: Math.max(22, star.size + 14),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: isActive ? 5 : 1,
        '&:hover > *': { transform: 'scale(1.45)' },
        '& > *': { transition: 'transform 150ms ease' },
        ...twinkleSx(star.twinkleDur, star.twinkleDelay),
        ...(isActive && { animation: 'none', opacity: 1 }),
      }}
    >
      {star.hasNova &&
        // Two staggered rings: one is always mid-flight, so the halo
        // never blinks out between pulses.
        [0, 1].map((ring) => (
          <Box
            key={ring}
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: star.size + 10,
              height: star.size + 10,
              borderRadius: '50%',
              border: `1.5px solid ${alpha(star.tier.color, 0.85)}`,
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%) scale(0.9)',
              opacity: 0,
              animation: `novaPulse 3.2s linear ${ring * 1.6}s infinite backwards`,
              '@keyframes novaPulse': {
                '0%': { transform: 'translate(-50%, -50%) scale(0.9)', opacity: 0 },
                '12%': { transform: 'translate(-50%, -50%) scale(1.05)', opacity: 0.8 },
                '100%': { transform: 'translate(-50%, -50%) scale(2.4)', opacity: 0 },
              },
            }}
          />
        ))}
      <StarVisual star={star} />
    </Box>
  );
});

function StarTooltip({ star }: { star: PlacedStar }) {
  const { supporter, tier, x, y } = star;
  const joinedDays = daysSinceJoined(supporter);
  const joinedLabel = joinedDays === 0 ? 'today' : joinedDays === 1 ? 'yesterday' : `${joinedDays} days ago`;
  const message = supporter.message
    ? supporter.message.length > 160
      ? `${supporter.message.slice(0, 157)}...`
      : supporter.message
    : '';
  // Message tooltips are much taller — flip them below the star sooner
  // so they never clip against the sky's top edge.
  const below = y < (message ? 40 : 24);

  return (
    <Box
      data-testid="sky-tooltip"
      sx={{
        position: 'absolute',
        left: `${Math.min(72, Math.max(28, x))}%`,
        top: `${y}%`,
        transform: below ? 'translate(-50%, 18px)' : 'translate(-50%, calc(-100% - 16px))',
        zIndex: 10,
        pointerEvents: 'none',
        width: 230,
        maxWidth: '92%',
        p: 1.5,
        borderRadius: 2,
        backgroundColor: 'rgba(10, 13, 26, 0.95)',
        border: `1px solid ${alpha(tier.color, 0.4)}`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 12px ${alpha(tier.color, 0.15)}`,
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: '#f2f3ff' }}>{displayName(supporter)}</Typography>
      <Typography
        sx={{
          fontSize: 11,
          fontFamily: 'monospace',
          color: tier.color,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          mt: 0.25,
        }}
      >
        {`${tier.name} supporter · ${formatTotal(supporter.total)}`}
      </Typography>
      {isNewSupporter(supporter) ? (
        <Typography sx={{ fontSize: 11.5, color: NOVA, mt: 0.5 }}>{`✦ New star, joined ${joinedLabel}`}</Typography>
      ) : (
        <Typography sx={{ fontSize: 11.5, color: 'rgba(231, 233, 244, 0.7)', mt: 0.5 }}>
          {`In the sky since ${new Date(supporter.firstTimestamp).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
        </Typography>
      )}
      {supporter.isActiveSubscriber && (
        <Typography sx={{ fontSize: 11.5, color: FLAME, mt: 0.5 }}>
          {`Burning monthly, ${supporter.subscriptionMonths} month${supporter.subscriptionMonths === 1 ? '' : 's'} strong`}
        </Typography>
      )}
      {message && (
        <Typography sx={{ fontSize: 12, color: 'rgba(231, 233, 244, 0.7)', fontStyle: 'italic', mt: 0.75, overflowWrap: 'anywhere' }}>
          "{message}"
        </Typography>
      )}
    </Box>
  );
}

function TierLegend({ compact }: { compact?: boolean }) {
  return (
    <Stack
      direction="row"
      justifyContent="center"
      alignItems="center"
      sx={{ mt: compact ? 1 : 2, flexWrap: 'wrap', columnGap: compact ? 1.5 : 3, rowGap: 0.75 }}
    >
      {[...CONSTELLATION_TIERS].reverse().map((tier) => (
        <Stack key={tier.key} direction="row" spacing={0.6} alignItems="center">
          <Box
            sx={{
              width: Math.max(5, TIER_STAR_SIZE[tier.key] * 0.7),
              height: Math.max(5, TIER_STAR_SIZE[tier.key] * 0.7),
              borderRadius: '50%',
              backgroundColor: tier.color,
              boxShadow: `0 0 6px ${alpha(tier.color, 0.6)}`,
            }}
          />
          <Typography sx={{ fontSize: compact ? 10 : 11.5, fontFamily: 'monospace', color: 'text.secondary' }}>
            {tier.name}
            {tier.min > 0 ? ` $${tier.min}+` : ''}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

interface SkyPanelProps {
  stars: PlacedStar[];
  onExpandToggle?: () => void;
  expanded?: boolean;
  compact?: boolean;
}

/**
 * The sky plus its stats row and legend, filling whatever height the
 * parent gives it (the sky itself takes all the slack).
 */
function SkyPanel({ stars, onExpandToggle, expanded, compact }: SkyPanelProps) {
  const [active, setActive] = useState<PlacedStar | null>(null);
  const [pinned, setPinned] = useState(false);

  const monthlyCount = useMemo(() => stars.filter((s) => s.supporter.isActiveSubscriber).length, [stars]);
  const newestStar = useMemo(() => findNewestStar(stars), [stars]);
  // Named Gigabyte/Megabyte stars carry a persistent label, as on the site.
  const labeledStars = useMemo(
    () =>
      stars.filter(
        (s) => (s.tier.key === 'gigabyte' || s.tier.key === 'megabyte') && !isGenericName(s.supporter.name),
      ),
    [stars],
  );

  const handleEnter = (star: PlacedStar) => {
    if (!pinned) setActive(star);
  };
  const handleLeave = () => {
    if (!pinned) setActive(null);
  };
  // Tap/click pins the tooltip, so the sky works without a hover.
  const handleToggle = (star: PlacedStar) => {
    if (pinned && active?.supporter.donorId === star.supporter.donorId) {
      setPinned(false);
      setActive(null);
    } else {
      setPinned(true);
      setActive(star);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box
        data-testid="supporter-sky"
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 240,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          background:
            'radial-gradient(ellipse 60% 50% at 22% 28%, rgba(88, 101, 242, 0.09), transparent 65%), ' +
            'radial-gradient(ellipse 55% 45% at 78% 72%, rgba(139, 92, 246, 0.08), transparent 65%), ' +
            'radial-gradient(ellipse 40% 35% at 60% 15%, rgba(124, 232, 196, 0.04), transparent 60%), ' +
            '#05060c',
          '@media (prefers-reduced-motion: reduce)': {
            '& *': { animation: 'none !important' },
          },
        }}
      >
        {DUST.map((d, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: d.size,
              height: d.size,
              borderRadius: '50%',
              backgroundColor: '#e7e9f4',
              opacity: d.opacity,
              pointerEvents: 'none',
            }}
          />
        ))}
        {stars.map((star) => (
          <StarDot
            key={star.supporter.donorId}
            star={star}
            isActive={active?.supporter.donorId === star.supporter.donorId}
            onEnter={handleEnter}
            onLeave={handleLeave}
            onToggle={handleToggle}
          />
        ))}
        {labeledStars.map((star) => (
          <Typography
            key={`label-${star.supporter.donorId}`}
            sx={{
              position: 'absolute',
              left: `${star.x}%`,
              top: `${star.y}%`,
              transform: `translate(-50%, ${star.size / 2 + 8}px)`,
              fontFamily: 'monospace',
              fontSize: compact ? 10 : 11,
              color: alpha(star.tier.color, 0.85),
              textShadow: '0 1px 6px rgba(0,0,0,0.9)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {star.supporter.name.trim()}
          </Typography>
        ))}
        {active && <StarTooltip star={active} />}
        {onExpandToggle && (
          <Tooltip title={expanded ? 'Close the sky' : 'Open the full sky'} enterDelay={0} arrow>
            <IconButton
              size="small"
              onClick={onExpandToggle}
              aria-label={expanded ? 'Close the sky' : 'Open the full sky'}
              data-testid="sky-expand"
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                zIndex: 6,
                color: 'rgba(231, 233, 244, 0.7)',
                bgcolor: 'rgba(10, 13, 26, 0.6)',
                '&:hover': { color: '#f2f3ff', bgcolor: 'rgba(10, 13, 26, 0.85)' },
              }}
            >
              {expanded ? <CollapseIcon sx={{ fontSize: 16 }} /> : <ExpandIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Stack
        direction="row"
        spacing={compact ? 1.5 : 4}
        justifyContent="center"
        sx={{ mt: compact ? 1 : 2, flexWrap: 'wrap', rowGap: 0.5 }}
        data-testid="sky-stats"
      >
        <Typography sx={{ color: 'text.secondary', fontSize: compact ? 11 : 14, fontFamily: 'monospace' }}>
          {stars.length} stars
        </Typography>
        {monthlyCount > 0 && (
          <Typography sx={{ color: FLAME, fontSize: compact ? 11 : 14, fontFamily: 'monospace' }}>
            {monthlyCount} burning monthly
          </Typography>
        )}
        {newestStar && (
          <Typography
            data-testid="sky-newest"
            onClick={() => handleToggle(newestStar)}
            sx={{
              color: NOVA,
              fontSize: compact ? 11 : 14,
              fontFamily: 'monospace',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {`newest: ${displayName(newestStar.supporter)} ✦`}
          </Typography>
        )}
      </Stack>

      <TierLegend compact={compact} />
    </Box>
  );
}

const SupporterSky = ({ donations }: { donations: Donation[] }) => {
  const [expanded, setExpanded] = useState(false);
  const stars = useMemo(() => {
    const supporters = aggregateSupporters(donations);
    return placeStars(supporters, pickNovaIds(supporters));
  }, [donations]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minHeight: 0 }}>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1, flexShrink: 0 }}>
        Every supporter is a star with a permanent place in the sky, the same spot as on{' '}
        <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
          pratherbytecraft.com
        </Box>
        . Hover or tap one.
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <SkyPanel stars={stars} onExpandToggle={() => setExpanded(true)} compact />
      </Box>

      <Dialog
        fullScreen
        open={expanded}
        onClose={() => setExpanded(false)}
        PaperProps={{ sx: { bgcolor: 'background.default', p: { xs: 2, sm: 4 } } }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, flexShrink: 0 }}>
          The Supporter Constellation
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 2, flexShrink: 0 }}>
          Everyone who has supported Discrub, each with a permanent place in the sky.
        </Typography>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <SkyPanel stars={stars} onExpandToggle={() => setExpanded(false)} expanded />
        </Box>
      </Dialog>
    </Box>
  );
};

export default SupporterSky;
