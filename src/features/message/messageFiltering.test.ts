import { describe, it, expect } from 'vitest';
import { applyRefineCriteria } from './messageFiltering';
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
