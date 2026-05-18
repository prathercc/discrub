/**
 * #172: Refine (filter) flow on the package message table.
 *
 * Validates the round-trip between FilterModal, ActiveFilterChips, the
 * filtered render, and the filter-aware count badge. The test bar is
 * "rock-solid refine/un-refine cycles" — every state transition has an
 * assertion, and we re-open the modal after each transition to confirm
 * the modal also reflects the current criteria.
 *
 * Fixture (scripts/build-cypress-package-fixture.cjs, channel 200 "general"):
 *   1001  2022-07-28 22:30:52  hello world
 *   1002  2022-07-28 22:31:00  with, comma
 *   1003  2022-07-28 22:32:00  multi\nline content
 *   1004  2022-08-01 10:00:00  attached file (+ URL)
 */

describe('Package refine (#172)', () => {
  beforeEach(() => {
    cy.login();
    cy.uploadPackage();
    cy.contains('general').click();
    cy.contains('hello world').should('be.visible');
  });

  it('Refine button defaults to "Refine" with no active filter', () => {
    cy.get('[data-testid="package-refine-button"]').should('contain.text', 'Refine');
    cy.get('[data-testid="package-active-filter-chips"]').should('not.exist');
  });

  it('shows the message count without a filter', () => {
    // 4 messages in the fixture channel 200.
    cy.contains(/^4 messages$/).should('be.visible');
  });

  it('opens FilterModal in package mode (no Mentions/Has/Pinned/From)', () => {
    cy.get('[data-testid="package-refine-button"]').click();
    cy.get('[role="dialog"]').should('be.visible');
    // Header shows "Refine"; live-mode "Search" header should not be present
    // in package mode (the section header reads "Refine").
    cy.get('[role="dialog"]').contains('Refine').should('be.visible');
    // No "Discord API" badge.
    cy.get('[role="dialog"]').contains('Discord API').should('not.exist');
    // No fields that don't apply to package data.
    cy.get('[role="dialog"]').contains('Mentions').should('not.exist');
    cy.get('[role="dialog"]').contains('Author Type').should('not.exist');
    // "Loaded messages" is the live-mode Refine-section badge, also absent.
    cy.get('[role="dialog"]').contains('Loaded messages').should('not.exist');
    // Content + Date are present.
    cy.get('[role="dialog"]').contains('Date').should('be.visible');
    cy.get('[role="dialog"]').find('input[placeholder*="Search message content"]').should('be.visible');
  });

  describe('content filter round-trip', () => {
    it('filters by content, reflects count, and renders only matching rows', () => {
      cy.get('[data-testid="package-refine-button"]').click();
      cy.get('[role="dialog"]').find('input[placeholder*="Search message content"]').type('hello');
      cy.get('[role="dialog"]').find('button[class*="contained"]').contains(/Apply filters|Search/).click();

      // Modal closes, count reflects filtered subset.
      cy.get('[role="dialog"]').should('not.exist');
      cy.contains(/^1 of 4 messages match$/).should('be.visible');

      // Chip + Refining label appear; Refine button switches state.
      cy.get('[data-testid="package-refine-button"]').should('contain.text', 'Refining');
      cy.get('[data-testid="package-active-filter-chips"]').should('be.visible');
      cy.contains('content: hello').should('be.visible');

      // Only the matching row renders.
      cy.contains('hello world').should('be.visible');
      cy.contains('with, comma').should('not.exist');
      cy.contains('attached file').should('not.exist');
    });

    it('clearing the content chip restores all 4 rows + count', () => {
      // Apply a content filter first.
      cy.get('[data-testid="package-refine-button"]').click();
      cy.get('[role="dialog"]').find('input[placeholder*="Search message content"]').type('hello');
      cy.get('[role="dialog"]').find('button[class*="contained"]').contains(/Apply filters|Search/).click();
      cy.contains(/^1 of 4 messages match$/).should('be.visible');

      // Click the chip's delete X.
      cy.contains('content: hello').parent().find('[data-testid="CancelIcon"]').click();

      // Filter cleared.
      cy.get('[data-testid="package-refine-button"]').should('contain.text', 'Refine');
      cy.get('[data-testid="package-active-filter-chips"]').should('not.exist');
      cy.contains(/^4 messages$/).should('be.visible');

      // Every row is back.
      cy.contains('hello world').should('be.visible');
      cy.contains('with, comma').should('be.visible');
      cy.contains('attached file').should('be.visible');
    });

    it('reopening the modal after Apply shows the saved criteria', () => {
      cy.get('[data-testid="package-refine-button"]').click();
      cy.get('[role="dialog"]').find('input[placeholder*="Search message content"]').type('hello');
      cy.get('[role="dialog"]').find('button[class*="contained"]').contains(/Apply filters|Search/).click();

      cy.get('[data-testid="package-refine-button"]').click();
      // The input should have the previously saved value.
      cy.get('[role="dialog"]').find('input[placeholder*="Search message content"]').should('have.value', 'hello');
      // Cancel without changing.
      cy.get('[role="dialog"]').contains('button', 'Cancel').click();

      // Filter remains active.
      cy.contains(/^1 of 4 messages match$/).should('be.visible');
    });
  });

  describe('clear-all flow', () => {
    it('the "Clear all filters" X removes every chip', () => {
      cy.get('[data-testid="package-refine-button"]').click();
      cy.get('[role="dialog"]').find('input[placeholder*="Search message content"]').type('hello');
      cy.get('[role="dialog"]').find('button[class*="contained"]').contains(/Apply filters|Search/).click();

      cy.contains('content: hello').should('be.visible');
      // The Clear-all icon button sits at the end of the chips row.
      cy.get('[aria-label="Clear all filters"]').click();

      cy.get('[data-testid="package-active-filter-chips"]').should('not.exist');
      cy.contains(/^4 messages$/).should('be.visible');
    });

    it('the modal\'s in-modal Clear button resets the active filter', () => {
      // Apply first.
      cy.get('[data-testid="package-refine-button"]').click();
      cy.get('[role="dialog"]').find('input[placeholder*="Search message content"]').type('hello');
      cy.get('[role="dialog"]').find('button[class*="contained"]').contains(/Apply filters|Search/).click();
      cy.contains(/^1 of 4 messages match$/).should('be.visible');

      // Re-open and use the modal's Clear control. By design the modal
      // stays open after Clear (so the user can immediately enter new
      // criteria); we close it manually after to confirm clearing took.
      cy.get('[data-testid="package-refine-button"]').click();
      cy.get('[data-testid="clear-search-filters"]').click();
      cy.get('[role="dialog"]').contains('button', 'Cancel').click();

      cy.get('[data-testid="package-active-filter-chips"]').should('not.exist');
      cy.contains(/^4 messages$/).should('be.visible');
    });
  });

  describe('per-channel scope', () => {
    it('switching channels does not carry the filter across', () => {
      // Apply on general.
      cy.get('[data-testid="package-refine-button"]').click();
      cy.get('[role="dialog"]').find('input[placeholder*="Search message content"]').type('hello');
      cy.get('[role="dialog"]').find('button[class*="contained"]').contains(/Apply filters|Search/).click();
      cy.contains(/^1 of 4 messages match$/).should('be.visible');

      // Go back to analytics and open another channel.
      cy.get('[aria-label="Back to analytics"]').click();
      cy.contains(/Top channels by message count/i).should('be.visible');

      // Open the DM channel. The package fixture indexes this channel as
      // "Direct Message with tester-friend#0"; getPackageChannelLabel
      // strips both the discriminator and the "Direct Message with"
      // prefix, leaving the handle as the rendered sidebar label.
      cy.contains('tester-friend').click();

      // Different channel, fresh state: no chips, no "X of N match".
      cy.get('[data-testid="package-active-filter-chips"]').should('not.exist');
      cy.get('[data-testid="package-refine-button"]').should('contain.text', 'Refine');

      // Going back to general restores its saved filter.
      cy.get('[aria-label="Back to analytics"]').click();
      cy.contains('general').click();
      cy.contains(/^1 of 4 messages match$/).should('be.visible');
      cy.get('[data-testid="package-refine-button"]').should('contain.text', 'Refining');
    });
  });

  describe('select-all respects the filtered subset', () => {
    it('"Select all" only checks visible rows after a filter is applied', () => {
      // No filter — Select all picks up all 4.
      cy.get('input[aria-label="Select all messages"]').click();
      cy.contains(/^4 selected$/).should('be.visible');
      cy.get('input[aria-label="Select all messages"]').click();
      cy.contains(/^4 messages$/).should('be.visible');

      // Apply a content filter.
      cy.get('[data-testid="package-refine-button"]').click();
      cy.get('[role="dialog"]').find('input[placeholder*="Search message content"]').type('hello');
      cy.get('[role="dialog"]').find('button[class*="contained"]').contains(/Apply filters|Search/).click();

      // Select-all on the filtered view picks up just the 1 row.
      cy.get('input[aria-label="Select all messages"]').click();
      cy.contains(/^1 selected$/).should('be.visible');
    });
  });
});
