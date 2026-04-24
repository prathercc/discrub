import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import statusReducer, { showToast } from '@features/status/statusSlice';
import { initialStatusState } from '@features/status/statusTypes';
import Toast from './Toast';
import { Button, Box } from '@mui/material';

const createStoreWithToast = (level: string, message: string, duration = 5000) => {
  const store = configureStore({
    reducer: { status: statusReducer },
    preloadedState: {
      status: {
        ...initialStatusState,
        toast: { isVisible: true, level: level as any, message, duration },
      },
    },
  });
  return store;
};

const meta: Meta<typeof Toast> = {
  title: 'UI/Toast',
  component: Toast,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof Toast>;

export const Success: Story = {
  render: () => (
    <Provider store={createStoreWithToast('success', 'Export complete')}>
      <Box sx={{ height: '200px' }} />
      <Toast />
    </Provider>
  ),
};

export const Error: Story = {
  render: () => (
    <Provider store={createStoreWithToast('error', 'Export failed: Network error')}>
      <Box sx={{ height: '200px' }} />
      <Toast />
    </Provider>
  ),
};

export const Warning: Story = {
  render: () => (
    <Provider store={createStoreWithToast('warning', 'Export cancelled')}>
      <Box sx={{ height: '200px' }} />
      <Toast />
    </Provider>
  ),
};

export const Info: Story = {
  render: () => (
    <Provider store={createStoreWithToast('info', 'Copied to clipboard')}>
      <Box sx={{ height: '200px' }} />
      <Toast />
    </Provider>
  ),
};

export const LongMessage: Story = {
  render: () => (
    <Provider store={createStoreWithToast('success', 'Successfully exported 1,247 messages from #general with all media attachments included')}>
      <Box sx={{ height: '200px' }} />
      <Toast />
    </Provider>
  ),
};

export const Interactive: Story = {
  render: () => {
    const store = configureStore({
      reducer: { status: statusReducer },
      preloadedState: { status: initialStatusState },
    });
    return (
      <Provider store={store}>
        <Box sx={{ p: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" color="success" onClick={() => store.dispatch(showToast({ level: 'success', message: 'Export complete' }))}>
            Success
          </Button>
          <Button variant="contained" color="error" onClick={() => store.dispatch(showToast({ level: 'error', message: 'Something went wrong' }))}>
            Error
          </Button>
          <Button variant="contained" color="warning" onClick={() => store.dispatch(showToast({ level: 'warning', message: 'Operation cancelled' }))}>
            Warning
          </Button>
          <Button variant="contained" onClick={() => store.dispatch(showToast({ level: 'info', message: 'Copied to clipboard' }))}>
            Info
          </Button>
        </Box>
        <Toast />
      </Provider>
    );
  },
};
