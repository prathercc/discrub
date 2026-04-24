import { Box, Skeleton, keyframes } from '@mui/material';

const glowPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`;

interface ListSkeletonProps {
  /** Number of skeleton rows */
  rows?: number;
  /** Show a circular avatar placeholder */
  avatar?: boolean;
  /** Show an icon placeholder (smaller than avatar) */
  icon?: boolean;
  /** Avatar size in px (default 40) */
  avatarSize?: number;
}

/**
 * Skeleton placeholder for navigation lists (servers, channels, DMs).
 * Mirrors ListItemButton layout with optional avatar/icon.
 */
const ListSkeleton = ({ rows = 5, avatar = false, icon = false, avatarSize = 40 }: ListSkeletonProps) => (
  <Box sx={{ px: 1, py: 0.5 }}>
    {Array.from({ length: rows }, (_, i) => (
      <Box
        key={i}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          animation: `${glowPulse} 1.8s ease-in-out infinite`,
          animationDelay: `${i * 0.12}s`,
        }}
      >
        {avatar && <Skeleton variant="circular" width={avatarSize} height={avatarSize} />}
        {icon && <Skeleton variant="rounded" width={20} height={20} />}
        <Skeleton variant="text" width={`${45 + (i * 7) % 40}%`} height={18} sx={{ flex: 1, maxWidth: '80%' }} />
      </Box>
    ))}
  </Box>
);

export default ListSkeleton;
