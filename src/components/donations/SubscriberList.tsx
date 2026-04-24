import { useMemo } from 'react';
import { Box, Typography, Chip, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Whatshot as FlameIcon } from '@mui/icons-material';
import type { Donation } from 'discrub-core/types/discrub-types';
import { buildSubscribers } from './donationUtils';
import type { SubscriberInfo } from './donationTypes';
import { getStreakTier } from './donationTypes';

const flickerGlow = keyframes`
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.3); }
`;

const STREAK_COLORS: Record<string, { primary: string; glow: string; bg: string }> = {
  ember: { primary: '#ff8a50', glow: 'rgba(255, 138, 80, 0.15)', bg: 'rgba(255, 138, 80, 0.06)' },
  blaze: { primary: '#ff5722', glow: 'rgba(255, 87, 34, 0.2)', bg: 'rgba(255, 87, 34, 0.08)' },
  inferno: { primary: '#ff1744', glow: 'rgba(255, 23, 68, 0.25)', bg: 'rgba(255, 23, 68, 0.1)' },
};

interface SubscriberListProps {
  donations: Donation[];
  visibleCount: number;
}

const SubscriberList = ({ donations, visibleCount }: SubscriberListProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const subscribers = useMemo(() => buildSubscribers(donations), [donations]);

  const active = subscribers.filter((s) => s.isActive);
  const inactive = subscribers.filter((s) => !s.isActive);
  const visible = subscribers.slice(0, visibleCount);

  if (subscribers.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <FlameIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.disabled">
          No monthly subscribers yet
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Be the first to support Discrub monthly!
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: 1 }}>
        Active ({active.length})
      </Typography>

      {active.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <FlameIcon sx={{ fontSize: 24, color: 'text.disabled', mb: 0.5 }} />
          <Typography variant="caption" color="text.disabled" display="block">
            No active subscribers
          </Typography>
        </Box>
      )}

      {visible.filter((s) => s.isActive).map((sub) => (
        <SubscriberCard key={sub.donorId} subscriber={sub} isDark={isDark} />
      ))}

      {inactive.length > 0 && visibleCount > active.length && (
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: 1, mt: 1 }}>
          Past Supporters ({inactive.length})
        </Typography>
      )}

      {visible.filter((s) => !s.isActive).map((sub) => (
        <SubscriberCard key={sub.donorId} subscriber={sub} isDark={isDark} />
      ))}
    </Box>
  );
};

const SubscriberCard = ({ subscriber, isDark }: { subscriber: SubscriberInfo; isDark: boolean }) => {
  const streak = getStreakTier(subscriber.months);
  const colors = STREAK_COLORS[streak];
  const isActive = subscriber.isActive;

  return (
    <Box
      sx={{
        borderRadius: '8px',
        p: 1.5,
        border: 1,
        borderColor: isActive ? colors.primary : 'divider',
        backgroundColor: isActive
          ? (isDark ? colors.bg : `${colors.primary}08`)
          : (isDark ? 'rgba(40, 43, 48, 0.4)' : 'rgba(0, 0, 0, 0.02)'),
        boxShadow: isActive ? `0 2px 12px ${colors.glow}` : 'none',
        opacity: isActive ? 1 : 0.6,
        transition: 'opacity 200ms ease',
        '&:hover': { opacity: 1 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Flame icon — animated for active, static grey for inactive */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: isActive ? `${colors.primary}20` : 'action.hover',
            flexShrink: 0,
            ...(isActive && streak === 'inferno' && {
              animation: `${flickerGlow} 2s ease-in-out infinite`,
            }),
          }}
        >
          <FlameIcon
            sx={{
              fontSize: streak === 'inferno' ? 20 : streak === 'blaze' ? 18 : 16,
              color: isActive ? colors.primary : 'text.disabled',
            }}
          />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: isActive ? 'text.secondary' : 'text.disabled',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subscriber.fromName}
          </Typography>
          <Typography variant="caption" sx={{ color: isActive ? colors.primary : 'text.disabled', fontWeight: 600 }}>
            {subscriber.months} month{subscriber.months !== 1 ? 's' : ''}
            {!isActive && ' (ended)'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
          <Chip
            label={`$${Math.floor(subscriber.totalSubscriptionAmount)}`}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor: isActive ? colors.primary : 'action.hover',
              color: isActive ? '#fff' : 'text.disabled',
            }}
          />
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: isActive ? colors.primary : 'text.disabled', mt: 0.25 }}>
            ${Math.floor(subscriber.totalSubscriptionAmount / subscriber.months)}/mo
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default SubscriberList;
