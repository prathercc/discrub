import React from 'react';
import type { Preview } from '@storybook/react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, GlobalStyles } from '@mui/material';
import globalStyles from '../src/theme/globalStyles';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import theme from '../src/theme/theme';
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
    },
    preloadedState,
  });
}

const preview: Preview = {
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
    (Story) => {
      const store = createMockStore();
      return (
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <GlobalStyles styles={globalStyles} />
            <Story />
          </ThemeProvider>
        </Provider>
      );
    },
  ],
};

export default preview;
