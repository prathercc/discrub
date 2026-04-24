import type { ExportUserMap } from 'discrub-core/types/discrub-types';

/**
 * Cache state structure
 * This is designed to be extensible for future caching needs
 */
export interface CacheState {
  userMap: ExportUserMap;
  /** User IDs that returned 404 — skip future lookups for these */
  failedUserIds: string[];
  isLoaded: boolean;
}

/**
 * Initial cache state
 */
export const initialCacheState: CacheState = {
  userMap: {},
  failedUserIds: [],
  isLoaded: false,
};

/**
 * Key inside the `cache` object store (`storage.cache`). The store
 * itself already provides the discrub-vs-anything-else namespace, so
 * this is just the data shape's name within that store.
 */
export const CACHE_STORAGE_KEY = 'userMap';
