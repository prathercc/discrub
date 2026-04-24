import { IconButton, Tooltip, Box, Typography, LinearProgress, useTheme } from '@mui/material';
import {
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import TourSpot from '@components/welcome/TourSpot';
import { selectDiscrubPaused, setDiscrubPaused, setDiscrubCancelled } from '@features/app/appSlice';
import { selectIsHeavyOperationRunning } from '@features/app/operationSelectors';
import { addStatusEntry } from '@features/status/statusSlice';

interface PauseResumeControlsProps {
  label?: string;
  progress?: number;
}

/**
 * Pause/Resume/Cancel controls for long-running operations.
 * Only visible when an operation is running.
 */
const PauseResumeControls = ({ label, progress }: PauseResumeControlsProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const dispatch = useAppDispatch();
  const isRunning = useAppSelector(selectIsHeavyOperationRunning);
  const isPaused = useAppSelector(selectDiscrubPaused);

  if (!isRunning) return null;

  const handlePauseResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(setDiscrubPaused(!isPaused));
    dispatch(addStatusEntry({ level: isPaused ? 'success' : 'warning', message: isPaused ? 'Operation Resumed' : 'Operation Paused' }));
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(setDiscrubCancelled(true));
    dispatch(setDiscrubPaused(false));
    dispatch(addStatusEntry({ level: 'warning', message: 'Operation Cancelled' }));
  };

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5, px: 1 }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Tooltip title={isPaused ? 'Resume' : 'Pause'} enterDelay={0} arrow>
        <IconButton
          color="inherit"
          onClick={handlePauseResume}
          aria-label={isPaused ? 'Resume' : 'Pause'}
          size="small"
          sx={{
            transition: 'background-color 200ms ease',
            '&:hover': {
              backgroundColor: 'rgba(114, 137, 218, 0.15)',
            },
          }}
        >
          {isPaused ? <ResumeIcon /> : <PauseIcon />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Cancel" enterDelay={0} arrow>
        <IconButton
          color="inherit"
          onClick={handleCancel}
          aria-label="Cancel"
          size="small"
          sx={{
            transition: 'background-color 200ms ease',
            '&:hover': {
              backgroundColor: 'rgba(240, 71, 71, 0.15)',
            },
          }}
        >
          <CancelIcon />
        </IconButton>
      </Tooltip>

      <TourSpot stepKey="pause-resume-controls" size="compact" placement="top" />

      {label && (
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', whiteSpace: 'nowrap', ml: 0.5 }}
        >
          {label}
        </Typography>
      )}

      {progress != null && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            width: 80,
            ml: 0.5,
            height: 6,
            borderRadius: 3,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'primary.main',
              borderRadius: 3,
            },
          }}
        />
      )}
    </Box>
  );
};

export default PauseResumeControls;
