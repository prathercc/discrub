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
    cy.get('[data-testid="landing-sign-in"]', { timeout: 10000 }).should('be.visible');
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

  // ─── Unsaved-changes prompt (#164) ───────────────────────────────
  // Cancel/X/backdrop/Esc all route through handleClose; when there
  // are unsaved edits, a confirmation appears before discarding.
  // Save Settings bypasses the prompt because the changes are
  // committing, not being thrown away.
  describe('unsaved-changes prompt', () => {
    function openWithEdit() {
      cy.get('[aria-label="Settings"]').click();
      cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
      // Toggle the Hotkeys master switch to dirty the form. Using the
      // hotkeys form rather than an AppSettings field keeps the test
      // self-contained — no dependency on the exact controls in any
      // particular tab.
      cy.contains('button', 'Hotkeys').click();
      cy.get('input[aria-label="Enable hotkeys"]').click();
    }

    it('Cancel with unsaved changes shows the prompt', () => {
      openWithEdit();
      cy.contains('button', /^Cancel$/).click();
      cy.contains('Discard unsaved changes?').should('be.visible');
      cy.contains('button', 'Keep editing').should('be.visible');
      cy.contains('button', 'Discard').should('be.visible');
    });

    it('Keep editing returns to the dialog with edits intact', () => {
      openWithEdit();
      cy.contains('button', /^Cancel$/).click();
      cy.contains('button', 'Keep editing').click();
      cy.contains('Discard unsaved changes?').should('not.exist');
      // Settings dialog still open + the toggle is still off in the
      // form (the edit wasn't reverted).
      cy.contains('button', 'Save Settings').should('be.visible');
      cy.get('input[aria-label="Enable hotkeys"]').should('not.be.checked');
    });

    it('Discard closes the dialog and reverts the form on next open', () => {
      openWithEdit();
      cy.contains('button', /^Cancel$/).click();
      cy.contains('button', 'Discard').click();
      cy.contains('button', 'Save Settings').should('not.exist');
      // Reopen — the form should be re-synced from Redux, so the
      // toggle is back to its default ON state.
      cy.get('[aria-label="Settings"]').click();
      cy.contains('button', 'Hotkeys').click();
      cy.get('input[aria-label="Enable hotkeys"]').should('be.checked');
    });

    it('Cancel with no edits closes immediately, no prompt', () => {
      cy.get('[aria-label="Settings"]').click();
      cy.contains('button', /^Cancel$/).click();
      cy.contains('Discard unsaved changes?').should('not.exist');
      cy.contains('button', 'Save Settings').should('not.exist');
    });

    it('Save Settings bypasses the prompt and persists', () => {
      openWithEdit();
      cy.contains('button', 'Save Settings').click();
      cy.contains('Discard unsaved changes?').should('not.exist');
      cy.contains('button', 'Save Settings').should('not.exist');
      // The change actually persisted in Redux.
      cy.window().should((win) => {
        expect((win as any).__store__.getState().hotkeys.enabled).to.equal(false);
      });
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
