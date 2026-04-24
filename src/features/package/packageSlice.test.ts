import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore, type ThunkDispatch, type UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import packageReducer, {
  importPackage,
  loadPackageChannelMessages,
  loadAllPackageTimestamps,
  selectPackageChannel,
  clearPackage,
  __testHelpers__,
} from './packageSlice';
import userReducer from '@features/user/userSlice';
import { buildFixturePackage } from '@/test/package-fixtures';

function makeStore(currentUserId: string | null = null) {
  const store = configureStore({
    reducer: {
      package: packageReducer,
      user: userReducer,
    },
    middleware: (getDefault) =>
      getDefault({
        serializableCheck: false,
      }),
  }) as unknown as {
    dispatch: ThunkDispatch<RootState, unknown, UnknownAction>;
    getState: () => RootState;
  };
  if (currentUserId) {
    store.dispatch({
      type: 'user/setCurrentUser',
      payload: { id: currentUserId, username: 'tester' },
    });
  }
  return store;
}

describe('packageSlice — importPackage', () => {
  beforeEach(() => {
    __testHelpers__.storeSourceFile(null);
  });

  it('parses and stores a valid package', async () => {
    const store = makeStore('253286221395001345');
    const blob = await buildFixturePackage();
    const action = await store.dispatch(importPackage(blob));

    expect(action.type).toBe('package/import/fulfilled');
    const state = store.getState().package;
    expect(state.status).toBe('ready');
    expect(state.parsed?.user.id).toBe('253286221395001345');
    expect(state.validation?.readOnly).toBe(false);
  });

  it('returns read-only validation when user IDs mismatch', async () => {
    const store = makeStore('different-user');
    const blob = await buildFixturePackage();
    await store.dispatch(importPackage(blob));

    const state = store.getState().package;
    expect(state.status).toBe('ready');
    expect(state.validation?.readOnly).toBe(true);
    expect(state.validation?.warnings[0]).toMatch(/different user/i);
  });

  it('returns read-only with warning when no auth', async () => {
    const store = makeStore(null);
    const blob = await buildFixturePackage();
    await store.dispatch(importPackage(blob));

    const state = store.getState().package;
    expect(state.validation?.readOnly).toBe(true);
  });

  it('rejects when user.json is missing', async () => {
    const store = makeStore('abc');
    const blob = await buildFixturePackage({ omitUserJson: true });
    await store.dispatch(importPackage(blob));

    const state = store.getState().package;
    expect(state.status).toBe('error');
    expect(state.error).toBeTruthy();
  });
});

describe('packageSlice — loadPackageChannelMessages (LRU)', () => {
  beforeEach(() => {
    __testHelpers__.storeSourceFile(null);
  });

  it('loads messages lazily and caches them', async () => {
    const store = makeStore('253286221395001345');
    const blob = await buildFixturePackage();
    await store.dispatch(importPackage(blob));

    await store.dispatch(loadPackageChannelMessages('200'));

    const state = store.getState().package;
    expect(state.loadedChannels['200']).toHaveLength(3);
    expect(state.loadedOrder).toEqual(['200']);
  });

  it('returns cached messages without re-reading', async () => {
    const store = makeStore('253286221395001345');
    const blob = await buildFixturePackage();
    await store.dispatch(importPackage(blob));

    await store.dispatch(loadPackageChannelMessages('200'));
    __testHelpers__.storeSourceFile(null); // Simulate losing source
    const second = await store.dispatch(loadPackageChannelMessages('200'));

    expect(second.type).toBe('package/loadChannel/fulfilled');
  });

  it('rejects when source file is unavailable for uncached channel', async () => {
    const store = makeStore('253286221395001345');
    const blob = await buildFixturePackage();
    await store.dispatch(importPackage(blob));

    __testHelpers__.storeSourceFile(null);
    const result = await store.dispatch(loadPackageChannelMessages('999'));
    expect(result.type).toBe('package/loadChannel/rejected');
  });
});

describe('packageSlice — loadAllPackageTimestamps', () => {
  beforeEach(() => {
    __testHelpers__.storeSourceFile(null);
  });

  it('collects timestamps from all channels', async () => {
    const store = makeStore('253286221395001345');
    const blob = await buildFixturePackage({ includeOrphanChannel: true });
    await store.dispatch(importPackage(blob));

    const result = await store.dispatch(loadAllPackageTimestamps());
    expect(result.type).toBe('package/loadAllTimestamps/fulfilled');

    const state = store.getState().package;
    expect(state.timelineStatus).toBe('ready');
    // 3 in channel 200 + 1 in channel 300 + 1 in orphan 400 = 5
    expect(state.timelineTimestamps).toHaveLength(5);
    expect(state.timelineProgress).toBeNull();
  });

  it('rejects when no package is loaded', async () => {
    const store = makeStore('abc');
    const result = await store.dispatch(loadAllPackageTimestamps());
    expect(result.type).toBe('package/loadAllTimestamps/rejected');
  });

  it('tolerates missing source file by emptying timestamps', async () => {
    const store = makeStore('253286221395001345');
    const blob = await buildFixturePackage();
    await store.dispatch(importPackage(blob));
    __testHelpers__.storeSourceFile(null);

    const result = await store.dispatch(loadAllPackageTimestamps());
    expect(result.type).toBe('package/loadAllTimestamps/rejected');
  });
});

describe('packageSlice — reducers', () => {
  it('selectPackageChannel sets the selected channel ID', async () => {
    const store = makeStore('253286221395001345');
    store.dispatch(selectPackageChannel('200'));
    expect(store.getState().package.selectedChannelId).toBe('200');
  });

  it('clearPackage resets state', async () => {
    const store = makeStore('253286221395001345');
    const blob = await buildFixturePackage();
    await store.dispatch(importPackage(blob));

    store.dispatch(clearPackage());
    const state = store.getState().package;
    expect(state.parsed).toBeNull();
    expect(state.status).toBe('idle');
  });

  it('Fix I: resetPackage purges the IDB enrichment cache for the user', async () => {
    const { resetPackage } = await import('./packageSlice');
    const { enrichmentCache } = await import('./enrichmentCache');
    const { storage } = await import('@/extension/storage');
    await storage.package.clear();

    const USER = '253286221395001345';
    const store = makeStore(USER);
    const blob = await buildFixturePackage();
    await store.dispatch(importPackage(blob));

    // Seed two channels' worth of enrichment for this user.
    await enrichmentCache.put(USER, '200', {
      lastFetched: 1,
      messages: {},
      misses: { deleted: [], forbidden: [] },
    });
    await enrichmentCache.put(USER, '300', {
      lastFetched: 2,
      messages: {},
      misses: { deleted: [], forbidden: [] },
    });
    expect(await enrichmentCache.get(USER, '200')).not.toBeNull();

    await store.dispatch(resetPackage());

    // In-memory state reset as usual.
    expect(store.getState().package.parsed).toBeNull();
    // AND the persisted cache was cleared.
    expect(await enrichmentCache.get(USER, '200')).toBeNull();
    expect(await enrichmentCache.get(USER, '300')).toBeNull();
  });
});
