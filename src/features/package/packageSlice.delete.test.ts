import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  configureStore,
  type ThunkDispatch,
  type UnknownAction,
} from '@reduxjs/toolkit';
import packageReducer, {
  deletePackageMessages,
  importPackage,
  initialPackageState,
  loadPackageChannelMessages,
  resumeStoredPackage,
  selectAllChannelMessages,
  selectChannelDeletedMessageCount,
  selectPackageDeletedMessageCount,
  clearChannelMessageSelection,
  toggleMessageSelection,
  __testHelpers__,
} from './packageSlice';
import authReducer from '@features/auth/authSlice';
import userReducer from '@features/user/userSlice';
import appReducer from '@features/app/appSlice';
import statusReducer from '@features/status/statusSlice';
import { buildFixturePackage } from '@/test/package-fixtures';
import { storage } from '@/extension/storage';
import type { RootState } from '@/app/store';

const mockDeleteMessage = vi.fn();

vi.mock('@services/discordService', () => ({
  getDiscordService: vi.fn(() => ({
    deleteMessage: mockDeleteMessage,
  })),
}));

vi.mock('@utils/operationLoopUtils', () => ({
  waitWhilePaused: vi.fn().mockResolvedValue(undefined),
  checkCancelled: vi.fn().mockReturnValue(false),
  cancellableDelay: vi.fn().mockResolvedValue(false),
  CancelledError: class CancelledError extends Error {
    constructor() {
      super('Cancelled');
      this.name = 'CancelledError';
    }
  },
}));

vi.mock('@utils/delayUtils', () => ({
  calculateRandomDelay: vi.fn().mockReturnValue({ delayMs: 0, delaySec: 0 }),
}));

function makeStore(currentUserId = '253286221395001345', token: string | null = 'tok') {
  const store = configureStore({
    reducer: {
      package: packageReducer,
      auth: authReducer,
      user: userReducer,
      app: appReducer,
      status: statusReducer,
    },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  }) as unknown as {
    dispatch: ThunkDispatch<RootState, unknown, UnknownAction>;
    getState: () => RootState;
  };
  if (token) {
    store.dispatch({ type: 'auth/setToken', payload: token });
  }
  if (currentUserId) {
    store.dispatch({
      type: 'user/setCurrentUser',
      payload: { id: currentUserId, username: 'tester' },
    });
  }
  return store;
}

describe('packageSlice — selection reducers', () => {
  it('toggleMessageSelection adds and removes message IDs', () => {
    const store = makeStore();
    store.dispatch(toggleMessageSelection({ channelId: 'c1', messageId: 'm1' }));
    store.dispatch(toggleMessageSelection({ channelId: 'c1', messageId: 'm2' }));
    expect(store.getState().package.selectedMessageIds.c1).toEqual(['m1', 'm2']);

    store.dispatch(toggleMessageSelection({ channelId: 'c1', messageId: 'm1' }));
    expect(store.getState().package.selectedMessageIds.c1).toEqual(['m2']);
  });

  it('selectAllChannelMessages replaces the selection atomically', () => {
    const store = makeStore();
    store.dispatch(toggleMessageSelection({ channelId: 'c1', messageId: 'm1' }));
    store.dispatch(selectAllChannelMessages({ channelId: 'c1', messageIds: ['a', 'b', 'c'] }));
    expect(store.getState().package.selectedMessageIds.c1).toEqual(['a', 'b', 'c']);
  });

  it('clearChannelMessageSelection removes the channel entry entirely', () => {
    const store = makeStore();
    store.dispatch(selectAllChannelMessages({ channelId: 'c1', messageIds: ['a'] }));
    store.dispatch(clearChannelMessageSelection('c1'));
    expect(store.getState().package.selectedMessageIds.c1).toBeUndefined();
  });

  it('last toggle that empties a channel removes it from state', () => {
    const store = makeStore();
    store.dispatch(toggleMessageSelection({ channelId: 'c1', messageId: 'm1' }));
    store.dispatch(toggleMessageSelection({ channelId: 'c1', messageId: 'm1' }));
    expect(store.getState().package.selectedMessageIds.c1).toBeUndefined();
  });
});

describe('packageSlice — deletePackageMessages', () => {
  beforeEach(async () => {
    mockDeleteMessage.mockReset();
    __testHelpers__.storeSourceFile(null);
    // `importPackage` re-hydrates the persisted deleted-message cache
    // via IDB. Without clearing here, state from a prior test leaks
    // in and the new pre-filter (gone messages can't be re-deleted)
    // rejects the run.
    await storage.package.clear();
  });

  async function primedStore() {
    const store = makeStore();
    const blob = await buildFixturePackage();
    await store.dispatch(importPackage(blob));
    await store.dispatch(loadPackageChannelMessages('200'));
    store.dispatch(
      selectAllChannelMessages({
        channelId: '200',
        messageIds: ['1', '2', '3'],
      }),
    );
    return store;
  }

  // discrub-core's `deleteMessage` does not throw on HTTP errors; its
  // `withRetry` wrapper catches and returns `{ success, status }`. The
  // tests below stub that contract directly. Pre-#161 stubs threw on
  // 404/403 (and the slice categorized via a catch block), but that
  // never reflected production — every error fell through to the
  // try-block's `result.deleted += 1` and the polished banner exposed
  // the false positive. The slice and these stubs now match reality.
  it('counts successful deletes', async () => {
    mockDeleteMessage.mockResolvedValue({ success: true, status: 204 });
    const store = await primedStore();

    const action = await store.dispatch(deletePackageMessages({ channelId: '200' }));
    expect(action.type).toBe('package/deleteMessages/fulfilled');

    const state = store.getState().package;
    expect(state.deleteStatus).toBe('ready');
    expect(state.deleteResult?.deleted).toBe(3);
    expect(state.deleteResult?.failed).toBe(0);
    expect(state.selectedMessageIds['200']).toBeUndefined();
  });

  it('tolerates 404 as alreadyGone', async () => {
    mockDeleteMessage.mockImplementation(async (_t, id) => {
      if (id === '2') return { success: false, status: 404 };
      return { success: true, status: 204 };
    });
    const store = await primedStore();

    await store.dispatch(deletePackageMessages({ channelId: '200' }));

    const result = store.getState().package.deleteResult;
    expect(result?.deleted).toBe(2);
    expect(result?.alreadyGone).toBe(1);
    expect(result?.failed).toBe(0);
  });

  it('categorizes 403 as forbidden', async () => {
    mockDeleteMessage.mockResolvedValue({ success: false, status: 403 });
    const store = await primedStore();

    await store.dispatch(deletePackageMessages({ channelId: '200' }));

    const result = store.getState().package.deleteResult;
    expect(result?.forbidden).toBe(3);
    expect(result?.deleted).toBe(0);
  });

  it('falls through to "failed" for unexpected HTTP statuses (e.g. 500)', async () => {
    mockDeleteMessage.mockResolvedValue({ success: false, status: 500 });
    const store = await primedStore();

    await store.dispatch(deletePackageMessages({ channelId: '200' }));

    const result = store.getState().package.deleteResult;
    expect(result?.failed).toBe(3);
    expect(result?.deleted).toBe(0);
  });

  it('still routes a thrown exception through the catch fallback', async () => {
    // Defensive: if the lib's contract ever changes back to throwing,
    // we still categorize correctly rather than miscount as deleted.
    mockDeleteMessage.mockImplementation(async () => {
      throw { status: 404, message: 'Not Found' };
    });
    const store = await primedStore();

    await store.dispatch(deletePackageMessages({ channelId: '200' }));

    const result = store.getState().package.deleteResult;
    expect(result?.alreadyGone).toBe(3);
    expect(result?.deleted).toBe(0);
  });

  it('rejects when package is read-only', async () => {
    const store = makeStore('different-user');
    const blob = await buildFixturePackage();
    await store.dispatch(importPackage(blob));
    await store.dispatch(loadPackageChannelMessages('200'));
    store.dispatch(selectAllChannelMessages({ channelId: '200', messageIds: ['1'] }));

    const action = await store.dispatch(deletePackageMessages({ channelId: '200' }));
    expect(action.type).toBe('package/deleteMessages/rejected');
    expect(mockDeleteMessage).not.toHaveBeenCalled();
  });

  it('rejects when channel is orphan', async () => {
    const store = makeStore();
    const blob = await buildFixturePackage({ includeOrphanChannel: true });
    await store.dispatch(importPackage(blob));
    store.dispatch(selectAllChannelMessages({ channelId: '400', messageIds: ['20'] }));

    const action = await store.dispatch(deletePackageMessages({ channelId: '400' }));
    expect(action.type).toBe('package/deleteMessages/rejected');
    expect(mockDeleteMessage).not.toHaveBeenCalled();
  });

  it('rejects when no auth token', async () => {
    const store = makeStore('253286221395001345', null);
    const blob = await buildFixturePackage();
    await store.dispatch(importPackage(blob));
    store.dispatch(selectAllChannelMessages({ channelId: '200', messageIds: ['1'] }));

    const action = await store.dispatch(deletePackageMessages({ channelId: '200' }));
    expect(action.type).toBe('package/deleteMessages/rejected');
  });

  it('skips messages already in the deleted-message cache', async () => {
    mockDeleteMessage.mockResolvedValue({ success: true, status: 204 });
    const { hydratePackageDeletedCache } = await import('./packageSlice');
    const store = await primedStore();
    store.dispatch({
      type: hydratePackageDeletedCache.fulfilled.type,
      payload: { '200': ['2'] },
      meta: { requestStatus: 'fulfilled' },
    });

    const action = await store.dispatch(deletePackageMessages({ channelId: '200' }));
    expect(action.type).toBe('package/deleteMessages/fulfilled');
    expect(mockDeleteMessage).toHaveBeenCalledTimes(2);
    const calledIds = mockDeleteMessage.mock.calls.map((c) => c[1]);
    expect(calledIds).toEqual(['1', '3']);
  });

  it('rejects when every selected message is already gone', async () => {
    const { hydratePackageDeletedCache } = await import('./packageSlice');
    const store = await primedStore();
    store.dispatch({
      type: hydratePackageDeletedCache.fulfilled.type,
      payload: { '200': ['1', '2', '3'] },
      meta: { requestStatus: 'fulfilled' },
    });

    const action = await store.dispatch(deletePackageMessages({ channelId: '200' }));
    expect(action.type).toBe('package/deleteMessages/rejected');
    expect(mockDeleteMessage).not.toHaveBeenCalled();
  });

  it('keeps confirmed-gone messages visible in loadedChannels after delete', async () => {
    mockDeleteMessage.mockResolvedValue({ success: true, status: 204 });
    const store = await primedStore();

    const before = store.getState().package.loadedChannels['200'];
    expect(before?.length).toBe(3);

    await store.dispatch(deletePackageMessages({ channelId: '200' }));

    // Previously these rows were stripped from loadedChannels to hide
    // them; now they remain so the table can render them with the
    // "gone" visual treatment.
    const after = store.getState().package.loadedChannels['200'];
    expect(after?.length).toBe(3);
    expect(store.getState().package.deletedMessageIds['200']).toEqual([
      '1',
      '2',
      '3',
    ]);
  });
});

/* ────────── #236: live remaining counts + hydrate ordering ────────── */

const FIXTURE_USER_ID = '253286221395001345';

function stateWith(overrides: Partial<typeof initialPackageState>): RootState {
  return {
    package: { ...initialPackageState, ...overrides },
  } as unknown as RootState;
}

const minimalParsed = {
  user: {
    id: FIXTURE_USER_ID,
    username: 'tester',
    globalName: null,
    avatarHash: null,
  },
  guilds: [],
  channels: [
    {
      id: '200',
      type: 0,
      name: 'general',
      guildId: 'g1',
      guildName: 'Guild A',
      messageCount: 3,
      isOrphan: false,
    },
  ],
  totalMessages: 3,
  packageSizeBytes: 1,
} as never;

describe('packageSlice — #236 deleted-count selectors', () => {
  it('selectChannelDeletedMessageCount returns per-channel counts (0 when absent)', () => {
    const state = stateWith({ deletedMessageIds: { '200': ['1', '2'] } });
    expect(selectChannelDeletedMessageCount('200')(state)).toBe(2);
    expect(selectChannelDeletedMessageCount('999')(state)).toBe(0);
  });

  it('selectPackageDeletedMessageCount only counts ids for channels in the parsed package', () => {
    // 'stale-channel' simulates a leftover cache entry from an older
    // export of the same account — it must not skew this package's total.
    const state = stateWith({
      parsed: minimalParsed,
      deletedMessageIds: {
        '200': ['1', '2'],
        'stale-channel': ['9', '10', '11'],
      },
    });
    expect(selectPackageDeletedMessageCount(state)).toBe(2);
  });

  it('selectPackageDeletedMessageCount is 0 without a parsed package', () => {
    const state = stateWith({
      parsed: null,
      deletedMessageIds: { '200': ['1'] },
    });
    expect(selectPackageDeletedMessageCount(state)).toBe(0);
  });
});

describe('packageSlice — #236 deleted-cache hydrate ordering', () => {
  beforeEach(async () => {
    __testHelpers__.storeSourceFile(null);
    await storage.package.clear();
  });

  it('importPackage applies the persisted deleted cache atomically with the parsed payload', async () => {
    await storage.package.set(`deleted:${FIXTURE_USER_ID}`, {
      '200': ['1', '2'],
    });
    const store = makeStore();
    await store.dispatch(importPackage(await buildFixturePackage()));

    // Asserted immediately after the thunk settles — no extra microtask
    // flush. Pre-#236 a fire-and-forget hydrate raced the fulfilled
    // reducer's `deletedMessageIds = {}` reset and only won by accident
    // of IDB latency.
    expect(store.getState().package.deletedMessageIds['200']).toEqual([
      '1',
      '2',
    ]);
  });

  it('deleted ids survive resumeStoredPackage without a separate hydrate dispatch', async () => {
    // Stream a package into IDB, then simulate a purge having persisted
    // deleted ids before the next session resumes.
    const seedStore = makeStore();
    await seedStore.dispatch(importPackage(await buildFixturePackage()));
    await storage.package.set(`deleted:${FIXTURE_USER_ID}`, { '200': ['1'] });

    const store = makeStore();
    await store.dispatch(resumeStoredPackage());

    expect(store.getState().package.parsed).not.toBeNull();
    expect(store.getState().package.deletedMessageIds['200']).toEqual(['1']);
  });
});
