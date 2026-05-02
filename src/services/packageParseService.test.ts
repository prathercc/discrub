import { describe, it, expect } from 'vitest';
import {
  loadChannelMessages,
  PackageParseError,
  parsePackageZip,
  validatePackage,
} from './packageParseService';
import { buildFixturePackage } from '@/test/package-fixtures';

describe('parsePackageZip', () => {
  it('parses a valid minimal package', async () => {
    const blob = await buildFixturePackage();
    const parsed = await parsePackageZip(blob);

    expect(parsed.user.id).toBe('253286221395001345');
    expect(parsed.user.username).toBe('prathercc');
    expect(parsed.user.globalName).toBe('Aaron');
    expect(parsed.guilds).toEqual([{ id: '100', name: 'Test Guild' }]);
    expect(parsed.channels).toHaveLength(2);
    expect(parsed.totalMessages).toBe(4);
  });

  it('populates guild metadata for guild text channels', async () => {
    const blob = await buildFixturePackage();
    const parsed = await parsePackageZip(blob);

    const general = parsed.channels.find((c) => c.id === '200');
    expect(general?.guildId).toBe('100');
    expect(general?.guildName).toBe('Test Guild');
    expect(general?.isOrphan).toBe(false);
  });

  it('flags orphan channels (type 0 without guild)', async () => {
    const blob = await buildFixturePackage({ includeOrphanChannel: true });
    const parsed = await parsePackageZip(blob);

    const orphan = parsed.channels.find((c) => c.id === '400');
    expect(orphan?.isOrphan).toBe(true);
    expect(orphan?.guildId).toBeUndefined();
  });

  it('exposes recipients for DMs and group DMs', async () => {
    const blob = await buildFixturePackage({ includeGroupDm: true });
    const parsed = await parsePackageZip(blob);

    const dm = parsed.channels.find((c) => c.id === '300');
    expect(dm?.type).toBe(1);
    expect(dm?.recipients).toEqual(['253286221395001345', '999']);

    const group = parsed.channels.find((c) => c.id === '500');
    expect(group?.type).toBe(3);
    expect(group?.recipients).toHaveLength(3);
  });

  it('skips activity directories entirely', async () => {
    const blob = await buildFixturePackage({ includeActivity: true });
    const parsed = await parsePackageZip(blob);

    // Activity dirs don't create channel entries and don't raise.
    expect(parsed.channels.every((c) => !c.id.startsWith('activity'))).toBe(true);
  });

  it('transparently handles a single top-level wrapper directory', async () => {
    const blob = await buildFixturePackage({
      wrapperDir: 'Discord Data Package - prathercc',
    });
    const parsed = await parsePackageZip(blob);

    expect(parsed.user.id).toBe('253286221395001345');
    expect(parsed.channels.length).toBeGreaterThan(0);
    expect(parsed.totalMessages).toBe(4);
  });

  it('loads a wrapped channel CSV lazily', async () => {
    const blob = await buildFixturePackage({
      wrapperDir: 'Discord Data Package - prathercc',
    });
    // Work around Blob lacking arrayBuffer() in jsdom for File construction:
    const rows = await loadChannelMessages(blob, '200');
    expect(rows).toHaveLength(3);
  });

  it('parses a package with capitalized top-level directories', async () => {
    // Real Discord exports sometimes ship with `Account/`, `Messages/`,
    // `Servers/` instead of lowercase. Reported by user on 2.0.2 (#146).
    const blob = await buildFixturePackage({
      capitalizeTopDirs: true,
      includeOrphanChannel: true,
      includeGroupDm: true,
    });
    const parsed = await parsePackageZip(blob);

    expect(parsed.user.id).toBe('253286221395001345');
    expect(parsed.user.username).toBe('prathercc');
    expect(parsed.guilds).toEqual([{ id: '100', name: 'Test Guild' }]);
    expect(parsed.channels.find((c) => c.id === '200')?.guildName).toBe('Test Guild');
    expect(parsed.channels.find((c) => c.id === '300')?.recipients).toEqual([
      '253286221395001345',
      '999',
    ]);
    expect(parsed.channels.find((c) => c.id === '400')?.isOrphan).toBe(true);
    expect(parsed.totalMessages).toBe(5);
  });

  it('handles capitalized dirs combined with a wrapper directory', async () => {
    const blob = await buildFixturePackage({
      capitalizeTopDirs: true,
      wrapperDir: 'Discord Data Package - prathercc',
    });
    const parsed = await parsePackageZip(blob);

    expect(parsed.user.id).toBe('253286221395001345');
    expect(parsed.totalMessages).toBe(4);
  });

  it('loads a capitalized-dirs channel CSV via loadChannelMessages', async () => {
    const blob = await buildFixturePackage({ capitalizeTopDirs: true });
    const rows = await loadChannelMessages(blob, '200');
    expect(rows).toHaveLength(3);
  });

  // ─── Backlog #157: locale-aware structural directory resolution ─────
  describe('non-English locale packages (Backlog #157)', () => {
    it('parses a French-locale package (compte/, messages/, serveurs/)', async () => {
      // French-locale Discord exports rename the account + servers dirs
      // but keep `messages/` (Discord's own dir name happens to match the
      // English word in French too). Sniff phase identifies dirs by
      // content, not name.
      const blob = await buildFixturePackage({
        localeOverride: { account: 'compte', servers: 'serveurs' },
        includeOrphanChannel: true,
        includeGroupDm: true,
      });
      const parsed = await parsePackageZip(blob);

      expect(parsed.user.id).toBe('253286221395001345');
      expect(parsed.user.username).toBe('prathercc');
      expect(parsed.guilds).toEqual([{ id: '100', name: 'Test Guild' }]);
      expect(parsed.channels.find((c) => c.id === '200')?.guildName).toBe('Test Guild');
      expect(parsed.channels.find((c) => c.id === '400')?.isOrphan).toBe(true);
      expect(parsed.totalMessages).toBe(5);
    });

    it('parses a German-locale package (konto/, nachrichten/, server/)', async () => {
      const blob = await buildFixturePackage({
        localeOverride: { account: 'konto', messages: 'nachrichten', servers: 'server' },
      });
      const parsed = await parsePackageZip(blob);

      expect(parsed.user.username).toBe('prathercc');
      expect(parsed.guilds).toHaveLength(1);
      expect(parsed.channels).toHaveLength(2);
      expect(parsed.totalMessages).toBe(4);
    });

    it('loads a non-English channel CSV via loadChannelMessages', async () => {
      // Verifies that the lazy CSV-reader path (NOT the parse path) also
      // sniffs structure correctly — loadChannelMessages opens a fresh zip
      // per call so it can't piggyback on a sniff cached during parse.
      const blob = await buildFixturePackage({
        localeOverride: { account: 'cuenta', messages: 'mensajes', servers: 'servidores' },
      });
      const rows = await loadChannelMessages(blob, '200');
      expect(rows).toHaveLength(3);
    });

    it('handles a non-English wrapper-dir + locale combo', async () => {
      // Wrapper + locale together — sniff must find compte/user.json at
      // depth 2 inside the wrapper, then locate serveurs/ and messages/
      // as siblings under the same prefix.
      const blob = await buildFixturePackage({
        wrapperDir: 'Paquet de Données Discord - prathercc',
        localeOverride: { account: 'compte', servers: 'serveurs' },
      });
      const parsed = await parsePackageZip(blob);

      expect(parsed.user.id).toBe('253286221395001345');
      expect(parsed.guilds).toHaveLength(1);
      expect(parsed.totalMessages).toBe(4);
    });

    it('handles non-English + capitalized + wrapper all at once', async () => {
      // Worst-case fixture: capitalized non-English dirs (`Compte/`,
      // `Nachrichten/`, `Server/`) inside a wrapper. Case-folding (#146)
      // and locale sniffing (#157) compose without interference.
      const blob = await buildFixturePackage({
        capitalizeTopDirs: true,
        wrapperDir: 'Discord Data',
        localeOverride: { account: 'konto', messages: 'nachrichten', servers: 'server' },
      });
      const parsed = await parsePackageZip(blob);

      expect(parsed.user.id).toBe('253286221395001345');
      expect(parsed.totalMessages).toBe(4);
    });
  });

  it('throws on missing account/user.json', async () => {
    const blob = await buildFixturePackage({ omitUserJson: true });
    await expect(parsePackageZip(blob)).rejects.toBeInstanceOf(PackageParseError);
  });

  it('throws on malformed account/user.json', async () => {
    const blob = await buildFixturePackage({ malformedUserJson: true });
    await expect(parsePackageZip(blob)).rejects.toThrow();
  });

  it('sorts channels by message count descending', async () => {
    const blob = await buildFixturePackage({ includeOrphanChannel: true });
    const parsed = await parsePackageZip(blob);

    const counts = parsed.channels.map((c) => c.messageCount);
    const sorted = [...counts].sort((a, b) => b - a);
    expect(counts).toEqual(sorted);
  });

  it('counts messages correctly when CSV contains quoted newlines', async () => {
    const blob = await buildFixturePackage();
    const parsed = await parsePackageZip(blob);

    const general = parsed.channels.find((c) => c.id === '200');
    expect(general?.messageCount).toBe(3);
  });
});

describe('loadChannelMessages', () => {
  it('returns parsed PackageMessage rows for a channel', async () => {
    const blob = await buildFixturePackage();
    const rows = await loadChannelMessages(blob, '200');

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ id: '1', content: 'hello', attachment: null });
    expect(rows[1].content).toBe('with, comma');
    expect(rows[2].content).toBe('multi\nline');
  });

  it('throws when CSV is missing', async () => {
    const blob = await buildFixturePackage();
    await expect(loadChannelMessages(blob, '99999')).rejects.toBeInstanceOf(
      PackageParseError,
    );
  });
});

describe('validatePackage', () => {
  it('returns full-access when authenticated user ID matches', async () => {
    const blob = await buildFixturePackage();
    const parsed = await parsePackageZip(blob);
    const result = validatePackage(parsed, '253286221395001345');

    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(false);
    expect(result.errors).toEqual([]);
  });

  it('returns read-only with a warning when auth is null', async () => {
    const blob = await buildFixturePackage();
    const parsed = await parsePackageZip(blob);
    const result = validatePackage(parsed, null);

    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns read-only with a warning when user ID mismatches', async () => {
    const blob = await buildFixturePackage({ userId: 'abc' });
    const parsed = await parsePackageZip(blob);
    const result = validatePackage(parsed, 'xyz');

    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(true);
    expect(result.warnings[0]).toMatch(/different user/i);
  });
});
