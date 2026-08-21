import type {
  SupporterKeyPayload,
  SupporterKeyStatus,
} from '@services/supporterKeyService';

/**
 * Supporter platform state. Key material persists in `Discrub-state`
 * under `supporter:*` keys (owned by supporterSlice, deliberately
 * OUTSIDE AppSettings so SettingsModal's whole-object batch save can
 * never clobber a key claimed while the modal is open).
 */

export const SUPPORTER_KEY_STORAGE_KEY = 'supporter:key';
export const SUPPORTER_EMAIL_STORAGE_KEY = 'supporter:email';
export const GIFT_ATTENTION_SEEN_STORAGE_KEY = 'supporter:giftAttentionSeen';

export interface SupporterState {
  /** True once initializeSupporter has resolved (gates load-time UI). */
  initialized: boolean;
  /** 'none' = no stored key; otherwise last verification outcome. */
  keyStatus: SupporterKeyStatus | 'none';
  /** Verified payload — present for valid/expired/revoked keys. */
  payload: SupporterKeyPayload | null;
  /** Whether a refresh email is stored (enables auto/manual refresh). */
  hasStoredEmail: boolean;
  dialogOpen: boolean;
  /** Gift-button attention animation calms permanently once true. */
  giftAttentionSeen: boolean;
  claimInProgress: boolean;
  claimError: string | null;
}

export const initialSupporterState: SupporterState = {
  initialized: false,
  keyStatus: 'none',
  payload: null,
  hasStoredEmail: false,
  dialogOpen: false,
  giftAttentionSeen: false,
  claimInProgress: false,
  claimError: null,
};
