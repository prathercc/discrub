import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TourCaption from './TourCaption';
import { tourCatalog } from './tourSteps';

describe('<TourCaption />', () => {
  it('renders a "More info" link keyed to the catalog entry', () => {
    render(<TourCaption stepKey="export-presets" />);
    expect(screen.getByTestId('tour-caption-export-presets')).toBeInTheDocument();
    expect(screen.getByText('More info')).toBeInTheDocument();
  });

  it('renders the optional hint text inline before "More info"', () => {
    render(<TourCaption stepKey="export-presets" hint="Save and reuse common setups." />);
    expect(screen.getByText(/Save and reuse common setups\./)).toBeInTheDocument();
    expect(screen.getByText('More info')).toBeInTheDocument();
  });

  it('renders nothing when the stepKey is unknown (graceful)', () => {
    const { container } = render(<TourCaption stepKey="this-key-does-not-exist" />);
    expect(container.firstChild).toBeNull();
  });

  it('opens the popover with title + content when "More info" is clicked', () => {
    render(<TourCaption stepKey="export-presets" />);
    fireEvent.click(screen.getByTestId('tour-caption-export-presets'));
    const entry = tourCatalog['export-presets'];
    expect(screen.getByText(entry.title)).toBeInTheDocument();
    expect(screen.getByText(entry.content)).toBeInTheDocument();
  });

  it('does not show popover content at rest', () => {
    render(<TourCaption stepKey="export-presets" />);
    const entry = tourCatalog['export-presets'];
    expect(screen.queryByText(entry.title)).toBeNull();
    expect(screen.queryByText(entry.content)).toBeNull();
  });

  it('uses the entry title in aria-label for screen readers', () => {
    render(<TourCaption stepKey="operation-delays" />);
    const link = screen.getByTestId('tour-caption-operation-delays');
    expect(link).toHaveAttribute('aria-label', `Help: ${tourCatalog['operation-delays'].title}`);
  });
});
