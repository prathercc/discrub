import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import type { TypographyProps } from '@mui/material';
import { keyframes } from '@emotion/react';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { useAppSelector } from '@/app/hooks';
import { selectSetting } from '@features/app/appSlice';

/**
 * "Bleeding Edge" wordmark for the hosted build, stacked under a small
 * "Discrub" eyebrow on both the landing page and the TopBar. The bleeding text is
 * mostly white with a rose tint that fades into blurple, sits on a soft
 * glow, and the final "e" of "Edge" bleeds: one thin drip forms under it,
 * slides down, and fades on a slow loop. Motion is gated on the
 * theme-animations setting and prefers-reduced-motion; with motion off
 * the drip stays put as a faint static stain.
 *
 * `BleedingEdgeText` is the bare wordmark (used in the TopBar); the
 * default export wraps it as the landing-page title with a caption.
 */

const drip = keyframes`
  0%   { transform: translateY(0) scaleY(0.3); opacity: 0; }
  15%  { transform: translateY(0) scaleY(1);   opacity: 0.85; }
  60%  { transform: translateY(0.55em) scaleY(1.4); opacity: 0.75; }
  85%  { transform: translateY(0.9em) scaleY(0.9); opacity: 0.35; }
  100% { transform: translateY(1.1em) scaleY(0.5); opacity: 0; }
`;

const seep = keyframes`
  0%, 100% { filter: drop-shadow(0 0 4px rgba(225, 29, 72, 0.18)); }
  50%      { filter: drop-shadow(0 1px 8px rgba(225, 29, 72, 0.32)); }
`;

const DRIP_COLOR = '#9f1239';

/** Returns true when the wordmark should animate. */
export function useBleedingMotion(): boolean {
  const animationsSetting =
    useAppSelector(selectSetting(DiscrubSetting.APP_THEME_ANIMATIONS)) || 'true';
  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  return animationsSetting === 'true' && !reducedMotion;
}

interface BleedingEdgeTextProps {
  /** Typography variant; drip size and travel scale with the font via em units. */
  variant?: TypographyProps['variant'];
  /** Render "Discrub" inline before the bleeding words (TopBar); the title stacks it instead. */
  withPrefix?: boolean;
  component?: React.ElementType;
  /** Drip loop length in seconds (long gaps between drips keep it subtle). */
  period?: number;
  sx?: TypographyProps['sx'];
}

export const BleedingEdgeText = ({
  variant = 'h4',
  component = 'span',
  period = 7,
  withPrefix = true,
  sx,
}: BleedingEdgeTextProps) => {
  const animate = useBleedingMotion();
  return (
    <Typography
      component={component}
      variant={variant}
      data-testid="bleeding-title"
      data-animate={animate ? 'true' : 'false'}
      sx={[
        {
          display: 'inline-block',
          fontWeight: 800,
          letterSpacing: '0.02em',
          lineHeight: 1.15,
          // Top/bottom stops follow the active theme so the wordmark reads on any palette;
          // the rose tint in the middle is the constant "bleeding" note.
          background: (theme) => {
            const rose = theme.palette.mode === 'dark' ? ['#fecdd3', '#fda4af'] : ['#be123c', '#e11d48'];
            return `linear-gradient(180deg, ${theme.palette.text.primary} 0%, ${rose[0]} 45%, ${rose[1]} 68%, ${theme.palette.primary.main} 100%)`;
          },
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: animate ? `${seep} 4.8s ease-in-out infinite` : 'none',
          filter: animate ? undefined : 'drop-shadow(0 1px 6px rgba(225, 29, 72, 0.25))',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {withPrefix ? 'Discrub Bleeding Edg' : 'Bleeding Edg'}
      <Box component="span" sx={{ position: 'relative', display: 'inline-block' }}>
        e
        {/* The single drip hangs off the bottom of the final "e". */}
        <Box
          component="span"
          aria-hidden
          data-testid="bleeding-drip"
          sx={{
            position: 'absolute',
            left: '50%',
            bottom: '-0.08em',
            width: '0.09em',
            height: '0.34em',
            marginLeft: '-0.045em',
            borderRadius: '0 0 999px 999px',
            background: `linear-gradient(180deg, rgba(159,18,57,0) 0%, ${DRIP_COLOR} 40%, ${DRIP_COLOR} 100%)`,
            transformOrigin: 'top center',
            opacity: animate ? 0 : 0.45,
            transform: animate ? undefined : 'scaleY(0.7)',
            animation: animate ? `${drip} ${period}s cubic-bezier(0.4, 0, 0.6, 1) 1.5s infinite` : 'none',
            pointerEvents: 'none',
          }}
        />
      </Box>
    </Typography>
  );
};

interface BleedingStackProps {
  /** 'title' = landing page (h4 wordmark); 'bar' = TopBar (fits a 64px toolbar). */
  size?: 'title' | 'bar';
}

/**
 * The stacked wordmark: a quiet, letter-spaced "Discrub" eyebrow over the
 * bleeding "Bleeding Edge". Same shape on the landing page and in the
 * hosted TopBar, just scaled.
 */
export const BleedingStack = ({ size = 'title' }: BleedingStackProps) => {
  const bar = size === 'bar';
  return (
    <Box
      sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: bar ? 'flex-start' : 'center' }}
      data-testid="bleeding-title-stack"
    >
      <Typography
        component={bar ? 'span' : 'h1'}
        variant="overline"
        data-testid="bleeding-prefix"
        sx={{
          display: 'block',
          lineHeight: 1.2,
          letterSpacing: bar ? '0.22em' : '0.28em',
          fontSize: bar ? '0.55rem' : undefined,
          fontWeight: 600,
          color: 'text.secondary',
          mb: bar ? 0 : 0.25,
          ml: bar ? '0.1em' : 0,
        }}
      >
        Discrub
      </Typography>
      {/* pb reserves the runway the drip falls through, so it never crosses what sits below. */}
      <Box sx={{ display: 'inline-block', px: bar ? 0 : 1, pb: bar ? 0 : 3 }}>
        <BleedingEdgeText
          component="div"
          variant={bar ? 'h6' : 'h4'}
          withPrefix={false}
          period={bar ? 9 : 7}
          sx={bar ? { fontWeight: 700, letterSpacing: 0, lineHeight: 1.05, fontSize: '1.05rem' } : undefined}
        />
      </Box>
    </Box>
  );
};

interface BleedingTitleProps {
  /** Shown under the title in the secondary color (e.g. the build version). */
  caption?: string;
}

const BleedingTitle = ({ caption }: BleedingTitleProps) => (
  <Box sx={{ textAlign: 'center' }}>
    <BleedingStack size="title" />
    {caption && (
      <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }} data-testid="bleeding-caption">
        {caption}
      </Typography>
    )}
  </Box>
);

export default BleedingTitle;
