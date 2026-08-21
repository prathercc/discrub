/**
 * Theme switching from the Themes hub (the gift-button dialog). The
 * old TopBar cycle button was retired when the hub took over as the
 * single theme-switching surface.
 */

const DARK_BG = 'rgb(30, 33, 36)'; // discord-dark background.default
const LIGHT_BG = 'rgb(255, 255, 255)'; // discord-light background.default
const TERMINAL_BG = 'rgb(10, 15, 10)'; // terminal background.default

describe('Theme switching from the hub', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
  });

  const openHub = () => {
    cy.get('[data-testid="gift-button"]').click();
    cy.get('[data-testid="supporter-theme-showcase"]').should('be.visible');
  };

  it('the gift button opens the hub with the full theme grid', () => {
    openHub();
    cy.get('[data-testid="theme-card-auto"]').should('be.visible');
    cy.get('[data-testid="theme-card-discord-light"]').should('be.visible');
    // All 8 supporter themes locked for a free user.
    cy.get('[data-testid="supporter-theme-showcase"] [data-testid^="theme-locked-"]').should(
      'have.length',
      8,
    );
  });

  it('picking a free theme applies instantly and persists after closing', () => {
    openHub();
    cy.get('[data-testid="theme-card-discord-light"]').click();
    cy.get('body').should('have.css', 'background-color', LIGHT_BG);
    cy.get('[aria-label="Close Supporter dialog"]').click();
    cy.get('body').should('have.css', 'background-color', LIGHT_BG);
  });

  it('hover previews live and reverts only when the pointer leaves the grid', () => {
    openHub();
    // Deterministic baseline — 'auto' resolves differently per browser.
    cy.get('[data-testid="theme-card-discord-dark"]').click();
    cy.get('body').should('have.css', 'background-color', DARK_BG);

    cy.get('[data-testid="theme-card-terminal"]').trigger('mouseover');
    cy.get('body').should('have.css', 'background-color', TERMINAL_BG);
    // Crossing to another card must NOT flash the saved theme in.
    cy.get('[data-testid="theme-card-overcast"]').trigger('mouseover');
    cy.get('body').should('not.have.css', 'background-color', DARK_BG);
    // Leaving the grid entirely reverts to the selection.
    cy.get('[data-testid="theme-card-overcast"]').trigger('mouseout');
    cy.get('body').should('have.css', 'background-color', DARK_BG);
  });

  it('locked supporter cards preview on hover but stay inert on click', () => {
    openHub();
    cy.get('[data-testid="theme-card-discord-dark"]').click();
    cy.get('[data-testid="theme-card-amoled-void"]').trigger('mouseover');
    cy.get('body').should('have.css', 'background-color', 'rgb(0, 0, 0)');
    cy.get('[data-testid="theme-card-amoled-void"]').click();
    cy.get('[data-testid="supporter-dialog"]').should('be.visible');
    cy.get('[data-testid="theme-card-amoled-void"]').trigger('mouseout');
    cy.get('[aria-label="Close Supporter dialog"]').click();
    cy.get('body').should('have.css', 'background-color', DARK_BG);
  });
});
