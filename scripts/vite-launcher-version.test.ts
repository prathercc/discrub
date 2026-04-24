import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { launcherVersion } from './vite-launcher-version';

describe('launcherVersion vite plugin', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'launcher-ver-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('writeBundle (build)', () => {
    it('substitutes a single placeholder in the copied launcher.html', () => {
      const launcherFile = path.join(tmpDir, 'launcher.html');
      writeFileSync(
        launcherFile,
        '<option>Discrub v__APP_VERSION__</option>',
        'utf8'
      );

      const plugin = launcherVersion({ __APP_VERSION__: '9.9.9' });
      (plugin.writeBundle as any).call(null, { dir: tmpDir });

      const result = readFileSync(launcherFile, 'utf8');
      expect(result).toContain('Discrub v9.9.9');
      expect(result).not.toContain('__APP_VERSION__');
    });

    it('substitutes multiple distinct placeholders', () => {
      const launcherFile = path.join(tmpDir, 'launcher.html');
      writeFileSync(
        launcherFile,
        '<option>Discrub v__APP_VERSION__</option>\n' +
          '<option>Discrub v__CLASSIC_VERSION__ (Classic)</option>',
        'utf8'
      );

      const plugin = launcherVersion({
        __APP_VERSION__: '2.0.1',
        __CLASSIC_VERSION__: '1.12.11',
      });
      (plugin.writeBundle as any).call(null, { dir: tmpDir });

      const result = readFileSync(launcherFile, 'utf8');
      expect(result).toContain('Discrub v2.0.1');
      expect(result).toContain('Discrub v1.12.11 (Classic)');
      expect(result).not.toContain('__APP_VERSION__');
      expect(result).not.toContain('__CLASSIC_VERSION__');
    });

    it('replaces every occurrence of a token', () => {
      const launcherFile = path.join(tmpDir, 'launcher.html');
      writeFileSync(
        launcherFile,
        'v__APP_VERSION__ — label __APP_VERSION__ repeated',
        'utf8'
      );

      const plugin = launcherVersion({ __APP_VERSION__: '2.0.1' });
      (plugin.writeBundle as any).call(null, { dir: tmpDir });

      expect(readFileSync(launcherFile, 'utf8')).toBe(
        'v2.0.1 — label 2.0.1 repeated'
      );
    });

    it('no-ops when launcher.html is not present in the output directory', () => {
      const plugin = launcherVersion({ __APP_VERSION__: '1.0.0' });
      expect(() => {
        (plugin.writeBundle as any).call(null, { dir: tmpDir });
      }).not.toThrow();
    });

    it('no-ops when output options have no dir', () => {
      const plugin = launcherVersion({ __APP_VERSION__: '1.0.0' });
      expect(() => {
        (plugin.writeBundle as any).call(null, {});
      }).not.toThrow();
    });

    it('leaves content unchanged when no tokens are present', () => {
      const launcherFile = path.join(tmpDir, 'launcher.html');
      const original = '<html><body>No placeholder here</body></html>';
      writeFileSync(launcherFile, original, 'utf8');

      const plugin = launcherVersion({ __APP_VERSION__: '5.5.5' });
      (plugin.writeBundle as any).call(null, { dir: tmpDir });

      expect(readFileSync(launcherFile, 'utf8')).toBe(original);
    });
  });

  describe('configureServer (dev)', () => {
    const buildFakeServer = () => {
      const handlers: Array<(req: any, res: any, next: () => void) => void> = [];
      return {
        middlewares: {
          use: (handler: (req: any, res: any, next: () => void) => void) => {
            handlers.push(handler);
          },
        },
        invoke: (req: any, res: any, next: () => void) => {
          handlers[0]?.(req, res, next);
        },
      };
    };

    const callConfigResolved = (plugin: ReturnType<typeof launcherVersion>) => {
      (plugin.configResolved as any).call(null, { publicDir: tmpDir });
    };

    it('serves substituted launcher.html with both tokens resolved on /launcher.html', () => {
      writeFileSync(
        path.join(tmpDir, 'launcher.html'),
        '<option>Discrub v__APP_VERSION__</option>' +
          '<option>Discrub v__CLASSIC_VERSION__ (Classic)</option>',
        'utf8'
      );

      const plugin = launcherVersion({
        __APP_VERSION__: '3.3.3',
        __CLASSIC_VERSION__: '1.12.11',
      });
      callConfigResolved(plugin);
      const server = buildFakeServer();
      (plugin.configureServer as any).call(null, server);

      const res = { setHeader: vi.fn(), end: vi.fn() };
      const next = vi.fn();

      server.invoke({ url: '/launcher.html' }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html; charset=utf-8'
      );
      expect(res.end).toHaveBeenCalledWith(
        '<option>Discrub v3.3.3</option><option>Discrub v1.12.11 (Classic)</option>'
      );
    });

    it('passes through to next middleware for any other URL', () => {
      writeFileSync(
        path.join(tmpDir, 'launcher.html'),
        '<option>v__APP_VERSION__</option>',
        'utf8'
      );

      const plugin = launcherVersion({ __APP_VERSION__: '1.0.0' });
      callConfigResolved(plugin);
      const server = buildFakeServer();
      (plugin.configureServer as any).call(null, server);

      const next = vi.fn();
      server.invoke({ url: '/index.html' }, { setHeader: vi.fn(), end: vi.fn() }, next);

      expect(next).toHaveBeenCalled();
    });

    it('strips query strings before matching /launcher.html', () => {
      writeFileSync(
        path.join(tmpDir, 'launcher.html'),
        'v__APP_VERSION__',
        'utf8'
      );

      const plugin = launcherVersion({ __APP_VERSION__: '4.4.4' });
      callConfigResolved(plugin);
      const server = buildFakeServer();
      (plugin.configureServer as any).call(null, server);

      const res = { setHeader: vi.fn(), end: vi.fn() };
      const next = vi.fn();

      server.invoke({ url: '/launcher.html?t=1' }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.end).toHaveBeenCalledWith('v4.4.4');
    });

    it('falls through when launcher.html is missing from publicDir', () => {
      const plugin = launcherVersion({ __APP_VERSION__: '1.0.0' });
      callConfigResolved(plugin);
      const server = buildFakeServer();
      (plugin.configureServer as any).call(null, server);

      const res = { setHeader: vi.fn(), end: vi.fn() };
      const next = vi.fn();

      server.invoke({ url: '/launcher.html' }, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.end).not.toHaveBeenCalled();
    });
  });
});
