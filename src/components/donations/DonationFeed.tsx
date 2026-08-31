import { useMemo, useState } from 'react';
import { Box, Chip, keyframes, alpha, useTheme } from '@mui/material';
import {
  ChatBubbleOutline as MessageIcon,
  AllInclusive as AllIcon,
  LocalCafeOutlined as TipIcon,
  WhatshotOutlined as MonthlyIcon,
} from '@mui/icons-material';
import type { Donation } from 'discrub-core/types/discrub-types';
import DonationCard from './DonationCard';
import { sortDonationsByNewest, aggregateDonors } from './donationUtils';

const glowPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`;

type FeedFilter = 'all' | 'tips' | 'monthly' | 'messages';

interface DonationFeedProps {
  donations: Donation[];
  visibleCount: number;
}

const DonationFeed = ({ donations, visibleCount }: DonationFeedProps) => {
  const [filter, setFilter] = useState<FeedFilter>('all');

  const sorted = useMemo(() => sortDonationsByNewest(donations), [donations]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'tips': return sorted.filter((d) => d.type !== 'Monthly Tip');
      case 'monthly': return sorted.filter((d) => d.type === 'Monthly Tip');
      case 'messages': return sorted.filter((d) => d.message.length > 0);
      default: return sorted;
    }
  }, [sorted, filter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Build top 5% donor rank map: donorId → rank
  const topDonorRanks = useMemo(() => {
    const aggregated = aggregateDonors(donations);
    const topCount = Math.max(1, Math.ceil(aggregated.length * 0.05));
    const map = new Map<string, number>();
    aggregated.slice(0, topCount).forEach((donor, i) => map.set(donor.donorId, i + 1));
    return map;
  }, [donations]);

  // Each filter wears its own accent: Ko-fi red for tips, the streak
  // flame for monthly, the Sky's nova mint for messages. Selected = a
  // softly glowing tinted pill; unselected stays quiet until hovered.
  const theme = useTheme();
  const FILTER_ACCENTS: Record<FeedFilter, string> = {
    all: theme.palette.primary.main,
    tips: '#ff5e5b',
    monthly: '#ff9d5c',
    messages: '#7ce8c4',
  };

  const filterChip = (label: string, value: FeedFilter, icon: React.ReactElement) => {
    const accent = FILTER_ACCENTS[value];
    const selected = filter === value;
    return (
      <Chip
        key={value}
        label={label}
        icon={icon}
        size="small"
        variant="outlined"
        onClick={() => setFilter(value)}
        sx={{
          height: 24,
          fontSize: '0.68rem',
          fontWeight: 600,
          borderRadius: 999,
          transition: 'all 180ms ease',
          color: selected ? accent : 'text.secondary',
          borderColor: selected ? alpha(accent, 0.65) : 'divider',
          backgroundColor: selected ? alpha(accent, 0.14) : 'transparent',
          boxShadow: selected ? `0 0 8px ${alpha(accent, 0.3)}` : 'none',
          '& .MuiChip-label': { px: 0.75 },
          '& .MuiChip-icon': { fontSize: 13, ml: 0.5, color: selected ? accent : 'text.disabled' },
          '&:hover': {
            color: accent,
            borderColor: alpha(accent, 0.55),
            backgroundColor: alpha(accent, selected ? 0.18 : 0.08),
            '& .MuiChip-icon': { color: accent },
          },
        }}
      />
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {filterChip('All', 'all', <AllIcon />)}
        {filterChip('Tips', 'tips', <TipIcon />)}
        {filterChip('Monthly', 'monthly', <MonthlyIcon />)}
        {filterChip('Messages', 'messages', <MessageIcon />)}
      </Box>

      {(() => {
        const firstMessageIdx = visible.findIndex((d) => d.message.length > 0);
        return visible.map((donation, i) => (
          <DonationCard
            key={donation.transactionId}
            donation={donation}
            donations={sorted}
            index={i}
            supporterRank={topDonorRanks.get(donation.donorId)}
            initialExpanded={i === firstMessageIdx}
          />
        ));
      })()}
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

export default DonationFeed;
