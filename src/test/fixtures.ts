import type { Message, User, Guild, Channel, Attachment, Reaction, Embed } from 'discrub-core/types/discord-types';

/**
 * Test fixtures for common Discord data types
 */

export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'user-123',
  username: 'testuser',
  discriminator: '0001',
  avatar: null,
  bot: false,
  system: false,
  mfa_enabled: false,
  verified: false,
  ...overrides,
} as unknown as User);

export const createMockGuild = (overrides?: Partial<Guild>): Guild =>
  ({
    id: 'guild-123',
    name: 'Test Guild',
    icon: null,
    owner_id: 'user-123',
    permissions: String((1n << 10n) | (1n << 16n) | (1n << 11n)), // VIEW_CHANNEL + READ_HISTORY + SEND_MESSAGES
    features: [],
    ...overrides,
  } as Guild);

export const createMockChannel = (overrides?: Partial<Channel>): Channel =>
  ({
    id: 'channel-123',
    type: 0,
    guild_id: 'guild-123',
    position: 0,
    name: 'test-channel',
    topic: null,
    nsfw: false,
    last_message_id: null,
    ...overrides,
  } as Channel);

export const createMockMessage = (overrides?: Partial<Message>): Message => ({
  id: 'msg-123',
  channel_id: 'channel-123',
  author: createMockUser(),
  content: 'Test message',
  timestamp: '2026-02-24T00:00:00.000Z',
  edited_timestamp: null,
  tts: false,
  mention_everyone: false,
  mentions: [],
  attachments: [],
  embeds: [],
  reactions: [],
  pinned: false,
  type: 0,
  ...overrides,
} as unknown as Message);

/**
 * Create multiple mock messages with sequential IDs
 */
export const createMockMessages = (count: number): Message[] => {
  return Array.from({ length: count }, (_, i) =>
    createMockMessage({
      id: `msg-${i + 1}`,
      content: `Test message ${i + 1}`,
      timestamp: new Date(2026, 1, 24, 0, 0, i).toISOString(),
    })
  );
};

/**
 * Create a mock attachment
 */
export const createMockAttachment = (overrides?: Partial<Attachment>): Attachment => ({
  id: 'attachment-123',
  filename: 'image.png',
  size: 102400,
  url: 'https://cdn.discordapp.com/attachments/channel-123/attachment-123/image.png',
  proxy_url: 'https://media.discordapp.net/attachments/channel-123/attachment-123/image.png',
  height: 600,
  width: 800,
  content_type: 'image/png',
  ...overrides,
} as Attachment);

/**
 * Create a mock reaction
 */
export const createMockReaction = (overrides?: Partial<Reaction>): Reaction => ({
  count: 3,
  count_details: { burst: 0, normal: 3 },
  me: false,
  me_burst: false,
  emoji: {
    id: null,
    name: '👍',
  },
  burst_colors: [],
  ...overrides,
} as Reaction);

/**
 * Create a mock embed
 */
export const createMockEmbed = (overrides?: Partial<Embed>): Embed => ({
  title: 'Test Embed',
  type: 'rich',
  description: 'This is a test embed description',
  url: 'https://example.com',
  fields: [],
  footer: { text: 'Test footer' },
  ...overrides,
} as Embed);

/**
 * Create a mock DM channel (type 1)
 */
export const createMockDmChannel = (overrides?: Partial<Channel>): Channel => ({
  id: 'dm-123',
  type: 1,
  last_message_id: 'msg-100',
  recipients: [createMockUser({ id: 'recipient-1', username: 'dmbuddy' })],
  ...overrides,
} as Channel);

/**
 * Mock Discord API responses
 */
export const mockApiResponse = {
  success: <T>(data: T) => ({ success: true, data }),
  failure: (error: string) => ({ success: false, data: null, error }),
};
