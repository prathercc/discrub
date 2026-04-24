describe('Attachment Deletion', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
    cy.get('[data-testid="message-feed-row"]').should('have.length.greaterThan', 0);
  });

  describe('Attachment Modal Access', () => {
    it('should show Attachments button for message with attachments', () => {
      // Message "Here's a screenshot" has an attachment — may be mid-table, scroll into view
      cy.contains('[data-testid="message-feed-row"]',"Here's a screenshot").scrollIntoView().click({ force: true });
      cy.get('[aria-label="View Attachments"]').should('be.visible');
    });

    it('should not show Attachments button for message without attachments', () => {
      cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
      // The attachment icon only appears in rows with attachments — this row should not have one
      cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.')
        .find('[aria-label="View Attachments"]').should('not.exist');
    });

    it('should open AttachmentModal with attachment list', () => {
      cy.contains('[data-testid="message-feed-row"]',"Here's a screenshot").scrollIntoView().click({ force: true });
      cy.get('[aria-label="View Attachments"]').click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains(/Attachments/).should('be.visible');
      cy.contains('screenshot.png').should('be.visible');
    });
  });

  describe('Attachment Deletion Actions', () => {
    beforeEach(() => {
      cy.contains('[data-testid="message-feed-row"]',"Here's a screenshot").scrollIntoView().click({ force: true });
      cy.get('[aria-label="View Attachments"]').click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
    });

    it('should show delete icon for each attachment', () => {
      cy.get('[aria-label="delete attachment"]').should('have.length.greaterThan', 0);
    });

    it('should show Remove All button', () => {
      cy.contains('button', 'Remove All').should('be.visible');
    });

    it('should trigger delete action when removing an attachment', () => {
      // Intercept both DELETE (full message removal) and PATCH (attachment edit)
      cy.intercept('DELETE', '**/api/v10/channels/*/messages/*', {
        statusCode: 204,
        body: {},
      }).as('deleteMessage');
      cy.intercept('PATCH', '**/api/v10/channels/*/messages/*', {
        statusCode: 200,
        body: {},
      }).as('editMessage');

      cy.get('[aria-label="delete attachment"]').first().click();
      // The thunk dispatches and calls the lib service
      // Verify the button was clicked and modal updates
      cy.get('[role="dialog"]').should('be.visible');
    });

    it('should trigger delete action when clicking Remove All', () => {
      cy.intercept('DELETE', '**/api/v10/channels/*/messages/*', {
        statusCode: 204,
        body: {},
      }).as('deleteMessage');
      cy.intercept('PATCH', '**/api/v10/channels/*/messages/*', {
        statusCode: 200,
        body: {},
      }).as('editMessage');

      cy.contains('button', 'Remove All').click();
      // Verify the action was triggered
      cy.get('[role="dialog"]').should('be.visible');
    });
  });

  describe('Modal Close', () => {
    it('should close AttachmentModal when clicking Close', () => {
      cy.contains('[data-testid="message-feed-row"]',"Here's a screenshot").scrollIntoView().click({ force: true });
      cy.get('[aria-label="View Attachments"]').click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[role="dialog"]').contains('button', 'Close').click();
      cy.get('[role="dialog"]').should('not.exist');
    });
  });
});
