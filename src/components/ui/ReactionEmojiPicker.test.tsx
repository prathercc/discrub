import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReactionEmojiPicker from './ReactionEmojiPicker';
import type { Emoji } from 'discrub-core/types/discord-types';

// Keep the real builder/resolver; only stub the lazy dataset loader with a tiny set.
vi.mock('@/utils/emojiDataset', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/emojiDataset')>();
  const ds = actual.buildEmojiDataset(
    [
      { hexcode: '1F600', unicode: '😀', label: 'grinning face', group: 0, order: 1 },
      { hexcode: '1F525', unicode: '🔥', label: 'fire', group: 5, order: 2 },
      { hexcode: '1F436', unicode: '🐶', label: 'dog face', group: 3, order: 3 },
    ],
    { '1F600': 'grinning', '1F525': 'fire', '1F436': 'dog' }
  );
  return { ...actual, loadEmojiDataset: vi.fn().mockResolvedValue(ds) };
});

const guildEmojis: Emoji[] = [
  { id: '111', name: 'pepe', animated: false, available: true },
  { id: '222', name: 'catjam', animated: true, available: true },
  { id: '333', name: 'gone', animated: false, available: false }, // unavailable → filtered out
];

describe('ReactionEmojiPicker (Backlog #202)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders available server emojis (not unavailable ones) and toggles on click', async () => {
    const onToggle = vi.fn();
    render(<ReactionEmojiPicker selected={[]} onToggle={onToggle} guildEmojis={guildEmojis} />);

    expect(screen.getByRole('button', { name: ':pepe:' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ':catjam:' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ':gone:' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: ':pepe:' }));
    expect(onToggle).toHaveBeenCalledWith({ id: '111', name: 'pepe', animated: false });
  });

  it('renders the unicode set once the dataset loads', async () => {
    render(<ReactionEmojiPicker selected={[]} onToggle={vi.fn()} guildEmojis={[]} />);
    expect(await screen.findByRole('button', { name: ':fire:' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ':grinning:' })).toBeInTheDocument();
  });

  it('marks selected emojis as pressed', async () => {
    render(
      <ReactionEmojiPicker
        selected={[{ id: '111', name: 'pepe', animated: false }]}
        onToggle={vi.fn()}
        guildEmojis={guildEmojis}
      />
    );
    expect(screen.getByRole('button', { name: ':pepe:' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: ':catjam:' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('filters both server and unicode emojis by the search query', async () => {
    render(<ReactionEmojiPicker selected={[]} onToggle={vi.fn()} guildEmojis={guildEmojis} />);
    await screen.findByRole('button', { name: ':fire:' });

    fireEvent.change(screen.getByLabelText('Search emojis by name'), { target: { value: 'fire' } });

    expect(screen.getByRole('button', { name: ':fire:' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ':grinning:' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ':pepe:' })).not.toBeInTheDocument();
  });

  it('resolves the paste box: shortcode succeeds, garbage errors', async () => {
    const onToggle = vi.fn();
    render(<ReactionEmojiPicker selected={[]} onToggle={onToggle} guildEmojis={[]} />);
    await screen.findByRole('button', { name: ':fire:' });

    const pasteInput = screen.getByLabelText('Paste an emoji or shortcode');

    fireEvent.change(pasteInput, { target: { value: ':fire:' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onToggle).toHaveBeenCalledWith({ name: '🔥' });

    fireEvent.change(pasteInput, { target: { value: 'not-an-emoji' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.getByText('Not a recognized emoji')).toBeInTheDocument());
  });
});
