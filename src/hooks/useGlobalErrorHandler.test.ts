import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGlobalErrorHandler } from './useGlobalErrorHandler';

// Mock the hooks and dispatch
const mockDispatch = vi.fn();
vi.mock('@/app/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn(),
}));

vi.mock('@features/status/statusSlice', () => ({
  addStatusEntry: vi.fn((payload) => ({ type: 'status/addStatusEntry', payload })),
}));

describe('useGlobalErrorHandler', () => {
  afterEach(() => {
    mockDispatch.mockClear();
  });

  it('registers error and unhandledrejection listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useGlobalErrorHandler());

    expect(addSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

    addSpy.mockRestore();
  });

  it('removes listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useGlobalErrorHandler());
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

    removeSpy.mockRestore();
  });

  it('dispatches error entry on window error event', () => {
    renderHook(() => useGlobalErrorHandler());

    const errorEvent = new ErrorEvent('error', { message: 'Test error' });
    window.dispatchEvent(errorEvent);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { level: 'error', message: 'Uncaught: Test error' },
      })
    );
  });

  it('handles error events with no message', () => {
    renderHook(() => useGlobalErrorHandler());

    const errorEvent = new ErrorEvent('error', { message: '' });
    window.dispatchEvent(errorEvent);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { level: 'error', message: 'Uncaught: Uncaught error' },
      })
    );
  });

  it('dispatches error entry on unhandled rejection with Error reason', () => {
    renderHook(() => useGlobalErrorHandler());

    // jsdom doesn't have PromiseRejectionEvent — use CustomEvent with reason
    const event = new Event('unhandledrejection') as any;
    event.reason = new Error('Promise failed');
    window.dispatchEvent(event);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { level: 'error', message: 'Unhandled: Promise failed' },
      })
    );
  });

  it('handles string rejection reasons', () => {
    renderHook(() => useGlobalErrorHandler());

    const event = new Event('unhandledrejection') as any;
    event.reason = 'Something broke';
    window.dispatchEvent(event);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { level: 'error', message: 'Unhandled: Something broke' },
      })
    );
  });
});
