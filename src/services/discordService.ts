import { DiscordService } from 'discrub-core/discord-service';
import type { AppSettings } from 'discrub-core/types/discrub-types';
import { addStatusEntry } from '@features/status/statusSlice';

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
    discordServiceInstance.onRateLimit = async (retryAfter) => {
      const store = await getStore();
      store.dispatch(addStatusEntry({
        level: 'warning',
        message: `Rate limited by Discord, retrying in ${retryAfter.toFixed(1)}s`,
      }));
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
