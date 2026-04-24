import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MessageTableSkeleton from './MessageTableSkeleton';

describe('MessageTableSkeleton', () => {
  it('renders skeleton elements', () => {
    const { container } = render(<MessageTableSkeleton />);
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders header skeletons and a single content row', () => {
    const { container } = render(<MessageTableSkeleton />);
    // Header has 4 skeletons, single row has 6 skeletons → 10
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(10);
  });

  it('includes a circular avatar skeleton', () => {
    const { container } = render(<MessageTableSkeleton />);
    const circularSkeletons = container.querySelectorAll('.MuiSkeleton-circular');
    expect(circularSkeletons.length).toBe(1);
  });
});
