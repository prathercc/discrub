import type { Meta, StoryObj } from '@storybook/react';
import { Box, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import TourCaption from './TourCaption';

const meta: Meta<typeof TourCaption> = {
  title: 'Welcome/TourCaption',
  component: TourCaption,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Form-helper-style caption with an inline "More info" link that opens ' +
          'the standard tour-catalog popover. Use under inputs that have no ' +
          'natural spot for an inline icon — Selects, TextFields, file pickers. ' +
          'Pass an optional `hint` for a brief plain-language summary; the ' +
          '"More info" link handles the longer explanation.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof TourCaption>;

export const UnderASelect: Story = {
  render: () => (
    <Box sx={{ p: 4, maxWidth: 360 }}>
      <Typography variant="body2" sx={{ mb: 0.5 }}>Export preset</Typography>
      <Select size="small" fullWidth defaultValue="discord-html">
        <MenuItem value="discord-html">Discord-style HTML</MenuItem>
        <MenuItem value="csv">CSV (spreadsheet)</MenuItem>
        <MenuItem value="json">JSON</MenuItem>
        <MenuItem value="media">Media-only</MenuItem>
      </Select>
      <TourCaption
        stepKey="export-presets"
        hint="Save and reuse common export setups."
      />
    </Box>
  ),
};

export const HintOnly: Story = {
  render: () => (
    <Box sx={{ p: 4, maxWidth: 360 }}>
      <TextField label="Search delay (ms)" size="small" fullWidth defaultValue="1000" />
      <TourCaption
        stepKey="operation-delays"
        hint="Higher values reduce the chance of rate-limiting on large channels."
      />
    </Box>
  ),
};

export const NoHint: Story = {
  render: () => (
    <Box sx={{ p: 4, maxWidth: 360 }}>
      <Typography variant="body2" sx={{ mb: 0.5 }}>Pinned messages</Typography>
      <Select size="small" fullWidth defaultValue="any">
        <MenuItem value="any">Any</MenuItem>
        <MenuItem value="pinned">Pinned only</MenuItem>
        <MenuItem value="not-pinned">Not pinned</MenuItem>
      </Select>
      <TourCaption stepKey="search-filters" />
    </Box>
  ),
};

export const StackedFields: Story = {
  render: () => (
    <Stack spacing={2} sx={{ p: 4, maxWidth: 360 }}>
      <Box>
        <TextField label="Page size" size="small" fullWidth defaultValue="500" />
        <TourCaption stepKey="export-presets" hint="Messages per HTML page." />
      </Box>
      <Box>
        <TextField label="Author search" size="small" fullWidth />
        <TourCaption stepKey="search-filters" hint="Filter by author ID or name." />
      </Box>
    </Stack>
  ),
};
