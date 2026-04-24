import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render a circular progress indicator', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render a message when provided', () => {
    render(<LoadingSpinner message="Loading messages..." />);
    expect(screen.getByText('Loading messages...')).toBeInTheDocument();
  });

  it('should not render a message when not provided', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('.MuiTypography-root')).toBeNull();
  });
});
