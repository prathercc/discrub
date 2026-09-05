import { useState } from 'react';
import {
  Box,
  Popover,
  Typography,
  Link,
  useTheme,
} from '@mui/material';
import { getTourEntry } from './tourSteps';
import { useTranslation } from 'react-i18next';

interface TourCaptionProps {
  stepKey: string;
  /**
   * Optional short hint to render in the caption itself. If provided,
   * the caption reads "<hint> <More info>" with "More info" linking to
   * the popover. If omitted, the caption is just the "More info" link.
   */
  hint?: string;
}

/**
 * Form-helper-style help caption for surfaces that don't have a natural
 * spot for an inline icon — Selects, TextFields, file pickers, etc.
 *
 * Renders below the input as a small dim caption with an inline
 * "More info" affordance that opens the standard tour-catalog popover.
 *
 *   <Select>...</Select>
 *   <TourCaption stepKey="export-presets" hint="Save and reuse common export setups." />
 */
const TourCaption = ({ stepKey, hint }: TourCaptionProps) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const entry = getTourEntry(stepKey, t);
  if (!entry) return null;

  const open = Boolean(anchorEl);

  return (
    <>
      <Typography
        variant="caption"
        sx={{
          color: 'text.disabled',
          fontSize: '0.7rem',
          lineHeight: 1.4,
          display: 'block',
          mt: 0.5,
        }}
      >
        {hint ? `${hint} ` : ''}
        <Link
          component="button"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          data-testid={`tour-caption-${stepKey}`}
          aria-label={t('tour.help', { title: entry.title })}
          sx={{
            verticalAlign: 'baseline',
            fontSize: 'inherit',
            fontWeight: 500,
            color: 'text.secondary',
            textDecorationColor: 'currentColor',
            textUnderlineOffset: '2px',
            cursor: 'help',
            transition: 'color 120ms ease',
            '&:hover': { color: 'primary.main' },
            '&:focus-visible': { color: 'primary.main', outline: 'none' },
          }}
        >
          More info
        </Link>
      </Typography>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              maxWidth: 320,
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              backgroundColor:
                theme.palette.mode === 'dark'
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

export default TourCaption;
