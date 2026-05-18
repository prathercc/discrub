import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AttachmentModal from './AttachmentModal';
import { createMockMessage, createMockAttachment } from '../../test/fixtures';

describe('AttachmentModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    message: createMockMessage({
      attachments: [
        createMockAttachment({ id: 'att-1', filename: 'photo.png', size: 51200, width: 800, height: 600, content_type: 'image/png' }),
        createMockAttachment({ id: 'att-2', filename: 'document.pdf', size: 204800, width: undefined, height: undefined, content_type: 'application/pdf' }),
      ],
    }),
    // The default mock message author id is 'user-123' (see createMockUser
    // in test/fixtures.ts). Pinning the same id here keeps the prior
    // interactive-mode tests valid against the #189 author/perm gate.
    currentUserId: 'user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should auto-close when message is null', () => {
    const onClose = vi.fn();
    render(
      <AttachmentModal open={true} onClose={onClose} message={null} />
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should auto-close when message has no attachments', () => {
    const onClose = vi.fn();
    render(
      <AttachmentModal open={true} onClose={onClose} message={createMockMessage({ attachments: [] })} />
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when not open', () => {
    const onClose = vi.fn();
    render(
      <AttachmentModal open={false} onClose={onClose} message={null} />
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should render dialog title with attachment count', () => {
    render(<AttachmentModal {...defaultProps} />);
    expect(screen.getByText('Attachments (2)')).toBeInTheDocument();
  });

  it('should render each attachment filename as a link', () => {
    render(<AttachmentModal {...defaultProps} />);
    const photoLink = screen.getByText('photo.png');
    expect(photoLink.closest('a')).toHaveAttribute('href');
    const docLink = screen.getByText('document.pdf');
    expect(docLink.closest('a')).toHaveAttribute('href');
  });

  it('should display file size', () => {
    render(<AttachmentModal {...defaultProps} />);
    expect(screen.getByText(/50\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/200\.0 KB/)).toBeInTheDocument();
  });

  it('should display dimensions when available', () => {
    render(<AttachmentModal {...defaultProps} />);
    expect(screen.getByText(/800×600/)).toBeInTheDocument();
  });

  it('should display file type badges', () => {
    render(<AttachmentModal {...defaultProps} />);
    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('should not display dimensions when not available', () => {
    const msg = createMockMessage({
      attachments: [
        createMockAttachment({ id: 'att-3', filename: 'file.txt', size: 1024, width: undefined, height: undefined }),
      ],
    });
    render(<AttachmentModal open={true} onClose={vi.fn()} message={msg} />);
    expect(screen.queryByText(/×/)).toBeNull();
  });

  it('should call onClose when Close button is clicked', () => {
    const onClose = vi.fn();
    render(<AttachmentModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Interactive mode tests
  it('shows delete icon per attachment when interactive', () => {
    render(
      <AttachmentModal
        {...defaultProps}
        onDeleteAttachment={vi.fn()}
      />
    );
    const deleteButtons = screen.getAllByLabelText('delete attachment');
    expect(deleteButtons).toHaveLength(2);
  });

  it('clicking delete calls onDeleteAttachment', async () => {
    const onDeleteAttachment = vi.fn().mockResolvedValue(undefined);
    render(
      <AttachmentModal
        {...defaultProps}
        onDeleteAttachment={onDeleteAttachment}
      />
    );
    const deleteButtons = screen.getAllByLabelText('delete attachment');
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });
    expect(onDeleteAttachment).toHaveBeenCalledWith(
      defaultProps.message,
      defaultProps.message!.attachments[0]
    );
  });

  it('shows warning when removing last attachment and no content', () => {
    const msg = createMockMessage({
      content: '',
      attachments: [createMockAttachment()],
    });
    render(
      <AttachmentModal
        open={true}
        onClose={vi.fn()}
        message={msg}
        onDeleteAttachment={vi.fn()}
      />
    );
    expect(screen.getByText(/Removing the last attachment will delete the entire message/)).toBeInTheDocument();
  });

  it('does not show warning when message has content', () => {
    const msg = createMockMessage({
      content: 'some text',
      attachments: [createMockAttachment()],
    });
    render(
      <AttachmentModal
        open={true}
        onClose={vi.fn()}
        message={msg}
        onDeleteAttachment={vi.fn()}
      />
    );
    expect(screen.queryByText(/Removing the last attachment will delete the entire message/)).not.toBeInTheDocument();
  });

  it('Remove All calls onDeleteAttachment for each attachment sequentially', async () => {
    const onDeleteAttachment = vi.fn().mockResolvedValue(undefined);
    render(
      <AttachmentModal
        {...defaultProps}
        onDeleteAttachment={onDeleteAttachment}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Remove All'));
    });
    expect(onDeleteAttachment).toHaveBeenCalledTimes(2);
    expect(onDeleteAttachment).toHaveBeenNthCalledWith(1, defaultProps.message, defaultProps.message!.attachments[0]);
    expect(onDeleteAttachment).toHaveBeenNthCalledWith(2, defaultProps.message, defaultProps.message!.attachments[1]);
  });

  it('does not show delete controls when not interactive', () => {
    render(<AttachmentModal {...defaultProps} />);
    expect(screen.queryAllByLabelText('delete attachment')).toHaveLength(0);
    expect(screen.queryByText('Remove All')).not.toBeInTheDocument();
  });

  // Spinner / loading state tests
  it('shows spinner during individual delete', async () => {
    let resolveDelete!: () => void;
    const onDeleteAttachment = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveDelete = resolve; })
    );
    render(
      <AttachmentModal
        {...defaultProps}
        onDeleteAttachment={onDeleteAttachment}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getAllByLabelText('delete attachment')[0]);
    });

    // Spinner should appear on the deleting row
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    // Other delete buttons should be disabled
    const remainingButtons = screen.queryAllByLabelText('delete attachment');
    remainingButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });

    await act(async () => {
      resolveDelete();
    });
  });

  it('shows spinner on only the current attachment during Remove All', async () => {
    let resolveFirst!: () => void;
    let callCount = 0;
    const onDeleteAttachment = vi.fn().mockImplementation(
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
      <AttachmentModal
        {...defaultProps}
        onDeleteAttachment={onDeleteAttachment}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Remove All'));
    });

    // Only one spinner (on the first attachment), not two
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    // The other row should have a disabled delete button, not a spinner
    const remainingButtons = screen.queryAllByLabelText('delete attachment');
    expect(remainingButtons).toHaveLength(1);
    expect(remainingButtons[0]).toBeDisabled();

    await act(async () => {
      resolveFirst();
    });
  });

  it('auto-closes when attachments become empty via rerender', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <AttachmentModal {...defaultProps} onClose={onClose} />
    );
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <AttachmentModal
        open={true}
        onClose={onClose}
        message={createMockMessage({ attachments: [] })}
      />
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto-closes when message becomes null via rerender', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <AttachmentModal {...defaultProps} onClose={onClose} />
    );
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <AttachmentModal open={true} onClose={onClose} message={null} />
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── #189: author + Manage Messages gate ─────────────────────────
  describe('delete affordance gate (#189)', () => {
    const otherUserMessage = createMockMessage({
      author: { id: 'someone-else', username: 'other', discriminator: '0001', avatar: null, bot: false } as any,
      attachments: [createMockAttachment({ id: 'att-x', filename: 'x.png' })],
    });

    it('shows the per-attachment delete icon when the viewer authored the message', () => {
      render(
        <AttachmentModal
          {...defaultProps}
          onDeleteAttachment={vi.fn()}
          currentUserId="user-123"
          canManageMessages={false}
        />
      );
      expect(screen.getAllByLabelText('delete attachment').length).toBeGreaterThan(0);
    });

    it('shows the per-attachment delete icon when the viewer has Manage Messages on the channel', () => {
      render(
        <AttachmentModal
          open
          onClose={vi.fn()}
          message={otherUserMessage}
          onDeleteAttachment={vi.fn()}
          currentUserId="user-123"
          canManageMessages
        />
      );
      expect(screen.getAllByLabelText('delete attachment')).toHaveLength(1);
    });

    it('hides the delete affordance when the viewer did not author the message and lacks Manage Messages', () => {
      render(
        <AttachmentModal
          open
          onClose={vi.fn()}
          message={otherUserMessage}
          onDeleteAttachment={vi.fn()}
          currentUserId="user-123"
          canManageMessages={false}
        />
      );
      expect(screen.queryAllByLabelText('delete attachment')).toHaveLength(0);
      expect(screen.queryByText('Remove All')).not.toBeInTheDocument();
    });

    it('hides the delete affordance when currentUserId is missing entirely', () => {
      // Safer default: with no auth context, treat the user as unauthorized
      // rather than rendering an action that will always 403.
      render(
        <AttachmentModal
          {...defaultProps}
          onDeleteAttachment={vi.fn()}
          currentUserId={undefined}
        />
      );
      expect(screen.queryAllByLabelText('delete attachment')).toHaveLength(0);
    });

    it('hides the Remove All button when the viewer cannot delete', () => {
      const msgWithMany = createMockMessage({
        author: { id: 'someone-else', username: 'other' } as any,
        attachments: [
          createMockAttachment({ id: 'a', filename: 'a.png' }),
          createMockAttachment({ id: 'b', filename: 'b.png' }),
        ],
      });
      render(
        <AttachmentModal
          open
          onClose={vi.fn()}
          message={msgWithMany}
          onDeleteAttachment={vi.fn()}
          currentUserId="user-123"
          canManageMessages={false}
        />
      );
      expect(screen.queryByText('Remove All')).not.toBeInTheDocument();
    });
  });
});
