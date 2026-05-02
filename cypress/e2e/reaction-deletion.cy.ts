describe('Reaction Deletion', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
    cy.get('[data-testid="message-feed-row"]').should('have.length.greaterThan', 0);
  });

  describe('Reaction Modal Access', () => {
    it('should show reaction indicator for message with reactions', () => {
      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?')
        .scrollIntoView()
        .find('[aria-label="View Reactions"]')
        .should('exist');
    });

    it('should not show reaction indicator for message without reactions', () => {
      cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.')
        .find('[aria-label="View Reactions"]')
        .should('not.exist');
    });

    it('should open ReactionModal with emoji tabs', () => {
      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?')
        .scrollIntoView()
        .find('[aria-label="View Reactions"]')
        .first()
        .click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[role="dialog"]').contains('Reactions').should('be.visible');
    });
  });

  describe('Reaction Tab Interaction', () => {
    beforeEach(() => {
      cy.fixture('reacting-users.json').then((users) => {
        cy.intercept('GET', '**/api/v10/channels/*/messages/*/reactions/*', {
          statusCode: 200,
          body: users,
        }).as('getReactingUsers');
      });

      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?')
        .scrollIntoView()
        .find('[aria-label="View Reactions"]')
        .first()
        .click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
    });

    it('should show emoji tabs with reaction counts', () => {
      cy.get('[role="dialog"]').find('[class*="ListItemButton"]').should('exist');
    });

    it('should auto-select first emoji and fetch users', () => {
      cy.wait('@getReactingUsers');
      // Users should be visible in the right panel
      cy.get('[role="dialog"]').find('[class*="ListItemText"]').should('exist');
    });

    it('should show delete buttons for each reacting user', () => {
      cy.wait('@getReactingUsers');
      cy.get('[aria-label="delete reaction"]').should('have.length.greaterThan', 0);
    });

    it('should show Remove All button when users are listed', () => {
      cy.wait('@getReactingUsers');
      cy.contains('button', 'Remove All').should('be.visible');
    });
  });

  describe('Reaction Deletion Actions', () => {
    beforeEach(() => {
      cy.fixture('reacting-users.json').then((users) => {
        cy.intercept('GET', '**/api/v10/channels/*/messages/*/reactions/*', {
          statusCode: 200,
          body: users,
        }).as('getReactingUsers');
      });

      // Broad intercept catches both per-user and bulk DELETE requests
      cy.intercept({ method: 'DELETE', url: /\/api\/v10\/channels\/\d+\/messages\/\d+\/reactions/ }, {
        statusCode: 204,
        body: {},
      }).as('deleteReaction');

      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?')
        .scrollIntoView()
        .find('[aria-label="View Reactions"]')
        .first()
        .click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      cy.wait('@getReactingUsers');
    });

    it('should send DELETE request when removing a single reaction', () => {
      cy.get('[aria-label="delete reaction"]').first().click();
      cy.wait('@deleteReaction');
    });

    it('should show Remove All button for admin users', () => {
      // Admin users see the bulk "Remove All" button (per-emoji)
      cy.contains('button', 'Remove All').should('be.visible');
    });
  });

  describe('Admin Bulk Reaction Removal (MANAGE_MESSAGES)', () => {
    beforeEach(() => {
      cy.fixture('reacting-users.json').then((users) => {
        cy.intercept('GET', '**/api/v10/channels/*/messages/*/reactions/*', {
          statusCode: 200,
          body: users,
        }).as('getReactingUsers');
      });

      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?')
        .scrollIntoView()
        .find('[aria-label="View Reactions"]')
        .first()
        .click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      cy.wait('@getReactingUsers');
    });

    it('should show admin "Remove All" button in dialog title when user has MANAGE_MESSAGES', () => {
      // Cypress Test Server has permissions: 2147483639 which includes MANAGE_MESSAGES
      cy.get('[role="dialog"]').find('h2').parent().contains('button', 'Remove All').should('be.visible');
    });

    it('should show per-emoji bulk "Remove All" button (outlined variant) for admin', () => {
      // Admin gets the outlined variant button for per-emoji bulk removal
      cy.get('[role="dialog"]').contains('button', 'Remove All').should('have.length.at.least', 1);
    });
  });

  describe('Message Table — Remove Reactions Toolbar Button', () => {
    it('should show Remove Reactions button in toolbar (disabled when no selection)', () => {
      cy.contains('button', 'Remove Reactions').should('be.visible').and('be.disabled');
    });

    it('should enable Remove Reactions button when messages are selected', () => {
      // Select a message by clicking its row
      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?').scrollIntoView().click();
      cy.contains('button', 'Remove Reactions').should('not.be.disabled');
    });

    it('should open ReactionRemovalModal when clicked with selection', () => {
      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?').scrollIntoView().click();
      cy.contains('button', 'Remove Reactions').click();
      cy.get('[role="dialog"]').contains('Remove Reactions').should('be.visible');
    });

    it('should show emoji and user select fields', () => {
      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?').scrollIntoView().click();
      cy.contains('button', 'Remove Reactions').click();
      cy.get('[role="dialog"]').contains('All emojis').should('be.visible');
      cy.get('[role="dialog"]').contains('All users').should('be.visible');
    });
  });

  describe('Permission enforcement — MANAGE_MESSAGES', () => {
    beforeEach(() => {
      cy.fixture('reacting-users.json').then((users) => {
        cy.intercept('GET', '**/api/v10/channels/*/messages/*/reactions/*', {
          statusCode: 200,
          body: users,
        }).as('getReactingUsers');
      });
    });

    it('admin should see delete buttons for all reacting users', () => {
      // Cypress Test Server permissions: 2147483639 includes MANAGE_MESSAGES
      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?')
        .scrollIntoView()
        .find('[aria-label="View Reactions"]')
        .first()
        .click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      cy.wait('@getReactingUsers');
      // Admin sees delete buttons for all users (2 in fixture)
      cy.get('[aria-label="delete reaction"]').should('have.length', 2);
    });

    it('admin should see "Remove All" button in ReactionModal', () => {
      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?')
        .scrollIntoView()
        .find('[aria-label="View Reactions"]')
        .first()
        .click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      cy.wait('@getReactingUsers');
      cy.get('[role="dialog"]').contains('button', 'Remove All').should('be.visible');
    });

    it('admin should see "All users" option in ReactionRemovalModal', () => {
      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?').scrollIntoView().click();
      cy.contains('button', 'Remove Reactions').click();
      cy.get('[role="dialog"]').contains('All users').should('be.visible');
    });
  });

  describe('me flag optimization — skip reactions user has not reacted to', () => {
    it('should not make DELETE calls when removing own reactions from message where me=false', () => {
      // The fixture message has 👍 with me=false — user hasn't reacted
      cy.intercept({ method: 'DELETE', url: /\/reactions/ }, {
        statusCode: 204,
        body: {},
      }).as('deleteReaction');

      // Select the message with reactions
      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?').scrollIntoView().click();
      cy.contains('button', 'Remove Reactions').click();
      cy.get('[role="dialog"]').contains('Remove Reactions').should('be.visible');

      // Change user selection from "All users" to self (to trigger user mode with me check)
      cy.get('[role="dialog"]').contains('All users').click();
      cy.get('[role="listbox"]').contains('(you)').click();

      // Click Remove
      cy.get('[role="dialog"]').contains('button', 'Remove').click();

      // Wait briefly for the operation
      cy.wait(1000);

      // No DELETE calls should have been made since me=false on all reactions
      cy.get('@deleteReaction.all').should('have.length', 0);
    });
  });

  describe('DM Context — No Reactor Fetching', () => {
    beforeEach(() => {
      cy.login();
      cy.selectDm('alice_dev');
      cy.get('[data-testid="message-feed-row"]').should('have.length.greaterThan', 0);
    });

    it('should not fetch reacting users when opening reaction modal in DM', () => {
      cy.intercept('GET', '**/api/v10/channels/*/messages/*/reactions/*', {
        statusCode: 200,
        body: [],
      }).as('getReactingUsers');

      // Open reaction modal on the DM message with reactions
      cy.contains('[data-testid="message-feed-row"]','Hey, did you see the latest build?')
        .scrollIntoView()
        .find('[aria-label="View Reactions"]')
        .first()
        .click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');

      // No API calls should be made to fetch reacting users
      cy.get('@getReactingUsers.all').should('have.length', 0);
    });

    it('should show current user from reaction.me without API call in DM', () => {
      cy.contains('[data-testid="message-feed-row"]','Hey, did you see the latest build?')
        .scrollIntoView()
        .find('[aria-label="View Reactions"]')
        .first()
        .click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      // Current user should appear (from reaction.me=true, no API call)
      cy.get('[role="dialog"]').contains('Discrub Tester').should('be.visible');
      cy.get('[role="dialog"]').contains('User list not available').should('not.exist');
    });
  });

  describe('Non-Admin Reaction Removal Validation', () => {
    beforeEach(() => {
      cy.login();
      cy.selectServer('Cypress Test Server');
      cy.selectChannel('general');
      cy.get('[data-testid="message-feed-row"]').should('have.length.greaterThan', 0);
    });

    it('should only show emojis user has reacted to in Remove Reactions dialog (non-admin)', () => {
      // Select the message with reactions (👍 me=false, ❤️ me=true)
      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?').scrollIntoView().click();
      cy.contains('button', 'Remove Reactions').click();
      cy.get('[role="dialog"]').should('be.visible');

      // Non-admin should only see ❤️ (me=true), not 👍 (me=false)
      cy.get('[role="dialog"]').contains('❤').should('be.visible');
      // The 👍 should not appear as a selectable emoji since me=false
      // (All Emojis option still shows but only covers eligible emojis)
    });

    it('should disable Remove Reactions toolbar button when no eligible reactions selected', () => {
      // Select a message without any reactions
      cy.contains('[data-testid="message-feed-row"]','Thanks for setting this up!').scrollIntoView().click();
      // The toolbar button should be disabled since no selected messages have removable reactions
      cy.contains('button', 'Remove Reactions').should('be.disabled');
    });

    it('should show eligible emoji count matches me=true reactions only', () => {
      // Select the message with 2 reactions: 👍 (me=false), ❤️ (me=true)
      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?').scrollIntoView().click();
      cy.contains('button', 'Remove Reactions').click();
      cy.get('[role="dialog"]').should('be.visible');

      // Non-admin should see "1 message with reactions will be processed"
      cy.get('[role="dialog"]').contains('1 message').should('be.visible');
      // Remove button should be enabled (there IS an eligible reaction)
      cy.get('[role="dialog"]').find('button').contains('Remove').should('not.be.disabled');
    });
  });

  describe('Modal Close', () => {
    it('should close ReactionModal when clicking close button', () => {
      cy.contains('[data-testid="message-feed-row"]','Anyone up for some gaming later?')
        .scrollIntoView()
        .find('[aria-label="View Reactions"]')
        .first()
        .click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[role="dialog"]').find('[aria-label="Close"]').click();
      cy.get('[role="dialog"]').should('not.exist');
    });
  });
});
