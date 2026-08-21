import { Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
}

/**
 * Loading spinner component with optional message
 */
const LoadingSpinner = ({ message, size = 40 }: LoadingSpinnerProps) => {
  const theme = useTheme();
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
              <stop offset="0%" stopColor={theme.palette.primary.main} />
              <stop offset="100%" stopColor={theme.palette.primary.dark} />
            </linearGradient>
          </defs>
        </svg>
        <CircularProgress
          size={size}
          sx={{
            color: 'primary.main',
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
