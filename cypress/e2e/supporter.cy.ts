/**
 * Supporter platform E2E — the Themes hub, paste-a-key unlock,
 * unlock/relock, and the key-based monthly auto-refresh.
 *
 * ⚠️ RUN THIS SPEC IN CHROME (`--browser chrome`). Cypress's bundled
 * Electron (Chromium 130) has no WebCrypto Ed25519, so the app's key
 * verification fails closed there and every unlock test would fail.
 * The fixture keypair is generated per-run in the spec browser and
 * injected through the dev-only `__supporterPublicKeysOverride__`
 * seam, so the real verification path runs end to end.
 */

const DARK_BG = 'rgb(30, 33, 36)'; // discord-dark background.default
const AMOLED_BG = 'rgb(0, 0, 0)'; // amoled-void background.default

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

async function signKey(overrides: Record<string, unknown> = {}): Promise<string> {
  const nowS = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    kid: '2026-2',
    jti: Math.random().toString(16).slice(2, 18),
    name: 'Cy Tester',
    eh: '0123456789abcdef',
    tier: 'monthly',
    iat: nowS,
    exp: nowS + 30 * DAY_S,
    ...overrides,
  };
  const body = bytesToB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    'Ed25519',
    privateKey,
    new TextEncoder().encode(body),
  );
  return `DSCRB-${body}.${bytesToB64Url(new Uint8Array(signature))}`;
}

const DB_NAMES = [
  'Discrub-settings',
  'Discrub-state',
  'Discrub-presets',
  'Discrub-cache',
  'Discrub-history',
  'Discrub-statuslog',
  'Discrub-package',
  'Discrub-media',
  'keyval-store',
];

/**
 * Like cy.login(), but injects the fixture public key before app boot.
 * freshDbs=false keeps IndexedDB so persistence across reloads can be
 * asserted.
 */
function visitApp({ freshDbs = true }: { freshDbs?: boolean } = {}) {
  cy.interceptDiscordApi();
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
      (win as unknown as { __supporterPublicKeysOverride__: Record<string, string> })
        .__supporterPublicKeysOverride__ = { '2026-2': publicKeyPem };
    },
  });
  cy.contains('Discrub Tester', { timeout: 15000 }).should('be.visible');
}

function openDisplayTab() {
  cy.get('[aria-label="Settings"]').click();
  cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
  cy.contains('button', 'Display').click();
  cy.get('[data-testid="theme-picker"]').should('be.visible');
}

/** Open the hub and apply a key through the paste box (the primary path). */
function applyKeyViaDialog(key: string) {
  cy.get('[data-testid="gift-button"]').click();
  cy.get('[data-testid="supporter-dialog"]').should('be.visible');
  cy.get('[data-testid="supporter-paste-key"]').type(key, { delay: 0 });
  cy.get('[data-testid="supporter-paste-apply"]').click();
}

describe('Supporter platform', () => {
  before(() => {
    cy.wrap(makeFixturePair());
  });

  it('gift button opens the hub with the pitch, theme grid, and Ko-fi button', () => {
    visitApp();
    cy.get('[data-testid="gift-button"]').click();
    cy.get('[data-testid="supporter-dialog"]').should('be.visible');
    cy.contains('growing pack of cosmetic themes').should('be.visible');
    cy.get('[data-testid="supporter-theme-showcase"] [data-testid^="theme-locked-"]').should(
      'have.length',
      8,
    );
    cy.contains('a', 'Support on Ko-fi').should(
      'have.attr',
      'href',
      'https://ko-fi.com/prathercc',
    );
    // The key delivery + renewal disclosure (below the fold now that
    // the grid lives in the hub).
    cy.contains('arrives by email right after you join').scrollIntoView().should('be.visible');
    cy.contains('renew automatically while your membership is active')
      .scrollIntoView()
      .should('be.visible');
  });

  it('applying a key unlocks supporter themes end to end', () => {
    visitApp();
    cy.then(() => signKey()).then((key) => {
      applyKeyViaDialog(key as string);
    });
    cy.get('[data-testid="supporter-status"]').should('contain.text', 'issued to Cy Tester');
    // The hub's own grid unlocks in place; switch right here.
    cy.get('[data-testid="supporter-theme-showcase"] [data-testid^="theme-locked-"]').should(
      'have.length',
      0,
    );
    cy.get('[data-testid="supporter-theme-showcase"] [data-testid="theme-card-amoled-void"]').click();
    cy.get('[aria-label="Close Supporter dialog"]').click();
    cy.get('body').should('have.css', 'background-color', AMOLED_BG);

    // The Settings picker agrees.
    openDisplayTab();
    cy.get('[data-testid="theme-picker"] [data-testid^="theme-locked-"]').should('have.length', 0);
    cy.get('[data-testid="theme-selected-amoled-void"]').should('exist');
  });

  it('the gift button becomes the supporter badge and the avatar gains its ring', () => {
    visitApp();
    cy.get('[data-testid="supporter-badge-star"]').should('not.exist');
    cy.get('[data-testid="supporter-avatar-pip"]').should('not.exist');
    cy.then(() => signKey()).then((key) => {
      applyKeyViaDialog(key as string);
    });
    cy.get('[aria-label="Close Supporter dialog"]').click();

    cy.get('[data-testid="supporter-badge-star"]').should('be.visible');
    cy.get('[data-testid="supporter-avatar-pip"]').should('be.visible');
    cy.get('[data-testid="gift-button"]')
      .should('have.attr', 'aria-label', 'Discrub Supporter')
      .and('have.css', 'animation-name', 'none');

    // The badge still opens the hub, and removing the key restores the gift.
    cy.get('[data-testid="gift-button"]').click();
    cy.get('[data-testid="supporter-remove-key"]').click();
    cy.get('[aria-label="Close Supporter dialog"]').click();
    cy.get('[data-testid="supporter-badge-star"]').should('not.exist');
    cy.get('[data-testid="supporter-avatar-pip"]').should('not.exist');
    cy.get('[data-testid="gift-button"]').should('have.attr', 'aria-label', 'Themes and support');
  });

  it('an applied key and theme survive a reload without contacting the server', () => {
    visitApp();
    cy.then(() => signKey()).then((key) => {
      applyKeyViaDialog(key as string);
    });
    cy.get('[data-testid="supporter-theme-showcase"] [data-testid="theme-card-amoled-void"]').click();
    cy.get('[aria-label="Close Supporter dialog"]').click();
    cy.get('body').should('have.css', 'background-color', AMOLED_BG);

    // Far from expiry, so the reload must make ZERO refresh calls.
    cy.intercept('POST', '**/supporter/refresh', cy.spy().as('refreshSpy'));
    visitApp({ freshDbs: false });
    cy.get('body').should('have.css', 'background-color', AMOLED_BG);
    cy.get('@refreshSpy').should('not.have.been.called');
  });

  it('auto-refreshes a near-expiry monthly key on boot by presenting the key', () => {
    visitApp();
    // Apply a key that expires in 2 days — inside the refresh window.
    let appliedKey: string;
    cy.then(() => signKey({ exp: Math.floor(Date.now() / 1000) + 2 * DAY_S })).then((key) => {
      appliedKey = key as string;
      applyKeyViaDialog(appliedKey);
    });
    cy.get('[data-testid="supporter-status"]').should('be.visible');
    cy.get('[aria-label="Close Supporter dialog"]').click();

    // Reload: the app should silently exchange the old key for a fresh one.
    cy.then(() => signKey()).then((freshKey) => {
      cy.intercept('POST', '**/supporter/refresh', (req) => {
        expect(req.body.key).to.eq(appliedKey);
        expect(req.body.email).to.be.undefined;
        req.reply({
          statusCode: 200,
          body: { key: freshKey, tier: 'monthly', name: 'Cy Tester', expiresAt: null },
        });
      }).as('refresh');
    });
    visitApp({ freshDbs: false });
    cy.wait('@refresh');
    cy.get('[data-testid="gift-button"]').click();
    cy.get('[data-testid="supporter-status"]').should('contain.text', 'issued to Cy Tester');
  });

  it('shows the server error copy when a manual refresh is refused', () => {
    visitApp();
    cy.then(() => signKey()).then((key) => {
      applyKeyViaDialog(key as string);
    });
    cy.get('[data-testid="supporter-status"]').should('be.visible');
    cy.intercept('POST', '**/supporter/refresh', {
      statusCode: 404,
      body: { status: 404, error: 'That key does not match an active supporter membership' },
    }).as('refresh');
    cy.get('[data-testid="supporter-refresh-key"]').click();
    cy.wait('@refresh');
    cy.get('[data-testid="supporter-claim-error"]').should(
      'contain.text',
      'That key does not match an active supporter membership',
    );
  });

  it('accepts a valid pasted key and rejects a tampered one', () => {
    visitApp();
    cy.get('[data-testid="gift-button"]').click();

    // Tampered: flip a character in the signature.
    cy.then(() => signKey({ tier: 'lifetime', exp: null })).then((key) => {
      const k = key as string;
      const tampered = k.slice(0, -4) + (k.endsWith('AAAA') ? 'BBBB' : 'AAAA');
      cy.get('[data-testid="supporter-paste-key"]').type(tampered, { delay: 0 });
      cy.get('[data-testid="supporter-paste-apply"]').click();
      cy.get('[data-testid="supporter-claim-error"]').should(
        'contain.text',
        "doesn't look like a valid supporter key",
      );

      cy.get('[data-testid="supporter-paste-key"]').clear().type(k, { delay: 0 });
      cy.get('[data-testid="supporter-paste-apply"]').click();
      cy.get('[data-testid="supporter-status"]').should('contain.text', 'Lifetime supporter');
    });
  });

  it('removing the key relocks supporter themes and falls back to a free theme', () => {
    visitApp();
    cy.then(() => signKey()).then((key) => {
      applyKeyViaDialog(key as string);
    });
    cy.get('[data-testid="supporter-theme-showcase"] [data-testid="theme-card-amoled-void"]').click();
    cy.get('[aria-label="Close Supporter dialog"]').click();
    cy.get('body').should('have.css', 'background-color', AMOLED_BG);

    cy.get('[data-testid="gift-button"]').click();
    cy.get('[data-testid="supporter-remove-key"]').click();
    cy.contains('growing pack of cosmetic themes').scrollIntoView().should('be.visible');
    cy.get('[aria-label="Close Supporter dialog"]').click();

    // Theme falls back without touching the saved setting.
    cy.get('body').should('have.css', 'background-color', DARK_BG);
    openDisplayTab();
    cy.get('[data-testid="theme-picker"] [data-testid^="theme-locked-"]').should('have.length', 8);
    cy.get('[data-testid="theme-selected-amoled-void"]').should('exist');
  });

  it('clicking a locked theme card in Settings opens the hub', () => {
    visitApp();
    openDisplayTab();
    cy.get('[data-testid="theme-picker"] [data-testid="theme-card-synthwave"]').click({
      force: true,
    });
    cy.get('[data-testid="supporter-dialog"]').should('be.visible');
    cy.contains('growing pack of cosmetic themes').should('be.visible');
  });

  it('gift attention animation calms permanently after the first open', () => {
    visitApp();
    cy.get('[data-testid="gift-button"]').should(
      'have.css',
      'animation-name',
      'giftGlow, giftWiggle',
    );
    cy.get('[data-testid="gift-button"]').click();
    cy.get('[aria-label="Close Supporter dialog"]').click();
    cy.get('[data-testid="gift-button"]').should('have.css', 'animation-name', 'none');

    // The calm persists across reloads.
    visitApp({ freshDbs: false });
    cy.get('[data-testid="gift-button"]').should('have.css', 'animation-name', 'none');
  });
});
