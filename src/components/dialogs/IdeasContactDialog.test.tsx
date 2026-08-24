import { screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import IdeasContactDialog from './IdeasContactDialog';

describe('IdeasContactDialog', () => {
  it('lists email, commissions, bot request, and the company site', () => {
    renderWithProviders(<IdeasContactDialog open onClose={vi.fn()} />);
    expect(screen.getByTestId('contact-email')).toHaveAttribute('href', 'mailto:support@pratherbytecraft.com');
    expect(screen.getByTestId('contact-commissions')).toHaveAttribute('href', 'https://ko-fi.com/prathercc/commissions');
    expect(screen.getByTestId('contact-commissions')).toHaveAttribute('target', '_blank');
    expect(screen.getByTestId('contact-bot')).toHaveAttribute('href', 'mailto:workbench@pratherbytecraft.com?subject=Bot%20idea');
    expect(screen.getByTestId('contact-site')).toHaveAttribute('href', 'https://pratherbytecraft.com');
    expect(screen.getByTestId('contact-site')).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Sponsor a feature or commission a theme')).toBeInTheDocument();
    expect(screen.getByText('Request a Discord bot')).toBeInTheDocument();
    expect(screen.getByText('support@pratherbytecraft.com')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<IdeasContactDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Ideas & Contact')).toBeNull();
  });
});
