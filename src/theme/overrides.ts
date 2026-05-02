import { Components, Theme } from '@mui/material/styles';

/**
 * Component style overrides for Discord-inspired appearance.
 * Uses theme-aware values so both dark and light modes work correctly.
 *
 * Design principles:
 * - Flat design: no gradients on interactive elements
 * - Color = function: blurple for action, red for danger, green for success
 * - Subtle interaction: background shift on hover, not glow/shadow/transform
 * - Performance: animate specific properties, never transition: all
 * - Consistent depth: background color steps, not shadow escalation
 */
export const componentOverrides: Components<Omit<Theme, 'components'>> = {
  MuiCssBaseline: {
    styleOverrides: (theme) => ({
      // Themed text selection
      '::selection': {
        backgroundColor: (theme as Theme).palette.primary.main,
        color: '#fff',
      },
      // Scrollbar styling
      body: {
        '&::-webkit-scrollbar': { width: '6px', height: '6px' },
        '&::-webkit-scrollbar-track': {
          backgroundColor: (theme as Theme).palette.background.paper,
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: (theme as Theme).palette.divider,
          borderRadius: '6px',
          transition: 'background-color 200ms ease',
          '&:hover': {
            backgroundColor: (theme as Theme).palette.primary.dark,
          },
        },
      },
      '*::-webkit-scrollbar': { width: '6px', height: '6px' },
      '*::-webkit-scrollbar-track': {
        backgroundColor: (theme as Theme).palette.background.paper,
      },
      '*::-webkit-scrollbar-thumb': {
        backgroundColor: (theme as Theme).palette.divider,
        borderRadius: '6px',
        transition: 'background-color 200ms ease',
        '&:hover': {
          backgroundColor: (theme as Theme).palette.primary.dark,
        },
      },
    }),
  },
  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }) => ({
        backgroundColor: theme.palette.background.paper,
        borderRight: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.background.paper,
        boxShadow: 'none',
        borderBottom: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: '8px',
        margin: '4px 8px',
        transition: 'background-color 200ms ease',
        '&.Mui-selected': {
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(114, 137, 218, 0.15)'
            : 'rgba(88, 101, 242, 0.08)',
          borderLeft: `3px solid ${theme.palette.primary.main}`,
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(114, 137, 218, 0.22)'
              : 'rgba(88, 101, 242, 0.14)',
          },
        },
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
      }),
    },
  },
  MuiTextField: {
    defaultProps: { size: 'small' },
    styleOverrides: {
      root: ({ theme }) => ({
        '& .MuiOutlinedInput-root': {
          borderRadius: '4px',
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.02)'
            : 'rgba(0, 0, 0, 0.02)',
          transition: 'background-color 200ms ease, box-shadow 200ms ease',
          '& textarea, & input': {
            outline: 'none !important',
            border: 'none !important',
            boxShadow: 'none !important',
            WebkitAppearance: 'none',
          },
          '& fieldset': {
            borderColor: theme.palette.divider,
            borderWidth: '1px',
            transition: 'border-color 200ms ease',
          },
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.04)'
              : 'rgba(0, 0, 0, 0.04)',
            '& fieldset': {
              borderColor: `${theme.palette.primary.main}80`,
            },
          },
          '&.Mui-focused': {
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(114, 137, 218, 0.05)'
              : 'rgba(88, 101, 242, 0.04)',
            boxShadow: theme.palette.mode === 'dark'
              ? '0 0 0 2px rgba(114, 137, 218, 0.15)'
              : '0 0 0 2px rgba(88, 101, 242, 0.1)',
            '& fieldset': {
              borderColor: theme.palette.primary.main,
              borderWidth: '1px',
            },
          },
        },
      }),
    },
  },
  MuiSelect: {
    defaultProps: { size: 'small' },
  },
  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(54, 57, 63, 0.95)'
          : 'rgba(255, 255, 255, 0.98)',
        borderRadius: '8px',
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.palette.mode === 'dark'
          ? '0 16px 40px rgba(0, 0, 0, 0.5)'
          : '0 16px 40px rgba(0, 0, 0, 0.15)',
      }),
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: ({ theme }) => ({
        fontSize: '1.25rem',
        fontWeight: 700,
        color: theme.palette.text.primary,
        padding: '12px 24px',
        borderBottom: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiDialogContent: {
    styleOverrides: {
      root: { padding: '16px 24px !important' },
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: '12px 20px',
        gap: '8px',
        borderTop: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiAlert: {
    defaultProps: { variant: 'outlined' },
    styleOverrides: {
      root: { padding: '6px 12px', fontSize: '0.8125rem' },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { height: 28, fontSize: '0.8125rem' },
      sizeSmall: { height: 24, fontSize: '0.75rem' },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        minHeight: 36,
        paddingTop: 4,
        paddingBottom: 4,
        fontSize: '0.875rem',
      },
    },
  },
  MuiTabs: {
    styleOverrides: {
      root: { minHeight: 36 },
      indicator: ({ theme }) => ({
        backgroundColor: theme.palette.primary.main,
        height: 2,
      }),
    },
  },
  MuiCheckbox: {
    styleOverrides: { root: { padding: '4px' } },
  },
  MuiRadio: {
    styleOverrides: { root: { padding: '4px' } },
  },
  MuiFormControlLabel: {
    styleOverrides: { root: { marginLeft: '-6px' } },
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: '6px',
        transition: 'background-color 150ms ease',
        '&:hover': {
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.06)',
        },
        '&.Mui-focusVisible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: '2px',
        },
      }),
    },
  },
  MuiSlider: {
    styleOverrides: { thumb: { width: 14, height: 14 } },
  },
  MuiAccordionSummary: {
    styleOverrides: { root: { minHeight: 40, padding: '4px 16px' } },
  },
  MuiAccordionDetails: {
    styleOverrides: { root: { padding: '8px 16px' } },
  },
  MuiInputLabel: {
    styleOverrides: {
      shrink: { transform: 'translate(14px, -6px) scale(0.75)' },
    },
  },
  MuiTableHead: {
    styleOverrides: {
      root: ({ theme }) => ({
        '& .MuiTableCell-head': {
          fontWeight: 600,
          color: theme.palette.text.primary,
          backgroundColor: (theme.palette as any).backgroundElevated,
        },
      }),
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: ({ theme }) => ({
        '&.MuiTableRow-hover:hover': {
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(114, 137, 218, 0.04)'
            : 'rgba(88, 101, 242, 0.03)',
        },
      }),
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderBottom: `1px solid ${theme.palette.divider}`,
      }),
    },
  },
  MuiToggleButtonGroup: {
    styleOverrides: {
      root: ({ theme }) => ({
        '& .MuiToggleButton-root': {
          color: theme.palette.text.secondary,
          borderColor: theme.palette.divider,
          textTransform: 'none',
          fontSize: '0.875rem',
          transition: 'background-color 150ms ease, color 150ms ease',
          '&.Mui-selected': {
            color: '#fff',
            backgroundColor: theme.palette.primary.main,
            '&:hover': {
              backgroundColor: theme.palette.primary.dark,
            },
          },
        },
      }),
    },
  },
  MuiTooltip: {
    defaultProps: {
      arrow: true,
      enterDelay: 300,
      leaveDelay: 0,
    },
    styleOverrides: {
      tooltip: ({ theme }) => ({
        backgroundColor:
          theme.palette.mode === 'dark'
            ? 'rgba(40, 43, 48, 0.98)'
            : 'rgba(255, 255, 255, 0.98)',
        color: theme.palette.text.primary,
        border: `1px solid ${theme.palette.divider}`,
        backdropFilter: 'blur(8px)',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: '0.75rem',
        lineHeight: 1.45,
        fontWeight: 400,
        maxWidth: 320,
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 6px 20px rgba(0, 0, 0, 0.4)'
            : '0 6px 20px rgba(0, 0, 0, 0.12)',
      }),
      arrow: ({ theme }) => ({
        color:
          theme.palette.mode === 'dark'
            ? 'rgba(40, 43, 48, 0.98)'
            : 'rgba(255, 255, 255, 0.98)',
        '&::before': {
          border: `1px solid ${theme.palette.divider}`,
        },
      }),
    },
  },
  MuiSkeleton: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.06)'
          : 'rgba(0, 0, 0, 0.06)',
        '&::after': {
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.04), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.03), transparent)',
        },
      }),
    },
  },
};

export default componentOverrides;
