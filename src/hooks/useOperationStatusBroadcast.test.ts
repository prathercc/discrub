import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let mockSummary = { isRunning: false, label: 'Idle' };
let mockIsOverlayMode = false;

vi.mock('@/app/hooks', () => ({
  useAppSelector: () => mockSummary,
}));

vi.mock('@features/app/operationSelectors', () => ({
  selectOperationSummary: vi.fn(),
}));

vi.mock('@/extension/messaging', () => ({
  isOverlayMode: () => mockIsOverlayMode,
}));

import { useOperationStatusBroadcast } from './useOperationStatusBroadcast';

describe('useOperationStatusBroadcast', () => {
  let postMessageSpy: any;

  beforeEach(() => {
    mockSummary = { isRunning: false, label: 'Idle' };
    mockIsOverlayMode = false;
    postMessageSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    postMessageSpy.mockRestore();
  });

  it('should not post when not in overlay mode', () => {
    mockIsOverlayMode = false;
    renderHook(() => useOperationStatusBroadcast());
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('should post status when in overlay mode', () => {
    mockIsOverlayMode = true;
    renderHook(() => useOperationStatusBroadcast());
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'discrub:operationStatus', payload: mockSummary },
      '*',
    );
  });

  it('should skip duplicate posts', () => {
    mockIsOverlayMode = true;
    const { rerender } = renderHook(() => useOperationStatusBroadcast());

    expect(postMessageSpy).toHaveBeenCalledTimes(1);

    // Rerender with same summary — should not post again
    rerender();
    expect(postMessageSpy).toHaveBeenCalledTimes(1);
  });

  it('should post when summary changes', () => {
    mockIsOverlayMode = true;
    const { rerender } = renderHook(() => useOperationStatusBroadcast());

    expect(postMessageSpy).toHaveBeenCalledTimes(1);

    mockSummary = { isRunning: true, label: 'Exporting...' };
    rerender();
    expect(postMessageSpy).toHaveBeenCalledTimes(2);
    expect(postMessageSpy).toHaveBeenLastCalledWith(
      { type: 'discrub:operationStatus', payload: { isRunning: true, label: 'Exporting...' } },
      '*',
    );
  });

  it('should post idle when operation completes', () => {
    mockIsOverlayMode = true;
    mockSummary = { isRunning: true, label: 'Exporting...' };
    const { rerender } = renderHook(() => useOperationStatusBroadcast());

    mockSummary = { isRunning: false, label: 'Idle' };
    rerender();

    expect(postMessageSpy).toHaveBeenLastCalledWith(
      { type: 'discrub:operationStatus', payload: { isRunning: false, label: 'Idle' } },
      '*',
    );
  });

  it('should post progress updates during export', () => {
    mockIsOverlayMode = true;
    mockSummary = { isRunning: true, label: 'Exporting (attachments)... 10%', progress: 10 } as any;
    const { rerender } = renderHook(() => useOperationStatusBroadcast());

    mockSummary = { isRunning: true, label: 'Exporting (attachments)... 50%', progress: 50 } as any;
    rerender();

    expect(postMessageSpy).toHaveBeenCalledTimes(2);
  });

  it('should handle rapid state transitions', () => {
    mockIsOverlayMode = true;
    const { rerender } = renderHook(() => useOperationStatusBroadcast());

    mockSummary = { isRunning: true, label: 'Loading messages...' };
    rerender();

    mockSummary = { isRunning: true, label: 'Exporting...' };
    rerender();

    mockSummary = { isRunning: false, label: 'Idle' };
    rerender();

    // 4 total: initial idle + 3 changes
    expect(postMessageSpy).toHaveBeenCalledTimes(4);
  });
});
