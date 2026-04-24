import { useEffect } from 'react';
import { useAppSelector } from '@/app/hooks';
import { selectIsOperationRunning } from '@features/app/operationSelectors';
import { selectIsMinimized } from '@features/app/appSlice';

// Warns users before closing the tab/window when an operation is running or overlay is minimized.
export function useBeforeUnloadWarning() {
  const isOperationRunning = useAppSelector(selectIsOperationRunning);
  const isMinimized = useAppSelector(selectIsMinimized);
  const shouldWarn = isOperationRunning || isMinimized;

  useEffect(() => {
    if (!shouldWarn) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldWarn]);
}
