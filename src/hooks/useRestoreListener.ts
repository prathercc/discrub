import { useEffect } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { setMinimized } from '@features/app/appSlice';
import { isOverlayMode } from '@/extension/messaging';

// Listens for 'discrub:restored' messages from the content script (parent window).
// Dispatches setMinimized(false) when the overlay is restored from the floating tab.
// Only active when running in overlay mode (inside extension iframe).
export function useRestoreListener() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!isOverlayMode()) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'discrub:restored') {
        dispatch(setMinimized(false));
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [dispatch]);
}
