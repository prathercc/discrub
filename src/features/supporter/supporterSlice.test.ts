import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import supporterReducer, {
  initializeSupporter,
  claimSupporterKey,
  refreshSupporterKey,
  applyPastedSupporterKey,
  removeSupporterKey,
  markGiftAttentionSeen,
  setSupporterDialogOpen,
  selectIsSupporter,
  selectSupporterKeyStatus,
} from './supporterSlice';
import {
  SUPPORTER_KEY_STORAGE_KEY,
  SUPPORTER_EMAIL_STORAGE_KEY,
  GIFT_ATTENTION_SEEN_STORAGE_KEY,
} from './supporterTypes';
import type { SupporterKeyPayload } from '@services/supporterKeyService';

// In-memory stand-in for the Discrub-state store (same shape the
// appSlice tests use).
const { stateStore, stateData } = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  return {
    stateData: data,
    stateStore: {
      get: vi.fn(async (key: string) => data[key] ?? null),
      set: vi.fn(async (key: string, value: unknown) => {
        data[key] = value;
      }),
      remove: vi.fn(async (key: string) => {
        delete data[key];
      }),
    },
  };
});

vi.mock('@/extension/storage', () => ({
  storage: { state: stateStore },
}));

const { mockFetchRevoked } = vi.hoisted(() => ({
  mockFetchRevoked: vi.fn(async () => [] as string[]),
}));
vi.mock('discrub-core/github-service', () => ({
  fetchRevokedSupporterKeys: mockFetchRevoked,
}));

const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }));
vi.mock('@services/supporterKeyService', () => ({
  verifySupporterKey: mockVerify,
}));

const { mockRequestKey, MockClaimError } = vi.hoisted(() => {
  class MockClaimError extends Error {
    status: number | null;
    constructor(message: string, status: number | null) {
      super(message);
      this.name = 'SupporterClaimError';
      this.status = status;
    }
  }
  return { mockRequestKey: vi.fn(), MockClaimError };
});
vi.mock('@services/supporterClaimService', () => ({
  requestSupporterKey: mockRequestKey,
  SupporterClaimError: MockClaimError,
}));

const DAY_S = 24 * 60 * 60;
const nowS = () => Math.floor(Date.now() / 1000);

function makePayload(overrides: Partial<SupporterKeyPayload> = {}): SupporterKeyPayload {
  return {
    v: 1,
    kid: '2026-2',
    jti: 'jti-1',
    name: 'Aaron P.',
    eh: 'hash',
    tier: 'monthly',
    iat: nowS() - DAY_S,
    exp: nowS() + 30 * DAY_S,
    ...overrides,
  };
}

const makeStore = () => configureStore({ reducer: { supporter: supporterReducer } });
type Store = ReturnType<typeof makeStore>;
const rootState = (store: Store) => store.getState() as never;

describe('supporterSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(stateData)) delete stateData[key];
    mockFetchRevoked.mockResolvedValue([]);
  });

  describe('initializeSupporter', () => {
    it('resolves to none with no stored key and never fetches revocations', async () => {
      const store = makeStore();
      await store.dispatch(initializeSupporter());

      const state = store.getState().supporter;
      expect(state.initialized).toBe(true);
      expect(state.keyStatus).toBe('none');
      expect(state.giftAttentionSeen).toBe(false);
      expect(mockFetchRevoked).not.toHaveBeenCalled();
    });

    it('verifies a stored key against the fetched revocation list', async () => {
      stateData[SUPPORTER_KEY_STORAGE_KEY] = 'DSCRB-key';
      stateData[GIFT_ATTENTION_SEEN_STORAGE_KEY] = true;
      mockFetchRevoked.mockResolvedValue(['bad-jti']);
      mockVerify.mockResolvedValue({ status: 'valid', payload: makePayload() });

      const store = makeStore();
      await store.dispatch(initializeSupporter());

      expect(mockVerify).toHaveBeenCalledWith('DSCRB-key', { revokedJtis: ['bad-jti'] });
      const state = store.getState().supporter;
      expect(state.keyStatus).toBe('valid');
      expect(state.payload?.name).toBe('Aaron P.');
      expect(state.giftAttentionSeen).toBe(true);
      expect(selectIsSupporter(rootState(store))).toBe(true);
    });

    it('auto-refreshes a monthly key near expiry when an email is stored', async () => {
      stateData[SUPPORTER_KEY_STORAGE_KEY] = 'DSCRB-old';
      stateData[SUPPORTER_EMAIL_STORAGE_KEY] = 'user@example.com';
      const nearExpiry = makePayload({ exp: nowS() + 2 * DAY_S });
      const refreshed = makePayload({ jti: 'jti-2', exp: nowS() + 37 * DAY_S });
      mockVerify
        .mockResolvedValueOnce({ status: 'valid', payload: nearExpiry })
        .mockResolvedValueOnce({ status: 'valid', payload: refreshed });
      mockRequestKey.mockResolvedValue({
        key: 'DSCRB-new',
        tier: 'monthly',
        name: 'Aaron P.',
        expiresAt: 'whenever',
      });

      const store = makeStore();
      await store.dispatch(initializeSupporter());

      expect(mockRequestKey).toHaveBeenCalledWith('user@example.com');
      expect(stateData[SUPPORTER_KEY_STORAGE_KEY]).toBe('DSCRB-new');
      expect(store.getState().supporter.payload?.jti).toBe('jti-2');
    });

    it('also attempts refresh for an already-expired monthly key (renewal case)', async () => {
      stateData[SUPPORTER_KEY_STORAGE_KEY] = 'DSCRB-old';
      stateData[SUPPORTER_EMAIL_STORAGE_KEY] = 'user@example.com';
      mockVerify
        .mockResolvedValueOnce({
          status: 'expired',
          payload: makePayload({ exp: nowS() - 10 * DAY_S }),
        })
        .mockResolvedValueOnce({ status: 'valid', payload: makePayload({ jti: 'jti-3' }) });
      mockRequestKey.mockResolvedValue({
        key: 'DSCRB-new',
        tier: 'monthly',
        name: 'Aaron P.',
        expiresAt: 'whenever',
      });

      const store = makeStore();
      await store.dispatch(initializeSupporter());

      expect(store.getState().supporter.keyStatus).toBe('valid');
    });

    it('fails open onto the old verification when the refresh call fails', async () => {
      stateData[SUPPORTER_KEY_STORAGE_KEY] = 'DSCRB-old';
      stateData[SUPPORTER_EMAIL_STORAGE_KEY] = 'user@example.com';
      mockVerify.mockResolvedValue({
        status: 'valid',
        payload: makePayload({ exp: nowS() + 2 * DAY_S }),
      });
      mockRequestKey.mockRejectedValue(new MockClaimError('offline', null));

      const store = makeStore();
      await store.dispatch(initializeSupporter());

      expect(store.getState().supporter.keyStatus).toBe('valid');
      expect(stateData[SUPPORTER_KEY_STORAGE_KEY]).toBe('DSCRB-old');
    });

    it('does not refresh far from expiry, without an email, for lifetime, or when revoked', async () => {
      const cases: Array<{
        payload: SupporterKeyPayload;
        status: 'valid' | 'revoked';
        email?: string;
      }> = [
        { payload: makePayload({ exp: nowS() + 30 * DAY_S }), status: 'valid', email: 'a@b.c' },
        { payload: makePayload({ exp: nowS() + 2 * DAY_S }), status: 'valid' },
        { payload: makePayload({ tier: 'lifetime', exp: null }), status: 'valid', email: 'a@b.c' },
        { payload: makePayload({ exp: nowS() + 2 * DAY_S }), status: 'revoked', email: 'a@b.c' },
      ];
      for (const c of cases) {
        for (const key of Object.keys(stateData)) delete stateData[key];
        mockRequestKey.mockClear();
        stateData[SUPPORTER_KEY_STORAGE_KEY] = 'DSCRB-old';
        if (c.email) stateData[SUPPORTER_EMAIL_STORAGE_KEY] = c.email;
        mockVerify.mockResolvedValue({ status: c.status, payload: c.payload });

        await makeStore().dispatch(initializeSupporter());
        expect(mockRequestKey).not.toHaveBeenCalled();
      }
    });
  });

  describe('claimSupporterKey', () => {
    it('stores the key and email on a verified claim', async () => {
      mockRequestKey.mockResolvedValue({
        key: 'DSCRB-claimed',
        tier: 'monthly',
        name: 'Aaron P.',
        expiresAt: 'whenever',
      });
      mockVerify.mockResolvedValue({ status: 'valid', payload: makePayload() });

      const store = makeStore();
      await store.dispatch(
        claimSupporterKey({ email: 'user@example.com', displayName: 'Aaron P.' }),
      );

      expect(mockRequestKey).toHaveBeenCalledWith('user@example.com', 'Aaron P.');
      expect(stateData[SUPPORTER_KEY_STORAGE_KEY]).toBe('DSCRB-claimed');
      expect(stateData[SUPPORTER_EMAIL_STORAGE_KEY]).toBe('user@example.com');
      const state = store.getState().supporter;
      expect(state.keyStatus).toBe('valid');
      expect(state.hasStoredEmail).toBe(true);
      expect(state.claimInProgress).toBe(false);
    });

    it('surfaces the server error message and stores nothing', async () => {
      mockRequestKey.mockRejectedValue(
        new MockClaimError('No active supporter membership was found for that email', 404),
      );

      const store = makeStore();
      await store.dispatch(claimSupporterKey({ email: 'user@example.com' }));

      const state = store.getState().supporter;
      expect(state.claimError).toBe(
        'No active supporter membership was found for that email',
      );
      expect(state.keyStatus).toBe('none');
      expect(stateData[SUPPORTER_KEY_STORAGE_KEY]).toBeUndefined();
    });

    it('rejects a server key the local verifier cannot validate', async () => {
      mockRequestKey.mockResolvedValue({
        key: 'DSCRB-weird',
        tier: 'monthly',
        name: 'Aaron P.',
        expiresAt: null,
      });
      mockVerify.mockResolvedValue({ status: 'invalid' });

      const store = makeStore();
      await store.dispatch(claimSupporterKey({ email: 'user@example.com' }));

      expect(store.getState().supporter.claimError).toContain('could not verify');
      expect(stateData[SUPPORTER_KEY_STORAGE_KEY]).toBeUndefined();
    });
  });

  describe('refreshSupporterKey', () => {
    it('re-claims with the stored email', async () => {
      stateData[SUPPORTER_EMAIL_STORAGE_KEY] = 'user@example.com';
      mockRequestKey.mockResolvedValue({
        key: 'DSCRB-fresh',
        tier: 'monthly',
        name: 'Aaron P.',
        expiresAt: 'whenever',
      });
      mockVerify.mockResolvedValue({ status: 'valid', payload: makePayload({ jti: 'jti-9' }) });

      const store = makeStore();
      await store.dispatch(refreshSupporterKey());

      expect(mockRequestKey).toHaveBeenCalledWith('user@example.com');
      expect(stateData[SUPPORTER_KEY_STORAGE_KEY]).toBe('DSCRB-fresh');
      expect(store.getState().supporter.payload?.jti).toBe('jti-9');
    });

    it('errors cleanly when no email is stored', async () => {
      const store = makeStore();
      await store.dispatch(refreshSupporterKey());

      expect(store.getState().supporter.claimError).toContain('No saved email');
      expect(mockRequestKey).not.toHaveBeenCalled();
    });
  });

  describe('applyPastedSupporterKey', () => {
    it('stores a valid pasted key without an email', async () => {
      mockVerify.mockResolvedValue({ status: 'valid', payload: makePayload() });

      const store = makeStore();
      await store.dispatch(applyPastedSupporterKey('  DSCRB-pasted  '));

      expect(stateData[SUPPORTER_KEY_STORAGE_KEY]).toBe('DSCRB-pasted');
      expect(stateData[SUPPORTER_EMAIL_STORAGE_KEY]).toBeUndefined();
      expect(store.getState().supporter.keyStatus).toBe('valid');
      expect(store.getState().supporter.hasStoredEmail).toBe(false);
    });

    it.each([
      ['invalid', "doesn't look like a valid"],
      ['expired', 'expired'],
      ['revoked', 'no longer active'],
    ])('rejects a %s key with matching copy', async (status, copy) => {
      mockVerify.mockResolvedValue({ status, payload: makePayload() });

      const store = makeStore();
      await store.dispatch(applyPastedSupporterKey('DSCRB-bad'));

      expect(store.getState().supporter.claimError).toContain(copy);
      expect(stateData[SUPPORTER_KEY_STORAGE_KEY]).toBeUndefined();
    });
  });

  describe('removeSupporterKey', () => {
    it('deletes the key AND the email (the auto-refresh off-switch)', async () => {
      stateData[SUPPORTER_KEY_STORAGE_KEY] = 'DSCRB-key';
      stateData[SUPPORTER_EMAIL_STORAGE_KEY] = 'user@example.com';
      mockVerify.mockResolvedValue({ status: 'valid', payload: makePayload() });

      const store = makeStore();
      await store.dispatch(initializeSupporter());
      await store.dispatch(removeSupporterKey());

      expect(stateData[SUPPORTER_KEY_STORAGE_KEY]).toBeUndefined();
      expect(stateData[SUPPORTER_EMAIL_STORAGE_KEY]).toBeUndefined();
      const state = store.getState().supporter;
      expect(state.keyStatus).toBe('none');
      expect(state.payload).toBeNull();
      expect(state.hasStoredEmail).toBe(false);
      expect(selectSupporterKeyStatus(rootState(store))).toBe('none');
    });
  });

  describe('gift attention + dialog', () => {
    it('marks the gift attention seen optimistically and persists it', async () => {
      const store = makeStore();
      const promise = store.dispatch(markGiftAttentionSeen());
      expect(store.getState().supporter.giftAttentionSeen).toBe(true);
      await promise;
      expect(stateData[GIFT_ATTENTION_SEEN_STORAGE_KEY]).toBe(true);
    });

    it('closing the dialog clears any claim error', async () => {
      mockRequestKey.mockRejectedValue(new MockClaimError('nope', 404));
      const store = makeStore();
      store.dispatch(setSupporterDialogOpen(true));
      await store.dispatch(claimSupporterKey({ email: 'user@example.com' }));
      expect(store.getState().supporter.claimError).toBe('nope');

      store.dispatch(setSupporterDialogOpen(false));
      expect(store.getState().supporter.dialogOpen).toBe(false);
      expect(store.getState().supporter.claimError).toBeNull();
    });
  });
});
