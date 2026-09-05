import { DiscordService } from 'discrub-core/discord-service';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { addStatusEntry, showToast } from '@features/status/statusSlice';
import { setDiscrubCancelled, setDiscrubPaused, setRateLimitStopped } from '@features/app/appSlice';

import { RATE_LIMIT_STOP_TOAST, RATE_LIMIT_STOP_MESSAGE } from '@/constants/rateLimitMessages';
export { RATE_LIMIT_STOP_TOAST, RATE_LIMIT_STOP_MESSAGE };

/**
 * Discord service wrapper for the application
 * Provides a singleton instance of DiscordService with settings
 */

let discordServiceInstance: DiscordService | null = null;

// Lazy import to avoid circular dependency (store → slices → discordService → store)
type AppStore = Awaited<ReturnType<typeof importStore>>;
const importStore = () => import('@/app/store').then((m) => m.store);
let cachedStore: AppStore | null = null;
const getStore = () => importStore().then((store) => { cachedStore = store; return store; });
/** Test hook: resolves once the store cache is warm. */
export const storeReady = () => getStore();

/**
 * Dispatch through the cached store when it is already resolved, so the
 * dispatch lands synchronously with the event that caused it. The
 * rate-limit stop (#254) depends on this: the cancel flag has to be set
 * before the failing request's rejection reaches the operation loop,
 * or a loop on its last channel finishes as "Complete" and only then
 * sees the cancel.
 */
const dispatchNow = (action: Parameters<AppStore['dispatch']>[0]) => {
  if (cachedStore) {
    cachedStore.dispatch(action);
    return;
  }
  void getStore().then((store) => store.dispatch(action));
};

/**
 * Get or create the Discord service instance
 * @param settings - Optional app settings to reinitialize the service with
 * @returns DiscordService instance
 */
export const getDiscordService = (settings?: AppSettings): DiscordService => {
  if (!discordServiceInstance || settings) {
    // autoDelay off: every bulk loop in the slices already sleeps the
    // configured search/delete delay between calls, so the service's
    // own pre-request delay would double the effective pacing (#241).
    // The app owns pacing for everything routed through this singleton;
    // enrichment flows construct their own self-pacing adapters.
    discordServiceInstance = new DiscordService(settings, { autoDelay: false });
    discordServiceInstance.onRateLimit = async (retryAfter, info) => {
      const store = await getStore();
      const scope = info?.global ? ' (global limit)' : '';
      const streak = info && info.consecutive > 1 ? `, ${info.consecutive} in a row` : '';
      store.dispatch(addStatusEntry({
        level: 'warning',
        message: `Rate limited by Discord${scope}, retrying in ${retryAfter.toFixed(1)}s${streak}`,
      }));
    };
    // #254: a 429 storm (retry_after past the cap, or five 429s back to
    // back on one request) stops the whole operation instead of pausing
    // and inviting Resume. Resuming into a storm is what preceded the
    // r/discrub suspension report.
    discordServiceInstance.onRateLimitExceeded = (info) => {
      dispatchNow(addStatusEntry({
        level: 'error',
        message: `${RATE_LIMIT_STOP_MESSAGE} (Discord asked for ${Math.round(info.retryAfter)}s, ${info.consecutive} rate limit${info.consecutive === 1 ? '' : 's'} in a row)`,
      }));
      dispatchNow(setDiscrubPaused(false));
      dispatchNow(setDiscrubCancelled(true));
      // MainLayout turns this into the completion toast once the
      // operation has unwound, so the reason survives the generic
      // "complete / cancelled" toast that would otherwise replace it.
      dispatchNow(setRateLimitStopped(true));
      dispatchNow(showToast({ level: 'error', message: RATE_LIMIT_STOP_TOAST }));
    };
    // Warm the store cache so the storm hook can dispatch synchronously.
    void getStore();
    discordServiceInstance.onDelay = async () => {
      // Intentionally empty — delay entries removed from status log
    };
  }
  return discordServiceInstance;
};

/**
 * Reset the Discord service instance
 * Useful when settings change or user logs out
 */
export const resetDiscordService = (): void => {
  discordServiceInstance = null;
};

export default {
  getDiscordService,
  resetDiscordService,
};
