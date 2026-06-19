/**
 * Rich sticker & poll rendering in the message feed (#213).
 * Stickers render as images and polls as cards, replacing the #204 text labels.
 */
describe('Sticker & Poll rendering', () => {
  const API = 'https://discord.com/api/v10';

  beforeEach(() => {
    cy.login();
    // Serve sticker/poll messages for this channel.
    cy.fixture('sticker-poll-messages.json').then((messages) => {
      cy.intercept('GET', `${API}/channels/*/messages?*`, { statusCode: 200, body: messages }).as('getMessages');
    });
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
    cy.get('[data-testid="message-feed-row"]').should('have.length.greaterThan', 0);
  });

  it('renders a sticker as an image, not a "Sticker:" text label', () => {
    cy.get('img[alt="happy wave"]')
      .should('exist')
      .and('have.attr', 'src')
      .and('include', 'stickers/888000000000000001');
    cy.contains('Sticker: happy wave').should('not.exist');
    cy.contains('(no content)').should('not.exist');
  });

  it('renders a poll as a card with question, options, and vote bars', () => {
    cy.get('[data-testid="inline-poll"]').should('exist');
    cy.contains('[data-testid="inline-poll"]', 'Favorite language?').should('be.visible');
    cy.contains('[data-testid="inline-poll"]', 'TypeScript').should('be.visible');
    cy.contains('[data-testid="inline-poll"]', 'Rust').should('be.visible');
    // Results present → percentages + total.
    cy.contains('[data-testid="inline-poll"]', '75%').should('exist');
    cy.contains('[data-testid="inline-poll"]', '4 votes').should('exist');
    cy.contains('Poll: Favorite language?').should('not.exist');
  });
});
