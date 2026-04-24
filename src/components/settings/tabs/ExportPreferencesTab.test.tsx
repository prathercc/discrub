import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportPreferencesTab } from './ExportPreferencesTab';
import { defaultSettings } from '@features/app/appSlice';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import type { AppSettings } from 'discrub-core/types/discrub-types';

// MUI Select renders InputLabel text twice (label + notched outline legend).
// Use getAllByText and check length >= 1 for label presence, or query by role.

describe('ExportPreferencesTab', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it('renders all export preference controls', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={onChange} />);

    // Checkboxes
    expect(screen.getByLabelText(/Separate threads/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Artist mode/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Preview media in export/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Download files for offline viewing/)).toBeInTheDocument();

    // Select controls (Message Sort Order)
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(1);

    // Slider (Messages Per Page)
    expect(screen.getByRole('slider')).toBeInTheDocument();

    // Description text
    expect(screen.getByText(/These are defaults/)).toBeInTheDocument();
  });

  it('checkboxes reflect formValues when all true', () => {
    const allTrue: AppSettings = {
      ...defaultSettings,
      [DiscrubSetting.EXPORT_SEPARATE_THREAD_AND_FORUM_POSTS]: 'true',
      [DiscrubSetting.EXPORT_ARTIST_MODE]: 'true',
      [DiscrubSetting.EXPORT_PREVIEW_MEDIA]: 'true',
      [DiscrubSetting.EXPORT_DOWNLOAD_MEDIA]: 'true',
    };
    render(<ExportPreferencesTab formValues={allTrue} onChange={onChange} />);

    expect(screen.getByLabelText(/Separate threads/)).toBeChecked();
    expect(screen.getByLabelText(/Artist mode/)).toBeChecked();
    expect(screen.getByLabelText(/Preview media in export/)).toBeChecked();
    expect(screen.getByLabelText(/Download files for offline viewing/)).toBeChecked();
  });

  it('checkboxes reflect formValues when all false', () => {
    const allFalse: AppSettings = {
      ...defaultSettings,
      [DiscrubSetting.EXPORT_SEPARATE_THREAD_AND_FORUM_POSTS]: 'false',
      [DiscrubSetting.EXPORT_ARTIST_MODE]: 'false',
      [DiscrubSetting.EXPORT_PREVIEW_MEDIA]: 'false',
      [DiscrubSetting.EXPORT_DOWNLOAD_MEDIA]: 'false',
    };
    render(<ExportPreferencesTab formValues={allFalse} onChange={onChange} />);

    expect(screen.getByLabelText(/Separate threads/)).not.toBeChecked();
    expect(screen.getByLabelText(/Artist mode/)).not.toBeChecked();
    expect(screen.getByLabelText(/Preview media in export/)).not.toBeChecked();
    expect(screen.getByLabelText(/Download files for offline viewing/)).not.toBeChecked();
  });

  it('toggling "Download threads (fetch and export thread messages into individual files)" calls onChange with correct key and value', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={onChange} />);
    // Default is 'true', so clicking should send 'false'
    fireEvent.click(screen.getByLabelText(/Separate threads/));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.EXPORT_SEPARATE_THREAD_AND_FORUM_POSTS, 'false');
  });

  it('toggling "Artist mode" calls onChange with correct key and value', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={onChange} />);
    // Default is 'false', so clicking should send 'true'
    fireEvent.click(screen.getByLabelText(/Artist mode/));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.EXPORT_ARTIST_MODE, 'true');
  });

  it('toggling "Preview media in export" calls onChange with correct key and value', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={onChange} />);
    // Default is 'true', so clicking should send 'false'
    fireEvent.click(screen.getByLabelText(/Preview media in export/));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.EXPORT_PREVIEW_MEDIA, 'false');
  });

  it('toggling "Download files with export" calls onChange with correct key and value', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={onChange} />);
    // Default is 'false', so clicking should send 'true'
    fireEvent.click(screen.getByLabelText(/Download files for offline viewing/));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.EXPORT_DOWNLOAD_MEDIA, 'true');
  });

  it('Messages Per Page slider displays the default value', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '500');
  });

  it('Messages Per Page slider displays custom value from formValues', () => {
    const customSettings: AppSettings = {
      ...defaultSettings,
      [DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]: '200',
    };
    render(<ExportPreferencesTab formValues={customSettings} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '200');
  });

  it('sort order select shows both Ascending and Descending options', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={onChange} />);
    const selects = screen.getAllByRole('combobox');
    // First select is Message Sort Order
    fireEvent.mouseDown(selects[0]);
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(2);
    expect(options[0]).toHaveTextContent('Oldest First (Ascending)');
    expect(options[1]).toHaveTextContent('Newest First (Descending)');
  });

  it('changing sort order calls onChange with correct key', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={onChange} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[0]);
    fireEvent.click(screen.getByText('Oldest First (Ascending)'));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.EXPORT_MESSAGE_SORT_ORDER, expect.any(String));
  });

  it('displays current sort order value from formValues', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={onChange} />);
    // Default is DESCENDING
    expect(screen.getByText('Newest First (Descending)')).toBeInTheDocument();
  });

  it('renders helper text for Messages Per Page', () => {
    render(<ExportPreferencesTab formValues={defaultSettings} onChange={onChange} />);
    expect(screen.getByText(/Number of messages per HTML page/)).toBeInTheDocument();
  });

});
