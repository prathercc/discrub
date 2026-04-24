import type { Meta, StoryObj } from '@storybook/react';
import AnnouncementModal from './AnnouncementModal';

const meta: Meta<typeof AnnouncementModal> = {
  title: 'Modals/AnnouncementModal',
  component: AnnouncementModal,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '400px' } },
  },
};
export default meta;

type Story = StoryObj<typeof AnnouncementModal>;

export const WithContent: Story = {
  args: {
    open: true,
    onDismiss: () => {},
    markdown: 'Welcome to Discrub v2.0!\n\nNew features include:\n- Bulk export for server channels and DMs\n- Mention analytics\n- Purge operations\n- And much more!',
  },
};

export const ShortMessage: Story = {
  args: {
    open: true,
    onDismiss: () => {},
    markdown: 'Minor bug fix release.',
  },
};

export const Closed: Story = {
  args: {
    open: false,
    onDismiss: () => {},
    markdown: 'This should not be visible.',
  },
};

export const NullMarkdown: Story = {
  args: {
    open: true,
    onDismiss: () => {},
    markdown: null,
  },
};
