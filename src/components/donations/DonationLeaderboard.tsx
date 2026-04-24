import { useMemo } from 'react';
import { Box, Typography, keyframes } from '@mui/material';
import { Whatshot as SubscriberIcon } from '@mui/icons-material';
import type { Donation } from 'discrub-core/types/discrub-types';
import type { AggregatedDonor } from './donationTypes';
import { aggregateDonors, getTierInfo } from './donationUtils';
import { getTierSx } from './tierStyles';
import { useTheme } from '@mui/material/styles';

const glowPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`;

const RANK_COLORS: Record<number, string> = {
  1: '#ffd700',
  2: '#c0c0c0',
  3: '#cd7f32',
};

interface DonationLeaderboardProps {
  donations: Donation[];
  visibleCount: number;
}

const DonationLeaderboard = ({ donations, visibleCount }: DonationLeaderboardProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const aggregated = useMemo(() => aggregateDonors(donations), [donations]);
  const topCount = Math.max(1, Math.ceil(aggregated.length * 0.05));
  const topDonors = aggregated.slice(0, topCount);

  const visible = topDonors.slice(0, visibleCount);
  const hasMore = visibleCount < topDonors.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center', fontSize: '0.65rem' }}>
        Top 5% of {aggregated.length} supporter{aggregated.length !== 1 ? 's' : ''}
      </Typography>

      {visible.map((donor, i) => (
        <LeaderboardDonorEntry key={donor.donorId} donor={donor} rank={i + 1} isDark={isDark} />
      ))}

      {hasMore && (
        <Box
          sx={{
            height: 60,
            borderRadius: 1,
            bgcolor: 'action.hover',
            animation: `${glowPulse} 1.8s ease-in-out infinite`,
          }}
        />
      )}
    </Box>
  );
};

const LeaderboardDonorEntry = ({ donor, rank, isDark }: { donor: AggregatedDonor; rank: number; isDark: boolean }) => {
  const tierInfo = getTierInfo(donor.totalAmount);
  const tierSx = getTierSx(tierInfo.tier, isDark);
  const rankColor = RANK_COLORS[rank];
  const isTopThree = rank <= 3;

  const subtitle = `${donor.donationCount} contribution${donor.donationCount !== 1 ? 's' : ''} for a total of $${Math.floor(donor.totalAmount)}`;

  return (
    <Box
      sx={{
        ...tierSx as Record<string, unknown>,
        borderRadius: '8px',
        p: 1.5,
        animation: 'none',
        ...(rankColor && {
          boxShadow: `0 2px 12px ${rankColor}22`,
        }),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            minWidth: 28,
            textAlign: 'center',
            color: rankColor || 'text.disabled',
            fontSize: isTopThree ? '1.1rem' : '0.9rem',
          }}
        >
          #{rank}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {donor.fromName}
          </Typography>
          <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
            {subtitle}
          </Typography>
          {donor.subscriptionMonths > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <SubscriberIcon sx={{ fontSize: 12, color: '#ff5e5b' }} />
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#ff5e5b', fontWeight: 700 }}>
                Subscribed for a total of {donor.subscriptionMonths} Month{donor.subscriptionMonths !== 1 ? 's' : ''}!
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default DonationLeaderboard;
