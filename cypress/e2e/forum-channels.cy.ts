describe('Forum Channels', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');

    // Intercept the forum threads/search API call
    cy.intercept('GET', '**/threads/search*', { fixture: 'forum-threads.json' }).as('getForumThreads');
  });

  it('shows forum channel in channel list', () => {
    cy.contains('feedback').should('be.visible');
  });

  it('loads forum thread list when clicking a forum channel', () => {
    cy.contains('feedback').click();
    cy.wait('@getForumThreads');
    cy.contains('3 of 3 posts').should('be.visible');
  });

  it('shows forum post titles', () => {
    cy.contains('feedback').click();
    cy.wait('@getForumThreads');
    cy.contains('App crashes on startup').should('be.visible');
    cy.contains('Dark mode support').should('be.visible');
    cy.contains('How do I export data?').should('be.visible');
  });

  it('shows preview text from first messages', () => {
    cy.contains('feedback').click();
    cy.wait('@getForumThreads');
    cy.contains('The app crashes whenever I try to open it').should('be.visible');
  });

  it('shows tag filter chips', () => {
    cy.contains('feedback').click();
    cy.wait('@getForumThreads');
    cy.contains('🐛 Bug').should('be.visible');
    cy.contains('✨ Feature').should('be.visible');
    cy.contains('❓ Question').should('be.visible');
  });

  it('filters posts by tag when tag chip is clicked', () => {
    cy.contains('feedback').click();
    cy.wait('@getForumThreads');
    // Click Bug tag
    cy.contains('🐛 Bug').click();
    // Should only show the bug post
    cy.contains('App crashes on startup').should('be.visible');
    cy.contains('Dark mode support').should('not.exist');
    cy.contains('How do I export data?').should('not.exist');
  });

  it('clears tag filter when Clear chip is clicked', () => {
    cy.contains('feedback').click();
    cy.wait('@getForumThreads');
    cy.contains('🐛 Bug').click();
    // Only bug post visible
    cy.contains('Dark mode support').should('not.exist');
    // Click Clear chip
    cy.contains('.MuiChip-root', 'Clear').click();
    // All posts visible again
    cy.contains('Dark mode support').should('be.visible');
  });

  it('shows search input', () => {
    cy.contains('feedback').click();
    cy.wait('@getForumThreads');
    cy.get('input[placeholder="Search posts..."]').should('be.visible');
  });

  it('performs server-side search with debounce', () => {
    cy.contains('feedback').click();
    cy.wait('@getForumThreads');

    // Intercept search call
    cy.intercept('GET', '**/threads/search*name=crash*', {
      threads: [
        {
          id: '900000000000000001',
          type: 11,
          name: 'App crashes on startup',
          parent_id: '801000000000000007',
          message_count: 5,
          member_count: 3,
          last_message_id: '900000000000000010',
          thread_metadata: { archived: true, locked: false },
          applied_tags: ['tag-bug'],
        },
      ],
      members: [],
      has_more: false,
      first_messages: [],
      total_results: 1,
    }).as('searchThreads');

    cy.get('input[placeholder="Search posts..."]').type('crash');
    cy.wait('@searchThreads');
    cy.contains('App crashes on startup').should('be.visible');
  });

  it('shows empty state with search bar when search returns no results', () => {
    cy.contains('feedback').click();
    cy.wait('@getForumThreads');

    cy.intercept('GET', '**/threads/search*name=nonexistent*', {
      threads: [],
      members: [],
      has_more: false,
      first_messages: [],
      total_results: 0,
    }).as('emptySearch');

    cy.get('input[placeholder="Search posts..."]').type('nonexistent');
    cy.wait('@emptySearch');
    // Search bar should still be visible
    cy.get('input[placeholder="Search posts..."]').should('be.visible');
    // Empty state message
    cy.contains('No posts matching').should('be.visible');
  });

  it('shows post count in header instead of message count', () => {
    cy.contains('feedback').click();
    cy.wait('@getForumThreads');
    cy.contains('3 posts').should('be.visible');
    cy.contains('0 messages').should('not.exist');
  });

  it('shows locked indicator on locked posts', () => {
    cy.contains('feedback').click();
    cy.wait('@getForumThreads');
    // "How do I export data?" is locked
    cy.contains('Locked').should('be.visible');
  });

  describe('Forum View Toolbar', () => {
    beforeEach(() => {
      cy.contains('feedback').click();
      cy.wait('@getForumThreads');
    });

    it('hides Load All button in forum view', () => {
      cy.contains('button', 'Load All').should('not.exist');
    });

    it('hides Analytics button in forum view', () => {
      cy.contains('button', 'Analytics').should('not.exist');
    });

    it('shows Export button enabled in forum view', () => {
      cy.contains('button', 'Export').should('be.visible').and('not.be.disabled');
    });

    it('shows Load Thread button in forum view', () => {
      cy.contains('button', 'Load Thread').should('be.visible');
    });

    it('hides message action buttons (Delete, Edit, selected) in forum view', () => {
      cy.contains('button', 'Delete').should('not.exist');
      cy.contains('button', 'Edit').should('not.exist');
      cy.contains('selected').should('not.exist');
    });

    it('hides Filters button in forum view', () => {
      cy.get('[data-testid="search-filters-button"]').should('not.exist');
    });

    it('opens bulk export dialog when Export is clicked', () => {
      cy.contains('button', 'Export').click();
      cy.contains('Bulk Export Channels').should('be.visible');
      cy.contains('3 selected').should('be.visible');
    });
  });
});
