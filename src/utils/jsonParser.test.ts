import { describe, it, expect } from 'vitest';
import { parseMessagesJson, countJsonMessages } from './jsonParser';

describe('parseMessagesJson', () => {
  it('parses a simple row', () => {
    const json = JSON.stringify([
      {
        ID: '123',
        Timestamp: '2022-07-28 22:30:52.800000+00:00',
        Contents: 'hello',
        Attachments: '',
      },
    ]);
    expect(parseMessagesJson(json)).toEqual([
      {
        id: '123',
        timestamp: '2022-07-28 22:30:52.800000+00:00',
        content: 'hello',
        attachments: [],
      },
    ]);
  });

  it('coerces numeric ID to string', () => {
    // Discord serializes snowflakes as strings, but defensive against any
    // re-export tooling that re-emits them as numbers.
    const json = JSON.stringify([
      { ID: 123, Timestamp: '2022-07-28 22:30:52+00:00', Contents: 'x', Attachments: '' },
    ]);
    const rows = parseMessagesJson(json);
    expect(rows[0].id).toBe('123');
  });

  it('treats missing Contents as empty string', () => {
    const json = JSON.stringify([
      { ID: '1', Timestamp: '2022-07-28 22:30:52+00:00', Attachments: '' },
    ]);
    expect(parseMessagesJson(json)[0].content).toBe('');
  });

  it('splits multi-attachment cells the same way as the CSV parser (#159)', () => {
    const json = JSON.stringify([
      {
        ID: '1',
        Timestamp: '2022-07-28 22:30:52+00:00',
        Contents: '',
        Attachments: 'https://cdn.discord.com/a.png https://cdn.discord.com/b.png',
      },
    ]);
    expect(parseMessagesJson(json)[0].attachments).toEqual([
      'https://cdn.discord.com/a.png',
      'https://cdn.discord.com/b.png',
    ]);
  });

  it('skips rows missing the required ID/Timestamp keys', () => {
    const json = JSON.stringify([
      { ID: '1', Timestamp: 't', Contents: 'a', Attachments: '' },
      { Contents: 'no id', Attachments: '' },
      { ID: '2', Contents: 'no timestamp', Attachments: '' },
      null,
      'string element',
    ]);
    const rows = parseMessagesJson(json);
    expect(rows.map((r) => r.id)).toEqual(['1']);
  });

  it('returns [] on malformed JSON without throwing', () => {
    expect(parseMessagesJson('{ not json')).toEqual([]);
  });

  it('returns [] when the root is not an array', () => {
    expect(parseMessagesJson('{}')).toEqual([]);
    expect(parseMessagesJson('"hello"')).toEqual([]);
    expect(parseMessagesJson('null')).toEqual([]);
  });

  it('treats blank Attachments as []', () => {
    const json = JSON.stringify([
      { ID: '1', Timestamp: 't', Contents: '', Attachments: '' },
    ]);
    expect(parseMessagesJson(json)[0].attachments).toEqual([]);
  });

  it('preserves multi-line Contents from JSON-encoded newlines', () => {
    const json = JSON.stringify([
      { ID: '1', Timestamp: 't', Contents: 'line1\nline2', Attachments: '' },
    ]);
    expect(parseMessagesJson(json)[0].content).toBe('line1\nline2');
  });
});

describe('countJsonMessages', () => {
  it('counts array length', () => {
    const json = JSON.stringify([
      { ID: '1', Timestamp: 't', Contents: 'a', Attachments: '' },
      { ID: '2', Timestamp: 't', Contents: 'b', Attachments: '' },
      { ID: '3', Timestamp: 't', Contents: 'c', Attachments: '' },
    ]);
    expect(countJsonMessages(json)).toBe(3);
  });

  it('returns 0 for empty arrays', () => {
    expect(countJsonMessages('[]')).toBe(0);
  });

  it('returns 0 for malformed JSON', () => {
    expect(countJsonMessages('{ not json')).toBe(0);
  });

  it('returns 0 when the root is not an array', () => {
    expect(countJsonMessages('{}')).toBe(0);
    expect(countJsonMessages('"hello"')).toBe(0);
  });
});
