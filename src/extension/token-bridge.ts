/**
 * Token Bridge — MAIN-world content script (runs at document_start)
 *
 * Discord neuters `window.localStorage` in its own page context and, for a
 * growing set of accounts, no longer keeps the auth token there at all
 * (GitHub #9). The isolated content script's localStorage read therefore comes
 * back empty even though the session is perfectly valid. Discord still attaches
 * `Authorization: <token>` to every REST call it makes, so this script — which
 * runs in the page's MAIN world, where those requests originate — observes the
 * header and relays the user's own token to the isolated content script.
 *
 * The token is used only locally, to authenticate the Discord API requests the
 * user initiates inside Discrub. It is never sent anywhere. Cross-world relay
 * uses `window.postMessage` scoped to the page's own origin; the token belongs
 * to discord.com, which already holds it, so this adds no exposure beyond what
 * the page itself already has.
 */

const TOKEN_REQUEST = 'discrub:tokenRequest';
const TOKEN_RESPONSE = 'discrub:tokenResponse';
const TOKEN_CAPTURE = 'discrub:tokenCapture';

(() => {
  let capturedToken: string | null = null;
  /** Only relay once our isolated content script has announced it is listening. */
  let contentListening = false;

  const isTokenLike = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 10 && !/^Bearer\s/i.test(value);

  const relay = (type: string, token: string | null): void => {
    try {
      window.postMessage({ type, token }, window.location.origin);
    } catch {
      /* postMessage can throw in exotic contexts — ignore */
    }
  };

  const record = (value: unknown): void => {
    if (!isTokenLike(value)) return;
    if (value === capturedToken) return;
    capturedToken = value;
    if (contentListening) relay(TOKEN_CAPTURE, capturedToken);
  };

  // Discord issues its REST calls over XHR; observe the Authorization header
  // it sets on its own requests.
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (
    name: string,
    value: string,
  ): void {
    try {
      if (typeof name === 'string' && name.toLowerCase() === 'authorization') {
        record(value);
      }
    } catch {
      /* never let observation break the underlying request */
    }
    return originalSetRequestHeader.call(this, name, value);
  };

  // Safety net for any fetch-based requests Discord may make.
  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      try {
        const headers = init?.headers;
        if (headers) {
          let auth: string | null = null;
          if (headers instanceof Headers) {
            auth = headers.get('Authorization');
          } else if (Array.isArray(headers)) {
            const entry = headers.find(
              (pair) => String(pair[0]).toLowerCase() === 'authorization',
            );
            if (entry) auth = entry[1];
          } else {
            const record0 = headers as Record<string, string>;
            auth = record0.Authorization ?? record0.authorization ?? null;
          }
          record(auth);
        }
      } catch {
        /* never let observation break the underlying request */
      }
      return originalFetch.call(this, input, init);
    };
  }

  // Answer the isolated content script's requests for the current token.
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    if (!event.data || event.data.type !== TOKEN_REQUEST) return;
    contentListening = true;
    relay(TOKEN_RESPONSE, capturedToken);
  });
})();

// Module export so the file can be dynamically imported in tests.
export {};
