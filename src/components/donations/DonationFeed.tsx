import { useMemo, useState } from 'react';
import { Box, Chip, keyframes } from '@mui/material';
import {
  ChatBubbleOutline as MessageIcon,
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

  const filterChip = (label: string, value: FeedFilter, icon?: React.ReactElement) => (
    <Chip
      key={value}
      label={label}
      icon={icon}
      size="small"
      variant={filter === value ? 'filled' : 'outlined'}
      color={filter === value ? 'primary' : 'default'}
      onClick={() => setFilter(value)}
      sx={{
        height: 22,
        fontSize: '0.68rem',
        '& .MuiChip-label': { px: 0.75 },
        '& .MuiChip-icon': { fontSize: 13, ml: 0.5 },
      }}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {filterChip('All', 'all')}
        {filterChip('Tips', 'tips')}
        {filterChip('Monthly', 'monthly')}
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
