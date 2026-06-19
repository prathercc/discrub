import type { Meta, StoryObj } from '@storybook/react';
import { Box, Paper, Stack, Typography, useTheme, Divider } from '@mui/material';

/**
 * Foundations — the design tokens the rest of the catalog is built on:
 * the color palette, typography scale, spacing rhythm, and the polished
 * surface/backdrop pattern shared by RichTooltip and the TourButton family.
 *
 * Everything here reads from the live MUI theme, so it never drifts from
 * `src/theme/theme.ts`.
 */
const meta: Meta = {
  title: 'Foundations/Theme',
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj;

function Swatch({ name, color }: { name: string; color: string }) {
  return (
    <Stack spacing={0.5} sx={{ width: 132 }}>
      <Box sx={{ height: 56, borderRadius: 1, background: color, border: '1px solid rgba(255,255,255,0.1)' }} />
      <Typography variant="caption" sx={{ fontWeight: 600 }}>{name}</Typography>
      <Typography variant="caption" color="text.secondary">{color}</Typography>
    </Stack>
  );
}

export const Colors: Story = {
  render: () => {
    const t = useTheme();
    const p = t.palette;
    const swatches: Array<[string, string]> = [
      ['primary.main', p.primary.main],
      ['secondary.main', p.secondary.main],
      ['error.main', p.error.main],
      ['warning.main', p.warning.main],
      ['success.main', p.success.main],
      ['background.default', p.background.default],
      ['background.paper', p.background.paper],
      ['text.primary', p.text.primary],
      ['text.secondary', p.text.secondary],
      ['primaryGradient', (p as { primaryGradient?: string }).primaryGradient ?? p.primary.main],
      ['backgroundElevated', (p as { backgroundElevated?: string }).backgroundElevated ?? p.background.paper],
    ];
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Palette</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {swatches.map(([name, color]) => <Swatch key={name} name={name} color={color} />)}
        </Box>
      </Box>
    );
  },
};

export const Typography_: Story = {
  name: 'Typography',
  render: () => {
    const variants = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'subtitle1', 'subtitle2', 'body1', 'body2', 'button', 'caption', 'overline'] as const;
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Type scale</Typography>
        <Stack spacing={1.5} divider={<Divider flexItem />}>
          {variants.map((v) => (
            <Box key={v} sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ width: 80, flexShrink: 0 }}>{v}</Typography>
              <Typography variant={v}>The quick brown fox</Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    );
  },
};

export const Spacing: Story = {
  render: () => {
    const t = useTheme();
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Spacing scale (theme.spacing)</Typography>
        <Stack spacing={1}>
          {[0.5, 1, 1.5, 2, 3, 4, 6, 8].map((n) => (
            <Box key={n} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ width: 64 }}>spacing({n})</Typography>
              <Box sx={{ height: 16, width: t.spacing(n), background: t.palette.primary.main, borderRadius: 0.5 }} />
              <Typography variant="caption" color="text.secondary">{t.spacing(n)}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    );
  },
};

export const Surfaces: Story = {
  render: () => {
    const t = useTheme();
    const elevated = (t.palette as { backgroundElevated?: string }).backgroundElevated ?? t.palette.background.paper;
    return (
      <Box sx={{ p: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, width: 220 }}>
          <Typography variant="subtitle2">Paper (default)</Typography>
          <Typography variant="caption" color="text.secondary">background.paper, no elevation gradient (#142)</Typography>
        </Paper>
        <Box sx={{ p: 2, width: 220, borderRadius: 1.5, background: elevated, border: `1px solid ${t.palette.divider}`, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <Typography variant="subtitle2">Polished backdrop</Typography>
          <Typography variant="caption" color="text.secondary">Elevated surface used by RichTooltip + TourButton paper</Typography>
        </Box>
      </Box>
    );
  },
};
