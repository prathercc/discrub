import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, act } from '@/test/test-utils';
import { createBaseState } from '@/test/state-factories';
import OperationTip from './OperationTip';
import { initialStatusState } from '@features/status/statusTypes';

describe('OperationTip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when tip is not visible', () => {
    const { container } = renderWithProviders(<OperationTip />, {
      preloadedState: createBaseState(),
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders tip message when visible', () => {
    renderWithProviders(<OperationTip />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          operationTip: { isVisible: true, message: 'Operation queued' },
        },
      }),
    });
    expect(screen.getByText('Operation queued')).toBeInTheDocument();
  });

  it('auto-dismisses after 3 seconds', () => {
    const { store } = renderWithProviders(<OperationTip />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          operationTip: { isVisible: true, message: 'Auto dismiss test' },
        },
      }),
    });

    expect(screen.getByText('Auto dismiss test')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // After 3s the hideOperationTip action should have been dispatched
    expect(store.getState().status.operationTip.isVisible).toBe(false);
  });

  it('dismisses on click', () => {
    const { store } = renderWithProviders(<OperationTip />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          operationTip: { isVisible: true, message: 'Click to dismiss' },
        },
      }),
    });

    fireEvent.click(screen.getByText('Click to dismiss'));

    expect(store.getState().status.operationTip.isVisible).toBe(false);
  });

  it('resets timer when message changes', () => {
    const { store } = renderWithProviders(<OperationTip />, {
      preloadedState: createBaseState({
        status: {
          ...initialStatusState,
          operationTip: { isVisible: true, message: 'First tip' },
        },
      }),
    });

    // Advance 2 seconds (not yet dismissed)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(store.getState().status.operationTip.isVisible).toBe(true);

    // Simulate a new tip by dispatching showOperationTip
    act(() => {
      store.dispatch({ type: 'status/showOperationTip', payload: 'Second tip' });
    });

    // Advance another 2 seconds (would have been 4s total from first tip)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Should still be visible because timer reset with new message
    expect(store.getState().status.operationTip.isVisible).toBe(true);

    // After the full 3s from the new tip, it should dismiss
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(store.getState().status.operationTip.isVisible).toBe(false);
  });
});
