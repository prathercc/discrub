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
    // Discord's messages.json emits snowflakes as numeric literals
    // (not quoted strings). Small IDs survive round-tripping fine.
    const json = JSON.stringify([
      { ID: 123, Timestamp: '2022-07-28 22:30:52+00:00', Contents: 'x', Attachments: '' },
    ]);
    const rows = parseMessagesJson(json);
    expect(rows[0].id).toBe('123');
  });

  it('preserves 64-bit snowflake IDs without precision loss', () => {
    // Discord's messages.json stores IDs as numeric literals. Numbers
    // larger than 2^53 lose precision through JS Number — a real
    // 19-digit snowflake "1341524071724220421" is rounded to
    // "1341524071724220400" by raw JSON.parse, breaking the AROUND
    // rehydration loop because Discord's API never matches the
    // rounded ID against any real message. (Repro from a user HAR
    // showing every package message marked unavailable.)
    const realSnowflake = '1341524071724220421';
    // Construct the raw text Discord ships — unquoted numeric ID:
    const json =
      `[{"ID":${realSnowflake},"Timestamp":"2025-02-19T10:32:23+00:00",` +
      `"Contents":"hi","Attachments":""}]`;
    const rows = parseMessagesJson(json);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(realSnowflake);
  });

  it('does not corrupt IDs that already arrive as quoted strings', () => {
    // Forward-compat with any future export that switches to string IDs.
    const realSnowflake = '1341524071724220421';
    const json =
      `[{"ID":"${realSnowflake}","Timestamp":"t","Contents":"","Attachments":""}]`;
    expect(parseMessagesJson(json)[0].id).toBe(realSnowflake);
  });

  it('does not match "ID" embedded inside a Contents string', () => {
    // The numeric-ID rescue regex must only fire on top-level keys.
    // A user message like `,"ID": 999` should remain unmodified.
    const realSnowflake = '1341524071724220421';
    const json =
      `[{"ID":${realSnowflake},"Timestamp":"t",` +
      `"Contents":"prefix ,\\"ID\\":999 suffix","Attachments":""}]`;
    const rows = parseMessagesJson(json);
    expect(rows[0].id).toBe(realSnowflake);
    expect(rows[0].content).toBe('prefix ,"ID":999 suffix');
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
