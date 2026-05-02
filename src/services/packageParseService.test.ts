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

    it('parses a Simplified-Chinese package (账户/, 消息/, 服务器/)', async () => {
      // CJK characters have no notion of case, so .toLowerCase() is a
      // no-op on the index keys (correct behavior). Sniff identifies
      // dirs by content regardless of script. Pinning this so a future
      // refactor can't accidentally introduce Latin-only assumptions.
      const blob = await buildFixturePackage({
        localeOverride: { account: '账户', messages: '消息', servers: '服务器' },
        includeOrphanChannel: true,
      });
      const parsed = await parsePackageZip(blob);

      expect(parsed.user.id).toBe('253286221395001345');
      expect(parsed.guilds).toEqual([{ id: '100', name: 'Test Guild' }]);
      expect(parsed.channels.find((c) => c.id === '400')?.isOrphan).toBe(true);
      expect(parsed.totalMessages).toBe(5);
    });

    it('parses a Russian-locale package (аккаунт/, сообщения/, серверы/) including the lazy CSV path', async () => {
      // Cyrillic exercises the Unicode-aware lowercase path (Cyrillic
      // upper/lower exist, unlike CJK). Verifies the second per-call
      // sniff inside loadChannelMessages also handles non-Latin.
      const blob = await buildFixturePackage({
        localeOverride: { account: 'аккаунт', messages: 'сообщения', servers: 'серверы' },
      });
      const parsed = await parsePackageZip(blob);
      expect(parsed.user.id).toBe('253286221395001345');
      expect(parsed.totalMessages).toBe(4);

      const rows = await loadChannelMessages(blob, '200');
      expect(rows).toHaveLength(3);
    });
  });

  // ─── Backlog #158: ZIP64 archives are readable post-fflate-swap ──────
  describe('ZIP64 archives (Backlog #158)', () => {
    // A real ZIP64 archive built externally with Python's `zipfile`
    // (allowZip64=True) and post-processed to inject a ZIP64 EOCD
    // record + ZIP64 EOCD locator + sentinel-bearing regular EOCD.
    // Contains a minimal Discord-shaped layout: account/user.json,
    // servers/100/guild.json, messages/index.json, c200 channel.json
    // and messages.csv. JSZip would have thrown "expected N records in
    // central dir, got 0" on this archive (Stuk/jszip#922); fflate
    // reads it natively. See `backlog_jszip_zip64_swap.md` for the
    // full motivation and the fixture-generation script.
    const ZIP64_FIXTURE_BASE64 =
      'UEsDBBQAAAAAABG7olzsros7IgAAACIAAAARAAAAYWNjb3VudC91c2VyLmpzb257ImlkIjoiOTkiLCJ1c2VybmFtZSI6InppcDY0dXNlciJ9UEsDBBQAAAAAABG7olzIBMGgIQAAACEAAAAWAAAAc2VydmVycy8xMDAvZ3VpbGQuanNvbnsiaWQiOiIxMDAiLCJuYW1lIjoiWklQNjQgR3VpbGQifVBLAwQUAAAAAAARu6JczPhd3hEAAAARAAAAEwAAAG1lc3NhZ2VzL2luZGV4Lmpzb257IjIwMCI6ImdlbmVyYWwifVBLAwQUAAAAAAARu6JcFgJxT1AAAABQAAAAGgAAAG1lc3NhZ2VzL2MyMDAvY2hhbm5lbC5qc29ueyJpZCI6IjIwMCIsInR5cGUiOjAsIm5hbWUiOiJnZW5lcmFsIiwiZ3VpbGQiOnsiaWQiOiIxMDAiLCJuYW1lIjoiWklQNjQgR3VpbGQifX1QSwMEFAAAAAAAEbuiXLlKyZpIAAAASAAAABoAAABtZXNzYWdlcy9jMjAwL21lc3NhZ2VzLmNzdklELFRpbWVzdGFtcCxDb250ZW50cyxBdHRhY2htZW50cwoxLDIwMjYtMDEtMDEgMDA6MDA6MDAuMDAwMDAwKzAwOjAwLGhpLFBLAQIUAxQAAAAAABG7olzsros7IgAAACIAAAARAAAAAAAAAAAAAACAAQAAAABhY2NvdW50L3VzZXIuanNvblBLAQIUAxQAAAAAABG7olzIBMGgIQAAACEAAAAWAAAAAAAAAAAAAACAAVEAAABzZXJ2ZXJzLzEwMC9ndWlsZC5qc29uUEsBAhQDFAAAAAAAEbuiXMz4Xd4RAAAAEQAAABMAAAAAAAAAAAAAAIABpgAAAG1lc3NhZ2VzL2luZGV4Lmpzb25QSwECFAMUAAAAAAARu6JcFgJxT1AAAABQAAAAGgAAAAAAAAAAAAAAgAHoAAAAbWVzc2FnZXMvYzIwMC9jaGFubmVsLmpzb25QSwECFAMUAAAAAAARu6JcuUrJmkgAAABIAAAAGgAAAAAAAAAAAAAAgAFwAQAAbWVzc2FnZXMvYzIwMC9tZXNzYWdlcy5jc3ZQSwYGLAAAAAAAAAAtAC0AAAAAAAAAAAAFAAAAAAAAAAUAAAAAAAAAVAEAAAAAAADwAQAAAAAAAFBLBgcAAAAARAMAAAAAAAABAAAAUEsFBgAAAAD/////VAEAAPABAAAAAA==';

    function makeBlobFromBase64(b64: string): Blob {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes as BlobPart]);
    }

    it('parses a ZIP64 archive (regression guard for the #158 swap)', async () => {
      const blob = makeBlobFromBase64(ZIP64_FIXTURE_BASE64);
      const parsed = await parsePackageZip(blob);

      expect(parsed.user.id).toBe('99');
      expect(parsed.user.username).toBe('zip64user');
      expect(parsed.guilds).toEqual([{ id: '100', name: 'ZIP64 Guild' }]);
      expect(parsed.channels.find((c) => c.id === '200')?.guildName).toBe('ZIP64 Guild');
      expect(parsed.totalMessages).toBe(1);
    });

    it('lazily reads a channel CSV from a ZIP64 archive', async () => {
      const blob = makeBlobFromBase64(ZIP64_FIXTURE_BASE64);
      const rows = await loadChannelMessages(blob, '200');
      expect(rows).toHaveLength(1);
      expect(rows[0].content).toBe('hi');
    });

    it('the fixture actually contains ZIP64 markers (sanity check on the test, not the parser)', () => {
      // Decode the base64 directly — skip the Blob roundtrip so the
      // sanity check works in jsdom (which lacks `blob.arrayBuffer`).
      const bin = atob(ZIP64_FIXTURE_BASE64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      // Search for ZIP64 EOCD signature 0x06064B50 (LE: 50 4B 06 06)
      // and the ZIP64 EOCD Locator 0x07064B50 (LE: 50 4B 06 07).
      let foundZ64Eocd = false;
      let foundZ64Locator = false;
      for (let i = 0; i < bytes.length - 4; i++) {
        if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b) {
          if (bytes[i + 2] === 0x06 && bytes[i + 3] === 0x06) foundZ64Eocd = true;
          if (bytes[i + 2] === 0x06 && bytes[i + 3] === 0x07) foundZ64Locator = true;
        }
      }
      expect(foundZ64Eocd).toBe(true);
      expect(foundZ64Locator).toBe(true);
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
