describe('Attachment Deletion', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
    cy.get('[data-testid="message-feed-row"]').should('have.length.greaterThan', 0);
  });

  describe('Attachment Modal Access', () => {
    it('should show Attachments button for message with attachments', () => {
      // Message "Here's a screenshot" has an attachment — may be mid-table, scroll into view
      cy.contains('[data-testid="message-feed-row"]',"Here's a screenshot").scrollIntoView().click({ force: true });
      cy.get('[aria-label="View Attachments"]').should('be.visible');
    });

    it('should not show Attachments button for message without attachments', () => {
      cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.').click();
      // The attachment icon only appears in rows with attachments — this row should not have one
      cy.contains('[data-testid="message-feed-row"]','Sounds good, deploying now.')
        .find('[aria-label="View Attachments"]').should('not.exist');
    });

    it('should open AttachmentModal with attachment list', () => {
      cy.contains('[data-testid="message-feed-row"]',"Here's a screenshot").scrollIntoView().click({ force: true });
      cy.get('[aria-label="View Attachments"]').click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains(/Attachments/).should('be.visible');
      cy.contains('screenshot.png').should('be.visible');
    });
  });

  describe('Attachment Deletion Actions', () => {
    beforeEach(() => {
      cy.contains('[data-testid="message-feed-row"]',"Here's a screenshot").scrollIntoView().click({ force: true });
      cy.get('[aria-label="View Attachments"]').click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
    });

    it('should show delete icon for each attachment', () => {
      cy.get('[aria-label="delete attachment"]').should('have.length.greaterThan', 0);
    });

    it('should show Remove All button', () => {
      cy.contains('button', 'Remove All').should('be.visible');
    });

    // The "Here's a screenshot" fixture message: content + 2 attachments
    // (screenshot.png, debug-log.txt). Removing attachments from a message
    // that keeps content is a PATCH, and the modal renders whatever the
    // PATCH echoes back — so the mock must return a realistic message body.
    // (These tests used to assert the dialog was simply still open after the
    // click, which only held because the pre-#241 service slept the delete
    // delay before the PATCH; single-shot actions are instant now.)
    const patchedMessage = (attachments: object[]) => ({
      id: '700000000000000006',
      channel_id: '801000000000000001',
      author: {
        id: '333444555666777888',
        username: 'bob_gamer',
        discriminator: '0',
        avatar: null,
        global_name: 'Bob',
      },
      content: "Here's a screenshot",
      timestamp: '2026-02-01T13:00:00.000Z',
      edited_timestamp: '2026-02-01T13:05:00.000Z',
      tts: false,
      mention_everyone: false,
      mentions: [],
      attachments,
      embeds: [],
      reactions: [],
      pinned: false,
      type: 0,
    });

    const remainingAttachment = {
      id: '600000000000000002',
      filename: 'debug-log.txt',
      size: 4096,
      url: 'https://cdn.discordapp.com/attachments/801000000000000001/600000000000000002/debug-log.txt',
      proxy_url: 'https://media.discordapp.net/attachments/801000000000000001/600000000000000002/debug-log.txt',
      content_type: 'text/plain',
    };

    it('removes one attachment via PATCH and keeps the modal open with the rest', () => {
      cy.intercept('PATCH', '**/api/v10/channels/*/messages/*', {
        statusCode: 200,
        body: patchedMessage([remainingAttachment]),
      }).as('editMessage');

      cy.get('[aria-label="delete attachment"]').first().click();

      // The message keeps content, so removing one of two attachments is an
      // edit (not a delete), and it must carry only the surviving attachment.
      cy.wait('@editMessage').its('request.body.attachments').should('have.length', 1);
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Attachments (1)').should('be.visible');
      cy.get('[role="dialog"]').contains('debug-log.txt').should('be.visible');
      cy.get('[role="dialog"]').contains('screenshot.png').should('not.exist');
    });

    it('removes all attachments via sequential PATCHes and auto-closes the emptied modal', () => {
      let patchCount = 0;
      cy.intercept('PATCH', '**/api/v10/channels/*/messages/*', (req) => {
        patchCount++;
        req.reply({
          statusCode: 200,
          body: patchedMessage(patchCount === 1 ? [remainingAttachment] : []),
        });
      }).as('editMessage');

      cy.contains('button', 'Remove All').click();

      // Remove All walks the attachments one PATCH at a time, re-reading
      // state between calls: the first edit keeps debug-log.txt, the second
      // empties the list. The modal auto-closes once none remain. (Content
      // survives, so this is never a whole-message DELETE.)
      cy.wait('@editMessage').its('request.body.attachments').should('have.length', 1);
      cy.wait('@editMessage').its('request.body.attachments').should('have.length', 0);
      cy.get('[role="dialog"]').should('not.exist');
    });
  });

  describe('Modal Close', () => {
    it('should close AttachmentModal when clicking Cancel', () => {
      cy.contains('[data-testid="message-feed-row"]',"Here's a screenshot").scrollIntoView().click({ force: true });
      cy.get('[aria-label="View Attachments"]').click({ force: true });
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[role="dialog"]').contains('button', 'Cancel').click();
      cy.get('[role="dialog"]').should('not.exist');
    });
  });
});
