# Security

## Reporting a vulnerability

- Preferred: open a private report at <https://github.com/pratherbytecraft/discrub/security/advisories/new>
- Or email **support@pratherbytecraft.com** with "Discrub security" in the subject.

Please include steps to reproduce and the extension version (Settings → About, or the store listing).
You'll get a response as quickly as possible; please allow time for a fix before public disclosure.

## Official downloads — the only places Discrub is published

| Browser | Official URL |
|---|---|
| Chrome | <https://chromewebstore.google.com/detail/plhdclenpaecffbcefjmpkkbdpkmhhbj> |
| Firefox | <https://addons.mozilla.org/firefox/addon/discrub/> |

Anything with the Discrub name at any other URL or extension ID is **not ours** — please report it
via the contacts above so a takedown can be filed.

## What the extension can (and cannot) do

Facts you can confirm yourself in the manifest of the installed extension:

- **Permissions: `storage` only** — used to persist your settings.
- **Host access: Discord domains only** (`discord.com`, `discordapp.com`, `discordapp.net`).
  The extension cannot read or contact any other site.
- **No remote code.** Everything that runs ships inside the reviewed store package; nothing is
  fetched and executed at runtime.
- **Discrub has no message-sending feature.** It deletes, edits, exports, and reacts on your behalf
  when you ask it to — it contains no capability to post messages to channels or DMs. Reports of
  "Discrub sent spam" have so far always traced to a stolen Discord token used by separate malware,
  or to an impostor extension (see official URLs above).

## Verify your download

Every release publishes checksums generated from the exact artifacts uploaded to the stores:

- [`store/SHA256SUMS.txt`](store/SHA256SUMS.txt) — SHA-256 of each upload zip.
- [`store/firefox/hashes.json`](store/firefox/hashes.json) / [`store/chrome/hashes.json`](store/chrome/hashes.json)
  — per-file SHA-256 manifest of the build.

**SHA-256 is used, not MD5** (MD5 is collision-broken and unsafe for tamper detection).

### 1. Check a zip artifact

```sh
shasum -a 256 discrub-firefox.zip          # macOS / Linux
certutil -hashfile discrub-firefox.zip SHA256   # Windows
```

Compare the output to `store/SHA256SUMS.txt` at the git tag for your version.

### 2. Check the signed Firefox `.xpi` from AMO

Mozilla re-signs uploads (adds a `META-INF/` folder), so the store `.xpi` never hashes identically
as a whole file. Instead, compare per-file with the bundled script — it unzips the `.xpi`, ignores
`META-INF/`, and diffs every remaining file's SHA-256 against the published manifest:

```sh
git clone https://github.com/pratherbytecraft/discrub && cd discrub
git checkout v<your-version>
node scripts/verify-extension.mjs /path/to/downloaded.xpi
```

`PASS` means every file is bit-for-bit identical to the published build.

### 3. Check an installed Chrome copy

Find your installed extension folder (`chrome://version` → Profile Path → `Extensions/plhdclenpaecffbcefjmpkkbdpkmhhbj/<version>/`), then:

```sh
node scripts/verify-extension.mjs "<that folder>" store/chrome/hashes.json
```

(Chrome adds a `_metadata/` folder on install; if it's reported as unexpected, that's Chrome's own
verified-contents block, not part of the package.)

### 4. Rebuild from source and diff

The strongest check — reproduce the build yourself from the tagged source:

```sh
git checkout v<your-version>
npm ci --legacy-peer-deps
npm run build:extension:firefox   # or :chrome
node scripts/verify-extension.mjs dist-extension-firefox
```

File contents should be identical to the store package; only zip-wrapper metadata may differ.
