/**
 * Bulk-add reactions (Backlog #202) — additive mirror of reaction removal.
 * Selecting messages → Add Reactions → pick emojis → fan-out PUT .../@me.
 */
describe('Bulk Add Reactions', () => {
  const API = 'https://discord.com/api/v10';

  beforeEach(() => {
    cy.login();
    // Override the default (empty) guild-emoji stub with custom server emojis.
    cy.fixture('guild-emojis.json').then((emojis) => {
      cy.intercept('GET', `${API}/guilds/*/emojis`, { statusCode: 200, body: emojis }).as('getGuildEmojis');
    });
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
    cy.get('[data-testid="message-feed-row"]').should('have.length.greaterThan', 0);
  });

  it('shows the Add Reactions toolbar button, disabled until a message is selected', () => {
    cy.contains('button', 'Add Reactions').should('be.visible').and('be.disabled');
    cy.contains('[data-testid="message-feed-row"]', 'Thanks for setting this up!').scrollIntoView().click();
    cy.contains('button', 'Add Reactions').should('not.be.disabled');
  });

  it('opens the modal and renders the server emoji grid', () => {
    cy.contains('[data-testid="message-feed-row"]', 'Thanks for setting this up!').scrollIntoView().click();
    cy.contains('button', 'Add Reactions').click();
    cy.get('[role="dialog"]').contains('Add Reactions').should('be.visible');
    cy.wait('@getGuildEmojis');
    cy.get('[role="dialog"]').contains("Your server's emojis").should('be.visible');
    cy.get('[role="dialog"]').find('[aria-label=":pepe:"]').should('exist');
  });

  it('adds a server emoji + a pasted unicode emoji to a selected message', () => {
    cy.intercept(
      { method: 'PUT', url: /\/channels\/\d+\/messages\/\d+\/reactions\/.+\/@me/ },
      { statusCode: 204, body: {} }
    ).as('addReaction');

    cy.contains('[data-testid="message-feed-row"]', 'Thanks for setting this up!').scrollIntoView().click();
    cy.contains('button', 'Add Reactions').click();
    cy.get('[role="dialog"]').should('be.visible');

    // Pick the custom server emoji.
    cy.get('[role="dialog"]').find('[aria-label=":pepe:"]').click();
    // Add a unicode emoji via the paste escape hatch.
    cy.get('[role="dialog"]').find('[aria-label="Paste an emoji or shortcode"]').type(':fire:');
    cy.get('[role="dialog"]').contains('button', 'Add').first().click();

    // Live cost reflects 1 message × 2 emojis.
    cy.get('[role="dialog"]').contains('1 message × 2 emojis = 2 reactions').should('be.visible');

    // Confirm.
    cy.get('[role="dialog"]').contains('button', /^Add 2/).click();

    cy.wait('@addReaction');
    cy.wait('@addReaction');
    cy.get('@addReaction.all').should('have.length', 2);
    // Modal closes after confirm.
    cy.get('[role="dialog"]').should('not.exist');
  });

  it('surfaces a permission failure in the status log without aborting', () => {
    cy.intercept(
      { method: 'PUT', url: /\/channels\/\d+\/messages\/\d+\/reactions\/.+\/@me/ },
      { statusCode: 403, body: { message: 'Missing Permissions', code: 50013 } }
    ).as('addReactionForbidden');

    cy.contains('[data-testid="message-feed-row"]', 'Thanks for setting this up!').scrollIntoView().click();
    cy.contains('button', 'Add Reactions').click();
    cy.get('[role="dialog"]').find('[aria-label="Paste an emoji or shortcode"]').type(':fire:');
    cy.get('[role="dialog"]').contains('button', 'Add').first().click();
    cy.get('[role="dialog"]').contains('button', /^Add 1/).click();

    cy.wait('@addReactionForbidden');
    // Plain-language skip copy is logged (status panel may be collapsed, so assert existence).
    cy.contains('no permission to react').should('exist');
  });
});
