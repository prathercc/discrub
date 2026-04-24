import { Box, Typography } from '@mui/material';

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

/**
 * Empty state component for displaying "no data" messages
 */
const EmptyState = ({ message, icon }: EmptyStateProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: 4,
        color: 'text.secondary',
      }}
    >
      {icon && <Box sx={{ fontSize: '48px', opacity: 0.5 }}>{icon}</Box>}
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
};

export default EmptyState;
