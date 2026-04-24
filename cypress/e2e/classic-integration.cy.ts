/**
 * Classic Integration tests
 *
 * Tests the Discrub Classic integration features that are testable outside
 * of extension context: renamed references, version switcher visibility,
 * WelcomePanel Classic section, and the launcher splash screen version label.
 *
 * Note: Classic iframe embed and token injection require Chrome extension
 * context and must be tested manually or with extension-specific tooling.
 */
describe('Discrub Classic Integration', () => {
  describe('Rename: "Discrub v1" → "Discrub Classic"', () => {
    beforeEach(() => {
      cy.login();
    });

    it('WelcomePanel shows "Coming from Classic?" not "v1"', () => {
      cy.contains('Coming from Classic?').should('be.visible');
      cy.contains('Coming from v1?').should('not.exist');
    });

    it('WelcomePanel shows "Coming from Discrub Classic?" in the section', () => {
      cy.contains('Coming from Discrub Classic?').scrollIntoView().should('be.visible');
      cy.contains('Coming from Discrub v1?').should('not.exist');
    });

    it('WelcomePanel mentions Classic as built-in option', () => {
      cy.contains('Discrub Classic as a built-in option').scrollIntoView().should('be.visible');
    });
  });

  describe('Version Switcher Pill', () => {
    beforeEach(() => {
      cy.login();
    });

    it('should not show version switcher pill in web mode', () => {
      // In web mode (non-extension), the switcher pill should not be visible
      cy.contains('Switch to Classic').should('not.exist');
    });
  });

  describe('Launcher Splash Version Label', () => {
    it('renders the web option as "Discrub v{version}" from package.json', () => {
      cy.readFile('package.json').then((pkg) => {
        cy.request('/launcher.html').then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.contain(
            `<option value="web">Discrub v${pkg.version}</option>`
          );
          expect(response.body).not.to.contain('__APP_VERSION__');
          expect(response.body).not.to.contain('Modern interface');
        });
      });
    });

    it('renders the classic option as "Discrub v{classicVersion} (Classic)" from the classic manifest', () => {
      cy.readFile('public/classic-chrome/manifest.json').then((manifest) => {
        cy.request('/launcher.html').then((response) => {
          expect(response.body).to.contain(
            `<option value="classic">Discrub v${manifest.version} (Classic)</option>`
          );
          expect(response.body).not.to.contain('Original experience');
          expect(response.body).not.to.contain('__CLASSIC_VERSION__');
        });
      });
    });
  });

  describe('Storage Namespace', () => {
    it('should use namespaced per-purpose IDB databases', () => {
      cy.login();
      cy.selectServer('Cypress Test Server');
      cy.selectChannel('general');
      // Open Settings + Save so a setting write actually fires.
      cy.get('[aria-label="Settings"]').click();
      cy.get('[role="dialog"]').contains('button', 'Save Settings').click();

      // Settings are persisted as per-key rows in the Discrub-settings DB.
      // Verify at least one row exists rather than asserting on the legacy
      // single-blob shape.
      cy.readIdbStore('settings').then((values) => {
        expect(values.length).to.be.greaterThan(0);
      });
    });

    it('should not use legacy storage key in localStorage', () => {
      cy.login();
      cy.window().then((win) => {
        const legacy = win.localStorage.getItem('discrub-settings');
        expect(legacy).to.be.null;
      });
    });
  });
});
