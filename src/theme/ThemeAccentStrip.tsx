import { Box, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { useAppSelector } from '@/app/hooks';
import { selectSetting } from '@features/app/appSlice';
import { selectIsHeavyOperationRunning } from '@features/app/operationSelectors';

// 'flow' drifts a 200%-wide gradient one full period per loop; accent
// gradients start and end on the same color, so the wrap is seamless.
const flow = keyframes`
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 0.9; }
`;

/**
 * The supporter themes' single animated accent: a thin gradient strip
 * under the top bar. Free themes have no accent and render nothing.
 *
 * Motion is gated on the APP_THEME_ANIMATIONS setting and paused while
 * a heavy operation runs (the strip stays visible, just static). The
 * global prefers-reduced-motion rule in globalStyles zeroes the
 * animation for users who ask for reduced motion.
 */
const ThemeAccentStrip = () => {
  const theme = useTheme();
  const accent = theme.themeAccent;
  const animationsSetting = useAppSelector(selectSetting(DiscrubSetting.APP_THEME_ANIMATIONS));
  const isOperationRunning = useAppSelector(selectIsHeavyOperationRunning);

  if (!accent) return null;

  const animate = animationsSetting !== 'false' && !isOperationRunning;
  const motion = accent.motion === 'pulse' ? pulse : flow;

  return (
    <Box
      aria-hidden
      data-testid="theme-accent-strip"
      data-animated={animate ? 'true' : 'false'}
      sx={{
        height: 2,
        flexShrink: 0,
        background: accent.background,
        backgroundSize: accent.motion === 'flow' ? '200% 100%' : undefined,
        opacity: accent.motion === 'pulse' && !animate ? 0.6 : undefined,
        animation: animate ? `${motion} ${accent.durationS}s linear infinite` : 'none',
      }}
    />
  );
};

export default ThemeAccentStrip;
