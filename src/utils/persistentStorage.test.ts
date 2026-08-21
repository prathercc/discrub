import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestPersistentStorage } from './persistentStorage';

const stubStorageManager = (manager: unknown) => {
  vi.stubGlobal('navigator', { storage: manager });
};

describe('requestPersistentStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests persistence when not yet granted', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorageManager({ persisted: vi.fn().mockResolvedValue(false), persist });

    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('short-circuits when the origin is already persistent', async () => {
    const persist = vi.fn();
    stubStorageManager({ persisted: vi.fn().mockResolvedValue(true), persist });

    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns false on denial', async () => {
    stubStorageManager({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(false),
    });

    expect(await requestPersistentStorage()).toBe(false);
  });

  it('returns false without the API (never throws)', async () => {
    stubStorageManager(undefined);
    expect(await requestPersistentStorage()).toBe(false);

    stubStorageManager({});
    expect(await requestPersistentStorage()).toBe(false);
  });

  it('swallows a rejected persist call', async () => {
    stubStorageManager({
      persisted: vi.fn().mockRejectedValue(new Error('nope')),
      persist: vi.fn(),
    });

    expect(await requestPersistentStorage()).toBe(false);
  });
});
