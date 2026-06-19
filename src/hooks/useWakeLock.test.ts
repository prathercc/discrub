import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let mockIsOperationRunning = false;

vi.mock('@/app/hooks', () => ({
  useAppSelector: (selector: () => unknown) => selector(),
}));

vi.mock('@features/app/operationSelectors', () => ({
  selectIsOperationRunning: () => mockIsOperationRunning,
}));

// Import after mocks.
import { useWakeLock } from './useWakeLock';

// Let any pending microtasks (the awaited wakeLock.request) settle.
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('useWakeLock', () => {
  let request: ReturnType<typeof vi.fn>;
  let release: ReturnType<typeof vi.fn>;
  let releaseListeners: Array<() => void>;

  beforeEach(() => {
    mockIsOperationRunning = false;
    releaseListeners = [];
    release = vi.fn().mockResolvedValue(undefined);
    const sentinel = {
      release,
      addEventListener: (_: string, cb: () => void) => releaseListeners.push(cb),
    };
    request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });

  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    vi.restoreAllMocks();
  });

  it('does not request a wake lock when idle', () => {
    renderHook(() => useWakeLock());
    expect(request).not.toHaveBeenCalled();
  });

  it('requests a screen wake lock when an operation is running', async () => {
    mockIsOperationRunning = true;
    renderHook(() => useWakeLock());
    await flush();
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('releases the wake lock on unmount', async () => {
    mockIsOperationRunning = true;
    const { unmount } = renderHook(() => useWakeLock());
    await flush();
    unmount();
    await flush();
    expect(release).toHaveBeenCalled();
  });

  it('re-acquires after the browser auto-releases on tab-hide then return', async () => {
    mockIsOperationRunning = true;
    renderHook(() => useWakeLock());
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    // Browser releases the lock when the tab is hidden → our listener clears
    // the ref so a return-to-visible can re-acquire.
    act(() => releaseListeners.forEach((cb) => cb()));
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await flush();

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('no-ops when the Wake Lock API is unsupported', () => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    mockIsOperationRunning = true;
    expect(() => renderHook(() => useWakeLock())).not.toThrow();
  });
});
