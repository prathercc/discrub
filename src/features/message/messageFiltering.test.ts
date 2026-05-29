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
