import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import BotNudge from './BotNudge';

describe('BotNudge', () => {
  it('shows one line with a Retrostat link', () => {
    renderWithProviders(<BotNudge />);
    const nudge = screen.getByTestId('bot-nudge');
    expect(nudge).toHaveTextContent('Want this every week, server-wide, without exporting? Retrostat does that.');
    const link = screen.getByRole('link', { name: 'Learn more' });
    expect(link).toHaveAttribute('href', 'https://pratherbytecraft.com/retrostat');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(nudge.textContent).not.toMatch(/verified|certified/i);
  });

  it('has no dismiss control', () => {
    renderWithProviders(<BotNudge />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
