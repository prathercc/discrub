import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import {
  streamPackageToStorage,
  loadChannelMessagesFromStorage,
  resumePackageFromStorage,
  clearPackageContents,
  hasStoredPackage,
  PackageStreamCancelledError,
  PKG_SCHEMA_VERSION,
} from './packageStreamService';
import { PackageParseError } from './packageParseService';
import { storage } from '@/extension/storage';
import { buildFixturePackage } from '@/test/package-fixtures';

// jsdom does not implement URL.createObjectURL. Stub it with a counter-keyed
// fake so tests can assert the streamer produced a blob URL string and that
// resume mints a distinct one each time it's called. Real browsers handle
// this natively; we're only patching the test environment.
let blobUrlCounter = 0;
beforeAll(() => {
  if (typeof URL.createObjectURL !== 'function') {
    Object.assign(URL, {
      createObjectURL: () => `blob:fake/${++blobUrlCounter}`,
      revokeObjectURL: () => {},
    });
  }
});

beforeEach(async () => {
  await storage.package.clear();
});

describe('streamPackageToStorage', () => {
  describe('happy path', () => {
    it('returns the same ParsedPackage shape parsePackageZip returns', async () => {
      const blob = await buildFixturePackage();
      const parsed = await streamPackageToStorage(blob);

      expect(parsed.user.id).toBe('253286221395001345');
      expect(parsed.user.username).toBe('prathercc');
      expect(parsed.user.globalName).toBe('Aaron');
      expect(parsed.guilds).toEqual([{ id: '100', name: 'Test Guild' }]);
      expect(parsed.channels).toHaveLength(2);
      expect(parsed.totalMessages).toBe(4);
    });

    it('writes pkg:meta:{userId} as the commit marker, last', async () => {
      const blob = await buildFixturePackage();
      await streamPackageToStorage(blob);

      const meta = await storage.package.get('pkg:meta:253286221395001345');
      expect(meta).toBeTruthy();
      expect((meta as any).user.id).toBe('253286221395001345');
      // avatarBlobUrl is realm-scoped and must NOT be in the persisted meta
      // (see resume flow: the URL is rebuilt from the stored Blob each time).
      expect((meta as any).avatarBlobUrl).toBeUndefined();
    });

    it('writes pkg:msgs:{userId}:{channelId} for every channel', async () => {
      const blob = await buildFixturePackage();
      await streamPackageToStorage(blob);

      // Default fixture: channel 200 (guild text, 3 msgs) + channel 300 (DM, 1 msg).
      const ch200 = await storage.package.get('pkg:msgs:253286221395001345:200');
      const ch300 = await storage.package.get('pkg:msgs:253286221395001345:300');

      expect(Array.isArray(ch200)).toBe(true);
      expect(Array.isArray(ch300)).toBe(true);
      expect((ch200 as any[]).length).toBe(3);
      expect((ch300 as any[]).length).toBe(1);
    });

    it('writes pkg:schema-version=1', async () => {
      const blob = await buildFixturePackage();
      await streamPackageToStorage(blob);
      expect(await storage.package.get('pkg:schema-version')).toBe(PKG_SCHEMA_VERSION);
    });

    it('returns a fresh avatarBlobUrl when account/avatar.png is present', async () => {
      const blob = await buildFixturePackage({ includeAvatar: true });
      const parsed = await streamPackageToStorage(blob);

      expect(parsed.avatarBlobUrl).toMatch(/^blob:/);
      // The bytes were persisted (as Uint8Array, not Blob — see comment in
      // streamPackageToStorage for why). fake-indexeddb's structured clone
      // returns a cross-realm Uint8Array, so `instanceof` fails; check the
      // byte count instead.
      const persisted = await storage.package.get<Uint8Array>('pkg:avatar:253286221395001345');
      expect(persisted).toBeTruthy();
      expect(persisted!.length).toBe(8);
    });

    it('omits avatarBlobUrl when account/avatar.png is absent', async () => {
      const blob = await buildFixturePackage(); // no avatar
      const parsed = await streamPackageToStorage(blob);
      expect(parsed.avatarBlobUrl).toBeUndefined();
      expect(await storage.package.get('pkg:avatar:253286221395001345')).toBeNull();
    });
  });

  describe('progress reporting', () => {
    it('fires onProgress at least once per channel + once for avatar + once for meta', async () => {
      const blob = await buildFixturePackage();
      const onProgress = vi.fn();
      await streamPackageToStorage(blob, { onProgress });

      // 2 channels + avatar + meta = 4 ticks minimum
      expect(onProgress).toHaveBeenCalledTimes(4);
      // Final tick reports the meta-write step.
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      const final = lastCall[0];
      expect(final.current).toBe(4);
      expect(final.total).toBe(4);
      expect(final.path).toBe('package metadata');
    });

    it('progress current values monotonically increase from 1 to total', async () => {
      const blob = await buildFixturePackage();
      const seen: number[] = [];
      await streamPackageToStorage(blob, {
        onProgress: ({ current }) => seen.push(current),
      });
      // Each value should be 1 greater than the previous.
      seen.forEach((c, i) => expect(c).toBe(i + 1));
    });
  });

  describe('cancellation', () => {
    it('throws PackageStreamCancelledError when shouldStop returns true mid-stream', async () => {
      const blob = await buildFixturePackage();
      let calls = 0;
      const shouldStop = () => {
        calls++;
        // Allow the unzip to complete; cancel before the per-channel loop
        // makes its first IDB write.
        return calls > 1;
      };

      await expect(streamPackageToStorage(blob, { shouldStop }))
        .rejects.toBeInstanceOf(PackageStreamCancelledError);
    });

    it('cleans up partial pkg:* writes for the user when cancelled', async () => {
      const blob = await buildFixturePackage();
      let calls = 0;
      const shouldStop = () => {
        calls++;
        // Cancel after the user's id is known (call 1 lets unzip + readUserJson
        // through; call 2 fires before the channel-write loop's first iter).
        return calls > 1;
      };

      try {
        await streamPackageToStorage(blob, { shouldStop });
      } catch {
        // expected
      }
      // No meta key should exist for the cancelled user.
      const meta = await storage.package.get('pkg:meta:253286221395001345');
      expect(meta).toBeNull();
      // No channel msgs either.
      const allKeys = await storage.package.keys();
      const userKeys = allKeys.filter((k) => k.includes(':253286221395001345'));
      expect(userKeys).toEqual([]);
    });
  });

  describe('isolation across packages', () => {
    it('clears any prior pkg:* keys before writing the new package', async () => {
      // Pre-seed a prior import for a different user; it should be wiped
      // when a new import starts.
      await storage.package.set('pkg:meta:111111111111111111', { user: { id: '111111111111111111' } });
      await storage.package.set('pkg:msgs:111111111111111111:abc', [{ id: 'a' }]);
      await storage.package.set('pkg:avatar:111111111111111111', new Blob(['old']));

      const blob = await buildFixturePackage();
      await streamPackageToStorage(blob);

      // Old user's data is gone.
      expect(await storage.package.get('pkg:meta:111111111111111111')).toBeNull();
      expect(await storage.package.get('pkg:msgs:111111111111111111:abc')).toBeNull();
      expect(await storage.package.get('pkg:avatar:111111111111111111')).toBeNull();
      // New user's data is present.
      expect(await storage.package.get('pkg:meta:253286221395001345')).toBeTruthy();
    });

    it('preserves the pkg:schema-version key across imports', async () => {
      await storage.package.set('pkg:schema-version', PKG_SCHEMA_VERSION);
      await storage.package.set('pkg:meta:old-user', {});

      const blob = await buildFixturePackage();
      await streamPackageToStorage(blob);

      expect(await storage.package.get('pkg:schema-version')).toBe(PKG_SCHEMA_VERSION);
      expect(await storage.package.get('pkg:meta:old-user')).toBeNull();
    });

    it('does NOT touch the existing enriched: or deleted: namespaces', async () => {
      // The enrichment cache and deleted-message cache live in the same
      // Discrub-package store under different prefixes; the new pkg:* logic
      // must not collide with them.
      await storage.package.set('enriched:user-x:channel-y', { foo: 'bar' });
      await storage.package.set('deleted:user-x', { 'channel-y': ['msg-1'] });

      const blob = await buildFixturePackage();
      await streamPackageToStorage(blob);

      expect(await storage.package.get('enriched:user-x:channel-y')).toEqual({ foo: 'bar' });
      expect(await storage.package.get('deleted:user-x')).toEqual({ 'channel-y': ['msg-1'] });
    });
  });

  describe('format coverage (regression guards from the legacy parser)', () => {
    it('handles wrapper directories transparently', async () => {
      const blob = await buildFixturePackage({
        wrapperDir: 'Discord Data Package - prathercc',
      });
      const parsed = await streamPackageToStorage(blob);
      expect(parsed.user.id).toBe('253286221395001345');
      expect(parsed.totalMessages).toBe(4);
    });

    it('handles capitalized top-level directories', async () => {
      const blob = await buildFixturePackage({ capitalizeTopDirs: true });
      const parsed = await streamPackageToStorage(blob);
      expect(parsed.channels).toHaveLength(2);
    });

    it('handles non-English locale (German: konto / nachrichten / server)', async () => {
      const blob = await buildFixturePackage({
        localeOverride: { account: 'konto', messages: 'nachrichten', servers: 'server' },
      });
      const parsed = await streamPackageToStorage(blob);
      expect(parsed.user.id).toBe('253286221395001345');
      expect(parsed.totalMessages).toBe(4);
    });

    it('handles current packages with bare {snowflake}/ channel dirs', async () => {
      const blob = await buildFixturePackage({ channelDirPrefix: 'none' });
      const parsed = await streamPackageToStorage(blob);
      expect(parsed.channels).toHaveLength(2);
      expect(parsed.totalMessages).toBe(4);
    });

    it('handles current packages with messages.json (post-2024-01-03)', async () => {
      const blob = await buildFixturePackage({ messagesFormat: 'json' });
      const parsed = await streamPackageToStorage(blob);
      expect(parsed.totalMessages).toBe(4);
      const ch200 = await storage.package.get<any[]>('pkg:msgs:253286221395001345:200');
      expect(ch200).toBeTruthy();
      expect(ch200!.length).toBe(3);
    });

    it('flags orphan channels (type 0 without guild)', async () => {
      const blob = await buildFixturePackage({ includeOrphanChannel: true });
      const parsed = await streamPackageToStorage(blob);
      const orphan = parsed.channels.find((c) => c.id === '400');
      expect(orphan?.isOrphan).toBe(true);
      expect(orphan?.guildId).toBeUndefined();
    });

    it('regression: disambiguates messages/ from servers/ when both have index.json', async () => {
      // The default fixture now ships both `servers/index.json` and
      // `messages/index.json` (matches Discord's current export format).
      // The sniff must pick the dir with channel-file children, not the
      // first dir whose name happens to have an index.json. Pre-fix this
      // returned 0 channels on the user's real-world dogfood package.
      const blob = await buildFixturePackage();
      const parsed = await streamPackageToStorage(blob);
      expect(parsed.channels.length).toBe(2);
      expect(parsed.totalMessages).toBe(4);
      // pkg:msgs:{userId}:{channelId} keys must exist for every channel.
      const ch200 = await storage.package.get('pkg:msgs:253286221395001345:200');
      expect(Array.isArray(ch200)).toBe(true);
      expect((ch200 as any[]).length).toBe(3);
    });

    it('skips activity directories at decompress-time (their bytes never enter memory)', async () => {
      const blob = await buildFixturePackage({ includeActivity: true });
      const parsed = await streamPackageToStorage(blob);

      // No activity-derived channels appear.
      expect(parsed.channels.every((c) => !c.id.startsWith('activity'))).toBe(true);
      // And no pkg:msgs key references an activity path.
      const allKeys = await storage.package.keys();
      const activityKeys = allKeys.filter((k) => k.toLowerCase().includes('activity'));
      expect(activityKeys).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws PackageParseError when account/user.json is missing', async () => {
      const blob = await buildFixturePackage({ omitUserJson: true });
      await expect(streamPackageToStorage(blob))
        .rejects.toBeInstanceOf(PackageParseError);
    });

    it('throws PackageParseError when account/user.json is malformed', async () => {
      const blob = await buildFixturePackage({ malformedUserJson: true });
      await expect(streamPackageToStorage(blob)).rejects.toThrow();
    });

    it('does not write a meta key when parse fails', async () => {
      const blob = await buildFixturePackage({ omitUserJson: true });
      try {
        await streamPackageToStorage(blob);
      } catch {
        /* expected */
      }
      const allKeys = await storage.package.keys();
      const metaKeys = allKeys.filter((k) => k.startsWith('pkg:meta:'));
      expect(metaKeys).toEqual([]);
    });

    it('rejects with PackageParseError on a non-ZIP input', async () => {
      const garbage = new Blob(['not a zip'], { type: 'application/octet-stream' });
      await expect(streamPackageToStorage(garbage))
        .rejects.toBeInstanceOf(PackageParseError);
    });
  });

  describe('compressed-size telemetry warning', () => {
    it('does not warn under 1 GiB compressed', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const blob = await buildFixturePackage();
      await streamPackageToStorage(blob);
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[packageStream]'),
      );
      consoleSpy.mockRestore();
    });

    it('warns when compressed size exceeds 1 GiB', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const blob = await buildFixturePackage();
      // Override the size getter to simulate a large compressed package
      // without actually building one. The streamer reads `file.size` for
      // the threshold check.
      Object.defineProperty(blob, 'size', { value: 2 * 1024 * 1024 * 1024 });

      await streamPackageToStorage(blob);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[packageStream]'),
      );
      consoleSpy.mockRestore();
    });
  });
});

describe('loadChannelMessagesFromStorage', () => {
  it('returns the messages written by streamPackageToStorage', async () => {
    const blob = await buildFixturePackage();
    await streamPackageToStorage(blob);

    const messages = await loadChannelMessagesFromStorage('253286221395001345', '200');
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBe(3);
  });

  it('throws PackageParseError when channelId is unknown', async () => {
    const blob = await buildFixturePackage();
    await streamPackageToStorage(blob);

    await expect(
      loadChannelMessagesFromStorage('253286221395001345', 'does-not-exist'),
    ).rejects.toBeInstanceOf(PackageParseError);
  });

  it('throws when the userId is wrong', async () => {
    const blob = await buildFixturePackage();
    await streamPackageToStorage(blob);

    await expect(
      loadChannelMessagesFromStorage('999999999999999999', '200'),
    ).rejects.toBeInstanceOf(PackageParseError);
  });
});

describe('resumePackageFromStorage', () => {
  it('returns the persisted metadata with a fresh blob URL', async () => {
    const blob = await buildFixturePackage({ includeAvatar: true });
    await streamPackageToStorage(blob);

    const resumed = await resumePackageFromStorage('253286221395001345');
    expect(resumed).toBeTruthy();
    expect(resumed!.user.id).toBe('253286221395001345');
    expect(resumed!.channels.length).toBe(2);
    expect(resumed!.avatarBlobUrl).toMatch(/^blob:/);
  });

  it('rebuilds the avatarBlobUrl on every call (not the same URL across resumes)', async () => {
    const blob = await buildFixturePackage({ includeAvatar: true });
    await streamPackageToStorage(blob);

    const a = await resumePackageFromStorage('253286221395001345');
    const b = await resumePackageFromStorage('253286221395001345');

    expect(a!.avatarBlobUrl).toMatch(/^blob:/);
    expect(b!.avatarBlobUrl).toMatch(/^blob:/);
    // jsdom + fake-indexeddb mints a distinct blob URL per createObjectURL
    // call, so the values are different even though the underlying bytes
    // are the same. This is the contract callers depend on.
    expect(a!.avatarBlobUrl).not.toBe(b!.avatarBlobUrl);
  });

  it('returns null when no package is stored for that user', async () => {
    const resumed = await resumePackageFromStorage('999999999999999999');
    expect(resumed).toBeNull();
  });

  it('survives reading after only meta + avatar exist (channel msgs lazy-loaded later)', async () => {
    const blob = await buildFixturePackage();
    await streamPackageToStorage(blob);

    const resumed = await resumePackageFromStorage('253286221395001345');
    expect(resumed!.channels.length).toBe(2);
    // Per-channel reads still work after resume, because pkg:msgs:* keys
    // are also persisted.
    const messages = await loadChannelMessagesFromStorage('253286221395001345', '200');
    expect(messages.length).toBe(3);
  });
});

describe('hasStoredPackage', () => {
  it('returns true after a successful stream', async () => {
    const blob = await buildFixturePackage();
    await streamPackageToStorage(blob);
    expect(await hasStoredPackage('253286221395001345')).toBe(true);
  });

  it('returns false for an unknown user', async () => {
    expect(await hasStoredPackage('999999999999999999')).toBe(false);
  });

  it('returns false after clearPackageContents wipes the user', async () => {
    const blob = await buildFixturePackage();
    await streamPackageToStorage(blob);
    await clearPackageContents('253286221395001345');
    expect(await hasStoredPackage('253286221395001345')).toBe(false);
  });
});

describe('clearPackageContents', () => {
  it('with userId: removes only that user\'s pkg:* keys', async () => {
    const blob = await buildFixturePackage({ includeAvatar: true });
    await streamPackageToStorage(blob);
    // Pre-seed a second user so we can assert isolation.
    await storage.package.set('pkg:meta:second-user', { user: { id: 'second-user' } });
    await storage.package.set('pkg:msgs:second-user:abc', [{ id: 'a' }]);
    await storage.package.set('pkg:avatar:second-user', new Uint8Array([1, 2, 3]));

    await clearPackageContents('253286221395001345');

    expect(await storage.package.get('pkg:meta:253286221395001345')).toBeNull();
    expect(await storage.package.get('pkg:msgs:253286221395001345:200')).toBeNull();
    expect(await storage.package.get('pkg:avatar:253286221395001345')).toBeNull();

    // The second user's data is intact.
    expect(await storage.package.get('pkg:meta:second-user')).toBeTruthy();
    expect(await storage.package.get('pkg:msgs:second-user:abc')).toBeTruthy();
    // Cross-realm Uint8Array — duck-type the byte count instead of instanceof.
    const secondAvatar = await storage.package.get<Uint8Array>('pkg:avatar:second-user');
    expect(secondAvatar).toBeTruthy();
    expect(secondAvatar!.length).toBe(3);
  });

  it('without userId: removes every pkg:* key except schema-version', async () => {
    const blob = await buildFixturePackage();
    await streamPackageToStorage(blob);
    await storage.package.set('pkg:meta:second-user', { user: { id: 'second-user' } });

    await clearPackageContents();

    const remaining = await storage.package.keys();
    expect(remaining.filter((k) => k.startsWith('pkg:') && k !== 'pkg:schema-version'))
      .toEqual([]);
    expect(remaining).toContain('pkg:schema-version');
  });

  it('does NOT touch the enriched: or deleted: namespaces', async () => {
    await storage.package.set('enriched:u:c', { foo: 1 });
    await storage.package.set('deleted:u', {});
    const blob = await buildFixturePackage();
    await streamPackageToStorage(blob);

    await clearPackageContents();

    expect(await storage.package.get('enriched:u:c')).toEqual({ foo: 1 });
    expect(await storage.package.get('deleted:u')).toEqual({});
  });
});
