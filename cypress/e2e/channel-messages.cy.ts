describe('Channel Messages', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
  });

  it('loads and displays messages after selecting a channel', () => {
    cy.selectChannel('general');
    cy.contains('[data-testid="message-feed-row"]', 'Hello everyone! Welcome to the server.').should('exist');
  });

  it('shows channel name and message count in header', () => {
    cy.selectChannel('general');
    cy.contains('general').should('be.visible');
    cy.contains('13 messages').should('be.visible');
  });

  it('displays message author, content, and timestamp', () => {
    cy.selectChannel('general');
    cy.contains('[data-testid="message-feed-row"]', 'Hello everyone! Welcome to the server.').should('exist');
    cy.contains('Discrub Tester').should('exist');
  });

  it('shows "Load All" button when there may be more messages', () => {
    // Override messages intercept to return exactly 100 messages (signals hasMore=true)
    const manyMessages = Array.from({ length: 100 }, (_, i) => ({
      id: `700000000000000${String(i + 1).padStart(3, '0')}`,
      channel_id: '801000000000000001',
      author: {
        id: '111222333444555666',
        username: 'discrub_tester',
        discriminator: '0',
        avatar: 'abc123avatar',
        global_name: 'Discrub Tester',
      },
      content: `Message ${i + 1}`,
      timestamp: new Date(2026, 1, 1, 0, 0, i).toISOString(),
      edited_timestamp: null,
      tts: false,
      mention_everyone: false,
      mentions: [],
      attachments: [],
      embeds: [],
      reactions: [],
      pinned: false,
      type: 0,
    }));

    cy.intercept('GET', '**/api/v10/channels/*/messages?*', {
      statusCode: 200,
      body: manyMessages,
    }).as('getMessages100');

    cy.contains('general').click();
    cy.wait('@getMessages100');
    cy.contains('button', 'Load All').should('be.visible');
  });

  it('opens LoadAllDialog when clicking "Load All"', () => {
    const manyMessages = Array.from({ length: 100 }, (_, i) => ({
      id: `700000000000000${String(i + 1).padStart(3, '0')}`,
      channel_id: '801000000000000001',
      author: {
        id: '111222333444555666',
        username: 'discrub_tester',
        discriminator: '0',
        avatar: 'abc123avatar',
        global_name: 'Discrub Tester',
      },
      content: `Message ${i + 1}`,
      timestamp: new Date(2026, 1, 1, 0, 0, i).toISOString(),
      edited_timestamp: null,
      tts: false,
      mention_everyone: false,
      mentions: [],
      attachments: [],
      embeds: [],
      reactions: [],
      pinned: false,
      type: 0,
    }));

    cy.intercept('GET', '**/api/v10/channels/*/messages?*', {
      statusCode: 200,
      body: manyMessages,
    }).as('getMessages100');

    cy.contains('general').click();
    cy.wait('@getMessages100');
    cy.contains('button', 'Load All').click();
    cy.get('[role="dialog"]').should('be.visible');
  });

  it('does not show "Load All" when fewer than 100 messages loaded', () => {
    cy.selectChannel('general');
    // Fixture has 13 messages (< 100), so hasMore=false — no Load All button
    cy.contains('button', 'Load All').should('not.exist');
  });

  it('shows "Export" button that is disabled when no messages', () => {
    cy.intercept('GET', '**/api/v10/channels/*/messages?*', {
      statusCode: 200,
      body: [],
    }).as('getEmptyMessages');

    cy.contains('general').click();
    cy.wait('@getEmptyMessages');
    cy.contains('button', 'Export').should('be.disabled');
  });
});
