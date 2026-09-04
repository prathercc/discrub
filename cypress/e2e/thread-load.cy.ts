const interceptThreadLoad = () => {
  cy.fixture('thread-channel.json').then((thread) => {
    cy.intercept('GET', '**/api/v10/channels/802000000000000001', {
      statusCode: 200,
      body: thread,
    }).as('getThread');
  });

  cy.fixture('messages.json').then((messages) => {
    cy.intercept('GET', '**/api/v10/channels/802000000000000001/messages?*', {
      statusCode: 200,
      body: messages,
    }).as('getThreadMessages');
  });
};

const loadThread = () => {
  interceptThreadLoad();
  cy.contains('button', 'Load Thread').click();
  cy.get('[role="dialog"]').find('input').type('802000000000000001');
  cy.get('[role="dialog"]').contains('button', 'Load').click();
  cy.wait('@getThread');
  cy.wait('@getThreadMessages');
};

const API = '**/api/v10';

/**
 * Thread discovery (#150) hits three endpoints when the modal opens. The
 * active list comes from the fixture; the public-archived call returns one
 * archived thread so the #252 row styling has both states to show.
 */
const interceptThreadDiscovery = () => {
  cy.fixture('active-guild-threads.json').then((active) => {
    cy.intercept('GET', `${API}/guilds/*/threads/active*`, { statusCode: 200, body: active }).as('getActiveThreads');
  });
  cy.intercept('GET', `${API}/channels/*/threads/archived/public*`, {
    statusCode: 200,
    body: {
      threads: [{
        id: '802000000000000099',
        name: 'retired-thread',
        type: 11,
        parent_id: '801000000000000001',
        message_count: 12,
        member_count: 4,
        thread_metadata: { archived: true, archive_timestamp: new Date(Date.now() - 2 * 86_400_000).toISOString() },
      }],
      members: [],
      has_more: false,
    },
  }).as('getPublicThreads');
  cy.fixture('archived-threads-empty.json').then((empty) => {
    cy.intercept('GET', `${API}/channels/*/threads/archived/private*`, { statusCode: 200, body: empty }).as('getPrivateThreads');
    cy.intercept('GET', `${API}/channels/*/users/@me/threads/archived/private*`, { statusCode: 200, body: empty }).as('getJoinedPrivateThreads');
  });
};

describe('Thread Load', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
    cy.contains('[data-testid="message-feed-row"]', 'Hello everyone! Welcome to the server.').should('exist');
  });

  // Backlog #252: discovered rows carry counts, an archived state, and
  // active threads list first. Clicking a row loads that thread.
  describe('Discovered thread rows (#252)', () => {
    beforeEach(() => {
      interceptThreadDiscovery();
      cy.contains('button', 'Load Thread').click();
      cy.wait('@getActiveThreads');
      cy.wait('@getPublicThreads');
    });

    it('shows message and member counts under each thread name', () => {
      cy.get('[data-testid="discovered-thread-802000000000000001"]')
        .should('contain.text', 'test-thread')
        .and('contain.text', '5 messages · 3 members');
    });

    it('marks archived threads and says when they were archived', () => {
      cy.get('[data-testid="discovered-thread-802000000000000099"]')
        .should('contain.text', 'retired-thread')
        .and('contain.text', '12 messages · 4 members · archived 2 days ago')
        .and('contain.text', 'Archived');
    });

    it('lists active threads before archived ones', () => {
      cy.get('[data-testid="discovered-threads"] [data-testid^="discovered-thread-"]').then(($rows) => {
        const ids = $rows.toArray().map((el) => el.getAttribute('data-testid'));
        expect(ids.indexOf('discovered-thread-802000000000000001')).to.be.lessThan(ids.indexOf('discovered-thread-802000000000000099'));
      });
    });

    it('loads the thread when its row is clicked', () => {
      interceptThreadLoad();
      cy.get('[data-testid="discovered-thread-802000000000000001"]').click();
      cy.wait('@getThread');
      cy.wait('@getThreadMessages');
      cy.get('[role="dialog"]').should('not.exist');
    });
  });

  describe('Thread Load Button', () => {
    it('should show Load Thread button in ServerView toolbar', () => {
      cy.contains('button', 'Load Thread').should('be.visible');
    });

    it('should open ThreadLoadModal when clicking Load Thread', () => {
      cy.contains('button', 'Load Thread').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Load Thread').should('be.visible');
    });
  });

  describe('ThreadLoadModal', () => {
    beforeEach(() => {
      cy.contains('button', 'Load Thread').click();
      cy.get('[role="dialog"]').should('be.visible');
    });

    it('should show instruction text', () => {
      cy.contains('Enter a thread or forum post ID').should('be.visible');
    });

    it('should have thread ID input field', () => {
      cy.get('[role="dialog"]').find('input').should('be.visible');
    });

    it('should have Load button disabled when input is empty', () => {
      cy.get('[role="dialog"]').contains('button', 'Load').should('be.disabled');
    });

    it('should enable Load button when ID is entered', () => {
      cy.get('[role="dialog"]').find('input').type('802000000000000001');
      cy.get('[role="dialog"]').contains('button', 'Load').should('not.be.disabled');
    });

    it('should close modal on Cancel', () => {
      cy.get('[role="dialog"]').contains('button', 'Cancel').click();
      cy.get('[role="dialog"]').should('not.exist');
    });

    it('should fetch thread channel when Load is clicked', () => {
      interceptThreadLoad();
      cy.get('[role="dialog"]').find('input').type('802000000000000001');
      cy.get('[role="dialog"]').contains('button', 'Load').click();
      cy.wait('@getThread');
    });

    it('should close modal and log error for invalid thread ID', () => {
      cy.intercept('GET', '**/api/v10/channels/999999999999999999', {
        statusCode: 404,
        body: { message: 'Unknown Channel', code: 10003 },
      }).as('getThreadNotFound');

      cy.get('[role="dialog"]').find('input').type('999999999999999999');
      cy.get('[role="dialog"]').contains('button', 'Load').click();
      cy.get('[role="dialog"]').should('not.exist');
      cy.wait('@getThreadNotFound');

      cy.get('[aria-label="Expand log"]').click();
      cy.contains('Failed to load thread').should('be.visible');
    });

    it('should close modal and log error for no access thread', () => {
      cy.intercept('GET', '**/api/v10/channels/888888888888888888', {
        statusCode: 403,
        body: { message: 'Missing Access', code: 50001 },
      }).as('getThreadForbidden');

      cy.get('[role="dialog"]').find('input').type('888888888888888888');
      cy.get('[role="dialog"]').contains('button', 'Load').click();
      cy.get('[role="dialog"]').should('not.exist');
      cy.wait('@getThreadForbidden');

      cy.get('[aria-label="Expand log"]').click();
      cy.contains('Failed to load thread').should('be.visible');
    });

    it('should only accept numeric input', () => {
      cy.get('[role="dialog"]').find('input').type('abc123xyz');
      // Non-numeric chars should be filtered out, leaving only "123"
      cy.get('[role="dialog"]').find('input').should('have.value', '123');
    });
  });

  describe('Status Log Entries', () => {
    it('should show info status entry when loading thread', () => {
      interceptThreadLoad();
      cy.contains('button', 'Load Thread').click();
      cy.get('[role="dialog"]').find('input').type('802000000000000001');
      cy.get('[role="dialog"]').contains('button', 'Load').click();
      cy.wait('@getThread');
      cy.wait('@getThreadMessages');

      cy.get('[aria-label="Expand log"]').click();
      cy.contains('Loading thread...').should('be.visible');
    });

    it('should show success status entry on successful load', () => {
      loadThread();

      // Expand Status Log accordion and verify success entry
      cy.get('[aria-label="Expand log"]').click();
      cy.contains('Thread loaded successfully').should('be.visible');
    });

    it('should show error status entry on failed load', () => {
      cy.intercept('GET', '**/api/v10/channels/999999999999999999', {
        statusCode: 404,
        body: { message: 'Unknown Channel', code: 10003 },
      }).as('getThreadNotFound');

      cy.contains('button', 'Load Thread').click();
      cy.get('[role="dialog"]').find('input').type('999999999999999999');
      cy.get('[role="dialog"]').contains('button', 'Load').click();
      cy.wait('@getThreadNotFound');

      // Expand Status Log accordion and verify error entry
      cy.get('[aria-label="Expand log"]').click();
      cy.contains('Failed to load thread').should('be.visible');
    });
  });

  describe('Thread Tabs', () => {
    it('should show tab bar after loading a thread', () => {
      loadThread();

      cy.get('[data-testid="thread-tab-bar"]').should('be.visible');
      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').should('have.length', 2);
    });

    it('should show main channel tab with channel name', () => {
      loadThread();

      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').first().should('contain.text', 'general');
    });

    it('should show thread tab with thread name', () => {
      loadThread();

      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').last().should('contain.text', 'test-thread');
    });

    it('should have thread tab active after loading', () => {
      loadThread();

      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').last()
        .should('have.attr', 'aria-selected', 'true');
    });

    it('should switch to main channel tab when clicked', () => {
      loadThread();

      // Click main channel tab
      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').first().click();
      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').first()
        .should('have.attr', 'aria-selected', 'true');

      // Main channel messages should be visible
      cy.contains('[data-testid="message-feed-row"]', 'Hello everyone! Welcome to the server.').should('exist');
    });

    it('should switch back to thread tab when clicked', () => {
      loadThread();

      // Switch to main, then back to thread
      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').first().click();
      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').last().click();
      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').last()
        .should('have.attr', 'aria-selected', 'true');
    });

    it('should close thread tab and return to main when close button clicked', () => {
      loadThread();

      // Wait for loading to fully complete (isOperationRunning guards the close handler)
      cy.window().should((win) => {
        const store = (win as any).__store__;
        if (store) {
          const threadTabs = store.getState().message.threadTabs ?? {};
          const anyLoading = Object.values(threadTabs).some((tab: any) => tab.isLoading);
          expect(anyLoading).to.eq(false);
        }
      });

      // Close the thread tab (X button) — click the IconButton parent, not the SVG
      cy.get('[data-testid="thread-tab-bar"]')
        .find('[data-testid="CloseIcon"]')
        .parent('button')
        .click({ force: true });

      // Tab bar should only show main tab (no thread tabs)
      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').should('have.length', 1);

      // Should be back on main channel
      cy.contains('[data-testid="message-feed-row"]', 'Hello everyone! Welcome to the server.').should('exist');
    });

    it('should only show main tab when no thread tabs are open', () => {
      // Tab bar is always visible but should only have the main tab
      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').should('have.length', 1);
    });

    it('should only show main tab after failed thread load', () => {
      cy.intercept('GET', '**/api/v10/channels/999999999999999999', {
        statusCode: 404,
        body: { message: 'Unknown Channel', code: 10003 },
      }).as('getThreadNotFound');

      cy.contains('button', 'Load Thread').click();
      cy.get('[role="dialog"]').find('input').type('999999999999999999');
      cy.get('[role="dialog"]').contains('button', 'Load').click();
      cy.wait('@getThreadNotFound');

      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').should('have.length', 1);
    });

    it('should clear thread tabs when switching channels', () => {
      loadThread();

      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').should('have.length', 2);

      // Switch to a different channel
      cy.selectChannel('dev-chat');

      // After switching, only main tab should remain
      cy.get('[data-testid="thread-tab-bar"]').find('[role="tab"]').should('have.length', 1);
    });
  });
});
