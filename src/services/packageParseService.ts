import { unzipSync, strFromU8 } from 'fflate';
import { countCsvRows, parseMessagesCsv } from '@/utils/csvParser';
import { countJsonMessages, parseMessagesJson } from '@/utils/jsonParser';
import {
  PACKAGE_CHANNEL_TYPE,
  type PackageChannel,
  type PackageChannelType,
  type PackageGuild,
  type PackageMessage,
  type PackageUser,
  type PackageValidationResult,
  type ParsedPackage,
} from '@/features/package/packageTypes';

// Discord exports its activity / programs dirs in English regardless of UI
// locale (verified across the en/fr/de samples in `package-fixtures.ts`).
// If that ever changes for some locale, the fallback is harmless: an
// unrecognized dir name simply won't match the channel-or-skipped predicates
// below, so nothing is mis-parsed — at worst a no-op iteration.
const SKIPPED_PREFIXES = ['activity/', 'activities_e/', 'activities_w/', 'programs/'];

/**
 * Build the dynamic channel-dir regex from the locale-resolved messages
 * dir name. Discord's structural directories localize (`messages/` →
 * `nachrichten/` etc.), so the regex can't be a static literal — see
 * Backlog #157.
 *
 * The `c?` allows both legacy `c{snowflake}/` and current `{snowflake}/`
 * channel directories. Discord made the `c` prefix optional in their
 * 2025-06-14 export-format change (#163); older packages still ship with
 * the prefix and must keep parsing.
 */
function buildChannelDirRegex(messagesDir: string): RegExp {
  return new RegExp(`^${escapeRegex(messagesDir)}\\/c?(\\d+)\\/`);
}

/**
 * Paths the OS (usually macOS) injects when zipping that we want to
 * ignore entirely: resource-fork metadata and directory-hint files.
 */
function isJunkPath(path: string): boolean {
  if (path.startsWith('__MACOSX/')) return true;
  const name = path.split('/').pop() ?? '';
  if (name.startsWith('._')) return true;
  if (name === '.DS_Store') return true;
  return false;
}

/**
 * Thin wrapper around fflate's `Unzipped` shape. We swapped from JSZip to
 * fflate (#158) because JSZip can't read ZIP64 archives — Discord's larger
 * packages use ZIP64 once they exceed 65,535 entries OR 4 GB total, and
 * JSZip throws "expected N records in central dir, got 0" on those. fflate
 * handles ZIP64 natively. The shape is a flat path → bytes map; directory
 * entries (paths ending `/`) are dropped, only file entries appear.
 */
type PackageZip = {
  /** Flat file map keyed by ZIP entry path. */
  files: Record<string, Uint8Array>;
};

async function loadZip(file: File | Blob): Promise<PackageZip> {
  const buffer = await readBlobAsArrayBuffer(file);
  const files = unzipSync(new Uint8Array(buffer));
  return { files };
}

/**
 * Read a Blob's bytes into an ArrayBuffer. Real browsers have shipped
 * `Blob.prototype.arrayBuffer` since 2019 (Chrome 76 / Safari 14 / FF 69)
 * — that's the fast path. jsdom does not expose it, so we fall through
 * to FileReader which jsdom supports correctly. Avoiding `Response(blob)`
 * here is deliberate: jsdom's Response stringifies Blob inputs to
 * `"[object Blob]"`, silently corrupting the bytes.
 */
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

/**
 * Map of lowercased ZIP entry paths to their actual cased path. Discord's
 * package directory structure has shipped with both lowercase and capitalized
 * top-level dirs (`Account/` vs `account/`); we normalize lookups by always
 * keying off lowercase and resolving back to the real path via this index.
 */
type CaseIndex = Map<string, string>;

function buildCaseIndex(zip: PackageZip): CaseIndex {
  const index = new Map<string, string>();
  for (const path of Object.keys(zip.files)) {
    if (isJunkPath(path)) continue;
    index.set(path.toLowerCase(), path);
  }
  return index;
}

/**
 * Returns the raw bytes for a ZIP entry, or null if the path isn't in the
 * index. Callers convert to string (`strFromU8`) or Blob (`new Blob([bytes])`)
 * as needed.
 */
function resolveFile(zip: PackageZip, index: CaseIndex, lowerPath: string): Uint8Array | null {
  const actual = index.get(lowerPath);
  if (!actual) return null;
  const bytes = zip.files[actual];
  return bytes ?? null;
}

/**
 * Maps the three canonical structural-directory names Discord uses in the
 * English locale to whatever the actual top-level dir is in *this* package.
 * Built once per parse via `sniffStructure` and threaded through every
 * lookup helper. See Backlog #157.
 */
type StructuralAliases = {
  /** Holds `user.json` and `avatar.png`. English: `account`. */
  account: string;
  /** Holds `index.json` + `c{id}/{channel.json,messages.csv}` subdirs. English: `messages`. */
  messages: string;
  /** Holds `{guildId}/guild.json` subdirs. English: `servers`. */
  servers: string;
};

/**
 * Translate a canonical (English) structural path like `account/user.json`
 * into the locale-specific path for this package and resolve it through the
 * case-insensitive index. Callers should always pass the English form so
 * call sites stay readable; this helper is the single point that knows
 * about localization.
 */
function resolveStructural(
  zip: PackageZip,
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
  return resolveFile(zip, index, `${prefix}${actualHead}/${tail}`);
}

type StructureSniff = {
  prefix: string;
  aliases: StructuralAliases;
};

/**
 * Identify the package's top-level structural dirs by their *contents*,
 * not their names — Discord ships exports using the user's UI locale, so
 * `account/`/`messages/`/`servers/` may be `compte/`/`nachrichten/`/`servidores/`
 * etc. Also detects the optional single wrapper directory some users end
 * up with when they re-zip the extracted export (#146 covered the case
 * dimension; this covers the locale dimension — Backlog #157).
 *
 * Returns `null` if the package has no recognizable Discord structure
 * (callers throw a friendlier error from there).
 */
function sniffStructure(index: CaseIndex): StructureSniff | null {
  // The account dir is the most reliable anchor — every Discord package
  // has exactly one `*/user.json`, and its location pins both the
  // wrapper prefix (depth 2) vs. root layout (depth 1) and the locale
  // name of the account dir.
  let accountDir: string | null = null;
  let prefix = '';

  for (const lower of index.keys()) {
    if (!lower.endsWith('/user.json')) continue;
    const segs = lower.split('/');
    if (segs.length === 2) {
      // {accountDir}/user.json — no wrapper.
      accountDir = segs[0];
      prefix = '';
      break;
    }
    if (segs.length === 3) {
      // {wrapper}/{accountDir}/user.json — single wrapper.
      prefix = `${segs[0]}/`;
      accountDir = segs[1];
      break;
    }
    // Deeper than depth 2 isn't a layout we recognize; skip and keep scanning
    // in case a shallower match exists later in the iteration.
  }

  if (!accountDir) return null;

  // Sniff the messages dir at the same depth as account: look for
  // `{prefix}{messagesDir}/index.json` OR `{prefix}{messagesDir}/c{id}/`
  // children. `index.json` is the cleaner anchor; the channel-dir
  // fallback matters for unusually-pruned packages where the user
  // deleted index.json but left the channel dirs intact.
  let messagesDir: string | null = null;
  for (const lower of index.keys()) {
    if (prefix && !lower.startsWith(prefix)) continue;
    const rel = prefix ? lower.slice(prefix.length) : lower;
    const slash = rel.indexOf('/');
    if (slash === -1) continue;
    const head = rel.slice(0, slash);
    if (head === accountDir) continue;
    const tail = rel.slice(slash + 1);
    // Anchor on the file *inside* the channel dir (channel.json or
     // messages.{csv,json}), not just on the dir-name shape. The bare
     // `^c?\d+\/` form is ambiguous with the servers dir's `{snowflake}/`
     // children (`servers/100/guild.json` would otherwise match), so we
     // require the discriminating filename to be present.
    if (
      tail === 'index.json' ||
      /^c?\d+\/(channel\.json|messages\.(csv|json))$/.test(tail)
    ) {
      messagesDir = head;
      break;
    }
  }

  // Sniff the servers dir similarly: look for `{prefix}{serversDir}/{digits}/guild.json`.
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
      // Fall back to English names if the bucket isn't found — a package
      // with no servers (DM-only export) legitimately has no servers dir,
      // and a package with no messages would fail downstream anyway. The
      // fallback keeps regex construction valid for those cases.
      messages: messagesDir ?? 'messages',
      servers: serversDir ?? 'servers',
    },
  };
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

export class PackageParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackageParseError';
  }
}

/**
 * Reads the package ZIP and extracts metadata for every channel + guild,
 * without loading message bodies. Use `loadChannelMessages` to read CSV
 * content lazily when a channel is selected.
 */
export async function parsePackageZip(file: File | Blob): Promise<ParsedPackage> {
  const zip = await loadZip(file);
  const caseIndex = buildCaseIndex(zip);
  const sniff = sniffStructure(caseIndex);
  if (!sniff) {
    throw new PackageParseError('Package is missing account/user.json');
  }
  const { prefix, aliases } = sniff;

  const user = await readUserJson(zip, caseIndex, prefix, aliases);
  const guilds = await readGuilds(zip, caseIndex, prefix, aliases);
  const channelNameIndex = await readChannelNameIndex(zip, caseIndex, prefix, aliases);
  const channels = await readChannels(zip, caseIndex, guilds, channelNameIndex, prefix, aliases);

  const totalMessages = channels.reduce((sum, c) => sum + c.messageCount, 0);
  const avatarBlobUrl = await readAvatarBlobUrl(zip, caseIndex, prefix, aliases);

  return {
    user,
    guilds,
    channels,
    totalMessages,
    packageSizeBytes: 'size' in file ? file.size : 0,
    avatarBlobUrl,
  };
}

/**
 * Reads and parses a single channel's messages file on demand.
 * Callers (the packageSlice) cache parsed results keyed by channel ID.
 *
 * Routes through the same `resolveChannelFiles` helper as the initial
 * scan so the prefix + format precedence is identical: legacy `c{id}/`
 * directory before bare `{id}/`, and current `messages.json` before
 * legacy `messages.csv` (#163).
 */
export async function loadChannelMessages(
  file: File | Blob,
  channelId: string,
): Promise<PackageMessage[]> {
  const zip = await loadZip(file);
  const caseIndex = buildCaseIndex(zip);
  const sniff = sniffStructure(caseIndex);
  if (!sniff) {
    throw new PackageParseError(`messages file missing for channel ${channelId}`);
  }
  const { prefix, aliases } = sniff;
  const files = resolveChannelFiles(zip, caseIndex, prefix, aliases, channelId);
  if (!files) {
    throw new PackageParseError(`messages file missing for channel ${channelId}`);
  }
  const text = strFromU8(files.messagesEntry);
  return files.messagesFormat === 'json'
    ? parseMessagesJson(text)
    : parseMessagesCsv(text);
}

/**
 * Validates a parsed package against the authenticated user (if any).
 *
 * - No authenticated user → soft-ok, read-only (analytics + browse only).
 * - User ID matches → full capabilities (delete/edit/export rehydration).
 * - User ID mismatch → soft-warn, read-only.
 */
export function validatePackage(
  parsed: ParsedPackage,
  authenticatedUserId: string | null,
): PackageValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!parsed.user?.id) {
    errors.push('Package is missing user identity (account/user.json).');
    return { ok: false, readOnly: true, warnings, errors };
  }

  if (!authenticatedUserId) {
    warnings.push(
      'Not signed in — analytics and browsing are available, but deleting or editing messages requires authentication.',
    );
    return { ok: true, readOnly: true, warnings, errors };
  }

  if (parsed.user.id !== authenticatedUserId) {
    warnings.push(
      `This package belongs to a different user (${parsed.user.username}). Read-only mode: deletion and editing are disabled.`,
    );
    return { ok: true, readOnly: true, warnings, errors };
  }

  return { ok: true, readOnly: false, warnings, errors };
}

/* ────────── internal helpers ────────── */

async function readUserJson(
  zip: PackageZip,
  index: CaseIndex,
  prefix: string,
  aliases: StructuralAliases,
): Promise<PackageUser> {
  const file = resolveStructural(zip, index, prefix, aliases, 'account/user.json');
  if (!file) {
    throw new PackageParseError('Package is missing account/user.json');
  }
  const raw = JSON.parse(strFromU8(file)) as RawUserJson;
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

async function readGuilds(
  zip: PackageZip,
  index: CaseIndex,
  prefix: string,
  aliases: StructuralAliases,
): Promise<PackageGuild[]> {
  const guilds: PackageGuild[] = [];
  const guildRegex = new RegExp(
    `^${escapeRegex(prefix)}${escapeRegex(aliases.servers)}\\/\\d+\\/guild\\.json$`,
  );
  const lowerPaths = Array.from(index.keys()).filter((p) => guildRegex.test(p));
  for (const lowerPath of lowerPaths) {
    const entry = resolveFile(zip, index, lowerPath);
    if (!entry) continue;
    try {
      const raw = JSON.parse(strFromU8(entry)) as RawGuildJson;
      if (raw.id && raw.name) guilds.push({ id: raw.id, name: raw.name });
    } catch {
      /* skip malformed guild.json */
    }
  }
  return guilds;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readChannelNameIndex(
  zip: PackageZip,
  index: CaseIndex,
  prefix: string,
  aliases: StructuralAliases,
): Promise<Record<string, string | null>> {
  const entry = resolveStructural(zip, index, prefix, aliases, 'messages/index.json');
  if (!entry) return {};
  try {
    return JSON.parse(strFromU8(entry)) as Record<string, string | null>;
  } catch {
    return {};
  }
}

/**
 * Per-channel file bundle, after we've sorted out which directory-prefix
 * variant (legacy `c{id}` vs. current bare `{id}`) and which messages-file
 * format (legacy `.csv` vs. current `.json`) this particular channel uses.
 * Both axes vary independently across Discord's format-change history (#163);
 * a single package may even mix shapes if it was re-exported across versions.
 */
type ChannelFiles = {
  channelJson: Uint8Array;
  messagesEntry: Uint8Array;
  messagesFormat: 'json' | 'csv';
};

/**
 * Resolve the `channel.json` + messages-file pair for a single channel ID,
 * trying every documented Discord format variant. Returns null only if the
 * channel dir is missing entirely or has neither a `messages.json` nor a
 * `messages.csv` companion to its `channel.json`.
 *
 * Precedence:
 *   1. Directory prefix: `c{id}/` (legacy) → bare `{id}/` (current). Trying
 *      legacy first keeps the fast path unchanged for the bulk of packages
 *      our test corpus and existing users have.
 *   2. Messages format: `.json` (current, post-2024-01-03) → `.csv` (legacy).
 *      Preferring JSON when both exist handles re-exports cleanly — the
 *      JSON file represents the user's most-recent export, the CSV is
 *      stale leftover.
 */
function resolveChannelFiles(
  zip: PackageZip,
  index: CaseIndex,
  prefix: string,
  aliases: StructuralAliases,
  channelId: string,
): ChannelFiles | null {
  const dirPrefixes = ['c', ''];
  const formats: Array<'json' | 'csv'> = ['json', 'csv'];

  for (const dp of dirPrefixes) {
    const channelJson = resolveStructural(
      zip,
      index,
      prefix,
      aliases,
      `messages/${dp}${channelId}/channel.json`,
    );
    if (!channelJson) continue;

    for (const format of formats) {
      const messagesEntry = resolveStructural(
        zip,
        index,
        prefix,
        aliases,
        `messages/${dp}${channelId}/messages.${format}`,
      );
      if (messagesEntry) {
        return { channelJson, messagesEntry, messagesFormat: format };
      }
    }
  }

  return null;
}

async function readChannels(
  zip: PackageZip,
  index: CaseIndex,
  guilds: PackageGuild[],
  nameIndex: Record<string, string | null>,
  prefix: string,
  aliases: StructuralAliases,
): Promise<PackageChannel[]> {
  const guildNames = new Map(guilds.map((g) => [g.id, g.name] as const));
  const channelDirs = new Set<string>();
  const channelDirRegex = buildChannelDirRegex(aliases.messages);

  for (const lowerPath of index.keys()) {
    const relative = prefix && lowerPath.startsWith(prefix)
      ? lowerPath.slice(prefix.length)
      : lowerPath;
    if (SKIPPED_PREFIXES.some((p) => relative.startsWith(p))) continue;
    const match = channelDirRegex.exec(relative);
    if (match) channelDirs.add(match[1]);
  }

  const channels: PackageChannel[] = [];

  for (const id of channelDirs) {
    const files = resolveChannelFiles(zip, index, prefix, aliases, id);
    if (!files) continue;

    let raw: RawChannelJson;
    try {
      raw = JSON.parse(strFromU8(files.channelJson)) as RawChannelJson;
    } catch {
      continue;
    }

    const type = raw.type as PackageChannelType;
    const messagesText = strFromU8(files.messagesEntry);
    const messageCount =
      files.messagesFormat === 'json'
        ? countJsonMessages(messagesText)
        : countCsvRows(messagesText);

    const guildId = raw.guild?.id;
    const guildName = guildId
      ? raw.guild?.name ?? guildNames.get(guildId) ?? undefined
      : undefined;

    const isOrphan = type === PACKAGE_CHANNEL_TYPE.GUILD_TEXT && !guildId;

    channels.push({
      id: raw.id,
      type,
      name: raw.name ?? nameIndex[raw.id] ?? null,
      guildId,
      guildName,
      recipients: raw.recipients,
      messageCount,
      isOrphan,
    });
  }

  channels.sort((a, b) => b.messageCount - a.messageCount);
  return channels;
}

async function readAvatarBlobUrl(
  zip: PackageZip,
  index: CaseIndex,
  prefix: string,
  aliases: StructuralAliases,
): Promise<string | undefined> {
  const entry = resolveStructural(zip, index, prefix, aliases, 'account/avatar.png');
  if (!entry) return undefined;
  try {
    if (typeof URL === 'undefined' || !('createObjectURL' in URL)) return undefined;
    return URL.createObjectURL(new Blob([entry as BlobPart]));
  } catch {
    return undefined;
  }
}
