import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DialogCloseIcon from './DialogCloseIcon';

describe('DialogCloseIcon', () => {
  it('calls onClose when clicked', () => {
    const onClose = vi.fn();
    render(<DialogCloseIcon onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('respects the disabled prop', () => {
    const onClose = vi.fn();
    render(<DialogCloseIcon onClose={onClose} disabled />);
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses a custom aria-label when provided', () => {
    render(<DialogCloseIcon onClose={() => {}} label="Close announcement" />);
    expect(screen.getByRole('button', { name: 'Close announcement' })).toBeInTheDocument();
  });
});
