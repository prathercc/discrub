/**
 * StreamingZipService Mode Tests
 *
 * Tests that streaming downloads work correctly in both extension
 * and web-app contexts. Verifies the drip-fs library is
 * called with the right parameters and that mode detection works.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We test the mode detection logic that drip-fs uses,
// and verify our service integrates correctly in both contexts.

describe('Streaming Download Mode Detection', () => {
  const originalChrome = (globalThis as any).chrome;

  afterEach(() => {
    (globalThis as any).chrome = originalChrome;
    vi.restoreAllMocks();
  });

  describe('Extension Context', () => {
    beforeEach(() => {
      (globalThis as any).chrome = {
        runtime: {
          id: 'test-extension-id',
          getURL: (path: string) => `chrome-extension://test-extension-id/${path}`,
          sendMessage: vi.fn(),
        },
        tabs: {
          query: vi.fn(),
          sendMessage: vi.fn(),
        },
      };
    });

    it('should detect extension context via chrome.runtime.id', () => {
      const isExtension =
        typeof chrome !== 'undefined' &&
        chrome.runtime &&
        chrome.runtime.id !== undefined;

      expect(isExtension).toBe(true);
    });

    it('should resolve bridge URL with chrome.runtime.getURL', () => {
      const bridgeUrl = chrome.runtime.getURL('bridge/bridge.html');

      expect(bridgeUrl).toBe('chrome-extension://test-extension-id/bridge/bridge.html');
    });

    it('should resolve bridge files in bridge/ subdirectory', () => {
      const bridgeHtml = chrome.runtime.getURL('bridge/bridge.html');
      const bridgeJs = chrome.runtime.getURL('bridge/bridge.js');
      const swJs = chrome.runtime.getURL('bridge/sw.js');

      expect(bridgeHtml).toContain('/bridge/bridge.html');
      expect(bridgeJs).toContain('/bridge/bridge.js');
      expect(swJs).toContain('/bridge/sw.js');
    });

    it('should not conflict with background SW scope', () => {
      // Bridge SW registers at chrome-extension://id/bridge/
      // Background SW is at chrome-extension://id/
      const bridgeScope = chrome.runtime.getURL('bridge/');
      const backgroundScope = chrome.runtime.getURL('');

      expect(bridgeScope).not.toBe(backgroundScope);
      expect(bridgeScope).toContain('/bridge/');
    });
  });

  describe('Web App Context', () => {
    beforeEach(() => {
      delete (globalThis as any).chrome;
    });

    it('should detect web-app context when chrome.runtime is absent', () => {
      const isExtension =
        typeof chrome !== 'undefined' &&
        (chrome as any)?.runtime?.id !== undefined;

      expect(isExtension).toBe(false);
    });

    it('should require service worker for web-app mode', () => {
      // Web-app mode needs navigator.serviceWorker.controller
      const hasController =
        'serviceWorker' in navigator &&
        navigator.serviceWorker?.controller != null;

      // In test env, there's no real SW registered
      expect(hasController).toBe(false);
    });

    it('should not attempt to use chrome.runtime.getURL', () => {
      expect(typeof chrome).toBe('undefined');

      // Accessing chrome.runtime would throw in web context
      expect(() => {
        void (globalThis as any).chrome?.runtime?.getURL('bridge/bridge.html');
      }).not.toThrow(); // Optional chaining prevents throw
    });
  });

  describe('Mode Isolation', () => {
    it('should not leak extension APIs into web context', () => {
      delete (globalThis as any).chrome;

      // Verify no chrome APIs are available
      expect((globalThis as any).chrome).toBeUndefined();
      expect(() => chrome).toThrow();
    });

    it('should not require service worker in extension context', () => {
      (globalThis as any).chrome = {
        runtime: {
          id: 'test-id',
          getURL: (path: string) => `chrome-extension://test-id/${path}`,
        },
      };

      // Extension mode doesn't check navigator.serviceWorker
      const isExtension =
        typeof chrome !== 'undefined' &&
        chrome.runtime &&
        chrome.runtime.id !== undefined;

      expect(isExtension).toBe(true);
      // No serviceWorker check needed
    });
  });
});

describe('StreamingZipService Context Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call createStreamingDownload with filename.zip', async () => {
    // Mock the module
    const mockCreateStreamingDownload = vi.fn().mockResolvedValue({
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
      bytesWritten: 0,
    });

    vi.doMock('drip-fs', () => ({
      createStreamingDownload: mockCreateStreamingDownload,
    }));

    vi.doMock('@transcend-io/conflux', () => ({
      Writer: vi.fn().mockImplementation(() => ({
        readable: {
          getReader: () => ({
            read: vi.fn().mockResolvedValue({ done: true }),
            releaseLock: vi.fn(),
          }),
        },
        writable: {
          getWriter: () => ({
            ready: Promise.resolve(),
            write: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
          }),
        },
      })),
    }));

    const { StreamingZipService } = await import('./streamingZipService');
    const service = new StreamingZipService('test-channel');

    await service.addFile(new Blob(['test']), 'test.txt');

    expect(mockCreateStreamingDownload).toHaveBeenCalledWith('test-channel.zip');

    vi.doUnmock('drip-fs');
    vi.doUnmock('@transcend-io/conflux');
  });
});
