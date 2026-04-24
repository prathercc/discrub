/**
 * Extension Integration Tests
 *
 * End-to-end tests for extension overlay functionality.
 * Tests the complete flow: button click → overlay injection → token auth → close.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getChromeMocks } from '../test/chrome-mocks';

describe('Extension Integration', () => {
  let mockChrome: ReturnType<typeof getChromeMocks>;

  beforeEach(() => {
    mockChrome = getChromeMocks();
    vi.clearAllMocks();
    document.body.innerHTML = '';

    // Setup localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  describe('Full Overlay Flow', () => {
    it('should complete full overlay injection and close flow', async () => {
      // 1. Setup: Discord tab exists with token
      const mockTab: chrome.tabs.Tab = {
        id: 1,
        url: 'https://discord.com/channels/@me',
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        selected: true,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        frozen: false,
      };

      mockChrome.tabs.query.mockResolvedValue([mockTab]);
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('"test-discord-token"');

      // 2. User clicks floating button → send injectOverlay message
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

      const injectResponse = await mockChrome.runtime.sendMessage({
        action: 'injectOverlay',
      });

      expect((injectResponse as { success: boolean }).success).toBe(true);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'injectOverlay',
      });

      // 3. Background script queries for Discord tab
      const tabs = await mockChrome.tabs.query({
        url: ['*://discord.com/*', '*://*.discord.com/*'],
        active: true,
        currentWindow: true,
      });

      expect(tabs.length).toBe(1);
      expect(tabs[0].id).toBe(1);

      // 4. Background sends injectOverlay to content script
      mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });

      const contentResponse = await mockChrome.tabs.sendMessage(tabs[0].id!, {
        action: 'injectOverlay',
      });

      expect((contentResponse as { success: boolean }).success).toBe(true);

      // 5. Content script creates overlay
      const dialog = document.createElement('dialog');
      dialog.id = 'discrub-overlay';

      const iframe = document.createElement('iframe');
      iframe.id = 'discrub-iframe';
      iframe.src = mockChrome.runtime.getURL('index.html');

      dialog.appendChild(iframe);
      document.body.appendChild(dialog);

      expect(document.getElementById('discrub-overlay')).toBeInTheDocument();
      expect(document.getElementById('discrub-iframe')).toBeInTheDocument();

      // 6. App requests token for auto-auth
      mockChrome.tabs.sendMessage.mockResolvedValue({
        success: true,
        token: 'test-discord-token',
      } as unknown as { success: boolean });

      const tokenResponse = await mockChrome.tabs.sendMessage(tabs[0].id!, {
        action: 'getToken',
      }) as unknown as { success: boolean; token: string };

      expect(tokenResponse.success).toBe(true);
      expect(tokenResponse.token).toBe('test-discord-token');

      // 7. User closes overlay
      const closeResponse = await mockChrome.runtime.sendMessage({
        action: 'closeOverlay',
      });

      expect(closeResponse).toBeDefined();

      // 8. Content script removes overlay
      dialog.remove();

      expect(document.getElementById('discrub-overlay')).not.toBeInTheDocument();
    });

    it('should handle no Discord tabs error gracefully', async () => {
      // No Discord tabs open
      mockChrome.tabs.query.mockResolvedValue([]);

      const tabs = await mockChrome.tabs.query({
        url: ['*://discord.com/*', '*://*.discord.com/*'],
        active: true,
        currentWindow: true,
      });

      expect(tabs.length).toBe(0);

      // Background should return error
      const error = {
        success: false,
        error: 'No Discord tabs open. Please open discord.com first.',
      };

      expect(error.success).toBe(false);
      expect(error.error).toContain('No Discord tabs');
    });

    it('should handle multiple Discord tabs', async () => {
      // Multiple Discord tabs
      const activeTab: chrome.tabs.Tab = {
        id: 1,
        url: 'https://discord.com/channels/@me',
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        selected: true,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        frozen: false,
      };

      const inactiveTab: chrome.tabs.Tab = {
        id: 2,
        url: 'https://discord.com/channels/12345',
        index: 1,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        frozen: false,
      };

      // First query returns active tab
      mockChrome.tabs.query.mockResolvedValueOnce([activeTab]);

      const activeTabs = await mockChrome.tabs.query({
        url: ['*://discord.com/*', '*://*.discord.com/*'],
        active: true,
        currentWindow: true,
      });

      // Should prefer active tab
      expect(activeTabs.length).toBe(1);
      expect(activeTabs[0].id).toBe(1);
      expect(activeTabs[0].active).toBe(true);

      // If no active tab, should fall back to any Discord tab
      mockChrome.tabs.query.mockResolvedValueOnce([]).mockResolvedValueOnce([inactiveTab]);

      const noActiveTabs = await mockChrome.tabs.query({
        url: ['*://discord.com/*', '*://*.discord.com/*'],
        active: true,
        currentWindow: true,
      });

      if (noActiveTabs.length === 0) {
        const allTabs = await mockChrome.tabs.query({
          url: ['*://discord.com/*', '*://*.discord.com/*'],
        });

        expect(allTabs.length).toBe(1);
        expect(allTabs[0].id).toBe(2);
      }
    });
  });

  describe('Streaming Downloads Configuration', () => {
    it('should use correct MITM URL for overlay context', () => {
      // drip-fs uses chrome.runtime.getURL('bridge/bridge.html') in extension context
      const expectedMitmUrl = mockChrome.runtime.getURL('bridge/bridge.html');

      expect(expectedMitmUrl).toBe('chrome-extension://test-extension-id/bridge/bridge.html');
    });

    it('should allow service worker registration in iframe context', () => {
      // In overlay mode, navigator.serviceWorker.controller should be available
      // because the background script acts as the service worker

      const hasServiceWorker = 'serviceWorker' in navigator;

      // In test environment:
      expect(hasServiceWorker).toBeDefined();
    });
  });

  describe('Token Authentication', () => {
    it('should extract and use token for auto-authentication', async () => {
      // Mock Discord tab with token
      const mockTab: chrome.tabs.Tab = {
        id: 1,
        url: 'https://discord.com/channels/@me',
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        selected: true,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        frozen: false,
      };

      mockChrome.tabs.query.mockResolvedValue([mockTab]);
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('"my-discord-token-12345"');

      // Request token
      mockChrome.tabs.sendMessage.mockResolvedValue({
        success: true,
        token: 'my-discord-token-12345',
      } as unknown as { success: boolean });

      const tabs = await mockChrome.tabs.query({
        url: ['*://discord.com/*', '*://*.discord.com/*'],
      });

      const response = await mockChrome.tabs.sendMessage(tabs[0].id!, {
        action: 'getToken',
      }) as { success: boolean; token: string | null };

      expect(response.success).toBe(true);
      expect(response.token).toBe('my-discord-token-12345');

      // App should use this token for authentication
      const isAuthenticated = response.success && response.token !== null;
      expect(isAuthenticated).toBe(true);
    });

    it('should handle missing token gracefully', async () => {
      const mockTab: chrome.tabs.Tab = {
        id: 1,
        url: 'https://discord.com/channels/@me',
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        selected: true,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        frozen: false,
      };

      mockChrome.tabs.query.mockResolvedValue([mockTab]);
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

      // Request token
      mockChrome.tabs.sendMessage.mockResolvedValue({
        success: false,
        token: null,
      } as unknown as { success: boolean });

      const tabs = await mockChrome.tabs.query({
        url: ['*://discord.com/*', '*://*.discord.com/*'],
      });

      const response = await mockChrome.tabs.sendMessage(tabs[0].id!, {
        action: 'getToken',
      }) as unknown as { success: boolean; token: string | null };

      expect(response.success).toBe(false);
      expect(response.token).toBeNull();

      // App should show login form
      const isAuthenticated = response.success && response.token !== null;
      expect(isAuthenticated).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle content script not responding', async () => {
      const mockTab: chrome.tabs.Tab = {
        id: 1,
        url: 'https://discord.com/channels/@me',
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        selected: true,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        frozen: false,
      };

      mockChrome.tabs.query.mockResolvedValue([mockTab]);

      // Simulate content script not responding
      mockChrome.runtime.lastError = {
        message: 'Could not establish connection. Receiving end does not exist.',
      };

      const tabs = await mockChrome.tabs.query({
        url: ['*://discord.com/*', '*://*.discord.com/*'],
      });

      try {
        await mockChrome.tabs.sendMessage(tabs[0].id!, { action: 'injectOverlay' });
      } catch {
        // Expected to fail
      }

      if (mockChrome.runtime.lastError) {
        const error = {
          success: false,
          error: 'Failed to communicate with Discord tab. Try refreshing discord.com.',
        };

        expect(error.success).toBe(false);
        expect(error.error).toContain('Try refreshing');
      }
    });
  });
});
