import type { Meta, StoryObj } from '@storybook/react';
import AnalyticsModal from './AnalyticsModal';
import type { Message } from 'discrub-core/types/discord-types';

const createMessage = (content: string): Message =>
  ({ content } as Message);

const userMap = {
  '111': { userName: 'Alice', displayName: 'Alice Display', nick: undefined },
  '222': { userName: 'Bob', displayName: undefined, nick: 'Bobby' },
  '333': { userName: 'Charlie', displayName: 'Charlie D', nick: 'Chuck' },
};

const meta: Meta<typeof AnalyticsModal> = {
  title: 'Modals/AnalyticsModal',
  component: AnalyticsModal,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '500px' } },
  },
};
export default meta;

type Story = StoryObj<typeof AnalyticsModal>;

export const WithData: Story = {
  args: {
    open: true,
    onClose: () => {},
    messages: [
      createMessage('<@111> <@222> <@111>'),
      createMessage('<@333> <@111> <@222>'),
      createMessage('<@333> <@333> <@333>'),
    ],
    userMap,
  },
};

export const SingleMention: Story = {
  args: {
    open: true,
    onClose: () => {},
    messages: [createMessage('Hey <@111> what up')],
    userMap,
  },
};

export const Empty: Story = {
  args: {
    open: true,
    onClose: () => {},
    messages: [createMessage('Hello world, no mentions here')],
    userMap,
  },
};

export const ManyMentions: Story = {
  args: {
    open: true,
    onClose: () => {},
    messages: Array.from({ length: 50 }, (_, i) =>
      createMessage(`<@${(i % 3) + 111}>`)
    ),
    userMap,
  },
};

export const Closed: Story = {
  args: {
    open: false,
    onClose: () => {},
    messages: [createMessage('<@111>')],
    userMap,
  },
};
