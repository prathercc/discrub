import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import appReducer from '@features/app/appSlice';
import exportReducer from '@features/export/exportSlice';
import messageReducer from '@features/message/messageSlice';
import statusReducer from '@features/status/statusSlice';
import purgeReducer from '@features/purge/purgeSlice';
import PauseResumeControls from './PauseResumeControls';
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
      status: { ...initialStatusState },
      purge: { ...initialPurgeState },
    },
  });

const meta: Meta<typeof PauseResumeControls> = {
  title: 'UI/PauseResumeControls',
  component: PauseResumeControls,
  tags: ['autodocs'],
  decorators: [
    (Story, context) => (
      <Provider store={(context.args as any)._store || createStore()}>
        <div style={{ backgroundColor: '#282b30', padding: 16 }}>
          <Story />
        </div>
      </Provider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof PauseResumeControls>;

export const Idle: Story = {
  args: { _store: createStore() } as any,
};

export const Running: Story = {
  args: {
    _store: createStore({ export: { isExporting: true } }),
    label: 'Exporting...',
  } as any,
};

export const WithProgress: Story = {
  args: {
    _store: createStore({ export: { isExporting: true } }),
    label: 'Exporting (avatars)... 45%',
    progress: 45,
  } as any,
};

export const Indeterminate: Story = {
  args: {
    _store: createStore({ export: { isExporting: true } }),
    label: 'Exporting...',
  } as any,
};

export const Paused: Story = {
  args: {
    _store: createStore({
      export: { isExporting: true },
      app: { discrubPaused: true },
    }),
    label: 'Paused — Exporting',
    progress: 60,
  } as any,
};
