import { describe, it, expect, vi } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '@/theme/theme';
import { OperationDelaysTab } from './OperationDelaysTab';

// The tabs read custom palette tokens (cta) that only exist on the app's
// registry themes, so render under the real dark theme instead of MUI's default.
const render = (ui: ReactElement) =>
  rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
    ),
  });
import { ExportPreferencesTab } from './ExportPreferencesTab';
import { DisplayTab } from './DisplayTab';
import { UserDataTab } from './UserDataTab';
import { PurgeTab } from './PurgeTab';
import { defaultSettings } from '@features/app/appSlice';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

// MUI Select renders InputLabel text twice (label + notched outline legend).
// Use getAllByText and check length >= 1 for label presence, or query by role.

describe('OperationDelaysTab', () => {
  it('should render three sliders for delays', () => {
    render(<OperationDelaysTab formValues={defaultSettings} onChange={vi.fn()} />);
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBe(3);
  });

  it('should render rate-limiting info alert', () => {
    render(<OperationDelaysTab formValues={defaultSettings} onChange={vi.fn()} />);
    expect(screen.getByText(/These delays prevent Discord rate-limit errors/)).toBeInTheDocument();
  });

  it('should show effective delay ranges', () => {
    render(<OperationDelaysTab formValues={defaultSettings} onChange={vi.fn()} />);
    // Search: 1s base, 0.5s modifier → "Effective delay: 0.5s – 1.5s"
    // Delete: 2s base, 0.5s modifier → "Effective delay: 1.5s – 2.5s"
    const ranges = screen.getAllByText(/Effective delay:/);
    expect(ranges.length).toBe(2);
  });

  it('should display default delay values', () => {
    render(<OperationDelaysTab formValues={defaultSettings} onChange={vi.fn()} />);
    // Sliders show current values — search=1s, delete=2s, modifier=0.5s
    const sliders = screen.getAllByRole('slider');
    expect(sliders[0]).toHaveAttribute('aria-valuenow', '1');
    expect(sliders[1]).toHaveAttribute('aria-valuenow', '2');
    expect(sliders[2]).toHaveAttribute('aria-valuenow', '0.5');
  });

  it('should display slider labels', () => {
    render(<OperationDelaysTab formValues={defaultSettings} onChange={vi.fn()} />);
    expect(screen.getByText('Search Delay')).toBeInTheDocument();
    expect(screen.getByText('Delete / Edit Delay')).toBeInTheDocument();
    expect(screen.getByText('Delay Modifier')).toBeInTheDocument();
  });

  it('should show recommended zone labels', () => {
    render(<OperationDelaysTab formValues={defaultSettings} onChange={vi.fn()} />);
    // Default values are in recommended range
    const recommendedLabels = screen.getAllByText('Recommended');
    expect(recommendedLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('should show risky zone label when value is 0', () => {
    const settings = {
      ...defaultSettings,
      [DiscrubSetting.SEARCH_DELAY]: '0',
    };
    render(<OperationDelaysTab formValues={settings} onChange={vi.fn()} />);
    expect(screen.getByText('Risky')).toBeInTheDocument();
  });

  it('should show low zone label when below recommended range', () => {
    const settings = {
      ...defaultSettings,
      [DiscrubSetting.SEARCH_DELAY]: '0.5',
    };
    render(<OperationDelaysTab formValues={settings} onChange={vi.fn()} />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('should show safe zone label when above recommended range', () => {
    const settings = {
      ...defaultSettings,
      [DiscrubSetting.SEARCH_DELAY]: '8',
    };
    render(<OperationDelaysTab formValues={settings} onChange={vi.fn()} />);
    expect(screen.getByText('Safe')).toBeInTheDocument();
  });
});

describe('ExportPreferencesTab', () => {
  it('should render checkbox controls', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Separate threads/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Artist mode/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Preview media in export/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Download files for offline viewing/)).toBeInTheDocument();
  });

  it('should render sort order select and messages per page slider', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={vi.fn()} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(1); // Message Sort Order
    expect(screen.getByRole('slider')).toBeInTheDocument(); // Messages Per Page
  });

  it('should render media type toggle chips', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={vi.fn()} />);
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Videos')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('Other files')).toBeInTheDocument();
  });

  it('should render section headers', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={vi.fn()} />);
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Files & Media')).toBeInTheDocument();
    expect(screen.getByText('Display')).toBeInTheDocument();
  });

  it('should call onChange when a checkbox is toggled', () => {
    const onChange = vi.fn();
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Artist mode/));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.EXPORT_ARTIST_MODE, 'true');
  });

  it('should call onChange when a media type chip is clicked', () => {
    const onChange = vi.fn();
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={onChange} />);
    fireEvent.click(screen.getByText('Images'));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.EXPORT_MEDIA_IMAGES, 'false');
  });

  it('should show messages per page default value on slider', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '500');
  });
});

describe('DisplayTab', () => {
  it('should render two select controls', () => {
    render(<DisplayTab formValues={defaultSettings} onChange={vi.fn()} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(2); // Date Format + Time Format
  });

  it('should display default format values', () => {
    render(<DisplayTab formValues={defaultSettings} onChange={vi.fn()} />);
    expect(screen.getByText('MM/DD/YYYY')).toBeInTheDocument();
    expect(screen.getByText('12 Hour (AM/PM)')).toBeInTheDocument();
  });

  it('should call onChange when Date Format select is changed', () => {
    const onChange = vi.fn();
    render(<DisplayTab formValues={defaultSettings} onChange={onChange} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[0]);
    fireEvent.click(screen.getByText('DD/MM/YYYY'));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.DATE_FORMAT, expect.any(String));
  });
});

describe('UserDataTab', () => {
  it('should render checkbox controls', () => {
    render(<UserDataTab formValues={defaultSettings} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Enable reactions')).toBeInTheDocument();
    expect(screen.getByLabelText('Look up server nicknames')).toBeInTheDocument();
    expect(screen.getByLabelText('Look up display names')).toBeInTheDocument();
  });

  it('should render one select control for refresh rate', () => {
    render(<UserDataTab formValues={defaultSettings} onChange={vi.fn()} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(1);
  });

  it('should display default refresh rate value', () => {
    render(<UserDataTab formValues={defaultSettings} onChange={vi.fn()} />);
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('should call onChange when a checkbox is toggled', () => {
    const onChange = vi.fn();
    render(<UserDataTab formValues={defaultSettings} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Enable reactions'));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.REACTIONS_ENABLED, 'false');
  });
});

describe('PurgeTab', () => {
  it('should render warning alert', () => {
    render(<PurgeTab formValues={defaultSettings} onChange={vi.fn()} />);
    expect(screen.getByText(/control default behavior for purge operations/)).toBeInTheDocument();
  });

  it('should render purge mode radio buttons', () => {
    render(<PurgeTab formValues={defaultSettings} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Delete Messages')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Reactions')).toBeInTheDocument();
  });

  it('should default to Messages mode', () => {
    render(<PurgeTab formValues={defaultSettings} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Delete Messages')).toBeChecked();
  });

  it('should render retain media checkbox', () => {
    render(<PurgeTab formValues={defaultSettings} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Clear text, keep attachments')).toBeInTheDocument();
  });

  it('should call onChange when retain media checkbox is toggled', () => {
    const onChange = vi.fn();
    render(<PurgeTab formValues={defaultSettings} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear text, keep attachments'));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.PURGE_RETAIN_ATTACHED_MEDIA, 'true');
  });
});
