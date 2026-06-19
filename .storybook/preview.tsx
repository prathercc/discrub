import React from 'react';
import type { Preview } from '@storybook/react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, GlobalStyles } from '@mui/material';
import globalStyles from '../src/theme/globalStyles';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { darkTheme, lightTheme } from '../src/theme/theme';
import authReducer from '../src/features/auth/authSlice';
import userReducer from '../src/features/user/userSlice';
import appReducer from '../src/features/app/appSlice';
import guildReducer from '../src/features/guild/guildSlice';
import channelReducer from '../src/features/channel/channelSlice';
import dmReducer from '../src/features/dm/dmSlice';
import messageReducer from '../src/features/message/messageSlice';
import exportReducer from '../src/features/export/exportSlice';
import cacheReducer from '../src/features/cache/cacheSlice';
import statusReducer from '../src/features/status/statusSlice';
import purgeReducer from '../src/features/purge/purgeSlice';
import announcementReducer from '../src/features/announcement/announcementSlice';
import presetsReducer from '../src/features/presets/presetsSlice';
import historyReducer from '../src/features/history/historySlice';
import packageReducer from '../src/features/package/packageSlice';
import hotkeysReducer from '../src/features/hotkeys/hotkeysSlice';
import devReducer from '../src/features/dev/devSlice';

function createMockStore(preloadedState?: any) {
  return configureStore({
    reducer: {
      auth: authReducer,
      user: userReducer,
      app: appReducer,
      guild: guildReducer,
      channel: channelReducer,
      dm: dmReducer,
      message: messageReducer,
      export: exportReducer,
      cache: cacheReducer,
      status: statusReducer,
      purge: purgeReducer,
      announcement: announcementReducer,
      presets: presetsReducer,
      history: historyReducer,
      package: packageReducer,
      hotkeys: hotkeysReducer,
      dev: devReducer,
    },
    preloadedState,
  });
}

// #147 Phase 3: a toolbar theme switch gives every story a light-mode view
// without per-story light variants. Defaults to dark (the app's default).
const globalTypes = {
  theme: {
    name: 'Theme',
    description: 'App color theme',
    defaultValue: 'dark',
    toolbar: {
      icon: 'paintbrush',
      items: [
        { value: 'dark', title: 'Dark' },
        { value: 'light', title: 'Light' },
      ],
      dynamicTitle: true,
    },
  },
};

const preview: Preview = {
  globalTypes,
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'discord-dark',
      values: [
        { name: 'discord-dark', value: '#1e2124' },
        { name: 'discord-panel', value: '#282b30' },
        { name: 'white', value: '#ffffff' },
      ],
    },
  },
  decorators: [
    (Story, context) => {
      const store = createMockStore();
      const isLight = context.globals.theme === 'light';
      const activeTheme = isLight ? lightTheme : darkTheme;
      return (
        <Provider store={store}>
          <ThemeProvider theme={activeTheme}>
            <CssBaseline />
            <GlobalStyles styles={globalStyles} />
            <div style={{ background: activeTheme.palette.background.default, minHeight: '100vh', padding: 16 }}>
              <Story />
            </div>
          </ThemeProvider>
        </Provider>
      );
    },
  ],
};

export default preview;
