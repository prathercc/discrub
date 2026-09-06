describe('Pause/Resume Controls', () => {
  beforeEach(() => {
    cy.login();
    cy.selectServer('Cypress Test Server');
    cy.selectChannel('general');
    cy.contains('[data-testid="message-feed-row"]', 'Hello everyone! Welcome to the server.').should('exist');
  });

  describe('Button Visibility', () => {
    it('should not show pause/resume controls when no operation is running', () => {
      cy.get('[aria-label="Pause"]').should('not.exist');
      cy.get('[aria-label="Resume"]').should('not.exist');
      cy.get('[aria-label="Cancel"]').should('not.exist');
    });

    it('should show pause button when an operation is running', () => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'export/exportMessages/pending' });
          // isExporting = true triggers isOperationRunning
        }
      });
      cy.get('[aria-label="Pause"]').should('be.visible');
      cy.get('[aria-label="Cancel"]').should('be.visible');
    });

    it('should show resume button when operation is paused', () => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'export/exportMessages/pending' });
          store.dispatch({ type: 'app/setDiscrubPaused', payload: true });
        }
      });
      cy.get('[aria-label="Resume"]').should('be.visible');
      cy.get('[aria-label="Cancel"]').should('be.visible');
    });
  });

  describe('Rest breaks (GH #14)', () => {
    it('counts down an automatic rest break and lets Resume skip it', () => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        store.dispatch({ type: 'export/exportMessages/pending' });
        // What useRestBreaks does after 45 minutes of activity.
        store.dispatch({ type: 'app/setRestBreakUntil', payload: Date.now() + 10 * 60 * 1000 });
        store.dispatch({ type: 'app/setDiscrubPaused', payload: true });
      });
      cy.get('[data-testid="rest-break-countdown"]').should('be.visible').and('contain', 'Rest break · resumes in 9:5');
      cy.get('[aria-label="Resume"]').should('be.visible').click();
      cy.window().its('__store__').invoke('getState').its('app.discrubPaused').should('eq', false);
      // The hook notices the resume on its next tick, clears the marker, and logs the skip.
      cy.get('[data-testid="rest-break-countdown"]', { timeout: 5000 }).should('not.exist');
      cy.window().its('__store__').invoke('getState').its('app.restBreakUntil').should('eq', null);
      cy.window().then((win) => {
        const entries = (win as any).__store__.getState().status.entries.map((e: any) => e.message);
        expect(entries.some((m: string) => /Rest break skipped/.test(m))).to.be.true;
      });
    });
  });

  describe('Pause/Resume Actions', () => {
    beforeEach(() => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'export/exportMessages/pending' });
        }
      });
    });

    it('clicking pause should set paused state', () => {
      cy.get('[aria-label="Pause"]').click({ force: true });
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          expect(store.getState().app.discrubPaused).to.eq(true);
        }
      });
      cy.get('[aria-label="Resume"]').should('be.visible');
    });

    it('clicking resume should clear paused state', () => {
      cy.get('[aria-label="Pause"]').click({ force: true });
      cy.get('[aria-label="Resume"]').should('be.visible');
      cy.get('[aria-label="Resume"]').click({ force: true });
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          expect(store.getState().app.discrubPaused).to.eq(false);
        }
      });
      cy.get('[aria-label="Pause"]').should('be.visible');
    });

    it('clicking cancel should set cancelled state and clear paused', () => {
      cy.get('[aria-label="Pause"]').click({ force: true });
      cy.get('[aria-label="Cancel"]').click({ force: true });
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          expect(store.getState().app.discrubCancelled).to.eq(true);
          expect(store.getState().app.discrubPaused).to.eq(false);
        }
      });
    });
  });

  describe('Status Log Spinner', () => {
    it('should show spinner in status log when operation is running', () => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'export/exportMessages/pending' });
        }
      });
      cy.get('[aria-label="Operation in progress"]').should('be.visible');
    });

    it('should show paused spinner when operation is paused', () => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'export/exportMessages/pending' });
          store.dispatch({ type: 'app/setDiscrubPaused', payload: true });
        }
      });
      cy.get('[aria-label="Operation paused"]').should('be.visible');
    });

    it('should not show spinner when no operation is running', () => {
      cy.get('[aria-label="Operation in progress"]').should('not.exist');
      cy.get('[aria-label="Operation paused"]').should('not.exist');
    });
  });

  describe('Integration with Export', () => {
    it('should show pause button when export dialog starts export', () => {
      // Set up a never-resolving intercept for the export to keep isExporting true
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'export/exportMessages/pending' });
        }
      });

      cy.get('[aria-label="Pause"]').should('be.visible');
    });

    it('should hide controls after operation completes', () => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'export/exportMessages/pending' });
        }
      });
      cy.get('[aria-label="Pause"]').should('be.visible');

      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({
            type: 'export/exportMessages/fulfilled',
            payload: { success: true },
          });
        }
      });
      cy.get('[aria-label="Pause"]').should('not.exist');
    });
  });

  describe('Operation Tier System', () => {
    it('should show spinner but NOT pause/cancel for light operations (message loading)', () => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'message/fetchMessages/pending' });
        }
      });
      // Spinner should be visible for light operations
      cy.get('[aria-label="Operation in progress"]').should('be.visible');
      // Pause/cancel controls should NOT appear for light operations
      cy.get('[aria-label="Pause"]').should('not.exist');
      cy.get('[aria-label="Cancel"]').should('not.exist');
    });

    it('should show spinner AND pause/cancel for heavy operations (export)', () => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'export/exportMessages/pending' });
        }
      });
      cy.get('[aria-label="Operation in progress"]').should('be.visible');
      cy.get('[aria-label="Pause"]').should('be.visible');
      cy.get('[aria-label="Cancel"]').should('be.visible');
    });

    it('should show spinner for forum thread loading (light operation)', () => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'channel/fetchForumThreads/pending' });
        }
      });
      cy.get('[aria-label="Operation in progress"]').should('be.visible');
      cy.get('[aria-label="Pause"]').should('not.exist');
    });
  });
});
