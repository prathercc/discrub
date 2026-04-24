import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MediaBreakdownBar from './MediaBreakdownBar';
import type { MediaCategorySummary } from '@/utils/mediaUtils';

describe('MediaBreakdownBar', () => {
  it('renders nothing for empty data', () => {
    const { container } = render(<MediaBreakdownBar summaries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when total size is 0', () => {
    const summaries: MediaCategorySummary[] = [
      { category: 'images', count: 0, totalBytes: 0, embedCount: 2, attachments: [] },
    ];
    const { container } = render(<MediaBreakdownBar summaries={summaries} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders segments for categories with size', () => {
    const summaries: MediaCategorySummary[] = [
      { category: 'images', count: 5, totalBytes: 5000, embedCount: 0, attachments: [] },
      { category: 'videos', count: 3, totalBytes: 3000, embedCount: 0, attachments: [] },
    ];
    const { container } = render(<MediaBreakdownBar summaries={summaries} />);
    expect(container.querySelector('[data-testid="bar-images"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="bar-videos"]')).toBeTruthy();
  });

  it('renders single category as full width', () => {
    const summaries: MediaCategorySummary[] = [
      { category: 'images', count: 10, totalBytes: 10000, embedCount: 0, attachments: [] },
    ];
    const { container } = render(<MediaBreakdownBar summaries={summaries} />);
    expect(container.querySelector('[data-testid="bar-images"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="bar-videos"]')).toBeNull();
  });

  it('renders all four category colors when present', () => {
    const summaries: MediaCategorySummary[] = [
      { category: 'images', count: 1, totalBytes: 1000, embedCount: 0, attachments: [] },
      { category: 'videos', count: 1, totalBytes: 1000, embedCount: 0, attachments: [] },
      { category: 'audio', count: 1, totalBytes: 1000, embedCount: 0, attachments: [] },
      { category: 'other', count: 1, totalBytes: 1000, embedCount: 0, attachments: [] },
    ];
    const { container } = render(<MediaBreakdownBar summaries={summaries} />);
    expect(container.querySelector('[data-testid="bar-images"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="bar-videos"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="bar-audio"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="bar-other"]')).toBeTruthy();
  });

  it('renders legend labels with sizes for visible categories', () => {
    const summaries: MediaCategorySummary[] = [
      { category: 'images', count: 5, totalBytes: 5000, embedCount: 0, attachments: [] },
      { category: 'videos', count: 3, totalBytes: 3000, embedCount: 0, attachments: [] },
    ];
    render(<MediaBreakdownBar summaries={summaries} />);
    expect(screen.getByText(/Images/)).toBeInTheDocument();
    expect(screen.getByText(/Videos/)).toBeInTheDocument();
  });

  it('does not render legend for zero-size categories', () => {
    const summaries: MediaCategorySummary[] = [
      { category: 'images', count: 5, totalBytes: 5000, embedCount: 0, attachments: [] },
      { category: 'audio', count: 0, totalBytes: 0, embedCount: 0, attachments: [] },
    ];
    render(<MediaBreakdownBar summaries={summaries} />);
    expect(screen.getByText(/Images/)).toBeInTheDocument();
    expect(screen.queryByText(/Audio/)).not.toBeInTheDocument();
  });
});
