import { Box, Skeleton, keyframes } from '@mui/material';

const glowPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`;

/**
 * Compact skeleton placeholder shown while messages are loading.
 * Single row with table-like structure to hint at incoming content.
 */
const MessageTableSkeleton = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 3,
      border: 1,
      borderColor: 'divider',
      bgcolor: 'background.paper',
      overflow: 'hidden',
    }}
  >
    {/* Header skeleton */}
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Skeleton variant="rounded" width={18} height={18} />
      <Skeleton variant="text" width={80} height={16} />
      <Skeleton variant="text" width={100} height={16} />
      <Box sx={{ flex: 1 }} />
      <Skeleton variant="text" width={60} height={16} />
    </Box>
    {/* Single content row */}
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 0.75,
        height: 53,
        animation: `${glowPulse} 1.8s ease-in-out infinite`,
      }}
    >
      <Skeleton variant="rounded" width={18} height={18} />
      <Skeleton variant="circular" width={24} height={24} />
      <Skeleton variant="text" width={80} height={16} />
      <Skeleton variant="text" width={110} height={14} />
      <Skeleton variant="text" width="40%" height={14} sx={{ flex: 1 }} />
      <Skeleton variant="rounded" width={20} height={20} />
    </Box>
  </Box>
);

export default MessageTableSkeleton;
