import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { InfoOutlined as InfoIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectOperationTip, hideOperationTip } from '@features/status/statusSlice';

const AUTO_DISMISS_MS = 3000;

/**
 * OperationTip - a brief floating tip that appears when an operation starts,
 * guiding the user to the status bar controls. Auto-dismisses after 3 seconds.
 */
const OperationTip = () => {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const { isVisible, message } = useAppSelector(selectOperationTip);
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    if (isVisible) {
      setMounted(true);
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setShow(true));
      });

      // Auto-dismiss timer
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        dispatch(hideOperationTip());
      }, AUTO_DISMISS_MS);
    } else {
      // Trigger exit animation
      setShow(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isVisible, message, dispatch]);

  const handleTransitionEnd = () => {
    if (!show) {
      setMounted(false);
    }
  };

  const handleClick = () => {
    dispatch(hideOperationTip());
  };

  if (!mounted) return null;

  return (
    <Box
      onClick={handleClick}
      onTransitionEnd={handleTransitionEnd}
      sx={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        mb: 0.5,
        ml: 1,
        zIndex: 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.5,
        py: 0.5,
        backgroundColor: isDark ? 'rgba(40, 43, 48, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.3 : 0.25)}`,
        borderRadius: 1.5,
        boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.12)',
        cursor: 'pointer',
        pointerEvents: show ? 'auto' : 'none',
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(4px)',
        transition: show
          ? 'opacity 300ms ease-out, transform 300ms ease-out'
          : 'opacity 250ms ease-in, transform 250ms ease-in',
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, isDark ? 0.5 : 0.4),
        },
      }}
    >
      <InfoIcon sx={{ color: 'primary.main', fontSize: 16 }} />
      <Typography
        variant="caption"
        sx={{ color: isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.8)', whiteSpace: 'nowrap', fontSize: '0.7rem' }}
      >
        {message}
      </Typography>
    </Box>
  );
};

export default OperationTip;
