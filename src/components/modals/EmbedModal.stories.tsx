import type { Meta, StoryObj } from '@storybook/react';
import EmbedModal from './EmbedModal';
import type { HtmlFormattingContext } from 'discrub-core/types/html-formatting-types';

const meta: Meta<typeof EmbedModal> = {
  title: 'Modals/EmbedModal',
  component: EmbedModal,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '500px' } },
  },
};
export default meta;

type Story = StoryObj<typeof EmbedModal>;

const formattingContext: HtmlFormattingContext = {
  userMap: {
    '111222333': { userName: 'alice_dev', displayName: 'Alice' },
    '444555666': { userName: 'bob_gamer', displayName: 'Bob' },
  },
  channelMap: {
    '801000001': { name: 'general' },
    '801000002': { name: 'announcements' },
  },
  guildRoles: [
    { id: '901000001', name: 'Moderator' },
    { id: '901000002', name: 'Admin' },
  ],
};

const baseMessage = {
  id: 'msg-1',
  content: 'A message with embeds',
  author: { id: 'u1', username: 'testuser', discriminator: '0', avatar: null, global_name: null },
  timestamp: '2024-01-15T10:00:00Z',
  edited_timestamp: null,
  tts: false,
  mention_everyone: false,
  mentions: [],
  attachments: [],
  pinned: false,
  type: 0,
} as any;

export const BasicEmbed: Story = {
  args: {
    open: true,
    onClose: () => {},
    formattingContext,
    message: {
      ...baseMessage,
      embeds: [{
        title: 'Project Documentation',
        description: 'Welcome to the project docs.',
        url: 'https://docs.example.com',
        color: 5814783,
        author: { name: 'Documentation Bot' },
        footer: { text: 'Last updated today' },
      }],
    },
  },
};

export const MarkdownFormatting: Story = {
  args: {
    open: true,
    onClose: () => {},
    formattingContext,
    message: {
      ...baseMessage,
      embeds: [{
        title: 'Formatting Demo',
        description: '**Bold text** and *italic text* and ~~strikethrough~~\n__Underlined__ and `inline code`\n\n### Important Section\nThis is a [masked link](https://example.com) and a bare URL: https://github.com',
        color: 3447003,
      }],
    },
  },
};

export const WithMentions: Story = {
  args: {
    open: true,
    onClose: () => {},
    formattingContext,
    message: {
      ...baseMessage,
      embeds: [{
        title: 'Team Update',
        description: 'Great work by <@111222333> and <@444555666> this week!\nCheck <#801000001> for the full update.\n\nPing <@&901000001> for review. @everyone should read this.',
        color: 2067276,
        fields: [
          { name: 'Assigned', value: '<@111222333>' },
          { name: 'Channel', value: '<#801000002>' },
          { name: 'Role', value: '<@&901000002>' },
        ],
      }],
    },
  },
};

export const WithFields: Story = {
  args: {
    open: true,
    onClose: () => {},
    formattingContext,
    message: {
      ...baseMessage,
      embeds: [{
        title: 'Server Stats',
        description: 'Weekly server statistics report',
        color: 15844367,
        fields: [
          { name: 'Members', value: '**1,234** total\n*42* new this week' },
          { name: 'Messages', value: '**5,678** sent\n*123* in <#801000001>' },
          { name: 'Active Users', value: '<@111222333>, <@444555666>, and 40 others' },
        ],
        footer: { text: 'Stats Bot • Updated hourly' },
      }],
    },
  },
};

export const MultipleEmbeds: Story = {
  args: {
    open: true,
    onClose: () => {},
    formattingContext,
    message: {
      ...baseMessage,
      embeds: [
        {
          title: 'Embed One',
          description: '**First** embed with [a link](https://one.example.com)',
          color: 15548997,
        },
        {
          title: 'Embed Two',
          description: '*Second* embed with a mention: <@111222333>',
          color: 5763719,
          fields: [{ name: 'Note', value: 'This has a field' }],
        },
        {
          title: 'Embed Three',
          description: 'Third embed — no color, plain text.',
          footer: { text: 'End of embeds' },
        },
      ],
    },
  },
};

export const NoMessage: Story = {
  args: {
    open: true,
    message: null,
    onClose: () => {},
  },
};
