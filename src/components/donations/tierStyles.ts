import type { SxProps, Theme } from '@mui/material';
import type { TierInfo } from './donationTypes';

// Corner tick marks for mid-tier cards
const cornerTicks = (color: string, size: number, thickness: number): Record<string, unknown> => ({
  '&::before, &::after': {
    content: '""',
    position: 'absolute',
    width: size,
    height: size,
    pointerEvents: 'none',
  },
  '&::before': {
    top: -1,
    left: -1,
    borderTop: `${thickness}px solid ${color}`,
    borderLeft: `${thickness}px solid ${color}`,
    borderRadius: '4px 0 0 0',
  },
  '&::after': {
    bottom: -1,
    right: -1,
    borderBottom: `${thickness}px solid ${color}`,
    borderRight: `${thickness}px solid ${color}`,
    borderRadius: '0 0 4px 0',
  },
});

export function getTierSx(tier: TierInfo['tier'], isDark = true): SxProps<Theme> {
  switch (tier) {
    // Bit — barely there
    case 1:
      return {
        border: '1px solid rgba(205, 127, 50, 0.15)',
        backgroundColor: isDark ? 'rgba(205, 127, 50, 0.03)' : 'rgba(205, 127, 50, 0.04)',
      };
    // Byte — slight hint
    case 2:
      return {
        border: '1px solid rgba(192, 192, 192, 0.25)',
        backgroundColor: isDark ? 'rgba(192, 192, 192, 0.05)' : 'rgba(192, 192, 192, 0.06)',
      };
    // Kilobyte — noticeable warm tint
    case 3:
      return {
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 215, 0, 0.35)',
        backgroundColor: isDark ? 'rgba(255, 215, 0, 0.08)' : 'rgba(255, 215, 0, 0.07)',
        boxShadow: '0 1px 8px rgba(255, 215, 0, 0.1)',
        ...cornerTicks('rgba(255, 215, 0, 0.45)', 8, 2),
      };
    // Megabyte — clear silver-white presence
    case 4:
      return {
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(229, 228, 226, 0.45)',
        backgroundColor: isDark ? 'rgba(229, 228, 226, 0.1)' : 'rgba(229, 228, 226, 0.1)',
        boxShadow: '0 2px 10px rgba(229, 228, 226, 0.12)',
        ...cornerTicks('rgba(229, 228, 226, 0.55)', 10, 2),
      };
    // Gigabyte — unmistakable cyan glow
    case 5:
      return {
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(0, 212, 255, 0.4)',
        backgroundColor: isDark ? 'rgba(0, 212, 255, 0.08)' : 'rgba(185, 242, 255, 0.1)',
        boxShadow: '0 2px 14px rgba(0, 212, 255, 0.15)',
        ...cornerTicks('rgba(185, 242, 255, 0.55)', 12, 2),
      };
  }
}
