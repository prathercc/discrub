import type { Message, User } from 'discrub-core/types/discord-types';
import type { ExportUserMap } from 'discrub-core/types/discrub-types';
import type { ExportConfig } from '@features/export/exportTypes';
import { createMockAttachment, createMockEmbed, createMockReaction } from './fixtures';

/**
 * Export output validation test fixtures.
 *
 * 7 messages designed to exercise every export code path:
 * plain text, markdown, mentions, attachments, embeds, reactions,
 * empty content, CSV escaping, multiple authors, varied timestamps.
 */

// ── Authors ──────────────────────────────────────────────────────

export const AUTHOR_ALICE: User = {
  id: '100000000000000001',
  username: 'alice',
  discriminator: '0',
  avatar: 'alice_avatar_hash',
  global_name: 'Alice Display',
  public_flags: 4194304 | 512, // Active Developer + Early Supporter
  accent_color: 0x7289da,
  banner: null,
  bot: false,
} as unknown as User;

export const AUTHOR_BOB: User = {
  id: '100000000000000002',
  username: 'bob',
  discriminator: '0',
  avatar: null,
  global_name: 'Bob Display',
  public_flags: 64, // HypeSquad Bravery
  accent_color: 0xe91e63,
  banner: 'bob_banner_hash',
  bot: false,
} as unknown as User;

// ── Cached User Map ──────────────────────────────────────────────

export const EXPORT_GUILD_ID = 'guild-1';

export const EXPORT_USER_MAP: ExportUserMap = {
  '100000000000000001': {
    userName: 'alice',
    displayName: 'Alice Display',
    avatar: 'alice_avatar_hash',
    guilds: {
      [EXPORT_GUILD_ID]: {
        roles: [],
        nick: 'AliceNick',
        joinedAt: null,
        timestamp: Date.now(),
      },
    },
    timestamp: Date.now(),
  },
  '100000000000000002': {
    userName: 'bob',
    displayName: 'Bob Display',
    avatar: null,
    guilds: {},
    timestamp: Date.now(),
  },
};

// ── Messages ─────────────────────────────────────────────────────

export const EXPORT_MESSAGES: Message[] = [
  // 1: Plain text baseline
  {
    id: 'msg-1',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'Hello world',
    timestamp: '2026-06-15T10:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  } as unknown as Message,

  // 2: Markdown formatting
  {
    id: 'msg-2',
    channel_id: 'channel-123',
    author: AUTHOR_BOB,
    content: '**bold** and *italic*',
    timestamp: '2026-06-15T11:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  } as unknown as Message,

  // 3: User + channel mentions
  {
    id: 'msg-3',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'Check <@100000000000000002> and <#800000000000000099>',
    timestamp: '2026-06-15T12:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [
      { id: '100000000000000002', username: 'mentioneduser', global_name: 'Mentioned User', avatar: 'mention_avatar_hash', discriminator: '0' },
    ],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  } as unknown as Message,

  // 4: Attachment (image) + reaction
  {
    id: 'msg-4',
    channel_id: 'channel-123',
    author: AUTHOR_BOB,
    content: 'See attachment',
    timestamp: '2026-06-15T13:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [
      createMockAttachment({
        id: 'att-photo',
        filename: 'photo.png',
        size: 102400,
        url: 'https://cdn.discordapp.com/attachments/channel-123/att-photo/photo.png',
        content_type: 'image/png',
      }),
    ],
    embeds: [],
    reactions: [
      createMockReaction({ emoji: { id: null, name: '👍' }, count: 5 }),
    ],
    pinned: false,
    type: 0,
  } as unknown as Message,

  // 5: CSV escaping + embed
  {
    id: 'msg-5',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'Has "quotes" and commas, here',
    timestamp: '2026-06-15T14:30:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [
      createMockEmbed({
        title: 'Test Embed',
        description: 'This is a test embed description',
        url: 'https://example.com',
        fields: [{ name: 'Field 1', value: 'Value 1', inline: false }],
      }),
    ],
    reactions: [],
    pinned: false,
    type: 0,
  } as unknown as Message,

  // 6: Empty content + video attachment + multiple reactions
  {
    id: 'msg-6',
    channel_id: 'channel-123',
    author: AUTHOR_BOB,
    content: '',
    timestamp: '2026-06-15T15:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [
      createMockAttachment({
        id: 'att-video',
        filename: 'clip.mp4',
        size: 5242880,
        url: 'https://cdn.discordapp.com/attachments/channel-123/att-video/clip.mp4',
        content_type: 'video/mp4',
      }),
    ],
    embeds: [],
    reactions: [
      createMockReaction({ emoji: { id: null, name: '👍' }, count: 3 }),
      createMockReaction({ emoji: { id: null, name: '❤️' }, count: 2 }),
    ],
    pinned: false,
    type: 0,
  } as unknown as Message,

  // 7: Sort order boundary
  {
    id: 'msg-7',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'Final message',
    timestamp: '2026-06-15T16:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  } as unknown as Message,

  // 8: Thread starter (type 21) — empty content, text in referenced_message
  {
    id: 'msg-8',
    channel_id: 'channel-123',
    author: AUTHOR_BOB,
    content: '',
    timestamp: '2026-06-15T17:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 21,
    referenced_message: {
      id: 'msg-8-ref',
      channel_id: 'channel-123',
      author: AUTHOR_BOB,
      content: 'Thread starter original text',
      timestamp: '2026-06-15T17:00:00.000Z',
      edited_timestamp: null,
      tts: false,
      mention_everyone: false,
      mentions: [],
      attachments: [],
      embeds: [],
      reactions: [],
      pinned: false,
      type: 0,
    },
  } as unknown as Message,
];

// ── Thread Test Messages ─────────────────────────────────────────

export const THREAD_CHANNEL = {
  id: 'thread-001',
  name: 'bug-discussion',
  type: 11, // GUILD_PUBLIC_THREAD
} as import('discrub-core/types/discord-types').Channel;

/**
 * Messages that include thread data for testing separateThreads.
 * msg-t1 started the thread (has `thread` field), msg-t2 is a reply in the thread.
 * msg-t3 is a normal main channel message (no thread).
 */
export const THREAD_MESSAGES: Message[] = [
  // Main channel message that started the thread
  {
    id: 'msg-t1',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'I found a bug',
    timestamp: '2026-06-15T10:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
    thread: THREAD_CHANNEL,
  } as unknown as Message,

  // Message inside the thread
  {
    id: 'msg-t2',
    channel_id: 'thread-001',
    author: AUTHOR_BOB,
    content: 'Can you share more details?',
    timestamp: '2026-06-15T10:05:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  } as unknown as Message,

  // Normal main channel message (not in thread)
  {
    id: 'msg-t3',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'Unrelated message',
    timestamp: '2026-06-15T11:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  } as unknown as Message,
];

// ── Default Export Config (mirrors app defaults) ─────────────────

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  artistMode: false,
  sortOrder: 'descending',
  previewMedia: true,
  dateFormat: 'MM/dd/yyyy',
  timeFormat: 'h:mm aa',
};
