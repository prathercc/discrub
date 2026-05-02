import type { Meta, StoryObj } from '@storybook/react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { BarChart as AnalyticsIcon } from '@mui/icons-material';
import DialogCloseIcon from './DialogCloseIcon';

const meta: Meta<typeof DialogCloseIcon> = {
  title: 'UI/DialogCloseIcon',
  component: DialogCloseIcon,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof DialogCloseIcon>;

export const SimpleHeader: Story = {
  render: () => (
    <Dialog open onClose={() => {}} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 5 }}>
        Settings
        <DialogCloseIcon onClose={() => {}} />
      </DialogTitle>
      <DialogContent>
        <Typography>Workflow dialog with simple title.</Typography>
      </DialogContent>
      <DialogActions>
        <Button>Cancel</Button>
        <Button variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  ),
};

export const FlexHeaderWithIcon: Story = {
  render: () => (
    <Dialog open onClose={() => {}} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 5 }}>
        <AnalyticsIcon color="primary" />
        Mention Analytics
        <Box sx={{ flex: 1 }} />
        <Chip label="Skip replies" size="small" />
        <DialogCloseIcon onClose={() => {}} />
      </DialogTitle>
      <DialogContent>
        <Typography>Info-only dialog with icon + chip in the header.</Typography>
      </DialogContent>
      <DialogActions>
        <Button>Cancel</Button>
      </DialogActions>
    </Dialog>
  ),
};

export const BannerHeader: Story = {
  render: () => (
    <Dialog open onClose={() => {}} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ p: 0, position: 'relative' }}>
        <Box
          sx={{
            width: '100%',
            height: 100,
            background: 'linear-gradient(135deg, #5865f2, #4752c4)',
            borderRadius: '8px 8px 0 0',
          }}
        />
        <DialogCloseIcon onClose={() => {}} />
      </DialogTitle>
      <DialogContent>
        <Typography>Banner-style header (e.g. UserProfileModal).</Typography>
      </DialogContent>
      <DialogActions>
        <Button>Cancel</Button>
      </DialogActions>
    </Dialog>
  ),
};

export const DisabledDuringOperation: Story = {
  render: () => (
    <Dialog open onClose={() => {}} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 5 }}>
        In-flight
        <DialogCloseIcon onClose={() => {}} disabled />
      </DialogTitle>
      <DialogContent>
        <Typography>Close icon disabled while a long operation runs.</Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled>Cancel</Button>
      </DialogActions>
    </Dialog>
  ),
};
