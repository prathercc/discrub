import type { Emoji, Guild, Role } from 'discrub-core/types/discord-types';

/**
 * Types for guild feature
 */

export interface GuildState {
  guilds: Guild[];
  selectedGuild: Guild | null;
  /** Multi-select set in the server list (parallels channelSlice.selectedChannels). */
  selectedGuilds: Guild[];
  roles: Role[];
  /** Custom emojis for the selected guild. The guild-list endpoint returns partial
   * guilds with no emoji array, so these are fetched per guild (see fetchGuildEmojis). */
  guildEmojis: Emoji[];
  /** Cached guild emojis per guild ID to avoid refetching on channel switches. */
  guildEmojisCache: Record<string, Emoji[]>;
  /** Current user's role IDs in the selected guild (for permission checks) */
  currentMemberRoles: string[];
  /** Cached member roles per guild ID { roles, fetchedAt } */
  memberRolesCache: Record<string, { roles: string[]; fetchedAt: number }>;
  isLoading: boolean;
  error: string | null;
}

export const initialGuildState: GuildState = {
  guilds: [],
  selectedGuild: null,
  selectedGuilds: [],
  roles: [],
  guildEmojis: [],
  guildEmojisCache: {},
  currentMemberRoles: [],
  memberRolesCache: {},
  isLoading: false,
  error: null,
};
