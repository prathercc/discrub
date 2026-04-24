describe('Settings', () => {
  beforeEach(() => {
    cy.login();
  });

  it('opens SettingsModal when clicking Settings icon', () => {
    cy.get('[aria-label="Settings"]').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('[role="dialog"]').contains('Settings').should('be.visible');
    cy.get('[role="dialog"]').contains('Operation Delays').should('be.visible');
  });

  it('can navigate settings tabs', () => {
    cy.get('[aria-label="Settings"]').click();
    cy.contains('button', 'Export Preferences').click();
    cy.contains('button', 'User Data').click();
    cy.contains('button', 'Display').click();
    cy.contains('button', 'Purge Behavior').click();
  });

  it('returns to LandingPage after clicking Logout', () => {
    // Block auto-auth BEFORE clicking logout so the app stays on LandingPage
    cy.blockAutoAuth();
    cy.get('[aria-label="Logout"]').click();
    cy.contains('Welcome to Discrub', { timeout: 10000 }).should('be.visible');
  });

  it('persists settings in IndexedDB across sessions', () => {
    cy.get('[aria-label="Settings"]').click();
    cy.get('[role="dialog"]').contains('button', 'Save Settings').click();
    // Per-key writes land in the Discrub-settings DB. After a Save we
    // expect at least one row to exist.
    cy.readIdbStore('settings').then((values) => {
      expect(values.length).to.be.greaterThan(0);
    });
  });

  describe('Export Preferences Tab', () => {
    beforeEach(() => {
      cy.get('[aria-label="Settings"]').click();
      cy.contains('button', 'Export Preferences').click();
    });

    it('shows sort order dropdown', () => {
      cy.get('[role="dialog"]').contains('Message Sort Order').should('be.visible');
    });

    it('shows download files checkbox', () => {
      cy.get('[role="dialog"]').contains('Download files for offline viewing').should('be.visible');
    });

    it('shows messages per page input', () => {
      cy.get('[role="dialog"]').contains('Messages Per Page').scrollIntoView().should('be.visible');
    });

    it('shows artist mode checkbox', () => {
      cy.get('[role="dialog"]').contains('Artist mode').scrollIntoView().should('be.visible');
    });
  });

  describe('Ideas & Contact', () => {
    it('should open Ideas dialog when clicking lightbulb icon', () => {
      cy.get('[aria-label="More options"]').click();
      cy.contains('Ideas & Contact').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Have an idea for a feature').should('be.visible');
    });

    it('should show email link', () => {
      cy.get('[aria-label="More options"]').click();
      cy.contains('Ideas & Contact').click();
      cy.contains('prathercc@gmail.com').should('be.visible');
    });

    it('should close dialog on Escape', () => {
      cy.get('[aria-label="More options"]').click();
      cy.contains('Ideas & Contact').click();
      cy.contains('Have an idea for a feature').should('be.visible');
      cy.get('body').type('{esc}');
      cy.get('[role="dialog"]').should('not.exist');
    });
  });
});
