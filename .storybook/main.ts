import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal(config) {
    return mergeConfig(config, {
      define: {
        // Strip Discord token from Storybook builds to prevent token leakage
        'import.meta.env.VITE_DISCORD_TOKEN': JSON.stringify(''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '../src'),
          '@components': path.resolve(__dirname, '../src/components'),
          '@features': path.resolve(__dirname, '../src/features'),
          '@services': path.resolve(__dirname, '../src/services'),
          '@theme': path.resolve(__dirname, '../src/theme'),
          '@utils': path.resolve(__dirname, '../src/utils'),
          '@containers': path.resolve(__dirname, '../src/containers'),
        },
        preserveSymlinks: false,
      },
      optimizeDeps: {
        include: [
          'discrub-core/discrub-enum',
          'discrub-core/common-enum',
          'discrub-core/discord-enum',
          'discrub-core/html-formatting-utils',
          'discrub-core/discrub-utils',
          'discrub-core/common-utils',
          'discrub-core/discrub-guards',
          'discrub-core/common-guards',
          'discrub-core/filtering',
          'discrub-core/constants',
          'discrub-core/messages',
          'discrub-core/regex',
          'discrub-core/export-utils',
          'discrub-core/message-formatting-utils',
        ],
      },
    });
  },
};
export default config;
