import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HotkeysTab } from './HotkeysTab';
import { DEFAULT_HOTKEYS } from '@features/hotkeys/defaults';
import type { HotkeysState } from '@features/hotkeys/types';

function renderTab(initial?: Partial<HotkeysState>) {
  const onChange = vi.fn();
  let current: HotkeysState = {
    enabled: true,
    bindings: { ...DEFAULT_HOTKEYS },
    ...initial,
  };
  const Wrapper = () => (
    <HotkeysTab
      formHotkeys={current}
      onHotkeysChange={(next) => {
        current = next;
        onChange(next);
      }}
    />
  );
  const { rerender } = render(<Wrapper />);
  return {
    onChange,
    rerender: () => rerender(<Wrapper />),
    getCurrent: () => current,
  };
}

describe('HotkeysTab', () => {
  it('renders every action grouped by scope with its current binding', () => {
    renderTab();
    expect(screen.getByText('Toggle focus mode')).toBeInTheDocument();
    expect(screen.getAllByText('F').length).toBeGreaterThan(0);
  });

  it('master toggle disables every row', () => {
    renderTab({ enabled: false });
    expect(screen.getByText(/Hotkeys are off/)).toBeInTheDocument();
  });

  it('search input filters the visible rows', () => {
    renderTab();
    const search = screen.getByPlaceholderText('Find a hotkey…');
    fireEvent.change(search, { target: { value: 'export' } });
    expect(screen.getByText('Open Export')).toBeInTheDocument();
    expect(screen.queryByText('Toggle focus mode')).not.toBeInTheDocument();
  });

  it('shows a no-results message when the search has no matches', () => {
    renderTab();
    const search = screen.getByPlaceholderText('Find a hotkey…');
    fireEvent.change(search, { target: { value: 'xyzzy-no-such-action' } });
    expect(screen.getByText(/No shortcuts match/)).toBeInTheDocument();
  });

  it('clicking the binding chip enters capture mode', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('hotkey-chip-toggleFocus'));
    expect(await screen.findByText('Press a key…')).toBeInTheDocument();
  });

  it('capture-mode auto-commits on key release (no per-row Save button)', async () => {
    const { onChange } = renderTab();
    fireEvent.click(screen.getByTestId('hotkey-chip-toggleFocus'));
    expect(await screen.findByText('Press a key…')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'x' });
    // No Save button in the new design — the keystroke immediately
    // calls onHotkeysChange with the new binding.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].bindings.toggleFocus).toBe('X');
    // Capture mode exits automatically after commit.
    expect(screen.queryByText('Press a key…')).not.toBeInTheDocument();
  });

  it('Escape during capture cancels the rebind without calling onChange', async () => {
    const { onChange } = renderTab();
    fireEvent.click(screen.getByTestId('hotkey-chip-toggleFocus'));
    expect(await screen.findByText('Press a key…')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Press a key…')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reset-row reverts a single binding to its default through onChange', () => {
    const { onChange } = renderTab({
      bindings: { ...DEFAULT_HOTKEYS, toggleFocus: 'Q' },
    });
    fireEvent.click(screen.getByLabelText('Reset Toggle focus mode to default'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].bindings.toggleFocus).toBe(DEFAULT_HOTKEYS.toggleFocus);
  });

  it('reset-all returns every binding to defaults through onChange', () => {
    const { onChange } = renderTab({
      bindings: { ...DEFAULT_HOTKEYS, toggleFocus: 'Q', openExport: 'Z' },
    });
    fireEvent.click(screen.getByText('Reset all hotkeys'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].bindings).toEqual(DEFAULT_HOTKEYS);
  });

  it('master toggle calls onChange with the new enabled value', () => {
    const { onChange } = renderTab();
    fireEvent.click(screen.getByLabelText('Enable hotkeys'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].enabled).toBe(false);
  });
});
