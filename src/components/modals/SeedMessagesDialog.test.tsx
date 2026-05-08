import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { createBaseState } from '@/test/state-factories';
import { ChannelType } from 'discrub-core/discord-enum';
import SeedMessagesDialog from './SeedMessagesDialog';

const mockSeed = vi.fn();
vi.mock('@features/dev/devSlice', async () => {
  const actual = await vi.importActual<typeof import('@features/dev/devSlice')>(
    '@features/dev/devSlice',
  );
  return {
    ...actual,
    seedChannelMessages: (...args: unknown[]) => {
      mockSeed(...args);
      return { type: 'dev/seedChannelMessages/pending' };
    },
  };
});

function stateWith() {
  const state = createBaseState();
  // Two text channels in the active server.
  (state.channel as any).channels = [
    { id: 'c1', name: 'general', type: ChannelType.GUILD_TEXT },
    { id: 'c2', name: 'random', type: ChannelType.GUILD_TEXT },
    { id: 'voice', name: 'voice', type: ChannelType.GUILD_VOICE },
  ];
  (state.guild as any).selectedGuild = { id: 'g1', name: 'Test Server', owner_id: 'self' };
  (state.user as any).currentUser = { id: 'self', username: 'me' };
  return state;
}

describe('SeedMessagesDialog', () => {
  it('renders only text channels in the picker', () => {
    renderWithProviders(<SeedMessagesDialog open onClose={() => {}} />, {
      preloadedState: stateWith(),
    });
    expect(screen.getByText('#general')).toBeInTheDocument();
    expect(screen.getByText('#random')).toBeInTheDocument();
    expect(screen.queryByText('#voice')).not.toBeInTheDocument();
  });

  it('disables Start until at least one channel is selected', () => {
    renderWithProviders(<SeedMessagesDialog open onClose={() => {}} />, {
      preloadedState: stateWith(),
    });
    const start = screen.getByTestId('seed-start');
    expect(start).toBeDisabled();
    fireEvent.click(screen.getByTestId('seed-channel-c1'));
    expect(start).not.toBeDisabled();
  });

  it('all variety options default to ON', () => {
    renderWithProviders(<SeedMessagesDialog open onClose={() => {}} />, {
      preloadedState: stateWith(),
    });
    const checkboxes = screen.getAllByRole('checkbox');
    // First N checkboxes are channel selectors (unchecked), then the
    // five variety checkboxes (all checked). Filter to find the
    // checked ones explicitly.
    const checked = checkboxes.filter((c) => (c as HTMLInputElement).checked);
    // 5 variety options, all on by default.
    expect(checked.length).toBe(5);
  });

  it('Select all + Clear bulk-toggle the channel set', () => {
    renderWithProviders(<SeedMessagesDialog open onClose={() => {}} />, {
      preloadedState: stateWith(),
    });
    fireEvent.click(screen.getByText('Select all'));
    const start = screen.getByTestId('seed-start');
    expect(start).not.toBeDisabled();
    fireEvent.click(screen.getByText('Clear'));
    expect(start).toBeDisabled();
  });

  it('shows the live total + estimated time', () => {
    renderWithProviders(<SeedMessagesDialog open onClose={() => {}} />, {
      preloadedState: stateWith(),
    });
    fireEvent.click(screen.getByText('Select all'));
    // 2 channels × default 25 = 50. The total + ETA line is a single
    // Typography whose children are a mix of text and <strong>; match
    // the parent's collapsed textContent rather than a single text node.
    // The total line is a single Typography; assert via the
    // collapsed textContent on its closest ancestor that's unique.
    const totalLines = screen.getAllByText((_content, node) =>
      !!node?.textContent?.match(/2 channels.*25.*= 50 messages.*Estimated/i),
    );
    expect(totalLines.length).toBeGreaterThan(0);
  });

  it('Start dispatches the seed thunk with selected channels and options', () => {
    renderWithProviders(<SeedMessagesDialog open onClose={() => vi.fn()} />, {
      preloadedState: stateWith(),
    });
    fireEvent.click(screen.getByTestId('seed-channel-c1'));
    fireEvent.click(screen.getByTestId('seed-start'));
    expect(mockSeed).toHaveBeenCalledOnce();
    const arg = mockSeed.mock.calls[0][0];
    expect(arg.channels).toEqual([{ id: 'c1', name: 'general' }]);
    expect(arg.countPerChannel).toBe(25);
    expect(arg.options.includeMentions).toBe(true);
  });
});
