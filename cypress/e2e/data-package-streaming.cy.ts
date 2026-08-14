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

/**
 * The per-user deleted-message cache (#236) lives in the same
 * `Discrub-package` database as the `pkg:*` namespace, keyed
 * `deleted:{userId}`. The user id below comes from account/user.json
 * inside test-package.zip. Unlike `pkg:*`, this key deliberately
 * survives Close package (`clearPackageContents` only removes `pkg:*`).
 */
const PACKAGE_DB = 'Discrub-package';
const PACKAGE_OBJECT_STORE = 'keyval';
const FIXTURE_USER_ID = '111222333444555666';
const DELETED_CACHE_KEY = `deleted:${FIXTURE_USER_ID}`;

type DeletedCacheMap = Record<string, string[]>;

/**
 * Open Discrub-package the same way idb-keyval does (no explicit
 * version; create the `keyval` store on first touch) so seeding works
 * even before the app has opened the database in the current test.
 */
function openPackageDb(win: Cypress.AUTWindow): PromiseLike<IDBDatabase> {
  return new Cypress.Promise<IDBDatabase>((resolve, reject) => {
    const req = win.indexedDB.open(PACKAGE_DB);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(PACKAGE_OBJECT_STORE)) {
        req.result.createObjectStore(PACKAGE_OBJECT_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Read the persisted deleted-message map (undefined when never written). */
function readDeletedCache(): Cypress.Chainable<DeletedCacheMap | undefined> {
  return cy.window({ log: false }).then((win) =>
    openPackageDb(win).then(
      (db) =>
        new Cypress.Promise<DeletedCacheMap | undefined>((resolve, reject) => {
          const tx = db.transaction(PACKAGE_OBJECT_STORE, 'readonly');
          const get = tx
            .objectStore(PACKAGE_OBJECT_STORE)
            .get(DELETED_CACHE_KEY);
          get.onsuccess = () => {
            db.close();
            resolve(get.result as DeletedCacheMap | undefined);
          };
          get.onerror = () => {
            db.close();
            reject(get.error);
          };
        }),
    ),
  );
}

/** Seed the persisted deleted-message map before an import runs. */
function seedDeletedCache(map: DeletedCacheMap): Cypress.Chainable<void> {
  return cy.window({ log: false }).then((win) =>
    openPackageDb(win).then(
      (db) =>
        new Cypress.Promise<void>((resolve, reject) => {
          const tx = db.transaction(PACKAGE_OBJECT_STORE, 'readwrite');
          tx.objectStore(PACKAGE_OBJECT_STORE).put(map, DELETED_CACHE_KEY);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        }),
    ),
  );
}

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

  describe('Deleted-message cache pruning on import (#236)', () => {
    it('re-importing the same archive keeps every cached id and still subtracts it', () => {
      cy.uploadPackage();
      cy.contains(/6 messages/).should('be.visible');

      // Delete one message through the real flow so the cache is seeded
      // exactly the way production writes it.
      cy.contains('general').click();
      cy.contains('hello world').should('be.visible');
      cy.intercept('DELETE', '**/api/v10/channels/200/messages/*', {
        statusCode: 204,
      }).as('deleteMsg');
      cy.get('input[aria-label="Select message 1001"]').click();
      cy.contains('button', /Delete selected/i).click();
      cy.get('[role="dialog"]').contains('button', 'Delete').click();
      cy.wait('@deleteMsg');
      cy.contains(/Deleted 1 message/i, { timeout: 10000 }).should('be.visible');

      readDeletedCache().then((cache) => {
        expect(cache).to.deep.equal({ '200': ['1001'] });
      });

      // Close the package: pkg:* keys are wiped but the deleted cache
      // deliberately survives — it is the cross-import purge history.
      cy.get('[aria-label="Back to analytics"]').click();
      cy.contains('button', /Close package/i).click();
      cy.contains(/Import a Discord Data Package/i).should('be.visible');
      readDeletedCache().then((cache) => {
        expect(cache).to.deep.equal({ '200': ['1001'] });
      });

      // Re-import the SAME archive. Message 1001 is still inside it, so
      // the prune keeps the id and the live counts subtract it: 6 - 1.
      cy.uploadPackage();
      cy.contains(/5 messages/).should('be.visible');
      readDeletedCache().then((cache) => {
        expect(cache).to.deep.equal({ '200': ['1001'] });
      });
    });

    it('importing an archive prunes cached ids and channels it no longer contains', () => {
      // Seed the cache as if earlier purges ran against an OLDER export:
      //  - channel 200 mixes an id the archive still contains ('1001')
      //    with one it does not ('9999')
      //  - channel 555 is absent from the archive entirely
      seedDeletedCache({ '200': ['1001', '9999'], '555': ['7777'] });

      cy.uploadPackage();

      // Only the surviving id counts toward the live totals: 6 - 1.
      // (Pre-#236 the stale '9999' double-subtracted into "4 messages".)
      cy.contains(/5 messages/).should('be.visible');
      cy.contains(/4 messages/).should('not.exist');

      // The persisted map was pruned and written back: the stale message
      // id is gone, the absent channel dropped, the present id kept.
      readDeletedCache().then((cache) => {
        expect(cache).to.deep.equal({ '200': ['1001'] });
      });
    });
  });
});
