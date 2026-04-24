import { createTheme, type Theme } from '@mui/material/styles';
import { componentOverrides } from './overrides';

declare module '@mui/material/styles' {
  interface Theme {
    customShadows: {
      elevation1: string;
      elevation2: string;
      elevation3: string;
      elevation4: string;
      glow: string;
      glowHover: string;
    };
    customTransitions: {
      duration: {
        instant: number;
        fast: number;
        normal: number;
        slow: number;
        slowest: number;
      };
      easing: {
        spring: string;
        smooth: string;
        accelerate: string;
        decelerate: string;
      };
    };
  }
  interface ThemeOptions {
    customShadows?: {
      elevation1?: string;
      elevation2?: string;
      elevation3?: string;
      elevation4?: string;
      glow?: string;
      glowHover?: string;
    };
    customTransitions?: {
      duration?: {
        instant?: number;
        fast?: number;
        normal?: number;
        slow?: number;
        slowest?: number;
      };
      easing?: {
        spring?: string;
        smooth?: string;
        accelerate?: string;
        decelerate?: string;
      };
    };
  }
  interface Palette {
    primaryGradient: string;
    primaryGradientSubtle: string;
    backgroundElevated: string;
    backgroundGlass: string;
    backgroundGradientOverlay: string;
  }
  interface PaletteOptions {
    primaryGradient?: string;
    primaryGradientSubtle?: string;
    backgroundElevated?: string;
    backgroundGlass?: string;
    backgroundGradientOverlay?: string;
  }
  interface Shape {
    borderRadiusLarge: number;
    borderRadiusMedium: number;
    borderRadiusSmall: number;
  }
  interface ShapeOptions {
    borderRadiusLarge?: number;
    borderRadiusMedium?: number;
    borderRadiusSmall?: number;
  }
}

// Shared options across both themes
const sharedTypography = {
  fontFamily: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ].join(','),
  h5: {
    fontWeight: 700,
    lineHeight: 1.3,
  },
  h6: {
    fontWeight: 700,
    lineHeight: 1.3,
  },
  button: {
    textTransform: 'none' as const,
  },
};

const sharedTransitions = {
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 400,
    slowest: 600,
  },
  easing: {
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  },
};

function applyShapeExtensions(theme: Theme): void {
  (theme.shape as any).borderRadiusLarge = 16;
  (theme.shape as any).borderRadiusMedium = 12;
  (theme.shape as any).borderRadiusSmall = 6;
}

/**
 * Discord-themed dark Material-UI theme
 */
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7289da',
      light: '#99aab5',
      dark: '#5865f2',
    },
    secondary: {
      main: '#d2d5f7',
      light: '#ffffff',
      dark: '#99aab5',
    },
    background: {
      default: '#1e2124',
      paper: '#282b30',
    },
    text: {
      primary: '#ffffff',
      secondary: '#d2d5f7',
    },
    error: { main: '#f04747' },
    warning: { main: '#faa61a' },
    success: { main: '#43b581' },
    divider: 'rgba(255, 255, 255, 0.12)',
    primaryGradient: 'linear-gradient(135deg, #7289da 0%, #5865f2 100%)',
    primaryGradientSubtle: 'linear-gradient(135deg, rgba(114, 137, 218, 0.1) 0%, rgba(88, 101, 242, 0.15) 100%)',
    backgroundElevated: '#2e3338',
    backgroundGlass: 'rgba(40, 43, 48, 0.7)',
    backgroundGradientOverlay: 'linear-gradient(180deg, rgba(114, 137, 218, 0.05) 0%, transparent 100%)',
  },
  typography: sharedTypography,
  shape: { borderRadius: 8 } as any,
  customShadows: {
    elevation1: '0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.4)',
    elevation2: '0 4px 16px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.45)',
    elevation3: '0 8px 24px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.5)',
    elevation4: '0 16px 40px rgba(0, 0, 0, 0.45), 0 8px 20px rgba(0, 0, 0, 0.55)',
    glow: '0 0 20px rgba(114, 137, 218, 0.3), 0 0 40px rgba(114, 137, 218, 0.15)',
    glowHover: '0 0 30px rgba(114, 137, 218, 0.4), 0 0 60px rgba(114, 137, 218, 0.2)',
  },
  customTransitions: sharedTransitions,
  components: {
    ...componentOverrides,
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 600,
          textTransform: 'none',
          padding: '6px 16px',
          fontSize: '0.8125rem',
          transition: 'background-color 150ms ease, color 150ms ease, border-color 150ms ease',
          '&.Mui-focusVisible': {
            outline: '2px solid #7289da',
            outlineOffset: '2px',
          },
          '&.Mui-disabled': {
            opacity: 0.5,
          },
        },
        sizeSmall: {
          padding: '4px 12px',
          fontSize: '0.75rem',
        },
        contained: {
          backgroundColor: '#5865f2',
          color: '#fff',
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: '#4752c4',
            boxShadow: 'none',
          },
          '&:active': {
            backgroundColor: '#3c45a5',
          },
        },
        containedError: {
          backgroundColor: '#ed4245',
          color: '#fff',
          '&:hover': {
            backgroundColor: '#d83c3e',
          },
          '&:active': {
            backgroundColor: '#c43538',
          },
        },
        outlined: {
          borderColor: 'transparent',
          backgroundColor: 'rgba(114, 137, 218, 0.12)',
          color: '#7289da',
          '&:hover': {
            borderColor: 'transparent',
            backgroundColor: 'rgba(114, 137, 218, 0.2)',
          },
          '&:active': {
            backgroundColor: 'rgba(114, 137, 218, 0.25)',
          },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTooltip: {
      defaultProps: { enterDelay: 0 },
      styleOverrides: {
        tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(10px)', fontSize: '0.8125rem' },
      },
    },
  },
});
applyShapeExtensions(darkTheme);

/**
 * Discord-themed light Material-UI theme
 */
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#5865f2',
      light: '#7289da',
      dark: '#4752c4',
    },
    secondary: {
      main: '#4f5660',
      light: '#747f8d',
      dark: '#2e3338',
    },
    background: {
      default: '#ffffff',
      paper: '#f2f3f5',
    },
    text: {
      primary: '#2e3338',
      secondary: '#4f5660',
    },
    error: { main: '#d83c3e' },
    warning: { main: '#e67e22' },
    success: { main: '#2d8b5e' },
    divider: 'rgba(0, 0, 0, 0.08)',
    primaryGradient: 'linear-gradient(135deg, #5865f2 0%, #7289da 100%)',
    primaryGradientSubtle: 'linear-gradient(135deg, rgba(88, 101, 242, 0.06) 0%, rgba(114, 137, 218, 0.1) 100%)',
    backgroundElevated: '#e3e5e8',
    backgroundGlass: 'rgba(255, 255, 255, 0.7)',
    backgroundGradientOverlay: 'linear-gradient(180deg, rgba(88, 101, 242, 0.03) 0%, transparent 100%)',
  },
  typography: sharedTypography,
  shape: { borderRadius: 8 } as any,
  customShadows: {
    elevation1: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.1)',
    elevation2: '0 4px 16px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.12)',
    elevation3: '0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.15)',
    elevation4: '0 16px 40px rgba(0, 0, 0, 0.15), 0 8px 20px rgba(0, 0, 0, 0.18)',
    glow: '0 0 20px rgba(88, 101, 242, 0.15), 0 0 40px rgba(88, 101, 242, 0.08)',
    glowHover: '0 0 30px rgba(88, 101, 242, 0.2), 0 0 60px rgba(88, 101, 242, 0.1)',
  },
  customTransitions: sharedTransitions,
  components: {
    ...componentOverrides,
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 600,
          textTransform: 'none',
          padding: '6px 16px',
          fontSize: '0.8125rem',
          transition: 'background-color 150ms ease, color 150ms ease, border-color 150ms ease',
          '&.Mui-focusVisible': {
            outline: '2px solid #5865f2',
            outlineOffset: '2px',
          },
          '&.Mui-disabled': {
            opacity: 0.5,
          },
        },
        sizeSmall: {
          padding: '4px 12px',
          fontSize: '0.75rem',
        },
        contained: {
          backgroundColor: '#5865f2',
          color: '#fff',
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: '#4752c4',
            boxShadow: 'none',
          },
          '&:active': {
            backgroundColor: '#3c45a5',
          },
        },
        containedError: {
          backgroundColor: '#d83c3e',
          color: '#fff',
          '&:hover': {
            backgroundColor: '#c43538',
          },
          '&:active': {
            backgroundColor: '#b02e31',
          },
        },
        outlined: {
          borderColor: 'transparent',
          backgroundColor: 'rgba(88, 101, 242, 0.08)',
          color: '#5865f2',
          '&:hover': {
            borderColor: 'transparent',
            backgroundColor: 'rgba(88, 101, 242, 0.14)',
          },
          '&:active': {
            backgroundColor: 'rgba(88, 101, 242, 0.2)',
          },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTooltip: {
      defaultProps: { enterDelay: 0 },
      styleOverrides: {
        tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)', fontSize: '0.8125rem', color: '#fff' },
      },
    },
  },
});
applyShapeExtensions(lightTheme);

/**
 * Get theme by mode string
 */
export function getThemeByMode(mode: string): Theme {
  return mode === 'light' ? lightTheme : darkTheme;
}

// Default export for backward compatibility
export default darkTheme;
