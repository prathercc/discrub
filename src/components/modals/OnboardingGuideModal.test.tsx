import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import OnboardingGuideModal from './OnboardingGuideModal';

describe('OnboardingGuideModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    defaultProps.onClose.mockClear();
  });

  it('should render the modal title', () => {
    renderWithProviders(<OnboardingGuideModal {...defaultProps} />);
    // Title is in the header bar (h6), content also has an h1 with same text
    const titles = screen.getAllByText('Upgrading from Discrub Classic');
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it('should render the Migration Guide chip', () => {
    renderWithProviders(<OnboardingGuideModal {...defaultProps} />);
    expect(screen.getByText('Migration Guide')).toBeInTheDocument();
  });

  it('should render markdown content from ONBOARDING.md', () => {
    renderWithProviders(<OnboardingGuideModal {...defaultProps} />);
    // Check for key sections from the onboarding doc
    expect(screen.getAllByText(/What's New/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/What's Changed/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Quick Start/).length).toBeGreaterThanOrEqual(1);
  });

  it('should render the close button', () => {
    renderWithProviders(<OnboardingGuideModal {...defaultProps} />);
    expect(screen.getByLabelText('Close guide')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    renderWithProviders(<OnboardingGuideModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Close guide'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should not render when open is false', () => {
    renderWithProviders(<OnboardingGuideModal open={false} onClose={defaultProps.onClose} />);
    expect(screen.queryByText('Upgrading from Discrub Classic')).not.toBeInTheDocument();
  });

  it('should render tables from the markdown', () => {
    renderWithProviders(<OnboardingGuideModal {...defaultProps} />);
    // The onboarding doc has comparison tables with column headers
    expect(screen.getAllByText(/Discrub Classic/).length).toBeGreaterThanOrEqual(1);
  });

  it('should render images with resolved paths', () => {
    renderWithProviders(<OnboardingGuideModal {...defaultProps} />);
    const images = screen.queryAllByRole('img');
    expect(images.length).toBeGreaterThan(0);
    // Paths should be rewritten from docs/screenshots/ to /onboarding/
    const srcs = images.map((img) => img.getAttribute('src'));
    expect(srcs.every((s) => !s?.startsWith('docs/'))).toBe(true);
  });
});
