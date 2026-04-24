describe('Theme Toggle', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
  });

  it('theme toggle button is visible in TopBar', () => {
    cy.get('[aria-label="Toggle theme"]').should('be.visible');
  });

  it('clicking theme toggle cycles mode and changes icon', () => {
    // Default is 'auto' — icon should be BrightnessAuto (AutoModeIcon)
    cy.get('[aria-label="Toggle theme"]').find('[data-testid="BrightnessAutoIcon"]').should('exist');

    // Click once: auto → dark
    cy.get('[aria-label="Toggle theme"]').click({ force: true });
    cy.get('[aria-label="Toggle theme"]').find('[data-testid="DarkModeIcon"]').should('exist');

    // Click again: dark → light
    cy.get('[aria-label="Toggle theme"]').click({ force: true });
    cy.get('[aria-label="Toggle theme"]').find('[data-testid="LightModeIcon"]').should('exist');

    // Click again: light → auto (full cycle)
    cy.get('[aria-label="Toggle theme"]').click({ force: true });
    cy.get('[aria-label="Toggle theme"]').find('[data-testid="BrightnessAutoIcon"]').should('exist');
  });

  it('app renders correctly in light mode with different background', () => {
    // Cycle to light mode: auto → dark → light. Wait for the icon to
    // update between clicks — the optimistic Redux update is synchronous,
    // but the DOM re-render takes a tick. Without the wait, rapid
    // sequential clicks can land before React re-renders the new closure
    // and the cycle skips a step (flaky in full-suite runs).
    cy.get('[aria-label="Toggle theme"]').click({ force: true });
    cy.get('[aria-label="Toggle theme"]').find('[data-testid="DarkModeIcon"]').should('exist');
    cy.get('[aria-label="Toggle theme"]').click({ force: true });
    cy.get('[aria-label="Toggle theme"]').find('[data-testid="LightModeIcon"]').should('exist');

    // In light mode the body background should be lighter than dark mode defaults
    cy.get('body').should('have.css', 'background-color').and('not.eq', 'rgb(0, 0, 0)');
  });

  it('theme mode updates after toggle', () => {
    // Cycle to dark mode: auto → dark
    cy.get('[aria-label="Toggle theme"]').click({ force: true });
    cy.get('[aria-label="Toggle theme"]').find('[data-testid="DarkModeIcon"]').should('exist');

    // Cycle to light: dark → light
    cy.get('[aria-label="Toggle theme"]').click({ force: true });
    cy.get('[aria-label="Toggle theme"]').find('[data-testid="LightModeIcon"]').should('exist');
  });
});
