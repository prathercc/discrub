import type { Meta, StoryObj } from '@storybook/react';
import AnalyticsModal from './AnalyticsModal';
import type { Message } from 'discrub-core/types/discord-types';

const authors = {
  alice: { id: '111', username: 'alice', discriminator: '0', global_name: 'Alice', avatar: null },
  bob: { id: '222', username: 'bob', discriminator: '0', global_name: null, avatar: null },
  charlie: { id: '333', username: 'charlie', discriminator: '0', global_name: 'Charlie D', avatar: null },
  bot: { id: '999', username: 'statsbot', discriminator: '0', global_name: null, avatar: null, bot: true },
} as const;

let nextId = 1;
const createMessage = (content: string, extra: Partial<Message> = {}): Message =>
  ({
    id: String(nextId++),
    channel_id: 'chan',
    content,
    type: 0,
    timestamp: `2026-08-${String(10 + (nextId % 5)).padStart(2, '0')}T${String(8 + (nextId % 12)).padStart(2, '0')}:00:00.000Z`,
    author: authors.alice,
    attachments: [],
    embeds: [],
    ...extra,
  }) as Message;

const reacted = (content: string, counts: [string, number][], extra: Partial<Message> = {}) =>
  createMessage(content, { reactions: counts.map(([name, count]) => ({ count, emoji: { id: null, name } })) as Message['reactions'], ...extra });

const userMap = {
  '111': { userName: 'Alice', displayName: 'Alice Display', nick: undefined },
  '222': { userName: 'Bob', displayName: undefined, nick: 'Bobby' },
  '333': { userName: 'Charlie', displayName: 'Charlie D', nick: 'Chuck' },
};

/** A small channel's worth of traffic: mentions, reactions, links, files, a reply, a thread. */
const richMessages: Message[] = [
  createMessage('<@111> <@222> <@111> welcome!'),
  createMessage('<@333> <@111> <@222> thanks', { author: authors.bob }),
  reacted('Shipped the new export today 🎉', [['🔥', 12], ['🎉', 7], ['👀', 2]]),
  reacted('Anyone up for a game later?', [['👍', 3]], { author: authors.bob }),
  reacted('meh', [['👍', 1]], { author: authors.charlie }),
  createMessage('Check this out https://www.youtube.com/watch?v=abc and https://github.com/prathercc/discrub', { author: authors.charlie }),
  createMessage('https://github.com/prathercc/discrub/issues/13', { author: authors.bob }),
  createMessage("Here's the screenshot", { author: authors.bob, attachments: [{ id: 'a1', filename: 'shot.png', content_type: 'image/png' }, { id: 'a2', filename: 'clip.mp4', content_type: 'video/mp4' }] as Message['attachments'] }),
  createMessage('notes attached', { attachments: [{ id: 'a3', filename: 'notes.pdf', content_type: 'application/pdf' }] as Message['attachments'] }),
  createMessage('<@111> sure, on it', { type: 19, author: authors.charlie }),
  createMessage('Weekly stats posted', { author: authors.bot, attachments: [{ id: 'a4', filename: 'chart.png' }] as Message['attachments'] }),
  createMessage('login crashed again', { channel_id: 'thread-1', author: authors.bob }),
  createMessage('same crash here', { channel_id: 'thread-1', author: authors.charlie }),
  createMessage('refund question', { channel_id: 'thread-2' }),
];

const meta: Meta<typeof AnalyticsModal> = {
  title: 'Modals/AnalyticsModal',
  component: AnalyticsModal,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '600px' } },
  },
  args: {
    open: true,
    onClose: () => {},
    messages: richMessages,
    userMap,
    containerId: 'chan',
    threadNames: { 'thread-1': 'Login crash', 'thread-2': 'Refunds' },
  },
};
export default meta;

type Story = StoryObj<typeof AnalyticsModal>;

export const Mentions: Story = {};

export const Members: Story = { args: { initialReport: 'members' } };

export const Reactions: Story = { args: { initialReport: 'reactions' } };

export const BestOf: Story = { args: { initialReport: 'bestof' } };

export const Threads: Story = { args: { initialReport: 'threads' } };

export const Keywords: Story = { args: { initialReport: 'keywords' } };

export const Links: Story = { args: { initialReport: 'links' } };

export const Media: Story = { args: { initialReport: 'media' } };

export const Overview: Story = { args: { initialReport: 'overview' } };

export const Empty: Story = {
  args: {
    messages: [createMessage('Hello world, no mentions here')],
  },
};

export const ManyMentions: Story = {
  args: {
    messages: Array.from({ length: 25 }, (_, i) => createMessage(`<@${['111', '222', '333'][i % 3]}> ping ${i}`)),
  },
};
