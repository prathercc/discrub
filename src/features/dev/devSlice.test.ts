import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  configureStore,
  type ThunkDispatch,
  type UnknownAction,
} from '@reduxjs/toolkit';
import devReducer, {
  seedChannelMessages,
  selectIsSeeding,
  selectSeedError,
} from './devSlice';
import authReducer from '@features/auth/authSlice';
import userReducer from '@features/user/userSlice';
import appReducer from '@features/app/appSlice';
import statusReducer from '@features/status/statusSlice';
import type { RootState } from '@/app/store';

const mockPostMessage = vi.fn();
const mockAddReaction = vi.fn();
const mockEdit = vi.fn();
const mockPin = vi.fn();

vi.mock('@/services/discordService', () => ({
  getDiscordService: () => ({
    postMessage: (...args: unknown[]) => mockPostMessage(...args),
    addReaction: (...args: unknown[]) => mockAddReaction(...args),
    editMessage: (...args: unknown[]) => mockEdit(...args),
    pinMessage: (...args: unknown[]) => mockPin(...args),
  }),
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
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  }) as unknown as {
    dispatch: ThunkDispatch<RootState, unknown, UnknownAction>;
    getState: () => RootState;
  };
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
  includeForwards: false,
  includeEdits: false,
  includePins: false,
};

describe('seedChannelMessages', () => {
  it('rejects when no token is set', async () => {
    const store = configureStore({
      reducer: { dev: devReducer, auth: authReducer, user: userReducer, app: appReducer, status: statusReducer },
      middleware: (getDefault) => getDefault({ serializableCheck: false }),
    }) as unknown as {
      dispatch: ThunkDispatch<RootState, unknown, UnknownAction>;
      getState: () => RootState;
    };
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
      success: true, status: 200, data: { id: `m${mockPostMessage.mock.calls.length}` },
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
    mockPostMessage.mockImplementation(async () => ({ success: true, status: 200, data: { id: 'x' } }));
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
    mockPostMessage.mockImplementation(async () => ({ success: true, status: 200, data: { id: 'x' } }));
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
    mockPostMessage.mockImplementation(async () => ({ success: true, status: 200, data: { id: 'x' } }));
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
    mockPostMessage.mockImplementation(async () => ({ success: true, status: 200, data: { id: 'x' } }));
    const store = makeStore();
    await store.dispatch(
      seedChannelMessages({
        channels: [{ id: 'c1', name: 'general' }],
        countPerChannel: 3,
        options: {
          includeMentions: true,
          includeReactions: true,
          includeReplies: true,
          // Forwards off here so the reaction/edit/pin assertions aren't
          // diverted onto forward messages (which skip edits) — forward
          // behavior is covered by its own tests below.
          includeForwards: false,
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

  it('posts a forward (message_reference.type 1, no content) for later messages when includeForwards is on', async () => {
    // rng = 0.04 < 0.15 forward threshold, so every message after the
    // first (which has no prior post to forward) becomes a forward.
    const rng = () => 0.04;
    mockPostMessage.mockImplementation(async () => ({
      success: true, status: 200, data: { id: `m${mockPostMessage.mock.calls.length}` },
    }));
    const store = makeStore();
    await store.dispatch(
      seedChannelMessages({
        channels: [{ id: 'c1', name: 'general' }],
        countPerChannel: 3,
        options: { ...ALL_OFF, includeForwards: true },
        rng,
      }),
    );

    // postMessage args are (token, channelId, body).
    const bodies = mockPostMessage.mock.calls.map((c) => c[2]);
    // Message 1: no prior post → plain message (has content, no reference).
    expect(bodies[0].message_reference).toBeUndefined();
    // Messages 2 & 3: forwards → type 1, a source message_id, no content.
    expect(bodies[1].message_reference).toMatchObject({
      type: 1,
      channel_id: 'c1',
    });
    expect(bodies[1].message_reference.message_id).toBe('m1');
    expect(bodies[1].content).toBeUndefined();
  });

  it('does not forward when includeForwards is off (plain messages only)', async () => {
    const rng = () => 0.04;
    mockPostMessage.mockImplementation(async () => ({
      success: true, status: 200, data: { id: `m${mockPostMessage.mock.calls.length}` },
    }));
    const store = makeStore();
    await store.dispatch(
      seedChannelMessages({
        channels: [{ id: 'c1', name: 'general' }],
        countPerChannel: 3,
        options: ALL_OFF,
        rng,
      }),
    );
    const bodies = mockPostMessage.mock.calls.map((c) => c[2]);
    expect(bodies.every((b) => b.message_reference === undefined)).toBe(true);
  });

  it('forward takes precedence over reply (mutually exclusive reference)', async () => {
    // rng = 0.04 satisfies both forward (<0.15) and reply (<0.2); forward
    // is checked first, so the reference must be a forward, not a reply.
    const rng = () => 0.04;
    mockPostMessage.mockImplementation(async () => ({
      success: true, status: 200, data: { id: `m${mockPostMessage.mock.calls.length}` },
    }));
    const store = makeStore();
    await store.dispatch(
      seedChannelMessages({
        channels: [{ id: 'c1', name: 'general' }],
        countPerChannel: 2,
        options: { ...ALL_OFF, includeForwards: true, includeReplies: true },
        rng,
      }),
    );
    const secondBody = mockPostMessage.mock.calls[1][2];
    expect(secondBody.message_reference.type).toBe(1);
  });

  it('counts errors when postMessage returns ok: false', async () => {
    mockPostMessage.mockImplementation(async () => ({ success: false, status: 403, error: 'no perms' }));
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
