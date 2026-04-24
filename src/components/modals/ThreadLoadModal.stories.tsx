import type { Meta, StoryObj } from '@storybook/react';
import ThreadLoadModal from './ThreadLoadModal';

const meta: Meta<typeof ThreadLoadModal> = {
  title: 'Modals/ThreadLoadModal',
  component: ThreadLoadModal,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof ThreadLoadModal>;

export const Default: Story = {
  args: {
    open: true,
    onClose: () => {},
    onLoad: () => {},
  },
};
