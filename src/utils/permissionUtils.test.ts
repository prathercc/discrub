import { describe, it, expect } from 'vitest';
import { canAccessChannel, canManageMessages } from './permissionUtils';
import type { Channel } from 'discrub-core/types/discord-types';

const VIEW_CHANNEL = 1n << 10n;
const MANAGE_MESSAGES = 1n << 13n;
const ADMINISTRATOR = 1n << 3n;
const SEND_MESSAGES = 1n << 11n;

const makeChannel = (overwrites: any[] = []): Channel =>
  ({ id: 'ch1', type: 0, permission_overwrites: overwrites } as any);

const GUILD_ID = 'guild-1';

describe('canAccessChannel', () => {
  it('returns true when no permission data available', () => {
    expect(canAccessChannel(undefined, [], makeChannel(), GUILD_ID)).toBe(true);
  });

  it('returns true when guild permissions include VIEW_CHANNEL', () => {
    const perms = (VIEW_CHANNEL | SEND_MESSAGES).toString();
    expect(canAccessChannel(perms, [], makeChannel(), GUILD_ID)).toBe(true);
  });

  it('returns false when guild permissions lack VIEW_CHANNEL', () => {
    const perms = SEND_MESSAGES.toString();
    expect(canAccessChannel(perms, [], makeChannel(), GUILD_ID)).toBe(false);
  });

  it('returns true for administrators regardless of other permissions', () => {
    const perms = ADMINISTRATOR.toString(); // admin but no VIEW_CHANNEL
    expect(canAccessChannel(perms, [], makeChannel(), GUILD_ID)).toBe(true);
  });

  it('applies @everyone deny overwrite to remove VIEW_CHANNEL', () => {
    const perms = (VIEW_CHANNEL | SEND_MESSAGES).toString();
    const channel = makeChannel([
      { id: GUILD_ID, type: 0, allow: '0', deny: VIEW_CHANNEL.toString() },
    ]);
    expect(canAccessChannel(perms, [], channel, GUILD_ID)).toBe(false);
  });

  it('applies @everyone allow overwrite to grant VIEW_CHANNEL', () => {
    const perms = SEND_MESSAGES.toString(); // no VIEW_CHANNEL at guild level
    const channel = makeChannel([
      { id: GUILD_ID, type: 0, allow: VIEW_CHANNEL.toString(), deny: '0' },
    ]);
    expect(canAccessChannel(perms, [], channel, GUILD_ID)).toBe(true);
  });

  it('applies role overwrite to grant VIEW_CHANNEL', () => {
    const perms = SEND_MESSAGES.toString(); // no VIEW_CHANNEL
    const channel = makeChannel([
      { id: GUILD_ID, type: 0, allow: '0', deny: VIEW_CHANNEL.toString() }, // @everyone denies
      { id: 'role-mod', type: 0, allow: VIEW_CHANNEL.toString(), deny: '0' }, // mod role allows
    ]);
    expect(canAccessChannel(perms, ['role-mod'], channel, GUILD_ID)).toBe(true);
  });

  it('role deny overrides @everyone allow', () => {
    const perms = (VIEW_CHANNEL | SEND_MESSAGES).toString();
    const channel = makeChannel([
      { id: GUILD_ID, type: 0, allow: VIEW_CHANNEL.toString(), deny: '0' },
      { id: 'role-restricted', type: 0, allow: '0', deny: VIEW_CHANNEL.toString() },
    ]);
    // User has role-restricted — deny takes effect after allow
    expect(canAccessChannel(perms, ['role-restricted'], channel, GUILD_ID)).toBe(false);
  });

  it('ignores role overwrites the user does not have', () => {
    const perms = (VIEW_CHANNEL | SEND_MESSAGES).toString();
    const channel = makeChannel([
      { id: 'role-admin', type: 0, allow: '0', deny: VIEW_CHANNEL.toString() },
    ]);
    // User does NOT have role-admin, so the deny doesn't apply
    expect(canAccessChannel(perms, [], channel, GUILD_ID)).toBe(true);
  });

  it('handles channels with no permission_overwrites field', () => {
    const perms = VIEW_CHANNEL.toString();
    const channel = { id: 'ch1', type: 0 } as Channel; // no overwrites
    expect(canAccessChannel(perms, [], channel, GUILD_ID)).toBe(true);
  });

  it('ignores member overwrites that target a different user', () => {
    const perms = (VIEW_CHANNEL | SEND_MESSAGES).toString();
    const channel = makeChannel([
      { id: 'user-123', type: 1, allow: '0', deny: VIEW_CHANNEL.toString() },
    ]);
    // Member overwrite denies user-123, but the current user is user-self —
    // the deny must not apply to them.
    expect(canAccessChannel(perms, [], channel, GUILD_ID, 'user-self')).toBe(true);
  });

  it('applies a member overwrite to grant VIEW_CHANNEL to the current user (#205)', () => {
    const perms = SEND_MESSAGES.toString(); // no VIEW_CHANNEL at guild level
    const channel = makeChannel([
      { id: GUILD_ID, type: 0, allow: '0', deny: VIEW_CHANNEL.toString() }, // @everyone denies
      { id: 'user-self', type: 1, allow: VIEW_CHANNEL.toString(), deny: '0' }, // single-user grant
    ]);
    // Without the member-overwrite pass this channel greyed out — the exact #205 bug.
    expect(canAccessChannel(perms, [], channel, GUILD_ID, 'user-self')).toBe(true);
  });

  it('member overwrite deny takes precedence over a role allow (#205)', () => {
    const perms = SEND_MESSAGES.toString();
    const channel = makeChannel([
      { id: 'role-mod', type: 0, allow: VIEW_CHANNEL.toString(), deny: '0' }, // role grants
      { id: 'user-self', type: 1, allow: '0', deny: VIEW_CHANNEL.toString() }, // member denies, applied last
    ]);
    expect(canAccessChannel(perms, ['role-mod'], channel, GUILD_ID, 'user-self')).toBe(false);
  });

  it('does not apply member overwrites when no currentUserId is provided', () => {
    const perms = SEND_MESSAGES.toString();
    const channel = makeChannel([
      { id: GUILD_ID, type: 0, allow: '0', deny: VIEW_CHANNEL.toString() },
      { id: 'user-self', type: 1, allow: VIEW_CHANNEL.toString(), deny: '0' },
    ]);
    // Guild-level/anonymous checks (no member id) stay conservative.
    expect(canAccessChannel(perms, [], channel, GUILD_ID)).toBe(false);
  });
});

describe('canManageMessages', () => {
  it('returns false when no permission data available', () => {
    expect(canManageMessages(undefined, [], makeChannel(), GUILD_ID)).toBe(false);
  });

  it('returns true when guild permissions include MANAGE_MESSAGES', () => {
    const perms = (VIEW_CHANNEL | MANAGE_MESSAGES).toString();
    expect(canManageMessages(perms, [], makeChannel(), GUILD_ID)).toBe(true);
  });

  it('returns false when guild permissions lack MANAGE_MESSAGES', () => {
    const perms = (VIEW_CHANNEL | SEND_MESSAGES).toString();
    expect(canManageMessages(perms, [], makeChannel(), GUILD_ID)).toBe(false);
  });

  it('returns true for administrators regardless of other permissions', () => {
    const perms = ADMINISTRATOR.toString();
    expect(canManageMessages(perms, [], makeChannel(), GUILD_ID)).toBe(true);
  });

  it('applies @everyone deny overwrite to remove MANAGE_MESSAGES', () => {
    const perms = (VIEW_CHANNEL | MANAGE_MESSAGES).toString();
    const channel = makeChannel([
      { id: GUILD_ID, type: 0, allow: '0', deny: MANAGE_MESSAGES.toString() },
    ]);
    expect(canManageMessages(perms, [], channel, GUILD_ID)).toBe(false);
  });

  it('applies role overwrite to grant MANAGE_MESSAGES', () => {
    const perms = VIEW_CHANNEL.toString(); // no MANAGE_MESSAGES
    const channel = makeChannel([
      { id: 'role-mod', type: 0, allow: MANAGE_MESSAGES.toString(), deny: '0' },
    ]);
    expect(canManageMessages(perms, ['role-mod'], channel, GUILD_ID)).toBe(true);
  });

  it('role deny overrides @everyone allow for MANAGE_MESSAGES', () => {
    const perms = (VIEW_CHANNEL | MANAGE_MESSAGES).toString();
    const channel = makeChannel([
      { id: GUILD_ID, type: 0, allow: MANAGE_MESSAGES.toString(), deny: '0' },
      { id: 'role-restricted', type: 0, allow: '0', deny: MANAGE_MESSAGES.toString() },
    ]);
    expect(canManageMessages(perms, ['role-restricted'], channel, GUILD_ID)).toBe(false);
  });

  it('ignores role overwrites the user does not have', () => {
    const perms = VIEW_CHANNEL.toString();
    const channel = makeChannel([
      { id: 'role-mod', type: 0, allow: MANAGE_MESSAGES.toString(), deny: '0' },
    ]);
    // User does NOT have role-mod
    expect(canManageMessages(perms, [], channel, GUILD_ID)).toBe(false);
  });

  it('applies a member overwrite to grant MANAGE_MESSAGES to the current user (#205)', () => {
    const perms = VIEW_CHANNEL.toString(); // no MANAGE_MESSAGES
    const channel = makeChannel([
      { id: 'user-self', type: 1, allow: MANAGE_MESSAGES.toString(), deny: '0' },
    ]);
    expect(canManageMessages(perms, [], channel, GUILD_ID, 'user-self')).toBe(true);
  });
});
