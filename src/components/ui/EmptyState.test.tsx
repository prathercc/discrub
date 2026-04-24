import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('should render the message text', () => {
    render(<EmptyState message="No messages found" />);
    expect(screen.getByText('No messages found')).toBeInTheDocument();
  });

  it('should render a custom message', () => {
    render(<EmptyState message="Select a channel to get started" />);
    expect(screen.getByText('Select a channel to get started')).toBeInTheDocument();
  });

  it('should render the icon when provided', () => {
    render(<EmptyState message="Empty" icon={<span data-testid="custom-icon">📭</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('should not render an icon container when icon is not provided', () => {
    const { container } = render(<EmptyState message="Empty" />);
    // Only the message Typography should be a direct child of the flex container
    const boxes = container.querySelectorAll('.MuiBox-root');
    // The root box exists; no nested icon box
    expect(boxes.length).toBe(1);
  });

  it('should render with different icon elements', () => {
    render(<EmptyState message="Nothing here" icon={<svg data-testid="svg-icon" />} />);
    expect(screen.getByTestId('svg-icon')).toBeInTheDocument();
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
