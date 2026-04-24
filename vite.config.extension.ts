import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { launcherVersion } from './scripts/vite-launcher-version';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
const classicManifest = JSON.parse(
  readFileSync(resolve(__dirname, 'public/classic-chrome/manifest.json'), 'utf8'),
);

export default defineConfig(({ mode }) => {
  const isFirefox = mode === 'firefox';
  const outDir = isFirefox ? 'dist-extension-firefox' : 'dist-extension-chrome';

  return {
    plugins: [
      react(),
      launcherVersion({
        __APP_VERSION__: pkg.version,
        __CLASSIC_VERSION__: classicManifest.version,
      }),
    ],

    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@features': resolve(__dirname, 'src/features'),
        '@components': resolve(__dirname, 'src/components'),
        '@services': resolve(__dirname, 'src/services'),
        '@utils': resolve(__dirname, 'src/utils'),
        '@containers': resolve(__dirname, 'src/containers'),
        '@theme': resolve(__dirname, 'src/theme'),
      },
    },

    build: {
      outDir,
      emptyOutDir: true,

      rollupOptions: {
        input: {
          // Main extension page
          index: resolve(__dirname, 'index.html'),

          // Extension scripts
          content: resolve(__dirname, 'src/extension/content.ts'),
          background: resolve(__dirname, 'src/extension/background.ts'),
        },

        output: {
          entryFileNames: (chunkInfo) => {
            // Extension scripts go in root
            if (chunkInfo.name === 'content' || chunkInfo.name === 'background') {
              return '[name].js';
            }
            // App chunks go in assets/
            return 'assets/[name]-[hash].js';
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },

      // Smaller chunks for extension size limits
      chunkSizeWarningLimit: 1000,
    },

    define: {
      '__APP_VERSION__': JSON.stringify(pkg.version),
      'import.meta.env.EXTENSION_MODE': JSON.stringify(true),
      'import.meta.env.BROWSER': JSON.stringify(isFirefox ? 'firefox' : 'chrome'),
      'import.meta.env.VITE_DISCORD_TOKEN': JSON.stringify(''),
    },
  };
});
