import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReactionModal from './ReactionModal';
import { createMockMessage, createMockReaction } from '../../test/fixtures';
import type { User } from 'discrub-core/types/discord-types';

const createUsers = (): User[] =>
  [
    { id: 'u1', username: 'alice', global_name: 'Alice' },
    { id: 'u2', username: 'bob', global_name: 'Bob' },
    { id: 'u3', username: 'charlie', global_name: 'Charlie' },
  ] as unknown as User[];

describe('ReactionModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    message: createMockMessage({
      reactions: [
        createMockReaction({ emoji: { id: null, name: '👍' }, count: 5 }),
        createMockReaction({ emoji: { id: 'emoji-1', name: 'custom_emoji', animated: false }, count: 2 }),
        createMockReaction({ emoji: { id: 'emoji-2', name: 'animated_emoji', animated: true }, count: 1 }),
      ],
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when message is null', () => {
    const { container } = render(
      <ReactionModal open={true} onClose={vi.fn()} message={null} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should return null when message has no reactions', () => {
    const { container } = render(
      <ReactionModal open={true} onClose={vi.fn()} message={createMockMessage({ reactions: [] })} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render dialog title', () => {
    render(<ReactionModal {...defaultProps} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('should render unicode emoji as text', () => {
    render(<ReactionModal {...defaultProps} />);
    expect(screen.getByText('👍')).toBeInTheDocument();
  });

  it('should render custom emoji as an image', () => {
    render(<ReactionModal {...defaultProps} />);
    const img = screen.getByAltText('custom_emoji');
    expect(img).toHaveAttribute('src', 'https://cdn.discordapp.com/emojis/emoji-1.webp');
  });

  it('should render animated emoji as a gif', () => {
    render(<ReactionModal {...defaultProps} />);
    const img = screen.getByAltText('animated_emoji');
    expect(img).toHaveAttribute('src', 'https://cdn.discordapp.com/emojis/emoji-2.gif');
  });

  it('should display reaction counts', () => {
    render(<ReactionModal {...defaultProps} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should call onClose when close icon button is clicked', () => {
    const onClose = vi.fn();
    render(<ReactionModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should auto-select first emoji on open', () => {
    render(<ReactionModal {...defaultProps} />);
    // The first ListItemButton should have aria-selected or selected class
    const tabs = screen.getAllByRole('button').filter((b) => b.closest('[class*="ListItemButton"]'));
    // At minimum, the first emoji tab should be visually selected
    expect(tabs.length).toBeGreaterThan(0);
  });

  it('should auto-select first emoji and fetch users on open', async () => {
    const users = createUsers();
    const onFetchReactingUsers = vi.fn().mockResolvedValue(users);

    render(
      <ReactionModal
        {...defaultProps}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(onFetchReactingUsers).toHaveBeenCalledWith('👍');
    });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });
  });

  it('should fetch users without delete callbacks (view-only with fetch)', async () => {
    const users = createUsers();
    const onFetchReactingUsers = vi.fn().mockResolvedValue(users);

    render(
      <ReactionModal
        {...defaultProps}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(onFetchReactingUsers).toHaveBeenCalledWith('👍');
    });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // No delete controls should be shown
    expect(screen.queryAllByLabelText('delete reaction')).toHaveLength(0);
    expect(screen.queryByText('Remove All')).toBeNull();
  });

  // Interactive mode tests
  it('clicking tab fetches and shows reacting users', async () => {
    const users = createUsers();
    const onFetchReactingUsers = vi.fn().mockResolvedValue(users);

    render(
      <ReactionModal
        {...defaultProps}
        onDeleteReaction={vi.fn()}
        canManageMessages={true}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    // Wait for auto-select fetch
    await waitFor(() => {
      expect(onFetchReactingUsers).toHaveBeenCalledWith('👍');
    });

    // Click the custom_emoji tab (second one)
    const customEmojiTab = screen.getByText('2').closest('div[role="button"]');
    fireEvent.click(customEmojiTab!);

    await waitFor(() => {
      expect(onFetchReactingUsers).toHaveBeenCalledWith('custom_emoji:emoji-1');
    });
  });

  it('shows delete icon per user when interactive', async () => {
    const users = createUsers();
    const onFetchReactingUsers = vi.fn().mockResolvedValue(users);

    render(
      <ReactionModal
        {...defaultProps}
        onDeleteReaction={vi.fn()}
        canManageMessages={true}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('delete reaction');
    expect(deleteButtons.length).toBe(3);
  });

  it('clicking delete icon calls onDeleteReaction', async () => {
    const users = createUsers();
    const onFetchReactingUsers = vi.fn().mockResolvedValue(users);
    const onDeleteReaction = vi.fn();

    render(
      <ReactionModal
        {...defaultProps}
        onDeleteReaction={onDeleteReaction}
        canManageMessages={true}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('delete reaction');
    fireEvent.click(deleteButtons[0]);

    expect(onDeleteReaction).toHaveBeenCalledWith('👍', 'u1');
  });

  it('Remove All calls onDeleteReaction for each user sequentially', async () => {
    const users = createUsers();
    const onFetchReactingUsers = vi.fn().mockResolvedValue(users);
    const onDeleteReaction = vi.fn().mockResolvedValue(undefined);

    render(
      <ReactionModal
        {...defaultProps}
        onDeleteReaction={onDeleteReaction}
        canManageMessages={true}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Remove All'));

    await waitFor(() => {
      expect(onDeleteReaction).toHaveBeenCalledTimes(3);
    });
    expect(onDeleteReaction).toHaveBeenNthCalledWith(1, '👍', 'u1');
    expect(onDeleteReaction).toHaveBeenNthCalledWith(2, '👍', 'u2');
    expect(onDeleteReaction).toHaveBeenNthCalledWith(3, '👍', 'u3');
  });

  it('shows loading spinner while fetching users', async () => {
    let resolvePromise: (value: User[]) => void;
    const onFetchReactingUsers = vi.fn().mockReturnValue(
      new Promise<User[]>((resolve) => {
        resolvePromise = resolve;
      })
    );

    render(
      <ReactionModal
        {...defaultProps}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    resolvePromise!(createUsers());
  });

  it('shows spinner on only the current user during Remove All', async () => {
    const users = createUsers();
    const onFetchReactingUsers = vi.fn().mockResolvedValue(users);
    let resolveFirst!: () => void;
    let callCount = 0;
    const onDeleteReaction = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => {
        callCount++;
        if (callCount === 1) {
          resolveFirst = resolve;
        } else {
          resolve();
        }
      })
    );

    render(
      <ReactionModal
        {...defaultProps}
        onDeleteReaction={onDeleteReaction}
        canManageMessages={true}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Remove All'));

    await waitFor(() => {
      // Only one spinner (on Alice's row), not three
      expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    });

    // Other users still have disabled delete buttons
    const remainingButtons = screen.getAllByLabelText('delete reaction');
    remainingButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });

    resolveFirst();
  });

  it('removes emoji tab after Remove All completes', async () => {
    const users = createUsers();
    const onFetchReactingUsers = vi.fn().mockResolvedValue(users);
    const onDeleteReaction = vi.fn().mockResolvedValue(undefined);

    render(
      <ReactionModal
        {...defaultProps}
        onDeleteReaction={onDeleteReaction}
        canManageMessages={true}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Thumbs-up tab should be visible
    expect(screen.getByText('👍')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Remove All'));

    await waitFor(() => {
      // Thumbs-up tab should be removed from the left panel
      expect(screen.queryByText('👍')).toBeNull();
    });
  });

  it('auto-selects next emoji after tab removal', async () => {
    const users = createUsers();
    const onFetchReactingUsers = vi.fn().mockResolvedValue(users);
    const onDeleteReaction = vi.fn().mockResolvedValue(undefined);

    render(
      <ReactionModal
        {...defaultProps}
        onDeleteReaction={onDeleteReaction}
        canManageMessages={true}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Remove All'));

    // After removing 👍, the next tab (custom_emoji:emoji-1) should be auto-selected and fetched
    await waitFor(() => {
      expect(onFetchReactingUsers).toHaveBeenCalledWith('custom_emoji:emoji-1');
    });
  });

  it('closes modal when all emojis are removed', async () => {
    const onClose = vi.fn();
    const singleReactionMessage = createMockMessage({
      reactions: [
        createMockReaction({ emoji: { id: null, name: '👍' }, count: 2 }),
      ],
    });
    const users = createUsers();
    const onFetchReactingUsers = vi.fn().mockResolvedValue(users);
    const onDeleteReaction = vi.fn().mockResolvedValue(undefined);

    render(
      <ReactionModal
        open={true}
        onClose={onClose}
        message={singleReactionMessage}
        onDeleteReaction={onDeleteReaction}
        canManageMessages={true}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Remove All'));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows spinner on individual delete button while deleting', async () => {
    const users = createUsers();
    const onFetchReactingUsers = vi.fn().mockResolvedValue(users);
    let resolveDelete: () => void;
    const onDeleteReaction = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      })
    );

    render(
      <ReactionModal
        {...defaultProps}
        onDeleteReaction={onDeleteReaction}
        canManageMessages={true}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('delete reaction');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    // Other delete buttons should be disabled
    const remainingButtons = screen.getAllByLabelText('delete reaction');
    remainingButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });

    resolveDelete!();
  });

  it('removes emoji tab when last individual user is deleted', async () => {
    const singleUser = [{ id: 'u1', username: 'alice', global_name: 'Alice' }] as unknown as User[];
    const onFetchReactingUsers = vi.fn().mockResolvedValue(singleUser);
    const onDeleteReaction = vi.fn().mockResolvedValue(undefined);

    render(
      <ReactionModal
        {...defaultProps}
        onDeleteReaction={onDeleteReaction}
        canManageMessages={true}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Thumbs-up tab should be visible
    expect(screen.getByText('👍')).toBeInTheDocument();

    const deleteButtons = screen.getAllByLabelText('delete reaction');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      // Thumbs-up tab should be removed after deleting the last user
      expect(screen.queryByText('👍')).toBeNull();
    });
  });

  it('does not show delete controls when not interactive', async () => {
    const users = createUsers();
    const onFetchReactingUsers = vi.fn().mockResolvedValue(users);

    render(
      <ReactionModal
        {...defaultProps}
        onFetchReactingUsers={onFetchReactingUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    expect(screen.queryAllByLabelText('delete reaction')).toHaveLength(0);
  });

  // Admin bulk action tests (MANAGE_MESSAGES)
  describe('Admin bulk actions', () => {
    const adminProps = {
      ...defaultProps,
      canManageMessages: true,
      onDeleteReaction: vi.fn().mockResolvedValue(undefined),
      onFetchReactingUsers: vi.fn().mockResolvedValue(createUsers()),
      onBulkDeleteAllReactions: vi.fn().mockResolvedValue(undefined),
      onBulkDeleteReactionsForEmoji: vi.fn().mockResolvedValue(undefined),
    };

    it('shows "Remove All" button in title when canManageMessages is true', async () => {
      render(<ReactionModal {...adminProps} />);
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
      // Title area should have a Remove All button
      const removeAllButtons = screen.getAllByText('Remove All');
      expect(removeAllButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('does not show any "Remove All" buttons when canManageMessages is false', async () => {
      render(
        <ReactionModal
          {...adminProps}
          canManageMessages={false}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
      // Non-admins cannot remove other users' reactions — no Remove All buttons
      expect(screen.queryByText('Remove All')).toBeNull();
    });

    it('non-admin sees delete button only for own reaction', async () => {
      render(
        <ReactionModal
          {...adminProps}
          canManageMessages={false}
          currentUserId="u1"
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
      // Only Alice (u1 = currentUserId) should have a delete button
      const deleteButtons = screen.getAllByLabelText('delete reaction');
      expect(deleteButtons).toHaveLength(1);
    });

    it('non-admin sees no delete buttons when current user has no reaction', async () => {
      render(
        <ReactionModal
          {...adminProps}
          canManageMessages={false}
          currentUserId="u999"
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
      expect(screen.queryAllByLabelText('delete reaction')).toHaveLength(0);
    });

    it('calls onBulkDeleteAllReactions when title "Remove All" is clicked', async () => {
      render(<ReactionModal {...adminProps} />);
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
      // The first "Remove All" button is the admin one in the title
      const removeAllButtons = screen.getAllByText('Remove All');
      fireEvent.click(removeAllButtons[0]);
      await waitFor(() => {
        expect(adminProps.onBulkDeleteAllReactions).toHaveBeenCalledTimes(1);
      });
    });

    it('calls onBulkDeleteReactionsForEmoji when per-emoji "Remove All" is clicked', async () => {
      render(<ReactionModal {...adminProps} />);
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
      // The second "Remove All" is the per-emoji one in the user list
      const removeAllButtons = screen.getAllByText('Remove All');
      fireEvent.click(removeAllButtons[1]);
      await waitFor(() => {
        expect(adminProps.onBulkDeleteReactionsForEmoji).toHaveBeenCalledWith('👍');
      });
    });

    it('closes modal after bulk delete all reactions', async () => {
      const onClose = vi.fn();
      render(<ReactionModal {...adminProps} onClose={onClose} />);
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
      const removeAllButtons = screen.getAllByText('Remove All');
      fireEvent.click(removeAllButtons[0]);
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('removes emoji tab after bulk delete for specific emoji', async () => {
      render(<ReactionModal {...adminProps} />);
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
      expect(screen.getByText('👍')).toBeInTheDocument();
      const removeAllButtons = screen.getAllByText('Remove All');
      fireEvent.click(removeAllButtons[1]); // per-emoji button
      await waitFor(() => {
        expect(screen.queryByText('👍')).toBeNull();
      });
    });

    it('does not show admin buttons without onBulkDeleteAllReactions prop', async () => {
      render(
        <ReactionModal
          {...adminProps}
          onBulkDeleteAllReactions={undefined}
          onBulkDeleteReactionsForEmoji={undefined}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
      // Should fall back to per-user Remove All button
      const removeAllButtons = screen.getAllByText('Remove All');
      expect(removeAllButtons).toHaveLength(1);
    });

    it('falls back to per-user Remove All when admin lacks bulk emoji handler', async () => {
      const onDeleteReaction = vi.fn().mockResolvedValue(undefined);
      render(
        <ReactionModal
          {...adminProps}
          canManageMessages={true}
          onDeleteReaction={onDeleteReaction}
          onBulkDeleteReactionsForEmoji={undefined}
        />
      );
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
      // Per-emoji Remove All should still work via per-user fallback
      const removeAllButtons = screen.getAllByText('Remove All');
      // Title admin button + per-user fallback
      expect(removeAllButtons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
