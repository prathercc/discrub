import { describe, it, expect } from 'vitest';
import { getTierInfo, getRelativeDate, filterDonationsByPeriod, sortDonationsByDollars, sortDonationsByNewest, aggregateDonors, buildSubscribers } from './donationUtils';
import { LeaderboardPeriod } from './donationTypes';
import type { Donation } from 'discrub-core/types/discrub-types';

const mockDonation = (overrides: Partial<Donation> = {}): Donation => ({
  donorId: 'hash123',
  transactionId: 'tx-001',
  timestamp: '2026-02-28T00:00:00.000Z',
  type: 'Tip',
  fromName: 'Supporter',
  message: '',
  amount: 10,
  currency: 'USD',
  ...overrides,
});

describe('getTierInfo', () => {
  it('should return Bit for amounts under $5', () => {
    expect(getTierInfo(0)).toEqual({ tier: 1, name: 'Bit', color: '#cd7f32' });
    expect(getTierInfo(4.99)).toEqual({ tier: 1, name: 'Bit', color: '#cd7f32' });
  });

  it('should return Byte for $5-$19', () => {
    expect(getTierInfo(5)).toEqual({ tier: 2, name: 'Byte', color: '#c0c0c0' });
    expect(getTierInfo(19.99)).toEqual({ tier: 2, name: 'Byte', color: '#c0c0c0' });
  });

  it('should return Kilobyte for $20-$49', () => {
    expect(getTierInfo(20)).toEqual({ tier: 3, name: 'Kilobyte', color: '#ffd700' });
    expect(getTierInfo(49.99)).toEqual({ tier: 3, name: 'Kilobyte', color: '#ffd700' });
  });

  it('should return Megabyte for $50-$99', () => {
    expect(getTierInfo(50)).toEqual({ tier: 4, name: 'Megabyte', color: '#e5e4e2' });
    expect(getTierInfo(99.99)).toEqual({ tier: 4, name: 'Megabyte', color: '#e5e4e2' });
  });

  it('should return Gigabyte for $100+', () => {
    expect(getTierInfo(100)).toEqual({ tier: 5, name: 'Gigabyte', color: '#b9f2ff' });
    expect(getTierInfo(500)).toEqual({ tier: 5, name: 'Gigabyte', color: '#b9f2ff' });
  });
});

describe('getRelativeDate', () => {
  const now = new Date('2026-02-28T12:00:00Z');

  it('should return "Today" for same day', () => {
    expect(getRelativeDate('2026-02-28', now)).toBe('Today');
  });

  it('should return "Yesterday" for one day ago', () => {
    expect(getRelativeDate('2026-02-27', now)).toBe('Yesterday');
  });

  it('should return "X days ago" for older dates', () => {
    expect(getRelativeDate('2026-02-25', now)).toBe('3 days ago');
    expect(getRelativeDate('2026-02-18', now)).toBe('10 days ago');
  });
});

describe('filterDonationsByPeriod', () => {
  // Use relative dates so tests don't break over time
  const now = Date.now();
  const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

  const donations: Donation[] = [
    mockDonation({ fromName: 'Alice', amount: 10, timestamp: daysAgo(1) }),
    mockDonation({ fromName: 'Bob', amount: 25, timestamp: daysAgo(5) }),
    mockDonation({ fromName: 'Charlie', amount: 50, timestamp: daysAgo(90) }),
  ];

  it('should return all donations for ALL_TIME', () => {
    const result = filterDonationsByPeriod(donations, LeaderboardPeriod.ALL_TIME);
    expect(result).toHaveLength(3);
  });

  it('should filter to last 30 days for LAST_30_DAYS', () => {
    const result = filterDonationsByPeriod(donations, LeaderboardPeriod.LAST_30_DAYS);
    expect(result).toHaveLength(2);
    expect(result.find((d) => d.fromName === 'Charlie')).toBeUndefined();
  });

  it('should keep recent donations for LAST_30_DAYS', () => {
    const result = filterDonationsByPeriod(donations, LeaderboardPeriod.LAST_30_DAYS);
    expect(result.find((d) => d.fromName === 'Alice')).toBeDefined();
    expect(result.find((d) => d.fromName === 'Bob')).toBeDefined();
  });
});

describe('sortDonationsByDollars', () => {
  const donations: Donation[] = [
    mockDonation({ fromName: 'Alice', amount: 10 }),
    mockDonation({ fromName: 'Bob', amount: 50 }),
    mockDonation({ fromName: 'Charlie', amount: 25 }),
  ];

  it('should sort donations by amount descending', () => {
    const result = sortDonationsByDollars(donations);
    expect(result[0].fromName).toBe('Bob');
    expect(result[1].fromName).toBe('Charlie');
    expect(result[2].fromName).toBe('Alice');
  });

  it('should not mutate the original array', () => {
    const original = [...donations];
    sortDonationsByDollars(donations);
    expect(donations).toEqual(original);
  });
});

describe('sortDonationsByNewest', () => {
  it('should sort newest first', () => {
    const donations: Donation[] = [
      mockDonation({ fromName: 'Old', timestamp: '2026-01-01T00:00:00.000Z' }),
      mockDonation({ fromName: 'New', timestamp: '2026-03-01T00:00:00.000Z' }),
      mockDonation({ fromName: 'Mid', timestamp: '2026-02-01T00:00:00.000Z' }),
    ];
    const result = sortDonationsByNewest(donations);
    expect(result[0].fromName).toBe('New');
    expect(result[1].fromName).toBe('Mid');
    expect(result[2].fromName).toBe('Old');
  });
});

describe('aggregateDonors', () => {
  it('should aggregate donations by donorId', () => {
    const donations: Donation[] = [
      mockDonation({ donorId: 'donor-a', fromName: 'Alice', amount: 10 }),
      mockDonation({ donorId: 'donor-a', fromName: 'Alice', amount: 20 }),
      mockDonation({ donorId: 'donor-b', fromName: 'Bob', amount: 50 }),
    ];
    const result = aggregateDonors(donations);
    expect(result).toHaveLength(2);
    // Bob: $50, Alice: $30 (sorted by total)
    expect(result[0].fromName).toBe('Bob');
    expect(result[0].totalAmount).toBe(50);
    expect(result[1].fromName).toBe('Alice');
    expect(result[1].totalAmount).toBe(30);
    expect(result[1].donationCount).toBe(2);
  });

  it('should track subscription months', () => {
    const donations: Donation[] = [
      mockDonation({ donorId: 'donor-a', type: 'Monthly Tip', amount: 5 }),
      mockDonation({ donorId: 'donor-a', type: 'Monthly Tip', amount: 5 }),
      mockDonation({ donorId: 'donor-a', type: 'Tip', amount: 20 }),
    ];
    const result = aggregateDonors(donations);
    expect(result[0].subscriptionMonths).toBe(2);
    expect(result[0].totalAmount).toBe(30);
  });

  it('should use most recent name for the donor', () => {
    const donations: Donation[] = [
      mockDonation({ donorId: 'donor-a', fromName: 'OldName', timestamp: '2026-01-01T00:00:00.000Z', amount: 10 }),
      mockDonation({ donorId: 'donor-a', fromName: 'NewName', timestamp: '2026-03-01T00:00:00.000Z', amount: 10 }),
    ];
    const result = aggregateDonors(donations);
    expect(result[0].fromName).toBe('NewName');
  });

  it('should sort by total amount descending', () => {
    const donations: Donation[] = [
      mockDonation({ donorId: 'donor-a', amount: 5 }),
      mockDonation({ donorId: 'donor-b', amount: 100 }),
      mockDonation({ donorId: 'donor-c', amount: 25 }),
    ];
    const result = aggregateDonors(donations);
    expect(result[0].totalAmount).toBe(100);
    expect(result[1].totalAmount).toBe(25);
    expect(result[2].totalAmount).toBe(5);
  });
});

describe('buildSubscribers', () => {
  const now = new Date('2026-03-01T00:00:00.000Z');

  it('should only include Monthly Tip donations', () => {
    const donations: Donation[] = [
      mockDonation({ donorId: 'a', type: 'Tip', amount: 100 }),
      mockDonation({ donorId: 'b', type: 'Monthly Tip', amount: 5 }),
    ];
    const result = buildSubscribers(donations, now);
    expect(result).toHaveLength(1);
    expect(result[0].donorId).toBe('b');
  });

  it('should count subscription months per donor', () => {
    const donations: Donation[] = [
      mockDonation({ donorId: 'a', type: 'Monthly Tip', amount: 5, timestamp: '2026-01-01T00:00:00.000Z' }),
      mockDonation({ donorId: 'a', type: 'Monthly Tip', amount: 5, timestamp: '2026-02-01T00:00:00.000Z' }),
      mockDonation({ donorId: 'a', type: 'Monthly Tip', amount: 5, timestamp: '2026-03-01T00:00:00.000Z' }),
    ];
    const result = buildSubscribers(donations, now);
    expect(result[0].months).toBe(3);
    expect(result[0].totalSubscriptionAmount).toBe(15);
  });

  it('should mark active subscribers (payment within 45 days)', () => {
    const donations: Donation[] = [
      mockDonation({ donorId: 'active', type: 'Monthly Tip', timestamp: '2026-02-15T00:00:00.000Z' }),
      mockDonation({ donorId: 'inactive', type: 'Monthly Tip', timestamp: '2025-06-01T00:00:00.000Z' }),
    ];
    const result = buildSubscribers(donations, now);
    const active = result.find((s) => s.donorId === 'active');
    const inactive = result.find((s) => s.donorId === 'inactive');
    expect(active?.isActive).toBe(true);
    expect(inactive?.isActive).toBe(false);
  });

  it('should sort active before inactive, then by months desc', () => {
    const donations: Donation[] = [
      mockDonation({ donorId: 'inactive-long', type: 'Monthly Tip', timestamp: '2025-01-01T00:00:00.000Z' }),
      mockDonation({ donorId: 'inactive-long', type: 'Monthly Tip', timestamp: '2025-02-01T00:00:00.000Z' }),
      mockDonation({ donorId: 'inactive-long', type: 'Monthly Tip', timestamp: '2025-03-01T00:00:00.000Z' }),
      mockDonation({ donorId: 'active-short', type: 'Monthly Tip', timestamp: '2026-02-20T00:00:00.000Z' }),
    ];
    const result = buildSubscribers(donations, now);
    expect(result[0].donorId).toBe('active-short');
    expect(result[0].isActive).toBe(true);
    expect(result[1].donorId).toBe('inactive-long');
    expect(result[1].isActive).toBe(false);
    expect(result[1].months).toBe(3);
  });
});
