import { useState } from 'react';
import {
  Box,
  IconButton,
  Popover,
  Typography,
  useTheme,
} from '@mui/material';
import { HelpOutline as HelpIcon } from '@mui/icons-material';
import { tourCatalog } from './tourSteps';

interface TourSpotProps {
  /**
   * Key into the shared `tourCatalog`. Each catalog entry has a title
   * and a short paragraph of help copy. Unknown keys render nothing
   * so a typo doesn't crash the tree — but you'll catch it via the
   * tourSteps integrity test.
   */
  stepKey: string;
  /**
   * Popover anchor placement, MUI-style. Defaults to bottom-anchored
   * popper which works for most surfaces; pass `'top'` etc. when the
   * spot is near the bottom of a dialog or visually crowded below.
   */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Visual size variant. `inline` (default) sits on a text baseline
   * next to a label; `compact` is even smaller for crowded toolbars.
   */
  size?: 'inline' | 'compact';
}

/**
 * Targeted tour spot — a small `?` icon that, when clicked, opens a
 * popover with explanatory copy from the shared `tourCatalog`. Solves
 * the "tooltip says what; user wants how it works" gap without
 * forcing them through the full auto-running joyride tour.
 *
 * Lives inline next to the feature it explains. Composable with
 * existing tooltips (which still answer "what is this?") — TourSpot
 * answers "how does this actually work?" with a click-to-open paragraph.
 */
const TourSpot = ({ stepKey, placement = 'bottom', size = 'inline' }: TourSpotProps) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const entry = tourCatalog[stepKey];

  // Unknown key — render nothing. The tourSteps integrity test will
  // flag this in dev; in prod, fail-closed beats a confusing icon.
  if (!entry) return null;

  const open = Boolean(anchorEl);
  const iconSize = size === 'compact' ? 14 : 16;
  const buttonPadding = size === 'compact' ? 0.25 : 0.5;

  // Anchor origin pairs derived from placement so the popover hugs
  // the requested side of the icon.
  const anchorOrigin =
    placement === 'top' ? { vertical: 'top' as const, horizontal: 'center' as const }
    : placement === 'left' ? { vertical: 'center' as const, horizontal: 'left' as const }
    : placement === 'right' ? { vertical: 'center' as const, horizontal: 'right' as const }
    : { vertical: 'bottom' as const, horizontal: 'center' as const };

  const transformOrigin =
    placement === 'top' ? { vertical: 'bottom' as const, horizontal: 'center' as const }
    : placement === 'left' ? { vertical: 'center' as const, horizontal: 'right' as const }
    : placement === 'right' ? { vertical: 'center' as const, horizontal: 'left' as const }
    : { vertical: 'top' as const, horizontal: 'center' as const };

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        data-testid={`tour-spot-${stepKey}`}
        aria-label={`Help: ${entry.title}`}
        sx={{
          p: buttonPadding,
          color: 'text.secondary',
          opacity: 0.5,
          transition: 'opacity 120ms ease',
          '&:hover': { opacity: 1, color: 'primary.main' },
          '&:focus-visible': { opacity: 1, color: 'primary.main' },
        }}
      >
        <HelpIcon sx={{ fontSize: iconSize }} />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={anchorOrigin}
        transformOrigin={transformOrigin}
        slotProps={{
          paper: {
            sx: {
              maxWidth: 320,
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(40, 43, 48, 0.98)'
                : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(8px)',
            },
          },
        }}
      >
        <Box>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, color: 'primary.main', mb: 0.5, fontSize: '0.85rem' }}
          >
            {entry.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'text.primary', fontSize: '0.8rem', lineHeight: 1.5 }}
          >
            {entry.content}
          </Typography>
        </Box>
      </Popover>
    </>
  );
};

export default TourSpot;
