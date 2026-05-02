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
}

const HEADER = 'ID,Timestamp,Contents,Attachments';

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
  } = opts;

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
        : JSON.stringify({
            id: userId,
            username,
            global_name: 'Aaron',
            avatar_hash: 'abc',
            email: 'test@example.com',
          }),
    );
  }

  put(
    `${servers}/100/guild.json`,
    JSON.stringify({ id: '100', name: 'Test Guild' }),
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
    `${messages}/c200/channel.json`,
    JSON.stringify({
      id: '200',
      type: 0,
      name: 'general',
      guild: { id: '100', name: 'Test Guild' },
    }),
  );
  put(
    `${messages}/c200/messages.csv`,
    [
      HEADER,
      '1,2022-07-28 22:30:52.800000+00:00,hello,',
      '2,2022-07-28 22:31:00.000000+00:00,"with, comma",',
      '3,2022-07-28 22:32:00.000000+00:00,"multi\nline",',
    ].join('\n'),
  );

  // DM
  put(
    `${messages}/c300/channel.json`,
    JSON.stringify({
      id: '300',
      type: 1,
      recipients: [userId, '999'],
    }),
  );
  put(
    `${messages}/c300/messages.csv`,
    [HEADER, '10,2022-08-01 00:00:00.000000+00:00,yo,'].join('\n'),
  );

  if (includeOrphanChannel) {
    put(
      `${messages}/c400/channel.json`,
      JSON.stringify({ id: '400', type: 0 }),
    );
    put(
      `${messages}/c400/messages.csv`,
      [HEADER, '20,2020-01-01 00:00:00.000000+00:00,orphan msg,'].join('\n'),
    );
  }

  if (includeGroupDm) {
    put(
      `${messages}/c500/channel.json`,
      JSON.stringify({
        id: '500',
        type: 3,
        recipients: [userId, '888', '777'],
      }),
    );
    put(`${messages}/c500/messages.csv`, HEADER);
  }

  if (includeMalformedCsv) {
    put(
      `${messages}/c600/channel.json`,
      JSON.stringify({
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
