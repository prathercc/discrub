import type { ExportUserMap } from 'discrub-core/types/discrub-types';

interface RoleLike {
  id: string;
  color: number;
  position: number;
  icon?: string | null;
  unicode_emoji?: string | null;
  hoist?: boolean;
}

export interface RoleDisplayInfo {
  color: string | null;
  icon: { type: 'image'; roleId: string; hash: string } | { type: 'emoji'; emoji: string } | null;
}

/**
 * Get the display color for a user based on their highest-position colored role in a guild.
 * Returns a CSS hex color string (e.g., "#7289da") or null if no colored role.
 *
 * Discord's color value of 0 means "use default" — only non-zero colors are applied.
 */
export function getUserRoleColor(
  userId: string,
  guildId: string | null | undefined,
  cachedUserMap: ExportUserMap,
  guildRoles: RoleLike[],
): string | null {
  if (!guildId || !guildRoles.length) return null;

  const userData = cachedUserMap[userId];
  const userRoleIds = userData?.guilds?.[guildId]?.roles;
  if (!userRoleIds || userRoleIds.length === 0) return null;

  const userRoleIdSet = new Set(userRoleIds);

  let bestRole: RoleLike | null = null;
  for (const role of guildRoles) {
    if (role.color !== 0 && userRoleIdSet.has(role.id)) {
      if (!bestRole || role.position > bestRole.position) {
        bestRole = role;
      }
    }
  }

  if (!bestRole) return null;

  return '#' + bestRole.color.toString(16).padStart(6, '0');
}

/**
 * Get the role icon for a user — the highest-position hoisted role with an icon.
 * Discord shows this next to the username in chat.
 */
export function getUserRoleIcon(
  userId: string,
  guildId: string | null | undefined,
  cachedUserMap: ExportUserMap,
  guildRoles: RoleLike[],
): RoleDisplayInfo['icon'] {
  if (!guildId || !guildRoles.length) return null;

  const userData = cachedUserMap[userId];
  const userRoleIds = userData?.guilds?.[guildId]?.roles;
  if (!userRoleIds || userRoleIds.length === 0) return null;

  const userRoleIdSet = new Set(userRoleIds);

  // Find highest-position role with an icon
  let bestRole: RoleLike | null = null;
  for (const role of guildRoles) {
    if ((role.icon || role.unicode_emoji) && userRoleIdSet.has(role.id)) {
      if (!bestRole || role.position > bestRole.position) {
        bestRole = role;
      }
    }
  }

  if (!bestRole) return null;

  if (bestRole.icon) {
    return { type: 'image', roleId: bestRole.id, hash: bestRole.icon };
  }
  if (bestRole.unicode_emoji) {
    return { type: 'emoji', emoji: bestRole.unicode_emoji };
  }
  return null;
}
