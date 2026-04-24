import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
}

/**
 * Loading spinner component with optional message
 */
const LoadingSpinner = ({ message, size = 40 }: LoadingSpinnerProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: 4,
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <svg width="0" height="0">
          <defs>
            <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7289da" />
              <stop offset="100%" stopColor="#5865f2" />
            </linearGradient>
          </defs>
        </svg>
        <CircularProgress
          size={size}
          sx={{
            color: '#7289da',
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
              stroke: 'url(#spinner-gradient)',
            },
          }}
        />
      </Box>
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default LoadingSpinner;
