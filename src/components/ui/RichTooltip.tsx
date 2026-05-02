import { type ReactNode } from 'react';
import { Tooltip, Box, Typography, type TooltipProps } from '@mui/material';

interface RichTooltipProps extends Omit<TooltipProps, 'title'> {
  /** Bold heading rendered in primary color above the body. */
  heading?: ReactNode;
  /** Body content. Plain string or any ReactNode. */
  body: ReactNode;
}

/**
 * Tooltip variant with a primary-colored bold heading and a body block.
 * Use when a tooltip needs more than a single short line (e.g. "Filters: 2
 * active. Drafted refinements waiting to apply.").
 *
 * For plain one-line tooltips, prefer the bare MUI <Tooltip>; the theme
 * override already applies the same dark/blur paper styling.
 */
const RichTooltip = ({ heading, body, children, ...rest }: RichTooltipProps) => (
  <Tooltip
    {...rest}
    title={
      <Box>
        {heading && (
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, color: 'primary.main', mb: 0.5, fontSize: '0.8rem' }}
          >
            {heading}
          </Typography>
        )}
        <Typography
          variant="body2"
          sx={{ color: 'text.primary', fontSize: '0.78rem', lineHeight: 1.5 }}
        >
          {body}
        </Typography>
      </Box>
    }
  >
    {children}
  </Tooltip>
);

export default RichTooltip;
