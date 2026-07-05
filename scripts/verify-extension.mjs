#!/usr/bin/env node
/**
 * verify-extension.mjs — self-serve extension integrity check (#225).
 *
 * Confirms that a downloaded Discrub package is bit-for-bit what was built
 * from this repository, by hashing every file and comparing against the
 * published per-file manifest. Mozilla re-signs uploads (adds a META-INF/
 * folder), so the signed .xpi never hashes identically as a whole — this
 * script ignores META-INF/ and compares everything else, which is the same
 * check as diffing the .xpi against the source build.
 *
 * Usage:
 *   node scripts/verify-extension.mjs <path-to.xpi|.zip|extracted-dir> [manifest.json]
 *
 * The manifest defaults to store/firefox/hashes.json. For a Chrome check,
 * point it at store/chrome/hashes.json and at your installed extension
 * directory (chrome://version → Profile Path → Extensions/<id>/<version>).
 *
 * Exit code 0 = PASS, 1 = FAIL or error.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { hashDirectory, compareManifests } from './checksum-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function fail(msg) {
  console.error(`\nFAIL: ${msg}`);
  process.exit(1);
}

const [, , target, manifestArg] = process.argv;
if (!target) {
  console.error('Usage: node scripts/verify-extension.mjs <path-to.xpi|.zip|extracted-dir> [manifest.json]');
  process.exit(1);
}

const manifestPath = manifestArg
  ? path.resolve(manifestArg)
  : path.join(rootDir, 'store', 'firefox', 'hashes.json');

if (!fs.existsSync(manifestPath)) {
  fail(`Manifest not found at ${manifestPath}. Pass one explicitly, or fetch hashes.json for your version from the repo/release.`);
}
if (!fs.existsSync(target)) {
  fail(`No such file or directory: ${target}`);
}

const parsedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
// hashes.json wraps the map in { name, version, algorithm, files }; also
// accept a bare { path: hash } map.
const expected = parsedManifest.files ?? parsedManifest;
if (parsedManifest.version) {
  console.log(`Manifest: discrub v${parsedManifest.version} (${parsedManifest.algorithm || 'sha256'})`);
}

// Accept either an extracted directory or an archive (.xpi/.zip are the same
// format). Archives are extracted with the system `unzip` into a temp dir.
let dirToHash = target;
let tempDir = null;
if (fs.statSync(target).isFile()) {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discrub-verify-'));
  try {
    execFileSync('unzip', ['-q', path.resolve(target), '-d', tempDir], { stdio: 'pipe' });
  } catch (e) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fail(`Could not unzip ${target} (is \`unzip\` installed?). You can extract it manually and pass the folder instead.`);
  }
  dirToHash = tempDir;
}

try {
  const actual = hashDirectory(dirToHash);
  const result = compareManifests(expected, actual);

  console.log(`Compared ${Object.keys(expected).length} expected files against ${target}`);
  console.log(`  matched:    ${result.matched.length}`);
  if (result.mismatched.length) {
    console.log(`  MISMATCHED: ${result.mismatched.length}`);
    for (const f of result.mismatched) console.log(`    ✗ ${f}`);
  }
  if (result.missing.length) {
    console.log(`  MISSING:    ${result.missing.length}`);
    for (const f of result.missing) console.log(`    ✗ ${f}`);
  }
  if (result.extra.length) {
    console.log(`  UNEXPECTED: ${result.extra.length} (not in the published build)`);
    for (const f of result.extra) console.log(`    ✗ ${f}`);
  }

  if (result.ok) {
    console.log('\nPASS — every file matches the published build (Mozilla\'s META-INF/ signing folder ignored).');
  } else {
    fail('the package does NOT match the published build. If you downloaded it from an official store URL (see SECURITY.md), please report this.');
  }
} finally {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
}
