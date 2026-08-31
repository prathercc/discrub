import { useRef } from 'react';
import { Box, Button, Collapse, Typography, Tooltip, IconButton, alpha } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Lock as LockIcon,
  CheckCircle as SelectedIcon,
  BrightnessAuto as AutoIcon,
  VisibilityOutlined as PreviewIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setPreviewThemeId, selectPreviewThemeId } from '@features/app/appSlice';
import {
  THEME_DESCRIPTORS,
  findThemeDescriptor,
  type ThemeDescriptor,
} from '@/theme/theme';

const CARD_WIDTH = 132;

/**
 * Miniature Discrub screen in the theme's colors: top bar, channel
 * sidebar, two message rows, and a CTA pill — a real preview of the
 * app's anatomy rather than abstract color dots.
 */
export const Swatch = ({ descriptor }: { descriptor: ThemeDescriptor }) => {
  const p = descriptor.palette;
  const row = (nameWidth: number, textWidth: number, key: number) => (
    <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      <Box
        sx={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          backgroundColor: p.primary.main,
          opacity: 0.85,
          flexShrink: 0,
        }}
      />
      <Box sx={{ width: nameWidth, height: 3, borderRadius: 2, backgroundColor: p.text.primary, opacity: 0.8 }} />
      <Box sx={{ width: textWidth, height: 3, borderRadius: 2, backgroundColor: p.text.secondary, opacity: 0.55 }} />
    </Box>
  );
  return (
    <Box
      sx={{
        height: 64,
        borderRadius: 1,
        overflow: 'hidden',
        backgroundColor: p.background.default,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          height: 12,
          flexShrink: 0,
          backgroundColor: p.background.paper,
          borderBottom: `1px solid ${p.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          px: '5px',
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: p.primary.main }} />
        <Box sx={{ width: 18, height: 3, borderRadius: 2, backgroundColor: p.text.primary, opacity: 0.85 }} />
        <Box sx={{ flex: 1 }} />
        <Box sx={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: p.cta.main }} />
      </Box>
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Box
          sx={{
            width: 18,
            flexShrink: 0,
            backgroundColor: p.background.paper,
            borderRight: `1px solid ${p.divider}`,
            p: '4px 3px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <Box sx={{ height: 3, borderRadius: 2, backgroundColor: p.primary.main, opacity: 0.9 }} />
          <Box sx={{ height: 3, borderRadius: 2, backgroundColor: p.text.secondary, opacity: 0.45 }} />
          <Box sx={{ height: 3, borderRadius: 2, backgroundColor: p.text.secondary, opacity: 0.45 }} />
        </Box>
        <Box sx={{ flex: 1, p: '5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {row(20, 34, 0)}
          {row(16, 26, 1)}
          <Box sx={{ flex: 1 }} />
          <Box
            sx={{
              alignSelf: 'flex-end',
              width: 18,
              height: 6,
              borderRadius: 3,
              backgroundColor: p.cta.main,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

/** Diagonal split of the default dark and light themes for the Auto card. */
const AutoSwatch = ({ dark, light }: { dark: ThemeDescriptor; light: ThemeDescriptor }) => (
  <Box
    sx={{
      height: 64,
      borderRadius: 1,
      overflow: 'hidden',
      border: '1px solid',
      borderColor: 'divider',
      position: 'relative',
      background: `linear-gradient(135deg, ${dark.palette.background.default} 0%, ${dark.palette.background.default} 49.9%, ${light.palette.background.default} 50.1%, ${light.palette.background.default} 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <AutoIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
  </Box>
);

export interface ThemeGridProps {
  /** Current selection ('auto', a theme id, or a legacy alias). */
  value: string;
  /** Called with the picked theme id (or 'auto'). */
  onChange: (id: string) => void;
  isSupporter?: boolean;
  descriptors?: ThemeDescriptor[];
  cardWidth?: number;
  centered?: boolean;
  'data-testid'?: string;
}

/**
 * The theme card grid inside the Themes hub (its only surface): Auto +
 * every descriptor, a per-card eye toggle for live previewing, lock
 * badges for non-supporters. Picks apply instantly via onChange.
 *
 * Previewing is deliberate and sticky: the eye starts it (clicking a
 * locked card does too, since applying is impossible), and the whole
 * app stays in that theme — even while the pointer wanders off to look
 * around behind the dialog — until the user stops it, previews another
 * theme, applies one, or the hub closes (the hub clears previewThemeId
 * on close). While a preview is active, a bar pinned to the bottom of
 * the grid names it and offers Apply/Stop.
 */
export const ThemeGrid = ({
  value,
  onChange,
  isSupporter = false,
  descriptors = THEME_DESCRIPTORS,
  cardWidth = CARD_WIDTH,
  centered = false,
  'data-testid': testId = 'theme-grid',
}: ThemeGridProps) => {
  const dispatch = useAppDispatch();
  const theme = useTheme();

  // Normalize the form value the same way ThemeWrapper does: legacy
  // aliases resolve to their canonical id, unknown ids behave as auto.
  const selectedId = value === 'auto' ? 'auto' : (findThemeDescriptor(value)?.id ?? 'auto');

  // Previewing the current selection is a visual no-op, so the eye
  // states and the preview bar only light up for a different theme.
  const previewThemeId = useAppSelector(selectPreviewThemeId);
  const previewedId =
    previewThemeId !== null && previewThemeId !== selectedId ? previewThemeId : null;

  const defaultDark = descriptors.find((d) => d.base === 'dark') ?? descriptors[0];
  const defaultLight = descriptors.find((d) => d.base === 'light') ?? descriptors[0];

  const preview = (id: string) => dispatch(setPreviewThemeId(id));
  const stopPreview = () => dispatch(setPreviewThemeId(selectedId));

  const pick = (id: string) => {
    onChange(id);
    dispatch(setPreviewThemeId(id));
  };

  const renderCard = (opts: {
    id: string;
    label: string;
    locked?: boolean;
    tooltip?: string;
    swatch: React.ReactNode;
  }) => {
    const { id, label, locked = false, tooltip, swatch } = opts;
    const selected = selectedId === id;
    const previewed = previewedId === id;
    const card = (
      <Box
        component="button"
        type="button"
        data-testid={`theme-card-${id}`}
        aria-label={locked ? `${label} (supporter theme, locked)` : label}
        aria-pressed={selected}
        onClick={() => {
          // Locked cards can't be applied, so clicking one toggles its
          // preview instead — same as the eye.
          if (!locked) pick(id);
          else if (previewed) stopPreview();
          else preview(id);
        }}
        sx={{
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
          p: 0.75,
          borderRadius: 1.5,
          border: '2px solid',
          borderColor: selected
            ? 'primary.main'
            : previewed
              ? 'cta.main'
              : 'divider',
          backgroundColor: selected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
          // Availability at a glance: unlocked themes carry a faint
          // brand glow, locked ones a soft red one.
          boxShadow: locked
            ? `0 0 7px 0 ${alpha(theme.palette.error.main, 0.3)}`
            : `0 0 7px 0 ${alpha(theme.palette.cta.main, 0.22)}`,
          transition: 'border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease',
          '&:hover': {
            borderColor: selected ? 'primary.main' : alpha(theme.palette.primary.main, 0.5),
            boxShadow: locked
              ? `0 0 10px 1px ${alpha(theme.palette.error.main, 0.4)}`
              : `0 0 10px 1px ${alpha(theme.palette.cta.main, 0.35)}`,
          },
        }}
      >
        {/* Check/lock badges overlay the swatch corner so the label
            keeps the full row width (no truncation). A lapsed user's
            selected-but-relocked theme shows the lock; the selection
            border still marks it as theirs. */}
        <Box sx={{ position: 'relative' }}>
          {swatch}
          {(selected || locked) && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                width: 18,
                height: 18,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(theme.palette.background.paper, 0.85),
              }}
            >
              {locked ? (
                <LockIcon
                  data-testid={`theme-locked-${id}`}
                  sx={{ fontSize: 12, color: 'error.main' }}
                />
              ) : (
                <SelectedIcon
                  data-testid={`theme-selected-${id}`}
                  sx={{ fontSize: 14, color: 'primary.main' }}
                />
              )}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.75, minHeight: 20 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, flex: 1 }} noWrap>
            {label}
          </Typography>
        </Box>
      </Box>
    );
    // The eye is a sibling overlaid on the swatch corner (never nested
    // inside the card button — that would be a button in a button).
    return (
      <Box key={id} sx={{ position: 'relative', width: cardWidth, flexShrink: 0 }}>
        {tooltip ? <Tooltip title={tooltip}>{card}</Tooltip> : card}
        <Tooltip title={previewed ? 'Stop previewing' : 'Preview this theme'} enterDelay={300}>
          <IconButton
            size="small"
            aria-label={previewed ? `Stop previewing ${label}` : `Preview ${label}`}
            aria-pressed={previewed}
            data-testid={`theme-preview-${id}`}
            onClick={() => (previewed ? stopPreview() : preview(id))}
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              p: '3px',
              color: previewed ? 'cta.main' : 'text.secondary',
              backgroundColor: alpha(theme.palette.background.paper, 0.8),
              border: '1px solid',
              borderColor: previewed ? 'cta.main' : 'divider',
              '&:hover': {
                backgroundColor: 'background.paper',
                color: previewed ? 'cta.main' : 'text.primary',
              },
            }}
          >
            <PreviewIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  };

  // Look the previewed theme up in THIS grid's roster (not the global
  // registry) so injected descriptors carry their name and lock state.
  const previewedDescriptor =
    previewedId && previewedId !== 'auto'
      ? (descriptors.find((d) => d.id === previewedId) ?? null)
      : null;
  const previewedLabel = previewedId === 'auto' ? 'Auto' : (previewedDescriptor?.name ?? '');
  const previewedLocked =
    !!previewedDescriptor && previewedDescriptor.tier === 'supporter' && !isSupporter;

  // The bar collapses (rather than vanishing) when a preview stops, so
  // it keeps showing its last contents while animating out.
  const lastBarRef = useRef<{ id: string; label: string; locked: boolean } | null>(null);
  if (previewedId) {
    lastBarRef.current = { id: previewedId, label: previewedLabel, locked: previewedLocked };
  }
  const bar = previewedId
    ? { id: previewedId, label: previewedLabel, locked: previewedLocked }
    : lastBarRef.current;

  return (
    <Box data-testid={testId}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.25,
          ...(centered && { justifyContent: 'center' }),
        }}
      >
        {renderCard({
          id: 'auto',
          label: 'Auto',
          tooltip: 'Match Discord or your system preference',
          swatch: <AutoSwatch dark={defaultDark} light={defaultLight} />,
        })}
        {descriptors.map((d) => {
          const locked = d.tier === 'supporter' && !isSupporter;
          return renderCard({
            id: d.id,
            label: d.name,
            locked,
            swatch: <Swatch descriptor={d} />,
          });
        })}
      </Box>
      <Collapse
        in={Boolean(previewedId)}
        timeout={220}
        unmountOnExit
        sx={{ position: 'sticky', bottom: 0, zIndex: 1 }}
      >
        {bar && (
          <Box
            data-testid="theme-preview-bar"
            sx={{
              mt: 1.25,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              pl: 1.5,
              pr: 1,
              py: 0.5,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'background.paper',
              boxShadow: 3,
              opacity: previewedId ? 1 : 0,
              transition: 'opacity 200ms ease',
            }}
          >
            <PreviewIcon sx={{ fontSize: 16, color: 'cta.main', flexShrink: 0 }} />
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
              Previewing{' '}
              <Box component="span" sx={{ fontWeight: 600 }}>
                {bar.label}
              </Box>
              {bar.locked && ' · Locked'}
            </Typography>
            {!bar.locked && (
              <Button
                size="small"
                variant="contained"
                onClick={() => pick(bar.id)}
                data-testid="theme-preview-apply"
              >
                Apply
              </Button>
            )}
            <Button size="small" color="inherit" onClick={stopPreview} data-testid="theme-preview-stop">
              Stop
            </Button>
          </Box>
        )}
      </Collapse>
    </Box>
  );
};

export default ThemeGrid;
