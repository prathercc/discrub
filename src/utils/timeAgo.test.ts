import { describe, it, expect } from 'vitest';
import { timeAgo } from './timeAgo';

describe('timeAgo', () => {
  it('returns "just now" within 1 minute', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe('just now');
  });

  it('returns "X minutes ago"', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5 minutes ago');
  });

  it('returns "X hours ago"', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe('3 hours ago');
  });

  it('returns "X days ago"', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoDaysAgo)).toBe('2 days ago');
  });

  it('returns "X months ago"', () => {
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeMonthsAgo)).toBe('3 months ago');
  });
});
