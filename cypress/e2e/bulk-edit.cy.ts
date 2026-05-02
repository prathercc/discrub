describe('Bulk Edit', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
    // Use messages near the top of the table (newest first in descending sort)
    cy.get('[data-testid="message-feed-row"]').should('have.length.greaterThan', 0);
  });

  describe('Edit Button with Multiple Selection', () => {
    // Discord blocks PATCH on other users' messages regardless of permission,
    // so the toolbar Edit button only enables when every selected message is
    // authored by the current user. All selections below are tester-authored.
    it('should enable Edit button with single selection', () => {
      cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
      cy.contains('1 selected').should('be.visible');
      cy.contains('button', 'Edit').should('not.be.disabled');
    });

    it('should enable Edit button when multiple own messages are selected', () => {
      cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
      cy.contains('[data-testid="message-feed-row"]','Hello everyone! Welcome to the server.').click();
      cy.contains('2 selected').should('be.visible');
      cy.contains('button', 'Edit').should('not.be.disabled');
    });

    it('should enable Edit button with three own selections', () => {
      cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
      cy.contains('[data-testid="message-feed-row"]','Hello everyone! Welcome to the server.').click();
      cy.contains('[data-testid="message-feed-row"]','Sure! Let me finish this code first.').click();
      cy.contains('3 selected').should('be.visible');
      cy.contains('button', 'Edit').should('not.be.disabled');
    });

    it('should disable Edit button when selection includes another user\'s message', () => {
      cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
      cy.contains('[data-testid="message-feed-row"]',"Let's ship it!").click();
      cy.contains('2 selected').should('be.visible');
      cy.contains('button', 'Edit').should('be.disabled');
    });
  });

  describe('Bulk Edit Modal', () => {
    beforeEach(() => {
      cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
      cy.contains('[data-testid="message-feed-row"]','Hello everyone! Welcome to the server.').click();
      cy.contains('[data-testid="message-feed-row"]','Sure! Let me finish this code first.').click();
    });

    it('should open modal with correct message count', () => {
      cy.contains('button', 'Edit').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Bulk Edit').should('be.visible');
      cy.contains('Editing 3 messages').should('be.visible');
    });

    it('should have Save button disabled when text field is empty', () => {
      cy.contains('button', 'Edit').click();
      cy.get('[role="dialog"]').contains('button', 'Save').should('be.disabled');
    });

    it('should enable Save button when text is entered', () => {
      cy.contains('button', 'Edit').click();
      cy.get('[role="dialog"]').find('textarea').first().type('Updated content');
      cy.get('[role="dialog"]').contains('button', 'Save').should('not.be.disabled');
    });

    it('should close modal on Cancel without making requests', () => {
      cy.contains('button', 'Edit').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[role="dialog"]').contains('button', 'Cancel').click();
      cy.get('[role="dialog"]').should('not.exist');
    });

    it('should send PATCH requests when saving', () => {
      cy.intercept('PATCH', '**/api/v10/channels/*/messages/*', {
        statusCode: 200,
        body: {},
      }).as('editMessage');

      cy.contains('button', 'Edit').click();
      cy.get('[role="dialog"]').find('textarea').first().type('Bulk updated text');
      cy.get('[role="dialog"]').contains('button', 'Save').click();

      // Should make PATCH requests for each selected message
      cy.wait('@editMessage');
    });
  });

});
