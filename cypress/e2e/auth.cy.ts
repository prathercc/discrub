describe('Authentication', () => {
  describe('Landing Page (auto-auth blocked)', () => {
    beforeEach(() => {
      // Block auto-auth so we can test the landing page
      cy.blockAutoAuth();
      cy.visit('/');
      // Wait for any auto-auth attempt to fail and the landing page to settle
      cy.contains('Welcome to Discrub', { timeout: 10000 }).should('be.visible');
    });

    it('shows "Welcome to Discrub" heading on load', () => {
      cy.contains('Welcome to Discrub').should('be.visible');
    });

    it('shows token input as password type with "Discord Token" label', () => {
      cy.get('input[type="password"]').should('exist');
      cy.contains('Discord Token').should('exist');
    });

    it('disables "Sign In" button when token field is cleared', () => {
      cy.get('input[type="password"]').clear();
      cy.get('button[type="submit"]').should('be.disabled');
    });

    it('shows error helper text on invalid token', () => {
      cy.get('input[type="password"]').clear().type('bad-token', { log: false });
      cy.get('button[type="submit"]').click();
      cy.contains('Invalid token').should('be.visible');
    });

    it('has "How to find my Discord token?" link with correct href', () => {
      cy.contains('How to find my Discord token?')
        .should('have.attr', 'href')
        .and('include', 'github.com/prathercc/discrub');
    });

    it('shows disclaimer text', () => {
      cy.contains('This is an unofficial tool').should('be.visible');
    });
  });

  describe('Successful login', () => {
    it('shows TopBar with username after valid token auto-auth', () => {
      cy.interceptDiscordApi();
      cy.visit('/');
      // The env token triggers auto-auth; intercept responds with valid user
      cy.contains('Discrub Tester', { timeout: 15000 }).should('be.visible');
    });
  });
});
