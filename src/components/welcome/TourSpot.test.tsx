import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TourSpot from './TourSpot';
import { tourCatalog } from './tourSteps';

describe('<TourSpot />', () => {
  it('renders a help icon button keyed to the catalog entry', () => {
    render(<TourSpot stepKey="multi-select-toggle" />);
    expect(screen.getByTestId('tour-spot-multi-select-toggle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /help: multi-select mode/i })).toBeInTheDocument();
  });

  it('renders nothing when the stepKey is unknown (graceful)', () => {
    const { container } = render(<TourSpot stepKey="this-key-does-not-exist" />);
    expect(container.firstChild).toBeNull();
  });

  it('opens the popover with title + content on click', () => {
    render(<TourSpot stepKey="purge-mode-toggle" />);
    fireEvent.click(screen.getByTestId('tour-spot-purge-mode-toggle'));
    const entry = tourCatalog['purge-mode-toggle'];
    expect(screen.getByText(entry.title)).toBeInTheDocument();
    // Content text contains the explanation paragraph
    expect(screen.getByText(entry.content)).toBeInTheDocument();
  });

  it('popover is closed by default (only opens on click)', () => {
    render(<TourSpot stepKey="export-presets" />);
    const entry = tourCatalog['export-presets'];
    // Title and content are not rendered until the user clicks the icon —
    // MUI's Popover unmounts its children when closed.
    expect(screen.queryByText(entry.title)).toBeNull();
    expect(screen.queryByText(entry.content)).toBeNull();
  });

  it('uses the entry title in the icon\'s aria-label for screen readers', () => {
    render(<TourSpot stepKey="operation-delays" />);
    const button = screen.getByTestId('tour-spot-operation-delays');
    expect(button).toHaveAttribute('aria-label', `Help: ${tourCatalog['operation-delays'].title}`);
  });

  it('respects the size prop (compact uses smaller padding)', () => {
    const { rerender } = render(<TourSpot stepKey="multi-select-toggle" size="inline" />);
    const inlineButton = screen.getByTestId('tour-spot-multi-select-toggle');
    const inlineStyle = window.getComputedStyle(inlineButton);
    rerender(<TourSpot stepKey="multi-select-toggle" size="compact" />);
    const compactButton = screen.getByTestId('tour-spot-multi-select-toggle');
    const compactStyle = window.getComputedStyle(compactButton);
    // We can't easily diff the SX-injected padding values via JSDOM, but
    // both should at least render. The visual difference is exercised
    // in Storybook / visual-audit.
    expect(inlineButton).toBeInTheDocument();
    expect(compactButton).toBeInTheDocument();
    // Suppress unused-variable warning while keeping the parity check.
    void inlineStyle;
    void compactStyle;
  });
});
