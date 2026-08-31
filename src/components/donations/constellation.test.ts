import { describe, it, expect } from 'vitest';
import type { Donation } from 'discrub-core/types/discrub-types';
import {
  aggregateSupporters,
  displayName,
  formatTotal,
  getConstellationTier,
  hashString,
  isGenericName,
  mulberry32,
  pickNovaIds,
  placeStars,
  MAX_NOVA_STARS,
} from './constellation';

const donation = (overrides: Partial<Donation>): Donation => ({
  donorId: 'donor-1',
  transactionId: 'tx-1',
  timestamp: '2026-08-01T12:00:00Z',
  type: 'Donation',
  fromName: 'Ada',
  message: '',
  amount: 5,
  currency: 'USD',
  ...overrides,
});

describe('constellation (site-parity spec copy)', () => {
  describe('hash primitives — the parity contract', () => {
    it('FNV-1a matches known vectors', () => {
      // Anchors the exact algorithm: if these change, star positions on
      // this surface drift away from the site's sky.
      expect(hashString('')).toBe(2166136261);
      expect(hashString('a')).toBe(0xe40c292c);
    });

    it('mulberry32 is deterministic per seed', () => {
      const a = mulberry32(42);
      const b = mulberry32(42);
      expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    });
  });

  describe('tiers', () => {
    it('maps totals onto the byte ladder', () => {
      expect(getConstellationTier(150).key).toBe('gigabyte');
      expect(getConstellationTier(100).key).toBe('gigabyte');
      expect(getConstellationTier(50).key).toBe('megabyte');
      expect(getConstellationTier(20).key).toBe('kilobyte');
      expect(getConstellationTier(5).key).toBe('byte');
      expect(getConstellationTier(2).key).toBe('bit');
    });
  });

  describe('aggregation', () => {
    it('sums per donor, keeps the latest name, and sorts by total descending', () => {
      const supporters = aggregateSupporters([
        donation({ donorId: 'a', amount: 10, fromName: 'Old Name', timestamp: '2026-01-01T00:00:00Z' }),
        donation({ donorId: 'a', amount: 15, fromName: 'New Name', timestamp: '2026-06-01T00:00:00Z' }),
        donation({ donorId: 'b', amount: 100, fromName: 'Big', timestamp: '2026-05-01T00:00:00Z' }),
      ]);
      expect(supporters.map((s) => s.donorId)).toEqual(['b', 'a']);
      expect(supporters[1].total).toBe(25);
      expect(supporters[1].name).toBe('New Name');
      expect(supporters[1].firstTimestamp).toBe('2026-01-01T00:00:00Z');
    });

    it('tracks monthly subscriptions and the 45-day active grace', () => {
      const now = new Date('2026-08-31T00:00:00Z');
      const supporters = aggregateSupporters(
        [
          donation({ donorId: 'sub', type: 'Monthly Tip', timestamp: '2026-08-20T00:00:00Z' }),
          donation({ donorId: 'sub', type: 'Monthly Tip', timestamp: '2026-07-20T00:00:00Z' }),
          donation({ donorId: 'lapsed', type: 'Monthly Tip', timestamp: '2026-01-01T00:00:00Z' }),
        ],
        now,
      );
      const sub = supporters.find((s) => s.donorId === 'sub')!;
      const lapsed = supporters.find((s) => s.donorId === 'lapsed')!;
      expect(sub.subscriptionMonths).toBe(2);
      expect(sub.isActiveSubscriber).toBe(true);
      expect(lapsed.isActiveSubscriber).toBe(false);
    });

    it('keeps the most recent non-empty message', () => {
      const supporters = aggregateSupporters([
        donation({ donorId: 'a', message: 'first!', timestamp: '2026-01-01T00:00:00Z' }),
        donation({ donorId: 'a', message: '', timestamp: '2026-06-01T00:00:00Z' }),
        donation({ donorId: 'a', message: 'latest words', timestamp: '2026-03-01T00:00:00Z' }),
      ]);
      expect(supporters[0].message).toBe('latest words');
    });
  });

  describe('placement', () => {
    const supporters = aggregateSupporters(
      Array.from({ length: 40 }, (_, i) =>
        donation({ donorId: `donor-${i}`, transactionId: `tx-${i}`, amount: 1 + (i % 7) * 10 }),
      ),
    );

    it('is deterministic: the same input yields the same sky, twice', () => {
      const a = placeStars(supporters, new Set());
      const b = placeStars(supporters, new Set());
      expect(a.map(({ x, y }) => [x, y])).toEqual(b.map(({ x, y }) => [x, y]));
    });

    it('keeps every star inside the sky bounds', () => {
      for (const star of placeStars(supporters, new Set())) {
        expect(star.x).toBeGreaterThanOrEqual(2);
        expect(star.x).toBeLessThanOrEqual(98);
        expect(star.y).toBeGreaterThanOrEqual(4);
        expect(star.y).toBeLessThanOrEqual(96);
      }
    });
  });

  describe('novas and names', () => {
    it('caps the pulsing stars at the newest arrivals', () => {
      const now = new Date('2026-08-31T00:00:00Z');
      const supporters = aggregateSupporters(
        Array.from({ length: 10 }, (_, i) =>
          donation({ donorId: `new-${i}`, transactionId: `t-${i}`, timestamp: `2026-08-${21 + (i % 9)}T00:00:00Z` }),
        ),
        now,
      );
      expect(pickNovaIds(supporters, now).size).toBe(MAX_NOVA_STARS);
    });

    it('shows placeholder donors as quiet supporters', () => {
      expect(isGenericName('Somebody')).toBe(true);
      expect(isGenericName('Ko-fi Supporter')).toBe(true);
      expect(isGenericName('Ada')).toBe(false);
      const supporters = aggregateSupporters([donation({ fromName: 'Anonymous' })]);
      expect(displayName(supporters[0])).toBe('A quiet supporter');
    });
  });

  it('formats totals with cents only when they exist', () => {
    expect(formatTotal(25)).toBe('$25');
    expect(formatTotal(1050)).toBe('$1,050');
    expect(formatTotal(7.5)).toBe('$7.50');
  });
});
