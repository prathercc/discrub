import type { Meta, StoryObj } from '@storybook/react';
import { Box, Typography } from '@mui/material';
import TopBarBotSpot from './TopBarBotSpot';

/**
 * Exploration story for the TopBar compact bot carousel (owner picked the
 * mini-card + music-player layout 2026-08-31). Sits on a fake TopBar
 * strip; rotation is sped up to 5s here so the crossfade is visible.
 */
const meta: Meta<typeof TopBarBotSpot> = {
  title: 'Welcome/TopBarBotSpot',
  component: TopBarBotSpot,
};
export default meta;

type Story = StoryObj<typeof TopBarBotSpot>;

export const MiniCardPlayer: Story = {
  render: () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        Mini card, music-player controls, DISCORD BOT badge (ambient rotation 5s here, 30s for real)
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2,
          height: 64,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        <Box component="img" src="/discrub.png" alt="" sx={{ width: 36, height: 36 }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Discrub
        </Typography>
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
          <TopBarBotSpot rotateMs={5000} />
        </Box>
        <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'action.hover' }} />
      </Box>
    </Box>
  ),
};
