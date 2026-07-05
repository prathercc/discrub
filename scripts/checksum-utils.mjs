import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Shared SHA-256 helpers for extension-integrity checksums (#225).
 * Used by prepare-store-release.js (emission) and verify-extension.mjs
 * (user-facing verification). SHA-256, not MD5 — MD5 is collision-broken
 * and unsafe for tamper detection.
 */

/** SHA-256 hex digest of a file. */
export function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

/**
 * Walk a directory and return { 'relative/posix/path': sha256hex } for every
 * file. Paths are POSIX-style regardless of platform so manifests are
 * portable. Entries in `skipPrefixes` (POSIX-relative) are excluded.
 */
export function hashDirectory(dir, skipPrefixes = []) {
  const manifest = {};
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(current, entry.name);
      const rel = path.relative(dir, abs).split(path.sep).join('/');
      if (skipPrefixes.some((p) => rel === p || rel.startsWith(`${p}/`))) continue;
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        manifest[rel] = hashFile(abs);
      }
    }
  };
  walk(dir);
  return manifest;
}

/**
 * Compare an actual manifest (from an unzipped .xpi / extension dir) against
 * the expected manifest we published. Returns
 * { ok, matched, mismatched: [path], missing: [path], extra: [path] }.
 * `ignorePrefixes` entries are dropped from the actual side before comparing:
 * 'META-INF' is Mozilla's signing block added by AMO after upload, '_metadata'
 * is Chrome's verified-contents block added on install.
 */
export function compareManifests(expected, actual, ignorePrefixes = ['META-INF', '_metadata']) {
  const isIgnored = (rel) =>
    ignorePrefixes.some((p) => rel === p || rel.startsWith(`${p}/`));

  const matched = [];
  const mismatched = [];
  const missing = [];
  const extra = [];

  for (const [rel, hash] of Object.entries(expected)) {
    if (!(rel in actual)) missing.push(rel);
    else if (actual[rel] !== hash) mismatched.push(rel);
    else matched.push(rel);
  }
  for (const rel of Object.keys(actual)) {
    if (isIgnored(rel)) continue;
    if (!(rel in expected)) extra.push(rel);
  }

  return {
    ok: mismatched.length === 0 && missing.length === 0 && extra.length === 0,
    matched,
    mismatched,
    missing,
    extra,
  };
}

/** Render a SHA256SUMS.txt body (same layout as `shasum -a 256` output). */
export function formatShaSums(entries) {
  return entries.map(({ hash, name }) => `${hash}  ${name}`).join('\n') + '\n';
}
