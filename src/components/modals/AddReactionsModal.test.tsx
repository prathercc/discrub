import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddReactionsModal from './AddReactionsModal';
import type { Message } from 'discrub-core/types/discord-types';

// Stub the picker so the modal's counter + confirm logic can be driven directly.
vi.mock('@components/ui/ReactionEmojiPicker', () => ({
  default: ({ onToggle }: { onToggle: (e: { id?: string; name: string }) => void }) => (
    <div>
      <button onClick={() => onToggle({ name: '🔥' })}>toggle-fire</button>
      <button onClick={() => onToggle({ id: '1', name: 'pepe' })}>toggle-pepe</button>
    </div>
  ),
}));

const messages = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }] as Message[];

describe('AddReactionsModal (Backlog #202)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the live M × N = T cost as emojis are toggled', () => {
    render(<AddReactionsModal open onClose={vi.fn()} selectedMessages={messages} onConfirm={vi.fn()} />);

    expect(screen.getByText('Pick at least one emoji to add.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('toggle-fire'));
    expect(screen.getByText('3 messages × 1 emoji = 3 reactions')).toBeInTheDocument();

    fireEvent.click(screen.getByText('toggle-pepe'));
    expect(screen.getByText('3 messages × 2 emojis = 6 reactions')).toBeInTheDocument();

    // Toggling fire off again drops back to 1 emoji
    fireEvent.click(screen.getByText('toggle-fire'));
    expect(screen.getByText('3 messages × 1 emoji = 3 reactions')).toBeInTheDocument();
  });

  it('disables Add until at least one emoji is selected', () => {
    render(<AddReactionsModal open onClose={vi.fn()} selectedMessages={messages} onConfirm={vi.fn()} />);
    const addBtn = screen.getByRole('button', { name: /^Add/ });
    expect(addBtn).toBeDisabled();

    fireEvent.click(screen.getByText('toggle-fire'));
    expect(screen.getByRole('button', { name: /^Add 3/ })).toBeEnabled();
  });

  it('confirms with the selected messages + emojis and closes', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<AddReactionsModal open onClose={onClose} selectedMessages={messages} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('toggle-fire'));
    fireEvent.click(screen.getByText('toggle-pepe'));
    fireEvent.click(screen.getByRole('button', { name: /^Add 6/ }));

    expect(onConfirm).toHaveBeenCalledWith({
      messages,
      emojis: [{ name: '🔥' }, { id: '1', name: 'pepe' }],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('resets the selection when reopened', () => {
    const { rerender } = render(
      <AddReactionsModal open onClose={vi.fn()} selectedMessages={messages} onConfirm={vi.fn()} />
    );
    fireEvent.click(screen.getByText('toggle-fire'));
    expect(screen.getByText('3 messages × 1 emoji = 3 reactions')).toBeInTheDocument();

    rerender(<AddReactionsModal open={false} onClose={vi.fn()} selectedMessages={messages} onConfirm={vi.fn()} />);
    rerender(<AddReactionsModal open onClose={vi.fn()} selectedMessages={messages} onConfirm={vi.fn()} />);

    expect(screen.getByText('Pick at least one emoji to add.')).toBeInTheDocument();
  });
});
