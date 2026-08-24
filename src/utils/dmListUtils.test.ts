import { describe, it, expect } from 'vitest';
import { DmSortOrder } from 'discrub-core/discrub-enum';
import type { Channel } from 'discrub-core/types/discord-types';
import {
  isGroupDm,
  getDmName,
  getDmDisplayName,
  getGroupMemberCount,
  getDmLastMessageTime,
  sortDms,
} from './dmListUtils';

// Snowflake for a given ms timestamp: (ms - epoch) << 22.
const snowflakeAt = (ms: number) =>
  ((BigInt(ms) - 1420070400000n) << 22n).toString();

const dm = (overrides: Partial<Channel>): Channel =>
  ({
    id: 'dm',
    type: 1,
    recipients: [{ id: 'u', username: 'user' }],
    ...overrides,
  }) as Channel;

describe('dmListUtils', () => {
  describe('labels', () => {
    it('labels a group by its custom name and 1:1 DMs by recipients', () => {
      const group = dm({ type: 3, name: 'The Gang', recipients: [] });
      expect(isGroupDm(group)).toBe(true);
      expect(getDmName(group)).toBe('The Gang');
      expect(getDmName(dm({ recipients: [{ username: 'alice' }, { username: 'bob' }] } as any))).toBe('alice, bob');
      expect(getDmName(dm({ recipients: [] }))).toBe('Direct Message');
      expect(getDmName(dm({ type: 3, recipients: [] }))).toBe('Group DM');
    });

    it('returns the global display name only for 1:1 DMs where it differs', () => {
      expect(
        getDmDisplayName(dm({ recipients: [{ username: 'alice', global_name: 'Alice A.' }] } as any)),
      ).toBe('Alice A.');
      expect(
        getDmDisplayName(dm({ recipients: [{ username: 'alice', global_name: 'alice' }] } as any)),
      ).toBeNull();
      expect(
        getDmDisplayName(dm({ type: 3, name: 'g', recipients: [{ username: 'a', global_name: 'A' }] } as any)),
      ).toBeNull();
    });

    it('counts group members as recipients plus you', () => {
      expect(getGroupMemberCount(dm({ type: 3, recipients: [{}, {}] } as any))).toBe(3);
      expect(getGroupMemberCount(dm({ type: 3, recipients: undefined }))).toBe(1);
    });
  });

  describe('getDmLastMessageTime', () => {
    it('decodes the snowflake to milliseconds', () => {
      const ms = Date.UTC(2024, 0, 15, 12, 0, 0);
      expect(getDmLastMessageTime(dm({ last_message_id: snowflakeAt(ms) }))).toBe(ms);
    });

    it('returns null for a missing or non-numeric id', () => {
      expect(getDmLastMessageTime(dm({ last_message_id: null }))).toBeNull();
      expect(getDmLastMessageTime(dm({ last_message_id: undefined }))).toBeNull();
      expect(getDmLastMessageTime(dm({ last_message_id: 'msg-100' }))).toBeNull();
    });
  });

  describe('sortDms', () => {
    const older = dm({ id: 'older', last_message_id: snowflakeAt(Date.UTC(2023, 5, 1)), recipients: [{ username: 'zoe' }] } as any);
    const newer = dm({ id: 'newer', last_message_id: snowflakeAt(Date.UTC(2025, 5, 1)), recipients: [{ username: 'mia' }] } as any);
    const silentA = dm({ id: 'silent-a', last_message_id: null, recipients: [{ username: 'ann' }] } as any);
    const silentB = dm({ id: 'silent-b', last_message_id: 'msg-999', recipients: [{ username: 'Bea' }] } as any);
    const apiOrder = [silentA, older, silentB, newer];

    it('recent: newest first, DMs without a timestamp last in API order', () => {
      expect(sortDms(apiOrder, DmSortOrder.RECENT).map((d) => d.id)).toEqual([
        'newer',
        'older',
        'silent-a',
        'silent-b',
      ]);
    });

    it('name: alphabetical by the rendered label, case-insensitive', () => {
      expect(sortDms(apiOrder, DmSortOrder.NAME).map((d) => d.id)).toEqual([
        'silent-a', // ann
        'silent-b', // Bea
        'newer', // mia
        'older', // zoe
      ]);
    });

    it('name: 1:1 DMs sort by display name when one exists', () => {
      const display = dm({ id: 'display', recipients: [{ username: 'zzz', global_name: 'Aaron' }] } as any);
      expect(sortDms([older, display], DmSortOrder.NAME).map((d) => d.id)).toEqual([
        'display', // Aaron beats zoe
        'older',
      ]);
    });

    it('discord: returns the API order untouched', () => {
      expect(sortDms(apiOrder, DmSortOrder.DISCORD)).toBe(apiOrder);
    });

    it('does not mutate the input array', () => {
      const input = [...apiOrder];
      sortDms(input, DmSortOrder.RECENT);
      expect(input).toEqual(apiOrder);
    });
  });
});
