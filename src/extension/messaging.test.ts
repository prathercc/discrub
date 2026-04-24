/**
 * Extension Messaging Tests
 *
 * Tests for messaging.ts utility functions for extension communication.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isExtensionMode,
  isOverlayMode,
  requestDiscordToken,
  openOverlay,
  closeOverlay,
  minimizeOverlay,
  restoreOverlay,
  isOverlayOpen,
} from './messaging';
import { getChromeMocks } from '../test/chrome-mocks';

describe('Extension Messaging', () => {
  let mockChrome: ReturnType<typeof getChromeMocks>;

  beforeEach(() => {
    mockChrome = getChromeMocks();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('isExtensionMode', () => {
    it('should return true when chrome runtime is available', () => {
      expect(isExtensionMode()).toBe(true);
    });

    it('should return false when chrome is undefined', () => {
      // Temporarily remove chrome
      const originalChrome = (globalThis as { chrome?: unknown }).chrome;
      delete (globalThis as { chrome?: unknown }).chrome;

      expect(isExtensionMode()).toBe(false);

      // Restore chrome
      (globalThis as { chrome: unknown }).chrome = originalChrome;
    });

    it('should return false when chrome.runtime is undefined', () => {
      const originalChrome = (globalThis as { chrome?: unknown }).chrome;
      (globalThis as { chrome: { runtime?: unknown } }).chrome = {};

      expect(isExtensionMode()).toBe(false);

      // Restore
      (globalThis as { chrome: unknown }).chrome = originalChrome;
    });
  });

  describe('isOverlayMode', () => {
    it('should return false when not in iframe', () => {
      // window.self === window.top (not in iframe)
      expect(window.self).toBe(window.top);
      expect(isOverlayMode()).toBe(false);
    });

    it('should return false when chrome not available', () => {
      const originalChrome = (globalThis as { chrome?: unknown }).chrome;
      delete (globalThis as { chrome?: unknown }).chrome;

      expect(isOverlayMode()).toBe(false);

      // Restore
      (globalThis as { chrome: unknown }).chrome = originalChrome;
    });

    it('should detect iframe context', () => {
      // Note: In test environment, window.self === window.top always
      // This test documents the expected behavior
      const isInIframe = window.self !== window.top;
      expect(isInIframe).toBe(false);

      // In real overlay mode, this would be true:
      // expect(window.self !== window.top && isExtensionMode()).toBe(true);
    });
  });

  describe('requestDiscordToken', () => {
    it('should request token from background script', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        token: 'test-discord-token',
      } as unknown as { success: boolean });

      const result = await requestDiscordToken();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'requestToken',
      });
      expect(result.success).toBe(true);
      expect(result.token).toBe('test-discord-token');
    });

    it('should handle token request failure', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: 'No Discord tabs open',
      } as unknown as { success: boolean });

      const result = await requestDiscordToken();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No Discord tabs open');
    });

    it('should handle runtime errors', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Connection failed'));

      const result = await requestDiscordToken();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    it('should return error when not in extension mode', async () => {
      const originalChrome = (globalThis as { chrome?: unknown }).chrome;
      delete (globalThis as { chrome?: unknown }).chrome;

      const result = await requestDiscordToken();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not running in extension mode');

      // Restore
      (globalThis as { chrome: unknown }).chrome = originalChrome;
    });
  });

  describe('openOverlay', () => {
    it('should send injectOverlay message to background', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
      });

      const result = await openOverlay();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'injectOverlay',
      });
      expect(result.success).toBe(true);
    });

    it('should handle overlay injection failure', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: 'No Discord tabs open',
      } as unknown as { success: boolean });

      const result = await openOverlay();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No Discord tabs open');
    });

    it('should handle runtime errors', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Injection failed'));

      const result = await openOverlay();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Injection failed');
    });

    it('should return error when not in extension mode', async () => {
      const originalChrome = (globalThis as { chrome?: unknown }).chrome;
      delete (globalThis as { chrome?: unknown }).chrome;

      const result = await openOverlay();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not running in extension mode');

      // Restore
      (globalThis as { chrome: unknown }).chrome = originalChrome;
    });
  });

  describe('closeOverlay', () => {
    it('should send closeOverlay message to background', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
      });

      await closeOverlay();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'closeOverlay',
      });
    });

    it('should handle errors silently', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(closeOverlay()).resolves.not.toThrow();
    });

    it('should do nothing when not in extension mode', async () => {
      const originalChrome = (globalThis as { chrome?: unknown }).chrome;
      delete (globalThis as { chrome?: unknown }).chrome;

      // Should not throw
      await expect(closeOverlay()).resolves.not.toThrow();

      // Restore
      (globalThis as { chrome: unknown }).chrome = originalChrome;
    });
  });

  describe('isOverlayOpen', () => {
    it('should query overlay state from background', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        isOpen: true,
      } as unknown as { success: boolean });

      const result = await isOverlayOpen();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'isOverlayOpen',
      });
      expect(result).toBe(true);
    });

    it('should return false when overlay is closed', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        isOpen: false,
      } as unknown as { success: boolean });

      const result = await isOverlayOpen();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Query failed'));

      const result = await isOverlayOpen();

      expect(result).toBe(false);
    });

    it('should return false when not in extension mode', async () => {
      const originalChrome = (globalThis as { chrome?: unknown }).chrome;
      delete (globalThis as { chrome?: unknown }).chrome;

      const result = await isOverlayOpen();

      expect(result).toBe(false);

      // Restore
      (globalThis as { chrome: unknown }).chrome = originalChrome;
    });

    it('should default to false when response is undefined', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined as unknown as { success: boolean });

      const result = await isOverlayOpen();

      expect(result).toBe(false);
    });
  });

  describe('minimizeOverlay', () => {
    it('should send minimizeOverlay message to background', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
      });

      await minimizeOverlay();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'minimizeOverlay',
      });
    });

    it('should handle errors silently', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Minimize failed'));

      await expect(minimizeOverlay()).resolves.not.toThrow();
    });

    it('should do nothing when not in extension mode', async () => {
      const originalChrome = (globalThis as { chrome?: unknown }).chrome;
      delete (globalThis as { chrome?: unknown }).chrome;

      await expect(minimizeOverlay()).resolves.not.toThrow();

      (globalThis as { chrome: unknown }).chrome = originalChrome;
    });
  });

  describe('restoreOverlay', () => {
    it('should send restoreOverlay message to background', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
      });

      await restoreOverlay();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'restoreOverlay',
      });
    });

    it('should handle errors silently', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Restore failed'));

      await expect(restoreOverlay()).resolves.not.toThrow();
    });

    it('should do nothing when not in extension mode', async () => {
      const originalChrome = (globalThis as { chrome?: unknown }).chrome;
      delete (globalThis as { chrome?: unknown }).chrome;

      await expect(restoreOverlay()).resolves.not.toThrow();

      (globalThis as { chrome: unknown }).chrome = originalChrome;
    });
  });
});
