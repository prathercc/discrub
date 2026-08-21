import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { fetchRevokedSupporterKeys } from 'discrub-core/github-service';
import type { RootState } from '@/app/store';
import { storage } from '@/extension/storage';
import {
  verifySupporterKey,
  type SupporterKeyPayload,
  type SupporterKeyVerification,
} from '@services/supporterKeyService';
import {
  requestSupporterKey,
  SupporterClaimError,
} from '@services/supporterClaimService';
import {
  initialSupporterState,
  SUPPORTER_KEY_STORAGE_KEY,
  SUPPORTER_EMAIL_STORAGE_KEY,
  GIFT_ATTENTION_SEEN_STORAGE_KEY,
} from './supporterTypes';

/**
 * Supporter slice — key claim, local Ed25519 verification, and the
 * always-on monthly auto-refresh (ratified 2026-08-21: claiming is the
 * consent moment, disclosure lives in the claim dialog, removing the
 * key is the off-switch and deletes the stored email with it).
 *
 * Everything fails open toward the free experience: a broken fetch,
 * an offline refresh, or an unsupported browser just means themes stay
 * (or fall back to) the free set. No operation here may throw into UI.
 */

/** Refresh a monthly key once per app-open when this close to expiry. */
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface VerifiedKeyState {
  keyStatus: SupporterKeyVerification['status'];
  payload: SupporterKeyPayload | null;
}

const toVerifiedState = (verification: SupporterKeyVerification): VerifiedKeyState => ({
  keyStatus: verification.status,
  payload: verification.payload ?? null,
});

/**
 * Load and verify the stored key on app boot. If a stored monthly key
 * is within the refresh window (or already past exp) and a claim email
 * is stored, silently re-claim first — at most one attempt per
 * app-open; failure just rides the grace already baked into exp.
 */
export const initializeSupporter = createAsyncThunk(
  'supporter/initialize',
  async () => {
    const [storedKey, storedEmail, giftSeen] = await Promise.all([
      storage.state.get<string>(SUPPORTER_KEY_STORAGE_KEY),
      storage.state.get<string>(SUPPORTER_EMAIL_STORAGE_KEY),
      storage.state.get<boolean>(GIFT_ATTENTION_SEEN_STORAGE_KEY),
    ]);

    const base = {
      giftAttentionSeen: giftSeen === true,
      hasStoredEmail: typeof storedEmail === 'string' && storedEmail.length > 0,
    };

    if (!storedKey) {
      return { ...base, keyStatus: 'none' as const, payload: null };
    }

    // Revocation is a rare-remedy tool riding the existing gist reads;
    // fetch failures resolve to [] inside the service (fail open).
    const revokedJtis = await fetchRevokedSupporterKeys();
    let verification = await verifySupporterKey(storedKey, { revokedJtis });

    const exp = verification.payload?.exp;
    const shouldRefresh =
      verification.payload?.tier === 'monthly' &&
      typeof exp === 'number' &&
      exp * 1000 - Date.now() < REFRESH_WINDOW_MS &&
      verification.status !== 'revoked' &&
      base.hasStoredEmail;

    if (shouldRefresh) {
      try {
        const result = await requestSupporterKey(storedEmail as string);
        const refreshed = await verifySupporterKey(result.key, { revokedJtis });
        if (refreshed.status === 'valid') {
          await storage.state.set(SUPPORTER_KEY_STORAGE_KEY, result.key);
          verification = refreshed;
        }
      } catch {
        // Offline or membership lapsed — keep the existing verification.
      }
    }

    return { ...base, ...toVerifiedState(verification) };
  },
);

/**
 * Claim (or manually refresh) a key with an email. Stores both the
 * key and the email — the email is what powers auto-refresh and is
 * deleted along with the key by removeSupporterKey.
 */
export const claimSupporterKey = createAsyncThunk(
  'supporter/claim',
  async (
    { email, displayName }: { email: string; displayName?: string },
    { rejectWithValue },
  ) => {
    try {
      const result = await requestSupporterKey(email, displayName);
      const verification = await verifySupporterKey(result.key);
      if (verification.status !== 'valid' || !verification.payload) {
        return rejectWithValue(
          'The server issued a key this app version could not verify. Please update Discrub and try again.',
        );
      }
      await Promise.all([
        storage.state.set(SUPPORTER_KEY_STORAGE_KEY, result.key),
        storage.state.set(SUPPORTER_EMAIL_STORAGE_KEY, email),
      ]);
      return { keyStatus: verification.status, payload: verification.payload };
    } catch (error) {
      if (error instanceof SupporterClaimError) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Something went wrong claiming your key. Please try again.');
    }
  },
);

/**
 * Manual "refresh key" — re-claims with the email stored at claim
 * time. Distinct from claimSupporterKey so the dialog's supporter
 * state never needs to re-collect (or display) the email.
 */
export const refreshSupporterKey = createAsyncThunk(
  'supporter/refreshKey',
  async (_, { rejectWithValue }) => {
    const storedEmail = await storage.state.get<string>(SUPPORTER_EMAIL_STORAGE_KEY);
    if (!storedEmail) {
      return rejectWithValue(
        'No saved email to refresh with. Claim again with your Ko-fi email.',
      );
    }
    try {
      const result = await requestSupporterKey(storedEmail);
      const verification = await verifySupporterKey(result.key);
      if (verification.status !== 'valid' || !verification.payload) {
        return rejectWithValue(
          'The server issued a key this app version could not verify. Please update Discrub and try again.',
        );
      }
      await storage.state.set(SUPPORTER_KEY_STORAGE_KEY, result.key);
      return { keyStatus: verification.status, payload: verification.payload };
    } catch (error) {
      if (error instanceof SupporterClaimError) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Something went wrong refreshing your key. Please try again.');
    }
  },
);

/**
 * Paste-a-key fallback (second browser, email lookup trouble). No
 * email is stored, so auto-refresh stays off for keys entered this
 * way — re-pasting or claiming with the email turns it back on.
 */
export const applyPastedSupporterKey = createAsyncThunk(
  'supporter/applyPastedKey',
  async (key: string, { rejectWithValue }) => {
    const trimmed = key.trim();
    const verification = await verifySupporterKey(trimmed);
    if (verification.status === 'invalid') {
      return rejectWithValue("That doesn't look like a valid supporter key.");
    }
    if (verification.status === 'expired') {
      return rejectWithValue(
        'That key has expired. Claim a fresh one with your Ko-fi email.',
      );
    }
    if (verification.status === 'revoked') {
      return rejectWithValue('That key is no longer active.');
    }
    await storage.state.set(SUPPORTER_KEY_STORAGE_KEY, trimmed);
    return { keyStatus: verification.status, payload: verification.payload! };
  },
);

/**
 * The off-switch: deletes the key AND the stored email, which stops
 * all refresh calls entirely.
 */
export const removeSupporterKey = createAsyncThunk('supporter/removeKey', async () => {
  await Promise.all([
    storage.state.remove(SUPPORTER_KEY_STORAGE_KEY),
    storage.state.remove(SUPPORTER_EMAIL_STORAGE_KEY),
  ]);
});

/** Calm the gift-button attention animation permanently. */
export const markGiftAttentionSeen = createAsyncThunk(
  'supporter/markGiftAttentionSeen',
  async () => {
    await storage.state.set(GIFT_ATTENTION_SEEN_STORAGE_KEY, true);
  },
);

const supporterSlice = createSlice({
  name: 'supporter',
  initialState: initialSupporterState,
  reducers: {
    setSupporterDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.dialogOpen = action.payload;
      if (!action.payload) state.claimError = null;
    },
    clearClaimError: (state) => {
      state.claimError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeSupporter.fulfilled, (state, action) => {
        state.initialized = true;
        state.keyStatus = action.payload.keyStatus;
        state.payload = action.payload.payload;
        state.hasStoredEmail = action.payload.hasStoredEmail;
        state.giftAttentionSeen = action.payload.giftAttentionSeen;
      })
      .addCase(initializeSupporter.rejected, (state) => {
        // Storage failure — behave as a fresh install (free experience).
        state.initialized = true;
      })
      .addCase(claimSupporterKey.pending, (state) => {
        state.claimInProgress = true;
        state.claimError = null;
      })
      .addCase(claimSupporterKey.fulfilled, (state, action) => {
        state.claimInProgress = false;
        state.keyStatus = action.payload.keyStatus;
        state.payload = action.payload.payload;
        state.hasStoredEmail = true;
      })
      .addCase(claimSupporterKey.rejected, (state, action) => {
        state.claimInProgress = false;
        state.claimError =
          (action.payload as string) ?? 'Something went wrong claiming your key.';
      })
      .addCase(refreshSupporterKey.pending, (state) => {
        state.claimInProgress = true;
        state.claimError = null;
      })
      .addCase(refreshSupporterKey.fulfilled, (state, action) => {
        state.claimInProgress = false;
        state.keyStatus = action.payload.keyStatus;
        state.payload = action.payload.payload;
      })
      .addCase(refreshSupporterKey.rejected, (state, action) => {
        state.claimInProgress = false;
        state.claimError =
          (action.payload as string) ?? 'Something went wrong refreshing your key.';
      })
      .addCase(applyPastedSupporterKey.pending, (state) => {
        state.claimInProgress = true;
        state.claimError = null;
      })
      .addCase(applyPastedSupporterKey.fulfilled, (state, action) => {
        state.claimInProgress = false;
        state.keyStatus = action.payload.keyStatus;
        state.payload = action.payload.payload;
      })
      .addCase(applyPastedSupporterKey.rejected, (state, action) => {
        state.claimInProgress = false;
        state.claimError =
          (action.payload as string) ?? "That key couldn't be verified.";
      })
      .addCase(removeSupporterKey.fulfilled, (state) => {
        state.keyStatus = 'none';
        state.payload = null;
        state.hasStoredEmail = false;
        state.claimError = null;
      })
      .addCase(markGiftAttentionSeen.pending, (state) => {
        // Optimistic — the animation should calm the moment the dialog
        // opens, not after the IDB write lands.
        state.giftAttentionSeen = true;
      });
  },
});

export const { setSupporterDialogOpen, clearClaimError } = supporterSlice.actions;

// Selectors
export const selectSupporter = (state: RootState) => state.supporter;
export const selectIsSupporter = (state: RootState) =>
  state.supporter.keyStatus === 'valid';
export const selectSupporterKeyStatus = (state: RootState) => state.supporter.keyStatus;
export const selectSupporterPayload = (state: RootState) => state.supporter.payload;
export const selectSupporterDialogOpen = (state: RootState) => state.supporter.dialogOpen;
export const selectGiftAttentionSeen = (state: RootState) =>
  state.supporter.giftAttentionSeen;
export const selectSupporterClaimInProgress = (state: RootState) =>
  state.supporter.claimInProgress;
export const selectSupporterClaimError = (state: RootState) => state.supporter.claimError;
export const selectSupporterHasStoredEmail = (state: RootState) =>
  state.supporter.hasStoredEmail;

export default supporterSlice.reducer;
