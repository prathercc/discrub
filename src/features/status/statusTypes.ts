/**
 * Types for status log feature
 */

export type StatusLevel = 'info' | 'warning' | 'error' | 'success' | 'session';

export interface StatusLogEntry {
  id: string;
  timestamp: number;
  level: StatusLevel;
  message: string;
}

export interface OperationTip {
  isVisible: boolean;
  message: string;
}

export interface ToastAction {
  type: 'reloadChannel';
  channelId: string;
  label: string;
}

export interface ToastNotification {
  isVisible: boolean;
  level: StatusLevel;
  message: string;
  duration: number;
  action?: ToastAction;
}

export interface StatusState {
  entries: StatusLogEntry[];
  maxEntries: number;
  operationTip: OperationTip;
  toast: ToastNotification;
}

export const initialStatusState: StatusState = {
  entries: [],
  maxEntries: 2000,
  operationTip: {
    isVisible: false,
    message: '',
  },
  toast: {
    isVisible: false,
    level: 'info',
    message: '',
    duration: 3000,
  },
};
