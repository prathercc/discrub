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
  /** Mobile-only (< md): Ko-fi feed shown as a temporary overlay. Never persisted. */
  kofiOverlayOpen: boolean;
  sidebarView: SidebarView;
  task: AppTask;
  settings: AppSettings | null;
  /**
   * Transient theme override for the Settings theme picker's live
   * preview. Never persisted — ThemeWrapper renders it over the saved
   * APP_THEME_MODE while set; clearing (null) falls back to the setting.
   */
  previewThemeId: string | null;
}

export const initialAppState: AppState = {
  discrubPaused: false,
  discrubCancelled: false,
  isMinimized: false,
  focusedView: false,
  kofiOverlayOpen: false,
  sidebarView: 'server',
  task: {
    status: 'idle',
    message: '',
  },
  settings: null,
  previewThemeId: null,
};
