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
  requestSupporterKeyRefresh,
  SupporterClaimError,
} from '@services/supporterClaimService';
import type { SupporterFooterPreferences } from '@services/exportFooter';
import {
  initialSupporterState,
  SUPPORTER_KEY_STORAGE_KEY,
  SUPPORTER_EMAIL_STORAGE_KEY,
  FOOTER_TEXT_STORAGE_KEY,
  FOOTER_REMOVED_STORAGE_KEY,
  FOOTER_ICON_MEDIA_KEY,
} from './supporterTypes';

/**
 * Supporter slice — pasted-key application, local Ed25519
 * verification, and the always-on monthly auto-refresh. Keys arrive by
 * email when a membership starts; renewal presents the key itself to
 * the server (applying a key is the consent moment, disclosure lives
 * in the hub copy, removing the key is the off-switch). No email
 * address is ever collected or stored on this device.
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
 * is within the refresh window (or already past exp), silently renew
 * it by presenting the key itself — at most one attempt per app-open;
 * failure just rides the grace already baked into exp.
 */
export const initializeSupporter = createAsyncThunk(
  'supporter/initialize',
  async () => {
    const [storedKey, footerText, footerRemoved, footerIcon] =
      await Promise.all([
        storage.state.get<string>(SUPPORTER_KEY_STORAGE_KEY),
        storage.state.get<string>(FOOTER_TEXT_STORAGE_KEY),
        storage.state.get<boolean>(FOOTER_REMOVED_STORAGE_KEY),
        storage.media.get<string>(FOOTER_ICON_MEDIA_KEY),
      ]);

    // Pre-release builds stored a claim email; the key-based refresh
    // makes it obsolete, so scrub any leftover value.
    storage.state.remove(SUPPORTER_EMAIL_STORAGE_KEY).catch(() => {});

    const base = {
      footer: {
        text: typeof footerText === 'string' && footerText ? footerText : null,
        removed: footerRemoved === true,
        iconDataUri: typeof footerIcon === 'string' && footerIcon ? footerIcon : null,
      } as SupporterFooterPreferences,
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
      verification.status !== 'revoked';

    if (shouldRefresh) {
      try {
        const result = await requestSupporterKeyRefresh(storedKey as string);
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
 * Manual "refresh key" — presents the stored key to the refresh
 * endpoint for a fresh one. Works for valid and recently-expired
 * monthly keys alike; the server's entitlement check is the truth.
 */
export const refreshSupporterKey = createAsyncThunk(
  'supporter/refreshKey',
  async (_, { rejectWithValue }) => {
    const storedKey = await storage.state.get<string>(SUPPORTER_KEY_STORAGE_KEY);
    if (!storedKey) {
      return rejectWithValue('No key to refresh. Paste your supporter key first.');
    }
    try {
      const result = await requestSupporterKeyRefresh(storedKey);
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
 * Apply a pasted supporter key — the primary unlock path. Keys arrive
 * by email when a membership starts; monthly ones then renew
 * themselves via the refresh endpoint.
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
        'That key has expired. Check your email for a newer one, or use Refresh key.',
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
 * The off-switch: deletes the key, which stops all refresh calls
 * entirely. (The email removal is legacy cleanup from pre-release
 * builds that stored one.)
 */
export const removeSupporterKey = createAsyncThunk('supporter/removeKey', async () => {
  await Promise.all([
    storage.state.remove(SUPPORTER_KEY_STORAGE_KEY),
    storage.state.remove(SUPPORTER_EMAIL_STORAGE_KEY),
  ]);
});

/**
 * Persist export-footer text/removed preferences (slot F). Empty text
 * clears the stored value back to the default.
 */
export const updateFooterPreferences = createAsyncThunk(
  'supporter/updateFooterPreferences',
  async (prefs: { text?: string; removed?: boolean }) => {
    const writes: Promise<void>[] = [];
    let text: string | null | undefined;
    if (prefs.text !== undefined) {
      text = prefs.text.trim() || null;
      writes.push(
        text === null
          ? storage.state.remove(FOOTER_TEXT_STORAGE_KEY)
          : storage.state.set(FOOTER_TEXT_STORAGE_KEY, text),
      );
    }
    if (prefs.removed !== undefined) {
      writes.push(
        prefs.removed
          ? storage.state.set(FOOTER_REMOVED_STORAGE_KEY, true)
          : storage.state.remove(FOOTER_REMOVED_STORAGE_KEY),
      );
    }
    await Promise.all(writes);
    return { text, removed: prefs.removed };
  },
);

/**
 * Persist (or clear, with null) the custom footer icon. The caller has
 * already validated and downscaled the image to a small data URI
 * (processFooterIconFile); the payload lives in Discrub-media.
 */
export const setFooterIcon = createAsyncThunk(
  'supporter/setFooterIcon',
  async (dataUri: string | null) => {
    if (dataUri === null) {
      await storage.media.remove(FOOTER_ICON_MEDIA_KEY);
    } else {
      await storage.media.set(FOOTER_ICON_MEDIA_KEY, dataUri);
    }
    return dataUri;
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
    // Calm the gift-button attention animation for the rest of this
    // session. Deliberately NOT persisted: the glow/wiggle re-arms on
    // every app open until the user becomes a supporter.
    markGiftAttentionSeen: (state) => {
      state.giftAttentionSeen = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeSupporter.fulfilled, (state, action) => {
        state.initialized = true;
        state.keyStatus = action.payload.keyStatus;
        state.payload = action.payload.payload;
        state.footer = action.payload.footer;
      })
      .addCase(initializeSupporter.rejected, (state) => {
        // Storage failure — behave as a fresh install (free experience).
        state.initialized = true;
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
        state.claimError = null;
      })
      .addCase(updateFooterPreferences.fulfilled, (state, action) => {
        if (action.payload.text !== undefined) state.footer.text = action.payload.text;
        if (action.payload.removed !== undefined) state.footer.removed = action.payload.removed;
      })
      .addCase(setFooterIcon.fulfilled, (state, action) => {
        state.footer.iconDataUri = action.payload;
      });
  },
});

export const { setSupporterDialogOpen, clearClaimError, markGiftAttentionSeen } =
  supporterSlice.actions;

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
export const selectSupporterFooter = (state: RootState) => state.supporter.footer;

export default supporterSlice.reducer;
