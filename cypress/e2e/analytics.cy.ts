describe('Mention Analytics', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
    cy.contains('[data-testid="message-feed-row"]', 'Hello everyone! Welcome to the server.').should('exist');
  });

  describe('Analytics Button', () => {
    it('should show Analytics button in ServerView toolbar', () => {
      cy.contains('button', 'Analytics').should('be.visible');
    });

    it('should open AnalyticsModal when clicking Analytics', () => {
      cy.contains('button', 'Analytics').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Mention Analytics').should('be.visible');
    });
  });

  describe('AnalyticsModal', () => {
    beforeEach(() => {
      cy.contains('button', 'Analytics').click();
      cy.get('[role="dialog"]').should('be.visible');
    });

    it('should show message count summary', () => {
      cy.get('[role="dialog"]').contains(/across \d+ messages/).should('be.visible');
    });

    it('should show mention counts table with data', () => {
      // Fixture messages contain <@userId> mentions in content
      cy.get('[role="dialog"]').find('table').should('exist');
      cy.get('[role="dialog"]').contains('Username').should('be.visible');
      cy.get('[role="dialog"]').contains('Mentions').should('be.visible');
    });

    it('should show Export CSV button when mentions exist', () => {
      cy.get('[role="dialog"]').contains('button', 'Export CSV').should('be.visible');
    });

    it('should sort by clicking column headers', () => {
      // Click "Username" header to sort by username
      cy.get('[role="dialog"]').contains('Username').click();
      // Table should still be visible (sort changed, no crash)
      cy.get('[role="dialog"]').find('table').should('exist');
    });

    it('should close modal on Close button', () => {
      cy.get('[role="dialog"]').find('[aria-label="Close analytics"]').click();
      cy.get('[role="dialog"]').should('not.exist');
    });

    it('should show skip replies checkbox', () => {
      cy.get('[role="dialog"]').contains('Skip replies').should('be.visible');
    });

    it('should exclude reply messages when skip replies is checked', () => {
      // Fixture has a type 19 reply message with a mention
      cy.get('[role="dialog"]').contains(/across \d+ messages/).invoke('text').then((before) => {
        cy.get('[role="dialog"]').contains('Skip replies').click();
        cy.get('[role="dialog"]').contains(/replies excluded/).should('be.visible');
        cy.get('[role="dialog"]').contains(/across \d+ messages/).invoke('text').should('not.equal', before);
      });
    });
  });
});
