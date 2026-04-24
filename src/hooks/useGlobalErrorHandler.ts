import { useEffect } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { addStatusEntry } from '@features/status/statusSlice';

/**
 * Registers global error handlers for uncaught exceptions and unhandled
 * promise rejections. Logs them as error entries in the status log.
 *
 * Should be called once from a top-level component (e.g., MainLayout).
 */
export const useGlobalErrorHandler = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const message = event.message || 'Uncaught error';
      dispatch(
        addStatusEntry({
          level: 'error',
          message: `Uncaught: ${message}`,
        })
      );
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        (reason instanceof Error ? reason.message : String(reason)) ||
        'Unhandled promise rejection';
      dispatch(
        addStatusEntry({
          level: 'error',
          message: `Unhandled: ${message}`,
        })
      );
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [dispatch]);
};
