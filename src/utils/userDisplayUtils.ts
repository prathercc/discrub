import type { User } from 'discrub-core/types/discord-types';
import type { ExportUserMap, AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

/**
 * Get display name for a user based on priority: nickname > display name > username
 * Respects settings flags for display name and server nickname lookup.
 *
 * Settings-aware variant kept in the consumer (the lib's getUserDisplayData is
 * raw field extraction); the rest of this file's former helpers were promoted
 * to discrub-core/discrub-utils (#195).
 *
 * @param user - User object from message (may be undefined)
 * @param userMap - Cached user map from enrichment
 * @param guildId - Current guild ID (null for DMs)
 * @param settings - App settings to check lookup flags
 * @returns Resolved display name string
 */
export function getDisplayName(
  user: User | undefined,
  userMap: ExportUserMap,
  guildId: string | null,
  settings: AppSettings
): string {
  if (!user) {
    return 'Unknown';
  }

  const userId = user.id;
  const cachedUser = userMap[userId];

  // Check settings flags
  const useDisplayName = settings[DiscrubSetting.DISPLAY_NAME_LOOKUP] === 'true';
  const useNickname = settings[DiscrubSetting.SERVER_NICKNAME_LOOKUP] === 'true';

  // Priority 1: Server nickname (if in guild context and enabled)
  if (useNickname && guildId && cachedUser?.guilds?.[guildId]?.nick) {
    return cachedUser.guilds[guildId].nick!;
  }

  // Priority 2: Display name from cache (if enabled)
  if (useDisplayName && cachedUser?.displayName) {
    return cachedUser.displayName;
  }

  // Priority 3: Display name from message author (if enabled)
  if (useDisplayName && user.global_name) {
    return user.global_name;
  }

  // Priority 4: Username from cache
  if (cachedUser?.userName) {
    return cachedUser.userName;
  }

  // Priority 5: Username from message author
  if (user.username) {
    return user.username;
  }

  // Fallback
  return 'Unknown';
}
