/**
 * Extended fixtures for HTML export Storybook stories and tests.
 *
 * Builds on export-fixtures.ts, adding message types needed for
 * the HTML export redesign: replies, edits, spoilers, code blocks,
 * message grouping, and reaction user data.
 */

import type { Message } from 'discrub-core/types/discord-types';
import {
  AUTHOR_ALICE,
  AUTHOR_BOB,
  EXPORT_USER_MAP,
  EXPORT_GUILD_ID,
  EXPORT_MESSAGES,
  THREAD_MESSAGES,
  THREAD_CHANNEL,
  DEFAULT_EXPORT_CONFIG,
} from './export-fixtures';
import { createMockAttachment, createMockEmbed, createMockReaction } from './fixtures';

// Re-export base fixtures for convenience
export {
  AUTHOR_ALICE,
  AUTHOR_BOB,
  EXPORT_USER_MAP,
  EXPORT_GUILD_ID,
  EXPORT_MESSAGES,
  THREAD_MESSAGES,
  THREAD_CHANNEL,
  DEFAULT_EXPORT_CONFIG,
};

// ── Avatar SVG Generator ─────────────────────────────────────────
// Creates Discord-style colored circle avatars with initials for Storybook

function avatarSvg(bgColor: string, initials: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">` +
    `<rect width="128" height="128" rx="64" fill="${bgColor}"/>` +
    `<text x="64" y="64" text-anchor="middle" dy=".36em" fill="#fff" font-family="sans-serif" font-weight="600" font-size="56">${initials}</text>` +
    `</svg>`
  )}`;
}

// Pre-built avatar data URIs for each author
const AVATARS = {
  alice: avatarSvg('#5865f2', 'A'),    // Blurple
  bob: avatarSvg('#eb459e', 'B'),      // Fuchsia
  charlie: avatarSvg('#57f287', 'C'),  // Green
  dave: avatarSvg('#fee75c', 'D'),     // Yellow
  eve: avatarSvg('#ed4245', 'E'),      // Red
  bot: avatarSvg('#5865f2', '⚙'),     // Blurple (bot)
};

// ── Additional Authors ───────────────────────────────────────────

export const AUTHOR_CHARLIE = {
  id: '100000000000000003',
  username: 'charlie',
  discriminator: '0',
  avatar: 'charlie_avatar_hash',
  global_name: 'Charlie',
  public_flags: 262144 | 8, // Moderator Programs Alumni + Bug Hunter Level 1
  accent_color: 0x57f287,
  banner: null,
  bot: false,
} as unknown as import('discrub-core/types/discord-types').User;

export const AUTHOR_DAVE = {
  id: '100000000000000004',
  username: 'dave_dev',
  discriminator: '0',
  avatar: 'dave_avatar_hash',
  global_name: 'Dave',
  public_flags: 4194304, // Active Developer
  accent_color: 0xfee75c,
  banner: null,
  bot: false,
} as unknown as import('discrub-core/types/discord-types').User;

export const AUTHOR_EVE = {
  id: '100000000000000005',
  username: 'eve_nitro',
  discriminator: '0',
  avatar: 'eve_avatar_hash',
  global_name: 'Eve',
  public_flags: 64 | 512, // HypeSquad Bravery + Early Supporter
  accent_color: 0xed4245,
  banner: 'eve_banner_hash',
  bot: false,
  premium_type: 2, // Nitro
} as unknown as import('discrub-core/types/discord-types').User;

export const AUTHOR_BOT = {
  id: '100000000000000006',
  username: 'ModBot',
  discriminator: '0',
  avatar: 'bot_avatar_hash',
  global_name: null,
  public_flags: 0,
  accent_color: null,
  banner: null,
  bot: true,
} as unknown as import('discrub-core/types/discord-types').User;

// ── Storybook Media Maps ────────────────────────────────────────
// Maps author avatar hashes to SVG data URIs so avatars render in Storybook

import type { MediaMaps } from '@features/export/exportTypes';

export const STORYBOOK_MEDIA_MAPS: MediaMaps = {
  avatarMap: {
    [`${AUTHOR_ALICE.id}/alice_avatar_hash`]: AVATARS.alice,
    [`${AUTHOR_BOB.id}/bob_avatar_hash`]: AVATARS.bob,  // Bob has avatar:null in base, but we override in Storybook usage
    [`${AUTHOR_CHARLIE.id}/charlie_avatar_hash`]: AVATARS.charlie,
    [`${AUTHOR_DAVE.id}/dave_avatar_hash`]: AVATARS.dave,
    [`${AUTHOR_EVE.id}/eve_avatar_hash`]: AVATARS.eve,
    [`${AUTHOR_BOT.id}/bot_avatar_hash`]: AVATARS.bot,
  },
  mediaMap: {},
  emojiMap: {},
  roleMap: {},
};

// ── Guild Roles (for Storybook role color rendering) ─────────────

export const STORYBOOK_GUILD_ID = 'storybook-guild-1';

export const STORYBOOK_GUILD_ROLES = [
  { id: 'role-everyone', name: '@everyone', color: 0, position: 0, hoist: false, permissions: '0', managed: false, mentionable: false, flags: 0 },
  { id: 'role-member', name: 'Member', color: 0, position: 1, hoist: false, permissions: '0', managed: false, mentionable: false, flags: 0 },
  { id: 'role-artist', name: 'Artist', color: 0x9b59b6, position: 3, hoist: true, permissions: '0', managed: false, mentionable: false, flags: 0, unicode_emoji: '🎨' },
  { id: 'role-moderator', name: 'Moderator', color: 0x2ecc71, position: 5, hoist: true, permissions: '0', managed: false, mentionable: false, flags: 0, unicode_emoji: '🛡️' },
  { id: 'role-developer', name: 'Developer', color: 0x3498db, position: 4, hoist: true, permissions: '0', managed: false, mentionable: false, flags: 0 },
  { id: 'role-booster', name: 'Server Booster', color: 0xf47fff, position: 2, hoist: false, permissions: '0', managed: true, mentionable: false, flags: 0 },
  { id: 'role-admin', name: 'Admin', color: 0xe91e63, position: 10, hoist: true, permissions: '0', managed: false, mentionable: false, flags: 0, unicode_emoji: '👑' },
  { id: 'role-bot', name: 'Bot', color: 0x5865f2, position: 6, hoist: true, permissions: '0', managed: true, mentionable: false, flags: 0 },
];

// ── Reply Chain Messages ─────────────────────────────────────────

export const REPLY_MESSAGES: Message[] = [
  // Original message
  {
    id: 'msg-reply-1',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'Has anyone tried the new build?',
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

  // Reply to original
  {
    id: 'msg-reply-2',
    channel_id: 'channel-123',
    author: AUTHOR_BOB,
    content: 'Yes, it works great!',
    timestamp: '2026-06-15T10:02:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 19, // REPLY
    message_reference: { message_id: 'msg-reply-1', channel_id: 'channel-123' },
    referenced_message: {
      id: 'msg-reply-1',
      channel_id: 'channel-123',
      author: AUTHOR_ALICE,
      content: 'Has anyone tried the new build?',
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
    },
  } as unknown as Message,

  // Reply with deleted referenced message
  {
    id: 'msg-reply-3',
    channel_id: 'channel-123',
    author: AUTHOR_CHARLIE,
    content: 'I agree with what was said above',
    timestamp: '2026-06-15T10:05:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 19,
    message_reference: { message_id: 'msg-deleted-999', channel_id: 'channel-123' },
    referenced_message: null,
  } as unknown as Message,
];

// ── Edited Messages ──────────────────────────────────────────────

export const EDITED_MESSAGES: Message[] = [
  {
    id: 'msg-edited-1',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'This message was edited to fix a typo',
    timestamp: '2026-06-15T10:00:00.000Z',
    edited_timestamp: '2026-06-15T10:05:30.000Z',
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  } as unknown as Message,

  // Not edited (for comparison)
  {
    id: 'msg-edited-2',
    channel_id: 'channel-123',
    author: AUTHOR_BOB,
    content: 'This one was never edited',
    timestamp: '2026-06-15T10:10:00.000Z',
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

// ── Code & Spoiler Messages ──────────────────────────────────────

export const CODE_SPOILER_MESSAGES: Message[] = [
  // Inline code
  {
    id: 'msg-code-1',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'Use `const x = 42;` for the answer',
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

  // Code block
  {
    id: 'msg-code-2',
    channel_id: 'channel-123',
    author: AUTHOR_BOB,
    content: '```js\nfunction hello() {\n  console.log("world");\n}\n```',
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

  // Spoiler
  {
    id: 'msg-spoiler-1',
    channel_id: 'channel-123',
    author: AUTHOR_CHARLIE,
    content: 'The ending is ||the hero wins||',
    timestamp: '2026-06-15T10:10:00.000Z',
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

// ── Message Grouping (same author, rapid succession) ─────────────

export const GROUPED_MESSAGES: Message[] = [
  // Alice sends 3 messages within 2 minutes — should group
  {
    id: 'msg-group-1',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'Hey everyone',
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
  {
    id: 'msg-group-2',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'I just pushed the fix',
    timestamp: '2026-06-15T10:01:00.000Z',
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
  {
    id: 'msg-group-3',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'Let me know if it works',
    timestamp: '2026-06-15T10:02:00.000Z',
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

  // Bob responds — group break (different author)
  {
    id: 'msg-group-4',
    channel_id: 'channel-123',
    author: AUTHOR_BOB,
    content: 'Testing now...',
    timestamp: '2026-06-15T10:03:00.000Z',
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

  // Alice again but after 10 minutes — group break (time gap)
  {
    id: 'msg-group-5',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'Any update?',
    timestamp: '2026-06-15T10:13:00.000Z',
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

// ── Placeholder Image Data URIs ──────────────────────────────────

function placeholderSvg(color: string, label: string, w = 400, h = 300): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="100%" height="100%" fill="${color}"/>` +
    `<text x="50%" y="50%" text-anchor="middle" dy=".35em" fill="#fff" font-family="sans-serif" font-size="24">${label}</text>` +
    `</svg>`
  )}`;
}

const PLACEHOLDER_IMAGES = {
  blue: placeholderSvg('#5865f2', 'Screenshot 1'),
  purple: placeholderSvg('#9b59b6', 'Screenshot 2'),
  green: placeholderSvg('#43b581', 'Screenshot 3'),
  red: placeholderSvg('#f04747', 'Photo'),
  orange: placeholderSvg('#faa61a', 'Preview', 600, 400),
};

// ── Media-Heavy Messages ─────────────────────────────────────────

export const MEDIA_HEAVY_MESSAGES: Message[] = [
  // Multiple image attachments
  {
    id: 'msg-media-1',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'Here are the screenshots',
    timestamp: '2026-06-15T10:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [
      createMockAttachment({ id: 'att-1', filename: 'screenshot1.png', size: 204800, url: PLACEHOLDER_IMAGES.blue, content_type: 'image/png' }),
      createMockAttachment({ id: 'att-2', filename: 'screenshot2.png', size: 153600, url: PLACEHOLDER_IMAGES.purple, content_type: 'image/png' }),
      createMockAttachment({ id: 'att-3', filename: 'screenshot3.jpg', size: 307200, url: PLACEHOLDER_IMAGES.green, content_type: 'image/jpeg' }),
    ],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  } as unknown as Message,

  // Video + embed with image
  {
    id: 'msg-media-2',
    channel_id: 'channel-123',
    author: AUTHOR_BOB,
    content: 'Check out this demo',
    timestamp: '2026-06-15T10:05:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [
      createMockAttachment({ id: 'att-vid', filename: 'demo.mp4', size: 10485760, url: 'https://cdn.discordapp.com/attachments/ch/att-vid/demo.mp4', content_type: 'video/mp4' }),
    ],
    embeds: [
      createMockEmbed({
        title: 'Project Demo',
        description: 'Live recording of the new feature',
        thumbnail: { url: placeholderSvg('#7289da', '🖼', 80, 80), height: 80, width: 80 },
        image: { url: PLACEHOLDER_IMAGES.orange, height: 400, width: 600 },
      }),
    ],
    reactions: [
      createMockReaction({ emoji: { id: null, name: '🔥' }, count: 8 }),
      createMockReaction({ emoji: { id: null, name: '👏' }, count: 4 }),
    ],
    pinned: false,
    type: 0,
  } as unknown as Message,

  // Audio attachment
  {
    id: 'msg-media-3',
    channel_id: 'channel-123',
    author: AUTHOR_CHARLIE,
    content: 'Voice memo from the meeting',
    timestamp: '2026-06-15T10:10:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [
      createMockAttachment({ id: 'att-audio', filename: 'meeting-notes.mp3', size: 2097152, url: 'https://cdn.discordapp.com/attachments/ch/att-audio/meeting-notes.mp3', content_type: 'audio/mpeg' }),
    ],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  } as unknown as Message,
];

// ── DM Messages (no guild context) ──────────────────────────────

export const DM_MESSAGES: Message[] = [
  {
    id: 'msg-dm-1',
    channel_id: 'dm-channel-1',
    author: AUTHOR_ALICE,
    content: 'Hey, are you free this weekend?',
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
  {
    id: 'msg-dm-2',
    channel_id: 'dm-channel-1',
    author: AUTHOR_BOB,
    content: 'Yeah, what did you have in mind?',
    timestamp: '2026-06-15T10:01:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [
      createMockReaction({ emoji: { id: null, name: '👍' }, count: 1 }),
    ],
    pinned: false,
    type: 0,
  } as unknown as Message,
  {
    id: 'msg-dm-3',
    channel_id: 'dm-channel-1',
    author: AUTHOR_ALICE,
    content: 'Let me send you the details',
    timestamp: '2026-06-15T10:02:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [
      createMockAttachment({ id: 'att-dm', filename: 'plans.pdf', size: 51200, url: 'https://cdn.discordapp.com/attachments/dm/att-dm/plans.pdf', content_type: 'application/pdf' }),
    ],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  } as unknown as Message,
];

// ── Comprehensive Scenario (all types mixed) ─────────────────────

export const COMPREHENSIVE_MESSAGES: Message[] = [
  ...GROUPED_MESSAGES.slice(0, 3),  // Grouped messages from Alice
  REPLY_MESSAGES[1],                 // Bob's reply
  EDITED_MESSAGES[0],                // Alice's edited message
  CODE_SPOILER_MESSAGES[1],          // Bob's code block
  CODE_SPOILER_MESSAGES[2],          // Charlie's spoiler
  MEDIA_HEAVY_MESSAGES[0],           // Alice's screenshots
  MEDIA_HEAVY_MESSAGES[1],           // Bob's video + embed
];

// ── Mock Reaction User Data (for Storybook previews) ─────────────

import type { ReactionDataMap } from '@/services/exportHtmlJs';

/**
 * Pre-built reaction user data for Storybook.
 * In real exports, this would come from ReactionEnrichmentService.
 * Keyed by messageId -> emojiKey -> { emoji, count, users[] }.
 */
export const MOCK_REACTION_DATA: ReactionDataMap = {
  // msg-4: 👍 x5 (from EXPORT_MESSAGES)
  'msg-4': {
    '👍': {
      emoji: '👍',
      count: 5,
      users: [
        { id: AUTHOR_ALICE.id, username: 'alice', avatarUrl: AVATARS.alice },
        { id: AUTHOR_BOB.id, username: 'bob', avatarUrl: AVATARS.bob },
        { id: AUTHOR_CHARLIE.id, username: 'charlie', avatarUrl: AVATARS.charlie },
        { id: AUTHOR_DAVE.id, username: 'dave_dev', avatarUrl: AVATARS.dave },
        { id: AUTHOR_EVE.id, username: 'eve_nitro', avatarUrl: AVATARS.eve },
      ],
    },
  },
  // msg-6: 👍 x3, ❤️ x2 (from EXPORT_MESSAGES)
  'msg-6': {
    '👍': {
      emoji: '👍',
      count: 3,
      users: [
        { id: AUTHOR_ALICE.id, username: 'alice', avatarUrl: AVATARS.alice },
        { id: AUTHOR_BOB.id, username: 'bob', avatarUrl: AVATARS.bob },
        { id: AUTHOR_CHARLIE.id, username: 'charlie', avatarUrl: AVATARS.charlie },
      ],
    },
    '❤️': {
      emoji: '❤️',
      count: 2,
      users: [
        { id: AUTHOR_ALICE.id, username: 'alice', avatarUrl: AVATARS.alice },
        { id: AUTHOR_DAVE.id, username: 'dave_dev', avatarUrl: AVATARS.dave },
      ],
    },
  },
  // msg-media-2: 🔥 x8, 👏 x4 (from MEDIA_HEAVY_MESSAGES)
  'msg-media-2': {
    '🔥': {
      emoji: '🔥',
      count: 8,
      users: [
        { id: AUTHOR_ALICE.id, username: 'alice', avatarUrl: AVATARS.alice },
        { id: AUTHOR_BOB.id, username: 'bob', avatarUrl: AVATARS.bob },
        { id: AUTHOR_CHARLIE.id, username: 'charlie', avatarUrl: AVATARS.charlie },
        { id: AUTHOR_DAVE.id, username: 'dave_dev', avatarUrl: AVATARS.dave },
        { id: AUTHOR_EVE.id, username: 'eve_nitro', avatarUrl: AVATARS.eve },
        { id: AUTHOR_BOT.id, username: 'ModBot', avatarUrl: AVATARS.bot },
        { id: '100000000000000007', username: 'grace', avatarUrl: avatarSvg('#9b59b6', 'G') },
        { id: '100000000000000008', username: 'hank', avatarUrl: avatarSvg('#e67e22', 'H') },
      ],
    },
    '👏': {
      emoji: '👏',
      count: 4,
      users: [
        { id: AUTHOR_ALICE.id, username: 'alice', avatarUrl: AVATARS.alice },
        { id: AUTHOR_BOB.id, username: 'bob', avatarUrl: AVATARS.bob },
        { id: AUTHOR_CHARLIE.id, username: 'charlie', avatarUrl: AVATARS.charlie },
        { id: AUTHOR_DAVE.id, username: 'dave_dev', avatarUrl: AVATARS.dave },
      ],
    },
  },
};

// ── Large Reaction Messages (for testing progressive loading) ─────

const MOCK_USER_COLORS = ['#5865f2', '#eb459e', '#57f287', '#fee75c', '#ed4245', '#9b59b6', '#e67e22', '#1abc9c', '#3498db', '#2ecc71'];

function generateMockUsers(count: number, startIndex = 1) {
  return Array.from({ length: count }, (_, i) => {
    const idx = startIndex + i;
    const initial = String.fromCharCode(65 + (idx % 26)); // A-Z cycling
    const color = MOCK_USER_COLORS[idx % MOCK_USER_COLORS.length];
    return {
      id: `20000000000000${String(idx).padStart(4, '0')}`,
      username: `user_${idx}`,
      avatarUrl: avatarSvg(color, initial),
    };
  });
}

export const LARGE_REACTION_MESSAGES: Message[] = [
  {
    id: 'msg-popular-1',
    channel_id: 'channel-123',
    author: AUTHOR_ALICE,
    content: 'This post went viral! 🎉',
    timestamp: '2026-06-15T10:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [
      createMockReaction({ emoji: { id: null, name: '🔥' }, count: 50 }),
      createMockReaction({ emoji: { id: null, name: '❤️' }, count: 35 }),
      createMockReaction({ emoji: { id: null, name: '👍' }, count: 12 }),
    ],
    pinned: false,
    type: 0,
  } as unknown as Message,
  {
    id: 'msg-popular-2',
    channel_id: 'channel-123',
    author: AUTHOR_BOB,
    content: 'Agreed, this is amazing',
    timestamp: '2026-06-15T10:05:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [
      createMockReaction({ emoji: { id: null, name: '👍' }, count: 8 }),
    ],
    pinned: false,
    type: 0,
  } as unknown as Message,
];

export const MOCK_LARGE_REACTION_DATA: ReactionDataMap = {
  'msg-popular-1': {
    '🔥': {
      emoji: '🔥',
      count: 50,
      users: generateMockUsers(50, 1),
    },
    '❤️': {
      emoji: '❤️',
      count: 35,
      users: generateMockUsers(35, 100),
    },
    '👍': {
      emoji: '👍',
      count: 12,
      users: [
        { id: AUTHOR_ALICE.id, username: 'alice', avatarUrl: AVATARS.alice },
        { id: AUTHOR_BOB.id, username: 'bob', avatarUrl: AVATARS.bob },
        { id: AUTHOR_CHARLIE.id, username: 'charlie', avatarUrl: AVATARS.charlie },
        ...generateMockUsers(9, 200),
      ],
    },
  },
  'msg-popular-2': {
    '👍': {
      emoji: '👍',
      count: 8,
      users: [
        { id: AUTHOR_ALICE.id, username: 'alice', avatarUrl: AVATARS.alice },
        { id: AUTHOR_BOB.id, username: 'bob', avatarUrl: AVATARS.bob },
        ...generateMockUsers(6, 300),
      ],
    },
  },
};

// ── Extended User Map (all Storybook authors) ────────────────────

export const EXTENDED_USER_MAP = {
  ...EXPORT_USER_MAP,
  [AUTHOR_CHARLIE.id]: {
    userName: 'charlie',
    displayName: 'Charlie',
    avatar: 'charlie_avatar_hash',
    guilds: {
      [EXPORT_GUILD_ID]: {
        roles: ['role-moderator'],
        nick: 'CharlieTheMod',
        joinedAt: '2025-01-15T00:00:00.000Z',
        timestamp: Date.now(),
      },
    },
    timestamp: Date.now(),
  },
  [AUTHOR_DAVE.id]: {
    userName: 'dave_dev',
    displayName: 'Dave',
    avatar: 'dave_avatar_hash',
    guilds: {
      [EXPORT_GUILD_ID]: {
        roles: ['role-developer'],
        nick: null,
        joinedAt: '2025-03-20T00:00:00.000Z',
        timestamp: Date.now(),
      },
    },
    timestamp: Date.now(),
  },
  [AUTHOR_EVE.id]: {
    userName: 'eve_nitro',
    displayName: 'Eve',
    avatar: 'eve_avatar_hash',
    guilds: {
      [EXPORT_GUILD_ID]: {
        roles: ['role-booster'],
        nick: 'Eve ✨',
        joinedAt: '2024-11-01T00:00:00.000Z',
        timestamp: Date.now(),
      },
    },
    timestamp: Date.now(),
  },
  [AUTHOR_BOT.id]: {
    userName: 'ModBot',
    displayName: null,
    avatar: 'bot_avatar_hash',
    guilds: {
      [EXPORT_GUILD_ID]: {
        roles: ['role-bot'],
        nick: null,
        joinedAt: '2024-06-01T00:00:00.000Z',
        timestamp: Date.now(),
      },
    },
    timestamp: Date.now(),
  },
};

/** User map with roles keyed to STORYBOOK_GUILD_ID for role color rendering in Storybook */
export const STORYBOOK_USER_MAP = {
  [AUTHOR_ALICE.id]: {
    userName: 'alice', displayName: 'Alice Display', avatar: 'alice_avatar_hash',
    guilds: { [STORYBOOK_GUILD_ID]: { roles: ['role-admin', 'role-moderator'], nick: 'AliceNick', joinedAt: null, timestamp: Date.now() } },
    timestamp: Date.now(),
  },
  [AUTHOR_BOB.id]: {
    userName: 'bob', displayName: 'Bob Display', avatar: null,
    guilds: { [STORYBOOK_GUILD_ID]: { roles: ['role-artist'], nick: null, joinedAt: null, timestamp: Date.now() } },
    timestamp: Date.now(),
  },
  [AUTHOR_CHARLIE.id]: {
    userName: 'charlie', displayName: 'Charlie', avatar: 'charlie_avatar_hash',
    guilds: { [STORYBOOK_GUILD_ID]: { roles: ['role-moderator', 'role-member'], nick: 'CharlieTheMod', joinedAt: '2025-01-15T00:00:00.000Z', timestamp: Date.now() } },
    timestamp: Date.now(),
  },
  [AUTHOR_DAVE.id]: {
    userName: 'dave_dev', displayName: 'Dave', avatar: 'dave_avatar_hash',
    guilds: { [STORYBOOK_GUILD_ID]: { roles: ['role-developer'], nick: null, joinedAt: '2025-03-20T00:00:00.000Z', timestamp: Date.now() } },
    timestamp: Date.now(),
  },
  [AUTHOR_EVE.id]: {
    userName: 'eve_nitro', displayName: 'Eve', avatar: 'eve_avatar_hash',
    guilds: { [STORYBOOK_GUILD_ID]: { roles: ['role-booster', 'role-artist'], nick: 'Eve ✨', joinedAt: '2024-11-01T00:00:00.000Z', timestamp: Date.now() } },
    timestamp: Date.now(),
  },
  [AUTHOR_BOT.id]: {
    userName: 'ModBot', displayName: null, avatar: 'bot_avatar_hash',
    guilds: { [STORYBOOK_GUILD_ID]: { roles: ['role-bot'], nick: null, joinedAt: '2024-06-01T00:00:00.000Z', timestamp: Date.now() } },
    timestamp: Date.now(),
  },
};
