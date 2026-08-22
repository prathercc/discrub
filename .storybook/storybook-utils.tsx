import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
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

const reducer = {
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
};

export function createMockStore(preloadedState?: any) {
  return configureStore({ reducer: reducer as any, preloadedState });
}

/**
 * Creates a Storybook decorator that wraps the story in a Redux Provider
 * with the given preloaded state, plus MUI ThemeProvider.
 */
export function withStoreDecorator(preloadedState: any) {
  return (Story: React.ComponentType) => {
    const store = createMockStore(preloadedState);
    return (
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Story />
        </ThemeProvider>
      </Provider>
    );
  };
}
