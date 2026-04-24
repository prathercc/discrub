import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeleteConfirmModal from './DeleteConfirmModal';

describe('DeleteConfirmModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    messageCount: 5,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render dialog title', () => {
      render(<DeleteConfirmModal {...defaultProps} />);
      expect(screen.getByText('Delete Messages')).toBeInTheDocument();
    });

    it('should render confirmation text with message count', () => {
      render(<DeleteConfirmModal {...defaultProps} messageCount={3} />);
      expect(screen.getByText(/Are you sure you want to delete 3 messages\?/)).toBeInTheDocument();
    });

    it('should use singular "message" for count of 1', () => {
      render(<DeleteConfirmModal {...defaultProps} messageCount={1} />);
      expect(screen.getByText(/delete 1 message\?/)).toBeInTheDocument();
      expect(screen.queryByText(/messages\?/)).toBeNull();
    });

    it('should use plural "messages" for count > 1', () => {
      render(<DeleteConfirmModal {...defaultProps} messageCount={10} />);
      expect(screen.getByText(/delete 10 messages\?/)).toBeInTheDocument();
    });

    it('should show warning text about irreversibility', () => {
      render(<DeleteConfirmModal {...defaultProps} />);
      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(<DeleteConfirmModal {...defaultProps} open={false} />);
      expect(screen.queryByText('Delete Messages')).toBeNull();
    });
  });

  describe('Interactions', () => {
    it('should call onConfirm when Delete button is clicked', () => {
      const onConfirm = vi.fn();
      render(<DeleteConfirmModal {...defaultProps} onConfirm={onConfirm} />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<DeleteConfirmModal {...defaultProps} onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
