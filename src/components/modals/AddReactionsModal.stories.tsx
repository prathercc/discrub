import type { Meta, StoryObj } from '@storybook/react';
import AddReactionsModal from './AddReactionsModal';
import { createMockMessage } from '../../test/fixtures';
import type { Emoji } from 'discrub-core/types/discord-types';

const meta: Meta<typeof AddReactionsModal> = {
  title: 'Modals/AddReactionsModal',
  component: AddReactionsModal,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '560px' } },
  },
};
export default meta;

type Story = StoryObj<typeof AddReactionsModal>;

const guildEmojis = [
  { id: '900000000000000001', name: 'pepe', animated: false },
  { id: '900000000000000002', name: 'kekw', animated: false },
] as unknown as Emoji[];

const messages = [
  createMockMessage({ id: 'm1', content: 'First selected message' }),
  createMockMessage({ id: 'm2', content: 'Second selected message' }),
  createMockMessage({ id: 'm3', content: 'Third selected message' }),
];

const baseArgs = {
  open: true,
  onClose: () => {},
  onConfirm: () => {},
};

export const SingleMessage: Story = {
  args: { ...baseArgs, selectedMessages: [messages[0]], guildEmojis },
};

export const MultipleMessages: Story = {
  args: { ...baseArgs, selectedMessages: messages, guildEmojis },
};

export const NoGuildEmojis: Story = {
  args: { ...baseArgs, selectedMessages: messages },
};
