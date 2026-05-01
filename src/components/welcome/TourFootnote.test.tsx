import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TourFootnote from './TourFootnote';
import { tourCatalog } from './tourSteps';

describe('<TourFootnote />', () => {
  it('renders a small ? glyph keyed to the catalog entry', () => {
    render(<TourFootnote stepKey="refine-section" />);
    expect(screen.getByTestId('tour-footnote-refine-section')).toBeInTheDocument();
  });

  it('renders nothing when the stepKey is unknown (graceful)', () => {
    const { container } = render(<TourFootnote stepKey="this-key-does-not-exist" />);
    expect(container.firstChild).toBeNull();
  });

  it('opens the popover with title + content on click', () => {
    render(<TourFootnote stepKey="purge-mode-toggle" />);
    fireEvent.click(screen.getByTestId('tour-footnote-purge-mode-toggle'));
    const entry = tourCatalog['purge-mode-toggle'];
    expect(screen.getByText(entry.title)).toBeInTheDocument();
    expect(screen.getByText(entry.content)).toBeInTheDocument();
  });

  it('opens the popover when activated via Enter key', () => {
    render(<TourFootnote stepKey="search-match-counter" />);
    const button = screen.getByTestId('tour-footnote-search-match-counter');
    fireEvent.keyDown(button, { key: 'Enter' });
    const entry = tourCatalog['search-match-counter'];
    expect(screen.getByText(entry.title)).toBeInTheDocument();
  });

  it('opens the popover when activated via Space key', () => {
    render(<TourFootnote stepKey="search-match-counter" />);
    const button = screen.getByTestId('tour-footnote-search-match-counter');
    fireEvent.keyDown(button, { key: ' ' });
    const entry = tourCatalog['search-match-counter'];
    expect(screen.getByText(entry.title)).toBeInTheDocument();
  });

  it('uses the entry title in aria-label for screen readers', () => {
    render(<TourFootnote stepKey="operation-delays" />);
    const button = screen.getByTestId('tour-footnote-operation-delays');
    expect(button).toHaveAttribute('aria-label', `Help: ${tourCatalog['operation-delays'].title}`);
  });

  it('does not show popover content at rest', () => {
    render(<TourFootnote stepKey="export-presets" />);
    const entry = tourCatalog['export-presets'];
    expect(screen.queryByText(entry.title)).toBeNull();
    expect(screen.queryByText(entry.content)).toBeNull();
  });
});
