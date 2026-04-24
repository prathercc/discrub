import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function launcherVersion(replacements: Record<string, string>): Plugin {
  const patterns = Object.entries(replacements).map(
    ([token, value]) => [new RegExp(escapeRegExp(token), 'g'), value] as const,
  );

  const substitute = (content: string) =>
    patterns.reduce((acc, [pattern, value]) => acc.replace(pattern, value), content);

  let publicDir = '';

  return {
    name: 'launcher-version-substitute',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/launcher.html') return next();
        const sourceFile = path.resolve(publicDir, 'launcher.html');
        if (!existsSync(sourceFile)) return next();
        const content = substitute(readFileSync(sourceFile, 'utf8'));
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(content);
      });
    },
    writeBundle(options) {
      if (!options.dir) return;
      const outFile = path.resolve(options.dir, 'launcher.html');
      if (!existsSync(outFile)) return;
      writeFileSync(outFile, substitute(readFileSync(outFile, 'utf8')));
    },
  };
}
