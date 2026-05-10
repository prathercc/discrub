import type { Meta, StoryObj } from '@storybook/react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import RichTooltip from './RichTooltip';

const meta: Meta<typeof RichTooltip> = {
  title: 'UI/RichTooltip',
  component: RichTooltip,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Tooltip variant with a primary-colored bold heading and a body block. ' +
          'Use when a tooltip needs more than a single short line. For plain ' +
          'one-line tooltips, prefer the bare MUI <Tooltip> — the theme override ' +
          'already applies the same dark/blur paper styling.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof RichTooltip>;

export const HeadingAndBody: Story = {
  render: () => (
    <Box sx={{ p: 6 }}>
      <RichTooltip
        heading="Filters: 2 active"
        body="Drafted refinements waiting to apply. Click to open the filter modal and review."
        open
        arrow
      >
        <Button variant="outlined">Filters</Button>
      </RichTooltip>
    </Box>
  ),
};

export const BodyOnly: Story = {
  render: () => (
    <Box sx={{ p: 6 }}>
      <RichTooltip
        body="Pause queues finish their current request before stopping. Resume picks up from where the previous run left off."
        open
        arrow
      >
        <Button variant="outlined">Pause</Button>
      </RichTooltip>
    </Box>
  ),
};

export const HoverableInline: Story = {
  render: () => (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 4 }}>
      <Typography>Search delay</Typography>
      <RichTooltip
        heading="Search delay"
        body="Time between consecutive Discord API calls during search and rehydration. Higher values reduce the chance of rate-limiting on large channels."
        arrow
      >
        <IconButton size="small">
          <InfoIcon fontSize="small" />
        </IconButton>
      </RichTooltip>
    </Stack>
  ),
};

export const LongBody: Story = {
  render: () => (
    <Box sx={{ p: 6 }}>
      <RichTooltip
        heading="Two-layer filter modal"
        body="Search hits Discord's API (author, content, date, has-types, mentions, pinned) and shows 'X of Y matches loaded' as results stream in. Refine narrows the already-loaded messages purely client-side, with no API calls. Use Refine to slice what you have, and Search when you need to find more."
        open
        arrow
      >
        <Button variant="outlined">Open filters</Button>
      </RichTooltip>
    </Box>
  ),
};
