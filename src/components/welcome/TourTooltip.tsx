import { Box, Typography, Button, IconButton, LinearProgress } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { Close as CloseIcon } from '@mui/icons-material';
import type { TooltipRenderProps } from 'react-joyride';

const TourTooltip = ({
  continuous,
  index,
  isLastStep,
  step,
  size,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) => {
  const progress = ((index + 1) / size) * 100;

  return (
    <Box
      {...tooltipProps}
      sx={{
        maxWidth: 340,
        borderRadius: 2,
        backgroundColor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
      }}
    >
      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 3,
          '& .MuiLinearProgress-bar': {
            background: (theme: Theme) =>
              `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          },
          backgroundColor: 'divider',
        }}
      />

      <Box sx={{ p: 2 }}>
        {/* Header with close */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          {step.title && (
            <Typography variant="subtitle2" sx={{ fontWeight: 600, pr: 1 }}>
              {step.title as string}
            </Typography>
          )}
          <IconButton {...closeProps} size="small" sx={{ ml: 'auto', mt: -0.5, mr: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Content */}
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5, mb: 2 }}>
          {step.content}
        </Typography>

        {/* Footer with navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {index + 1} of {size}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {index === 0 && (
              <Button {...skipProps} size="small" sx={{ textTransform: 'none', color: 'text.secondary' }}>
                Skip
              </Button>
            )}
            {index > 0 && (
              <Button {...backProps} size="small" sx={{ textTransform: 'none' }}>
                Back
              </Button>
            )}
            {continuous && (
              <Button
                {...primaryProps}
                size="small"
                variant="contained"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {isLastStep ? 'Finish' : 'Next'}
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default TourTooltip;
