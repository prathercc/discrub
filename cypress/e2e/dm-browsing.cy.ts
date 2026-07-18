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

  describe('Group DM distinction (#227)', () => {
    const API = '**/api/v10';

    const recipient = (id: string, username: string, globalName: string) => ({
      id,
      username,
      discriminator: '0',
      avatar: null,
      global_name: globalName,
    });

    beforeEach(() => {
      // LIFO override of the login-time DM intercept: one 1:1 DM plus a
      // named and an unnamed group (type 3).
      cy.fixture('dms.json').then((dms) => {
        cy.intercept('GET', `${API}/users/@me/channels`, {
          statusCode: 200,
          body: [
            dms[0], // alice_dev 1:1
            {
              id: '910000000000000001',
              type: 3,
              name: 'Book Club',
              last_message_id: null,
              recipients: [
                recipient('911000000000000001', 'dana_reads', 'Dana'),
                recipient('911000000000000002', 'eli_reads', 'Eli'),
              ],
            },
            {
              id: '910000000000000002',
              type: 3,
              name: null,
              last_message_id: null,
              recipients: [recipient('911000000000000003', 'frank_lurks', 'Frank')],
            },
          ],
        }).as('getDMs');
      });
      cy.contains('button', 'DMs').click();
      cy.wait('@getDMs');
    });

    it('shows a Group chip with member count on group DMs only', () => {
      cy.get('[data-testid="group-dm-indicator"]').should('have.length', 2);
      cy.contains('[data-testid="group-dm-indicator"]', 'Group · 3 members').should('exist');
      cy.contains('[data-testid="group-dm-indicator"]', 'Group · 2 members').should('exist');
      cy.contains('alice_dev').should('be.visible');
    });

    it('titles a named group by its custom name and an unnamed one by member usernames', () => {
      cy.contains('Book Club').should('be.visible');
      // Unnamed groups derive their title from usernames, never a
      // recipient's display name (that would read as a 1:1 DM).
      cy.contains('frank_lurks').should('be.visible');
    });
  });
});
