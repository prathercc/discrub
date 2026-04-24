import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PurgeTab } from './PurgeTab';
import { defaultSettings } from '@features/app/appSlice';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import type { AppSettings } from 'discrub-core/types/discrub-types';

describe('PurgeTab', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it('renders purge settings controls', () => {
    render(<PurgeTab formValues={defaultSettings} onChange={onChange} />);

    expect(screen.getByText(/control default behavior for purge operations/)).toBeInTheDocument();
    expect(screen.getByLabelText('Delete Messages')).toBeInTheDocument();
    expect(screen.getByLabelText('Strip Attachments Only')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Reactions')).toBeInTheDocument();
    expect(screen.getByLabelText('Clear text, keep attachments')).toBeInTheDocument();
  });

  it('defaults to Delete Messages mode', () => {
    render(<PurgeTab formValues={defaultSettings} onChange={onChange} />);
    expect(screen.getByLabelText('Delete Messages')).toBeChecked();
    expect(screen.getByLabelText('Strip Attachments Only')).not.toBeChecked();
    expect(screen.getByLabelText('Remove Reactions')).not.toBeChecked();
  });

  it('reflects Reactions mode from formValues', () => {
    const settings: AppSettings = {
      ...defaultSettings,
      [DiscrubSetting.PURGE_MODE]: 'reactions',
    };
    render(<PurgeTab formValues={settings} onChange={onChange} />);
    expect(screen.getByLabelText('Remove Reactions')).toBeChecked();
    expect(screen.getByLabelText('Delete Messages')).not.toBeChecked();
  });

  it('reflects Attachments Only mode from formValues', () => {
    const settings: AppSettings = {
      ...defaultSettings,
      [DiscrubSetting.PURGE_MODE]: 'messages',
      [DiscrubSetting.PURGE_DELETE_ATTACHMENTS_ONLY]: 'true',
    };
    render(<PurgeTab formValues={settings} onChange={onChange} />);
    expect(screen.getByLabelText('Strip Attachments Only')).toBeChecked();
  });

  it('switching to Reactions writes PURGE_MODE=reactions and clears deleteAttachmentsOnly', () => {
    const settings: AppSettings = {
      ...defaultSettings,
      [DiscrubSetting.PURGE_DELETE_ATTACHMENTS_ONLY]: 'true',
      [DiscrubSetting.PURGE_MODE]: 'messages',
    };
    render(<PurgeTab formValues={settings} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Remove Reactions'));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.PURGE_MODE, 'reactions');
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.PURGE_DELETE_ATTACHMENTS_ONLY, 'false');
  });

  it('switching to Attachments Only writes mode=messages + deleteAttachmentsOnly=true', () => {
    render(<PurgeTab formValues={defaultSettings} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Strip Attachments Only'));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.PURGE_MODE, 'messages');
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.PURGE_DELETE_ATTACHMENTS_ONLY, 'true');
  });

  it('switching to Attachments Only clears retain-media if it was on', () => {
    const settings: AppSettings = {
      ...defaultSettings,
      [DiscrubSetting.PURGE_RETAIN_ATTACHED_MEDIA]: 'true',
    };
    render(<PurgeTab formValues={settings} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Strip Attachments Only'));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.PURGE_RETAIN_ATTACHED_MEDIA, 'false');
  });

  it('switching back to Delete Messages writes mode=messages + deleteAttachmentsOnly=false', () => {
    const settings: AppSettings = {
      ...defaultSettings,
      [DiscrubSetting.PURGE_MODE]: 'reactions',
    };
    render(<PurgeTab formValues={settings} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Delete Messages'));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.PURGE_MODE, 'messages');
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.PURGE_DELETE_ATTACHMENTS_ONLY, 'false');
  });

  it('retain media checkbox reflects formValues when true', () => {
    const settings: AppSettings = {
      ...defaultSettings,
      [DiscrubSetting.PURGE_RETAIN_ATTACHED_MEDIA]: 'true',
    };
    render(<PurgeTab formValues={settings} onChange={onChange} />);
    expect(screen.getByLabelText('Clear text, keep attachments')).toBeChecked();
  });

  it('toggling retain media checkbox calls onChange with correct key and value', () => {
    render(<PurgeTab formValues={defaultSettings} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear text, keep attachments'));
    expect(onChange).toHaveBeenCalledWith(DiscrubSetting.PURGE_RETAIN_ATTACHED_MEDIA, 'true');
  });

  it('disables retain-media checkbox when Reactions mode is selected', () => {
    const settings: AppSettings = {
      ...defaultSettings,
      [DiscrubSetting.PURGE_MODE]: 'reactions',
    };
    render(<PurgeTab formValues={settings} onChange={onChange} />);
    expect(screen.getByLabelText('Clear text, keep attachments')).toBeDisabled();
  });

  it('disables retain-media checkbox when Attachments Only mode is selected', () => {
    const settings: AppSettings = {
      ...defaultSettings,
      [DiscrubSetting.PURGE_MODE]: 'messages',
      [DiscrubSetting.PURGE_DELETE_ATTACHMENTS_ONLY]: 'true',
    };
    render(<PurgeTab formValues={settings} onChange={onChange} />);
    expect(screen.getByLabelText('Clear text, keep attachments')).toBeDisabled();
  });

  it('enables retain-media checkbox when Delete Messages mode is selected', () => {
    render(<PurgeTab formValues={defaultSettings} onChange={onChange} />);
    expect(screen.getByLabelText('Clear text, keep attachments')).not.toBeDisabled();
  });

  it('does NOT render old "Delete attachments only" checkbox', () => {
    render(<PurgeTab formValues={defaultSettings} onChange={onChange} />);
    expect(screen.queryByLabelText('Delete attachments only')).not.toBeInTheDocument();
  });

  it('renders the warning alert', () => {
    render(<PurgeTab formValues={defaultSettings} onChange={onChange} />);
    expect(screen.getByText(/They can be overridden per-operation/)).toBeInTheDocument();
  });
});
