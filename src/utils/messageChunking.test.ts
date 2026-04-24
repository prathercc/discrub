import { describe, it, expect } from 'vitest';
import type { Message } from 'discrub-core/types/discord-types';
import { chunkMessages, CHUNK_WINDOW_MS } from './messageChunking';

const msg = (
  id: string,
  authorId: string,
  timestamp: string,
  overrides: Partial<Message> = {},
): Message =>
  ({
    id,
    author: { id: authorId, username: `user-${authorId}` } as Message['author'],
    timestamp,
    type: 0,
    content: `msg ${id}`,
    ...overrides,
  }) as Message;

describe('chunkMessages', () => {
  it('returns an empty array for empty input', () => {
    expect(chunkMessages([])).toEqual([]);
  });

  it('wraps a single message in a single chunk', () => {
    const m = msg('1', 'alice', '2026-04-19T15:00:00.000Z');
    const chunks = chunkMessages([m]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].key).toBe('1');
    expect(chunks[0].authorId).toBe('alice');
    expect(chunks[0].messages).toEqual([m]);
  });

  it('groups same-author messages within the time window', () => {
    const a = msg('1', 'alice', '2026-04-19T15:00:00.000Z');
    const b = msg('2', 'alice', '2026-04-19T15:03:00.000Z');
    const c = msg('3', 'alice', '2026-04-19T15:06:00.000Z');
    const chunks = chunkMessages([a, b, c]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].messages).toEqual([a, b, c]);
  });

  it('splits on author change', () => {
    const a = msg('1', 'alice', '2026-04-19T15:00:00.000Z');
    const b = msg('2', 'bob', '2026-04-19T15:01:00.000Z');
    const chunks = chunkMessages([a, b]);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].authorId).toBe('alice');
    expect(chunks[1].authorId).toBe('bob');
  });

  it('splits when the time gap equals or exceeds the window', () => {
    const a = msg('1', 'alice', '2026-04-19T15:00:00.000Z');
    const b = msg(
      '2',
      'alice',
      new Date(
        new Date('2026-04-19T15:00:00.000Z').getTime() + CHUNK_WINDOW_MS,
      ).toISOString(),
    );
    const chunks = chunkMessages([a, b]);
    expect(chunks).toHaveLength(2);
  });

  it('keeps messages grouped when the gap is just under the window', () => {
    const a = msg('1', 'alice', '2026-04-19T15:00:00.000Z');
    const b = msg(
      '2',
      'alice',
      new Date(
        new Date('2026-04-19T15:00:00.000Z').getTime() + CHUNK_WINDOW_MS - 1,
      ).toISOString(),
    );
    const chunks = chunkMessages([a, b]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].messages).toHaveLength(2);
  });

  it('uses absolute time delta so newest-first order still groups', () => {
    const newer = msg('2', 'alice', '2026-04-19T15:03:00.000Z');
    const older = msg('1', 'alice', '2026-04-19T15:00:00.000Z');
    const chunks = chunkMessages([newer, older]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].messages).toEqual([newer, older]);
  });

  it('breaks the chunk on a reply (type 19) message', () => {
    const a = msg('1', 'alice', '2026-04-19T15:00:00.000Z');
    const reply = msg('2', 'alice', '2026-04-19T15:01:00.000Z', { type: 19 });
    const b = msg('3', 'alice', '2026-04-19T15:02:00.000Z');
    const chunks = chunkMessages([a, reply, b]);
    expect(chunks).toHaveLength(3);
    expect(chunks[1].messages[0].type).toBe(19);
  });

  it('breaks the chunk on thread-starter (type 21) and other non-zero types', () => {
    const a = msg('1', 'alice', '2026-04-19T15:00:00.000Z');
    const threadStarter = msg('2', 'alice', '2026-04-19T15:01:00.000Z', { type: 21 });
    const chunks = chunkMessages([a, threadStarter]);
    expect(chunks).toHaveLength(2);
  });

  it('handles missing author id by never grouping', () => {
    const a = msg('1', 'alice', '2026-04-19T15:00:00.000Z', { author: undefined } as any);
    const b = msg('2', 'alice', '2026-04-19T15:01:00.000Z', { author: undefined } as any);
    const chunks = chunkMessages([a, b]);
    expect(chunks).toHaveLength(2);
  });

  it('handles missing timestamp by never grouping', () => {
    const a = msg('1', 'alice', '2026-04-19T15:00:00.000Z');
    const b = msg('2', 'alice', undefined as any);
    const chunks = chunkMessages([a, b]);
    expect(chunks).toHaveLength(2);
  });

  it('resumes grouping after an interrupting author', () => {
    const a1 = msg('1', 'alice', '2026-04-19T15:00:00.000Z');
    const b1 = msg('2', 'bob', '2026-04-19T15:01:00.000Z');
    const a2 = msg('3', 'alice', '2026-04-19T15:02:00.000Z');
    const a3 = msg('4', 'alice', '2026-04-19T15:03:00.000Z');
    const chunks = chunkMessages([a1, b1, a2, a3]);
    expect(chunks.map((c) => c.authorId)).toEqual(['alice', 'bob', 'alice']);
    expect(chunks[2].messages).toHaveLength(2);
  });

  it('derives chunk key from the first message id', () => {
    const a = msg('111', 'alice', '2026-04-19T15:00:00.000Z');
    const b = msg('222', 'alice', '2026-04-19T15:01:00.000Z');
    const chunks = chunkMessages([a, b]);
    expect(chunks[0].key).toBe('111');
  });
});
