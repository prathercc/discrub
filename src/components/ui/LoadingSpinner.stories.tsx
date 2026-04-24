import type { Meta, StoryObj } from '@storybook/react';
import LoadingSpinner from './LoadingSpinner';

const meta: Meta<typeof LoadingSpinner> = {
  title: 'UI/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof LoadingSpinner>;

export const Default: Story = {};

export const WithMessage: Story = {
  args: {
    message: 'Loading messages...',
  },
};

export const Small: Story = {
  args: {
    size: 24,
    message: 'Loading...',
  },
};
