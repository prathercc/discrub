/**
 * Smoke test against the real reference data package.
 *
 * Skipped unless DISCRUB_REAL_PACKAGE=1 is set, because it depends on a
 * file outside the repo. Use it locally to verify the parser handles
 * real Discord data packages end-to-end.
 *
 *   DISCRUB_REAL_PACKAGE=1 npx vitest run packageParseService.smoke
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import {
  loadChannelMessages,
  parsePackageZip,
  validatePackage,
} from './packageParseService';

const ZIP_PATH = '/tmp/test-package.zip';
const shouldRun = process.env.DISCRUB_REAL_PACKAGE === '1' && existsSync(ZIP_PATH);

describe.skipIf(!shouldRun)('parsePackageZip (real package)', () => {
  it('parses the reference package without errors', async () => {
    const buf = readFileSync(ZIP_PATH);
    const blob = new Blob([buf]);

    const parsed = await parsePackageZip(blob);

    expect(parsed.user.id).toBe('253286221395001345');
    expect(parsed.channels.length).toBeGreaterThan(50);
    expect(parsed.totalMessages).toBeGreaterThan(3000);

    const orphanCount = parsed.channels.filter((c) => c.isOrphan).length;
    expect(orphanCount).toBeGreaterThan(0);

    const result = validatePackage(parsed, '253286221395001345');
    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(false);
  });

  it('lazy-loads a large channel and returns the expected message count', async () => {
    // Regression for the "1 of 763 messages rendered" bug: the DM with
    // drewology#0 has 763 messages; if papaparse's newline handling
    // breaks on Discord's quoting, only the first row comes back.
    const buf = readFileSync(ZIP_PATH);
    const blob = new Blob([buf]);
    const parsed = await parsePackageZip(blob);

    const drew = parsed.channels.find(
      (c) => c.name?.includes('drewology') ?? false,
    );
    expect(drew, 'drewology DM channel should be in the package').toBeDefined();
    expect(drew!.messageCount).toBeGreaterThan(700);

    const messages = await loadChannelMessages(blob, drew!.id);
    expect(messages.length).toBe(drew!.messageCount);
  });
});
