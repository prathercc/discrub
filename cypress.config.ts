import { defineConfig } from 'cypress';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    setupNodeEvents(on, config) {
      const downloadsDir = config.downloadsFolder;

      const listDownloads = () => {
        if (!fs.existsSync(downloadsDir)) return [];
        return fs
          .readdirSync(downloadsDir)
          .filter((name) => !name.endsWith('.crdownload'))
          .map((name) => ({
            name,
            size: fs.statSync(path.join(downloadsDir, name)).size,
          }));
      };

      const resolveDownload = (fileName: string) => {
        const resolved = path.resolve(downloadsDir, fileName);
        if (!resolved.startsWith(path.resolve(downloadsDir) + path.sep)) {
          throw new Error(`Refusing to read outside downloads folder: ${fileName}`);
        }
        return resolved;
      };

      on('task', {
        'downloads:list': () => listDownloads(),

        'downloads:clean': () => {
          if (fs.existsSync(downloadsDir)) {
            for (const name of fs.readdirSync(downloadsDir)) {
              fs.rmSync(path.join(downloadsDir, name), { force: true });
            }
          }
          return null;
        },

        // Zip entry listing via the system unzip(1): returns
        // [{ name, size, date, time }] for every entry in the archive.
        'zip:list': (fileName: string) => {
          const zipPath = resolveDownload(fileName);
          const out = execFileSync('unzip', ['-l', '-qq', zipPath], {
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
          });
          // unzip -l -qq rows: "   size  MM-DD-YYYY HH:MM   entry/name"
          return out
            .split('\n')
            .map((line) => line.match(/^\s*(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/))
            .filter((m): m is RegExpMatchArray => m !== null)
            .map((m) => ({
              size: Number(m[1]),
              date: m[2],
              time: m[3],
              name: m[4],
            }));
        },

        // Extract a single entry's content as UTF-8 text.
        'zip:read': ({ fileName, entry }: { fileName: string; entry: string }) => {
          const zipPath = resolveDownload(fileName);
          return execFileSync('unzip', ['-p', zipPath, entry], {
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024,
          });
        },
      });

      return config;
    },
  },
});
