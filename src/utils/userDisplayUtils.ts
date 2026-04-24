import type { User } from 'discrub-core/types/discord-types';
import type { ExportUserMap, AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

/**
 * User display data structure
 */
export interface UserDisplayData {
  username: string | null;
  displayName: string | null;
  nickname: string | null;
}

/**
 * Get display name for a user based on priority: nickname > display name > username
 * Respects settings flags for display name and server nickname lookup
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

/**
 * Get all user display data for export purposes
 * Returns separate fields for username, display name, and nickname
 *
 * @param userId - User ID to look up
 * @param userMap - Cached user map from enrichment
 * @param guildId - Current guild ID (null for DMs)
 * @returns Object with username, displayName, and nickname fields
 */
export function getUserDisplayData(
  userId: string,
  userMap: ExportUserMap,
  guildId: string | null
): UserDisplayData {
  const cachedUser = userMap[userId];

  const username = cachedUser?.userName || null;
  const displayName = cachedUser?.displayName || null;
  const nickname =
    guildId && cachedUser?.guilds?.[guildId]?.nick
      ? cachedUser.guilds[guildId].nick!
      : null;

  return {
    username,
    displayName,
    nickname,
  };
}

/**
 * Get formatted user data for tooltips
 * Returns multi-line string with all available user information
 *
 * @param userId - User ID to look up
 * @param userMap - Cached user map from enrichment
 * @param guildId - Current guild ID (null for DMs)
 * @returns Formatted string for tooltip display
 */
export function getFormattedUserInfo(
  userId: string,
  userMap: ExportUserMap,
  guildId: string | null
): string {
  const data = getUserDisplayData(userId, userMap, guildId);
  const lines: string[] = [];

  if (data.username) {
    lines.push(`Username: ${data.username}`);
  }

  if (data.displayName) {
    lines.push(`Display Name: ${data.displayName}`);
  }

  if (data.nickname) {
    lines.push(`Server Nickname: ${data.nickname}`);
  }

  if (lines.length === 0) {
    return 'User information not available';
  }

  return lines.join('\n');
}

/**
 * Check if user data exists in cache
 *
 * @param userId - User ID to check
 * @param userMap - Cached user map
 * @returns True if user has cached data
 */
export function hasUserData(userId: string, userMap: ExportUserMap): boolean {
  return userId in userMap;
}

/**
 * Check if user has guild-specific data in cache
 *
 * @param userId - User ID to check
 * @param guildId - Guild ID to check
 * @param userMap - Cached user map
 * @returns True if user has guild-specific data
 */
export function hasUserGuildData(
  userId: string,
  guildId: string,
  userMap: ExportUserMap
): boolean {
  return (
    userId in userMap &&
    userMap[userId].guilds !== undefined &&
    guildId in userMap[userId].guilds
  );
}
