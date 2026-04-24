import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThreadLoadModal from './ThreadLoadModal';

describe('ThreadLoadModal', () => {
  const mockOnClose = vi.fn();
  const mockOnLoad = vi.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onLoad: mockOnLoad,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dialog with title', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    expect(screen.getByText('Load Thread')).toBeInTheDocument();
  });

  it('should render text field for thread ID', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    expect(screen.getByLabelText('Thread / Forum Post ID')).toBeInTheDocument();
  });

  it('should render description text', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    expect(screen.getByText(/Enter a thread or forum post ID/)).toBeInTheDocument();
  });

  it('should disable Load button when input is empty', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    expect(screen.getByText('Load')).toBeDisabled();
  });

  it('should enable Load button when input has value', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Thread / Forum Post ID'), {
      target: { value: '1234567890' },
    });
    expect(screen.getByText('Load')).not.toBeDisabled();
  });

  it('should call onLoad with thread ID on click', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Thread / Forum Post ID'), {
      target: { value: '1234567890' },
    });
    fireEvent.click(screen.getByText('Load'));
    expect(mockOnLoad).toHaveBeenCalledWith('1234567890');
  });

  it('should call onLoad on Enter key press', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    const input = screen.getByLabelText('Thread / Forum Post ID');
    fireEvent.change(input, { target: { value: '1234567890' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockOnLoad).toHaveBeenCalledWith('1234567890');
  });

  it('should strip non-numeric characters from input', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Thread / Forum Post ID'), {
      target: { value: 'abc123def456' },
    });
    expect(screen.getByLabelText('Thread / Forum Post ID')).toHaveValue('123456');
  });

  it('should call onClose when Cancel is clicked', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not render when open is false', () => {
    render(<ThreadLoadModal {...defaultProps} open={false} />);
    expect(screen.queryByText('Load Thread')).toBeNull();
  });

  it('should clear input after successful load', () => {
    render(<ThreadLoadModal {...defaultProps} />);
    const input = screen.getByLabelText('Thread / Forum Post ID') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1234567890' } });
    expect(input.value).toBe('1234567890');
    fireEvent.click(screen.getByText('Load'));
    expect(mockOnLoad).toHaveBeenCalledWith('1234567890');
    expect(input.value).toBe('');
  });
});
