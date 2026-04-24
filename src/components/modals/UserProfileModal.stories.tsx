import type { Meta, StoryObj } from '@storybook/react';
import UserProfileModal from './UserProfileModal';

const meta: Meta<typeof UserProfileModal> = {
  title: 'Modals/UserProfileModal',
  component: UserProfileModal,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '600px' } },
  },
};
export default meta;

type Story = StoryObj<typeof UserProfileModal>;

const baseUser = {
  id: '123456789012345678',
  username: 'discorduser',
  discriminator: '1234',
  avatar: null,
  bot: false,
  system: false,
  mfa_enabled: true,
  premium_type: 2,
  public_flags: 0,
  global_name: 'Discord User',
} as any;

export const RegularUser: Story = {
  args: {
    open: true,
    user: baseUser,
    onClose: () => {},
    cachedUserMap: {},
    guildId: null,
  },
};

export const BotUser: Story = {
  args: {
    open: true,
    user: { ...baseUser, bot: true, username: 'ModBot', global_name: null },
    onClose: () => {},
    cachedUserMap: {},
    guildId: null,
  },
};

export const WithBadges: Story = {
  args: {
    open: true,
    user: { ...baseUser, public_flags: 1 | 8 | (1 << 22) }, // Staff + Bug Hunter + Active Dev
    onClose: () => {},
    cachedUserMap: {},
    guildId: null,
  },
};

export const WithGuildNickname: Story = {
  args: {
    open: true,
    user: baseUser,
    onClose: () => {},
    cachedUserMap: {
      [baseUser.id]: {
        userName: 'discorduser',
        displayName: 'Discord User',
        avatar: null,
        timestamp: Date.now(),
        guilds: { 'guild-1': { roles: [], nick: 'Server Nick', joinedAt: null, timestamp: Date.now() } },
      },
    },
    guildId: 'guild-1',
  },
};

export const NitroClassic: Story = {
  args: {
    open: true,
    user: { ...baseUser, premium_type: 1 },
    onClose: () => {},
    cachedUserMap: {},
    guildId: null,
  },
};
