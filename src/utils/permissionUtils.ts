import type { Channel } from 'discrub-core/types/discord-types';

// Discord permission bit flags
const VIEW_CHANNEL = 1n << 10n;
const MANAGE_MESSAGES = 1n << 13n;
// READ_MESSAGE_HISTORY reserved for future permission checks
void (1n << 16n);
const ADMINISTRATOR = 1n << 3n;

interface PermissionOverwrite {
  id: string;
  type: number; // 0 = role, 1 = member
  allow: string;
  deny: string;
}

/**
 * Compute the effective permissions for a user in a channel.
 * Uses Discord's permission hierarchy: base guild perms → @everyone overwrites → role overwrites.
 */
function computeChannelPermissions(
  guildPermissions: string | undefined,
  userRoleIds: string[],
  channel: Channel,
  guildId: string,
): { permissions: bigint; isAdmin: boolean; hasData: boolean } {
  if (!guildPermissions) return { permissions: 0n, isAdmin: false, hasData: false };

  let permissions = BigInt(guildPermissions);

  if (permissions & ADMINISTRATOR) return { permissions, isAdmin: true, hasData: true };

  const overwrites: PermissionOverwrite[] =
    (channel as any).permission_overwrites || [];

  if (overwrites.length === 0) {
    return { permissions, isAdmin: false, hasData: true };
  }

  // Step 1: Apply @everyone role overwrite (guildId === @everyone role ID)
  const everyoneOverwrite = overwrites.find(
    (ow) => ow.id === guildId && ow.type === 0,
  );
  if (everyoneOverwrite) {
    permissions &= ~BigInt(everyoneOverwrite.deny);
    permissions |= BigInt(everyoneOverwrite.allow);
  }

  // Step 2: Aggregate role overwrites (OR together all allow, OR together all deny)
  let roleAllow = 0n;
  let roleDeny = 0n;
  for (const ow of overwrites) {
    if (ow.type === 0 && ow.id !== guildId && userRoleIds.includes(ow.id)) {
      roleAllow |= BigInt(ow.allow);
      roleDeny |= BigInt(ow.deny);
    }
  }
  permissions &= ~roleDeny;
  permissions |= roleAllow;

  return { permissions, isAdmin: false, hasData: true };
}

/**
 * Check whether the current user can view and read messages in a channel.
 */
export function canAccessChannel(
  guildPermissions: string | undefined,
  userRoleIds: string[],
  channel: Channel,
  guildId: string,
): boolean {
  const { permissions, isAdmin, hasData } = computeChannelPermissions(
    guildPermissions, userRoleIds, channel, guildId,
  );
  if (!hasData) return true; // No permission data — assume accessible
  if (isAdmin) return true;
  return Boolean(permissions & VIEW_CHANNEL);
}

/**
 * Check whether the current user has MANAGE_MESSAGES permission in a channel.
 * Required for bulk reaction removal endpoints.
 */
export function canManageMessages(
  guildPermissions: string | undefined,
  userRoleIds: string[],
  channel: Channel,
  guildId: string,
): boolean {
  const { permissions, isAdmin, hasData } = computeChannelPermissions(
    guildPermissions, userRoleIds, channel, guildId,
  );
  if (!hasData) return false; // No permission data — assume no elevated permissions
  if (isAdmin) return true;
  return Boolean(permissions & MANAGE_MESSAGES);
}
