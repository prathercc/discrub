import '@testing-library/jest-dom';
// `fake-indexeddb/auto` registers an in-memory IndexedDB implementation
// on globalThis so the storage adapter (now backed by `idb-keyval`) works
// in jsdom. Must be imported before anything that touches `storage.ts`.
import 'fake-indexeddb/auto';
// Boots i18next with the bundled catalogs so `t()` resolves English in
// every test without per-file setup.
import '../i18n';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { installChromeMocks, cleanupChromeMocks } from './chrome-mocks';
import { server as mswServer } from './msw/server';
import { webcrypto } from 'node:crypto';
import { applyLanguage } from '../i18n';

// jsdom's crypto has getRandomValues but no SubtleCrypto; the supporter
// key verification needs WebCrypto Ed25519, so borrow Node's.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle });
}

// Install Chrome extension API mocks globally
beforeAll(() => {
  installChromeMocks();
  // MSW server runs for the whole test process. `bypass` means tests
  // that don't register handlers are unaffected — module-mocked tests
  // intercept before any fetch happens, so MSW never sees them.
  mswServer.listen({ onUnhandledRequest: 'bypass' });
});

// Cleanup Chrome mocks after all tests
afterAll(() => {
  cleanupChromeMocks();
  mswServer.close();
});

// Cleanup after each test. fake-indexeddb persists for the whole
// worker process; tests that care about clean storage state should
// `await idbClear()` themselves in `beforeEach`. We don't do it here
// globally because tests using `vi.useFakeTimers()` would block the
// afterEach hook on an idbClear promise that never resolves until
// real timers are restored.
afterEach(() => {
  cleanup();
  // A test that switched languages must not leak German into the next one.
  void applyLanguage('en');
  // Drop any per-test MSW handlers registered with `server.use(...)`.
  mswServer.resetHandlers();
});

// Mock window.matchMedia (required for MUI components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock IntersectionObserver (required for virtualization)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;
