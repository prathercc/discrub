import type { Meta, StoryObj } from '@storybook/react';
import BulkExportDialog from './BulkExportDialog';
import type { Channel } from 'discrub-core/types/discord-types';
import { ChannelType } from 'discrub-core/discord-enum';

const meta: Meta<typeof BulkExportDialog> = {
  title: 'Export/BulkExportDialog',
  component: BulkExportDialog,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof BulkExportDialog>;

const mockChannels: Channel[] = [
  { id: 'ch1', name: 'general', type: ChannelType.GUILD_TEXT } as Channel,
  { id: 'ch2', name: 'random', type: ChannelType.GUILD_TEXT } as Channel,
  { id: 'ch3', name: 'announcements', type: ChannelType.GUILD_ANNOUNCEMENT } as Channel,
  { id: 'ch4', name: 'dev-chat', type: ChannelType.GUILD_TEXT } as Channel,
];

const mockDms: Channel[] = [
  { id: 'dm1', name: null, type: 1, recipients: [{ id: 'u1', username: 'Alice', discriminator: '0001', avatar: null }] } as unknown as Channel,
  { id: 'dm2', name: null, type: 1, recipients: [{ id: 'u2', username: 'Bob', discriminator: '0002', avatar: null }] } as unknown as Channel,
];

export const ChannelExport: Story = {
  args: {
    open: true,
    channels: mockChannels,
    mode: 'channels',
    guildId: 'g1',
    onClose: () => {},
  },
};

export const DMExport: Story = {
  args: {
    open: true,
    channels: mockDms,
    mode: 'dms',
    onClose: () => {},
  },
};

export const SingleChannel: Story = {
  args: {
    open: true,
    channels: [mockChannels[0]],
    mode: 'channels',
    guildId: 'g1',
    onClose: () => {},
  },
};

export const Closed: Story = {
  args: {
    open: false,
    channels: mockChannels,
    mode: 'channels',
    guildId: 'g1',
    onClose: () => {},
  },
};
