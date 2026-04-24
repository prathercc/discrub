import JSZip from 'jszip';

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
  } = opts;

  const rootZip = new JSZip();
  const zip = wrapperDir ? rootZip.folder(wrapperDir)! : rootZip;
  if (wrapperDir) {
    rootZip.file('__MACOSX/._' + wrapperDir, 'junk');
    rootZip.file(`${wrapperDir}/.DS_Store`, 'junk');
  }

  if (!omitUserJson) {
    zip.file(
      'account/user.json',
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

  zip.file(
    'servers/100/guild.json',
    JSON.stringify({ id: '100', name: 'Test Guild' }),
  );

  zip.file(
    'messages/index.json',
    JSON.stringify({
      '200': 'general',
      '300': 'Direct Message with friend#0',
      '400': null,
      '500': null,
    }),
  );

  // Guild text channel
  zip.file(
    'messages/c200/channel.json',
    JSON.stringify({
      id: '200',
      type: 0,
      name: 'general',
      guild: { id: '100', name: 'Test Guild' },
    }),
  );
  zip.file(
    'messages/c200/messages.csv',
    [
      HEADER,
      '1,2022-07-28 22:30:52.800000+00:00,hello,',
      '2,2022-07-28 22:31:00.000000+00:00,"with, comma",',
      '3,2022-07-28 22:32:00.000000+00:00,"multi\nline",',
    ].join('\n'),
  );

  // DM
  zip.file(
    'messages/c300/channel.json',
    JSON.stringify({
      id: '300',
      type: 1,
      recipients: [userId, '999'],
    }),
  );
  zip.file(
    'messages/c300/messages.csv',
    [HEADER, '10,2022-08-01 00:00:00.000000+00:00,yo,'].join('\n'),
  );

  if (includeOrphanChannel) {
    zip.file(
      'messages/c400/channel.json',
      JSON.stringify({ id: '400', type: 0 }),
    );
    zip.file(
      'messages/c400/messages.csv',
      [HEADER, '20,2020-01-01 00:00:00.000000+00:00,orphan msg,'].join('\n'),
    );
  }

  if (includeGroupDm) {
    zip.file(
      'messages/c500/channel.json',
      JSON.stringify({
        id: '500',
        type: 3,
        recipients: [userId, '888', '777'],
      }),
    );
    zip.file('messages/c500/messages.csv', HEADER);
  }

  if (includeMalformedCsv) {
    zip.file(
      'messages/c600/channel.json',
      JSON.stringify({
        id: '600',
        type: 0,
        name: 'broken',
        guild: { id: '100', name: 'Test Guild' },
      }),
    );
    zip.file(
      'messages/c600/messages.csv',
      `${HEADER}\n1,2022-07-28 22:30:52.800000+00:00,"unterminated,`,
    );
  }

  if (includeActivity) {
    // Large payload that should NEVER be read into memory by the parser.
    zip.file('activity/reporting.json', 'x'.repeat(1024));
    zip.file('activities_e/events.json', 'y'.repeat(512));
  }

  return rootZip.generateAsync({ type: 'blob' });
}
