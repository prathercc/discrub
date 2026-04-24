import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import theme from '@theme/theme';
import { createMockStore } from '../../../.storybook/storybook-utils';
import { initialMessageState, initialPaginationState } from '@features/message/messageTypes';
import ThreadTabBar from './ThreadTabBar';

const makeThreadTab = (id: string, name: string) => ({
  threadId: id,
  threadName: name,
  messages: [],
  filteredMessages: [],
  selectedMessages: [],
  searchCriteria: null,
  order: initialMessageState.order,
  isLoading: false,
  error: null,
  pagination: { ...initialPaginationState },
});

const meta: Meta<typeof ThreadTabBar> = {
  title: 'Message/ThreadTabBar',
  component: ThreadTabBar,
};

export default meta;

type Story = StoryObj<typeof ThreadTabBar>;

export const MainTabOnly: Story = {
  decorators: [
    (Story) => {
      const store = createMockStore({
        message: {
          ...initialMessageState,
          activeTab: null,
          threadTabs: { 't1': makeThreadTab('t1', 'Bug Discussion') },
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
  args: { channelName: 'general' },
};

export const MultipleThreads: Story = {
  decorators: [
    (Story) => {
      const store = createMockStore({
        message: {
          ...initialMessageState,
          activeTab: 't2',
          threadTabs: {
            't1': makeThreadTab('t1', 'Bug Discussion'),
            't2': makeThreadTab('t2', 'Feature Request'),
            't3': makeThreadTab('t3', 'Release Notes v2.0'),
          },
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
  args: { channelName: 'dev-channel' },
};

export const ManyTabs: Story = {
  decorators: [
    (Story) => {
      const tabs: Record<string, ReturnType<typeof makeThreadTab>> = {};
      for (let i = 1; i <= 10; i++) {
        tabs[`t${i}`] = makeThreadTab(`t${i}`, `Thread Discussion #${i}`);
      }
      const store = createMockStore({
        message: {
          ...initialMessageState,
          activeTab: 't5',
          threadTabs: tabs,
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
  args: { channelName: 'busy-channel' },
};
