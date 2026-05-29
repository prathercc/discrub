import { describe, it, expect } from 'vitest';
import {
  SYSTEM_MESSAGE_GROUPS,
  ALL_SYSTEM_GROUP_KEYS,
  groupsToTypes,
  toggleGroupKey,
} from './systemMessageGroups';

describe('systemMessageGroups', () => {
  it('exposes 7 plain-English buckets keyed uniquely', () => {
    expect(SYSTEM_MESSAGE_GROUPS).toHaveLength(7);
    const keys = SYSTEM_MESSAGE_GROUPS.map((g) => g.key);
    expect(new Set(keys).size).toBe(7);
  });

  it('never includes DEFAULT (0) or REPLY (19) — those are real messages', () => {
    const allTypes = SYSTEM_MESSAGE_GROUPS.flatMap((g) => g.types);
    expect(allTypes).not.toContain('0');
    expect(allTypes).not.toContain('19');
  });

  it('ALL_SYSTEM_GROUP_KEYS lists every group key', () => {
    expect(ALL_SYSTEM_GROUP_KEYS).toEqual(SYSTEM_MESSAGE_GROUPS.map((g) => g.key));
  });

  describe('groupsToTypes', () => {
    it('flattens a single group to its MessageType values', () => {
      // pins → CHANNEL_PINNED_MESSAGE ("6")
      expect(groupsToTypes(['pins'])).toEqual(['6']);
    });

    it('unions multiple groups in SYSTEM_MESSAGE_GROUPS order, not selection order', () => {
      // members is declared before... no: pins(0) before members(1). Passing
      // them reversed must still yield pins-first then members.
      expect(groupsToTypes(['members', 'pins'])).toEqual(['6', '1', '2', '7']);
    });

    it('returns an empty array for no selection', () => {
      expect(groupsToTypes([])).toEqual([]);
    });

    it('ignores unknown keys', () => {
      expect(groupsToTypes(['not-a-real-group'])).toEqual([]);
    });
  });

  describe('toggleGroupKey', () => {
    it('adds a key that is not present', () => {
      expect(toggleGroupKey(['pins'], 'boosts')).toEqual(['pins', 'boosts']);
    });

    it('removes a key that is present', () => {
      expect(toggleGroupKey(['pins', 'boosts'], 'pins')).toEqual(['boosts']);
    });

    it('does not mutate the input array', () => {
      const input = ['pins'];
      toggleGroupKey(input, 'boosts');
      expect(input).toEqual(['pins']);
    });
  });
});
