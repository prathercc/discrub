import { useEffect, useState } from 'react';
import { DEV_TOOLS_EVENT, DEV_TOOLS_KEY, isDevToolsEnabled } from './devTools';

/**
 * Subscribe to the dev-tools localStorage flag (#153).
 *
 * Reads on mount and re-renders on toggle in this tab (custom event)
 * or in another tab (native storage event). Returns the boolean.
 */
export function useDevToolsEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => isDevToolsEnabled());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEV_TOOLS_KEY) {
        setEnabled(e.newValue === 'true');
      }
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setEnabled(typeof detail === 'boolean' ? detail : isDevToolsEnabled());
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(DEV_TOOLS_EVENT, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(DEV_TOOLS_EVENT, onCustom);
    };
  }, []);

  return enabled;
}
