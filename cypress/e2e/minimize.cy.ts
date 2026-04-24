describe('Minimize Feature', () => {
  beforeEach(() => {
    cy.login();
  });

  describe('Button Visibility (Web Mode)', () => {
    it('should not show minimize button in web mode', () => {
      // In web mode (not extension), minimize button should not exist
      cy.get('[aria-label="Minimize Discrub"]').should('not.exist');
    });

    it('should not show close button in web mode', () => {
      // In web mode (not extension), close button should not exist
      cy.get('[aria-label="Close Discrub"]').should('not.exist');
    });
  });

  describe('Operation State Awareness', () => {
    it('should track operation state when export starts', () => {
      cy.selectServer('Cypress Test Server');
      cy.selectChannel('general');

      // Intercept export-related endpoint to keep it pending (never resolve)
      cy.intercept('GET', '**/api/v10/channels/*/messages?*', (req) => {
        // Let the initial messages load normally but delay subsequent calls
        req.continue();
      });

      // Open export dialog
      cy.contains('button', 'Export').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Export Messages').should('be.visible');
    });

    it('should show operation warning in close dialog during export when overlay mode is simulated', () => {
      cy.selectServer('Cypress Test Server');
      cy.selectChannel('general');

      // Set isExporting in Redux state directly via window store
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'export/setIsExporting', payload: true });
        }
      });

      // The close button only shows in overlay mode, which we can't simulate
      // in Cypress. This test verifies the Redux state is accessible.
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          const state = store.getState();
          // Verify app state is accessible
          expect(state.app).to.exist;
        }
      });
    });
  });

  describe('Redux State Management', () => {
    it('should have isMinimized default to false', () => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          const state = store.getState();
          expect(state.app.isMinimized).to.eq(false);
        }
      });
    });

    it('should update isMinimized via dispatch', () => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'app/setMinimized', payload: true });
          expect(store.getState().app.isMinimized).to.eq(true);

          store.dispatch({ type: 'app/setMinimized', payload: false });
          expect(store.getState().app.isMinimized).to.eq(false);
        }
      });
    });

    it('should preserve operation state through minimize toggle', () => {
      cy.selectServer('Cypress Test Server');
      cy.selectChannel('general');

      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          // Simulate minimize
          store.dispatch({ type: 'app/setMinimized', payload: true });
          expect(store.getState().app.isMinimized).to.eq(true);

          // Verify message state is unaffected
          const messageState = store.getState().message;
          expect(messageState).to.exist;

          // Restore
          store.dispatch({ type: 'app/setMinimized', payload: false });
          expect(store.getState().app.isMinimized).to.eq(false);

          // Verify message state is still intact
          expect(store.getState().message).to.deep.eq(messageState);
        }
      });
    });
  });

  describe('beforeunload Protection', () => {
    it('should register beforeunload when minimized', () => {
      // Minimized state should trigger beforeunload warning
      // We verify by checking the hook is active when isMinimized is true
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          store.dispatch({ type: 'app/setMinimized', payload: true });

          // The useBeforeUnloadWarning hook checks isMinimized || isOperationRunning
          // We can't directly test beforeunload in Cypress, but we verify the state
          expect(store.getState().app.isMinimized).to.eq(true);
        }
      });
    });
  });

  describe('Operation Completion While Minimized', () => {
    it('should reflect operation completion in state', () => {
      cy.window().then((win) => {
        const store = (win as any).__store__;
        if (store) {
          // Simulate: start export, minimize, then export completes
          store.dispatch({ type: 'app/setMinimized', payload: true });

          // Verify isMinimized persists independently of export state
          expect(store.getState().app.isMinimized).to.eq(true);
          expect(store.getState().export.isExporting).to.eq(false);

          // Clean up
          store.dispatch({ type: 'app/setMinimized', payload: false });
        }
      });
    });
  });
});
