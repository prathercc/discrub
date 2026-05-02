import { useState, useRef, useEffect } from 'react';
import { ButtonGroup, Button, Tooltip, Box, Typography, LinearProgress, Popover, useTheme, keyframes } from '@mui/material';
import {
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
  Cancel as CancelIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { tourCatalog } from '@components/welcome/tourSteps';
import { selectDiscrubPaused, setDiscrubPaused, setDiscrubCancelled } from '@features/app/appSlice';
import { selectIsHeavyOperationRunning } from '@features/app/operationSelectors';
import { addStatusEntry } from '@features/status/statusSlice';

interface PauseResumeControlsProps {
  label?: string;
  progress?: number;
}

/**
 * Brief flash animation applied to the progress label whenever the
 * counter values change. Confirms to the user that the operation is
 * making progress, even when the StatusPanel is collapsed and only
 * the label is visible. Honors prefers-reduced-motion via the wrapping
 * `@media` query.
 */
const labelPulse = keyframes`
  0%   { color: var(--mui-palette-primary-main, #5865f2); }
  60%  { color: var(--mui-palette-primary-main, #5865f2); }
  100% { color: var(--mui-palette-text-secondary, #8b949e); }
`;

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
  const [helpAnchor, setHelpAnchor] = useState<HTMLButtonElement | null>(null);
  const tourEntry = tourCatalog['pause-resume-controls'];

  // Bump a key whenever the label text changes so the Typography below
  // remounts and re-fires the pulse keyframe. Cheap visual cue that
  // counters in the label have just ticked.
  const lastLabelRef = useRef<string | undefined>(label);
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (label && label !== lastLabelRef.current) {
      lastLabelRef.current = label;
      setPulseKey((k) => k + 1);
    }
  }, [label]);

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
      <ButtonGroup variant="text" size="small" color="inherit">
        <Tooltip title={isPaused ? 'Resume' : 'Pause'} enterDelay={0} arrow>
          <Button
            onClick={handlePauseResume}
            aria-label={isPaused ? 'Resume' : 'Pause'}
            sx={{ minWidth: 32, px: 0.5, '&:hover': { backgroundColor: 'rgba(114, 137, 218, 0.15)' } }}
          >
            {isPaused ? <ResumeIcon /> : <PauseIcon />}
          </Button>
        </Tooltip>

        <Tooltip title="Cancel" enterDelay={0} arrow>
          <Button
            onClick={handleCancel}
            aria-label="Cancel"
            sx={{ minWidth: 32, px: 0.5, '&:hover': { backgroundColor: 'rgba(240, 71, 71, 0.15)' } }}
          >
            <CancelIcon />
          </Button>
        </Tooltip>

        {tourEntry && (
          <Button
            onClick={(e) => setHelpAnchor(e.currentTarget)}
            aria-label={`Help: ${tourEntry.title}`}
            data-testid="tour-spot-pause-resume-controls"
            sx={{
              minWidth: 32,
              px: 0.5,
              cursor: 'help',
              color: 'text.secondary',
              opacity: 0.6,
              transition: 'opacity 120ms ease, color 120ms ease',
              '&:hover': { opacity: 1, color: 'primary.main' },
              '&:focus-visible': { opacity: 1, color: 'primary.main' },
            }}
          >
            <HelpIcon sx={{ fontSize: 14 }} />
          </Button>
        )}
      </ButtonGroup>

      {tourEntry && (
        <Popover
          open={Boolean(helpAnchor)}
          anchorEl={helpAnchor}
          onClose={() => setHelpAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          slotProps={{
            paper: {
              sx: {
                maxWidth: 320,
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: isDark ? 'rgba(40, 43, 48, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(8px)',
              },
            },
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 0.5, fontSize: '0.85rem' }}>
              {tourEntry.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.primary', fontSize: '0.8rem', lineHeight: 1.5 }}>
              {tourEntry.content}
            </Typography>
          </Box>
        </Popover>
      )}

      {label && (
        <Typography
          key={pulseKey}
          variant="caption"
          sx={{
            color: 'text.secondary',
            whiteSpace: 'nowrap',
            ml: 0.5,
            animation: `${labelPulse} 600ms ease-out`,
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
            },
          }}
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
