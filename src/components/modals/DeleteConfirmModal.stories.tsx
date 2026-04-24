import type { Meta, StoryObj } from '@storybook/react';
import DeleteConfirmModal from './DeleteConfirmModal';

const meta: Meta<typeof DeleteConfirmModal> = {
  title: 'Modals/DeleteConfirmModal',
  component: DeleteConfirmModal,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '400px' } },
  },
};
export default meta;

type Story = StoryObj<typeof DeleteConfirmModal>;

export const SingleMessage: Story = {
  args: {
    open: true,
    messageCount: 1,
    onConfirm: () => {},
    onClose: () => {},
  },
};

export const MultipleMessages: Story = {
  args: {
    open: true,
    messageCount: 15,
    onConfirm: () => {},
    onClose: () => {},
  },
};
