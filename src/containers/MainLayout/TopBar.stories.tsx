import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import theme from '@theme/theme';
import authReducer from '@features/auth/authSlice';
import userReducer from '@features/user/userSlice';
import appReducer from '@features/app/appSlice';
import guildReducer from '@features/guild/guildSlice';
import channelReducer from '@features/channel/channelSlice';
import dmReducer from '@features/dm/dmSlice';
import messageReducer from '@features/message/messageSlice';
import exportReducer from '@features/export/exportSlice';
import cacheReducer from '@features/cache/cacheSlice';
import TopBar from './TopBar';

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
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createStore(preloadedState?: any) {
  return configureStore({ reducer: reducer as any, preloadedState });
}

const mockUser = {
  id: '123456789',
  username: 'DiscordUser',
  discriminator: '1234',
  avatar: null,
  bot: false,
  system: false,
  global_name: 'Discord User',
};

const meta: Meta<typeof TopBar> = {
  title: 'Containers/TopBar',
  component: TopBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

type Story = StoryObj<typeof TopBar>;

export const LoggedOut: Story = {};

export const LoggedIn: Story = {
  decorators: [
    (Story) => {
      const store = createStore({
        user: {
          currentUser: mockUser,
          loading: false,
          error: null,
        },
      });
      return (
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <Story />
          </ThemeProvider>
        </Provider>
      );
    },
  ],
};

export const OverlayMode: Story = {
  decorators: [
    (Story) => {
      const store = createStore({
        user: {
          currentUser: mockUser,
          loading: false,
          error: null,
        },
      });
      return (
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <p style={{ color: '#999', padding: '8px 16px', margin: 0, fontSize: 12 }}>
              Note: Minimize and Close buttons only appear in extension overlay mode.
              They are hidden here because Storybook runs in browser context.
            </p>
            <Story />
          </ThemeProvider>
        </Provider>
      );
    },
  ],
};

export const OperationRunning: Story = {
  decorators: [
    (Story) => {
      const store = createStore({
        user: {
          currentUser: mockUser,
          loading: false,
          error: null,
        },
        export: {
          isExporting: true,
          exportProgress: { stage: 'attachments', current: 45, total: 100 },
          exportTotal: 100,
          currentPage: 1,
          totalPages: 5,
          exportError: null,
          exportFormat: 'html',
          messagesPerPage: 100,
          separateThreads: false,
          includeMedia: true,
        },
      });
      return (
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <p style={{ color: '#999', padding: '8px 16px', margin: 0, fontSize: 12 }}>
              Export in progress — close dialog will show "Operation in Progress" warning.
            </p>
            <Story />
          </ThemeProvider>
        </Provider>
      );
    },
  ],
};
