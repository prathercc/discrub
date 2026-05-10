import { describe, it, expect } from 'vitest';
import { parseMessagesJson, countJsonMessages, parseSnowflakeJson } from './jsonParser';

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
    // 19-digit snowflake "7700000000000000111" is rounded to
    // "7700000000000000000" by raw JSON.parse, breaking the AROUND
    // rehydration loop because Discord's API never matches the
    // rounded ID against any real message. (Repro from a user HAR
    // showing every package message marked unavailable.)
    const realSnowflake = '7700000000000000111';
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
    const realSnowflake = '7700000000000000111';
    const json =
      `[{"ID":"${realSnowflake}","Timestamp":"t","Contents":"","Attachments":""}]`;
    expect(parseMessagesJson(json)[0].id).toBe(realSnowflake);
  });

  it('does not match "ID" embedded inside a Contents string', () => {
    // The numeric-ID rescue regex must only fire on top-level keys.
    // A user message like `,"ID": 999` should remain unmodified.
    const realSnowflake = '7700000000000000111';
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

describe('parseSnowflakeJson', () => {
  // Real 19-digit snowflake — last 3 digits non-zero so a Number round-
  // trip is observable. Raw `JSON.parse('{"id":7700000000000000111}').id`
  // returns `7700000000000000000` (toString); we want the original.
  const realSnowflake = '7700000000000000111';

  it('preserves a top-level numeric id field as a string (user.json shape)', () => {
    const raw = `{"id":${realSnowflake},"username":"foo","email":"f@e.com"}`;
    const parsed = parseSnowflakeJson<{ id: string }>(raw);
    expect(parsed.id).toBe(realSnowflake);
  });

  it('preserves numeric id and nested guild.id (channel.json shape)', () => {
    const guildId = '901000000000000123';
    const channelId = '999888777666555444';
    const raw =
      `{"id":${channelId},"type":0,"name":"general",` +
      `"guild":{"id":${guildId},"name":"Test"}}`;
    const parsed = parseSnowflakeJson<{ id: string; guild: { id: string } }>(raw);
    expect(parsed.id).toBe(channelId);
    expect(parsed.guild.id).toBe(guildId);
  });

  it('preserves bare numeric values inside a recipients array', () => {
    // DM channel.json from older exports ships recipients as bare ints.
    const a = '111000000000000111';
    const b = '222000000000000222';
    const raw = `{"id":1,"type":1,"recipients":[${a},${b}]}`;
    const parsed = parseSnowflakeJson<{ recipients: string[] }>(raw);
    expect(parsed.recipients).toEqual([a, b]);
  });

  it('leaves quoted-string IDs untouched (forward-compat with current exports)', () => {
    const raw =
      `{"id":"${realSnowflake}","username":"foo",` +
      `"recipients":["a","b"]}`;
    const parsed = parseSnowflakeJson<{ id: string; recipients: string[] }>(raw);
    expect(parsed.id).toBe(realSnowflake);
    expect(parsed.recipients).toEqual(['a', 'b']);
  });

  it('does not corrupt non-snowflake numeric properties (type, message_count, etc.)', () => {
    // Numeric fields that LOOK like ints but aren't IDs must round-trip
    // as numbers. The regex targets known snowflake-bearing field names
    // only, not every "field with digit value".
    const raw = `{"id":${realSnowflake},"type":3,"position":42,"flags":0}`;
    const parsed = parseSnowflakeJson<{
      id: string;
      type: number;
      position: number;
      flags: number;
    }>(raw);
    expect(parsed.id).toBe(realSnowflake);
    expect(parsed.type).toBe(3);
    expect(parsed.position).toBe(42);
    expect(parsed.flags).toBe(0);
  });

  it('does not match snowflake field names embedded inside string content', () => {
    // A `"id":<digits>` substring inside a JSON-encoded string literal
    // appears as `\"id\":<digits>` in the raw text — preceded by a
    // backslash, not by `{` or `,`, so the regex anchors don't fire.
    const raw =
      `{"id":${realSnowflake},"name":"prefix ,\\"id\\":999 suffix"}`;
    const parsed = parseSnowflakeJson<{ id: string; name: string }>(raw);
    expect(parsed.id).toBe(realSnowflake);
    expect(parsed.name).toBe('prefix ,"id":999 suffix');
  });

  it('handles all known snowflake-bearing field names', () => {
    // Forward-compat sweep: every field name in the helper's allow-list
    // round-trips through quoting. If Discord ever ships any of these
    // unquoted, we're already covered.
    const id = '1';
    const raw = JSON.stringify({
      id: 1,
      channel_id: 1,
      guild_id: 1,
      user_id: 1,
      message_id: 1,
      owner_id: 1,
      recipient_id: 1,
      application_id: 1,
      target_id: 1,
      webhook_id: 1,
      integration_id: 1,
    })
      .replace(/"\d+"/g, '1') // strip JSON.stringify's quoting so we test the unquoted path
      .replace(/:1/g, ':1');
    const parsed = parseSnowflakeJson<Record<string, string>>(raw);
    for (const key of Object.keys(parsed)) {
      expect(parsed[key], `${key} should be a string`).toBe(id);
    }
  });

  it('still works for messages/index.json (object keys are channel ids; values are names)', () => {
    // index.json keys are channel IDs but JSON object keys are always
    // strings, so no special handling needed. The helper should be a
    // pass-through here.
    const raw = `{"200":"general","300":"DMs","400":"old"}`;
    const parsed = parseSnowflakeJson<Record<string, string>>(raw);
    expect(parsed).toEqual({ '200': 'general', '300': 'DMs', '400': 'old' });
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
