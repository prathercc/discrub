/**
 * Token Bridge Tests (GitHub #9)
 *
 * Verify the MAIN-world bridge observes Discord's own Authorization header from
 * XHR and fetch, relays it to the isolated content script only after that
 * content script announces itself, and ignores non-token values.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIGIN = window.location.origin;
const TOKEN = 'a'.repeat(40) + '.abcdef.' + 'b'.repeat(30);

/** Fire the content script's "I am listening" request at the bridge. */
function announceContentScript(): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'discrub:tokenRequest' },
      origin: ORIGIN,
      source: window,
    })
  );
}

describe('Token Bridge', () => {
  let originalSetRequestHeader: typeof XMLHttpRequest.prototype.setRequestHeader;
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    vi.resetModules();
    originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    originalFetch = window.fetch;
    // Replace with inert stubs so the bridge wraps a no-op original (avoids
    // jsdom InvalidStateError from calling the real setRequestHeader).
    XMLHttpRequest.prototype.setRequestHeader = vi.fn();
    window.fetch = vi.fn().mockResolvedValue(new Response(null));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
    window.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('relays the token captured from an XHR Authorization header on request', async () => {
    await import('./token-bridge');

    XMLHttpRequest.prototype.setRequestHeader('Authorization', TOKEN);

    const postSpy = vi.spyOn(window, 'postMessage');
    announceContentScript();

    expect(postSpy).toHaveBeenCalledWith(
      { type: 'discrub:tokenResponse', token: TOKEN },
      ORIGIN
    );
  });

  it('captures the token from a fetch Authorization header', async () => {
    await import('./token-bridge');

    await window.fetch('https://discord.com/api/v9/users/@me', {
      headers: { Authorization: TOKEN },
    });

    const postSpy = vi.spyOn(window, 'postMessage');
    announceContentScript();

    expect(postSpy).toHaveBeenCalledWith(
      { type: 'discrub:tokenResponse', token: TOKEN },
      ORIGIN
    );
  });

  it('captures the token from a fetch Headers object', async () => {
    await import('./token-bridge');

    await window.fetch('https://discord.com/api/v9/users/@me', {
      headers: new Headers({ Authorization: TOKEN }),
    });

    const postSpy = vi.spyOn(window, 'postMessage');
    announceContentScript();

    expect(postSpy).toHaveBeenCalledWith(
      { type: 'discrub:tokenResponse', token: TOKEN },
      ORIGIN
    );
  });

  it('does not relay a capture before the content script announces itself', async () => {
    await import('./token-bridge');

    const postSpy = vi.spyOn(window, 'postMessage');
    XMLHttpRequest.prototype.setRequestHeader('Authorization', TOKEN);

    expect(postSpy).not.toHaveBeenCalled();
  });

  it('relays later captures once the content script is listening', async () => {
    await import('./token-bridge');

    announceContentScript();
    const postSpy = vi.spyOn(window, 'postMessage');

    const newToken = 'c'.repeat(40) + '.zzzzzz.' + 'd'.repeat(30);
    XMLHttpRequest.prototype.setRequestHeader('Authorization', newToken);

    expect(postSpy).toHaveBeenCalledWith(
      { type: 'discrub:tokenCapture', token: newToken },
      ORIGIN
    );
  });

  it('ignores Bearer tokens and short values', async () => {
    await import('./token-bridge');

    XMLHttpRequest.prototype.setRequestHeader('Authorization', 'Bearer abc123');
    XMLHttpRequest.prototype.setRequestHeader('Authorization', 'short');

    const postSpy = vi.spyOn(window, 'postMessage');
    announceContentScript();

    expect(postSpy).toHaveBeenCalledWith(
      { type: 'discrub:tokenResponse', token: null },
      ORIGIN
    );
  });

  it('ignores non-Authorization headers', async () => {
    await import('./token-bridge');

    XMLHttpRequest.prototype.setRequestHeader('X-Track', TOKEN);

    const postSpy = vi.spyOn(window, 'postMessage');
    announceContentScript();

    expect(postSpy).toHaveBeenCalledWith(
      { type: 'discrub:tokenResponse', token: null },
      ORIGIN
    );
  });

  it('ignores requests from a foreign origin', async () => {
    await import('./token-bridge');

    XMLHttpRequest.prototype.setRequestHeader('Authorization', TOKEN);

    const postSpy = vi.spyOn(window, 'postMessage');
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'discrub:tokenRequest' },
        origin: 'https://evil.example.com',
        source: window,
      })
    );

    expect(postSpy).not.toHaveBeenCalled();
  });

  it('still calls through to the original setRequestHeader', async () => {
    const stub = vi.fn();
    XMLHttpRequest.prototype.setRequestHeader = stub;
    await import('./token-bridge');

    XMLHttpRequest.prototype.setRequestHeader('Authorization', TOKEN);

    expect(stub).toHaveBeenCalledWith('Authorization', TOKEN);
  });
});
