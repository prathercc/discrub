import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const mockSetup = vi.fn<[], string>();
vi.mock('@services/compatibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/compatibility')>();
  return { ...actual, detectCompatSetup: () => mockSetup() };
});

import CompatibilityPopover, { CompatibilityContent, CompatibilitySheet } from './CompatibilityPopover';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

describe('CompatibilityPopover', () => {
  beforeEach(() => {
    mockSetup.mockReturnValue('chrome-ext');
  });

  it('opens a popover titled with the detected setup and the full table', () => {
    wrap(<CompatibilityPopover placement="topbar" />);
    fireEvent.click(screen.getByTestId('compat-button-topbar'));
    expect(screen.getByTestId('compat-setup-label')).toHaveTextContent('Chrome extension');
    const matrix = screen.getByTestId('compat-matrix');
    expect(within(matrix).getByText('Extension')).toBeInTheDocument();
    expect(within(matrix).getByText('Bleeding Edge')).toBeInTheDocument();
    expect(within(matrix).getAllByText('Chrome')).toHaveLength(2);
    expect(within(matrix).getAllByText('Firefox')).toHaveLength(2);
    expect(within(matrix).getByText('Mobile')).toBeInTheDocument();
    expect(within(matrix).queryByText(/\bext\b/i)).not.toBeInTheDocument();
    expect(within(screen.getByTestId('compat-col-chrome-ext')).getByText('You')).toBeInTheDocument();
    expect(within(matrix).getAllByTestId('compat-status-note')).toHaveLength(8);
    expect(within(matrix).getAllByTestId('compat-status-ok')).toHaveLength(7);
  });

  it('labels every cell so touch users get the meaning without hover', () => {
    wrap(<CompatibilityContent setup="be-firefox" />);
    expect(screen.getByTestId('compat-setup-label')).toHaveTextContent('Bleeding Edge on Firefox');
    expect(screen.getByTestId('compat-cell-be-firefox-signIn')).toHaveTextContent('Manual');
    expect(screen.getByTestId('compat-cell-be-firefox-exportSize')).toHaveTextContent('No limit');
    expect(screen.getByTestId('compat-cell-be-firefox-exportMedia')).toHaveTextContent('Most files');
    expect(screen.getByTestId('compat-cell-be-phone-exportSize')).toHaveTextContent('Smaller parts');
    expect(screen.getByTestId('compat-cell-firefox-ext-exportSize')).toHaveTextContent('Smaller parts');
    expect(screen.getByTestId('compat-cell-chrome-ext-signIn')).toHaveTextContent('Automatic');
    expect(screen.getByTestId('compat-cell-chrome-ext-exportMedia')).toHaveTextContent('All files');
    expect(within(screen.getByTestId('compat-col-be-firefox')).getByText('You')).toBeInTheDocument();
  });

  it('the sheet renders the detected setup compactly only while open', () => {
    mockSetup.mockReturnValue('be-phone');
    const { rerender } = wrap(<CompatibilitySheet open={false} onClose={() => {}} />);
    expect(screen.queryByTestId('compat-content')).not.toBeInTheDocument();
    rerender(
      <ThemeProvider theme={createTheme()}>
        <CompatibilitySheet open onClose={() => {}} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('compat-setup-label')).toHaveTextContent('Bleeding Edge on mobile');
    expect(within(screen.getByTestId('compat-col-be-phone')).getByText('You')).toBeInTheDocument();
  });
});
