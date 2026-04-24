import type { AppSettings } from 'discrub-core/types/discrub-types';

/**
 * Types for app feature
 */

export interface AppTask {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  message: string;
}

export type SidebarView = 'server' | 'package';

export interface AppState {
  discrubPaused: boolean;
  discrubCancelled: boolean;
  isMinimized: boolean;
  focusedView: boolean;
  sidebarView: SidebarView;
  task: AppTask;
  settings: AppSettings | null;
}

export const initialAppState: AppState = {
  discrubPaused: false,
  discrubCancelled: false,
  isMinimized: false,
  focusedView: false,
  sidebarView: 'server',
  task: {
    status: 'idle',
    message: '',
  },
  settings: null,
};
