import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ListSkeleton from './ListSkeleton';

describe('ListSkeleton', () => {
  it('renders the default number of rows (5)', () => {
    const { container } = render(<ListSkeleton />);
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    // 5 rows × 1 text skeleton each = 5
    expect(skeletons.length).toBe(5);
  });

  it('renders custom number of rows', () => {
    const { container } = render(<ListSkeleton rows={3} />);
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(3);
  });

  it('renders avatar skeletons when avatar prop is true', () => {
    const { container } = render(<ListSkeleton rows={2} avatar />);
    const circularSkeletons = container.querySelectorAll('.MuiSkeleton-circular');
    expect(circularSkeletons.length).toBe(2);
  });

  it('renders icon skeletons when icon prop is true', () => {
    const { container } = render(<ListSkeleton rows={2} icon />);
    const roundedSkeletons = container.querySelectorAll('.MuiSkeleton-rounded');
    expect(roundedSkeletons.length).toBe(2);
  });

  it('does not render avatar or icon by default', () => {
    const { container } = render(<ListSkeleton rows={2} />);
    const circularSkeletons = container.querySelectorAll('.MuiSkeleton-circular');
    const roundedSkeletons = container.querySelectorAll('.MuiSkeleton-rounded');
    expect(circularSkeletons.length).toBe(0);
    expect(roundedSkeletons.length).toBe(0);
  });
});
