import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import MessageActions from './MessageActions';
import { createMockMessage, createMockEmbed } from '../../test/fixtures';

describe('MessageActions', () => {
  const defaultProps = {
    selectedMessages: [] as any[],
    onDelete: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn().mockResolvedValue(undefined),
    formattingContext: { userMap: {}, channelMap: {}, guildRoles: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Selection Count', () => {
    it('should show "0 selected" when no messages selected', () => {
      render(<MessageActions {...defaultProps} />);
      expect(screen.getByText('0 selected')).toBeInTheDocument();
    });

    it('should show correct selection count', () => {
      render(<MessageActions {...defaultProps} selectedMessages={[createMockMessage({ id: 'a' }), createMockMessage({ id: 'b' })]} />);
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('should disable Delete when no messages selected', () => {
      render(<MessageActions {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Delete/ })).toBeDisabled();
    });

    it('should enable Delete when messages are selected', () => {
      render(<MessageActions {...defaultProps} selectedMessages={[createMockMessage()]} />);
      expect(screen.getByRole('button', { name: /Delete/ })).not.toBeDisabled();
    });

    it('should disable Edit when no messages selected', () => {
      render(<MessageActions {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Edit/ })).toBeDisabled();
    });

    it('should enable Edit when multiple messages selected', () => {
      render(<MessageActions {...defaultProps} selectedMessages={[createMockMessage({ id: 'a' }), createMockMessage({ id: 'b' })]} />);
      expect(screen.getByRole('button', { name: /Edit/ })).not.toBeDisabled();
    });

    it('should enable Edit when exactly one message selected', () => {
      render(<MessageActions {...defaultProps} selectedMessages={[createMockMessage()]} />);
      expect(screen.getByRole('button', { name: /Edit/ })).not.toBeDisabled();
    });

  });

  describe('Embed Button', () => {
    it('should show Embeds button when message has embeds', () => {
      const msg = createMockMessage({ embeds: [createMockEmbed()] });
      render(<MessageActions {...defaultProps} selectedMessages={[msg]} />);
      expect(screen.getByRole('button', { name: /Embeds \(1\)/ })).toBeInTheDocument();
    });
  });

  describe('Operation Safety', () => {
    it('should disable Delete when isOperationRunning is true', () => {
      render(<MessageActions {...defaultProps} selectedMessages={[createMockMessage()]} isOperationRunning={true} />);
      expect(screen.getByRole('button', { name: /Delete/ })).toBeDisabled();
    });

    it('should disable Edit when multiple selected and isOperationRunning is true', () => {
      const msgs = [createMockMessage({ id: 'a' }), createMockMessage({ id: 'b' })];
      render(<MessageActions {...defaultProps} selectedMessages={msgs} onBulkEdit={vi.fn()} isOperationRunning={true} />);
      expect(screen.getByRole('button', { name: /Edit/ })).toBeDisabled();
    });

    it('should not disable Edit when isOperationRunning is true (single-message op)', () => {
      render(<MessageActions {...defaultProps} selectedMessages={[createMockMessage()]} isOperationRunning={true} />);
      expect(screen.getByRole('button', { name: /Edit/ })).not.toBeDisabled();
    });
  });

  describe('Modal Opening', () => {
    it('should open delete modal when Delete is clicked', () => {
      render(<MessageActions {...defaultProps} selectedMessages={[createMockMessage()]} />);
      fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
      expect(screen.getByText('Delete Messages')).toBeInTheDocument();
    });

    it('should open edit modal when Edit is clicked', () => {
      render(<MessageActions {...defaultProps} selectedMessages={[createMockMessage({ content: 'edit me' })]} />);
      fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
      expect(screen.getByText('Edit Message')).toBeInTheDocument();
    });

  });

  describe('Delete Callback', () => {
    it('should call onDelete with selected messages when confirmed', async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const messages = [createMockMessage({ id: 'del-1' })];
      render(<MessageActions {...defaultProps} onDelete={onDelete} selectedMessages={messages} />);
      fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
      // Click the confirm button in the DeleteConfirmModal
      const confirmBtn = screen.getByRole('button', { name: 'Delete' });
      await act(async () => {
        fireEvent.click(confirmBtn);
      });
      expect(onDelete).toHaveBeenCalledWith(messages);
    });

    it('should close the delete modal immediately when confirmed', async () => {
      let resolveDelete: () => void;
      const onDelete = vi.fn().mockImplementation(() => new Promise<void>((r) => { resolveDelete = r; }));
      const messages = [createMockMessage({ id: 'del-1' })];
      render(<MessageActions {...defaultProps} onDelete={onDelete} selectedMessages={messages} />);
      fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
      expect(screen.getByText('Delete Messages')).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      });
      // Modal should close immediately, before onDelete resolves
      await waitFor(() => {
        expect(screen.queryByText('Delete Messages')).toBeNull();
      });
      // Clean up the pending promise
      await act(async () => { resolveDelete!(); });
    });
  });

  describe('Permission gating (Backlog #139)', () => {
    const selfId = 'user-123';
    const otherId = 'user-456';
    const selfMsg = createMockMessage({ id: 'm-self', author: { id: selfId, username: 'me' } as any });
    const otherMsg = createMockMessage({ id: 'm-other', author: { id: otherId, username: 'them' } as any });

    it('disables Delete when selection includes non-self messages and no MANAGE', () => {
      render(
        <MessageActions
          {...defaultProps}
          selectedMessages={[selfMsg, otherMsg]}
          currentUserId={selfId}
          canManageMessages={false}
        />,
      );
      expect(screen.getByRole('button', { name: /Delete/ })).toBeDisabled();
    });

    it('enables Delete when selection includes non-self messages and user has MANAGE', () => {
      render(
        <MessageActions
          {...defaultProps}
          selectedMessages={[selfMsg, otherMsg]}
          currentUserId={selfId}
          canManageMessages={true}
        />,
      );
      expect(screen.getByRole('button', { name: /Delete/ })).not.toBeDisabled();
    });

    it('enables Delete for self-only selection without MANAGE', () => {
      render(
        <MessageActions
          {...defaultProps}
          selectedMessages={[selfMsg]}
          currentUserId={selfId}
          canManageMessages={false}
        />,
      );
      expect(screen.getByRole('button', { name: /Delete/ })).not.toBeDisabled();
    });

    it('shows lock reason tooltip on disabled Delete button', async () => {
      render(
        <MessageActions
          {...defaultProps}
          selectedMessages={[otherMsg]}
          currentUserId={selfId}
          canManageMessages={false}
        />,
      );
      // Tooltip lives on the wrapping span — hover the wrapper to surface it
      const button = screen.getByRole('button', { name: /Delete/ });
      const wrapper = button.parentElement!;
      fireEvent.mouseOver(wrapper);
      await waitFor(() => {
        expect(
          screen.getByText('You can only delete your own messages without Manage Messages permission in this channel.'),
        ).toBeInTheDocument();
      });
    });

    it('shows DM-aware lock reason tooltip when isDm is true', async () => {
      render(
        <MessageActions
          {...defaultProps}
          selectedMessages={[otherMsg]}
          currentUserId={selfId}
          canManageMessages={false}
          isDm={true}
        />,
      );
      const button = screen.getByRole('button', { name: /Delete/ });
      const wrapper = button.parentElement!;
      fireEvent.mouseOver(wrapper);
      await waitFor(() => {
        expect(
          screen.getByText('You can only delete your own messages in DMs.'),
        ).toBeInTheDocument();
      });
    });

    it('disables Edit when selection includes non-self messages even with MANAGE', () => {
      // Discord PATCH is author-only regardless of permission
      render(
        <MessageActions
          {...defaultProps}
          selectedMessages={[otherMsg]}
          currentUserId={selfId}
          canManageMessages={true}
        />,
      );
      expect(screen.getByRole('button', { name: /Edit/ })).toBeDisabled();
    });

    it('enables Edit when selection is self-only', () => {
      render(
        <MessageActions
          {...defaultProps}
          selectedMessages={[selfMsg]}
          currentUserId={selfId}
          canManageMessages={false}
        />,
      );
      expect(screen.getByRole('button', { name: /Edit/ })).not.toBeDisabled();
    });

    it('disables Edit when mixed-author selection includes any non-self message', () => {
      render(
        <MessageActions
          {...defaultProps}
          selectedMessages={[selfMsg, otherMsg]}
          currentUserId={selfId}
          canManageMessages={true}
        />,
      );
      expect(screen.getByRole('button', { name: /Edit/ })).toBeDisabled();
    });

    it('shows lock reason tooltip on disabled Edit button', async () => {
      render(
        <MessageActions
          {...defaultProps}
          selectedMessages={[otherMsg]}
          currentUserId={selfId}
          canManageMessages={true}
        />,
      );
      const button = screen.getByRole('button', { name: /Edit/ });
      const wrapper = button.parentElement!;
      fireEvent.mouseOver(wrapper);
      await waitFor(() => {
        expect(
          screen.getByText("You can only edit your own messages. Discord blocks editing other users' messages."),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Edit Callback', () => {
    it('should call onEdit with message and new content when saved', async () => {
      const onEdit = vi.fn().mockResolvedValue(undefined);
      const msg = createMockMessage({ content: 'original' });
      render(<MessageActions {...defaultProps} onEdit={onEdit} selectedMessages={[msg]} />);
      fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
      const textarea = screen.getByLabelText('Message Content');
      fireEvent.change(textarea, { target: { value: 'updated' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      });
      expect(onEdit).toHaveBeenCalledWith(msg, 'updated');
    });

    it('should close the edit modal immediately when saved', async () => {
      let resolveEdit: () => void;
      const onEdit = vi.fn().mockImplementation(() => new Promise<void>((r) => { resolveEdit = r; }));
      const msg = createMockMessage({ content: 'original' });
      render(<MessageActions {...defaultProps} onEdit={onEdit} selectedMessages={[msg]} />);
      fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
      expect(screen.getByText('Edit Message')).toBeInTheDocument();
      const textarea = screen.getByLabelText('Message Content');
      fireEvent.change(textarea, { target: { value: 'updated' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      });
      // Modal should close immediately, before onEdit resolves
      await waitFor(() => {
        expect(screen.queryByText('Edit Message')).toBeNull();
      });
      // Clean up the pending promise
      await act(async () => { resolveEdit!(); });
    });
  });
});
