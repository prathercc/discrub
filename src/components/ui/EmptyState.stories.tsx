import type { Meta, StoryObj } from '@storybook/react';
import EmptyState from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    message: 'No messages found',
  },
};

export const WithIcon: Story = {
  args: {
    message: 'No servers available',
  },
};

export const CustomMessage: Story = {
  args: {
    message: 'Select a channel to view messages',
  },
};
