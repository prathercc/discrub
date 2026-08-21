import { Box, Typography, Tooltip, Checkbox, FormControlLabel, alpha } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Lock as LockIcon,
  CheckCircle as SelectedIcon,
  BrightnessAuto as AutoIcon,
} from '@mui/icons-material';
import { useAppDispatch } from '@/app/hooks';
import { setPreviewThemeId } from '@features/app/appSlice';
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
   * Supporter unlock state. Locked themes hover-preview but can't be
   * selected. Wired to real key verification in the supporter-platform
   * slot; until then the caller passes false.
   */
  isSupporter?: boolean;
  /** Injectable for tests; defaults to the app registry. */
  descriptors?: ThemeDescriptor[];
}

const CARD_WIDTH = 132;

/** Miniature palette preview: default background, paper stripe, accent dots. */
const Swatch = ({ descriptor }: { descriptor: ThemeDescriptor }) => {
  const p = descriptor.palette;
  return (
    <Box
      sx={{
        height: 56,
        borderRadius: 1,
        overflow: 'hidden',
        backgroundColor: p.background.default,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, pb: 0.5 }}>
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: p.primary.main }} />
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: p.cta.main }} />
        <Box sx={{ flex: 1 }} />
        <Box sx={{ width: 28, height: 8, borderRadius: 0.5, backgroundColor: p.text.secondary, opacity: 0.6 }} />
      </Box>
      <Box sx={{ height: 16, backgroundColor: p.background.paper }} />
    </Box>
  );
};

/** Diagonal split of the default dark and light themes for the Auto card. */
const AutoSwatch = ({ dark, light }: { dark: ThemeDescriptor; light: ThemeDescriptor }) => (
  <Box
    sx={{
      height: 56,
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

export const ThemePicker = ({
  value,
  onChange,
  animationsValue,
  onAnimationsChange,
  isSupporter = false,
  descriptors = THEME_DESCRIPTORS,
}: ThemePickerProps) => {
  const dispatch = useAppDispatch();
  const theme = useTheme();

  // Normalize the form value the same way ThemeWrapper does: legacy
  // aliases resolve to their canonical id, unknown ids behave as auto.
  const selectedId = value === 'auto' ? 'auto' : (findThemeDescriptor(value)?.id ?? 'auto');

  const defaultDark = descriptors.find((d) => d.base === 'dark') ?? descriptors[0];
  const defaultLight = descriptors.find((d) => d.base === 'light') ?? descriptors[0];

  // Hover/focus shows the candidate theme live; leaving reverts to the
  // current form selection (identical to the saved theme until the user
  // picks something, so an untouched open never shifts colors).
  // SettingsModal clears the preview entirely on save/close.
  const preview = (id: string) => dispatch(setPreviewThemeId(id));
  const revertToSelection = () => dispatch(setPreviewThemeId(selectedId));

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
        onMouseLeave={revertToSelection}
        onFocus={() => preview(id)}
        onBlur={revertToSelection}
        onClick={() => {
          if (!locked) pick(id);
        }}
        sx={{
          width: CARD_WIDTH,
          textAlign: 'left',
          cursor: locked ? 'default' : 'pointer',
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
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Theme
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
        Hover a theme to preview it live. Your choice applies when you save.
      </Typography>
      <Box data-testid="theme-picker" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }} onMouseLeave={revertToSelection}>
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
              ? 'Supporter theme. Support Discrub to unlock it. Hover to preview.'
              : undefined,
            swatch: <Swatch descriptor={d} />,
          });
        })}
      </Box>

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
