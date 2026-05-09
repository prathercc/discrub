/// <reference types="cypress" />

/**
 * E2E coverage for the streamed-package architecture (#162).
 *
 * Walks the full user journey that the new architecture unlocks:
 *   1. Upload a package (streams once into IndexedDB)
 *   2. Browse channels — reads come from IDB, no re-decompression
 *   3. Refresh the page — package auto-resumes from IDB without re-upload
 *   4. Browse the resumed package
 *   5. Close the package — IDB cleared
 *   6. Re-import — works cleanly from a clean slate
 *
 * Existing import + delete + analytics coverage stays in
 * `data-package-import.cy.ts`. This file focuses on streaming-specific
 * behavior (persistence, resume, IDB cleanup) that didn't exist before
 * #162.
 */

describe('Data package streaming + resume (#162)', () => {
  beforeEach(() => {
    cy.login();
  });

  describe('Stream once, read many', () => {
    it('writes pkg:* keys to Discrub-package on import', () => {
      cy.uploadPackage();
      cy.contains(/6 messages/).should('be.visible');

      // Inspect IDB to confirm the streaming pass wrote the expected keys.
      cy.readIdbStoreKeys('package').then((keys) => {
        // Assertions are independent of fixture's particular userId, so
        // we match by prefix rather than full key.
        expect(keys.some((k) => k.startsWith('pkg:meta:'))).to.equal(
          true,
          'pkg:meta:{userId} commit marker should exist',
        );
        expect(keys.filter((k) => k.startsWith('pkg:msgs:')).length).to.be.greaterThan(
          0,
          'pkg:msgs:{userId}:{channelId} per-channel keys should exist',
        );
        expect(keys).to.include('pkg:schema-version');
      });
    });

    it('opening a channel does not require re-decompression', () => {
      cy.uploadPackage();
      cy.contains(/6 messages/).should('be.visible');

      // Open the same channel twice; both reads should succeed instantly
      // from IDB (no spinner-lasting-seconds, no error).
      cy.contains('general').click();
      cy.contains('hello world').should('be.visible');
      cy.get('[aria-label="Back to analytics"]').click();
      cy.contains('general').click();
      cy.contains('hello world').should('be.visible');
    });
  });

  describe('Resume on refresh', () => {
    it('automatically resumes the stored package after a page reload', () => {
      cy.uploadPackage();
      cy.contains(/6 messages/).should('be.visible');

      // Reload — the user should NOT be sent back to the import prompt.
      cy.reload();
      cy.openPackageTab();

      // Same summary chips re-emerge from the resumed metadata.
      cy.contains(/6 messages/, { timeout: 10000 }).should('be.visible');
      cy.contains(/3 channels/).should('be.visible');
      // No "Choose ZIP file" affordance in the loaded view.
      cy.contains('button', /Choose ZIP file/i).should('not.exist');
    });

    it('resumed package can browse channels without a re-upload', () => {
      cy.uploadPackage();
      cy.contains(/6 messages/).should('be.visible');
      cy.reload();
      cy.openPackageTab();

      cy.contains(/6 messages/, { timeout: 10000 }).should('be.visible');
      cy.contains('general').click();
      cy.contains('hello world').should('be.visible');
    });
  });

  describe('Close package', () => {
    it('clearing the package wipes pkg:* keys from IDB', () => {
      cy.uploadPackage();
      cy.contains(/6 messages/).should('be.visible');

      cy.contains('button', /Close package/i).click();
      cy.contains(/Import a Discord Data Package/i).should('be.visible');

      cy.readIdbStoreKeys('package').then((keys) => {
        const ownedByPkg = keys.filter(
          (k) => k.startsWith('pkg:meta:') || k.startsWith('pkg:msgs:') || k.startsWith('pkg:avatar:'),
        );
        expect(ownedByPkg).to.have.lengthOf(0);
      });
    });

    it('after close, a fresh import works from a clean slate', () => {
      cy.uploadPackage();
      cy.contains(/6 messages/).should('be.visible');
      cy.contains('button', /Close package/i).click();
      cy.contains(/Import a Discord Data Package/i).should('be.visible');

      // Re-upload — should land on the same loaded view.
      cy.uploadPackage();
      cy.contains(/6 messages/).should('be.visible');
      cy.contains(/3 channels/).should('be.visible');
    });

    it('reload after close stays on the empty-state view (no resume from wiped IDB)', () => {
      cy.uploadPackage();
      cy.contains(/6 messages/).should('be.visible');
      cy.contains('button', /Close package/i).click();
      cy.contains(/Import a Discord Data Package/i).should('be.visible');

      cy.reload();
      cy.openPackageTab();
      cy.contains(/Import a Discord Data Package/i).should('be.visible');
      cy.contains(/6 messages/).should('not.exist');
    });
  });

  describe('Cross-package isolation', () => {
    it('after close + re-import, the IDB shows only one user\'s pkg:* keys', () => {
      // First user (matched).
      cy.uploadPackage();
      cy.contains(/6 messages/).should('be.visible');

      // UI gate: a different package can only be imported after closing
      // the current one. The streaming layer additionally wipes any
      // orphan keys at the start of every import as a defense-in-depth
      // measure (asserted in the streamService unit tests).
      cy.contains('button', /Close package/i).click();
      cy.contains(/Import a Discord Data Package/i).should('be.visible');

      // Second package — mismatched user, soft-warns into read-only.
      cy.uploadPackage('test-package-mismatched.zip');
      cy.contains(/different user/i).should('be.visible');

      // After the second import, only ONE meta key should exist (the new
      // one). The previous user's pkg:* data was wiped by the close-package
      // path (resetPackage) and would have been wiped again by the
      // pre-stream cleanup either way.
      cy.readIdbStoreKeys('package').then((keys) => {
        const metaKeys = keys.filter((k) => k.startsWith('pkg:meta:'));
        expect(metaKeys.length).to.equal(1, 'Only the most recent import should leave a meta key');
      });
    });
  });
});
