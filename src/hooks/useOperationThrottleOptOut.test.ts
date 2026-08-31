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
import { useOperationThrottleOptOut } from './useOperationThrottleOptOut';

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

describe('useOperationThrottleOptOut', () => {
  let request: ReturnType<typeof vi.fn>;
  let heldPromises: Promise<unknown>[];

  beforeEach(() => {
    mockIsOperationRunning = false;
    heldPromises = [];
    request = vi.fn((...args: unknown[]): unknown => {
      const cb = args[2] as () => Promise<unknown>;
      const held = cb();
      heldPromises.push(held);
      return held.catch(() => undefined);
    });
    Object.defineProperty(navigator, 'locks', {
      value: { request },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    delete (navigator as { locks?: unknown }).locks;
  });

  it('holds a lock only while an operation runs, and releases it after', async () => {
    const { rerender, unmount } = renderHook(() => useOperationThrottleOptOut());
    expect(request).not.toHaveBeenCalled();

    mockIsOperationRunning = true;
    rerender();
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('discrub-operation-running', { mode: 'shared' }, expect.any(Function));

    let settled = false;
    void heldPromises[0].then(() => {
      settled = true;
    });
    await flush();
    expect(settled).toBe(false); // still held while running

    mockIsOperationRunning = false;
    rerender();
    await flush();
    expect(settled).toBe(true); // released on stop

    unmount();
  });

  it('releases the lock on unmount', async () => {
    mockIsOperationRunning = true;
    const { unmount } = renderHook(() => useOperationThrottleOptOut());
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    let settled = false;
    void heldPromises[0].then(() => {
      settled = true;
    });
    unmount();
    await flush();
    expect(settled).toBe(true);
  });

  it('no-ops where the Locks API is missing', async () => {
    delete (navigator as { locks?: unknown }).locks;
    mockIsOperationRunning = true;
    const { unmount } = renderHook(() => useOperationThrottleOptOut());
    await flush();
    expect(request).not.toHaveBeenCalled();
    unmount();
  });
});
