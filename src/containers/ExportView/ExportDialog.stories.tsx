import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import theme from '@theme/theme';
import { createMockStore } from '../../../.storybook/storybook-utils';
import { defaultSettings } from '@features/app/appSlice';
import ExportDialog from './ExportDialog';

const mockMessages = [
  {
    id: 'msg-1',
    channel_id: 'ch-1',
    author: { id: 'u1', username: 'alice', discriminator: '0001', avatar: null },
    content: 'Hello world',
    timestamp: '2026-02-28T10:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [
      { id: 'att-1', filename: 'image.png', size: 102400, url: '', proxy_url: '', content_type: 'image/png' },
    ],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  },
  {
    id: 'msg-2',
    channel_id: 'ch-1',
    author: { id: 'u2', username: 'bob', discriminator: '0002', avatar: null },
    content: 'Check this out',
    timestamp: '2026-02-28T10:05:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  },
];

const baseMessageState = {
  messages: mockMessages,
  filteredMessages: mockMessages,
  selectedMessages: [],
  searchCriteria: null,
  order: { order: 'DESCENDING', orderBy: 'timestamp' },
  isLoading: false,
  error: null,
  pagination: {
    lastMessageId: null,
    hasMore: false,
    totalCount: mockMessages.length,
    isLoadingMore: false,
    isLoadingAll: false,
    loadAllProgress: null,
    mode: 'all',
  },
};

const baseChannelState = {
  channels: [{ id: 'ch-1', type: 0, guild_id: 'g-1', name: 'general', position: 0 }],
  selectedChannel: { id: 'ch-1', type: 0, guild_id: 'g-1', name: 'general', position: 0 },
  selectedChannels: [],
  isLoading: false,
  error: null,
};

const baseAppState = {
  settings: defaultSettings,
  isPaused: false,
  isCancelled: false,
  currentTask: null,
};

const meta: Meta<typeof ExportDialog> = {
  title: 'Containers/ExportDialog',
  component: ExportDialog,
  tags: ['autodocs'],
  parameters: {
    docs: { story: { inline: false, height: '600px' } },
  },
};
export default meta;

type Story = StoryObj<typeof ExportDialog>;

export const Default: Story = {
  args: {
    open: true,
    onClose: () => {},
  },
};

export const Closed: Story = {
  args: {
    open: false,
    onClose: () => {},
  },
};

export const MediaOnlySelected: Story = {
  args: {
    open: true,
    onClose: () => {},
  },
  decorators: [
    (Story) => {
      const store = createMockStore({
        message: baseMessageState,
        channel: baseChannelState,
        app: baseAppState,
        export: {
          isExporting: false,
          exportProgress: null,
          exportTotal: 0,
          currentPage: 0,
          totalPages: 0,
          exportError: null,
          exportFormat: 'media',
          messagesPerPage: 100,
          separateThreads: false,
          includeMedia: true,
          mediaConfig: { images: true, videos: true, audio: true, other: true },
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

export const WithMediaConfig: Story = {
  args: {
    open: true,
    onClose: () => {},
  },
  decorators: [
    (Story) => {
      const store = createMockStore({
        message: baseMessageState,
        channel: baseChannelState,
        app: baseAppState,
        export: {
          isExporting: false,
          exportProgress: null,
          exportTotal: 0,
          currentPage: 0,
          totalPages: 0,
          exportError: null,
          exportFormat: 'html',
          messagesPerPage: 100,
          separateThreads: false,
          includeMedia: true,
          mediaConfig: { images: true, videos: true, audio: false, other: false },
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
