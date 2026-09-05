import { DiscordService } from 'discrub-core/discord-service';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { addStatusEntry, showToast } from '@features/status/statusSlice';
import { setDiscrubCancelled, setDiscrubPaused } from '@features/app/appSlice';

/**
 * Status-log line written when discrub-core abandons a request after
 * repeated 429s (#254). The operation is cancelled through the normal
 * cancel flag so every loop unwinds the way a user cancel would.
 */
export const RATE_LIMIT_STOP_MESSAGE =
  'Discord is rate limiting this account heavily. Stopped the operation to protect your account. Wait at least 10 minutes before starting another one.';

/**
 * Discord service wrapper for the application
 * Provides a singleton instance of DiscordService with settings
 */

let discordServiceInstance: DiscordService | null = null;

// Lazy import to avoid circular dependency (store → slices → discordService → store)
const getStore = () => import('@/app/store').then((m) => m.store);

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
    discordServiceInstance.onRateLimitExceeded = async (info) => {
      const store = await getStore();
      store.dispatch(addStatusEntry({
        level: 'error',
        message: `${RATE_LIMIT_STOP_MESSAGE} (Discord asked for ${Math.round(info.retryAfter)}s, ${info.consecutive} rate limit${info.consecutive === 1 ? '' : 's'} in a row)`,
      }));
      store.dispatch(setDiscrubPaused(false));
      store.dispatch(setDiscrubCancelled(true));
      store.dispatch(showToast({ level: 'error', message: 'Stopped: Discord is rate limiting this account. Wait 10 minutes before trying again.' }));
    };
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
