/**
 * Types for the Discord data package import feature.
 *
 * Source: user's exported data package from Discord
 * (Settings → Privacy & Safety → Request All of My Data).
 */

/** Channel types present in data packages (Discord API channel types). */
export const PACKAGE_CHANNEL_TYPE = {
  GUILD_TEXT: 0,
  DM: 1,
  GROUP_DM: 3,
  GUILD_PUBLIC_THREAD: 11,
} as const;

export type PackageChannelType =
  (typeof PACKAGE_CHANNEL_TYPE)[keyof typeof PACKAGE_CHANNEL_TYPE];

/** Identity of the user who requested the package (from account/user.json). */
export interface PackageUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarHash: string | null;
  email?: string;
}

/** Guild metadata (from servers/{id}/guild.json). */
export interface PackageGuild {
  id: string;
  name: string;
}

/**
 * Channel metadata (from messages/c{id}/channel.json) plus derived fields.
 *
 * `isOrphan` flags channels where the user's server context is gone —
 * typically a type-0 text channel with no guild field, meaning the user
 * has left the server. Messages still exist in the package, but API
 * delete/edit calls will 403.
 */
export interface PackageChannel {
  id: string;
  type: PackageChannelType;
  name: string | null;
  guildId?: string;
  guildName?: string;
  recipients?: string[];
  messageCount: number;
  isOrphan: boolean;
}

/** A single parsed message row from messages/c{id}/messages.csv. */
export interface PackageMessage {
  id: string;
  timestamp: string;
  content: string;
  /**
   * Discord serializes multi-attachment messages as a single CSV cell
   * containing the URLs separated by whitespace. We split into a list
   * up front (Backlog #159) so downstream consumers don't have to know
   * about the encoding. Empty / no attachments → `[]`.
   */
  attachments: string[];
}

/** Root parsed-package shape returned by parsePackageZip. */
export interface ParsedPackage {
  user: PackageUser;
  guilds: PackageGuild[];
  channels: PackageChannel[];
  totalMessages: number;
  packageSizeBytes: number;
  avatarBlobUrl?: string;
}

/** Result of validating a parsed package against the current auth context. */
export interface PackageValidationResult {
  ok: boolean;
  readOnly: boolean;
  warnings: string[];
  errors: string[];
}
