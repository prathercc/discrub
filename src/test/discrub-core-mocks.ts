/**
 * Mocks for discrub-core modules that depend on browser APIs or
 * heavyweight libraries not available in jsdom.
 *
 * Usage in test files:
 *   vi.mock('discrub-core/html-formatting-utils', () => htmlFormattingMock);
 *   vi.mock('discrub-core/highlight.js', () => highlightCssMock);
 */

import { vi } from 'vitest';

/**
 * Mock for discrub-core/html-formatting-utils
 * Returns sanitised plain text so tests can assert on content without
 * needing the real HTML formatter.
 */
export const htmlFormattingMock = {
  formatContentAsHtml: vi.fn((content: string) => content),
};

/**
 * Mock for discrub-core/highlight.js CSS import.
 * The real module is a CSS side-effect import that jsdom cannot process.
 */
export const highlightCssMock = {
  default: '',
};
