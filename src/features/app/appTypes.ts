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
  /**
   * #254 — set by the rate-limit storm hook when discrub-core gives up on
   * a request; the current operation was cancelled for that reason.
   * MainLayout turns it into the completion toast and clears it.
   */
  rateLimitStopped?: boolean;
  /**
   * Set by the network-failure streak hook when discrub-core saw several
   * thrown fetches in a row while the browser was online: Discord (or its
   * edge) is refusing this account's requests. The operation was cancelled
   * for that reason; MainLayout turns it into the completion toast.
   */
  requestsRefusedStopped?: boolean;
  /**
   * Wall-clock ms at which the current automatic rest break ends
   * (`useRestBreaks`). Null when the pause, if any, is the user's own.
   */
  restBreakUntil?: number | null;
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
  /**
   * #124 — set once by loadSettings when an existing install has no saved
   * language and the browser prefers a supported non-English one. MainLayout
   * turns it into a one-time toast offering the switch, then clears it.
   */
  suggestedLanguage?: string | null;
}

export const initialAppState: AppState = {
  discrubPaused: false,
  discrubCancelled: false,
  rateLimitStopped: false,
  requestsRefusedStopped: false,
  restBreakUntil: null,
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
  suggestedLanguage: null,
};
