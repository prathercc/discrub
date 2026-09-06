import { useState, useRef, useEffect, useMemo } from 'react';
import { ButtonGroup, Button, Box, Typography, LinearProgress, Popover, useTheme, keyframes, alpha } from '@mui/material';
import {
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
  Cancel as CancelIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { getTourEntry } from '@components/welcome/tourSteps';
import { selectDiscrubPaused, selectRestBreakUntil, setDiscrubPaused, setDiscrubCancelled } from '@features/app/appSlice';
import { selectIsHeavyOperationRunning } from '@features/app/operationSelectors';
import { addStatusEntry } from '@features/status/statusSlice';
import { HotkeyTooltip } from '@components/ui/HotkeyTooltip';
import { useHotkey } from '@features/hotkeys/HotkeyProvider';
import { useTranslation } from 'react-i18next';

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
const buildLabelPulse = (pulseColor: string, restColor: string) => keyframes`
  0%   { color: ${pulseColor}; }
  60%  { color: ${pulseColor}; }
  100% { color: ${restColor}; }
`;

/**
 * "Rest break · resumes in m:ss", ticking once a second while an automatic
 * rest break (`useRestBreaks`) holds the operation. Empty otherwise.
 */
const useRestBreakCountdown = (restBreakUntil: number | null): string => {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (restBreakUntil == null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [restBreakUntil]);
  if (restBreakUntil == null) return '';
  const remaining = Math.max(0, Math.ceil((restBreakUntil - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');
  return t('restBreak.countdown', { time: `${minutes}:${seconds}` });
};

/**
 * Pause/Resume/Cancel controls for long-running operations.
 * Only visible when an operation is running.
 */
const PauseResumeControls = ({ label, progress }: PauseResumeControlsProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const labelPulse = useMemo(
    () => buildLabelPulse(theme.palette.primary.main, theme.palette.text.secondary),
    [theme],
  );
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const isRunning = useAppSelector(selectIsHeavyOperationRunning);
  const isPaused = useAppSelector(selectDiscrubPaused);
  const restBreakUntil = useAppSelector(selectRestBreakUntil);
  const restBreakLabel = useRestBreakCountdown(restBreakUntil);
  const [helpAnchor, setHelpAnchor] = useState<HTMLButtonElement | null>(null);
  const tourEntry = getTourEntry('pause-resume-controls', t);

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

  // Hotkey wiring (#144). Both gate on `isRunning` so they only fire
  // when an operation is actually in flight; outside that window the
  // bindings (Space, mod+.) fall through and behave normally — Space
  // still scrolls the page, etc.
  const togglePause = () => {
    dispatch(setDiscrubPaused(!isPaused));
    dispatch(addStatusEntry({ level: isPaused ? 'success' : 'warning', message: isPaused ? t('pause.operationResumed') : t('pause.operationPaused') }));
  };
  const cancelOp = () => {
    dispatch(setDiscrubCancelled(true));
    dispatch(setDiscrubPaused(false));
    dispatch(addStatusEntry({ level: 'warning', message: t('pause.operationCancelled') }));
  };
  useHotkey('pauseResume', togglePause, isRunning);
  useHotkey('cancelOp', cancelOp, isRunning);

  if (!isRunning) return null;

  const handlePauseResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePause();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelOp();
  };

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5, px: 1 }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <ButtonGroup variant="text" size="small" color="inherit">
        <HotkeyTooltip
          actionId="pauseResume"
          label={isPaused ? t('pause.resume') : t('pause.pause')}
          enterDelay={0}
          arrow
        >
          <Button
            onClick={handlePauseResume}
            aria-label={isPaused ? t('pause.resume') : t('pause.pause')}
            sx={{ minWidth: 32, px: 0.5, '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.15) } }}
          >
            {isPaused ? <ResumeIcon /> : <PauseIcon />}
          </Button>
        </HotkeyTooltip>

        <HotkeyTooltip actionId="cancelOp" label={t('pause.cancel')} enterDelay={0} arrow>
          <Button
            onClick={handleCancel}
            aria-label={t('pause.cancel')}
            sx={{ minWidth: 32, px: 0.5, '&:hover': { backgroundColor: 'rgba(240, 71, 71, 0.15)' } }}
          >
            <CancelIcon />
          </Button>
        </HotkeyTooltip>

        {tourEntry && (
          <Button
            onClick={(e) => setHelpAnchor(e.currentTarget)}
            aria-label={t('pause.help', { title: tourEntry.title })}
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

      {restBreakLabel && (
        <Typography
          variant="caption"
          data-testid="rest-break-countdown"
          sx={{ color: 'warning.main', whiteSpace: 'nowrap', ml: 0.5 }}
        >
          {restBreakLabel}
        </Typography>
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
