describe('Message Operations', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
    // Wait for messages to render
    cy.contains('[data-testid="message-feed-row"]', 'Sounds good, deploying now.').should('exist');
  });

  it('shows "1 selected" chip after clicking a message row', () => {
    // Click the table row directly (rows have onClick → toggleMessageSelection)
    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('1 selected').should('be.visible');
  });

  it('enables Delete and Edit with a single selection', () => {
    cy.contains('button', 'Delete').should('be.disabled');
    cy.contains('button', 'Edit').should('be.disabled');

    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();

    cy.contains('button', 'Delete').should('not.be.disabled');
    cy.contains('button', 'Edit').should('not.be.disabled');
  });

  it('opens EditMessageModal when clicking Edit', () => {
    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('button', 'Edit').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('Edit Message').should('be.visible');
    cy.get('[role="dialog"]').find('textarea').should('exist');
  });

  it('sends PATCH request when saving edited message', () => {
    cy.fixture('message-edited.json').then((editedMsg) => {
      cy.intercept('PATCH', '**/api/v10/channels/*/messages/*', {
        statusCode: 200,
        body: editedMsg,
      }).as('editMessage');
    });

    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('button', 'Edit').click();
    cy.get('[role="dialog"]').find('textarea').first().clear().type('Updated content');
    cy.get('[role="dialog"]').contains('button', 'Save').click();
    cy.wait('@editMessage');
  });

  it('opens DeleteConfirmModal with "Delete Messages" title', () => {
    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('button', 'Delete').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('Delete Messages').should('be.visible');
    cy.contains('This action cannot be undone.').should('be.visible');
  });

  it('closes delete modal without removing message when cancelling', () => {
    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('button', 'Delete').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('[role="dialog"]').contains('button', 'Cancel').click();
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('[data-testid="message-feed-row"]', 'Sounds good, deploying now.').should('exist');
  });

  it('keeps Edit and Delete enabled with multi-message selection', () => {
    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('[data-testid="message-feed-row"]',"Let's ship it!").click();
    cy.contains('2 selected').should('be.visible');
    cy.contains('button', 'Edit').should('not.be.disabled');
    cy.contains('button', 'Delete').should('not.be.disabled');
  });
});
