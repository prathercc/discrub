const DARK_BG = 'rgb(30, 33, 36)'; // discord-dark background.default (#1e2124)
const LIGHT_BG = 'rgb(255, 255, 255)'; // discord-light background.default (#ffffff)

describe('Theme Picker', () => {
  beforeEach(() => {
    cy.login();
  });

  function openDisplayTab() {
    cy.get('[aria-label="Settings"]').click();
    cy.get('[role="dialog"]', { timeout: 5000 }).should('be.visible');
    cy.contains('button', 'Display').click();
    cy.get('[data-testid="theme-picker"]').should('be.visible');
  }

  it('renders the Auto card plus both Discord themes with Auto selected by default', () => {
    openDisplayTab();
    cy.get('[data-testid="theme-card-auto"]').should('be.visible');
    cy.get('[data-testid="theme-card-discord-dark"]').should('be.visible');
    cy.get('[data-testid="theme-card-discord-light"]').should('be.visible');
    cy.get('[data-testid="theme-selected-auto"]').should('exist');
  });

  it('hover previews a theme live and mouse-out reverts to the current selection', () => {
    openDisplayTab();
    // Pin a deterministic baseline first — 'auto' resolves differently
    // per test browser. Clicking selects AND previews discord-dark.
    cy.get('[data-testid="theme-card-discord-dark"]').click();
    cy.get('body').should('have.css', 'background-color', DARK_BG);

    cy.get('[data-testid="theme-card-discord-light"]').trigger('mouseover');
    cy.get('body').should('have.css', 'background-color', LIGHT_BG);

    cy.get('[data-testid="theme-card-discord-light"]').trigger('mouseout');
    cy.get('body').should('have.css', 'background-color', DARK_BG);
  });

  it('saving a picked theme persists it and keeps it applied', () => {
    openDisplayTab();
    cy.get('[data-testid="theme-card-discord-light"]').click();
    cy.get('body').should('have.css', 'background-color', LIGHT_BG);

    cy.get('[role="dialog"]').contains('button', 'Save Settings').click();
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('body').should('have.css', 'background-color', LIGHT_BG);

    // Reopen — the saved theme shows as selected and the TopBar quick
    // toggle reflects the light base.
    cy.get('[aria-label="Toggle theme"]').find('[data-testid="LightModeIcon"]').should('exist');
    openDisplayTab();
    cy.get('[data-testid="theme-selected-discord-light"]').should('exist');
  });

  it('discarding edits drops the live preview and reverts to the saved theme', () => {
    openDisplayTab();
    // Save dark first so the saved baseline is deterministic.
    cy.get('[data-testid="theme-card-discord-dark"]').click();
    cy.get('[role="dialog"]').contains('button', 'Save Settings').click();
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('body').should('have.css', 'background-color', DARK_BG);

    // Pick light but discard instead of saving.
    openDisplayTab();
    cy.get('[data-testid="theme-card-discord-light"]').click();
    cy.get('body').should('have.css', 'background-color', LIGHT_BG);
    cy.contains('button', /^Cancel$/).click();
    cy.contains('Discard unsaved changes?').should('be.visible');
    cy.contains('button', 'Discard').click();
    cy.get('body').should('have.css', 'background-color', DARK_BG);
  });

  it('shows the full v2.1.0 roster with supporter themes locked', () => {
    openDisplayTab();
    // Auto card + 14 registry themes
    cy.get('[data-testid^="theme-card-"]').should('have.length', 15);
    // All 8 supporter themes are locked pre-supporter-platform
    cy.get('[data-testid^="theme-locked-"]').should('have.length', 8);

    // Locked themes still hover-preview live...
    cy.get('[data-testid="theme-card-amoled-void"]').trigger('mouseover');
    cy.get('body').should('have.css', 'background-color', 'rgb(0, 0, 0)');

    // ...but clicking cannot select them.
    cy.get('[data-testid="theme-card-amoled-void"]').click({ force: true });
    cy.get('[data-testid="theme-selected-amoled-void"]').should('not.exist');
  });

  it('supporter theme preview shows the animated accent strip', () => {
    openDisplayTab();
    cy.get('[data-testid="theme-accent-strip"]').should('not.exist');
    cy.get('[data-testid="theme-card-synthwave"]').trigger('mouseover');
    cy.get('[data-testid="theme-accent-strip"]').should('exist');
    cy.get('[data-testid="theme-card-synthwave"]').trigger('mouseout');
    cy.get('[data-testid="theme-accent-strip"]').should('not.exist');
  });

  it('theme animations toggle persists through save', () => {
    openDisplayTab();
    cy.get('input[aria-label="Theme animations"]').should('be.checked');
    cy.get('input[aria-label="Theme animations"]').click();
    cy.get('input[aria-label="Theme animations"]').should('not.be.checked');
    cy.get('[role="dialog"]').contains('button', 'Save Settings').click();
    cy.get('[role="dialog"]').should('not.exist');

    openDisplayTab();
    cy.get('input[aria-label="Theme animations"]').should('not.be.checked');
  });
});
