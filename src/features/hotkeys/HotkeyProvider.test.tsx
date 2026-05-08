import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import hotkeysReducer, { setHotkeyBinding, setHotkeysEnabled } from './hotkeysSlice';
import { HotkeyProvider, useHotkey } from './HotkeyProvider';
import { storage } from '@/extension/storage';

function makeStore() {
  return configureStore({ reducer: { hotkeys: hotkeysReducer } });
}

beforeEach(async () => {
  await storage.settings.clear();
});

interface ProbeProps {
  actionId: Parameters<typeof useHotkey>[0];
  onFire: () => void;
  enabled?: boolean;
}
const Probe = ({ actionId, onFire, enabled = true }: ProbeProps) => {
  useHotkey(actionId, onFire, enabled);
  return null;
};

function renderWithProvider(node: React.ReactNode, store = makeStore()) {
  return render(
    <Provider store={store as any}>
      <HotkeyProvider>{node}</HotkeyProvider>
    </Provider>,
  );
}

describe('HotkeyProvider', () => {
  it('fires the registered handler for the bound key', () => {
    const onFire = vi.fn();
    renderWithProvider(<Probe actionId="toggleFocus" onFire={onFire} />);
    // Default binding for toggleFocus is "F".
    fireEvent.keyDown(document, { key: 'f' });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('does not fire when focus is inside an INPUT', () => {
    const onFire = vi.fn();
    renderWithProvider(
      <>
        <input data-testid="probe-input" />
        <Probe actionId="toggleFocus" onFire={onFire} />
      </>,
    );
    const input = document.querySelector('[data-testid="probe-input"]') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'f' });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('does not fire when focus is inside a TEXTAREA', () => {
    const onFire = vi.fn();
    renderWithProvider(
      <>
        <textarea data-testid="probe-ta" />
        <Probe actionId="toggleFocus" onFire={onFire} />
      </>,
    );
    const ta = document.querySelector('[data-testid="probe-ta"]') as HTMLTextAreaElement;
    ta.focus();
    fireEvent.keyDown(ta, { key: 'f' });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('does not fire when focus is inside a contenteditable', () => {
    const onFire = vi.fn();
    renderWithProvider(
      <>
        <div data-testid="probe-ce" contentEditable />
        <Probe actionId="toggleFocus" onFire={onFire} />
      </>,
    );
    const ce = document.querySelector('[data-testid="probe-ce"]') as HTMLDivElement;
    ce.focus();
    fireEvent.keyDown(ce, { key: 'f' });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('does not fire when the per-action enabled flag is false', () => {
    const onFire = vi.fn();
    renderWithProvider(<Probe actionId="toggleFocus" onFire={onFire} enabled={false} />);
    fireEvent.keyDown(document, { key: 'f' });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('does not fire when the master toggle is off', async () => {
    const store = makeStore();
    await store.dispatch(setHotkeysEnabled(false));
    const onFire = vi.fn();
    renderWithProvider(<Probe actionId="toggleFocus" onFire={onFire} />, store);
    fireEvent.keyDown(document, { key: 'f' });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('honors a rebinding — old key stops working, new key fires', async () => {
    const store = makeStore();
    const onFire = vi.fn();
    renderWithProvider(<Probe actionId="toggleFocus" onFire={onFire} />, store);
    await store.dispatch(setHotkeyBinding({ actionId: 'toggleFocus', key: 'X' }));

    fireEvent.keyDown(document, { key: 'f' });
    expect(onFire).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'x' });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('respects defaultPrevented (does not fire after a Dialog consumed Esc)', () => {
    const onFire = vi.fn();
    renderWithProvider(<Probe actionId="closeModalOrExitFocus" onFire={onFire} />);
    const evt = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    Object.defineProperty(evt, 'defaultPrevented', { get: () => true });
    document.dispatchEvent(evt);
    expect(onFire).not.toHaveBeenCalled();
  });

  it('handles mod+key bindings — Cmd+, fires openSettings', () => {
    const onFire = vi.fn();
    renderWithProvider(<Probe actionId="openSettings" onFire={onFire} />);
    fireEvent.keyDown(document, { key: ',', metaKey: true });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('handles mod+key bindings — Ctrl+, also fires openSettings', () => {
    const onFire = vi.fn();
    renderWithProvider(<Probe actionId="openSettings" onFire={onFire} />);
    fireEvent.keyDown(document, { key: ',', ctrlKey: true });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('a later useHotkey registration replaces an earlier one for the same actionId', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, container } = renderWithProvider(
      <>
        <Probe actionId="toggleFocus" onFire={first} />
        <Probe actionId="toggleFocus" onFire={second} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'f' });
    // Second registration wins (Map.set overwrites). Stable across
    // re-renders so the modal-while-open pattern works correctly.
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    rerender(
      <Provider store={makeStore() as any}>
        <HotkeyProvider>
          <Probe actionId="toggleFocus" onFire={first} />
          <Probe actionId="toggleFocus" onFire={second} />
        </HotkeyProvider>
      </Provider>,
    );
    expect(container).toBeTruthy();
  });
});
