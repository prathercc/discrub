import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { createBaseState } from '@/test/state-factories';
import { HotkeysTab } from './HotkeysTab';
import { storage } from '@/extension/storage';
import { DEFAULT_HOTKEYS } from '@features/hotkeys/defaults';

beforeEach(async () => {
  await storage.settings.clear();
});

describe('HotkeysTab', () => {
  it('renders every action grouped by scope with its current binding', () => {
    renderWithProviders(<HotkeysTab />);
    // Spot-check: the focus-mode action shows its label and the
    // default binding "F" in a chip.
    expect(screen.getByText('Toggle focus mode')).toBeInTheDocument();
    expect(screen.getAllByText('F').length).toBeGreaterThan(0);
  });

  it('master toggle disables every row', () => {
    const state = createBaseState({
      hotkeys: { enabled: false, bindings: { ...DEFAULT_HOTKEYS } as any },
    });
    renderWithProviders(<HotkeysTab />, { preloadedState: state });
    expect(screen.getByText(/Hotkeys are off/)).toBeInTheDocument();
  });

  it('search input filters the visible rows', () => {
    renderWithProviders(<HotkeysTab />);
    const search = screen.getByPlaceholderText('Find a hotkey…');
    fireEvent.change(search, { target: { value: 'export' } });
    expect(screen.getByText('Open Export')).toBeInTheDocument();
    expect(screen.queryByText('Toggle focus mode')).not.toBeInTheDocument();
  });

  it('shows a no-results message when the search has no matches', () => {
    renderWithProviders(<HotkeysTab />);
    const search = screen.getByPlaceholderText('Find a hotkey…');
    fireEvent.change(search, { target: { value: 'xyzzy-no-such-action' } });
    expect(screen.getByText(/No shortcuts match/)).toBeInTheDocument();
  });

  it('clicking the binding chip enters capture mode', async () => {
    renderWithProviders(<HotkeysTab />);
    // Find a row's binding chip and click it. The defaults map has
    // toggleFocus → "F", so a chip with that label exists.
    const chips = screen.getAllByText('F');
    fireEvent.click(chips[0]);
    expect(await screen.findByText('Press a key…')).toBeInTheDocument();
  });

  it('persisting a rebind shows the new binding in the chip', async () => {
    renderWithProviders(<HotkeysTab />);
    const chips = screen.getAllByText('F');
    fireEvent.click(chips[0]);
    // Press X while in capture mode — the document-level capture
    // listener picks it up and sets the pending binding.
    fireEvent.keyDown(document, { key: 'x' });
    const saveBtn = await screen.findByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getAllByText('X').length).toBeGreaterThan(0);
    });
  });

  it('Escape during capture cancels the rebind', async () => {
    renderWithProviders(<HotkeysTab />);
    const chips = screen.getAllByText('F');
    fireEvent.click(chips[0]);
    expect(await screen.findByText('Press a key…')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Press a key…')).not.toBeInTheDocument();
    });
  });
});
