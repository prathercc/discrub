import { useState } from 'react';
import { Box, useTheme } from '@mui/material';
import { toggleDevTools } from '@/utils/devTools';

/**
 * Easter-egg flask icon (#153). Looks like a UI decoration; double-
 * click toggles the dev-tools localStorage flag, which gates the
 * Seed-messages affordance. Single click does nothing — keeps the
 * gesture intentional.
 *
 * Lives in the sidebar footer at low opacity so it reads as accent,
 * not affordance. A subtle wiggle on toggle confirms the gesture
 * landed even without a toast.
 */
const DevToolsFlask = () => {
  const theme = useTheme();
  const [wiggleKey, setWiggleKey] = useState(0);

  const handleDoubleClick = () => {
    toggleDevTools();
    setWiggleKey((k) => k + 1);
  };

  return (
    <Box
      key={wiggleKey}
      onDoubleClick={handleDoubleClick}
      role="presentation"
      aria-hidden="true"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        opacity: 0.35,
        cursor: 'default',
        userSelect: 'none',
        transition: 'opacity 200ms ease',
        animation: 'devFlaskWiggle 480ms ease-out',
        '@keyframes devFlaskWiggle': {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '25%': { transform: 'rotate(-12deg) scale(1.15)' },
          '50%': { transform: 'rotate(10deg) scale(1.15)' },
          '75%': { transform: 'rotate(-6deg) scale(1.05)' },
          '100%': { transform: 'rotate(0deg) scale(1)' },
        },
        '&:hover': { opacity: 0.6 },
      }}
      data-testid="dev-tools-flask"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Flask outline */}
        <path
          d="M6 2h4v3.2l3 5.6c.5.95-.18 2.2-1.27 2.2H4.27c-1.1 0-1.78-1.25-1.27-2.2L6 5.2V2Z"
          stroke={theme.palette.text.secondary}
          strokeWidth="1"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Liquid */}
        <path
          d="M4 11h8l-1.5-2.8H5.5L4 11Z"
          fill={theme.palette.primary.main}
          opacity="0.7"
        />
        {/* Bubble */}
        <circle cx="9" cy="9" r="0.8" fill={theme.palette.background.paper} />
        {/* Top rim */}
        <line
          x1="6"
          y1="2"
          x2="10"
          y2="2"
          stroke={theme.palette.text.secondary}
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    </Box>
  );
};

export default DevToolsFlask;
