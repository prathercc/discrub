import type { Meta, StoryObj } from '@storybook/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import authReducer from '@features/auth/authSlice';
import appReducer from '@features/app/appSlice';
import channelReducer from '@features/channel/channelSlice';
import statusReducer from '@features/status/statusSlice';
import ThreadLoadModal from './ThreadLoadModal';

const meta: Meta<typeof ThreadLoadModal> = {
  title: 'Modals/ThreadLoadModal',
  component: ThreadLoadModal,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof ThreadLoadModal>;

export const Default: Story = {
  args: {
    open: true,
    onClose: () => {},
    onLoad: () => {},
  },
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const channel = { id: 'parent', name: 'general', type: 0 } as any;

/**
 * Discovery list with a cached thread set (#252 row styling). No auth
 * token in this store, so the modal renders the cache instead of fetching.
 */
const sampleThreads = [
  { id: '1', name: 'Falador truck meet planning', type: 11, parent_id: 'parent', total_message_sent: 1284, member_count: 23 },
  { id: '2', name: 'runite finally cleared customs', type: 11, parent_id: 'parent', total_message_sent: 96, member_count: 8 },
  { id: '3', name: 'mods only: scam report triage', type: 12, parent_id: 'parent', total_message_sent: 41, member_count: 4 },
  { id: '4', name: 'Varrock ore exchange (old)', type: 11, parent_id: 'parent', total_message_sent: 512, member_count: 19, thread_metadata: { archived: true, archive_timestamp: hoursAgo(72) } },
  { id: '5', name: 'party hat price check', type: 11, parent_id: 'parent', message_count: 7, member_count: 3, thread_metadata: { archived: true, archive_timestamp: hoursAgo(5) } },
  { id: '6', name: 'thread with no counts from the API', type: 11, parent_id: 'parent' },
];

export const WithDiscoveredThreads: Story = {
  args: {
    open: true,
    onClose: () => {},
    onLoad: () => {},
    channel,
    guildId: 'g1',
  },
  decorators: [
    (StoryFn) => {
      const store = configureStore({
        reducer: { auth: authReducer, app: appReducer, channel: channelReducer, status: statusReducer } as any,
        preloadedState: {
          channel: {
            ...channelReducer(undefined, { type: '@@init' }),
            discoveredThreadsByChannel: { parent: sampleThreads },
          },
        } as any,
      });
      return (
        <Provider store={store}>
          <StoryFn />
        </Provider>
      );
    },
  ],
};
