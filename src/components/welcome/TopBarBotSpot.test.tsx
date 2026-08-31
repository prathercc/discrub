import { act, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import TopBarBotSpot from './TopBarBotSpot';
import { BOTS, installUrlFor } from './bots';

describe('TopBarBotSpot', () => {
  it('shows one bot at a time with the DISCORD BOT badge and both actions', () => {
    renderWithProviders(<TopBarBotSpot />);
    const first = BOTS[0];
    const card = screen.getByTestId('bot-spot-card');
    expect(card).toHaveTextContent(first.name);
    expect(card).toHaveTextContent('DISCORD BOT');
    expect(card).toHaveTextContent(first.tagline);
    // The card body is inert; the page link lives on the info button alone.
    expect(card).not.toHaveAttribute('href');
    expect(screen.getByTestId('bot-spot-add')).toHaveAttribute(
      'href',
      installUrlFor(first.id, 'discrub-topbar'),
    );
    expect(screen.getByTestId('bot-spot-info')).toHaveAttribute('href', first.pageUrl);
  });

  it('skips through every bot with the player controls, wrapping around', () => {
    renderWithProviders(<TopBarBotSpot />);
    for (const bot of BOTS.slice(1)) {
      fireEvent.click(screen.getByTestId('bot-spot-next'));
      expect(screen.getByTestId('bot-spot-card')).toHaveTextContent(bot.name);
      expect(screen.getByTestId('bot-spot-add')).toHaveAttribute(
        'href',
        installUrlFor(bot.id, 'discrub-topbar'),
      );
    }
    fireEvent.click(screen.getByTestId('bot-spot-next'));
    expect(screen.getByTestId('bot-spot-card')).toHaveTextContent(BOTS[0].name);
    fireEvent.click(screen.getByTestId('bot-spot-prev'));
    expect(screen.getByTestId('bot-spot-card')).toHaveTextContent(BOTS[BOTS.length - 1].name);
  });

  it('rotates on its own, and a manual skip earns the longer grace before resuming', () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(<TopBarBotSpot rotateMs={5000} />);
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId('bot-spot-card')).toHaveTextContent(BOTS[1].name);
      fireEvent.click(screen.getByTestId('bot-spot-prev'));
      expect(screen.getByTestId('bot-spot-card')).toHaveTextContent(BOTS[0].name);
      act(() => {
        vi.advanceTimersByTime(19000);
      });
      expect(screen.getByTestId('bot-spot-card')).toHaveTextContent(BOTS[0].name);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('bot-spot-card')).toHaveTextContent(BOTS[1].name);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never flips while the pointer is over the spot', () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(<TopBarBotSpot rotateMs={5000} />);
      fireEvent.mouseEnter(screen.getByTestId('topbar-bot-spot'));
      act(() => {
        vi.advanceTimersByTime(15000);
      });
      expect(screen.getByTestId('bot-spot-card')).toHaveTextContent(BOTS[0].name);
      fireEvent.mouseLeave(screen.getByTestId('topbar-bot-spot'));
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId('bot-spot-card')).toHaveTextContent(BOTS[1].name);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never uses the reserved Discord words "verified" or "certified"', () => {
    renderWithProviders(<TopBarBotSpot />);
    expect(screen.getByTestId('topbar-bot-spot').textContent).not.toMatch(/verified|certified/i);
  });
});
