import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import TourTooltip from './TourTooltip';
import type { TooltipRenderProps } from 'react-joyride';

const createMockProps = (overrides: Partial<TooltipRenderProps> = {}): TooltipRenderProps => ({
  continuous: true,
  index: 0,
  isLastStep: false,
  size: 5,
  step: {
    target: '[data-tour="test"]',
    content: 'Test tooltip content',
    title: 'Test Title',
  } as TooltipRenderProps['step'],
  backProps: {
    'aria-label': 'Back',
    'data-action': 'back',
    onClick: vi.fn(),
    role: 'button',
    title: 'Back',
  },
  closeProps: {
    'aria-label': 'Close',
    'data-action': 'close',
    onClick: vi.fn(),
    role: 'button',
    title: 'Close',
  },
  primaryProps: {
    'aria-label': 'Next',
    'data-action': 'next',
    onClick: vi.fn(),
    role: 'button',
    title: 'Next',
  },
  skipProps: {
    'aria-label': 'Skip',
    'data-action': 'skip',
    onClick: vi.fn(),
    role: 'button',
    title: 'Skip',
  },
  tooltipProps: {
    'aria-modal': true,
    role: 'alertdialog',
  },
  controls: {
    close: vi.fn(),
    go: vi.fn(),
    info: vi.fn() as unknown as () => ReturnType<TooltipRenderProps['controls']['info']>,
    next: vi.fn(),
    open: vi.fn(),
    prev: vi.fn(),
    reset: vi.fn(),
    skip: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  },
  ...overrides,
});

describe('TourTooltip', () => {
  it('should render step title', () => {
    renderWithProviders(<TourTooltip {...createMockProps()} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should render step content', () => {
    renderWithProviders(<TourTooltip {...createMockProps()} />);
    expect(screen.getByText('Test tooltip content')).toBeInTheDocument();
  });

  it('should show step counter', () => {
    renderWithProviders(<TourTooltip {...createMockProps({ index: 2, size: 5 })} />);
    expect(screen.getByText('3 of 5')).toBeInTheDocument();
  });

  it('should show Skip button on first step', () => {
    renderWithProviders(<TourTooltip {...createMockProps({ index: 0 })} />);
    expect(screen.getByText('Skip')).toBeInTheDocument();
  });

  it('should not show Skip button on non-first steps', () => {
    renderWithProviders(<TourTooltip {...createMockProps({ index: 2 })} />);
    expect(screen.queryByText('Skip')).not.toBeInTheDocument();
  });

  it('should show Back button on non-first steps', () => {
    renderWithProviders(<TourTooltip {...createMockProps({ index: 2 })} />);
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('should not show Back button on first step', () => {
    renderWithProviders(<TourTooltip {...createMockProps({ index: 0 })} />);
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('should show Next button in continuous mode', () => {
    renderWithProviders(<TourTooltip {...createMockProps({ continuous: true, index: 1 })} />);
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should show Finish button on last step', () => {
    renderWithProviders(<TourTooltip {...createMockProps({ isLastStep: true, index: 4, size: 5 })} />);
    expect(screen.getByText('Finish')).toBeInTheDocument();
  });

  it('should call close handler when close button clicked', () => {
    const props = createMockProps();
    renderWithProviders(<TourTooltip {...props} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(props.closeProps.onClick).toHaveBeenCalled();
  });

  it('should render progress bar', () => {
    renderWithProviders(<TourTooltip {...createMockProps({ index: 2, size: 5 })} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '60');
  });
});
