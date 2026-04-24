import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockDispatch = vi.fn();
let mockIsOverlayMode = false;

vi.mock('@/app/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@features/app/appSlice', () => ({
  setMinimized: (value: boolean) => ({ type: 'app/setMinimized', payload: value }),
}));

vi.mock('@/extension/messaging', () => ({
  isOverlayMode: () => mockIsOverlayMode,
}));

import { useRestoreListener } from './useRestoreListener';

describe('useRestoreListener', () => {
  beforeEach(() => {
    mockIsOverlayMode = false;
    mockDispatch.mockClear();
  });

  it('should not add listener when not in overlay mode', () => {
    mockIsOverlayMode = false;
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useRestoreListener());

    const messageListeners = addSpy.mock.calls.filter(([type]) => type === 'message');
    expect(messageListeners.length).toBe(0);
    addSpy.mockRestore();
  });

  it('should dispatch setMinimized(false) on restored message', () => {
    mockIsOverlayMode = true;
    renderHook(() => useRestoreListener());

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'discrub:restored' } })
      );
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'app/setMinimized',
      payload: false,
    });
  });

  it('should ignore unrelated messages', () => {
    mockIsOverlayMode = true;
    renderHook(() => useRestoreListener());

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'other:event' } })
      );
    });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('should clean up listener on unmount', () => {
    mockIsOverlayMode = true;
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useRestoreListener());

    unmount();

    const messageListeners = removeSpy.mock.calls.filter(([type]) => type === 'message');
    expect(messageListeners.length).toBe(1);
    removeSpy.mockRestore();
  });

  it('should restore correctly while operation is still running', () => {
    mockIsOverlayMode = true;
    renderHook(() => useRestoreListener());

    // Simulate restored event (operation may still be running — doesn't matter)
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'discrub:restored' } })
      );
    });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'app/setMinimized',
      payload: false,
    });
  });
});
