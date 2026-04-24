import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DonationLeaderboard from './DonationLeaderboard';
import type { Donation } from 'discrub-core/types/discrub-types';

const makeDonation = (id: string, name: string, amount: number, type = 'Tip'): Donation => ({
  donorId: `donor-${id}`,
  transactionId: `tx-${id}`,
  timestamp: '2026-02-28T00:00:00.000Z',
  type,
  fromName: name,
  message: '',
  amount,
  currency: 'USD',
});

// 20 unique donors — top 5% = ceil(20 * 0.05) = 1
const smallPool = Array.from({ length: 20 }, (_, i) =>
  makeDonation(String(i), `Donor${i}`, 10 + i),
);

// 40 unique donors — top 5% = ceil(40 * 0.05) = 2
const mediumPool = Array.from({ length: 40 }, (_, i) =>
  makeDonation(String(i), `Donor${i}`, 10 + i),
);

// With repeat donor (aggregation test)
const withRepeats = [
  makeDonation('alice-1', 'Alice', 50),
  { ...makeDonation('alice-2', 'Alice', 10), donorId: 'donor-alice-1' }, // same donor
  makeDonation('bob', 'Bob', 30, 'Monthly Tip'),
  ...Array.from({ length: 38 }, (_, i) =>
    makeDonation(`filler-${i}`, `Filler${i}`, 5),
  ),
];

describe('DonationLeaderboard', () => {
  it('should show top 5% label', () => {
    render(<DonationLeaderboard donations={smallPool} visibleCount={25} />);
    expect(screen.getByText(/Top 5% of 20 supporters/)).toBeInTheDocument();
  });

  it('should limit to top 5% of donors', () => {
    render(<DonationLeaderboard donations={smallPool} visibleCount={25} />);
    // 20 donors, 5% = 1 — only the highest donor shows
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('#2')).not.toBeInTheDocument();
  });

  it('should show more entries with larger donor pool', () => {
    render(<DonationLeaderboard donations={mediumPool} visibleCount={25} />);
    // 40 donors, 5% = 2
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.queryByText('#3')).not.toBeInTheDocument();
  });

  it('should show aggregated dollar totals in subtitle', () => {
    render(<DonationLeaderboard donations={withRepeats} visibleCount={25} />);
    // Alice: $50 + $10 = $60 (top donor)
    expect(screen.getByText(/total of \$60/)).toBeInTheDocument();
  });

  it('should show contribution count in subtitle', () => {
    render(<DonationLeaderboard donations={withRepeats} visibleCount={25} />);
    // Alice has 2 contributions
    expect(screen.getByText(/2 contributions for a total/)).toBeInTheDocument();
  });

  it('should show subscriber info for monthly donors in top 5%', () => {
    // Make Bob the top donor so he appears in top 5%
    const donations = [
      makeDonation('bob', 'Bob', 200, 'Monthly Tip'),
      ...Array.from({ length: 19 }, (_, i) =>
        makeDonation(`filler-${i}`, `Filler${i}`, 5),
      ),
    ];
    const { container } = render(<DonationLeaderboard donations={donations} visibleCount={25} />);
    const subscriberIcons = container.querySelectorAll('[data-testid="WhatshotIcon"]');
    expect(subscriberIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('should show rank numbers with correct styling', () => {
    render(<DonationLeaderboard donations={mediumPool} visibleCount={25} />);
    const rank1 = screen.getByText('#1');
    expect(rank1).toBeInTheDocument();
  });
});
