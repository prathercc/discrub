import { describe, it, expect } from 'vitest';
import { applyRefineCriteria, messageHasType, messageHasFileOrLink } from './messageFiltering';
import { HasType } from 'discrub-core/discord-enum';
import { createMockMessage } from '@/test/fixtures';
import type { Message } from 'discrub-core/types/discord-types';

const withSnapshot = (id: string, snippetContent: string): Message => ({
  ...createMockMessage({ id, type: 0, content: '' }),
  message_reference: { type: 1, message_id: 'orig-1', channel_id: 'c1' } as any,
  message_snapshots: [{ message: { content: snippetContent } }],
} as Message);

const reply = (id: string): Message => ({
  ...createMockMessage({ id, type: 19, content: 'reply body' }),
  message_reference: { message_id: 'orig-1', channel_id: 'c1' } as any,
} as Message);

const recipientAdd = (id: string): Message =>
  createMockMessage({ id, type: 1, content: '' }) as Message;

describe('messageFiltering — HasType.FORWARD (#197)', () => {
  it('matches a forwarded message (has message_snapshots)', () => {
    const msgs = [withSnapshot('m1', 'forwarded content')];
    const result = applyRefineCriteria(msgs, {
      selectedHasTypes: [HasType.FORWARD],
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m1');
  });

  it('does NOT match a reply (type 19 with message_reference but no snapshots)', () => {
    const msgs = [reply('r1')];
    const result = applyRefineCriteria(msgs, {
      selectedHasTypes: [HasType.FORWARD],
    } as any);
    expect(result).toHaveLength(0);
  });

  it('does NOT match a RECIPIENT_ADD system message (type 1)', () => {
    // Pre-fix code matched any msg.type === 1, which is RECIPIENT_ADD,
    // not a forward. Pin against regression.
    const msgs = [recipientAdd('s1')];
    const result = applyRefineCriteria(msgs, {
      selectedHasTypes: [HasType.FORWARD],
    } as any);
    expect(result).toHaveLength(0);
  });

  it('does NOT match a plain message (no snapshots, no reference)', () => {
    const msgs = [createMockMessage({ id: 'p1' }) as Message];
    const result = applyRefineCriteria(msgs, {
      selectedHasTypes: [HasType.FORWARD],
    } as any);
    expect(result).toHaveLength(0);
  });

  it('matches a mixed batch and only returns forwards', () => {
    const msgs = [
      reply('r1'),
      withSnapshot('f1', 'fwd 1'),
      createMockMessage({ id: 'p1' }) as Message,
      withSnapshot('f2', 'fwd 2'),
      recipientAdd('s1'),
    ];
    const result = applyRefineCriteria(msgs, {
      selectedHasTypes: [HasType.FORWARD],
    } as any);
    expect(result.map((m) => m.id)).toEqual(['f1', 'f2']);
  });

  it('treats empty message_snapshots array as not-a-forward', () => {
    const msgs = [
      { ...createMockMessage({ id: 'e1' }), message_snapshots: [] } as any,
    ];
    const result = applyRefineCriteria(msgs, {
      selectedHasTypes: [HasType.FORWARD],
    } as any);
    expect(result).toHaveLength(0);
  });
});

describe('messageFiltering — messageHasType / messageHasFileOrLink (#239)', () => {
  const attachment = { id: 'a1', filename: 'photo.png', url: 'https://cdn.example.com/photo.png' };
  const plain = (id: string, content: string): Message =>
    createMockMessage({ id, type: 0, content }) as Message;
  const withAttachment = (id: string, content = 'has a file'): Message =>
    ({ ...createMockMessage({ id, type: 0, content }), attachments: [attachment] }) as Message;

  describe('messageHasType — LINK detection', () => {
    it('matches http:// and https:// URLs in content', () => {
      expect(messageHasType(plain('m1', 'see http://example.com'), HasType.LINK)).toBe(true);
      expect(messageHasType(plain('m2', 'see https://example.com/path?q=1'), HasType.LINK)).toBe(true);
    });

    it('matches a URL embedded mid-word and uppercase schemes (extended vs old substring check)', () => {
      expect(messageHasType(plain('m1', 'linkhttps://example.com'), HasType.LINK)).toBe(true);
      expect(messageHasType(plain('m2', 'HTTPS://EXAMPLE.COM'), HasType.LINK)).toBe(true);
    });

    it('does NOT match a bare dangling scheme with nothing after it (hardening)', () => {
      expect(messageHasType(plain('m1', 'just http:// lol'), HasType.LINK)).toBe(false);
      expect(messageHasType(plain('m2', 'https://'), HasType.LINK)).toBe(false);
    });

    it('does NOT match scheme-less URLs or plain text', () => {
      expect(messageHasType(plain('m1', 'www.example.com'), HasType.LINK)).toBe(false);
      expect(messageHasType(plain('m2', 'no links here'), HasType.LINK)).toBe(false);
      expect(messageHasType(plain('m3', ''), HasType.LINK)).toBe(false);
    });
  });

  describe('messageHasFileOrLink (purge preserve predicate)', () => {
    it('true for attachment-only message', () => {
      expect(messageHasFileOrLink(withAttachment('m1', 'no url here'))).toBe(true);
    });

    it('true for link-only message', () => {
      expect(messageHasFileOrLink(plain('m1', 'check https://example.com out'))).toBe(true);
    });

    it('true when both attachment and link are present', () => {
      expect(messageHasFileOrLink(withAttachment('m1', 'also https://example.com'))).toBe(true);
    });

    it('false for a plain text message (neither)', () => {
      expect(messageHasFileOrLink(plain('m1', 'just words'))).toBe(false);
    });

    it('false for an embed WITHOUT a link in content (bare embed is not preserved)', () => {
      const embedOnly = {
        ...createMockMessage({ id: 'm1', type: 0, content: 'gif reaction' }),
        embeds: [{ type: 'gifv', url: 'https://tenor.com/x.gif' }],
      } as unknown as Message;
      expect(messageHasType(embedOnly, HasType.EMBED)).toBe(true);
      expect(messageHasFileOrLink(embedOnly)).toBe(false);
    });

    it('false for empty attachments array', () => {
      const msg = { ...plain('m1', 'text'), attachments: [] } as Message;
      expect(messageHasFileOrLink(msg)).toBe(false);
    });
  });

  describe('refine parity — applyRefineCriteria and messageHasType agree', () => {
    it('selectedHasTypes [LINK, FILE] keeps exactly the messages the predicate approves', () => {
      const msgs = [
        plain('link', 'go to https://example.com'),
        withAttachment('file', 'plain caption'),
        plain('neither', 'nothing to see'),
        plain('dangling', 'broken http:// scheme'),
      ];
      const result = applyRefineCriteria(msgs, {
        selectedHasTypes: [HasType.LINK, HasType.FILE],
      } as any);
      const expected = msgs.filter(
        (m) => messageHasType(m, HasType.LINK) || messageHasType(m, HasType.FILE),
      );
      expect(result.map((m) => m.id)).toEqual(expected.map((m) => m.id));
      expect(result.map((m) => m.id)).toEqual(['link', 'file']);
    });

    it('FILE refine still matches any attachment regardless of content_type', () => {
      const noContentType = {
        ...plain('m1', 'doc'),
        attachments: [{ id: 'a1', filename: 'notes.txt', url: 'https://cdn.example.com/notes.txt' }],
      } as Message;
      const result = applyRefineCriteria([noContentType], {
        selectedHasTypes: [HasType.FILE],
      } as any);
      expect(result).toHaveLength(1);
    });
  });
});

describe('messageFiltering — system message type refine (#201)', () => {
  // type 0 = DEFAULT, 6 = CHANNEL_PINNED_MESSAGE (pins), 7 = USER_JOIN
  // (members), 8 = GUILD_BOOST (boosts).
  const batch = (): Message[] => [
    createMockMessage({ id: 'normal', type: 0, content: 'hello' }) as Message,
    createMockMessage({ id: 'pin', type: 6, content: '' }) as Message,
    createMockMessage({ id: 'join', type: 7, content: '' }) as Message,
    createMockMessage({ id: 'boost', type: 8, content: '' }) as Message,
  ];

  it('"only" keeps just the selected system types, dropping everything else', () => {
    const result = applyRefineCriteria(batch(), {
      systemMessageGroups: ['pins'],
      systemMessageMode: 'only',
    } as any);
    expect(result.map((m) => m.id)).toEqual(['pin']);
  });

  it('"only" defaults when no mode is given', () => {
    const result = applyRefineCriteria(batch(), {
      systemMessageGroups: ['pins'],
    } as any);
    expect(result.map((m) => m.id)).toEqual(['pin']);
  });

  it('"hide" drops the selected system types, keeping the rest', () => {
    const result = applyRefineCriteria(batch(), {
      systemMessageGroups: ['pins'],
      systemMessageMode: 'hide',
    } as any);
    expect(result.map((m) => m.id)).toEqual(['normal', 'join', 'boost']);
  });

  it('"only" honors multiple buckets (pins + members)', () => {
    const result = applyRefineCriteria(batch(), {
      systemMessageGroups: ['pins', 'members'],
      systemMessageMode: 'only',
    } as any);
    // members includes USER_JOIN (7); pins is 6. boost (8) and normal (0) drop.
    expect(result.map((m) => m.id)).toEqual(['pin', 'join']);
  });

  it('"hide" honors multiple buckets', () => {
    const result = applyRefineCriteria(batch(), {
      systemMessageGroups: ['pins', 'members'],
      systemMessageMode: 'hide',
    } as any);
    expect(result.map((m) => m.id)).toEqual(['normal', 'boost']);
  });

  it('empty systemMessageGroups is a no-op (returns everything)', () => {
    const msgs = batch();
    const result = applyRefineCriteria(msgs, {
      systemMessageGroups: [],
      systemMessageMode: 'only',
    } as any);
    expect(result).toHaveLength(msgs.length);
  });

  it('ANDs with other refine filters (content + system "only")', () => {
    const msgs = [
      createMockMessage({ id: 'pin-hello', type: 6, content: 'hello' }) as Message,
      createMockMessage({ id: 'pin-other', type: 6, content: 'goodbye' }) as Message,
      createMockMessage({ id: 'normal-hello', type: 0, content: 'hello' }) as Message,
    ];
    const result = applyRefineCriteria(msgs, {
      searchMessageContent: 'hello',
      systemMessageGroups: ['pins'],
      systemMessageMode: 'only',
    } as any);
    // must be a pin AND contain "hello"
    expect(result.map((m) => m.id)).toEqual(['pin-hello']);
  });
});
