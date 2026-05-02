import type { Guild, Role } from 'discrub-core/types/discord-types';

/**
 * Types for guild feature
 */

export interface GuildState {
  guilds: Guild[];
  selectedGuild: Guild | null;
  /** Multi-select set in the server list (parallels channelSlice.selectedChannels). */
  selectedGuilds: Guild[];
  roles: Role[];
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
  currentMemberRoles: [],
  memberRolesCache: {},
  isLoading: false,
  error: null,
};
