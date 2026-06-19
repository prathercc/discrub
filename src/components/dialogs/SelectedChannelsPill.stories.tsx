import type { Meta, StoryObj } from '@storybook/react';
import SelectedChannelsPill from './SelectedChannelsPill';
import { createMockChannel, createMockDmChannel } from '../../test/fixtures';

const meta: Meta<typeof SelectedChannelsPill> = {
  title: 'Search/SelectedChannelsPill',
  component: SelectedChannelsPill,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Summary pill shown at the top of the bulk dialogs (purge / export / edit) listing the selected channels or conversations, collapsing to "+N more" past a few.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof SelectedChannelsPill>;

export const FewChannels: Story = {
  args: {
    mode: 'channels',
    channels: [
      createMockChannel({ id: 'c1', name: 'general' }),
      createMockChannel({ id: 'c2', name: 'dev-chat' }),
    ],
  },
};

export const ManyChannels: Story = {
  args: {
    mode: 'channels',
    channels: Array.from({ length: 9 }, (_, i) => createMockChannel({ id: `c${i}`, name: `channel-${i + 1}` })),
  },
};

export const Conversations: Story = {
  args: {
    mode: 'dms',
    channels: [createMockDmChannel({ id: 'd1' }), createMockDmChannel({ id: 'd2' })],
  },
};
