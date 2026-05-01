import { describe, it, expect, beforeEach } from 'vitest';
import statusReducer, { addStatusEntry, clearStatusLog, loadStatusLog, showOperationTip, hideOperationTip, selectStatusEntries, selectStatusCount, selectOperationTip, _setCurrentSessionIdForTesting } from './statusSlice';
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

  describe('sessionId stamping (Backlog #126)', () => {
    it('stamps every new entry with the current session id', () => {
      _setCurrentSessionIdForTesting('test-session-A');
      const store = createStore();
      store.dispatch(addStatusEntry({ level: 'info', message: 'first' }));
      store.dispatch(addStatusEntry({ level: 'info', message: 'second' }));
      const entries = selectStatusEntries(store.getState());
      expect(entries.every((e) => e.sessionId === 'test-session-A')).toBe(true);
    });

    it('uses different session ids for entries dispatched in different sessions', () => {
      const store = createStore();
      _setCurrentSessionIdForTesting('session-1');
      store.dispatch(addStatusEntry({ level: 'info', message: 'session 1 entry' }));
      _setCurrentSessionIdForTesting('session-2');
      store.dispatch(addStatusEntry({ level: 'info', message: 'session 2 entry' }));
      const entries = selectStatusEntries(store.getState());
      expect(entries.find((e) => e.message === 'session 1 entry')?.sessionId).toBe('session-1');
      expect(entries.find((e) => e.message === 'session 2 entry')?.sessionId).toBe('session-2');
      // Reset so other tests don't see the stale id.
      _setCurrentSessionIdForTesting(null);
    });
  });

  describe('loadStatusLog (Backlog #126 boot-race fix)', () => {
    it('seeds an empty state from IDB', async () => {
      await storage.statuslog.setMany([
        ['1000-0', { id: '0', timestamp: 1000, level: 'info', message: 'persisted A' }],
        ['2000-1', { id: '1', timestamp: 2000, level: 'info', message: 'persisted B' }],
      ]);
      const store = createStore();
      await store.dispatch(loadStatusLog());
      const entries = selectStatusEntries(store.getState());
      expect(entries.map((e) => e.message)).toEqual(['persisted A', 'persisted B']);
    });

    it('merges persisted history with entries dispatched during boot (race fix)', async () => {
      // Pre-populate IDB with a prior session's entries.
      await storage.statuslog.setMany([
        ['1000-0', { id: '0', timestamp: 1000, level: 'info', message: 'prior session 1' }],
        ['2000-1', { id: '1', timestamp: 2000, level: 'info', message: 'prior session 2' }],
      ]);
      const store = createStore();

      // Simulate boot: dispatch synchronously BEFORE the load thunk resolves.
      store.dispatch(addStatusEntry({ level: 'session', message: 'New session established' }));
      store.dispatch(addStatusEntry({ level: 'info', message: 'Loading servers...' }));

      // Now resolve the load.
      await store.dispatch(loadStatusLog());

      const messages = selectStatusEntries(store.getState()).map((e) => e.message);
      expect(messages).toContain('prior session 1');
      expect(messages).toContain('prior session 2');
      expect(messages).toContain('New session established');
      expect(messages).toContain('Loading servers...');
      // Chronological order: prior entries (older timestamps) first.
      expect(messages.indexOf('prior session 1')).toBeLessThan(messages.indexOf('New session established'));
    });

    it('dedupes entries already in memory by timestamp+id key', async () => {
      const dup = { id: '0', timestamp: 1000, level: 'info' as const, message: 'dup' };
      await storage.statuslog.set('1000-0', dup);
      const store = createStore({ status: { ...initialStatusState, entries: [dup] } });

      await store.dispatch(loadStatusLog());

      const entries = selectStatusEntries(store.getState());
      expect(entries.filter((e) => e.message === 'dup')).toHaveLength(1);
    });

    it('respects maxEntries when merge would overflow', async () => {
      // 3 persisted + 2 in memory = 5 candidates, cap at 3 → keep latest 3.
      await storage.statuslog.setMany([
        ['1000-0', { id: '0', timestamp: 1000, level: 'info', message: 'old A' }],
        ['2000-1', { id: '1', timestamp: 2000, level: 'info', message: 'old B' }],
        ['3000-2', { id: '2', timestamp: 3000, level: 'info', message: 'old C' }],
      ]);
      const store = createStore({ status: { ...initialStatusState, maxEntries: 3 } });
      store.dispatch(addStatusEntry({ level: 'info', message: 'fresh A' }));
      store.dispatch(addStatusEntry({ level: 'info', message: 'fresh B' }));

      await store.dispatch(loadStatusLog());

      const messages = selectStatusEntries(store.getState()).map((e) => e.message);
      expect(messages).toHaveLength(3);
      // Two freshest in-memory entries (timestamp = Date.now()) win.
      expect(messages).toContain('fresh A');
      expect(messages).toContain('fresh B');
      expect(messages).toContain('old C');
      expect(messages).not.toContain('old A');
      expect(messages).not.toContain('old B');
    });
  });
});
