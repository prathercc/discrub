describe('Focused View Mode', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
  });

  it('Focus button is visible in the channel toolbar', () => {
    cy.get('[data-testid="focus-mode-toggle"]')
      .should('be.visible')
      .and('contain.text', 'Focus');
  });

  it('clicking Focus hides TopBar, Sidebar, StatusPanel, and DonationDrawer', () => {
    // Chrome is present before toggling.
    cy.get('[data-testid="topbar"], header').should('exist');

    cy.get('[data-testid="focus-mode-toggle"]').click({ force: true });

    // Redux reflects the toggle.
    cy.window().then((win) => {
      const store = (win as any).__store__;
      expect(store.getState().app.focusedView).to.equal(true);
    });

    // Exit-focus button is the user's escape hatch.
    cy.get('[data-testid="exit-focus-button"]').should('be.visible');

    // Feed-side controls the user specifically asked to keep stay mounted.
    cy.get('[data-testid="search-filters-button"]').should('exist');
    cy.get('[data-tour="export-button"]').should('exist');
  });

  it('exit-focus button restores chrome', () => {
    cy.get('[data-testid="focus-mode-toggle"]').click({ force: true });
    cy.get('[data-testid="exit-focus-button"]').should('be.visible');

    cy.get('[data-testid="exit-focus-button"]').click({ force: true });

    cy.window().then((win) => {
      const store = (win as any).__store__;
      expect(store.getState().app.focusedView).to.equal(false);
    });
    cy.get('[data-testid="exit-focus-button"]').should('not.exist');
  });

  it('F key toggles focus mode when not focused in an input', () => {
    cy.get('body').trigger('keydown', { key: 'f' });
    cy.window().then((win) => {
      const store = (win as any).__store__;
      expect(store.getState().app.focusedView).to.equal(true);
    });

    cy.get('body').trigger('keydown', { key: 'f' });
    cy.window().then((win) => {
      const store = (win as any).__store__;
      expect(store.getState().app.focusedView).to.equal(false);
    });
  });

  it('Escape exits focus mode', () => {
    cy.get('[data-testid="focus-mode-toggle"]').click({ force: true });
    cy.get('[data-testid="exit-focus-button"]').should('be.visible');

    cy.get('body').trigger('keydown', { key: 'Escape' });
    cy.window().then((win) => {
      const store = (win as any).__store__;
      expect(store.getState().app.focusedView).to.equal(false);
    });
  });

  it('toggle button flips between Focus and Exit Focus labels', () => {
    cy.get('[data-testid="focus-mode-toggle"]').should('contain.text', 'Focus');
    cy.get('[data-testid="focus-mode-toggle"]').click({ force: true });
    cy.get('[data-testid="focus-mode-toggle"]').should(
      'contain.text',
      'Exit Focus',
    );
  });
});
