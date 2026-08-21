/**
 * 2.1.0 mobile shell: below `md` the sidebar is a hamburger-opened
 * drawer, the Ko-fi wall is an on-demand overlay, the TopBar folds
 * Settings/Logout into the More menu below `sm`, and nothing scrolls
 * sideways at 390px.
 */
const PHONE: [number, number] = [390, 844];

const noHorizontalOverflow = () =>
  cy.document().its('documentElement').then((el) => {
    expect(el.scrollWidth, 'page scrollWidth').to.eq(el.clientWidth);
  });

// cy.login() waits for the username text, which the compact TopBar hides
// below `sm`; the hamburger is the phone's "layout is up" signal.
const loginPhone = () => {
  cy.viewport(...PHONE);
  cy.interceptDiscordApi();
  cy.visit('/');
  cy.get('[data-testid="sidebar-menu-button"]', { timeout: 15000 }).should('be.visible');
};

describe('Mobile shell (390x844)', () => {
  beforeEach(() => {
    loginPhone();
  });

  it('hides the sidebar behind a hamburger and closes it on channel select', () => {
    cy.get('[data-testid="sidebar-drawer"]').should('not.be.visible');
    noHorizontalOverflow();

    cy.get('[data-testid="sidebar-menu-button"]').click();
    cy.get('[data-testid="sidebar-drawer"]').should('be.visible');
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');

    cy.get('[data-testid="sidebar-drawer"]').should('not.be.visible');
    cy.get('[data-testid="message-feed"]').should('be.visible');
    noHorizontalOverflow();
  });

  it('keeps Export reachable and folds Settings + Logout into the More menu', () => {
    cy.get('[data-testid="sidebar-menu-button"]').click();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');

    cy.contains('button', 'Export').should('be.visible').then(($b) => {
      expect($b[0].getBoundingClientRect().right).to.be.at.most(PHONE[0]);
    });

    cy.get('button[aria-label="Settings"]').should('not.exist');
    cy.get('button[aria-label="Logout"]').should('not.exist');
    cy.get('button[aria-label="More options"]').click();
    cy.get('[data-testid="more-menu-settings"]').click();
    cy.contains('Operation Delays').should('be.visible');
  });

  it('shows the Ko-fi wall as an overlay only on demand', () => {
    cy.get('[data-testid="donation-drawer"]').should('not.exist');
    cy.get('button[aria-label="More options"]').click();
    cy.contains('li', 'Supporter Wall').click();
    cy.get('[data-testid="donation-drawer"]').should('be.visible');
    cy.get('.MuiBackdrop-root').last().click({ force: true });
    cy.get('[data-testid="donation-drawer"]').should('not.exist');
  });
});

describe('Desktop shell (1280x720) is unchanged', () => {
  it('keeps the static sidebar and no hamburger', () => {
    cy.viewport(1280, 720);
    cy.login();
    cy.get('[data-testid="sidebar-menu-button"]').should('not.exist');
    cy.contains('Cypress Test Server').should('be.visible');
    cy.get('button[aria-label="Settings"]').should('be.visible');
  });
});
