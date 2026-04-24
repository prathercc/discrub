import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, waitFor } from '@storybook/test';
import ReactionModal from './ReactionModal';

const meta: Meta<typeof ReactionModal> = {
  title: 'Modals/ReactionModal',
  component: ReactionModal,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '500px' } },
  },
};
export default meta;

type Story = StoryObj<typeof ReactionModal>;

const mockMessage = {
  id: 'msg-1',
  content: 'A message with reactions',
  author: { id: 'u1', username: 'testuser', discriminator: '0001', avatar: null },
  timestamp: '2024-01-15T10:00:00Z',
  reactions: [
    {
      emoji: { id: null, name: '👍' },
      count: 5,
      me: true,
    },
    {
      emoji: { id: 'emoji123', name: 'custom_emoji', animated: false },
      count: 3,
      me: false,
    },
  ],
} as any;

const mockReactingUsers = [
  { id: 'u1', username: 'alice', global_name: 'Alice', discriminator: '0001', avatar: null },
  { id: 'u2', username: 'bob', global_name: 'Bob', discriminator: '0002', avatar: null },
  { id: 'u3', username: 'charlie', global_name: 'Charlie', discriminator: '0003', avatar: null },
] as any;

export const ViewOnly: Story = {
  args: {
    open: true,
    message: mockMessage,
    onClose: () => {},
    onFetchReactingUsers: async () => mockReactingUsers,
  },
};

export const Interactive: Story = {
  args: {
    open: true,
    message: mockMessage,
    onClose: () => {},
    onDeleteReaction: async () => {},
    onFetchReactingUsers: async () => mockReactingUsers,
  },
};

export const WithCustomEmoji: Story = {
  args: {
    open: true,
    message: {
      ...mockMessage,
      reactions: [
        { emoji: { id: '12345', name: 'pepe', animated: false }, count: 8, me: false },
        { emoji: { id: '67890', name: 'animated_emoji', animated: true }, count: 2, me: false },
        { emoji: { id: null, name: '🎉' }, count: 4, me: true },
      ],
    },
    onClose: () => {},
    onFetchReactingUsers: async () => mockReactingUsers,
  },
};

export const NoMessage: Story = {
  args: {
    open: true,
    message: null,
    onClose: () => {},
  },
};

export const WithSelectedTab: Story = {
  args: {
    open: true,
    message: mockMessage,
    onClose: () => {},
    onDeleteReaction: async () => {},
    onFetchReactingUsers: async () => mockReactingUsers,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Wait for the first tab to auto-select and users to load
    await waitFor(() => canvas.getByText('Alice'));
    // Click the second tab
    const secondTab = canvas.getByText('3').closest('[class*="ListItemButton"]');
    if (secondTab) {
      await userEvent.click(secondTab);
    }
  },
};

export const Deleting: Story = {
  args: {
    open: true,
    message: mockMessage,
    onClose: () => {},
    onDeleteReaction: () => new Promise(() => {}),
    onFetchReactingUsers: async () => mockReactingUsers,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Wait for auto-select to load users
    await waitFor(() => canvas.getByText('Alice'));
    // Click "Remove All" to trigger the never-resolving delete
    await userEvent.click(canvas.getByText('Remove All'));
  },
};

export const AdminBulkActions: Story = {
  args: {
    open: true,
    message: mockMessage,
    onClose: () => {},
    onDeleteReaction: async () => {},
    onFetchReactingUsers: async () => mockReactingUsers,
    canManageMessages: true,
    onBulkDeleteAllReactions: async () => {},
    onBulkDeleteReactionsForEmoji: async () => {},
  },
};

export const AdminBulkDeleting: Story = {
  args: {
    open: true,
    message: mockMessage,
    onClose: () => {},
    onDeleteReaction: async () => {},
    onFetchReactingUsers: async () => mockReactingUsers,
    canManageMessages: true,
    onBulkDeleteAllReactions: () => new Promise(() => {}),
    onBulkDeleteReactionsForEmoji: () => new Promise(() => {}),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => canvas.getByText('Alice'));
    // Click the title-area Remove All (admin bulk)
    const removeAllButtons = canvas.getAllByText('Remove All');
    await userEvent.click(removeAllButtons[0]);
  },
};

export const NonAdminInteractive: Story = {
  args: {
    open: true,
    message: mockMessage,
    onClose: () => {},
    onDeleteReaction: async () => {},
    onFetchReactingUsers: async () => mockReactingUsers,
    canManageMessages: false,
  },
};

export const ManyReactions: Story = {
  args: {
    open: true,
    message: {
      ...mockMessage,
      reactions: [
        { emoji: { id: null, name: '👍' }, count: 12, me: true },
        { emoji: { id: null, name: '👎' }, count: 3, me: false },
        { emoji: { id: null, name: '❤️' }, count: 8, me: true },
        { emoji: { id: null, name: '🎉' }, count: 5, me: false },
        { emoji: { id: null, name: '🔥' }, count: 15, me: true },
        { emoji: { id: null, name: '😂' }, count: 7, me: false },
        { emoji: { id: null, name: '😢' }, count: 2, me: false },
        { emoji: { id: null, name: '🤔' }, count: 4, me: true },
        { emoji: { id: 'c1', name: 'pepehands', animated: false }, count: 6, me: false },
        { emoji: { id: 'c2', name: 'pogchamp', animated: true }, count: 9, me: true },
      ],
    },
    onClose: () => {},
    onFetchReactingUsers: async () => mockReactingUsers,
  },
};
