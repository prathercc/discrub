import type { Meta, StoryObj } from '@storybook/react';
import SettingsModal from './SettingsModal';

const meta: Meta<typeof SettingsModal> = {
  title: 'Settings/SettingsModal',
  component: SettingsModal,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '600px' } },
  },
};
export default meta;

type Story = StoryObj<typeof SettingsModal>;

export const Default: Story = {
  args: {
    open: true,
    onClose: () => {},
  },
};

export const Closed: Story = {
  args: {
    open: false,
    onClose: () => {},
  },
};
