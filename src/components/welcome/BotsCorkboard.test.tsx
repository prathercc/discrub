import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import BotsCorkboard from './BotsCorkboard';
import { BOTS, BOT_IDEA_MAILTO, CORKBOARD_COLLAPSED_STORAGE_KEY } from './bots';

const stateGet = vi.fn();
const stateSet = vi.fn();
vi.mock('@/extension/storage', () => ({
  storage: {
    state: {
      get: (...args: unknown[]) => stateGet(...args),
      set: (...args: unknown[]) => stateSet(...args),
    },
  },
}));

describe('BotsCorkboard', () => {
  beforeEach(() => {
    stateGet.mockReset().mockResolvedValue(null);
    stateSet.mockReset().mockResolvedValue(undefined);
  });

  it('renders a pinned card for every bot with a counted install link', async () => {
    renderWithProviders(<BotsCorkboard />);
    for (const bot of BOTS) {
      expect(await screen.findByTestId(`corkboard-bot-${bot.id}`)).toBeInTheDocument();
      expect(screen.getByText(bot.name)).toBeInTheDocument();
      expect(screen.getByText(bot.tagline)).toBeInTheDocument();
    }
    const install = screen.getAllByRole('link', { name: 'Add to Discord' });
    expect(install).toHaveLength(BOTS.length);
    expect(install[0]).toHaveAttribute('href', 'https://pratherbytecraft.com/go/retrostat?from=discrub');
    expect(install[0]).toHaveAttribute('target', '_blank');
    expect(install[0]).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows the founders sticky note', async () => {
    renderWithProviders(<BotsCorkboard />);
    expect(await screen.findByTestId('corkboard-sticky')).toHaveTextContent(/first 100 servers/);
  });

  it('pins a note inviting bot ideas that mails the workbench address', async () => {
    renderWithProviders(<BotsCorkboard />);
    const note = await screen.findByTestId('corkboard-idea');
    expect(note).toHaveTextContent('Have an idea for a bot?');
    expect(screen.getByRole('link', { name: 'Tell me about it.' })).toHaveAttribute('href', BOT_IDEA_MAILTO);
    expect(BOT_IDEA_MAILTO).toMatch(/^mailto:workbench@pratherbytecraft\.com/);
  });

  it('never uses the reserved Discord words "verified" or "certified"', async () => {
    renderWithProviders(<BotsCorkboard />);
    const board = await screen.findByTestId('bots-corkboard');
    expect(board.textContent).not.toMatch(/verified|certified/i);
  });

  it('collapses on the chevron and persists the folded state', async () => {
    renderWithProviders(<BotsCorkboard />);
    await screen.findByTestId('corkboard-bot-retrostat');
    fireEvent.click(screen.getByRole('button', { name: 'Hide the board' }));
    expect(stateSet).toHaveBeenCalledWith(CORKBOARD_COLLAPSED_STORAGE_KEY, true);
    await waitFor(() => expect(screen.queryByTestId('corkboard-bot-retrostat')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Show the board' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('starts folded when the persisted flag is set and stays folded', async () => {
    stateGet.mockResolvedValue(true);
    renderWithProviders(<BotsCorkboard />);
    await waitFor(() => expect(stateGet).toHaveBeenCalledWith(CORKBOARD_COLLAPSED_STORAGE_KEY));
    expect(screen.getByRole('button', { name: 'Show the board' })).toBeInTheDocument();
    expect(screen.queryByTestId('corkboard-bot-retrostat')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show the board' }));
    expect(stateSet).toHaveBeenCalledWith(CORKBOARD_COLLAPSED_STORAGE_KEY, false);
    expect(await screen.findByTestId('corkboard-bot-retrostat')).toBeInTheDocument();
  });
});
