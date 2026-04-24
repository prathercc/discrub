import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '@/extension/storage';
import { enrichmentCache, type EnrichedChannelCache } from './enrichmentCache';
import type { Message } from 'discrub-core/types/discord-types';

const USER_A = '111111111111111111';
const USER_B = '222222222222222222';
const CHAN_X = 'xxxxxxxxxxxxxxxxxx';
const CHAN_Y = 'yyyyyyyyyyyyyyyyyy';

function fakeMessage(id: string): Message {
  return { id, content: `msg ${id}` } as unknown as Message;
}

function fakeCache(...ids: string[]): EnrichedChannelCache {
  return {
    lastFetched: 1_700_000_000_000,
    messages: Object.fromEntries(ids.map((id) => [id, fakeMessage(id)])),
    misses: { deleted: [], forbidden: [] },
  };
}

describe('enrichmentCache', () => {
  beforeEach(async () => {
    await storage.package.clear();
  });

  it('returns null when no cache exists for the channel', async () => {
    expect(await enrichmentCache.get(USER_A, CHAN_X)).toBeNull();
  });

  it('round-trips a cache via put/get', async () => {
    const cache = fakeCache('m1', 'm2');
    await enrichmentCache.put(USER_A, CHAN_X, cache);
    const read = await enrichmentCache.get(USER_A, CHAN_X);
    expect(read).not.toBeNull();
    expect(read?.lastFetched).toBe(cache.lastFetched);
    expect(Object.keys(read?.messages ?? {})).toEqual(['m1', 'm2']);
  });

  it('overwrites existing cache on put', async () => {
    await enrichmentCache.put(USER_A, CHAN_X, fakeCache('m1'));
    await enrichmentCache.put(USER_A, CHAN_X, fakeCache('m2', 'm3'));
    const read = await enrichmentCache.get(USER_A, CHAN_X);
    expect(Object.keys(read?.messages ?? {})).toEqual(['m2', 'm3']);
  });

  it('preserves the misses structure through round-trip', async () => {
    const cache: EnrichedChannelCache = {
      lastFetched: 42,
      messages: { m1: fakeMessage('m1') },
      misses: { deleted: ['m2', 'm3'], forbidden: ['m4'] },
    };
    await enrichmentCache.put(USER_A, CHAN_X, cache);
    const read = await enrichmentCache.get(USER_A, CHAN_X);
    expect(read?.misses).toEqual({ deleted: ['m2', 'm3'], forbidden: ['m4'] });
  });

  it('isolates cache entries across users', async () => {
    await enrichmentCache.put(USER_A, CHAN_X, fakeCache('a'));
    await enrichmentCache.put(USER_B, CHAN_X, fakeCache('b'));
    const readA = await enrichmentCache.get(USER_A, CHAN_X);
    const readB = await enrichmentCache.get(USER_B, CHAN_X);
    expect(Object.keys(readA?.messages ?? {})).toEqual(['a']);
    expect(Object.keys(readB?.messages ?? {})).toEqual(['b']);
  });

  it('isolates cache entries across channels', async () => {
    await enrichmentCache.put(USER_A, CHAN_X, fakeCache('x'));
    await enrichmentCache.put(USER_A, CHAN_Y, fakeCache('y'));
    expect(Object.keys((await enrichmentCache.get(USER_A, CHAN_X))?.messages ?? {})).toEqual(['x']);
    expect(Object.keys((await enrichmentCache.get(USER_A, CHAN_Y))?.messages ?? {})).toEqual(['y']);
  });

  it('clearChannel removes only the targeted channel', async () => {
    await enrichmentCache.put(USER_A, CHAN_X, fakeCache('x'));
    await enrichmentCache.put(USER_A, CHAN_Y, fakeCache('y'));
    await enrichmentCache.clearChannel(USER_A, CHAN_X);
    expect(await enrichmentCache.get(USER_A, CHAN_X)).toBeNull();
    expect(await enrichmentCache.get(USER_A, CHAN_Y)).not.toBeNull();
  });

  it('clearAll removes every cache entry for the given user only', async () => {
    await enrichmentCache.put(USER_A, CHAN_X, fakeCache('ax'));
    await enrichmentCache.put(USER_A, CHAN_Y, fakeCache('ay'));
    await enrichmentCache.put(USER_B, CHAN_X, fakeCache('bx'));
    await enrichmentCache.clearAll(USER_A);
    expect(await enrichmentCache.get(USER_A, CHAN_X)).toBeNull();
    expect(await enrichmentCache.get(USER_A, CHAN_Y)).toBeNull();
    expect(await enrichmentCache.get(USER_B, CHAN_X)).not.toBeNull();
  });

  it('clearAll is a no-op when no enrichment rows exist for the user', async () => {
    await enrichmentCache.put(USER_B, CHAN_X, fakeCache('bx'));
    await enrichmentCache.clearAll(USER_A);
    expect(await enrichmentCache.get(USER_B, CHAN_X)).not.toBeNull();
  });

  it('clearAll does not remove non-enrichment keys in the package store', async () => {
    // packageSlice stores `deleted:{userId}` entries in the same DB;
    // clearAll must leave them untouched.
    await storage.package.set(`deleted:${USER_A}`, { [CHAN_X]: ['m1'] });
    await enrichmentCache.put(USER_A, CHAN_X, fakeCache('x'));
    await enrichmentCache.clearAll(USER_A);
    expect(await enrichmentCache.get(USER_A, CHAN_X)).toBeNull();
    expect(await storage.package.get(`deleted:${USER_A}`)).toEqual({
      [CHAN_X]: ['m1'],
    });
  });
});
