import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import appReducer from '@features/app/appSlice';
import exportReducer from '@features/export/exportSlice';
import messageReducer from '@features/message/messageSlice';
import statusReducer from '@features/status/statusSlice';
import purgeReducer from '@features/purge/purgeSlice';
import StatusPanel from './StatusPanel';
import { initialAppState } from '@features/app/appTypes';
import { initialExportState } from '@features/export/exportTypes';
import { initialMessageState } from '@features/message/messageTypes';
import { initialStatusState } from '@features/status/statusTypes';
import { initialPurgeState } from '@features/purge/purgeTypes';

const createStore = (overrides: any = {}) =>
  configureStore({
    reducer: {
      app: appReducer,
      export: exportReducer,
      message: messageReducer,
      status: statusReducer,
      purge: purgeReducer,
    } as any,
    preloadedState: {
      app: { ...initialAppState, ...overrides.app },
      export: { ...initialExportState, ...overrides.export },
      message: { ...initialMessageState, ...overrides.message },
      status: { ...initialStatusState, entries: overrides.entries || [] },
      purge: { ...initialPurgeState, ...overrides.purge },
    },
  });

const meta: Meta<typeof StatusPanel> = {
  title: 'UI/StatusPanel',
  component: StatusPanel,
  tags: ['autodocs'],
  decorators: [
    (Story, context) => (
      <Provider store={(context.args as any)._store || createStore()}>
        <div style={{ backgroundColor: '#1e2024', width: 600 }}>
          <Story />
        </div>
      </Provider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof StatusPanel>;

export const Empty: Story = {
  args: { _store: createStore() } as any,
};

export const WithEntries: Story = {
  args: {
    _store: createStore({
      entries: [
        { id: '1', timestamp: Date.now() - 5000, level: 'info', message: 'Fetching messages...' },
        { id: '2', timestamp: Date.now() - 4000, level: 'info', message: 'Loaded 100 messages' },
        { id: '3', timestamp: Date.now() - 3000, level: 'success', message: 'Export complete' },
      ],
    }),
  } as any,
};

export const MixedLevels: Story = {
  args: {
    _store: createStore({
      entries: [
        { id: '1', timestamp: Date.now() - 5000, level: 'info', message: 'Starting operation...' },
        { id: '2', timestamp: Date.now() - 4000, level: 'warning', message: 'Rate limited, waiting 2s' },
        { id: '3', timestamp: Date.now() - 3000, level: 'error', message: 'Failed to delete message abc123' },
        { id: '4', timestamp: Date.now() - 2000, level: 'info', message: 'Retrying...' },
        { id: '5', timestamp: Date.now() - 1000, level: 'success', message: 'Operation complete' },
      ],
    }),
  } as any,
};

export const WithExportProgress: Story = {
  args: {
    _store: createStore({
      export: {
        isExporting: true,
        exportProgress: { stage: 'avatars', current: 5, total: 10 },
      },
      entries: [
        { id: '1', timestamp: Date.now() - 3000, level: 'info', message: 'Starting export for #general' },
        { id: '2', timestamp: Date.now() - 2000, level: 'info', message: 'Downloading avatars...' },
      ],
    }),
  } as any,
};

export const WithExportPaused: Story = {
  args: {
    _store: createStore({
      app: { discrubPaused: true },
      export: {
        isExporting: true,
        exportProgress: { stage: 'attachments', current: 30, total: 100 },
      },
      entries: [
        { id: '1', timestamp: Date.now() - 5000, level: 'info', message: 'Starting export for #general' },
        { id: '2', timestamp: Date.now() - 3000, level: 'info', message: 'Downloading attachments...' },
      ],
    }),
  } as any,
};
