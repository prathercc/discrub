import { describe, it, expect } from 'vitest';
import { getMessageContent } from './messageUtils';
import type { Message } from 'discrub-core/types/discord-types';

const makeMessage = (overrides: Partial<Message> = {}): Message =>
  ({
    id: 'msg-1',
    channel_id: 'ch-1',
    content: 'normal content',
    type: 0,
    timestamp: '2026-01-01T00:00:00.000Z',
    author: { id: '1', username: 'user', discriminator: '0', avatar: null },
    attachments: [],
    embeds: [],
    pinned: false,
    tts: false,
    mention_everyone: false,
    mentions: [],
    ...overrides,
  }) as unknown as Message;

describe('getMessageContent', () => {
  it('should return content for a standard message (type 0)', () => {
    const msg = makeMessage({ content: 'Hello world', type: 0 });
    expect(getMessageContent(msg)).toBe('Hello world');
  });

  it('should return referenced_message.content for type 21 with empty content', () => {
    const msg = makeMessage({
      content: '',
      type: 21,
      referenced_message: makeMessage({ content: 'Thread starter text' }),
    });
    expect(getMessageContent(msg)).toBe('Thread starter text');
  });

  it('should return referenced_message.content for type 21 even with whitespace content', () => {
    const msg = makeMessage({
      content: '',
      type: 21,
      referenced_message: makeMessage({ content: 'Original post' }),
    });
    expect(getMessageContent(msg)).toBe('Original post');
  });

  it('should return empty string for type 21 with no referenced_message', () => {
    const msg = makeMessage({
      content: '',
      type: 21,
      referenced_message: null,
    });
    expect(getMessageContent(msg)).toBe('');
  });

  it('should return empty string for type 21 with referenced_message but empty content', () => {
    const msg = makeMessage({
      content: '',
      type: 21,
      referenced_message: makeMessage({ content: '' }),
    });
    expect(getMessageContent(msg)).toBe('');
  });

  it('should return empty string for a standard message with no content', () => {
    const msg = makeMessage({ content: '', type: 0 });
    expect(getMessageContent(msg)).toBe('');
  });

  it('should not use referenced_message for non-type-21 messages', () => {
    const msg = makeMessage({
      content: 'My reply',
      type: 19, // REPLY type
      referenced_message: makeMessage({ content: 'Original' }),
    });
    expect(getMessageContent(msg)).toBe('My reply');
  });

  it('should preserve special characters in referenced content', () => {
    const msg = makeMessage({
      content: '',
      type: 21,
      referenced_message: makeMessage({ content: 'Has "quotes" and <mentions> & ampersands' }),
    });
    expect(getMessageContent(msg)).toBe('Has "quotes" and <mentions> & ampersands');
  });
});
