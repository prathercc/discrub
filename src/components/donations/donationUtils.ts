import { differenceInDays, parseISO, subDays, isAfter } from 'date-fns';
import type { Donation } from 'discrub-core/types/discrub-types';
import { LeaderboardPeriod } from './donationTypes';
import type { TierInfo, AggregatedDonor, SubscriberInfo } from './donationTypes';

export function getTierInfo(dollars: number): TierInfo {
  if (dollars >= 100) return { tier: 5, name: 'Diamond', color: '#b9f2ff' };
  if (dollars >= 50) return { tier: 4, name: 'Platinum', color: '#e5e4e2' };
  if (dollars >= 20) return { tier: 3, name: 'Gold', color: '#ffd700' };
  if (dollars >= 5) return { tier: 2, name: 'Silver', color: '#c0c0c0' };
  return { tier: 1, name: 'Copper', color: '#cd7f32' };
}

export function getRelativeDate(dateStr: string, now: Date = new Date()): string {
  const date = parseISO(dateStr);
  const days = differenceInDays(now, date);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function getChipTextColor(tier: TierInfo['tier']): string {
  return tier === 1 ? '#fff' : '#1a1a2e';
}

export function filterDonationsByPeriod(
  donations: Donation[],
  period: LeaderboardPeriod,
): Donation[] {
  if (period === LeaderboardPeriod.ALL_TIME) return donations;

  const cutoff = subDays(new Date(), 30);
  return donations.filter((d) => isAfter(parseISO(d.timestamp), cutoff));
}

export function sortDonationsByDollars(donations: Donation[]): Donation[] {
  return [...donations].sort((a, b) => b.amount - a.amount);
}

export function sortDonationsByNewest(donations: Donation[]): Donation[] {
  return [...donations].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Aggregate donations by donorId — sums total amount, counts contributions,
 * tracks subscription months, and uses the most recent donation's display name.
 */
export function aggregateDonors(donations: Donation[]): AggregatedDonor[] {
  const map = new Map<string, AggregatedDonor>();

  for (const d of donations) {
    const existing = map.get(d.donorId);
    if (existing) {
      existing.totalAmount += d.amount;
      existing.donationCount += 1;
      if (d.type === 'Monthly Tip') existing.subscriptionMonths += 1;
      // Use the most recent donation's name
      if (new Date(d.timestamp) > new Date(existing.latestTimestamp)) {
        existing.fromName = d.fromName;
        existing.latestTimestamp = d.timestamp;
      }
    } else {
      map.set(d.donorId, {
        donorId: d.donorId,
        fromName: d.fromName,
        totalAmount: d.amount,
        donationCount: 1,
        subscriptionMonths: d.type === 'Monthly Tip' ? 1 : 0,
        latestTimestamp: d.timestamp,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Build subscriber info from donation data.
 * Groups Monthly Tip donations by donorId, calculates streak and active status.
 * Active = most recent subscription payment within last 45 days.
 */
export function buildSubscribers(donations: Donation[], now: Date = new Date()): SubscriberInfo[] {
  const map = new Map<string, SubscriberInfo>();
  const cutoff = subDays(now, 45); // 45 days grace period for "active"

  for (const d of donations) {
    if (d.type !== 'Monthly Tip') continue;

    const existing = map.get(d.donorId);
    const ts = new Date(d.timestamp);

    if (existing) {
      existing.months += 1;
      existing.totalSubscriptionAmount += d.amount;
      if (ts > new Date(existing.latestPaymentTimestamp)) {
        existing.latestPaymentTimestamp = d.timestamp;
        existing.fromName = d.fromName;
        existing.isActive = isAfter(ts, cutoff);
      }
      if (ts < new Date(existing.firstPaymentTimestamp)) {
        existing.firstPaymentTimestamp = d.timestamp;
      }
    } else {
      map.set(d.donorId, {
        donorId: d.donorId,
        fromName: d.fromName,
        months: 1,
        totalSubscriptionAmount: d.amount,
        isActive: isAfter(ts, cutoff),
        latestPaymentTimestamp: d.timestamp,
        firstPaymentTimestamp: d.timestamp,
      });
    }
  }

  // Sort: active first (by months desc), then inactive (by months desc)
  return Array.from(map.values()).sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.months - a.months;
  });
}
