/**
 * Embed rendering E2E tests — now covers both inline feed rendering and
 * the EmbedModal that's opened from the MessageActions toolbar when a
 * single message is selected.
 *
 * The live feed renders embeds inline inside the message row; the modal
 * exists as a focus/bigger-view affordance.
 */

describe('Embed Rendering', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
    cy.contains('[data-testid="message-feed-row"]', 'Check out this cool project').should('exist');
  });

  describe('Inline rendering (feed)', () => {
    it('renders the embed title and description inline for messages with embeds', () => {
      // "Check out this cool project" fixture message carries a full embed
      cy.contains('[data-testid="message-feed-row"]', 'Check out this cool project').within(() => {
        cy.contains('example/project').should('exist');
      });
    });

    it('does not render an embed card for messages without embeds', () => {
      cy.contains('[data-testid="message-feed-row"]', 'Hello everyone')
        .find('.MuiCard-root')
        .should('not.exist');
    });
  });

  describe('EmbedModal (MessageActions toolbar)', () => {
    const openModal = () => {
      cy.contains('[data-testid="message-feed-row"]', 'Check out this cool project').click();
      cy.contains('button', /Embeds \(\d+\)/).click();
    };

    it('opens when clicking the Embeds button in the toolbar', () => {
      openModal();
      cy.contains('Embeds (1)').should('be.visible');
    });

    it('displays embed title as a link', () => {
      openModal();
      cy.get('.MuiDialog-root a[href="https://github.com/example/project"]')
        .should('contain.text', 'example/project');
    });

    it('renders bold markdown in embed description', () => {
      openModal();
      cy.get('.MuiDialog-root strong').contains('cool').should('be.visible');
    });

    it('renders masked links in embed description', () => {
      openModal();
      cy.get('.MuiDialog-root a[href="https://docs.example.com"]')
        .should('contain.text', 'docs');
    });

    it('resolves channel mentions in embed description', () => {
      openModal();
      cy.get('.MuiDialog-root .channel-mention').should('exist');
    });

    it('renders embed fields', () => {
      openModal();
      cy.get('.MuiDialog-root').within(() => {
        cy.contains('Status').should('exist');
        cy.contains('Contributors').should('exist');
      });
    });

    it('renders embed footer', () => {
      openModal();
      cy.get('.MuiDialog-root').contains('GitHub').should('be.visible');
    });

    it('closes when the Cancel button is clicked', () => {
      openModal();
      cy.get('.MuiDialog-root').should('be.visible');
      cy.get('.MuiDialog-root').contains('button', 'Cancel').click();
      cy.get('.MuiDialog-root').should('not.exist');
    });
  });
});
