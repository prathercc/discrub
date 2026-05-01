import { useState, type ReactNode } from 'react';
import {
  ButtonGroup,
  Button,
  Badge,
  Popover,
  Box,
  Typography,
  useTheme,
  type ButtonProps,
} from '@mui/material';
import { HelpOutline as HelpIcon } from '@mui/icons-material';
import { tourCatalog } from './tourSteps';

interface TourButtonProps extends Omit<ButtonProps, 'children'> {
  stepKey: string;
  badgeContent?: number;
  children: ReactNode;
  /**
   * Optional sibling Button rendered before the primary button inside the
   * same ButtonGroup. Use when a related quick-action shares the widget,
   * e.g. a Copy icon next to a Multi-select toggle. Pass a Button-shaped
   * element (Button, or Tooltip-wrapped Button).
   */
  leadingButton?: ReactNode;
}

const TourButton = ({
  stepKey,
  badgeContent,
  leadingButton,
  children,
  variant = 'outlined',
  size = 'small',
  ...buttonProps
}: TourButtonProps) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const entry = tourCatalog[stepKey];
  if (!entry) return null;

  const open = Boolean(anchorEl);

  const primaryButton = (
    <Button variant={variant} size={size} {...buttonProps}>
      {children}
    </Button>
  );

  const wrappedPrimary =
    badgeContent !== undefined && badgeContent > 0 ? (
      <Badge
        badgeContent={badgeContent}
        color="primary"
        sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
      >
        {primaryButton}
      </Badge>
    ) : (
      primaryButton
    );

  return (
    <>
      <ButtonGroup variant={variant} size={size}>
        {leadingButton}
        {wrappedPrimary}
        <Button
          onClick={(e) => setAnchorEl(e.currentTarget)}
          data-testid={`tour-spot-${stepKey}`}
          aria-label={`Help: ${entry.title}`}
          sx={{
            px: 0.5,
            minWidth: 32,
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
      </ButtonGroup>
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

export default TourButton;
