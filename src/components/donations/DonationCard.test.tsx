import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DonationCard from './DonationCard';
import type { Donation } from 'discrub-core/types/discrub-types';

const baseDonation: Donation = {
  donorId: 'hash123',
  transactionId: 'tx-001',
  timestamp: new Date().toISOString().split('T')[0],
  type: 'Tip',
  fromName: 'TestDonor',
  message: 'Thanks for the tool!',
  amount: 25,
  currency: 'USD',
};

describe('DonationCard', () => {
  it('should render donor name', () => {
    render(<DonationCard donation={baseDonation} index={0} />);
    expect(screen.getByText('TestDonor')).toBeInTheDocument();
  });

  it('should render dollar amount badge', () => {
    render(<DonationCard donation={baseDonation} index={0} />);
    expect(screen.getByText('$25')).toBeInTheDocument();
  });

  it('should render relative date', () => {
    render(<DonationCard donation={baseDonation} index={0} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('should expand message on click', () => {
    render(<DonationCard donation={baseDonation} index={0} />);
    // Initially collapsed — the Collapse hidden wrapper has display none or hidden
    const collapseRoot = screen.getByText(/Thanks for the tool!/).closest('.MuiCollapse-root');
    expect(collapseRoot).toHaveClass('MuiCollapse-hidden');

    fireEvent.click(screen.getByText('TestDonor'));
    // After click, collapse is no longer hidden
    expect(collapseRoot).not.toHaveClass('MuiCollapse-hidden');
  });

  it('should not show expand icon when no message', () => {
    const noMsg: Donation = { ...baseDonation, message: '' };
    render(<DonationCard donation={noMsg} index={0} />);
    expect(screen.queryByTestId('ExpandMoreIcon')).toBeNull();
  });

  it('should apply tier-based chip color for high amounts', () => {
    const legend: Donation = { ...baseDonation, amount: 150 };
    render(<DonationCard donation={legend} index={0} />);
    const chip = screen.getByText('$150');
    expect(chip.closest('.MuiChip-root')).toHaveStyle('background-color: #b9f2ff');
  });
});
