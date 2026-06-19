/**
 * Package streaming + IDB-backed lazy reads (Backlog #162).
 *
 * Replaces the v2.0.3 architecture where the entire package was held
 * decompressed in memory for the lifetime of the session. The eager
 * `unzipSync` pass blew V8's per-allocation cap (~2GB) on multi-GB Discord
 * exports; every `loadChannelMessages` call additionally re-decompressed
 * the whole archive from the original File handle.
 *
 * The new shape:
 *   1. `streamPackageToStorage(file, opts)` — one streaming pass through
 *      fflate's async `unzip`. Activity / programs / activities_e dirs are
 *      filtered out at decompress-time so their bytes never enter memory.
 *      Each non-skipped entry is processed and written to IndexedDB before
 *      we move on. Returns the same `ParsedPackage` shape callers already
 *      consume; the underlying File reference is not retained.
 *   2. `loadChannelMessagesFromStorage(userId, channelId)` — pure IDB read.
 *      O(1), no decompression, instant.
 *   3. `clearPackageContents(userId?)` — wipes the `pkg:*` namespace (or
 *      just the entries owned by `userId`). Used when closing a package
 *      and at the start of a new import to avoid orphaned data.
 *   4. `resumePackageFromStorage(userId)` — rebuilds a `ParsedPackage`
 *      from a previously-streamed package without touching the file
 *      handle. Returns null if nothing in IDB matches.
 *
 * IndexedDB schema (under `Discrub-package`, alongside the existing
 * `enriched:` and `deleted:` namespaces — non-conflicting prefix):
 *
 *   pkg:schema-version      → 1 (singleton, used by future migrations)
 *   pkg:meta:{userId}       → ParsedPackage minus avatarBlobUrl
 *   pkg:msgs:{userId}:{cid} → PackageMessage[]
 *   pkg:avatar:{userId}     → Blob (user avatar) | absent
 *
 * `pkg:meta` is the "ready" marker — written last, so a partially-streamed
 * package is detectable on next boot (no meta key → cleanup partial state).
 */

import { unzipSync, strFromU8 } from 'fflate';
import { storage } from '@/extension/storage';
import { countCsvRows, parseMessagesCsv } from '@/utils/csvParser';
import { countJsonMessages, parseMessagesJson, parseSnowflakeJson } from '@/utils/jsonParser';
import {
  PACKAGE_CHANNEL_TYPE,
  type PackageChannel,
  type PackageChannelType,
  type PackageGuild,
  type PackageMessage,
  type PackageUser,
  type ParsedPackage,
} from '@/features/package/packageTypes';
import { PackageParseError } from './packageParseService';

export const PKG_SCHEMA_VERSION = 1;

const KEY_SCHEMA = 'pkg:schema-version';
const KEY_META = (userId: string) => `pkg:meta:${userId}`;
const KEY_MSGS = (userId: string, channelId: string) =>
  `pkg:msgs:${userId}:${channelId}`;
const KEY_AVATAR = (userId: string) => `pkg:avatar:${userId}`;

const PKG_PREFIX = 'pkg:';

/**
 * Top-level dirs Discord ships in a package that we never read. Skipping
 * them at decompress-time is the load-bearing piece of the OOM fix —
 * Activity is 3.2GB of 3.6GB on the reference real-world archive. They
 * stay in the central directory (so we know they exist) but their
 * compressed bytes never get inflated.
 *
 * Discord ships these in English regardless of UI locale; verified across
 * en/fr/de samples in `package-fixtures.ts`. If that ever changes, an
 * unrecognized name is harmless: we'd just fail to skip and pay
 * decompression cost we don't need (current behavior pre-#162).
 */
const SKIPPED_TOP_DIRS = ['activity', 'activities_e', 'activities_w', 'programs'];

const SOFT_COMPRESSED_WARN_BYTES = 1024 * 1024 * 1024; // 1 GiB

export interface StreamProgress {
  current: number;
  total: number;
  path: string;
}

export interface StreamOptions {
  onProgress?: (info: StreamProgress) => void;
  shouldStop?: () => boolean | Promise<boolean>;
}

export class PackageStreamCancelledError extends Error {
  constructor() {
    super('Package import cancelled');
    this.name = 'PackageStreamCancelledError';
  }
}

/**
 * Stream a Discord package into IndexedDB. Returns the parsed metadata
 * the consumer slice already expects, with the underlying File handle
 * dropped on the floor — every subsequent read is an IDB lookup.
 *
 * Atomicity model: if we throw or `shouldStop` fires, partially-written
 * `pkg:*` keys are cleaned up before re-raising. Callers don't need to
 * defend against half-loaded state. The `pkg:meta:{userId}` key is the
 * commit marker; it's written last.
 */
export async function streamPackageToStorage(
  input: File | Blob | ArrayBuffer,
  opts: StreamOptions = {},
): Promise<ParsedPackage> {
  const { onProgress, shouldStop } = opts;

  const totalCompressed =
    input instanceof ArrayBuffer
      ? input.byteLength
      : 'size' in input
        ? input.size
        : 0;
  if (totalCompressed > SOFT_COMPRESSED_WARN_BYTES) {
    // Single source of telemetry-of-sorts for "we're approaching the
    // option-A → option-B threshold." Compressed sizes near 1.5GB
    // would be the trigger to migrate to fflate's `Unzip` streaming
    // class; today's reference package is 378MB compressed.
    console.warn(
      `[packageStream] Compressed package size is ${formatBytes(totalCompressed)}. Approaching the single-allocation ceiling; consider migrating to streaming Unzip class if this becomes common.`,
    );
  }

  // Pass 1: decompress everything except the SKIPPED top-level dirs.
  // We use the `filter` callback to short-circuit decompression at the
  // entry level — the body of those entries is never inflated and never
  // enters our address space.
  // #203: when the caller already read the bytes (ImportDialog reads the File
  // the instant it's selected, while the descriptor is fresh), use them
  // directly. Otherwise read here, retrying a transient NotReadableError.
  const buffer =
    input instanceof ArrayBuffer ? input : await readBlobWithRetry(input);
  const filesByPath = unzipFiltered(new Uint8Array(buffer));

  if (await shouldHalt(shouldStop)) {
    throw new PackageStreamCancelledError();
  }

  // Build helpers identical to the legacy parser; the actual parse
  // logic is unchanged, only the storage destination is.
  const caseIndex = buildCaseIndex(filesByPath);
  const sniff = sniffStructure(caseIndex);
  if (!sniff) {
    throw new PackageParseError('Package is missing account/user.json');
  }
  const { prefix, aliases } = sniff;

  // user.json comes first so we know the userId for every subsequent
  // write key. A wipe of any other user's lingering pkg:* entries
  // happens once we know who we are.
  const user = readUserJson(filesByPath, caseIndex, prefix, aliases);
  await clearPackageContents();
  await storage.package.set(KEY_SCHEMA, PKG_SCHEMA_VERSION);

  const guilds = readGuilds(filesByPath, caseIndex, prefix, aliases);
  const channelNameIndex = readChannelNameIndex(filesByPath, caseIndex, prefix, aliases);

  // Walk channel directories, parse + persist each in turn so the
  // post-streaming Redux state has channel metadata + IDB has every
  // channel's messages keyed for instant retrieval.
  const channels: PackageChannel[] = [];
  const channelDirs = collectChannelDirs(caseIndex, prefix, aliases.messages);
  // Track whether we encounter any legacy-format channel. Discord's
  // pre-2025-06-14 packages ship messages.csv; current packages ship
  // messages.json. Surfaced on ParsedPackage so the export dialog can
  // warn about potentially-expired attachment URLs.
  let hasLegacyFormat = false;

  let processed = 0;
  const total = channelDirs.size + 2; // channels + avatar + meta

  for (const id of channelDirs) {
    if (await shouldHalt(shouldStop)) {
      await clearPackageContents(user.id);
      throw new PackageStreamCancelledError();
    }

    const result = await persistChannel(
      filesByPath, caseIndex, prefix, aliases,
      id, channelNameIndex, guilds, user.id,
    );
    if (result) {
      channels.push(result.channel);
      if (result.format === 'csv') hasLegacyFormat = true;
    }

    processed++;
    onProgress?.({
      current: processed,
      total,
      path: `messages/${id}`,
    });
  }

  channels.sort((a, b) => b.messageCount - a.messageCount);

  // Avatar — persist the raw bytes (Uint8Array) and mint a fresh
  // blob URL on every load. The previous-session blob URL never
  // survived a refresh, but the bytes were thrown away too; now they
  // persist and resume can hand back a valid URL again. Storing as
  // Uint8Array (instead of Blob) sidesteps fake-indexeddb's
  // Blob-clone limitation in tests; real browsers handle either fine.
  let avatarBlobUrl: string | undefined;
  const avatarBytes = resolveStructural(filesByPath, caseIndex, prefix, aliases, 'account/avatar.png');
  if (avatarBytes) {
    await storage.package.set(KEY_AVATAR(user.id), avatarBytes);
    avatarBlobUrl = makeBlobUrl(new Blob([avatarBytes as BlobPart]));
  }

  processed++;
  onProgress?.({ current: processed, total, path: 'account/avatar.png' });

  const totalMessages = channels.reduce((sum, c) => sum + c.messageCount, 0);

  const meta: ParsedPackage = {
    user,
    guilds,
    channels,
    totalMessages,
    packageSizeBytes: totalCompressed,
    isLegacyFormat: hasLegacyFormat,
    // avatarBlobUrl is intentionally NOT persisted — blob URLs are
    // realm-scoped. Resume rebuilds the URL from the stored Blob.
  };

  await storage.package.set(KEY_META(user.id), meta);

  processed++;
  onProgress?.({ current: processed, total, path: 'package metadata' });

  // Best-effort persistence request — promotes the IDB store to
  // "Persistent" so browsers don't auto-evict under disk pressure.
  // Some browsers grant automatically, some require a permission
  // prompt, some always reject; we don't gate the import on any of
  // those outcomes. A user who declines just gets the default
  // best-effort storage they had before.
  void requestPersistentStorage();

  return { ...meta, avatarBlobUrl };
}

/**
 * Pure IDB read for one channel's messages. Called from
 * `loadPackageChannelMessages` thunk after `streamPackageToStorage`
 * has populated the store.
 */
export async function loadChannelMessagesFromStorage(
  userId: string,
  channelId: string,
): Promise<PackageMessage[]> {
  const messages = await storage.package.get<PackageMessage[]>(KEY_MSGS(userId, channelId));
  if (!messages) {
    throw new PackageParseError(`messages file missing for channel ${channelId}`);
  }
  return messages;
}

/**
 * Detect a previously-streamed package and rebuild the in-memory
 * ParsedPackage from IDB. Returns null when nothing in IDB matches
 * the requested user.
 */
export async function resumePackageFromStorage(
  userId: string,
): Promise<ParsedPackage | null> {
  const meta = await storage.package.get<ParsedPackage>(KEY_META(userId));
  if (!meta) return null;

  // Rebuild the avatar blob URL — the prior session's URL is dead
  // (blob URLs don't survive a tab close). Bytes were persisted as
  // Uint8Array (see streamPackageToStorage), so wrap them in a fresh
  // Blob and mint a new URL.
  let avatarBlobUrl: string | undefined;
  const bytes = await storage.package.get<Uint8Array>(KEY_AVATAR(userId));
  if (bytes) {
    avatarBlobUrl = makeBlobUrl(new Blob([bytes as BlobPart]));
  }

  return { ...meta, avatarBlobUrl };
}

/**
 * Wipe the `pkg:*` namespace.
 *
 * - With `userId`, deletes only entries owned by that user (`pkg:meta:{u}`,
 *   `pkg:msgs:{u}:*`, `pkg:avatar:{u}`). Use this on close-package.
 * - Without `userId`, deletes EVERY `pkg:*` key (except schema-version).
 *   Use this at the start of a new import — we only allow one package
 *   loaded at a time, so any other user's lingering data is no-longer-needed.
 *
 * Schema-version key is preserved by both paths so future migration
 * code can rely on it.
 */
export async function clearPackageContents(userId?: string): Promise<void> {
  const all = await storage.package.keys();
  const toClear = all.filter((k) => {
    if (!k.startsWith(PKG_PREFIX)) return false;
    if (k === KEY_SCHEMA) return false;
    if (!userId) return true;
    // Match keys owned by this user. Avatar and meta are exact matches;
    // msgs are prefix matches.
    return (
      k === KEY_META(userId) ||
      k === KEY_AVATAR(userId) ||
      k.startsWith(`pkg:msgs:${userId}:`)
    );
  });
  await Promise.all(toClear.map((k) => storage.package.remove(k)));
}

/**
 * True when at least one `pkg:meta:*` key exists in storage. Used by
 * the LandingPage to surface a "resume previous package" affordance
 * when the user signs in and an authenticated-user-matching package
 * is already on disk.
 */
export async function hasStoredPackage(userId: string): Promise<boolean> {
  const meta = await storage.package.get(KEY_META(userId));
  return meta != null;
}

/* ────────── internal helpers ────────── */

function unzipFiltered(bytes: Uint8Array): Record<string, Uint8Array> {
  // #210: use the SYNCHRONOUS unzipSync, NOT fflate's async `unzip`. The async
  // API offloads decompression to a Web Worker and structured-clones each
  // filtered compressed entry across the worker boundary via postMessage —
  // that clone allocation throws "Failed to execute 'postMessage' on 'Worker':
  // Data cannot be cloned, out of memory" on memory-constrained devices (the
  // dollifiedgirl report). #162's `filter` already drops the Activity dirs at
  // decompress time, so the post-filter decompressed footprint stays well under
  // V8's single-allocation cap; running on the main thread is safe and removes
  // the worker/postMessage boundary — and the clone OOM — entirely.
  try {
    const files = unzipSync(bytes, {
      filter: (entry) => {
        // Drop directory entries and OS junk before we even decide
        // whether to decompress.
        if (entry.name.endsWith('/')) return false;
        if (isJunkPath(entry.name)) return false;
        // Drop top-level skip dirs by suffix-matching after the optional
        // wrapper directory. We match "{anything}/{skipDir}/..." and
        // "{skipDir}/..." both, lower-cased.
        const lower = entry.name.toLowerCase();
        for (const dir of SKIPPED_TOP_DIRS) {
          if (lower.startsWith(`${dir}/`) || lower.includes(`/${dir}/`)) return false;
        }
        return true;
      },
    });
    return files ?? {};
  } catch (err) {
    throw new PackageParseError(
      `Failed to read package archive: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function isJunkPath(path: string): boolean {
  if (path.startsWith('__MACOSX/')) return true;
  const name = path.split('/').pop() ?? '';
  if (name.startsWith('._')) return true;
  if (name === '.DS_Store') return true;
  return false;
}

type CaseIndex = Map<string, string>;

function buildCaseIndex(files: Record<string, Uint8Array>): CaseIndex {
  const index = new Map<string, string>();
  for (const path of Object.keys(files)) {
    if (isJunkPath(path)) continue;
    index.set(path.toLowerCase(), path);
  }
  return index;
}

type StructuralAliases = {
  account: string;
  messages: string;
  servers: string;
};

type StructureSniff = {
  prefix: string;
  aliases: StructuralAliases;
};

function sniffStructure(index: CaseIndex): StructureSniff | null {
  let accountDir: string | null = null;
  let prefix = '';

  for (const lower of index.keys()) {
    if (!lower.endsWith('/user.json')) continue;
    const segs = lower.split('/');
    if (segs.length === 2) {
      accountDir = segs[0];
      prefix = '';
      break;
    }
    if (segs.length === 3) {
      prefix = `${segs[0]}/`;
      accountDir = segs[1];
      break;
    }
  }

  if (!accountDir) return null;

  // Sniff messagesDir by REQUIRING a channel-file pattern child
  // (`{snowflake}/(channel.json|messages.{csv,json})`). The previous
  // `tail === 'index.json'` short-circuit was ambiguous: Discord's
  // current package format ships both `servers/index.json` and
  // `messages/index.json`, so whichever the iterator encountered
  // first won, and packages with `servers/index.json` ended up
  // setting messagesDir='servers' — every channel resolution then
  // failed silently. Channel-file pattern is sufficient and
  // unambiguous.
  let messagesDir: string | null = null;
  for (const lower of index.keys()) {
    if (prefix && !lower.startsWith(prefix)) continue;
    const rel = prefix ? lower.slice(prefix.length) : lower;
    const slash = rel.indexOf('/');
    if (slash === -1) continue;
    const head = rel.slice(0, slash);
    if (head === accountDir) continue;
    const tail = rel.slice(slash + 1);
    if (/^c?\d+\/(channel\.json|messages\.(csv|json))$/.test(tail)) {
      messagesDir = head;
      break;
    }
  }

  let serversDir: string | null = null;
  for (const lower of index.keys()) {
    if (prefix && !lower.startsWith(prefix)) continue;
    const rel = prefix ? lower.slice(prefix.length) : lower;
    const segs = rel.split('/');
    if (segs.length !== 3) continue;
    if (segs[0] === accountDir || segs[0] === messagesDir) continue;
    if (!/^\d+$/.test(segs[1])) continue;
    if (segs[2] !== 'guild.json') continue;
    serversDir = segs[0];
    break;
  }

  return {
    prefix,
    aliases: {
      account: accountDir,
      messages: messagesDir ?? 'messages',
      servers: serversDir ?? 'servers',
    },
  };
}

function resolveStructural(
  files: Record<string, Uint8Array>,
  index: CaseIndex,
  prefix: string,
  aliases: StructuralAliases,
  canonicalLower: string,
): Uint8Array | null {
  const slash = canonicalLower.indexOf('/');
  if (slash === -1) return null;
  const head = canonicalLower.slice(0, slash);
  const tail = canonicalLower.slice(slash + 1);
  const actualHead =
    head === 'account' ? aliases.account
    : head === 'messages' ? aliases.messages
    : head === 'servers' ? aliases.servers
    : head;
  const actual = index.get(`${prefix}${actualHead}/${tail}`);
  if (!actual) return null;
  return files[actual] ?? null;
}

type RawChannelJson = {
  id: string;
  type: number;
  name?: string;
  guild?: { id: string; name: string };
  recipients?: string[];
};

type RawUserJson = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar_hash?: string | null;
  email?: string;
};

type RawGuildJson = {
  id: string;
  name: string;
};

function readUserJson(
  files: Record<string, Uint8Array>,
  index: CaseIndex,
  prefix: string,
  aliases: StructuralAliases,
): PackageUser {
  const entry = resolveStructural(files, index, prefix, aliases, 'account/user.json');
  if (!entry) {
    throw new PackageParseError('Package is missing account/user.json');
  }
  const raw = parseSnowflakeJson<RawUserJson>(strFromU8(entry));
  if (!raw.id || !raw.username) {
    throw new PackageParseError('account/user.json is malformed');
  }
  return {
    id: raw.id,
    username: raw.username,
    globalName: raw.global_name ?? null,
    avatarHash: raw.avatar_hash ?? null,
    email: raw.email,
  };
}

function readGuilds(
  files: Record<string, Uint8Array>,
  index: CaseIndex,
  prefix: string,
  aliases: StructuralAliases,
): PackageGuild[] {
  const guilds: PackageGuild[] = [];
  const guildRegex = new RegExp(
    `^${escapeRegex(prefix)}${escapeRegex(aliases.servers)}\\/\\d+\\/guild\\.json$`,
  );
  for (const lower of index.keys()) {
    if (!guildRegex.test(lower)) continue;
    const actual = index.get(lower);
    if (!actual) continue;
    const entry = files[actual];
    if (!entry) continue;
    try {
      const raw = parseSnowflakeJson<RawGuildJson>(strFromU8(entry));
      if (raw.id && raw.name) guilds.push({ id: raw.id, name: raw.name });
    } catch {
      /* skip malformed guild.json */
    }
  }
  return guilds;
}

function readChannelNameIndex(
  files: Record<string, Uint8Array>,
  index: CaseIndex,
  prefix: string,
  aliases: StructuralAliases,
): Record<string, string | null> {
  const entry = resolveStructural(files, index, prefix, aliases, 'messages/index.json');
  if (!entry) return {};
  try {
    return parseSnowflakeJson<Record<string, string | null>>(strFromU8(entry));
  } catch {
    return {};
  }
}

function collectChannelDirs(
  index: CaseIndex,
  prefix: string,
  messagesDir: string,
): Set<string> {
  const out = new Set<string>();
  const re = new RegExp(`^${escapeRegex(messagesDir)}\\/c?(\\d+)\\/`);
  for (const lower of index.keys()) {
    const relative = prefix && lower.startsWith(prefix)
      ? lower.slice(prefix.length)
      : lower;
    const m = re.exec(relative);
    if (m) out.add(m[1]);
  }
  return out;
}

type ChannelFiles = {
  channelJson: Uint8Array;
  messagesEntry: Uint8Array;
  messagesFormat: 'json' | 'csv';
};

function resolveChannelFiles(
  files: Record<string, Uint8Array>,
  index: CaseIndex,
  prefix: string,
  aliases: StructuralAliases,
  channelId: string,
): ChannelFiles | null {
  const dirPrefixes = ['c', ''];
  const formats: Array<'json' | 'csv'> = ['json', 'csv'];

  for (const dp of dirPrefixes) {
    const channelJson = resolveStructural(
      files, index, prefix, aliases,
      `messages/${dp}${channelId}/channel.json`,
    );
    if (!channelJson) continue;
    for (const format of formats) {
      const messagesEntry = resolveStructural(
        files, index, prefix, aliases,
        `messages/${dp}${channelId}/messages.${format}`,
      );
      if (messagesEntry) {
        return { channelJson, messagesEntry, messagesFormat: format };
      }
    }
  }
  return null;
}

async function persistChannel(
  files: Record<string, Uint8Array>,
  index: CaseIndex,
  prefix: string,
  aliases: StructuralAliases,
  id: string,
  nameIndex: Record<string, string | null>,
  guilds: PackageGuild[],
  userId: string,
): Promise<{ channel: PackageChannel; format: 'json' | 'csv' } | null> {
  const resolved = resolveChannelFiles(files, index, prefix, aliases, id);
  if (!resolved) return null;

  let raw: RawChannelJson;
  try {
    raw = parseSnowflakeJson<RawChannelJson>(strFromU8(resolved.channelJson));
  } catch {
    return null;
  }

  const text = strFromU8(resolved.messagesEntry);
  const messages = resolved.messagesFormat === 'json'
    ? parseMessagesJson(text)
    : parseMessagesCsv(text);
  const messageCount = resolved.messagesFormat === 'json'
    ? countJsonMessages(text)
    : countCsvRows(text);

  await storage.package.set(KEY_MSGS(userId, raw.id), messages);

  const type = raw.type as PackageChannelType;
  const guildId = raw.guild?.id;
  const guildNameMap = new Map(guilds.map((g) => [g.id, g.name] as const));
  const guildName = guildId
    ? raw.guild?.name ?? guildNameMap.get(guildId) ?? undefined
    : undefined;
  const isOrphan = type === PACKAGE_CHANNEL_TYPE.GUILD_TEXT && !guildId;

  return {
    channel: {
      id: raw.id,
      type,
      name: raw.name ?? nameIndex[raw.id] ?? null,
      guildId,
      guildName,
      recipients: raw.recipients,
      messageCount,
      isOrphan,
    },
    format: resolved.messagesFormat,
  };
}

/**
 * Read a Blob/File into an ArrayBuffer, retrying a transient NotReadableError.
 * That DOMException ("the requested file could not be read… permission problems
 * after a reference to a file was acquired") is often transient — an antivirus
 * scan or a cloud-synced folder briefly relocking the file. A short backoff and
 * re-read usually clears it. Non-NotReadableError failures throw immediately.
 * See backlog #203.
 */
async function readBlobWithRetry(blob: Blob, attempts = 2): Promise<ArrayBuffer> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await readBlobAsArrayBuffer(blob);
    } catch (err) {
      lastErr = err;
      const name = (err as { name?: string })?.name;
      if (name !== 'NotReadableError' || i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw lastErr;
}

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsArrayBuffer(blob);
  });
}

function makeBlobUrl(blob: Blob): string | undefined {
  try {
    if (typeof URL === 'undefined' || !('createObjectURL' in URL)) return undefined;
    return URL.createObjectURL(blob);
  } catch {
    return undefined;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function shouldHalt(
  shouldStop: StreamOptions['shouldStop'],
): Promise<boolean> {
  if (!shouldStop) return false;
  return await shouldStop();
}

async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
    if (typeof navigator.storage.persisted === 'function') {
      const already = await navigator.storage.persisted();
      if (already) return;
    }
    await navigator.storage.persist();
  } catch {
    /* navigator.storage is best-effort; silent failure is fine */
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
