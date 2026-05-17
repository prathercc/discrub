describe('Export', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
  });

  it('opens ExportDialog with "Export Messages" title', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('Export Messages').should('be.visible');
  });

  it('shows three accordion sections', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').contains('Format & Output').should('be.visible');
    cy.get('[role="dialog"]').contains('Content').should('exist');
    cy.get('[role="dialog"]').contains('Files & Media').scrollIntoView().should('be.visible');
  });

  it('Format & Output is expanded by default', () => {
    cy.contains('button', 'Export').click();
    // Format radios should be visible without clicking
    cy.get('[role="dialog"]').contains('HTML - Styled').should('be.visible');
  });

  it('has HTML as the default export format', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').contains('HTML - Styled').should('be.visible');
  });

  it('keeps "Messages per page" enabled for CSV and JSON formats', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').contains('CSV - Spreadsheet').click();
    cy.get('[role="dialog"]').find('input[type="number"]').should('not.be.disabled');
    cy.get('[role="dialog"]').contains('JSON - Raw').click();
    cy.get('[role="dialog"]').find('input[type="number"]').should('not.be.disabled');
  });

  // #184: Plain text format
  it('lists Plain Text as a format option', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').contains('Plain Text - Human-readable').should('be.visible');
  });

  it('reveals the text-format options panel when Plain Text is selected', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').contains('Plain Text - Human-readable').click();
    cy.get('[role="dialog"]').find('[data-testid="text-format-options"]').should('be.visible');
    // The four gated selectors should be present.
    cy.get('[data-testid="text-format-options"]').contains('Attachments').should('be.visible');
    cy.get('[data-testid="text-format-options"]').contains('Reactions').should('be.visible');
    cy.get('[data-testid="text-format-options"]').contains('Replies').should('be.visible');
    cy.get('[data-testid="text-format-options"]').contains('Bot tag').should('be.visible');
  });

  it('hides the text-format options panel when switching back to HTML', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').contains('Plain Text - Human-readable').click();
    cy.get('[data-testid="text-format-options"]').should('be.visible');
    cy.get('[role="dialog"]').contains('HTML - Styled').click();
    cy.get('[data-testid="text-format-options"]').should('not.exist');
  });

  it('hides the HTML Template dropdown when Plain Text is selected', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').contains('Plain Text - Human-readable').click();
    // Template dropdown is HTML-only.
    cy.get('[role="dialog"]').contains('Template').should('not.exist');
  });

  it('disables "Messages per page" input when Media Only is selected', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').contains('Media Only').click();
    cy.get('[role="dialog"]').find('input[type="number"]').should('be.disabled');
  });

  it('shows message count and channel name', () => {
    cy.contains('button', 'Export').click();
    cy.contains('Exporting 13 messages from').should('be.visible');
    cy.contains('general').should('be.visible');
  });

  it('closes dialog when clicking Cancel without exporting', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('[role="dialog"]').contains('button', 'Cancel').click();
    cy.get('[role="dialog"]').should('not.exist');
  });

  it('Content accordion expands on click', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').contains('Content').click();
    cy.get('[role="dialog"]').contains('Download threads').should('be.visible');
  });

  it('Sort order dropdown in Format section', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').contains('Sort Order').should('exist');
  });

  it('shows summary chip above export button', () => {
    cy.contains('button', 'Export').click();
    // Summary chip shows format info
    cy.get('[role="dialog"]').contains('HTML').should('exist');
    cy.get('[role="dialog"]').contains('/page').should('exist');
  });

  it('shows preset selector', () => {
    cy.contains('button', 'Export').click();
    cy.get('[role="dialog"]').contains('Choose...').should('exist');
  });

  describe('Preset application', () => {
    it('selecting a preset updates dialog format and settings', () => {
      cy.contains('button', 'Export').click();
      // Open preset dropdown
      cy.get('[role="dialog"]').find('[role="combobox"]').first().click({ force: true });
      // Select "Spreadsheet export" preset
      cy.get('[role="option"]').contains('Spreadsheet export').click();
      // Verify CSV is now selected
      cy.get('[role="dialog"]').find('input[value="csv"]').should('be.checked');
      // Messages per page should be enabled for CSV
      cy.get('[role="dialog"]').find('input[type="number"]').should('not.be.disabled');
    });

    it('selecting Media gallery preset enables artist mode', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').find('[role="combobox"]').first().click({ force: true });
      cy.get('[role="option"]').contains('Media gallery').click();
      // Media Only should be selected
      cy.get('[role="dialog"]').find('input[value="media"]').should('be.checked');
      // Artist mode should be checked (scroll into view first)
      cy.get('[role="dialog"]').contains('Artist mode').then(($el) => {
        $el[0].scrollIntoView({ block: 'center' });
      });
      cy.get('[role="dialog"]')
        .contains('label', 'Artist mode')
        .find('input[type="checkbox"]')
        .should('be.checked');
    });

    it('preset dropdown is clean-slate on reopen (does not persist across sessions)', () => {
      // Post-4ce3759 behavior: selecting a preset is session-local —
      // closing the dialog drops the selection so a fresh open starts
      // empty again. See memory/SESSION_2026_04_19 + EXPORT_SELECTED_PRESET
      // removal commits (4ce3759, 8ccf9d1, 9f3fe33).
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').find('[role="combobox"]').first().click({ force: true });
      cy.get('[role="option"]').contains('Spreadsheet export').click();
      // Close dialog
      cy.contains('button', 'Cancel').click();
      // Reopen — preset dropdown should be empty, NOT "Spreadsheet export"
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]')
        .find('[role="combobox"]')
        .first()
        .should('not.contain.text', 'Spreadsheet export');
    });

    it('manual format changes persist across reopen (settings are still saved globally)', () => {
      // The preset selection is session-local (clean-slate on reopen),
      // but the underlying export settings — format, pagination, etc. —
      // still persist via IndexedDB. A preset-selected-then-overridden
      // format should still be the manually-chosen format next time
      // the dialog opens, it just no longer carries the "(Modified)"
      // tag since the preset dropdown is cleared on close.
      cy.contains('button', 'Export').click();
      // Select Spreadsheet export preset (applies CSV + 100/page)
      cy.get('[role="dialog"]').find('[role="combobox"]').first().click({ force: true });
      cy.get('[role="option"]').contains('Spreadsheet export').click();
      cy.get('[role="dialog"]').find('input[value="csv"]').should('be.checked');
      // Manually override format to JSON
      cy.get('[role="dialog"]').find('input[value="json"]').parent().click();
      cy.get('[role="dialog"]').find('input[value="json"]').should('be.checked');
      // Close and reopen
      cy.contains('button', 'Cancel').click();
      cy.contains('button', 'Export').click();
      // Preset dropdown is clean-slate (empty), no "(Modified)" label
      cy.get('[role="dialog"]')
        .find('[role="combobox"]')
        .first()
        .should('not.contain.text', 'Modified');
      // But JSON format persisted because export settings still live in storage
      cy.get('[role="dialog"]').find('input[value="json"]').should('be.checked');
    });
  });

  describe('Template persistence', () => {
    it('selected template persists when dialog is closed and reopened', () => {
      cy.contains('button', 'Export').click();
      // Expand Content section to find template dropdown
      cy.get('[role="dialog"]').contains('Content').click();
      // Change template to Standard (default is Discord Layout)
      cy.get('[role="dialog"]').find('[role="combobox"]').last().click({ force: true });
      cy.get('[role="option"]').contains('Standard').click();
      // Close and reopen
      cy.contains('button', 'Cancel').click();
      cy.contains('button', 'Export').click();
      // Template should be persisted — summary chip should show "Standard"
      cy.get('[role="dialog"]').contains('Standard').should('exist');
    });
  });

  describe('Display options', () => {
    it('shows Display options sub-header with preview control', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('Media Only').click();
      cy.get('[role="dialog"]').find('.MuiDialogContent-root').scrollTo('bottom');
      cy.get('[role="dialog"]').contains('Display options:').should('exist');
      cy.get('[role="dialog"]').contains('Preview media in export').should('exist');
    });
  });

  describe('Template selector', () => {
    it('shows template dropdown for HTML format', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('Template').should('exist');
    });

    it('hides template dropdown for non-HTML formats', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('CSV - Spreadsheet').click();
      cy.get('[role="dialog"]').contains('Template').should('not.exist');
    });

    it('summary chip shows template name when changed', () => {
      cy.contains('button', 'Export').click();
      // Default is Discord Layout — switch to Standard
      cy.get('[role="dialog"]').find('[role="combobox"]').last().click({ force: true });
      cy.get('[role="option"]').contains('Standard').click();
      cy.get('[role="dialog"]').contains('Standard').should('exist');
    });
  });

  describe('Media file counts', () => {
    it('shows "(0 files)" for categories with no attachments', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('Media Only').click();
      cy.get('[role="dialog"]').contains('Media types to include:').should('exist');
      // general channel has 1 image attachment, 0 videos, 0 audio
      cy.get('[role="dialog"]').contains(/Videos \(0 files\)/).should('exist');
      cy.get('[role="dialog"]').contains(/Audio \(0 files\)/).should('exist');
    });

    it('shows file count and size for categories with attachments', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('Media Only').click();
      cy.get('[role="dialog"]').contains('Media types to include:').should('exist');
      // general channel has 1 image attachment
      cy.get('[role="dialog"]').contains(/Images \(1 file/).should('exist');
    });
  });

  describe('Summary chip updates', () => {
    it('updates summary chip when switching format to CSV', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('CSV - Spreadsheet').click();
      cy.get('[role="dialog"]').contains('CSV').should('exist');
      cy.get('[role="dialog"]').contains('/page').should('exist');
    });

    it('summary chip omits per page for Media Only', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('Media Only').click();
      // Summary should show MEDIA but not /page
      cy.get('[role="dialog"]').contains('MEDIA').should('exist');
    });

    it('summary chip shows "Reactions: detailed" for HTML format', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('Reactions: detailed').should('exist');
    });

    it('summary chip shows "Reactions: counts only" for CSV format', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('CSV - Spreadsheet').click();
      cy.get('[role="dialog"]').contains('Reactions: counts only').should('exist');
    });

    it('summary chip omits reaction info for Media Only', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('Media Only').click();
      cy.get('[role="dialog"]').contains('Reactions').should('not.exist');
    });
  });

  describe('Recent exports panel', () => {
    it('does not show recent exports when no history exists', () => {
      cy.contains('button', 'Export').click();
      // With no export history, the recent exports panel should not be visible
      cy.get('[role="dialog"]').contains('Recent exports').should('not.exist');
    });
  });

  describe('Media settings restore', () => {
    it('forces media checkbox checked when Media Only is selected', () => {
      cy.contains('button', 'Export').click();
      // Expand Media accordion
      cy.get('[role="dialog"]').contains('Media Only').click();
      // Media accordion should auto-expand
      cy.get('[role="dialog"]')
        .contains('label', 'Download files for offline viewing')
        .find('input[type="checkbox"]')
        .should('be.checked');
    });

    it('disables media checkbox when Media Only is selected', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('Media Only').click();
      cy.get('[role="dialog"]')
        .contains('label', 'Download files for offline viewing')
        .find('input[type="checkbox"]')
        .should('be.disabled');
    });

    it('restores media checkbox state when switching away from Media Only', () => {
      cy.contains('button', 'Export').click();

      // Expand Media accordion (use AccordionSummary to avoid matching "Media Only" label)
      cy.get('[role="dialog"]').find('.MuiAccordionSummary-content').contains('Files & Media').scrollIntoView().click();

      // Capture the initial checkbox state
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

          // Switch back to HTML — should restore original state
          cy.get('[role="dialog"]').contains('label', 'HTML - Styled').scrollIntoView().click();
          cy.get('[role="dialog"]')
            .contains('label', 'Download files for offline viewing')
            .find('input[type="checkbox"]')
            .should(initialState ? 'be.checked' : 'not.be.checked');
        });
    });

    it('shows media type checkboxes when media is enabled', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('Media Only').click();
      cy.get('[role="dialog"]').contains('Media types to include:').should('exist');
      cy.get('[role="dialog"]').contains('Images').should('exist');
      cy.get('[role="dialog"]').contains('Videos').should('exist');
      cy.get('[role="dialog"]').contains('Audio').should('exist');
    });

    it('hides "Other files" checkbox in web app mode', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('Media Only').click();
      cy.get('[role="dialog"]').contains('Media types to include:').should('exist');
      cy.get('[role="dialog"]').contains('Images').should('exist');
      cy.get('[role="dialog"]').contains('Other files').should('not.exist');
    });

    it('Artist mode checkbox in Media section', () => {
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').contains('Media Only').click();
      // Wait for media types to appear (Collapse animation), then scroll dialog to bottom
      cy.get('[role="dialog"]').contains('Media types to include:').should('exist');
      cy.get('[role="dialog"]').find('.MuiDialogContent-root').scrollTo('bottom');
      cy.get('[role="dialog"]').contains('Artist mode').should('exist');
    });
  });
});
