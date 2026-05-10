import { zipSync, type Zippable } from 'fflate';

// fflate's `zipSync` performs an `instanceof Uint8Array` leaf check using
// the `Uint8Array` constructor it captured at module-evaluation time
// (aliased to `u8` in its source). Under vitest+jsdom either fflate's
// `strToU8` or `TextEncoder`'s output may produce a Uint8Array from a
// different realm, which fails the `instanceof` check — fflate then
// treats the bytes as a nested Zippable (one entry per byte index!) and
// emits a malformed ZIP. Re-wrapping through the *global* `Uint8Array`
// constructor — the same one fflate captured — sidesteps the realm
// mismatch. Ugly but stable across vitest realm configurations.
const strToU8 = (s: string): Uint8Array => new Uint8Array(new TextEncoder().encode(s));

export interface FixtureOptions {
  userId?: string;
  username?: string;
  omitUserJson?: boolean;
  malformedUserJson?: boolean;
  includeActivity?: boolean;
  includeOrphanChannel?: boolean;
  includeGroupDm?: boolean;
  includeMalformedCsv?: boolean;
  /**
   * Wrap everything in a top-level directory (as macOS does when a user
   * re-zips the extracted export). Also injects __MACOSX/ noise.
   */
  wrapperDir?: string;
  /**
   * Capitalize the top-level Discord directory names (`Account/`, `Messages/`,
   * `Servers/`, etc.) — some Discord exports ship this way and the parser
   * must resolve them case-insensitively.
   */
  capitalizeTopDirs?: boolean;
  /**
   * Override the locale-specific names of the three structural top-level
   * Discord directories. Discord ships exports using the user's UI locale,
   * so non-English packages have e.g. `compte/` instead of `account/`. The
   * parser must sniff structure by content, not by name (#157). Anything
   * not provided keeps the English default.
   */
  localeOverride?: Partial<{
    account: string;
    messages: string;
    servers: string;
  }>;
  /**
   * Channel-directory naming convention. `'c'` (default) ships dirs as
   * `c{snowflake}/` — the legacy form Discord used through the 2025-06-14
   * format change. `'none'` drops the prefix to `{snowflake}/`, matching
   * current packages (#163). Existing tests default to `'c'` so they
   * continue exercising the legacy path as a regression guard.
   */
  channelDirPrefix?: 'c' | 'none';
  /**
   * Per-channel messages-file format. `'csv'` (default) emits the legacy
   * `messages.csv`; `'json'` emits `messages.json` (Discord's current
   * format, post-2024-01-03). The parser must support both (#163), so
   * tests parameterize across this axis. Default is `'csv'` to keep
   * existing tests on the legacy path.
   */
  messagesFormat?: 'csv' | 'json';
  /**
   * Whether to include `account/avatar.png` in the fixture. Default
   * false to keep legacy tests that don't care about avatars. Tests
   * exercising the avatar-blob-url flow opt in.
   */
  includeAvatar?: boolean;
  /**
   * Emit user.json, guild.json, and channel.json with snowflake fields
   * as bare numeric literals instead of quoted strings. Older Discord
   * exports (and some current ones depending on locale/path) ship IDs
   * unquoted; this option lets a test reproduce that wire shape so the
   * parser's precision-preserving JSON helper is exercised end-to-end.
   *
   * Combine with `userId`/`includeGroupDm` to land 19-digit snowflakes
   * in user.json, guild.json, recipients arrays, and nested guild.id
   * within channel.json — every field the helper claims to protect.
   */
  unquotedSnowflakes?: boolean;
}

const HEADER = 'ID,Timestamp,Contents,Attachments';

/** Single message row used by both CSV and JSON serializers below. */
type FixtureMessage = {
  id: string;
  timestamp: string;
  /** Pre-CSV-quoted form. JSON serializer un-quotes via a helper. */
  contentsCsv: string;
  /** Plain string for JSON. CSV variant lives in `contentsCsv`. */
  contentsJson: string;
  attachments: string;
};

/**
 * Serializes a list of messages into the chosen format. For CSV we emit
 * the literal column layout Discord uses; for JSON we emit the post-2024
 * shape with PascalCase keys (`ID`, `Timestamp`, `Contents`, `Attachments`).
 *
 * Matters for #163 regression coverage: the parser must consume both
 * shapes interchangeably, and these test rows pin the exact wire format
 * we expect from Discord on either side of the format change.
 */
function serializeMessages(format: 'csv' | 'json', rows: FixtureMessage[]): string {
  if (format === 'json') {
    return JSON.stringify(
      rows.map((r) => ({
        ID: r.id,
        Timestamp: r.timestamp,
        Contents: r.contentsJson,
        Attachments: r.attachments,
      })),
    );
  }
  return [
    HEADER,
    ...rows.map((r) => `${r.id},${r.timestamp},${r.contentsCsv},${r.attachments}`),
  ].join('\n');
}

/** Builds an in-memory Blob that mimics a minimal Discord data package. */
export async function buildFixturePackage(opts: FixtureOptions = {}): Promise<Blob> {
  const {
    userId = '253286221395001345',
    username = 'prathercc',
    omitUserJson = false,
    malformedUserJson = false,
    includeActivity = false,
    includeOrphanChannel = false,
    includeGroupDm = false,
    includeMalformedCsv = false,
    wrapperDir = '',
    capitalizeTopDirs = false,
    localeOverride,
    channelDirPrefix = 'c',
    messagesFormat = 'csv',
    includeAvatar = false,
    unquotedSnowflakes = false,
  } = opts;
  // Strips quotes from every snowflake-bearing field in a stringified
  // object so the on-disk wire shape mirrors what older Discord exports
  // ship. Only used when `unquotedSnowflakes` is true.
  const SNOWFLAKE_KEYS = new Set([
    'id',
    'channel_id',
    'guild_id',
    'user_id',
    'message_id',
    'owner_id',
    'recipient_id',
    'application_id',
  ]);
  const stringify = (value: unknown): string => {
    const json = JSON.stringify(value);
    if (!unquotedSnowflakes) return json;
    let out = json;
    for (const key of SNOWFLAKE_KEYS) {
      out = out.replace(new RegExp(`"${key}":"(\\d+)"`, 'g'), `"${key}":$1`);
    }
    // recipients: ["a","b"] → recipients: [a,b] (when entries are pure digits)
    out = out.replace(
      /"recipients":\[([^\]]*)\]/g,
      (_match, inner: string) =>
        `"recipients":[${inner.replace(/"(\d+)"/g, '$1')}]`,
    );
    return out;
  };
  const dirP = channelDirPrefix === 'c' ? 'c' : '';
  const msgExt = messagesFormat;

  // Mirror Discord's variant where top-level directory names ship capitalized
  // (`Account/`, `Messages/`, `Servers/`). Inner segments stay lowercase.
  // Locale overrides land *after* capitalization so a French test can opt
  // into `compte/` etc. independently of casing.
  const cap = (s: string) => (capitalizeTopDirs ? s[0].toUpperCase() + s.slice(1) : s);
  const account = cap(localeOverride?.account ?? 'account');
  const servers = cap(localeOverride?.servers ?? 'servers');
  const messages = cap(localeOverride?.messages ?? 'messages');
  const activity = cap('activity');
  const activitiesE = cap('activities_e');

  // fflate uses a flat path -> bytes (or nested Zippable) map. We thread the
  // wrapper-dir prefix through directly rather than relying on a folder API.
  const z: Zippable = {};
  const root = wrapperDir ? `${wrapperDir}/` : '';
  const put = (path: string, body: string | Uint8Array) => {
    z[`${root}${path}`] = typeof body === 'string' ? strToU8(body) : body;
  };

  if (wrapperDir) {
    z[`__MACOSX/._${wrapperDir}`] = strToU8('junk');
    z[`${wrapperDir}/.DS_Store`] = strToU8('junk');
  }

  if (!omitUserJson) {
    put(
      `${account}/user.json`,
      malformedUserJson
        ? '{ not json'
        : stringify({
            id: userId,
            username,
            global_name: 'Aaron',
            avatar_hash: 'abc',
            email: 'test@example.com',
          }),
    );
  }

  if (includeAvatar) {
    // 8 bytes of "PNG-ish" magic + filler so the parser sees a non-empty
    // file. We don't care about pixel correctness; the export pipeline
    // wraps these bytes in a Blob and minted URL.
    put(
      `${account}/avatar.png`,
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }

  put(
    `${servers}/100/guild.json`,
    stringify({ id: '100', name: 'Test Guild' }),
  );

  // Discord's current package format ships `servers/index.json` alongside
  // `messages/index.json`. Both being present can confuse a sniffer that
  // relies on `tail === 'index.json'` alone — the structural sniff has to
  // disambiguate by content. Added to the default fixture so every test
  // exercises the realistic shape (#162 dogfood regression).
  put(
    `${servers}/index.json`,
    JSON.stringify({ '100': 'Test Guild' }),
  );

  put(
    `${messages}/index.json`,
    JSON.stringify({
      '200': 'general',
      '300': 'Direct Message with friend#0',
      '400': null,
      '500': null,
    }),
  );

  // Guild text channel
  put(
    `${messages}/${dirP}200/channel.json`,
    stringify({
      id: '200',
      type: 0,
      name: 'general',
      guild: { id: '100', name: 'Test Guild' },
    }),
  );
  put(
    `${messages}/${dirP}200/messages.${msgExt}`,
    serializeMessages(messagesFormat, [
      {
        id: '1',
        timestamp: '2022-07-28 22:30:52.800000+00:00',
        contentsCsv: 'hello',
        contentsJson: 'hello',
        attachments: '',
      },
      {
        id: '2',
        timestamp: '2022-07-28 22:31:00.000000+00:00',
        contentsCsv: '"with, comma"',
        contentsJson: 'with, comma',
        attachments: '',
      },
      {
        id: '3',
        timestamp: '2022-07-28 22:32:00.000000+00:00',
        contentsCsv: '"multi\nline"',
        contentsJson: 'multi\nline',
        attachments: '',
      },
    ]),
  );

  // DM
  put(
    `${messages}/${dirP}300/channel.json`,
    stringify({
      id: '300',
      type: 1,
      recipients: [userId, '999'],
    }),
  );
  put(
    `${messages}/${dirP}300/messages.${msgExt}`,
    serializeMessages(messagesFormat, [
      {
        id: '10',
        timestamp: '2022-08-01 00:00:00.000000+00:00',
        contentsCsv: 'yo',
        contentsJson: 'yo',
        attachments: '',
      },
    ]),
  );

  if (includeOrphanChannel) {
    put(
      `${messages}/${dirP}400/channel.json`,
      stringify({ id: '400', type: 0 }),
    );
    put(
      `${messages}/${dirP}400/messages.${msgExt}`,
      serializeMessages(messagesFormat, [
        {
          id: '20',
          timestamp: '2020-01-01 00:00:00.000000+00:00',
          contentsCsv: 'orphan msg',
          contentsJson: 'orphan msg',
          attachments: '',
        },
      ]),
    );
  }

  if (includeGroupDm) {
    put(
      `${messages}/${dirP}500/channel.json`,
      stringify({
        id: '500',
        type: 3,
        recipients: [userId, '888', '777'],
      }),
    );
    put(
      `${messages}/${dirP}500/messages.${msgExt}`,
      serializeMessages(messagesFormat, []),
    );
  }

  if (includeMalformedCsv) {
    // Stays CSV-shaped even when messagesFormat is 'json' — this fixture
    // is specifically about exercising the CSV parser's malformed-input
    // path, so it intentionally writes a `.csv` file regardless.
    put(
      `${messages}/c600/channel.json`,
      stringify({
        id: '600',
        type: 0,
        name: 'broken',
        guild: { id: '100', name: 'Test Guild' },
      }),
    );
    put(
      `${messages}/c600/messages.csv`,
      `${HEADER}\n1,2022-07-28 22:30:52.800000+00:00,"unterminated,`,
    );
  }

  if (includeActivity) {
    // Large payload that should NEVER be read into memory by the parser.
    put(`${activity}/reporting.json`, 'x'.repeat(1024));
    put(`${activitiesE}/events.json`, 'y'.repeat(512));
  }

  const bytes = zipSync(z);
  return new Blob([bytes as BlobPart]);
}
