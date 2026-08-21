/**
 * Supporter platform E2E — gift button, claim flow, paste fallback,
 * unlock/relock, and the monthly auto-refresh.
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

function claimViaDialog(key: string, opts: { statusCode?: number } = {}) {
  cy.intercept('POST', '**/supporter/claim', {
    statusCode: opts.statusCode ?? 200,
    body:
      (opts.statusCode ?? 200) === 200
        ? { key, tier: 'monthly', name: 'Cy Tester', expiresAt: null }
        : { status: opts.statusCode, error: 'No active supporter membership was found for that email' },
  }).as('claim');
  cy.get('[data-testid="gift-button"]').click();
  cy.get('[data-testid="supporter-dialog"]').should('be.visible');
  cy.get('[data-testid="supporter-claim-email"]').type('cy@example.com');
  cy.get('[data-testid="supporter-claim-submit"]').click();
  cy.wait('@claim');
}

describe('Supporter platform', () => {
  before(() => {
    cy.wrap(makeFixturePair());
  });

  it('gift button opens the dialog with the pitch, showcase, and Ko-fi links', () => {
    visitApp();
    cy.get('[data-testid="gift-button"]').click();
    cy.get('[data-testid="supporter-dialog"]').should('be.visible');
    cy.contains('free, and every feature always will be').should('be.visible');
    cy.get('[data-testid="supporter-theme-showcase"]').children().should('have.length', 8);
    cy.contains('a', '$3/month').should('have.attr', 'href', 'https://ko-fi.com/prathercc');
    cy.contains('a', '$25 lifetime').should(
      'have.attr',
      'href',
      'https://ko-fi.com/prathercc/shop',
    );
    // The consent-moment disclosure for auto-refresh.
    cy.contains('refreshes automatically while your membership is active').should('be.visible');
  });

  it('claiming a key unlocks supporter themes end to end', () => {
    visitApp();
    cy.then(() => signKey()).then((key) => {
      claimViaDialog(key as string);
    });
    cy.get('[data-testid="supporter-status"]').should('contain.text', 'issued to Cy Tester');
    cy.get('[aria-label="Close Supporter dialog"]').click();

    openDisplayTab();
    cy.get('[data-testid^="theme-locked-"]').should('have.length', 0);
    cy.get('[data-testid="theme-card-amoled-void"]').click();
    cy.get('[role="dialog"]').contains('button', 'Save Settings').click();
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('body').should('have.css', 'background-color', AMOLED_BG);
  });

  it('the gift button becomes the supporter badge and the avatar gains its ring', () => {
    visitApp();
    cy.get('[data-testid="supporter-badge-star"]').should('not.exist');
    cy.get('[data-testid="supporter-avatar-pip"]').should('not.exist');
    cy.then(() => signKey()).then((key) => {
      claimViaDialog(key as string);
    });
    cy.get('[aria-label="Close Supporter dialog"]').click();

    cy.get('[data-testid="supporter-badge-star"]').should('be.visible');
    cy.get('[data-testid="supporter-avatar-pip"]').should('be.visible');
    cy.get('[data-testid="gift-button"]')
      .should('have.attr', 'aria-label', 'Discrub Supporter')
      .and('have.css', 'animation-name', 'none');

    // The badge still opens the dialog, and removing the key restores the gift.
    cy.get('[data-testid="gift-button"]').click();
    cy.get('[data-testid="supporter-remove-key"]').click();
    cy.get('[aria-label="Close Supporter dialog"]').click();
    cy.get('[data-testid="supporter-badge-star"]').should('not.exist');
    cy.get('[data-testid="supporter-avatar-pip"]').should('not.exist');
    cy.get('[data-testid="gift-button"]').should('have.attr', 'aria-label', 'Support Discrub');
  });

  it('a claimed key and theme survive a reload without contacting the server', () => {
    visitApp();
    cy.then(() => signKey()).then((key) => {
      claimViaDialog(key as string);
    });
    cy.get('[aria-label="Close Supporter dialog"]').click();
    openDisplayTab();
    cy.get('[data-testid="theme-card-amoled-void"]').click();
    cy.get('[role="dialog"]').contains('button', 'Save Settings').click();
    cy.get('[role="dialog"]').should('not.exist');

    // Far from expiry, so the reload must make ZERO claim calls.
    cy.intercept('POST', '**/supporter/claim', cy.spy().as('claimSpy'));
    visitApp({ freshDbs: false });
    cy.get('body').should('have.css', 'background-color', AMOLED_BG);
    cy.get('@claimSpy').should('not.have.been.called');
  });

  it('auto-refreshes a near-expiry monthly key on boot with the stored email', () => {
    visitApp();
    // Claim a key that expires in 2 days — inside the refresh window.
    cy.then(() => signKey({ exp: Math.floor(Date.now() / 1000) + 2 * DAY_S })).then((key) => {
      claimViaDialog(key as string);
    });
    cy.get('[data-testid="supporter-status"]').should('be.visible');
    cy.get('[aria-label="Close Supporter dialog"]').click();

    // Reload: the app should silently re-claim with the stored email.
    cy.then(() => signKey()).then((freshKey) => {
      cy.intercept('POST', '**/supporter/claim', (req) => {
        expect(req.body.email).to.eq('cy@example.com');
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

  it('shows the server error copy when no membership matches', () => {
    visitApp();
    claimViaDialog('unused', { statusCode: 404 });
    cy.get('[data-testid="supporter-claim-error"]').should(
      'contain.text',
      'No active supporter membership was found for that email',
    );
  });

  it('paste fallback accepts a valid key and rejects a tampered one', () => {
    visitApp();
    cy.get('[data-testid="gift-button"]').click();
    cy.get('[data-testid="supporter-paste-toggle"]').click();

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
      claimViaDialog(key as string);
    });
    cy.get('[aria-label="Close Supporter dialog"]').click();
    openDisplayTab();
    cy.get('[data-testid="theme-card-amoled-void"]').click();
    cy.get('[role="dialog"]').contains('button', 'Save Settings').click();
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('body').should('have.css', 'background-color', AMOLED_BG);

    cy.get('[data-testid="gift-button"]').click();
    cy.get('[data-testid="supporter-remove-key"]').click();
    cy.contains('free, and every feature always will be').should('be.visible');
    cy.get('[aria-label="Close Supporter dialog"]').click();

    // Theme falls back without touching the saved setting.
    cy.get('body').should('have.css', 'background-color', DARK_BG);
    openDisplayTab();
    cy.get('[data-testid^="theme-locked-"]').should('have.length', 8);
    cy.get('[data-testid="theme-selected-amoled-void"]').should('exist');
  });

  it('clicking a locked theme card opens the Supporter dialog', () => {
    visitApp();
    openDisplayTab();
    cy.get('[data-testid="theme-card-synthwave"]').click({ force: true });
    cy.get('[data-testid="supporter-dialog"]').should('be.visible');
    cy.contains('free, and every feature always will be').should('be.visible');
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
