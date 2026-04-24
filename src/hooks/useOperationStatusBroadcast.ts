import { useEffect, useRef } from 'react';
import { useAppSelector } from '@/app/hooks';
import { selectOperationSummary } from '@features/app/operationSelectors';
import { isOverlayMode } from '@/extension/messaging';

// Broadcasts operation status to the parent window (content script) via postMessage.
// Only active when running in overlay mode (inside extension iframe).
export function useOperationStatusBroadcast() {
  const summary = useAppSelector(selectOperationSummary);
  const lastRef = useRef<string>('');

  useEffect(() => {
    if (!isOverlayMode()) return;

    const key = `${summary.isRunning}:${summary.label}:${summary.progress ?? ''}`;
    if (key === lastRef.current) return;
    lastRef.current = key;

    window.parent.postMessage(
      { type: 'discrub:operationStatus', payload: summary },
      '*',
    );
  }, [summary]);
}
