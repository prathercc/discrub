import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import hotkeysReducer, {
  loadHotkeys,
  setHotkeyBinding,
  resetHotkeyBinding,
  resetAllHotkeys,
  setHotkeysEnabled,
  setAllHotkeys,
  selectHotkeyBinding,
  selectHotkeysEnabled,
  selectHotkeyBindings,
} from './hotkeysSlice';
import { DEFAULT_HOTKEYS, HOTKEY_ACTIONS, getHotkeyMeta } from './defaults';
import {
  findHotkeyConflicts,
  findConflictingActions,
} from './conflicts';
import type { HotkeyActionId } from './types';
import { storage } from '@/extension/storage';

function makeStore() {
  return configureStore({ reducer: { hotkeys: hotkeysReducer } });
}

beforeEach(async () => {
  await storage.settings.clear();
});

describe('defaults', () => {
  it('every action ID has a default binding', () => {
    for (const a of HOTKEY_ACTIONS) {
      expect(DEFAULT_HOTKEYS[a.id]).toBe(a.defaultKey);
    }
  });

  it('default bindings have no conflicts', () => {
    expect(findHotkeyConflicts(DEFAULT_HOTKEYS).size).toBe(0);
  });

  it('every action has a non-empty label and description', () => {
    for (const a of HOTKEY_ACTIONS) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });

  it('getHotkeyMeta returns the matching entry', () => {
    expect(getHotkeyMeta('toggleFocus').defaultKey).toBe('F');
    expect(getHotkeyMeta('openFilters').defaultKey).toBe('/');
  });
});

describe('findHotkeyConflicts', () => {
  it('returns an empty map for unique bindings', () => {
    const conflicts = findHotkeyConflicts({
      toggleFocus: 'F',
      openFilters: '/',
    } as any);
    expect(conflicts.size).toBe(0);
  });

  it('groups action IDs that share a binding', () => {
    const conflicts = findHotkeyConflicts({
      toggleFocus: 'X',
      openFilters: 'X',
      openExport: 'E',
    } as any);
    expect(conflicts.size).toBe(1);
    expect(conflicts.get('X')?.sort()).toEqual(['openFilters', 'toggleFocus']);
  });

  it('skips empty bindings (unbound is not a conflict)', () => {
    const conflicts = findHotkeyConflicts({
      toggleFocus: '',
      openFilters: '',
      openExport: 'E',
    } as any);
    expect(conflicts.size).toBe(0);
  });
});

describe('findConflictingActions', () => {
  it('lists other actions that share the candidate binding', () => {
    const others = findConflictingActions(
      { toggleFocus: 'F', openFilters: '/', openExport: 'E' } as any,
      'openFilters',
      'F',
    );
    expect(others).toEqual(['toggleFocus']);
  });

  it('excludes the action itself when it already has the candidate binding', () => {
    const others = findConflictingActions(
      { openFilters: '/' } as any,
      'openFilters',
      '/',
    );
    expect(others).toEqual([]);
  });

  it('returns [] for empty candidate', () => {
    const others = findConflictingActions(
      { openFilters: '/' } as any,
      'openExport',
      '',
    );
    expect(others).toEqual([]);
  });
});

describe('hotkeysSlice — initial state', () => {
  it('boots with defaults and enabled=true', () => {
    const store = makeStore();
    expect(selectHotkeysEnabled(store.getState() as any)).toBe(true);
    expect(selectHotkeyBindings(store.getState() as any)).toEqual(DEFAULT_HOTKEYS);
  });
});

describe('loadHotkeys', () => {
  it('falls back to defaults when nothing is stored', async () => {
    const store = makeStore();
    await store.dispatch(loadHotkeys());
    expect(selectHotkeyBindings(store.getState() as any)).toEqual(DEFAULT_HOTKEYS);
    expect(selectHotkeysEnabled(store.getState() as any)).toBe(true);
  });

  it('restores stored bindings and master toggle', async () => {
    await storage.settings.set('hotkeys', {
      enabled: false,
      bindings: { ...DEFAULT_HOTKEYS, toggleFocus: 'X' },
    });
    const store = makeStore();
    await store.dispatch(loadHotkeys());
    expect(selectHotkeysEnabled(store.getState() as any)).toBe(false);
    expect(
      selectHotkeyBinding('toggleFocus' as HotkeyActionId)(store.getState() as any),
    ).toBe('X');
  });

  it('merges stored bindings on top of defaults so newly-added actions are not unbound', async () => {
    // Persist a partial bindings map (as would happen if a future
    // action were added in code after the user already had a stored
    // map). The new action should resolve to its default, not undefined.
    await storage.settings.set('hotkeys', {
      enabled: true,
      bindings: { toggleFocus: 'X' } as any,
    });
    const store = makeStore();
    await store.dispatch(loadHotkeys());
    const bindings = selectHotkeyBindings(store.getState() as any);
    expect(bindings.toggleFocus).toBe('X');
    expect(bindings.openFilters).toBe(DEFAULT_HOTKEYS.openFilters);
  });
});

describe('setHotkeyBinding', () => {
  it('updates state and persists to storage', async () => {
    const store = makeStore();
    await store.dispatch(setHotkeyBinding({ actionId: 'toggleFocus', key: 'X' }));
    expect(
      selectHotkeyBinding('toggleFocus' as HotkeyActionId)(store.getState() as any),
    ).toBe('X');
    const persisted = await storage.settings.get('hotkeys');
    expect((persisted as any).bindings.toggleFocus).toBe('X');
  });

  it('applies optimistically on .pending so rapid sequential dispatches see fresh state', async () => {
    const store = makeStore();
    const p1 = store.dispatch(setHotkeyBinding({ actionId: 'toggleFocus', key: 'X' }));
    // Without optimistic .pending handling, this read would still see the default.
    expect(
      selectHotkeyBinding('toggleFocus' as HotkeyActionId)(store.getState() as any),
    ).toBe('X');
    await p1;
  });
});

describe('resetHotkeyBinding', () => {
  it('reverts a single action to its default', async () => {
    const store = makeStore();
    await store.dispatch(setHotkeyBinding({ actionId: 'toggleFocus', key: 'X' }));
    await store.dispatch(resetHotkeyBinding('toggleFocus' as HotkeyActionId));
    expect(
      selectHotkeyBinding('toggleFocus' as HotkeyActionId)(store.getState() as any),
    ).toBe(DEFAULT_HOTKEYS.toggleFocus);
  });

  it('does not touch other bindings', async () => {
    const store = makeStore();
    await store.dispatch(setHotkeyBinding({ actionId: 'toggleFocus', key: 'X' }));
    await store.dispatch(setHotkeyBinding({ actionId: 'openFilters', key: 'Y' }));
    await store.dispatch(resetHotkeyBinding('toggleFocus' as HotkeyActionId));
    expect(
      selectHotkeyBinding('openFilters' as HotkeyActionId)(store.getState() as any),
    ).toBe('Y');
  });
});

describe('resetAllHotkeys', () => {
  it('restores every binding to its default', async () => {
    const store = makeStore();
    await store.dispatch(setHotkeyBinding({ actionId: 'toggleFocus', key: 'X' }));
    await store.dispatch(setHotkeyBinding({ actionId: 'openFilters', key: 'Y' }));
    await store.dispatch(resetAllHotkeys());
    expect(selectHotkeyBindings(store.getState() as any)).toEqual(DEFAULT_HOTKEYS);
  });

  it('preserves the master enabled flag', async () => {
    const store = makeStore();
    await store.dispatch(setHotkeysEnabled(false));
    await store.dispatch(resetAllHotkeys());
    expect(selectHotkeysEnabled(store.getState() as any)).toBe(false);
  });
});

describe('setHotkeysEnabled', () => {
  it('flips the master toggle without disturbing bindings', async () => {
    const store = makeStore();
    await store.dispatch(setHotkeyBinding({ actionId: 'toggleFocus', key: 'X' }));
    await store.dispatch(setHotkeysEnabled(false));
    expect(selectHotkeysEnabled(store.getState() as any)).toBe(false);
    expect(
      selectHotkeyBinding('toggleFocus' as HotkeyActionId)(store.getState() as any),
    ).toBe('X');
  });

  it('persists the flag to storage', async () => {
    const store = makeStore();
    await store.dispatch(setHotkeysEnabled(false));
    const persisted = await storage.settings.get('hotkeys');
    expect((persisted as any).enabled).toBe(false);
  });
});

describe('setAllHotkeys', () => {
  it('replaces both bindings and enabled with the supplied state', async () => {
    const store = makeStore();
    await store.dispatch(setAllHotkeys({
      enabled: false,
      bindings: { ...DEFAULT_HOTKEYS, toggleFocus: 'Q' },
    }));
    expect(selectHotkeysEnabled(store.getState() as any)).toBe(false);
    expect(
      selectHotkeyBinding('toggleFocus' as HotkeyActionId)(store.getState() as any),
    ).toBe('Q');
  });

  it('persists the batch to storage', async () => {
    const store = makeStore();
    const next = {
      enabled: true,
      bindings: { ...DEFAULT_HOTKEYS, openExport: 'Z' },
    };
    await store.dispatch(setAllHotkeys(next));
    const persisted = await storage.settings.get('hotkeys');
    expect((persisted as any).bindings.openExport).toBe('Z');
  });

  it('applies optimistically on .pending', async () => {
    const store = makeStore();
    const p = store.dispatch(setAllHotkeys({
      enabled: false,
      bindings: { ...DEFAULT_HOTKEYS, toggleFocus: 'Q' },
    }));
    expect(selectHotkeysEnabled(store.getState() as any)).toBe(false);
    await p;
  });
});

describe('persistence error handling', () => {
  it('does not throw if storage write rejects (slice keeps in-memory state)', async () => {
    const spy = vi.spyOn(storage.settings, 'set').mockRejectedValueOnce(new Error('IDB down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = makeStore();
    const action = await store.dispatch(setHotkeyBinding({ actionId: 'toggleFocus', key: 'X' }));
    expect(action.type).toBe('hotkeys/setBinding/rejected');
    // Optimistic update still applied; state retains the new value
    // for subsequent retries even though IDB write failed.
    expect(
      selectHotkeyBinding('toggleFocus' as HotkeyActionId)(store.getState() as any),
    ).toBe('X');
    spy.mockRestore();
    errSpy.mockRestore();
  });
});
