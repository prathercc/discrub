describe('Message Operations', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
    // Wait for messages to render
    cy.contains('[data-testid="message-feed-row"]', 'Sounds good, deploying now.').should('exist');
  });

  it('shows "1 selected" chip after clicking a message row', () => {
    // Click the table row directly (rows have onClick → toggleMessageSelection)
    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('1 selected').should('be.visible');
  });

  it('enables Delete and Edit with a single selection', () => {
    cy.contains('button', 'Delete').should('be.disabled');
    cy.contains('button', 'Edit').should('be.disabled');

    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();

    cy.contains('button', 'Delete').should('not.be.disabled');
    cy.contains('button', 'Edit').should('not.be.disabled');
  });

  it('opens EditMessageModal when clicking Edit', () => {
    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('button', 'Edit').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('Edit Message').should('be.visible');
    cy.get('[role="dialog"]').find('textarea').should('exist');
  });

  it('sends PATCH request when saving edited message', () => {
    cy.fixture('message-edited.json').then((editedMsg) => {
      cy.intercept('PATCH', '**/api/v10/channels/*/messages/*', {
        statusCode: 200,
        body: editedMsg,
      }).as('editMessage');
    });

    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('button', 'Edit').click();
    cy.get('[role="dialog"]').find('textarea').first().clear().type('Updated content');
    cy.get('[role="dialog"]').contains('button', 'Save').click();
    cy.wait('@editMessage');
  });

  it('opens DeleteConfirmModal with "Delete Messages" title', () => {
    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('button', 'Delete').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('Delete Messages').should('be.visible');
    cy.contains('This action cannot be undone.').should('be.visible');
  });

  it('closes delete modal without removing message when cancelling', () => {
    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('button', 'Delete').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('[role="dialog"]').contains('button', 'Cancel').click();
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('[data-testid="message-feed-row"]', 'Sounds good, deploying now.').should('exist');
  });

  it('keeps Edit and Delete enabled with multi-message selection (all by current user)', () => {
    // Both messages are authored by discrub_tester (the logged-in user),
    // so #139's editBlockedByPermission gate stays clear.
    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('[data-testid="message-feed-row"]','Sure! Let me finish this code first.').click();
    cy.contains('2 selected').should('be.visible');
    cy.contains('button', 'Edit').should('not.be.disabled');
    cy.contains('button', 'Delete').should('not.be.disabled');
  });

  // Backlog #139 regression guard: Edit (PATCH) is author-only at the
  // Discord API layer, so the toolbar disables it whenever any selected
  // message is by another user. Delete behavior depends on
  // canManageMessages — that's covered separately in purge.cy.ts.
  it('disables Edit when the selection includes a message by another user (#139)', () => {
    cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
    cy.contains('[data-testid="message-feed-row"]',"Let's ship it!").click();
    cy.contains('2 selected').should('be.visible');
    cy.contains('button', 'Edit').should('be.disabled');
  });
});

// ── System / pinned message selection (#196 Phase 3) ────────────────────────
// SystemMessageRow used to render pin/join/boost notices without a selection
// checkbox, so users couldn't select or delete them from the feed and Select
// All silently skipped them in the UI. A checkbox mirroring MessageFeedRow
// closes that gap. The default messages.json has no system messages, so these
// tests override the feed with a normal message + a type-6 pin notification
// authored by the current user (so it's deletable).
describe('System / pinned message selection (#196 Phase 3)', () => {
  const CURRENT_USER = {
    id: '111222333444555666',
    username: 'discrub_tester',
    discriminator: '0',
    avatar: 'abc123avatar',
    global_name: 'Discrub Tester',
  };

  const normalMessage = {
    id: '700000000000000091',
    channel_id: '801000000000000001',
    author: CURRENT_USER,
    content: 'A regular message in the feed',
    timestamp: '2026-02-01T10:00:00.000Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    pinned: false,
    type: 0,
  };

  const pinNotification = {
    ...normalMessage,
    id: '700000000000000092',
    content: '',
    timestamp: '2026-02-01T10:05:00.000Z',
    message_reference: { message_id: '700000000000000091', channel_id: '801000000000000001' },
    type: 6,
  };

  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.intercept('GET', '**/api/v10/channels/*/messages?*', {
      statusCode: 200,
      body: [normalMessage, pinNotification],
    }).as('getMessages');
    cy.selectChannel('general');
    cy.get('[data-testid="system-message-row"][data-system-kind="pin"]').should('exist');
  });

  it('renders the pin notification as a system row', () => {
    cy.get('[data-testid="system-message-row"]').should(
      'contain.text',
      'pinned a message to this channel',
    );
  });

  it('selects a pin notification via its checkbox', () => {
    cy.get('input[aria-label="Select system message 700000000000000092"]').click({ force: true });
    cy.contains('1 selected').should('be.visible');
  });

  it('Select all now visibly includes the pin notification', () => {
    cy.get('input[aria-label="Select all messages"]').click({ force: true });
    cy.contains('2 selected').should('be.visible');
    cy.get('input[aria-label="Select system message 700000000000000092"]').should('be.checked');
  });

  it('deletes a selected pin notification (sends DELETE for its id)', () => {
    cy.intercept('DELETE', '**/api/v10/channels/*/messages/*', {
      statusCode: 204,
      body: {},
    }).as('deletePin');
    cy.get('input[aria-label="Select system message 700000000000000092"]').click({ force: true });
    cy.contains('button', 'Delete').click();
    cy.get('[role="dialog"]').contains('button', 'Delete').click();
    cy.wait('@deletePin').its('request.url').should('include', '700000000000000092');
  });
});
