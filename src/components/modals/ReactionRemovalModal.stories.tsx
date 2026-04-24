import type { Meta, StoryObj } from '@storybook/react';
import ReactionRemovalModal from './ReactionRemovalModal';
import { createMockMessage, createMockReaction } from '../../test/fixtures';
import type { User } from 'discrub-core/types/discord-types';

const meta: Meta<typeof ReactionRemovalModal> = {
  title: 'Modals/ReactionRemovalModal',
  component: ReactionRemovalModal,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '500px' } },
  },
};
export default meta;

type Story = StoryObj<typeof ReactionRemovalModal>;

const messagesWithReactions = [
  createMockMessage({
    id: 'msg-1',
    content: 'First message with reactions',
    reactions: [
      createMockReaction({ emoji: { id: null, name: '👍' }, count: 5 }),
      createMockReaction({ emoji: { id: null, name: '❤️' }, count: 3 }),
    ],
  }),
  createMockMessage({
    id: 'msg-2',
    content: 'Second message with reactions',
    reactions: [
      createMockReaction({ emoji: { id: null, name: '👍' }, count: 2 }),
      createMockReaction({ emoji: { id: 'emoji-1', name: 'custom_fire', animated: false }, count: 8 }),
      createMockReaction({ emoji: { id: null, name: '🔥' }, count: 4 }),
    ],
  }),
  createMockMessage({ id: 'msg-3', content: 'No reactions', reactions: [] }),
];

const mockReactors: User[] = [
  { id: 'user-1', username: 'alice', global_name: 'Alice' },
  { id: 'user-2', username: 'bob', global_name: 'Bob' },
  { id: 'user-3', username: 'charlie', global_name: 'Charlie' },
  { id: 'user-4', username: 'dave', global_name: 'Dave' },
] as unknown as User[];

export const AdminAllUsers: Story = {
  args: {
    open: true,
    onClose: () => {},
    selectedMessages: messagesWithReactions,
    canManageMessages: true,
    currentUserId: 'user-123',
    currentUsername: 'AdminUser',
    onConfirm: () => {},
    onFetchReactingUsers: async () => mockReactors,
  },
};

export const RegularUser: Story = {
  args: {
    open: true,
    onClose: () => {},
    selectedMessages: messagesWithReactions,
    canManageMessages: false,
    currentUserId: 'user-123',
    currentUsername: 'RegularUser',
    onConfirm: () => {},
    onFetchReactingUsers: async () => mockReactors,
  },
};

export const LoadingReactors: Story = {
  args: {
    open: true,
    onClose: () => {},
    selectedMessages: messagesWithReactions,
    canManageMessages: true,
    currentUserId: 'user-123',
    currentUsername: 'AdminUser',
    onConfirm: () => {},
    onFetchReactingUsers: () => new Promise(() => {}), // Never resolves — shows spinner
  },
};

export const NoReactionsSelected: Story = {
  args: {
    open: true,
    onClose: () => {},
    selectedMessages: [messagesWithReactions[2]],
    canManageMessages: true,
    currentUserId: 'user-123',
    currentUsername: 'AdminUser',
    onConfirm: () => {},
  },
};

export const SingleMessage: Story = {
  args: {
    open: true,
    onClose: () => {},
    selectedMessages: [messagesWithReactions[0]],
    canManageMessages: true,
    currentUserId: 'user-123',
    currentUsername: 'AdminUser',
    onConfirm: () => {},
    onFetchReactingUsers: async () => mockReactors,
  },
};
