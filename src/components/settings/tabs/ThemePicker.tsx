import { Box, Typography, Tooltip, Checkbox, FormControlLabel, alpha } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Lock as LockIcon,
  CheckCircle as SelectedIcon,
  BrightnessAuto as AutoIcon,
} from '@mui/icons-material';
import { useAppDispatch } from '@/app/hooks';
import { setPreviewThemeId } from '@features/app/appSlice';
import { setSupporterDialogOpen } from '@features/supporter/supporterSlice';
import {
  THEME_DESCRIPTORS,
  findThemeDescriptor,
  type ThemeDescriptor,
} from '@/theme/theme';

interface ThemePickerProps {
  /** Current APP_THEME_MODE form value ('auto', a theme id, or a legacy alias). */
  value: string;
  /** Called with the picked theme id (or 'auto'). */
  onChange: (id: string) => void;
  /** Current APP_THEME_ANIMATIONS form value ('true'/'false'). */
  animationsValue: string;
  onAnimationsChange: (value: string) => void;
  /**
   * Supporter unlock state (from selectIsSupporter). Locked themes
   * hover-preview but can't be selected; clicking one opens the
   * Supporter dialog.
   */
  isSupporter?: boolean;
  /** Injectable for tests; defaults to the app registry. */
  descriptors?: ThemeDescriptor[];
}

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
  /**
   * Click on a locked card. Defaults to opening the Supporter dialog;
   * pass a no-op when the grid already lives inside that dialog.
   */
  onLockedClick?: () => void;
  descriptors?: ThemeDescriptor[];
  cardWidth?: number;
  /** Center the card rows (the hub dialog); Settings keeps form alignment. */
  centered?: boolean;
  'data-testid'?: string;
}

/**
 * The shared theme card grid: Auto + every descriptor, hover/focus
 * live-preview, lock badges for non-supporters. Used by the Settings
 * picker (form semantics) and the Supporter dialog (instant apply).
 *
 * The preview only reverts when the pointer leaves the whole grid (or
 * focus moves out of it) — never between cards, so crossing the gaps
 * doesn't flash the saved theme back in.
 */
export const ThemeGrid = ({
  value,
  onChange,
  isSupporter = false,
  onLockedClick,
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

  const defaultDark = descriptors.find((d) => d.base === 'dark') ?? descriptors[0];
  const defaultLight = descriptors.find((d) => d.base === 'light') ?? descriptors[0];

  const preview = (id: string) => dispatch(setPreviewThemeId(id));
  const revertToSelection = () => dispatch(setPreviewThemeId(selectedId));
  const handleLockedClick = onLockedClick ?? (() => dispatch(setSupporterDialogOpen(true)));

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
    const card = (
      <Box
        key={id}
        component="button"
        type="button"
        data-testid={`theme-card-${id}`}
        aria-label={locked ? `${label} (supporter theme, locked)` : label}
        aria-pressed={selected}
        onMouseEnter={() => preview(id)}
        onFocus={() => preview(id)}
        onClick={() => {
          // Locked cards route to the unlock pitch right where the
          // interest was expressed.
          if (locked) handleLockedClick();
          else pick(id);
        }}
        sx={{
          width: cardWidth,
          textAlign: 'left',
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
          p: 0.75,
          borderRadius: 1.5,
          border: '2px solid',
          borderColor: selected ? 'primary.main' : 'divider',
          backgroundColor: selected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
          transition: 'border-color 150ms ease, background-color 150ms ease',
          position: 'relative',
          '&:hover': {
            borderColor: selected ? 'primary.main' : alpha(theme.palette.primary.main, 0.5),
          },
        }}
      >
        {swatch}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, minHeight: 20 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, flex: 1 }} noWrap>
            {label}
          </Typography>
          {selected && (
            <SelectedIcon data-testid={`theme-selected-${id}`} sx={{ fontSize: 16, color: 'primary.main' }} />
          )}
          {locked && (
            <LockIcon data-testid={`theme-locked-${id}`} sx={{ fontSize: 14, color: 'text.secondary' }} />
          )}
        </Box>
      </Box>
    );
    return tooltip ? (
      <Tooltip key={id} title={tooltip}>
        {card}
      </Tooltip>
    ) : (
      card
    );
  };

  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.25,
        ...(centered && { justifyContent: 'center' }),
      }}
      onMouseLeave={revertToSelection}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) revertToSelection();
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
          tooltip: locked
            ? 'Supporter theme. Hover to preview, click to learn more.'
            : undefined,
          swatch: <Swatch descriptor={d} />,
        });
      })}
    </Box>
  );
};

export const ThemePicker = ({
  value,
  onChange,
  animationsValue,
  onAnimationsChange,
  isSupporter = false,
  descriptors = THEME_DESCRIPTORS,
}: ThemePickerProps) => {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Theme
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
        Hover a theme to preview it live. Your choice applies when you save.
      </Typography>
      <ThemeGrid
        data-testid="theme-picker"
        value={value}
        onChange={onChange}
        isSupporter={isSupporter}
        descriptors={descriptors}
      />

      <FormControlLabel
        sx={{ mt: 2 }}
        control={
          <Checkbox
            checked={animationsValue === 'true'}
            onChange={(e) => onAnimationsChange(e.target.checked ? 'true' : 'false')}
            inputProps={{ 'aria-label': 'Theme animations' } as React.InputHTMLAttributes<HTMLInputElement>}
          />
        }
        label={
          <Box>
            <Typography variant="body2">Theme animations</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Allow subtle animated accents on themes that include them. Paused while an
              operation is running and disabled when your system prefers reduced motion.
            </Typography>
          </Box>
        }
      />
    </Box>
  );
};

export default ThemePicker;
