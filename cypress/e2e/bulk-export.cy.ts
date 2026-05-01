describe('Bulk Export', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    // Wait for channels to load
    cy.contains('general').should('be.visible');
  });

  describe('Channel Multi-Select Mode', () => {
    it('should have multi-select toggle button', () => {
      cy.get('[aria-label="Toggle multi-select"]').should('be.visible');
    });

    it('should enter multi-select mode on toggle click', () => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      // Multi-select bar should appear with select/deselect toggle
      cy.get('[aria-label="Select all channels"]').should('be.visible');
    });

    it('should show selected count chip when channels are selected', () => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      // Click on a channel to select it (multi-select mode)
      cy.contains('general').click();
      cy.get('[data-testid="multi-select-count"]').should('contain.text', '1 of');
    });

    it('should select multiple channels in multi-select mode', () => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.contains('general').click();
      cy.contains('dev-chat').click();
      cy.get('[data-testid="multi-select-count"]').should('contain.text', '2 of');
    });

    it('should show Export Selected button when channels are selected', () => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.contains('general').click();
      cy.get('[aria-label="Export selected channels"]').should('be.visible');
    });

    it('should not show Export Selected button with no selections', () => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.get('[aria-label="Export selected channels"]').should('not.exist');
    });

    it('should select all channels with Select All button', () => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.get('[aria-label="Select all channels"]').click();
      // Should have selected text channels (not voice/category)
      cy.get('[data-testid="multi-select-count"]').should('exist');
    });

    it('should deselect all channels when multi-select toggle is clicked off', () => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.get('[aria-label="Select all channels"]').click();
      cy.get('[data-testid="multi-select-count"]').should('exist');
      // Toggling multi-select off deselects all channels
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.get('[aria-label="Export selected channels"]').should('not.exist');
    });

    it('should exit multi-select mode on second toggle click', () => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.get('[aria-label="Select all channels"]').should('be.visible');
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.get('[aria-label="Select all channels"]').should('not.exist');
    });
  });

  describe('Bulk Export Dialog (Channels)', () => {
    beforeEach(() => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.contains('general').click();
      cy.contains('dev-chat').click();
    });

    it('should open BulkExportDialog with selected count', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Bulk Export').should('be.visible');
      cy.get('[data-testid="multi-select-count"]').should('contain.text', '2 of');
    });

    it('should have HTML as default format', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').find('input[value="html"]').should('be.checked');
    });

    it('should show format options', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').contains('HTML').should('be.visible');
      cy.get('[role="dialog"]').contains('CSV').should('be.visible');
      cy.get('[role="dialog"]').contains('JSON').should('be.visible');
      cy.get('[role="dialog"]').contains('Media Only').should('be.visible');
    });

    it('should keep messages per page enabled for CSV and JSON formats', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').contains('label', 'CSV').click();
      cy.get('[role="dialog"]').find('input[type="number"]').should('not.be.disabled');
      cy.get('[role="dialog"]').contains('label', 'JSON').click();
      cy.get('[role="dialog"]').find('input[type="number"]').should('not.be.disabled');
    });

    it('should disable messages per page for Media Only format', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').contains('label', 'Media Only').click();
      cy.get('[role="dialog"]').find('input[type="number"]').should('be.disabled');
    });

    it('should close dialog on Cancel', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('[role="dialog"]').contains('button', 'Cancel').click();
      cy.get('[role="dialog"]').should('not.exist');
    });

    it('should show three accordion sections', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').contains('Format & Output').should('be.visible');
      cy.get('[role="dialog"]').contains('Content').should('exist');
      cy.get('[role="dialog"]').contains('Files & Media').scrollIntoView().should('be.visible');
    });

    it('should show channel list above accordion', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      // Channel names appear before the accordion sections
      cy.get('[role="dialog"]').contains('general').should('be.visible');
      cy.get('[role="dialog"]').contains('dev-chat').should('be.visible');
    });

    it('should have no media counts in bulk mode', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      // Expand Media accordion
      cy.get('[role="dialog"]').contains('Media Only').click();
      // In bulk mode, labels should be plain without file counts
      cy.get('[role="dialog"]').contains('Images').should('exist');
      cy.get('[role="dialog"]').contains(/\d+ files?/).should('not.exist');
    });

    it('should show preset selector', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').contains('Select a preset...').should('exist');
    });

    it('should show summary chip', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').contains('HTML').should('exist');
      cy.get('[role="dialog"]').contains('/page').should('exist');
    });

    it('shows optional "Add filters" affordance for narrowing (#112)', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').contains(/Narrow messages/i).should('be.visible');
      cy.get('[role="dialog"]')
        .find('button[aria-label="Add filters"]')
        .should('be.visible');
      // Empty filter state still allows export — filters are optional here.
      cy.get('[role="dialog"]')
        .contains('button', /Export 2 Channels/)
        .should('not.be.disabled');
    });

    it('opens the filter modal with the Refine section hidden (#112)', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').find('button[aria-label="Add filters"]').click();
      // FilterModal stacks atop the export dialog — `.last()` is it.
      cy.get('[role="dialog"]').last().within(() => {
        cy.contains('Search').should('be.visible');
        // hideRefineSection on FilterModal suppresses the Refine block.
        cy.contains('Refine').should('not.exist');
        // Confirm button is relabeled "Apply filters" for bulk context.
        // (Disabled at rest because no filter deltas yet — just assert it exists.)
        cy.contains('button', 'Apply filters').should('exist');
      });
    });

    it('applying a filter shows the filter chip row back in the export dialog (#112)', () => {
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').find('button[aria-label="Add filters"]').click();

      // Set a simple content filter in the modal
      cy.get('[role="dialog"]').last().within(() => {
        cy.get('input[placeholder*="Search message content"]').type('hello');
        cy.contains('button', 'Apply filters').click();
      });

      // Back in the outer export dialog: single "Edit filters (N)"
      // button — no separate Clear control (FilterModal owns Clear).
      cy.get('[role="dialog"]').first().within(() => {
        cy.get('button[aria-label="Edit filters"]').should('be.visible').and('contain', '(1)');
        cy.get('button[aria-label="Clear filters"]').should('not.exist');
      });
    });

    it('filter state clears when the export dialog is closed and reopened (regression)', () => {
      // Repro: without the keyed FilterModal remount, typed-but-not-
      // applied values persisted in the modal's internal useState even
      // after the outer dialog closed and reopened (because the
      // FilterModal component stayed mounted behind the scenes).
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').find('button[aria-label="Add filters"]').click();
      cy.get('[role="dialog"]').last().within(() => {
        cy.get('input[placeholder*="Search message content"]').type('stale-value');
        // Close without applying — hit the dialog-level Cancel.
        cy.contains('button', 'Cancel').click();
      });

      // Close the outer export dialog.
      cy.get('[role="dialog"]').contains('button', 'Cancel').click();
      cy.get('[role="dialog"]').should('not.exist');

      // Reopen the export dialog.
      cy.get('[aria-label="Export selected channels"]').click();
      // Filter chip row should show zero state (the typed value was never applied).
      cy.get('[role="dialog"]').find('button[aria-label="Add filters"]').should('be.visible');
      // Reopen the filter modal and confirm the content field is empty.
      cy.get('[role="dialog"]').find('button[aria-label="Add filters"]').click();
      cy.get('[role="dialog"]').last().within(() => {
        cy.get('input[placeholder*="Search message content"]').should('have.value', '');
      });
    });
  });

  describe('Filter criteria threading through search API (#112)', () => {
    beforeEach(() => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.contains('general').click();
    });

    it('with filters: hits /messages/search and NOT the list endpoint, criteria in URL', () => {
      // Route both endpoints to a single handler that classifies. We
      // cap list-fetch to a quick success so the export finishes.
      const listUrls: string[] = [];
      const searchUrls: string[] = [];

      cy.intercept('GET', '**/api/v10/channels/*/messages**', (req) => {
        if (req.url.includes('/messages/search')) {
          searchUrls.push(req.url);
          req.reply({ statusCode: 200, body: { messages: [], total_results: 0, threads: [] } });
        } else {
          listUrls.push(req.url);
          req.reply({ statusCode: 200, body: [] });
        }
      });

      cy.intercept('GET', '**/api/v10/guilds/*/messages/search**', (req) => {
        searchUrls.push(req.url);
        req.reply({ statusCode: 200, body: { messages: [], total_results: 0, threads: [] } });
      }).as('guildSearch');

      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').find('button[aria-label="Add filters"]').click();

      cy.get('[role="dialog"]').last().within(() => {
        cy.get('input[placeholder*="Search message content"]').type('hello');
        cy.contains('button', 'Apply filters').click();
      });

      cy.get('[role="dialog"]').contains('button', /Export/).click();

      // Wait on the actual search call — auth + thread discovery + export
      // kickoff takes longer than a fixed sleep can reliably cover.
      cy.wait('@guildSearch', { timeout: 20000 });

      cy.then(() => {
        expect(searchUrls.length, 'search endpoint hit').to.be.greaterThan(0);
        expect(listUrls.length, 'list endpoint NOT hit with filters').to.eq(0);
        const withContent = searchUrls.find((u) => u.includes('content=hello'));
        expect(
          withContent,
          `expected a search URL containing content=hello — saw: ${searchUrls.join(' | ')}`,
        ).to.exist;
      });
    });

    it('without filters: hits the list endpoint, NOT search (regression guard)', () => {
      const listUrls: string[] = [];
      const searchUrls: string[] = [];

      cy.intercept('GET', '**/api/v10/channels/*/messages**', (req) => {
        if (req.url.includes('/messages/search')) {
          searchUrls.push(req.url);
          req.reply({ statusCode: 200, body: { messages: [], total_results: 0, threads: [] } });
        } else {
          listUrls.push(req.url);
          req.reply({ statusCode: 200, body: [] });
        }
      }).as('channelFetch');

      cy.intercept('GET', '**/api/v10/guilds/*/messages/search**', (req) => {
        searchUrls.push(req.url);
        req.reply({ statusCode: 200, body: { messages: [], total_results: 0, threads: [] } });
      });

      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').contains('button', /Export/).click();

      // Wait for the list endpoint to fire at least once.
      cy.wait('@channelFetch', { timeout: 20000 });

      cy.then(() => {
        expect(listUrls.length, 'list endpoint hit').to.be.greaterThan(0);
        expect(searchUrls.length, 'search endpoint NOT hit without filters').to.eq(0);
      });
    });
  });

  describe('Bulk Export Dialog Media Settings', () => {
    beforeEach(() => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.contains('general').click();
      cy.get('[aria-label="Export selected channels"]').click();
      cy.get('[role="dialog"]').should('be.visible');
    });

    it('should force media checkbox checked when Media Only is selected', () => {
      cy.get('[role="dialog"]').contains('label', 'Media Only').click();
      cy.get('[role="dialog"]')
        .contains('label', 'Download files for offline viewing')
        .find('input[type="checkbox"]')
        .should('be.checked');
    });

    it('should disable media checkbox when Media Only is selected', () => {
      cy.get('[role="dialog"]').contains('label', 'Media Only').click();
      cy.get('[role="dialog"]')
        .contains('label', 'Download files for offline viewing')
        .find('input[type="checkbox"]')
        .should('be.disabled');
    });

    it('should restore media checkbox state when switching away from Media Only', () => {
      // Expand Media accordion (use AccordionSummary to avoid matching "Media Only" label)
      cy.get('[role="dialog"]').find('.MuiAccordionSummary-content').contains('Files & Media').scrollIntoView().click();

      cy.get('[role="dialog"]')
        .contains('label', 'Download files for offline viewing')
        .find('input[type="checkbox"]')
        .invoke('prop', 'checked')
        .then((initialState) => {
          // Switch to Media Only — forced checked
          cy.get('[role="dialog"]').contains('label', 'Media Only').scrollIntoView().click();
          cy.get('[role="dialog"]')
            .contains('label', 'Download files for offline viewing')
            .find('input[type="checkbox"]')
            .should('be.checked');

          // Switch back to HTML — should restore
          cy.get('[role="dialog"]').contains('label', 'HTML').scrollIntoView().click();
          cy.get('[role="dialog"]')
            .contains('label', 'Download files for offline viewing')
            .find('input[type="checkbox"]')
            .should(initialState ? 'be.checked' : 'not.be.checked');
        });
    });

    it('should show media type checkboxes when Media Only is selected', () => {
      cy.get('[role="dialog"]').contains('label', 'Media Only').click();
      cy.get('[role="dialog"]').contains('Media types to include:').should('exist');
      cy.get('[role="dialog"]').contains('Images').should('exist');
      cy.get('[role="dialog"]').contains('Videos').should('exist');
    });

    it('should hide "Other files" checkbox in web app mode', () => {
      cy.get('[role="dialog"]').contains('label', 'Media Only').click();
      cy.get('[role="dialog"]').contains('Media types to include:').should('exist');
      cy.get('[role="dialog"]').contains('Images').should('exist');
      cy.get('[role="dialog"]').contains('Other files').should('not.exist');
    });

    it('should show artist mode in Media section', () => {
      cy.get('[role="dialog"]').contains('label', 'Media Only').click();
      // Wait for media types to appear (Collapse animation), then scroll to Artist mode
      cy.get('[role="dialog"]').contains('Media types to include:').should('exist');
      // Artist mode may be below the fold — scroll dialog content
      cy.get('[role="dialog"]').find('.MuiDialogContent-root').scrollTo('bottom');
      cy.get('[role="dialog"]').contains('Artist mode').should('exist');
    });
  });

  describe('DM Multi-Select Mode', () => {
    beforeEach(() => {
      // Switch to DMs tab
      cy.contains('button', 'DMs').click();
      cy.wait('@getDMs');
    });

    it('should have multi-select toggle in DM list', () => {
      cy.get('[aria-label="Toggle multi-select"]').should('be.visible');
    });

    it('should enter multi-select mode and select DMs', () => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.contains('alice_dev').click();
      cy.contains('bob_gamer').click();
      cy.get('[data-testid="multi-select-count"]').should('contain.text', '2 of');
    });

    it('should show Export Selected button for DMs', () => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.contains('alice_dev').click();
      cy.get('[aria-label="Export selected conversations"]').should('be.visible');
    });

    it('should open BulkExportDialog for DMs', () => {
      cy.get('[aria-label="Toggle multi-select"]').first().click();
      cy.contains('alice_dev').click();
      cy.get('[aria-label="Export selected conversations"]').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Bulk Export').should('be.visible');
    });
  });
});
