import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip, Button } from '@mui/material';
import TourButton from './TourButton';
import { tourCatalog } from './tourSteps';

describe('<TourButton />', () => {
  it('renders the primary button child with provided label and icon', () => {
    render(
      <TourButton stepKey="multi-select-toggle" onClick={() => {}}>
        Multi-select
      </TourButton>,
    );
    // Primary button has label exactly "Multi-select"; the help slot has a
    // separate aria-label of "Help: Multi-Select Mode" — so anchor the regex.
    expect(screen.getByRole('button', { name: /^multi-select$/i })).toBeInTheDocument();
  });

  it('renders the help slot with the catalog title in its aria-label', () => {
    render(
      <TourButton stepKey="multi-select-toggle" onClick={() => {}}>
        Multi-select
      </TourButton>,
    );
    const helpButton = screen.getByTestId('tour-spot-multi-select-toggle');
    const entry = tourCatalog['multi-select-toggle'];
    expect(helpButton).toHaveAttribute('aria-label', `Help: ${entry.title}`);
  });

  it('renders nothing when the stepKey is unknown (graceful)', () => {
    const { container } = render(
      <TourButton stepKey="this-key-does-not-exist" onClick={() => {}}>
        Whatever
      </TourButton>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('opens the popover with title + content when the help slot is clicked', () => {
    // Use a stepKey whose title differs from the button label to avoid
    // collision with the visible button text.
    render(
      <TourButton stepKey="search-filters" onClick={() => {}}>
        Search filters button
      </TourButton>,
    );
    fireEvent.click(screen.getByTestId('tour-spot-search-filters'));
    const entry = tourCatalog['search-filters'];
    expect(screen.getByText(entry.title)).toBeInTheDocument();
    expect(screen.getByText(entry.content)).toBeInTheDocument();
  });

  it('does not show popover content at rest', () => {
    render(
      <TourButton stepKey="export-presets" onClick={() => {}}>
        Export
      </TourButton>,
    );
    const entry = tourCatalog['export-presets'];
    expect(screen.queryByText(entry.title)).toBeNull();
    expect(screen.queryByText(entry.content)).toBeNull();
  });

  it('forwards onClick to the primary button only (help slot has its own handler)', () => {
    const onClick = vi.fn();
    render(
      <TourButton stepKey="multi-select-toggle" onClick={onClick}>
        Multi-select
      </TourButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^multi-select$/i }));
    expect(onClick).toHaveBeenCalledTimes(1);

    // Clicking the help slot should NOT trigger the primary onClick
    fireEvent.click(screen.getByTestId('tour-spot-multi-select-toggle'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a Badge wrapping the primary when badgeContent > 0', () => {
    render(
      <TourButton stepKey="search-filters" onClick={() => {}} badgeContent={3}>
        Filters
      </TourButton>,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not render a Badge when badgeContent is 0 or undefined', () => {
    const { rerender } = render(
      <TourButton stepKey="search-filters" onClick={() => {}}>
        Filters
      </TourButton>,
    );
    expect(screen.queryByText('0')).toBeNull();

    rerender(
      <TourButton stepKey="search-filters" onClick={() => {}} badgeContent={0}>
        Filters
      </TourButton>,
    );
    expect(screen.queryByText('0')).toBeNull();
  });

  it('renders an optional leadingButton inside the same ButtonGroup', () => {
    const onLeading = vi.fn();
    render(
      <TourButton
        stepKey="multi-select-toggle"
        onClick={() => {}}
        leadingButton={
          <Tooltip title="Copy">
            <Button onClick={onLeading} aria-label="Copy items">
              Copy
            </Button>
          </Tooltip>
        }
      >
        Multi-select
      </TourButton>,
    );
    const leading = screen.getByRole('button', { name: /copy items/i });
    expect(leading).toBeInTheDocument();
    fireEvent.click(leading);
    expect(onLeading).toHaveBeenCalledTimes(1);
  });
});
