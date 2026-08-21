/**
 * Hosted "Bleeding Edge" landing gate (VITE_HOSTED_GATE=true build).
 * Exercised on the ordinary dev server through the dev-only
 * `__hostedGateOverride__` seam; the key path uses the same fixture
 * keypair trick as supporter.cy.ts.
 *
 * ⚠️ RUN IN CHROME (`--browser chrome`): Electron lacks WebCrypto Ed25519.
 */

const DAY_S = 24 * 60 * 60;

let publicKeyPem: string;
let privateKey: CryptoKey;

function bytesToB64Url(bytes: Uint8Array): string {
  let raw = '';
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function makeFixturePair(): Promise<void> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  privateKey = pair.privateKey;
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
  publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----`;
}

async function signKey(ent: Record<string, number | null>): Promise<string> {
  const nowS = Math.floor(Date.now() / 1000);
  const payload = {
    v: 2,
    kid: '2026-2',
    jti: Math.random().toString(16).slice(2, 18),
    name: 'Cy Hosted',
    eh: '0123456789abcdef',
    ent,
    iat: nowS,
    exp: nowS + 30 * DAY_S,
  };
  const body = bytesToB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(body));
  return `DSCRB-${body}.${bytesToB64Url(new Uint8Array(signature))}`;
}

const DB_NAMES = [
  'Discrub-settings', 'Discrub-state', 'Discrub-presets', 'Discrub-cache',
  'Discrub-history', 'Discrub-statuslog', 'Discrub-package', 'Discrub-media',
  'keyval-store',
];

function visitGate({ freshDbs = true }: { freshDbs?: boolean } = {}) {
  cy.interceptDiscordApi();
  // No env-token auto-auth on the gate: the landing page must render.
  cy.blockAutoAuth();
  cy.intercept('POST', '**/supporter/refresh', { forceNetworkError: true });
  cy.visit('/', {
    onBeforeLoad(win) {
      if (freshDbs) {
        for (const name of DB_NAMES) {
          try {
            win.indexedDB.deleteDatabase(name);
          } catch {
            /* best-effort */
          }
        }
      }
      const w = win as unknown as {
        __supporterPublicKeysOverride__: Record<string, string>;
        __hostedGateOverride__: boolean;
      };
      w.__supporterPublicKeysOverride__ = { '2026-2': publicKeyPem };
      w.__hostedGateOverride__ = true;
    },
  });
  cy.get('[data-testid="hosted-gate"]', { timeout: 15000 }).should('be.visible');
}

describe('Hosted Bleeding Edge gate', () => {
  before(() => {
    cy.wrap(makeFixturePair());
  });

  it('asks for a masked key and token, and keeps Sign In disabled without a key', () => {
    visitGate();
    cy.contains('Bleeding Edge').should('be.visible');
    cy.get('[data-testid="hosted-gate-key"]').should('have.attr', 'type', 'password');
    cy.get('input[type="password"]').should('have.length', 2);
    cy.get('[data-testid="landing-sign-in"]').should('be.disabled');
  });

  it('a themes-only key is told Bleeding Edge is separate and cannot sign in', () => {
    visitGate();
    cy.then(() => signKey({ themes: Math.floor(Date.now() / 1000) + 30 * DAY_S })).then((key) => {
      cy.get('[data-testid="hosted-gate-key"]').type(key as string, { delay: 0 });
      cy.get('[data-testid="hosted-gate-apply"]').click();
    });
    cy.get('[data-testid="hosted-gate-key-status"]').should(
      'contain.text',
      'Bleeding Edge is a separate tier',
    );
    cy.get('[data-testid="landing-sign-in"]').should('be.disabled');
  });

  it('a hosted key is remembered across reloads while the token is not, and sign-out keeps the key', () => {
    visitGate();
    const nowS = Math.floor(Date.now() / 1000);
    cy.then(() => signKey({ themes: nowS + 30 * DAY_S, hosted: nowS + 30 * DAY_S })).then((key) => {
      cy.get('[data-testid="hosted-gate-key"]').type(key as string, { delay: 0 });
      cy.get('[data-testid="hosted-gate-apply"]').click();
    });
    cy.get('[data-testid="hosted-gate-key-status"]').should('contain.text', 'Bleeding Edge included');

    // Reload: key pre-accepted, token field empty.
    visitGate({ freshDbs: false });
    cy.get('[data-testid="hosted-gate-key-status"]').should('contain.text', 'Bleeding Edge included');
    cy.get('[data-testid="hosted-gate-key"]').should('not.exist');
    cy.get('input[type="password"]').should('have.value', '');

    // Token sign-in works once the gate is satisfied.
    cy.get('input[type="password"]').type('cy-token', { delay: 0 });
    cy.get('[data-testid="landing-sign-in"]').should('not.be.disabled');

    // Forget my key wipes it.
    cy.get('[data-testid="hosted-gate-forget-key"]').click();
    cy.get('[data-testid="hosted-gate-key"]').should('be.visible');
    cy.get('[data-testid="landing-sign-in"]').should('be.disabled');
  });
});
