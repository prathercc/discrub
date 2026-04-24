describe('DM Browsing', () => {
  beforeEach(() => {
    cy.login();
  });

  it('switches to DM list when clicking "DMs" tab', () => {
    cy.contains('button', 'DMs').click();
    cy.contains('Direct Messages').should('be.visible');
  });

  it('shows DM recipients from fixture', () => {
    cy.contains('button', 'DMs').click();
    cy.wait('@getDMs');
    cy.contains('alice_dev').should('be.visible');
    cy.contains('bob_gamer').should('be.visible');
    cy.contains('charlie_mod').should('be.visible');
  });

  it('filters DM list when searching', () => {
    cy.contains('button', 'DMs').click();
    cy.wait('@getDMs');
    cy.get('input[placeholder="Search DMs..."]').type('alice');
    cy.contains('alice_dev').should('be.visible');
    cy.contains('bob_gamer').should('not.exist');
  });

  it('loads DM messages and shows header after selecting a DM', () => {
    cy.selectDm('alice_dev');
    cy.contains('Direct Message').should('be.visible');
    cy.contains('[data-testid="message-feed-row"]', 'Hey, did you see the latest build?').should('exist');
  });

  it('shows message action buttons for DM messages', () => {
    cy.selectDm('alice_dev');
    cy.contains('0 selected').should('be.visible');
    cy.contains('button', 'Delete').should('exist');
    cy.contains('button', 'Edit').should('exist');
  });
});
