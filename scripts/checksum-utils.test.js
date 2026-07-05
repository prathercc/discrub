import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { hashFile, hashDirectory, compareManifests, formatShaSums } from './checksum-utils.mjs';

// #225 — extension-integrity checksum helpers. These back both the release
// pipeline (prepare-store-release.js emits SHA256SUMS.txt + hashes.json) and
// the user-facing verify-extension.mjs PASS/FAIL check.

const sha256 = (content) => crypto.createHash('sha256').update(content).digest('hex');

describe('checksum-utils (#225)', () => {
  let fixtureDir;

  beforeAll(() => {
    fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checksum-utils-test-'));
    fs.writeFileSync(path.join(fixtureDir, 'background.js'), 'console.log("bg");');
    fs.mkdirSync(path.join(fixtureDir, 'assets'));
    fs.writeFileSync(path.join(fixtureDir, 'assets', 'app.js'), 'app-content');
    fs.mkdirSync(path.join(fixtureDir, 'META-INF'));
    fs.writeFileSync(path.join(fixtureDir, 'META-INF', 'mozilla.sf'), 'signature');
  });

  afterAll(() => {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  describe('hashFile', () => {
    it('returns the SHA-256 hex digest of the file contents', () => {
      expect(hashFile(path.join(fixtureDir, 'assets', 'app.js'))).toBe(sha256('app-content'));
    });
  });

  describe('hashDirectory', () => {
    it('maps every file to its hash using POSIX-relative paths', () => {
      const manifest = hashDirectory(fixtureDir);
      expect(manifest['background.js']).toBe(sha256('console.log("bg");'));
      expect(manifest['assets/app.js']).toBe(sha256('app-content'));
      expect(manifest['META-INF/mozilla.sf']).toBe(sha256('signature'));
    });

    it('excludes skipPrefixes subtrees', () => {
      const manifest = hashDirectory(fixtureDir, ['META-INF']);
      expect(manifest['META-INF/mozilla.sf']).toBeUndefined();
      expect(Object.keys(manifest)).toHaveLength(2);
    });
  });

  describe('compareManifests', () => {
    const expected = { 'background.js': 'aaa', 'assets/app.js': 'bbb' };

    it('passes when every file matches', () => {
      const result = compareManifests(expected, { 'background.js': 'aaa', 'assets/app.js': 'bbb' });
      expect(result.ok).toBe(true);
      expect(result.matched).toHaveLength(2);
    });

    it('flags hash mismatches', () => {
      const result = compareManifests(expected, { 'background.js': 'TAMPERED', 'assets/app.js': 'bbb' });
      expect(result.ok).toBe(false);
      expect(result.mismatched).toEqual(['background.js']);
    });

    it('flags files missing from the download', () => {
      const result = compareManifests(expected, { 'background.js': 'aaa' });
      expect(result.ok).toBe(false);
      expect(result.missing).toEqual(['assets/app.js']);
    });

    it('flags unexpected extra files — an injected payload must fail the check', () => {
      const result = compareManifests(expected, {
        'background.js': 'aaa',
        'assets/app.js': 'bbb',
        'assets/injected-malware.js': 'ccc',
      });
      expect(result.ok).toBe(false);
      expect(result.extra).toEqual(['assets/injected-malware.js']);
    });

    it("ignores Mozilla's META-INF/ signing block and Chrome's _metadata/ by default", () => {
      const result = compareManifests(expected, {
        'background.js': 'aaa',
        'assets/app.js': 'bbb',
        'META-INF/mozilla.sf': 'sig',
        'META-INF/manifest.mf': 'sig2',
        '_metadata/verified_contents.json': 'sig3',
      });
      expect(result.ok).toBe(true);
      expect(result.extra).toHaveLength(0);
    });

    it('does not ignore lookalike prefixes (META-INF-extra must still be flagged)', () => {
      const result = compareManifests(expected, {
        'background.js': 'aaa',
        'assets/app.js': 'bbb',
        'META-INF-extra/file.js': 'x',
      });
      expect(result.ok).toBe(false);
      expect(result.extra).toEqual(['META-INF-extra/file.js']);
    });
  });

  describe('formatShaSums', () => {
    it('renders shasum-compatible lines', () => {
      const out = formatShaSums([
        { hash: 'abc', name: 'chrome/discrub-chrome.zip' },
        { hash: 'def', name: 'firefox/discrub-firefox.zip' },
      ]);
      expect(out).toBe('abc  chrome/discrub-chrome.zip\ndef  firefox/discrub-firefox.zip\n');
    });
  });

  describe('round trip', () => {
    it('hashDirectory output passes compareManifests against itself, ignoring signing dirs', () => {
      const expectedManifest = hashDirectory(fixtureDir, ['META-INF']);
      const actualManifest = hashDirectory(fixtureDir); // "downloaded" copy still has META-INF
      const result = compareManifests(expectedManifest, actualManifest);
      expect(result.ok).toBe(true);
      expect(result.matched).toHaveLength(2);
    });

    it('detects single-byte tampering end-to-end', () => {
      const expectedManifest = hashDirectory(fixtureDir, ['META-INF']);
      const tamperedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checksum-tamper-'));
      try {
        fs.cpSync(fixtureDir, tamperedDir, { recursive: true });
        fs.appendFileSync(path.join(tamperedDir, 'assets', 'app.js'), '!');
        const result = compareManifests(expectedManifest, hashDirectory(tamperedDir));
        expect(result.ok).toBe(false);
        expect(result.mismatched).toEqual(['assets/app.js']);
      } finally {
        fs.rmSync(tamperedDir, { recursive: true, force: true });
      }
    });
  });
});
