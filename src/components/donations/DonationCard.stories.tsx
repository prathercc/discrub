import type { Meta, StoryObj } from '@storybook/react';
import DonationCard from './DonationCard';
import type { Donation } from 'discrub-core/types/discrub-types';

const baseDonation: Donation = {
  donorId: 'donor-1',
  transactionId: 'tx-001',
  timestamp: new Date().toISOString(),
  type: 'Tip',
  fromName: 'Alice',
  message: '',
  amount: 10,
  currency: 'USD',
};

const monthsAgo = (months: number) =>
  new Date(Date.now() - months * 30 * 86400000).toISOString();

/** Build a sequence of Monthly Tip payments for streak calculation */
const buildSubscriptionHistory = (donorId: string, name: string, months: number): Donation[] =>
  Array.from({ length: months }, (_, i) => ({
    donorId,
    transactionId: `${donorId}-sub-${i}`,
    timestamp: monthsAgo(i),
    type: 'Monthly Tip' as const,
    fromName: name,
    message: '',
    amount: 5,
    currency: 'USD',
  }));

const meta: Meta<typeof DonationCard> = {
  title: 'Donations/DonationCard',
  component: DonationCard,
  tags: ['autodocs'],
  decorators: [(Story) => <div style={{ maxWidth: 300, padding: 16 }}><Story /></div>],
};
export default meta;

type Story = StoryObj<typeof DonationCard>;

export const CopperTier: Story = {
  args: { donation: { ...baseDonation, amount: 3 }, index: 0 },
};

export const SilverTier: Story = {
  args: { donation: { ...baseDonation, amount: 10 }, index: 0 },
};

export const GoldTier: Story = {
  args: { donation: { ...baseDonation, amount: 25 }, index: 0 },
};

export const PlatinumTier: Story = {
  args: { donation: { ...baseDonation, amount: 75 }, index: 0 },
};

export const DiamondTier: Story = {
  args: { donation: { ...baseDonation, amount: 150 }, index: 0 },
};

export const WithMessage: Story = {
  args: {
    donation: { ...baseDonation, message: 'Thanks for building this amazing tool! It helped me preserve important memories.' },
    index: 0,
  },
};

export const MessageAutoExpanded: Story = {
  name: 'Message (initialExpanded)',
  args: {
    donation: { ...baseDonation, message: 'This message starts expanded thanks to the initialExpanded prop.' },
    index: 0,
    initialExpanded: true,
  },
};

export const MonthlySubscriber: Story = {
  args: {
    donation: { ...baseDonation, type: 'Monthly Tip', amount: 5 },
    index: 0,
  },
};

export const SubscriptionStreak: Story = {
  name: 'Subscription Streak (6 months, flame ribbon)',
  args: (() => {
    const history = buildSubscriptionHistory('donor-1', 'Alice', 6);
    return {
      donation: history[0],
      donations: history,
      index: 0,
    };
  })(),
};

export const SubscriptionStreakLong: Story = {
  name: 'Subscription Streak (12 months, ascended)',
  args: (() => {
    const history = buildSubscriptionHistory('donor-1', 'Alice', 12);
    return {
      donation: history[0],
      donations: history,
      index: 0,
    };
  })(),
};

export const GoldRankRibbon: Story = {
  name: 'Top Supporter (#1 gold ribbon)',
  args: {
    donation: { ...baseDonation, amount: 150 },
    index: 0,
    supporterRank: 1,
  },
};

export const SilverRankRibbon: Story = {
  name: 'Top Supporter (#2 silver ribbon)',
  args: {
    donation: { ...baseDonation, amount: 75 },
    index: 0,
    supporterRank: 2,
  },
};

export const BronzeRankRibbon: Story = {
  name: 'Top Supporter (#3 bronze ribbon)',
  args: {
    donation: { ...baseDonation, amount: 50 },
    index: 0,
    supporterRank: 3,
  },
};

export const RankWithStreak: Story = {
  name: 'Rank ribbon + subscription streak combined',
  args: (() => {
    const history = buildSubscriptionHistory('donor-1', 'Alice', 8);
    // Override amount to something higher for visual interest
    const latest = { ...history[0], amount: 25 };
    return {
      donation: latest,
      donations: [latest, ...history.slice(1)],
      index: 0,
      supporterRank: 1,
    };
  })(),
};

export const LongName: Story = {
  args: {
    donation: { ...baseDonation, fromName: 'A Very Long Donor Name That Should Be Truncated', amount: 50 },
    index: 0,
  },
};
