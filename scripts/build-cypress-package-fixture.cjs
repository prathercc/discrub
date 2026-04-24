/**
 * Builds cypress/fixtures/test-package.zip — a minimal Discord data
 * package used by data-package-import.cy.ts.
 *
 * Keep in sync with the authenticated user fixture at
 * cypress/fixtures/user.json (id 111222333444555666) so validatePackage
 * returns readOnly=false for the default "matched user" test.
 *
 * Run on demand:  node scripts/build-cypress-package-fixture.cjs
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const OUT = path.resolve(__dirname, '../cypress/fixtures/test-package.zip');
const OUT_MISMATCH = path.resolve(
  __dirname,
  '../cypress/fixtures/test-package-mismatched.zip',
);
const OUT_INVALID = path.resolve(
  __dirname,
  '../cypress/fixtures/test-package-invalid.zip',
);

const HEADER = 'ID,Timestamp,Contents,Attachments';

function buildBasePackage({
  userId,
  username = 'discrub_tester',
  globalName = 'Discrub Tester',
}) {
  const zip = new JSZip();

  zip.file(
    'account/user.json',
    JSON.stringify({
      id: userId,
      username,
      global_name: globalName,
      avatar_hash: 'abc',
      email: 'test@example.com',
    }),
  );

  // Minimal 1x1 PNG so the avatar blob-url path is exercised in E2E.
  zip.file(
    'account/avatar.png',
    Buffer.from(
      '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D' +
        '494441547801636060000000000500010DA1A0390000000049454E44AE426082',
      'hex',
    ),
  );

  // Guild the user is still in (matches one in cypress/fixtures/guilds.json)
  zip.file(
    'servers/901000000000000001/guild.json',
    JSON.stringify({ id: '901000000000000001', name: 'Cypress Test Server' }),
  );

  // Guild the user has LEFT — triggers left-servers banner
  zip.file(
    'servers/999000000000000999/guild.json',
    JSON.stringify({ id: '999000000000000999', name: 'Abandoned Server' }),
  );

  zip.file(
    'messages/index.json',
    JSON.stringify({
      '200': 'general',
      '300': 'Direct Message with tester-friend#0',
      '400': 'Old Guild Channel',
    }),
  );

  // Guild text channel — writable
  zip.file(
    'messages/c200/channel.json',
    JSON.stringify({
      id: '200',
      type: 0,
      name: 'general',
      guild: { id: '901000000000000001', name: 'Cypress Test Server' },
    }),
  );
  zip.file(
    'messages/c200/messages.csv',
    [
      HEADER,
      '1001,2022-07-28 22:30:52.800000+00:00,hello world,',
      '1002,2022-07-28 22:31:00.000000+00:00,"with, comma",',
      '1003,2022-07-28 22:32:00.000000+00:00,"multi\nline content",',
      '1004,2022-08-01 10:00:00.000000+00:00,attached file,https://cdn.discordapp.com/attachments/200/1004/photo.png?ex=0',
    ].join('\n'),
  );

  // DM — writable
  zip.file(
    'messages/c300/channel.json',
    JSON.stringify({
      id: '300',
      type: 1,
      recipients: [userId, 'other-user'],
    }),
  );
  zip.file(
    'messages/c300/messages.csv',
    [HEADER, '2001,2022-09-01 00:00:00.000000+00:00,hey,'].join('\n'),
  );

  // Orphan channel (type 0 with no guild) — read-only
  zip.file(
    'messages/c400/channel.json',
    JSON.stringify({ id: '400', type: 0, name: 'Old Guild Channel' }),
  );
  zip.file(
    'messages/c400/messages.csv',
    [HEADER, '3001,2020-01-01 00:00:00.000000+00:00,old message,'].join('\n'),
  );

  // Activity dir — parser must NOT read this
  zip.file('activity/reporting.json', '{}');

  return zip;
}

async function writeZip(zip, filepath) {
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(filepath, buf);
  console.log(
    `  ${path.relative(process.cwd(), filepath)}  (${buf.length.toLocaleString()} bytes)`,
  );
}

(async () => {
  console.log('Building Cypress data-package fixtures:');
  // Matches cypress/fixtures/user.json id
  await writeZip(buildBasePackage({ userId: '111222333444555666' }), OUT);
  // Different user ID — triggers soft-warn read-only mode
  await writeZip(
    buildBasePackage({
      userId: '999999999999999999',
      username: 'someone_else',
      globalName: 'Someone Else',
    }),
    OUT_MISMATCH,
  );
  // Invalid: no account/user.json
  {
    const zip = new JSZip();
    zip.file('messages/index.json', '{}');
    await writeZip(zip, OUT_INVALID);
  }
})();
