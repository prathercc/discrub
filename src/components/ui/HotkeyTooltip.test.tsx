import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { HotkeyTooltip } from './HotkeyTooltip';
import { renderWithProviders } from '@/test/test-utils';
import { createBaseState } from '@/test/state-factories';

beforeEach(() => {
  vi.useRealTimers();
});

describe('HotkeyTooltip', () => {
  it('shows "Label (key)" when hotkeys are enabled and a binding exists', async () => {
    const state = createBaseState({
      hotkeys: { enabled: true, bindings: { ...{} as any, openFilters: '/' } as any },
    });
    renderWithProviders(
      <HotkeyTooltip actionId="openFilters" label="Filters">
        <button>Filters</button>
      </HotkeyTooltip>,
      { preloadedState: state },
    );
    fireEvent.mouseOver(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByRole('tooltip').textContent).toBe('Filters (/)');
    });
  });

  it('drops the suffix when the master toggle is off', async () => {
    const state = createBaseState({
      hotkeys: { enabled: false, bindings: { ...{} as any, openFilters: '/' } as any },
    });
    renderWithProviders(
      <HotkeyTooltip actionId="openFilters" label="Filters">
        <button>Filters</button>
      </HotkeyTooltip>,
      { preloadedState: state },
    );
    fireEvent.mouseOver(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByRole('tooltip').textContent).toBe('Filters');
    });
  });

  it('drops the suffix when no binding is set for the action', async () => {
    const state = createBaseState({
      hotkeys: { enabled: true, bindings: { ...{} as any, openFilters: '' } as any },
    });
    renderWithProviders(
      <HotkeyTooltip actionId="openFilters" label="Filters">
        <button>Filters</button>
      </HotkeyTooltip>,
      { preloadedState: state },
    );
    fireEvent.mouseOver(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByRole('tooltip').textContent).toBe('Filters');
    });
  });

  it('renders the platform-formatted modifier (Ctrl+ on non-Mac)', async () => {
    const originalUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
    });
    try {
      const state = createBaseState({
        hotkeys: { enabled: true, bindings: { ...{} as any, openSettings: 'mod+,' } as any },
      });
      renderWithProviders(
        <HotkeyTooltip actionId="openSettings" label="Settings">
          <button>Settings</button>
        </HotkeyTooltip>,
        { preloadedState: state },
      );
      fireEvent.mouseOver(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('tooltip').textContent).toBe('Settings (Ctrl+,)');
      });
    } finally {
      if (originalUA) Object.defineProperty(navigator, 'userAgent', originalUA);
    }
  });
});
