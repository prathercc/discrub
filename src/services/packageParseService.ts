import JSZip from 'jszip';
import { countCsvRows, parseMessagesCsv } from '@/utils/csvParser';
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

const SKIPPED_PREFIXES = ['activity/', 'activities_e/', 'activities_w/', 'programs/'];
const CHANNEL_DIR_REGEX = /^messages\/c(\d+)\//;

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
 * Detects a single wrapper directory that some users end up with when they
 * re-zip their extracted package (e.g. `Discord Data Package - name/`).
 * Returns the prefix (with trailing slash) or `''` if the package is
 * already at the ZIP root.
 */
function detectRootPrefix(zip: JSZip): string {
  const entries = Object.keys(zip.files).filter((p) => !isJunkPath(p));
  if (entries.some((p) => p === 'account/user.json')) return '';

  const firstSegments = new Set<string>();
  for (const path of entries) {
    const idx = path.indexOf('/');
    if (idx === -1) continue;
    firstSegments.add(path.slice(0, idx));
    if (firstSegments.size > 1) return '';
  }
  if (firstSegments.size !== 1) return '';

  const wrapper = [...firstSegments][0];
  // Confirm the wrapper contains the expected entry before stripping it.
  if (!zip.file(`${wrapper}/account/user.json`)) return '';
  return `${wrapper}/`;
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
  const zip = await JSZip.loadAsync(file);
  const prefix = detectRootPrefix(zip);

  const user = await readUserJson(zip, prefix);
  const guilds = await readGuilds(zip, prefix);
  const channelNameIndex = await readChannelNameIndex(zip, prefix);
  const channels = await readChannels(zip, guilds, channelNameIndex, prefix);

  const totalMessages = channels.reduce((sum, c) => sum + c.messageCount, 0);
  const avatarBlobUrl = await readAvatarBlobUrl(zip, prefix);

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
 * Reads and parses a single channel's messages.csv on demand.
 * Callers (the packageSlice) cache parsed results keyed by channel ID.
 */
export async function loadChannelMessages(
  file: File | Blob,
  channelId: string,
): Promise<PackageMessage[]> {
  const zip = await JSZip.loadAsync(file);
  const prefix = detectRootPrefix(zip);
  const entry = zip.file(`${prefix}messages/c${channelId}/messages.csv`);
  if (!entry) {
    throw new PackageParseError(`messages.csv missing for channel ${channelId}`);
  }
  const csv = await entry.async('string');
  return parseMessagesCsv(csv);
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

async function readUserJson(zip: JSZip, prefix: string): Promise<PackageUser> {
  const file = zip.file(`${prefix}account/user.json`);
  if (!file) {
    throw new PackageParseError('Package is missing account/user.json');
  }
  const raw = JSON.parse(await file.async('string')) as RawUserJson;
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

async function readGuilds(zip: JSZip, prefix: string): Promise<PackageGuild[]> {
  const guilds: PackageGuild[] = [];
  const guildRegex = new RegExp(
    `^${escapeRegex(prefix)}servers\\/\\d+\\/guild\\.json$`,
  );
  const paths = Object.keys(zip.files).filter(
    (p) => !isJunkPath(p) && guildRegex.test(p),
  );
  for (const path of paths) {
    const entry = zip.file(path);
    if (!entry) continue;
    try {
      const raw = JSON.parse(await entry.async('string')) as RawGuildJson;
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
  zip: JSZip,
  prefix: string,
): Promise<Record<string, string | null>> {
  const entry = zip.file(`${prefix}messages/index.json`);
  if (!entry) return {};
  try {
    return JSON.parse(await entry.async('string')) as Record<string, string | null>;
  } catch {
    return {};
  }
}

async function readChannels(
  zip: JSZip,
  guilds: PackageGuild[],
  nameIndex: Record<string, string | null>,
  prefix: string,
): Promise<PackageChannel[]> {
  const guildNames = new Map(guilds.map((g) => [g.id, g.name] as const));
  const channelDirs = new Set<string>();

  for (const path of Object.keys(zip.files)) {
    if (isJunkPath(path)) continue;
    const relative = prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path;
    if (SKIPPED_PREFIXES.some((p) => relative.startsWith(p))) continue;
    const match = CHANNEL_DIR_REGEX.exec(relative);
    if (match) channelDirs.add(match[1]);
  }

  const channels: PackageChannel[] = [];

  for (const id of channelDirs) {
    const channelJson = zip.file(`${prefix}messages/c${id}/channel.json`);
    const csvEntry = zip.file(`${prefix}messages/c${id}/messages.csv`);
    if (!channelJson || !csvEntry) continue;

    let raw: RawChannelJson;
    try {
      raw = JSON.parse(await channelJson.async('string')) as RawChannelJson;
    } catch {
      continue;
    }

    const type = raw.type as PackageChannelType;
    const csv = await csvEntry.async('string');
    const messageCount = countCsvRows(csv);

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
  zip: JSZip,
  prefix: string,
): Promise<string | undefined> {
  const entry = zip.file(`${prefix}account/avatar.png`);
  if (!entry) return undefined;
  try {
    const blob = await entry.async('blob');
    if (typeof URL === 'undefined' || !('createObjectURL' in URL)) return undefined;
    return URL.createObjectURL(blob);
  } catch {
    return undefined;
  }
}
