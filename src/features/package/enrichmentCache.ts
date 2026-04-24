/**
 * Per-channel rehydration cache for Discord data-package imports.
 *
 * Tier 2 rehydration fetches live `Message` objects from Discord's API
 * (via `fetchMessageData(token, '', channelId, 'around={id}&limit=1')`)
 * to recover reactions, reply refs, named mentions, embeds, stickers,
 * and fresh signed CDN URLs. Results are persisted so enrichment
 * survives reloads — the next time the user opens the same package
 * channel, rich data appears instantly without re-hitting Discord.
 *
 * Storage: `Discrub-package` IDB database, key
 *   `enriched:{userId}:{channelId}` → `EnrichedChannelCache`
 *
 * Keyed by `{userId}` (not just `{channelId}`) so multiple users can
 * import packages on the same machine without collision.
 */
import type { Message } from 'discrub-core/types/discord-types';
import { storage } from '@/extension/storage';

/**
 * Cached rehydration result for a single package channel.
 *
 * - `messages` maps package message IDs to the live `Message` object
 *   returned by the API. Missing entries in the map indicate either
 *   "not yet rehydrated" or "known miss" (see `misses` below).
 * - `misses.deleted` lists message IDs that returned 404 — the message
 *   was deleted from Discord after the package was exported.
 * - `misses.forbidden` lists message IDs that returned 403 — the user
 *   is no longer in the server, or otherwise can't read the channel.
 */
export interface EnrichedChannelCache {
  lastFetched: number;
  messages: Record<string, Message>;
  misses: {
    deleted: string[];
    forbidden: string[];
  };
}

const PREFIX = 'enriched:';

function keyFor(userId: string, channelId: string): string {
  return `${PREFIX}${userId}:${channelId}`;
}

function userPrefix(userId: string): string {
  return `${PREFIX}${userId}:`;
}

export const enrichmentCache = {
  async get(
    userId: string,
    channelId: string,
  ): Promise<EnrichedChannelCache | null> {
    return storage.package.get<EnrichedChannelCache>(keyFor(userId, channelId));
  },

  async put(
    userId: string,
    channelId: string,
    data: EnrichedChannelCache,
  ): Promise<void> {
    await storage.package.set(keyFor(userId, channelId), data);
  },

  async clearChannel(userId: string, channelId: string): Promise<void> {
    await storage.package.remove(keyFor(userId, channelId));
  },

  async clearAll(userId: string): Promise<void> {
    const all = await storage.package.keys();
    const prefix = userPrefix(userId);
    const toClear = all.filter((k) => k.startsWith(prefix));
    await Promise.all(toClear.map((k) => storage.package.remove(k)));
  },
};
