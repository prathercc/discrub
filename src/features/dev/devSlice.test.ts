import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import devReducer, {
  seedChannelMessages,
  selectIsSeeding,
  selectSeedError,
} from './devSlice';
import authReducer from '@features/auth/authSlice';
import userReducer from '@features/user/userSlice';
import appReducer from '@features/app/appSlice';
import statusReducer from '@features/status/statusSlice';

const mockPostMessage = vi.fn();
const mockAddReaction = vi.fn();
const mockEdit = vi.fn();
const mockPin = vi.fn();

vi.mock('@/services/seedService', () => ({
  postMessage: (...args: unknown[]) => mockPostMessage(...args),
  addSelfReaction: (...args: unknown[]) => mockAddReaction(...args),
  editMessageContent: (...args: unknown[]) => mockEdit(...args),
  pinMessage: (...args: unknown[]) => mockPin(...args),
}));

vi.mock('@/utils/operationLoopUtils', () => ({
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

vi.mock('@/utils/delayUtils', () => ({
  calculateRandomDelay: vi.fn().mockReturnValue({ delayMs: 0, delaySec: 0 }),
}));

function makeStore() {
  const store = configureStore({
    reducer: {
      dev: devReducer,
      auth: authReducer,
      user: userReducer,
      app: appReducer,
      status: statusReducer,
    },
  });
  store.dispatch({ type: 'auth/setToken', payload: 'tok' });
  store.dispatch({
    type: 'user/setCurrentUser',
    payload: { id: 'self-id', username: 'tester' },
  });
  return store;
}

beforeEach(() => {
  mockPostMessage.mockReset();
  mockAddReaction.mockReset();
  mockEdit.mockReset();
  mockPin.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

const ALL_OFF = {
  includeMentions: false,
  includeReactions: false,
  includeReplies: false,
  includeEdits: false,
  includePins: false,
};

describe('seedChannelMessages', () => {
  it('rejects when no token is set', async () => {
    const store = configureStore({
      reducer: { dev: devReducer, auth: authReducer, user: userReducer, app: appReducer, status: statusReducer },
    });
    const action = await store.dispatch(
      seedChannelMessages({
        channels: [{ id: 'c1', name: 'general' }],
        countPerChannel: 1,
        options: ALL_OFF,
      }),
    );
    expect(action.type).toBe('dev/seedChannelMessages/rejected');
  });

  it('rejects when no channels are selected', async () => {
    const store = makeStore();
    const action = await store.dispatch(
      seedChannelMessages({
        channels: [],
        countPerChannel: 5,
        options: ALL_OFF,
      }),
    );
    expect(action.type).toBe('dev/seedChannelMessages/rejected');
    expect(selectSeedError(store.getState() as any)).toBeTruthy();
  });

  it('posts the requested count to one channel', async () => {
    mockPostMessage.mockImplementation(async () => ({
      ok: true, status: 200, data: { id: `m${mockPostMessage.mock.calls.length}` },
    }));
    const store = makeStore();
    await store.dispatch(
      seedChannelMessages({
        channels: [{ id: 'c1', name: 'general' }],
        countPerChannel: 5,
        options: ALL_OFF,
      }),
    );
    expect(mockPostMessage).toHaveBeenCalledTimes(5);
  });

  it('caps countPerChannel at 100', async () => {
    mockPostMessage.mockImplementation(async () => ({ ok: true, status: 200, data: { id: 'x' } }));
    const store = makeStore();
    await store.dispatch(
      seedChannelMessages({
        channels: [{ id: 'c1', name: 'general' }],
        countPerChannel: 999,
        options: ALL_OFF,
      }),
    );
    expect(mockPostMessage).toHaveBeenCalledTimes(100);
  });

  it('iterates channels sequentially × countPerChannel', async () => {
    mockPostMessage.mockImplementation(async () => ({ ok: true, status: 200, data: { id: 'x' } }));
    const store = makeStore();
    await store.dispatch(
      seedChannelMessages({
        channels: [
          { id: 'c1', name: 'one' },
          { id: 'c2', name: 'two' },
          { id: 'c3', name: 'three' },
        ],
        countPerChannel: 4,
        options: ALL_OFF,
      }),
    );
    expect(mockPostMessage).toHaveBeenCalledTimes(12);
  });

  it('isSeeding flips true during run, false after', async () => {
    mockPostMessage.mockImplementation(async () => ({ ok: true, status: 200, data: { id: 'x' } }));
    const store = makeStore();
    const promise = store.dispatch(
      seedChannelMessages({
        channels: [{ id: 'c1', name: 'general' }],
        countPerChannel: 2,
        options: ALL_OFF,
      }),
    );
    expect(selectIsSeeding(store.getState() as any)).toBe(true);
    await promise;
    expect(selectIsSeeding(store.getState() as any)).toBe(false);
  });

  it('triggers reactions / edits / pins when their options are on', async () => {
    // Force the deterministic RNG to return values that hit every option.
    // 0.05 < 0.15 (mention), 0.05 < 0.30 (reaction), 0.05 < 0.20 (reply
    // — needs a prior post though), 0.05 < 0.15 (edit), 0.04 < 0.05 (pin).
    const rng = () => 0.04;
    mockPostMessage.mockImplementation(async () => ({ ok: true, status: 200, data: { id: 'x' } }));
    const store = makeStore();
    await store.dispatch(
      seedChannelMessages({
        channels: [{ id: 'c1', name: 'general' }],
        countPerChannel: 3,
        options: {
          includeMentions: true,
          includeReactions: true,
          includeReplies: true,
          includeEdits: true,
          includePins: true,
        },
        rng,
      }),
    );
    // With rng < threshold, every message gets reaction + edit + pin.
    expect(mockAddReaction).toHaveBeenCalled();
    expect(mockEdit).toHaveBeenCalled();
    expect(mockPin).toHaveBeenCalled();
  });

  it('counts errors when postMessage returns ok: false', async () => {
    mockPostMessage.mockImplementation(async () => ({ ok: false, status: 403, error: 'no perms' }));
    const store = makeStore();
    const action = await store.dispatch(
      seedChannelMessages({
        channels: [{ id: 'c1', name: 'general' }],
        countPerChannel: 3,
        options: ALL_OFF,
      }),
    );
    expect(action.type).toBe('dev/seedChannelMessages/fulfilled');
    expect((action.payload as any).errored).toBe(3);
    expect((action.payload as any).posted).toBe(0);
  });
});
