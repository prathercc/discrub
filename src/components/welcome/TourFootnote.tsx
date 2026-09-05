import { useState } from 'react';
import {
  Box,
  Popover,
  Typography,
  useTheme,
} from '@mui/material';
import { getTourEntry } from './tourSteps';
import { useTranslation } from 'react-i18next';

interface TourFootnoteProps {
  stepKey: string;
}

/**
 * Footnote-style help marker for typography labels and section headers.
 * Renders a small superscript `?` glyph that hugs the preceding text
 * with no gap and lifts above the baseline. Click opens the same
 * tour-catalog popover used by TourButton.
 *
 * Place immediately after the text element you want it to attach to:
 *
 *   <Typography>Refine</Typography>
 *   <TourFootnote stepKey="refine-section" />
 */
const TourFootnote = ({ stepKey }: TourFootnoteProps) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const entry = getTourEntry(stepKey, t);
  if (!entry) return null;

  const open = Boolean(anchorEl);

  return (
    <>
      <Box
        component="span"
        role="button"
        tabIndex={0}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setAnchorEl(e.currentTarget);
          }
        }}
        data-testid={`tour-footnote-${stepKey}`}
        aria-label={t('tour.help', { title: entry.title })}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width: '1rem',
          height: '1rem',
          ml: 0.4,
          fontSize: '0.65rem',
          lineHeight: 1,
          fontWeight: 800,
          borderRadius: '50%',
          verticalAlign: 'middle',
          color: 'primary.main',
          backgroundColor: (t) => `${t.palette.primary.main}1f`,
          border: '1.5px solid',
          borderColor: 'primary.main',
          cursor: 'help',
          transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms ease, background-color 150ms ease, color 150ms ease',
          '&:hover': {
            transform: 'scale(1.12)',
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            boxShadow: (t) => `0 0 8px ${t.palette.primary.main}66`,
          },
          '&:focus-visible': {
            transform: 'scale(1.12)',
            outline: 'none',
            boxShadow: (t) => `0 0 0 3px ${t.palette.primary.main}40`,
          },
        }}
      >
        ?
      </Box>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
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

export default TourFootnote;
