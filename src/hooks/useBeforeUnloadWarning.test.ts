import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let mockIsOperationRunning = false;
let mockIsMinimized = false;

vi.mock('@/app/hooks', () => ({
  useAppSelector: (selector: Function) => selector({
    export: { isExporting: false },
    message: {
      isLoading: false,
      pagination: { isLoadingAll: false },
    },
    app: { isMinimized: mockIsMinimized },
  }),
}));

vi.mock('@features/app/operationSelectors', () => ({
  selectIsOperationRunning: () => mockIsOperationRunning,
}));

vi.mock('@features/app/appSlice', () => ({
  selectIsMinimized: (state: { app: { isMinimized: boolean } }) => state.app.isMinimized,
}));

// Must import after mocks
import { useBeforeUnloadWarning } from './useBeforeUnloadWarning';

describe('useBeforeUnloadWarning', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let addSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let removeSpy: any;

  beforeEach(() => {
    mockIsOperationRunning = false;
    mockIsMinimized = false;
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('should not add listener when idle and not minimized', () => {
    renderHook(() => useBeforeUnloadWarning());
    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('should add listener when operation is running', () => {
    mockIsOperationRunning = true;
    renderHook(() => useBeforeUnloadWarning());
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('should add listener when minimized', () => {
    mockIsMinimized = true;
    renderHook(() => useBeforeUnloadWarning());
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('should add listener when both running and minimized', () => {
    mockIsOperationRunning = true;
    mockIsMinimized = true;
    renderHook(() => useBeforeUnloadWarning());
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('should remove listener on unmount', () => {
    mockIsOperationRunning = true;
    const { unmount } = renderHook(() => useBeforeUnloadWarning());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });
});
