import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEV_TOOLS_EVENT,
  DEV_TOOLS_KEY,
  isDevToolsEnabled,
  toggleDevTools,
} from './devTools';

beforeEach(() => {
  localStorage.removeItem(DEV_TOOLS_KEY);
});

describe('isDevToolsEnabled', () => {
  it('returns false when the flag is unset', () => {
    expect(isDevToolsEnabled()).toBe(false);
  });

  it('returns true when the flag is "true"', () => {
    localStorage.setItem(DEV_TOOLS_KEY, 'true');
    expect(isDevToolsEnabled()).toBe(true);
  });

  it('returns false for any non-true value', () => {
    localStorage.setItem(DEV_TOOLS_KEY, 'false');
    expect(isDevToolsEnabled()).toBe(false);
    localStorage.setItem(DEV_TOOLS_KEY, '1');
    expect(isDevToolsEnabled()).toBe(false);
  });
});

describe('toggleDevTools', () => {
  it('flips false → true and persists', () => {
    expect(toggleDevTools()).toBe(true);
    expect(localStorage.getItem(DEV_TOOLS_KEY)).toBe('true');
  });

  it('flips true → false (removes the key)', () => {
    localStorage.setItem(DEV_TOOLS_KEY, 'true');
    expect(toggleDevTools()).toBe(false);
    expect(localStorage.getItem(DEV_TOOLS_KEY)).toBeNull();
  });

  it('dispatches a same-tab CustomEvent on toggle', () => {
    const listener = vi.fn();
    window.addEventListener(DEV_TOOLS_EVENT, listener);
    toggleDevTools();
    expect(listener).toHaveBeenCalled();
    const evt = listener.mock.calls[0][0] as CustomEvent<boolean>;
    expect(evt.detail).toBe(true);
    window.removeEventListener(DEV_TOOLS_EVENT, listener);
  });
});
