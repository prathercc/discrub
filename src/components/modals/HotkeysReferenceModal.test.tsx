import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { createBaseState } from '@/test/state-factories';
import { HotkeysReferenceModal } from './HotkeysReferenceModal';
import { DEFAULT_HOTKEYS } from '@features/hotkeys/defaults';

describe('HotkeysReferenceModal', () => {
  it('renders every group when open', () => {
    renderWithProviders(<HotkeysReferenceModal open onClose={() => {}} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('During an operation')).toBeInTheDocument();
    expect(screen.getByText('In a channel')).toBeInTheDocument();
    expect(screen.getByText('App-wide')).toBeInTheDocument();
  });

  it('shows the disabled banner when master toggle is off', () => {
    const state = createBaseState({
      hotkeys: { enabled: false, bindings: { ...DEFAULT_HOTKEYS } as any },
    });
    renderWithProviders(<HotkeysReferenceModal open onClose={() => {}} />, {
      preloadedState: state,
    });
    expect(screen.getByText(/Hotkeys are currently disabled/)).toBeInTheDocument();
  });

  it('hides the disabled banner when hotkeys are on', () => {
    renderWithProviders(<HotkeysReferenceModal open onClose={() => {}} />);
    expect(screen.queryByText(/Hotkeys are currently disabled/)).not.toBeInTheDocument();
  });

  it('renders the binding chip for each action', () => {
    renderWithProviders(<HotkeysReferenceModal open onClose={() => {}} />);
    // toggleFocus → "F"; openSettings → "mod+," (formatted as ⌘ or Ctrl+).
    expect(screen.getAllByText('F').length).toBeGreaterThan(0);
  });

  it('does not render when open=false', () => {
    renderWithProviders(<HotkeysReferenceModal open={false} onClose={() => {}} />);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('calls onClose when the close icon is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<HotkeysReferenceModal open onClose={onClose} />);
    const closeBtn = screen.getByLabelText(/close/i);
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
