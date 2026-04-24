/**
 * Extension messaging utilities
 * Provides clean API for communication between:
 * - Content script ↔ Background script
 * - Extension app ↔ Background script
 */

/**
 * Extension message types
 */
export type ExtensionMessage =
  | { action: 'requestToken' }
  | { action: 'getToken' }
  | { action: 'injectOverlay' }
  | { action: 'closeOverlay' }
  | { action: 'minimizeOverlay' }
  | { action: 'restoreOverlay' }
  | { action: 'isOverlayOpen' }
  | { action: 'ping' };

/**
 * Check if running in extension context
 */
export function isExtensionMode(): boolean {
  return typeof chrome !== 'undefined' &&
         chrome.runtime?.id !== undefined;
}

/**
 * Check if running inside iframe overlay
 * Returns true when app is running in fullscreen overlay mode (not in a separate tab)
 */
export function isOverlayMode(): boolean {
  return window.self !== window.top && isExtensionMode();
}

/**
 * Request Discord token from content script
 * Called from extension app (LandingPage)
 */
export async function requestDiscordToken(): Promise<{
  success: boolean;
  token: string | null;
  error?: string;
}> {
  if (!isExtensionMode()) {
    return {
      success: false,
      token: null,
      error: 'Not running in extension mode',
    };
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'requestToken',
    });

    return {
      success: response?.success ?? false,
      token: response?.token ?? null,
      error: response?.error,
    };
  } catch (error) {
    console.error('[Discrub] Token request failed:', error);
    return {
      success: false,
      token: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Ping content script to check if it's alive
 * Useful for debugging
 */
export async function pingContentScript(): Promise<boolean> {
  if (!isExtensionMode()) return false;

  try {
    const tabs = await chrome.tabs.query({
      url: ['*://discord.com/*', '*://*.discord.com/*']
    });

    if (tabs.length === 0) return false;

    const response = await chrome.tabs.sendMessage(tabs[0].id!, {
      action: 'ping'
    });

    return response?.pong === true;
  } catch {
    return false;
  }
}

/**
 * Open fullscreen overlay on Discord
 * Injects iframe overlay instead of opening new tab
 */
export async function openOverlay(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isExtensionMode()) {
    return {
      success: false,
      error: 'Not running in extension mode',
    };
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'injectOverlay',
    });

    return {
      success: response?.success ?? false,
      error: response?.error,
    };
  } catch (error) {
    console.error('[Discrub] Overlay injection failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Close fullscreen overlay
 * Called from within the iframe to close itself
 */
export async function closeOverlay(): Promise<void> {
  if (!isExtensionMode()) {
    console.error('[Discrub] Cannot close overlay: not in extension mode');
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      action: 'closeOverlay',
    });
  } catch (error) {
    console.error('[Discrub] Failed to close overlay:', error);
  }
}

/**
 * Check if overlay is currently open
 */
export async function isOverlayOpen(): Promise<boolean> {
  if (!isExtensionMode()) return false;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'isOverlayOpen',
    });

    return response?.isOpen ?? false;
  } catch {
    return false;
  }
}

/**
 * Minimize overlay to floating tab
 * Called from within the iframe to minimize itself
 */
export async function minimizeOverlay(): Promise<void> {
  if (!isExtensionMode()) {
    console.error('[Discrub] Cannot minimize overlay: not in extension mode');
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      action: 'minimizeOverlay',
    });
  } catch (error) {
    console.error('[Discrub] Failed to minimize overlay:', error);
  }
}

/**
 * Restore overlay from floating tab
 * Called from within the iframe to restore itself
 */
export async function restoreOverlay(): Promise<void> {
  if (!isExtensionMode()) {
    console.error('[Discrub] Cannot restore overlay: not in extension mode');
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      action: 'restoreOverlay',
    });
  } catch (error) {
    console.error('[Discrub] Failed to restore overlay:', error);
  }
}
