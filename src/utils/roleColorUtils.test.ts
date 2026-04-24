import { describe, it, expect } from 'vitest';
import { getUserRoleColor, getUserRoleIcon } from './roleColorUtils';
import type { ExportUserMap } from 'discrub-core/types/discrub-types';

const guildId = 'guild-1';

const guildRoles = [
  { id: 'role-everyone', color: 0, position: 0 },        // @everyone — no color
  { id: 'role-member', color: 0, position: 1 },           // Member — no color
  { id: 'role-mod', color: 0x2ecc71, position: 5 },       // Moderator — green
  { id: 'role-admin', color: 0xe91e63, position: 10 },    // Admin — pink
  { id: 'role-booster', color: 0xf47fff, position: 3 },   // Booster — purple
  { id: 'role-colorless', color: 0, position: 8 },        // High position but no color
];

const createUserMap = (userId: string, roleIds: string[]): ExportUserMap => ({
  [userId]: {
    userName: 'testuser',
    displayName: 'Test User',
    avatar: null,
    guilds: {
      [guildId]: {
        roles: roleIds,
        nick: null,
        joinedAt: null,
        timestamp: Date.now(),
      },
    },
    timestamp: Date.now(),
  },
});

describe('getUserRoleColor', () => {
  it('returns null when guildId is null', () => {
    const map = createUserMap('u1', ['role-admin']);
    expect(getUserRoleColor('u1', null, map, guildRoles)).toBeNull();
  });

  it('returns null when user has no roles', () => {
    const map = createUserMap('u1', []);
    expect(getUserRoleColor('u1', guildId, map, guildRoles)).toBeNull();
  });

  it('returns null when user only has colorless roles', () => {
    const map = createUserMap('u1', ['role-everyone', 'role-member', 'role-colorless']);
    expect(getUserRoleColor('u1', guildId, map, guildRoles)).toBeNull();
  });

  it('returns the color of a single colored role', () => {
    const map = createUserMap('u1', ['role-mod']);
    expect(getUserRoleColor('u1', guildId, map, guildRoles)).toBe('#2ecc71');
  });

  it('returns the highest-position colored role when multiple colored roles', () => {
    const map = createUserMap('u1', ['role-booster', 'role-mod', 'role-admin']);
    // admin (position 10) > mod (5) > booster (3)
    expect(getUserRoleColor('u1', guildId, map, guildRoles)).toBe('#e91e63');
  });

  it('ignores colorless roles even at higher positions', () => {
    const map = createUserMap('u1', ['role-colorless', 'role-booster']);
    // colorless is position 8, booster is position 3, but colorless has color=0
    expect(getUserRoleColor('u1', guildId, map, guildRoles)).toBe('#f47fff');
  });

  it('returns null when user is not in the cached user map', () => {
    expect(getUserRoleColor('unknown-user', guildId, {}, guildRoles)).toBeNull();
  });

  it('returns null when user has no guild data for this guild', () => {
    const map: ExportUserMap = {
      'u1': {
        userName: 'test', displayName: null, avatar: null,
        guilds: {}, timestamp: Date.now(),
      },
    };
    expect(getUserRoleColor('u1', guildId, map, guildRoles)).toBeNull();
  });

  it('returns null when guildRoles is empty', () => {
    const map = createUserMap('u1', ['role-admin']);
    expect(getUserRoleColor('u1', guildId, map, [])).toBeNull();
  });

  it('pads color hex to 6 characters', () => {
    // Color 0x0000ff = 255, should pad to "0000ff"
    const roles = [{ id: 'role-blue', color: 0x0000ff, position: 1 }];
    const map = createUserMap('u1', ['role-blue']);
    expect(getUserRoleColor('u1', guildId, map, roles)).toBe('#0000ff');
  });
});

describe('getUserRoleIcon', () => {
  const rolesWithIcons = [
    { id: 'role-1', color: 0, position: 1 },
    { id: 'role-2', color: 0x2ecc71, position: 5, icon: 'icon_hash_123' },
    { id: 'role-3', color: 0xe91e63, position: 10, unicode_emoji: '🔥' },
    { id: 'role-4', color: 0xf47fff, position: 3 },
  ];

  it('returns null when guildId is null', () => {
    const map = createUserMap('u1', ['role-2']);
    expect(getUserRoleIcon('u1', null, map, rolesWithIcons)).toBeNull();
  });

  it('returns null when user has no roles', () => {
    const map = createUserMap('u1', []);
    expect(getUserRoleIcon('u1', guildId, map, rolesWithIcons)).toBeNull();
  });

  it('returns null when user roles have no icons', () => {
    const map = createUserMap('u1', ['role-1', 'role-4']);
    expect(getUserRoleIcon('u1', guildId, map, rolesWithIcons)).toBeNull();
  });

  it('returns image icon for role with icon hash', () => {
    const map = createUserMap('u1', ['role-2']);
    const result = getUserRoleIcon('u1', guildId, map, rolesWithIcons);
    expect(result).toEqual({ type: 'image', roleId: 'role-2', hash: 'icon_hash_123' });
  });

  it('returns emoji icon for role with unicode_emoji', () => {
    const map = createUserMap('u1', ['role-3']);
    const result = getUserRoleIcon('u1', guildId, map, rolesWithIcons);
    expect(result).toEqual({ type: 'emoji', emoji: '🔥' });
  });

  it('returns highest-position role icon when multiple roles have icons', () => {
    const map = createUserMap('u1', ['role-2', 'role-3']);
    const result = getUserRoleIcon('u1', guildId, map, rolesWithIcons);
    // role-3 (position 10) > role-2 (position 5)
    expect(result).toEqual({ type: 'emoji', emoji: '🔥' });
  });

  it('prefers icon hash over unicode_emoji on the same role', () => {
    const roleWithBoth = [{ id: 'role-both', color: 0, position: 1, icon: 'both_hash', unicode_emoji: '⭐' }];
    const map = createUserMap('u1', ['role-both']);
    const result = getUserRoleIcon('u1', guildId, map, roleWithBoth);
    expect(result).toEqual({ type: 'image', roleId: 'role-both', hash: 'both_hash' });
  });
});
