export enum DonationView {
  FEED = 'FEED',
  LEADERBOARD = 'LEADERBOARD',
  SKY = 'SKY',
}

export enum LeaderboardPeriod {
  ALL_TIME = 'ALL_TIME',
  LAST_30_DAYS = 'LAST_30_DAYS',
}

export interface TierInfo {
  tier: 1 | 2 | 3 | 4 | 5;
  name: string;
  color: string;
}

export interface AggregatedDonor {
  donorId: string;
  fromName: string;
  totalAmount: number;
  donationCount: number;
  subscriptionMonths: number;
  latestTimestamp: string;
}

export interface SubscriberInfo {
  donorId: string;
  fromName: string;
  months: number;
  totalSubscriptionAmount: number;
  /** Whether their most recent subscription payment was within the last ~45 days */
  isActive: boolean;
  latestPaymentTimestamp: string;
  firstPaymentTimestamp: string;
}

export type StreakTier = 'ember' | 'blaze' | 'inferno';

export function getStreakTier(months: number): StreakTier {
  if (months >= 6) return 'inferno';
  if (months >= 3) return 'blaze';
  return 'ember';
}

