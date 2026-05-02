import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import RichTooltip from './RichTooltip';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>{ui}</ThemeProvider>);

describe('RichTooltip', () => {
  it('renders heading and body content on hover', async () => {
    renderWithTheme(
      <RichTooltip heading="Filters" body="2 active.">
        <button>Anchor</button>
      </RichTooltip>,
    );

    fireEvent.mouseOver(screen.getByText('Anchor'));
    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('2 active.')).toBeInTheDocument();
    });
  });

  it('omits the heading when not provided', async () => {
    renderWithTheme(
      <RichTooltip body="Body only.">
        <button>Anchor</button>
      </RichTooltip>,
    );

    fireEvent.mouseOver(screen.getByText('Anchor'));
    await waitFor(() => {
      expect(screen.getByText('Body only.')).toBeInTheDocument();
    });
  });

  it('forwards additional Tooltip props (placement)', async () => {
    renderWithTheme(
      <RichTooltip body="hi" placement="bottom">
        <button>Anchor</button>
      </RichTooltip>,
    );

    fireEvent.mouseOver(screen.getByText('Anchor'));
    await waitFor(() => {
      expect(screen.getByText('hi')).toBeInTheDocument();
    });
  });
});
