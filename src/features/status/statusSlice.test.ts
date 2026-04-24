import { describe, it, expect, beforeEach } from 'vitest';
import statusReducer, { addStatusEntry, clearStatusLog, showOperationTip, hideOperationTip, selectStatusEntries, selectStatusCount, selectOperationTip } from './statusSlice';
import { createTestStore } from '@/test/test-utils';
import { initialStatusState } from './statusTypes';
import { storage } from '@/extension/storage';

function createStore(preloadedState?: Record<string, unknown>) {
  return createTestStore(
    { status: statusReducer },
    preloadedState,
  );
}

// Persistence is fire-and-forget; flush microtasks so the write completes
// before assertions read it back.
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('statusSlice', () => {
  beforeEach(async () => {
    await storage.statuslog.clear();
  });

  describe('addStatusEntry', () => {
    it('adds an entry to the log', () => {
      const store = createStore();
      store.dispatch(addStatusEntry({ level: 'info', message: 'Test message' }));
      const entries = selectStatusEntries(store.getState());
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('info');
      expect(entries[0].message).toBe('Test message');
      expect(entries[0].id).toBeDefined();
      expect(entries[0].timestamp).toBeGreaterThan(0);
    });

    it('adds multiple entries', () => {
      const store = createStore();
      store.dispatch(addStatusEntry({ level: 'info', message: 'First' }));
      store.dispatch(addStatusEntry({ level: 'warning', message: 'Second' }));
      store.dispatch(addStatusEntry({ level: 'error', message: 'Third' }));
      const entries = selectStatusEntries(store.getState());
      expect(entries).toHaveLength(3);
      expect(entries[0].message).toBe('First');
      expect(entries[1].message).toBe('Second');
      expect(entries[2].message).toBe('Third');
    });

    it('caps entries at maxEntries', () => {
      const store = createStore({
        status: { ...initialStatusState, maxEntries: 3 },
      });
      for (let i = 0; i < 5; i++) {
        store.dispatch(addStatusEntry({ level: 'info', message: `Entry ${i}` }));
      }
      const entries = selectStatusEntries(store.getState());
      expect(entries).toHaveLength(3);
      // Should keep the last 3
      expect(entries[0].message).toBe('Entry 2');
      expect(entries[1].message).toBe('Entry 3');
      expect(entries[2].message).toBe('Entry 4');
    });

    it('persists entries to IndexedDB statuslog store', async () => {
      const store = createStore();
      store.dispatch(addStatusEntry({ level: 'info', message: 'Persisted' }));
      await flush();
      const stored = (await storage.statuslog.entries()).map(([, v]) => v) as Array<{ message: string }>;
      expect(stored).toHaveLength(1);
      expect(stored[0].message).toBe('Persisted');
    });
  });

  describe('maxEntries', () => {
    it('supports up to 2000 entries', () => {
      expect(initialStatusState.maxEntries).toBe(2000);
    });
  });

  describe('clearStatusLog', () => {
    it('clears all entries', () => {
      const store = createStore();
      store.dispatch(addStatusEntry({ level: 'info', message: 'Test' }));
      store.dispatch(addStatusEntry({ level: 'error', message: 'Error' }));
      expect(selectStatusEntries(store.getState())).toHaveLength(2);

      store.dispatch(clearStatusLog());
      expect(selectStatusEntries(store.getState())).toHaveLength(0);
    });

    it('clears IndexedDB statuslog store on clear', async () => {
      const store = createStore();
      store.dispatch(addStatusEntry({ level: 'info', message: 'Test' }));
      await flush();
      expect(await storage.statuslog.entries()).toHaveLength(1);

      store.dispatch(clearStatusLog());
      await flush();
      expect(await storage.statuslog.entries()).toHaveLength(0);
    });
  });

  describe('showOperationTip', () => {
    it('sets isVisible and message', () => {
      const store = createStore();
      store.dispatch(showOperationTip('Deleting messages'));
      const tip = selectOperationTip(store.getState());
      expect(tip.isVisible).toBe(true);
      expect(tip.message).toBe('Deleting messages');
    });

    it('overwrites previous tip message', () => {
      const store = createStore();
      store.dispatch(showOperationTip('First'));
      store.dispatch(showOperationTip('Second'));
      const tip = selectOperationTip(store.getState());
      expect(tip.isVisible).toBe(true);
      expect(tip.message).toBe('Second');
    });
  });

  describe('hideOperationTip', () => {
    it('sets isVisible to false', () => {
      const store = createStore();
      store.dispatch(showOperationTip('Test'));
      store.dispatch(hideOperationTip());
      const tip = selectOperationTip(store.getState());
      expect(tip.isVisible).toBe(false);
    });
  });

  describe('selectors', () => {
    it('selectStatusCount returns entry count', () => {
      const store = createStore();
      expect(selectStatusCount(store.getState())).toBe(0);
      store.dispatch(addStatusEntry({ level: 'info', message: 'Test' }));
      expect(selectStatusCount(store.getState())).toBe(1);
    });
  });
});
