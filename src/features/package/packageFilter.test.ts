import { describe, it, expect } from 'vitest';
import {
  applyPackageFilter,
  hasAnyPackageCriterion,
  matchesPackageFilter,
} from './packageFilter';
import type { PackageMessage } from './packageTypes';
import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import { HasType, IsPinnedType } from 'discrub-core/discord-enum';

const baseCriteria: SearchCriteria = {
  searchBeforeDate: null,
  searchAfterDate: null,
  searchMessageContent: null,
  selectedHasTypes: [] as HasType[],
  userIds: [],
  mentionIds: [],
  channelIds: [],
  isPinned: IsPinnedType.UNSET,
  authorType: null,
};

function msg(overrides: Partial<PackageMessage>): PackageMessage {
  return {
    id: '1',
    timestamp: '2026-01-15T12:00:00Z',
    content: '',
    attachments: [],
    ...overrides,
  };
}

describe('packageFilter', () => {
  describe('hasAnyPackageCriterion', () => {
    it('returns false for null/undefined', () => {
      expect(hasAnyPackageCriterion(null)).toBe(false);
      expect(hasAnyPackageCriterion(undefined)).toBe(false);
    });

    it('returns false when no evaluable criterion is set', () => {
      expect(hasAnyPackageCriterion(baseCriteria)).toBe(false);
    });

    it('returns false when only non-package criteria are set', () => {
      expect(hasAnyPackageCriterion({ ...baseCriteria, isPinned: IsPinnedType.YES })).toBe(false);
      expect(hasAnyPackageCriterion({ ...baseCriteria, userIds: ['123'] })).toBe(false);
      expect(hasAnyPackageCriterion({ ...baseCriteria, mentionIds: ['123'] })).toBe(false);
      expect(hasAnyPackageCriterion({ ...baseCriteria, selectedHasTypes: [HasType.IMAGE] })).toBe(false);
    });

    it('returns true for content criterion', () => {
      expect(hasAnyPackageCriterion({ ...baseCriteria, searchMessageContent: 'foo' })).toBe(true);
    });

    it('returns true for after-date criterion', () => {
      expect(hasAnyPackageCriterion({ ...baseCriteria, searchAfterDate: new Date() })).toBe(true);
    });

    it('returns true for before-date criterion', () => {
      expect(hasAnyPackageCriterion({ ...baseCriteria, searchBeforeDate: new Date() })).toBe(true);
    });

    it('returns false for an empty-string content criterion', () => {
      expect(hasAnyPackageCriterion({ ...baseCriteria, searchMessageContent: '' })).toBe(false);
    });
  });

  describe('matchesPackageFilter — content', () => {
    it('matches a message containing the substring (case-insensitive)', () => {
      const m = msg({ content: 'Hello World!' });
      expect(matchesPackageFilter(m, { ...baseCriteria, searchMessageContent: 'world' })).toBe(true);
      expect(matchesPackageFilter(m, { ...baseCriteria, searchMessageContent: 'WORLD' })).toBe(true);
    });

    it('excludes a message that does not contain the substring', () => {
      const m = msg({ content: 'Hello World!' });
      expect(matchesPackageFilter(m, { ...baseCriteria, searchMessageContent: 'pizza' })).toBe(false);
    });

    it('excludes a message with empty content from a non-empty substring filter', () => {
      const m = msg({ content: '' });
      expect(matchesPackageFilter(m, { ...baseCriteria, searchMessageContent: 'anything' })).toBe(false);
    });
  });

  describe('matchesPackageFilter — date range', () => {
    const m = msg({ timestamp: '2026-01-15T12:00:00Z' });

    it('matches when after-date is before the message', () => {
      expect(matchesPackageFilter(m, { ...baseCriteria, searchAfterDate: new Date('2026-01-01T00:00:00Z') })).toBe(true);
    });

    it('excludes when after-date is after the message', () => {
      expect(matchesPackageFilter(m, { ...baseCriteria, searchAfterDate: new Date('2026-02-01T00:00:00Z') })).toBe(false);
    });

    it('matches when before-date is after the message', () => {
      expect(matchesPackageFilter(m, { ...baseCriteria, searchBeforeDate: new Date('2026-02-01T00:00:00Z') })).toBe(true);
    });

    it('excludes when before-date is before the message', () => {
      expect(matchesPackageFilter(m, { ...baseCriteria, searchBeforeDate: new Date('2026-01-01T00:00:00Z') })).toBe(false);
    });

    it('matches when both bounds bracket the message (between)', () => {
      const criteria = {
        ...baseCriteria,
        searchAfterDate: new Date('2026-01-01T00:00:00Z'),
        searchBeforeDate: new Date('2026-02-01T00:00:00Z'),
      };
      expect(matchesPackageFilter(m, criteria)).toBe(true);
    });

    it('excludes when message falls outside the between window on either side', () => {
      const criteriaEarly = {
        ...baseCriteria,
        searchAfterDate: new Date('2026-02-01T00:00:00Z'),
        searchBeforeDate: new Date('2026-03-01T00:00:00Z'),
      };
      expect(matchesPackageFilter(m, criteriaEarly)).toBe(false);

      const criteriaLate = {
        ...baseCriteria,
        searchAfterDate: new Date('2025-11-01T00:00:00Z'),
        searchBeforeDate: new Date('2025-12-01T00:00:00Z'),
      };
      expect(matchesPackageFilter(m, criteriaLate)).toBe(false);
    });

    it('excludes a message with a malformed timestamp when a date filter is active', () => {
      const broken = msg({ timestamp: 'not-a-date' });
      expect(matchesPackageFilter(broken, { ...baseCriteria, searchAfterDate: new Date('2020-01-01') })).toBe(false);
    });
  });

  describe('matchesPackageFilter — non-package criteria are tolerated (silently passed)', () => {
    it('ignores isPinned and still matches', () => {
      const m = msg({ content: 'pizza' });
      expect(matchesPackageFilter(m, {
        ...baseCriteria,
        searchMessageContent: 'pizza',
        isPinned: IsPinnedType.YES,
      })).toBe(true);
    });

    it('ignores userIds, mentionIds, hasTypes, authorType', () => {
      const m = msg({ content: 'pizza' });
      expect(matchesPackageFilter(m, {
        ...baseCriteria,
        searchMessageContent: 'pizza',
        userIds: ['nonexistent'],
        mentionIds: ['nonexistent'],
        selectedHasTypes: [HasType.IMAGE],
      })).toBe(true);
    });
  });

  describe('matchesPackageFilter — AND-logic across criteria', () => {
    it('requires all active criteria to match', () => {
      const m = msg({ content: 'pizza', timestamp: '2026-01-15T12:00:00Z' });
      const criteria = {
        ...baseCriteria,
        searchMessageContent: 'pizza',
        searchAfterDate: new Date('2026-01-01T00:00:00Z'),
        searchBeforeDate: new Date('2026-02-01T00:00:00Z'),
      };
      expect(matchesPackageFilter(m, criteria)).toBe(true);

      // Same date, wrong content
      expect(matchesPackageFilter(msg({ content: 'cake', timestamp: '2026-01-15T12:00:00Z' }), criteria)).toBe(false);
      // Right content, out of date window
      expect(matchesPackageFilter(msg({ content: 'pizza', timestamp: '2025-12-01T00:00:00Z' }), criteria)).toBe(false);
    });
  });

  describe('applyPackageFilter', () => {
    const messages: PackageMessage[] = [
      msg({ id: 'a', content: 'first pizza message', timestamp: '2026-01-10T00:00:00Z' }),
      msg({ id: 'b', content: 'about cake', timestamp: '2026-01-20T00:00:00Z' }),
      msg({ id: 'c', content: 'pizza party', timestamp: '2026-02-15T00:00:00Z' }),
    ];

    it('returns the original array reference when no criteria is supplied', () => {
      expect(applyPackageFilter(messages, null)).toBe(messages);
      expect(applyPackageFilter(messages, undefined)).toBe(messages);
    });

    it('returns the original array reference when criteria has no evaluable criterion', () => {
      expect(applyPackageFilter(messages, baseCriteria)).toBe(messages);
    });

    it('filters by content', () => {
      const out = applyPackageFilter(messages, { ...baseCriteria, searchMessageContent: 'pizza' });
      expect(out.map((m) => m.id)).toEqual(['a', 'c']);
    });

    it('filters by between-dates', () => {
      const out = applyPackageFilter(messages, {
        ...baseCriteria,
        searchAfterDate: new Date('2026-01-01T00:00:00Z'),
        searchBeforeDate: new Date('2026-01-31T23:59:59Z'),
      });
      expect(out.map((m) => m.id)).toEqual(['a', 'b']);
    });

    it('filters by content AND date together', () => {
      const out = applyPackageFilter(messages, {
        ...baseCriteria,
        searchMessageContent: 'pizza',
        searchAfterDate: new Date('2026-01-01T00:00:00Z'),
        searchBeforeDate: new Date('2026-01-31T23:59:59Z'),
      });
      expect(out.map((m) => m.id)).toEqual(['a']);
    });

    it('returns an empty array when no messages match', () => {
      const out = applyPackageFilter(messages, { ...baseCriteria, searchMessageContent: 'tacos' });
      expect(out).toEqual([]);
    });
  });
});
