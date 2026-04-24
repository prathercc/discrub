import { useState } from 'react';
import { Box, Typography, Chip, Collapse } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { Donation } from 'discrub-core/types/discrub-types';
import { getTierInfo, getRelativeDate, getChipTextColor } from './donationUtils';
import { getTierSx } from './tierStyles';

interface LeaderboardEntryProps {
  donation: Donation;
  rank: number;
}

const RANK_COLORS: Record<number, string> = {
  1: '#ffd700',
  2: '#c0c0c0',
  3: '#cd7f32',
};

const LeaderboardEntry = ({ donation, rank }: LeaderboardEntryProps) => {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const tierInfo = getTierInfo(donation.amount);
  const tierSx = getTierSx(tierInfo.tier, isDark);
  const rankColor = RANK_COLORS[rank];
  const isTopThree = rank <= 3;

  return (
    <Box
      sx={{
        ...tierSx as Record<string, unknown>,
        borderRadius: '8px',
        p: 1.5,
        cursor: donation.message ? 'pointer' : 'default',
        ...(isTopThree && {
          boxShadow: `0 2px 12px ${rankColor}22`,
        }),
      }}
      onClick={() => donation.message && setExpanded((prev) => !prev)}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography
          variant="body1"
          sx={{
            fontWeight: 800,
            minWidth: 28,
            textAlign: 'center',
            color: rankColor || (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'),
            fontSize: isTopThree ? '1.1rem' : '0.9rem',
          }}
        >
          #{rank}
        </Typography>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, mr: 1 }}
            >
              {donation.fromName}
            </Typography>
            <Chip
              label={`$${donation.amount}`}
              size="small"
              sx={{
                backgroundColor: tierInfo.color,
                color: getChipTextColor(tierInfo.tier),
                fontWeight: 700,
                fontSize: '0.75rem',
                height: 22,
                flexShrink: 0,
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.25 }}>
            <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
              {getRelativeDate(donation.timestamp)}
            </Typography>
            {donation.message && (
              <ExpandMoreIcon
                sx={{
                  fontSize: 16,
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 200ms ease',
                }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {donation.message && (
        <Collapse in={expanded}>
          <Typography
            variant="caption"
            sx={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', mt: 1, ml: 5.5, display: 'block', fontStyle: 'italic' }}
          >
            &ldquo;{donation.message}&rdquo;
          </Typography>
        </Collapse>
      )}
    </Box>
  );
};

export default LeaderboardEntry;
