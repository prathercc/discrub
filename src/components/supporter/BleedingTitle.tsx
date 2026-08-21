import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { keyframes } from '@emotion/react';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { useAppSelector } from '@/app/hooks';
import { selectSetting } from '@features/app/appSlice';

/**
 * The hosted build's title: "Discrub Bleeding Edge" with letters that
 * actually bleed. A crimson-to-blurple gradient fills the text, a soft
 * red glow sits under it, and a handful of drips form at the baseline,
 * stretch, and fall on staggered loops. Motion is gated on the
 * theme-animations setting and prefers-reduced-motion; with motion off
 * the drips stay put as a static stain.
 */

const drip = keyframes`
  0%   { transform: translateY(0) scaleY(0.2); opacity: 0; }
  12%  { transform: translateY(0) scaleY(1);   opacity: 0.95; }
  55%  { transform: translateY(16px) scaleY(1.6); opacity: 0.9; }
  80%  { transform: translateY(30px) scaleY(1); opacity: 0.6; }
  100% { transform: translateY(40px) scaleY(0.6); opacity: 0; }
`;

const seep = keyframes`
  0%, 100% { filter: drop-shadow(0 0 6px rgba(220, 38, 38, 0.45)); }
  50%      { filter: drop-shadow(0 2px 14px rgba(220, 38, 38, 0.75)); }
`;

/** Drip positions along the word, as a percentage of its width. */
const DRIPS = [
  { left: 9, delay: 0.4, duration: 4.2, width: 5 },
  { left: 31, delay: 2.1, duration: 5.1, width: 4 },
  { left: 48, delay: 1.2, duration: 3.8, width: 6 },
  { left: 67, delay: 3.3, duration: 4.6, width: 4 },
  { left: 86, delay: 0.9, duration: 5.4, width: 5 },
];

interface BleedingTitleProps {
  /** Shown under the title in the secondary color (e.g. the build version). */
  caption?: string;
}

const BleedingTitle = ({ caption }: BleedingTitleProps) => {
  const animationsSetting =
    useAppSelector(selectSetting(DiscrubSetting.APP_THEME_ANIMATIONS)) || 'true';
  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const animate = animationsSetting === 'true' && !reducedMotion;

  return (
    <Box sx={{ textAlign: 'center' }} data-testid="bleeding-title" data-animate={animate ? 'true' : 'false'}>
      {/* pb reserves the runway the drips fall through, so they never cross the caption. */}
      <Box sx={{ position: 'relative', display: 'inline-block', px: 1, pb: 7 }}>
        <Typography
          component="h1"
          variant="h4"
          sx={{
            fontWeight: 800,
            letterSpacing: '0.02em',
            lineHeight: 1.15,
            background: 'linear-gradient(180deg, #f8fafc 0%, #fca5a5 38%, #dc2626 62%, #5865F2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: animate ? `${seep} 3.6s ease-in-out infinite` : 'none',
            filter: animate ? undefined : 'drop-shadow(0 2px 10px rgba(220, 38, 38, 0.55))',
          }}
        >
          Discrub Bleeding Edge
        </Typography>
        {/* Drips hang off the baseline of the word. */}
        <Box
          aria-hidden
          sx={{ position: 'absolute', left: 0, right: 0, bottom: 56, height: 0, pointerEvents: 'none' }}
        >
          {DRIPS.map((d, i) => (
            <Box
              key={i}
              data-testid="bleeding-drip"
              sx={{
                position: 'absolute',
                left: `${d.left}%`,
                top: 0,
                width: d.width,
                height: 18,
                borderRadius: '0 0 999px 999px',
                background: 'linear-gradient(180deg, rgba(220,38,38,0.0) 0%, #dc2626 35%, #7f1d1d 100%)',
                transformOrigin: 'top center',
                opacity: animate ? 0 : 0.7,
                transform: animate ? undefined : 'scaleY(0.8)',
                animation: animate
                  ? `${drip} ${d.duration}s cubic-bezier(0.4, 0, 0.6, 1) ${d.delay}s infinite`
                  : 'none',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  left: '50%',
                  bottom: -3,
                  width: d.width + 2,
                  height: d.width + 2,
                  marginLeft: -(d.width + 2) / 2,
                  borderRadius: '50%',
                  background: '#b91c1c',
                },
              }}
            />
          ))}
        </Box>
      </Box>
      {caption && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }} data-testid="bleeding-caption">
          {caption}
        </Typography>
      )}
    </Box>
  );
};

export default BleedingTitle;
