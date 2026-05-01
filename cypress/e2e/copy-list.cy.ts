describe('Copy List', () => {
  beforeEach(() => {
    cy.login();
  });

  describe('Server List Copy', () => {
    it('should have copy server names button', () => {
      cy.get('[aria-label="Copy server names"]').should('be.visible');
    });

    it('should show Snackbar after clicking copy', () => {
      // Grant clipboard permission by stubbing
      cy.window().then((win) => {
        cy.stub(win.navigator.clipboard, 'writeText').resolves();
      });

      cy.get('[aria-label="Copy server names"]').click();
      cy.contains('Copied to clipboard').should('be.visible');
    });

    it('should copy server names to clipboard', () => {
      cy.window().then((win) => {
        const stub = cy.stub(win.navigator.clipboard, 'writeText').resolves();
        cy.get('[aria-label="Copy server names"]').click().then(() => {
          expect(stub).to.have.been.calledOnce;
          const copiedText = stub.firstCall.args[0];
          expect(copiedText).to.include('Cypress Test Server');
          expect(copiedText).to.include('Gaming Lounge');
          expect(copiedText).to.include('Dev Community');
        });
      });
    });
  });

  describe('Channel List Copy (multi-select toolbar)', () => {
    beforeEach(() => {
      cy.selectServer('Cypress Test Server');
      cy.contains('general').should('be.visible');
    });

    it('does not show the Copy button when nothing is selected', () => {
      cy.get('[data-testid="multi-select-copy"]').should('not.exist');
    });

    it('shows Copy in the multi-select toolbar once a channel is selected', () => {
      cy.get('[aria-label="Toggle multi-select"]').click();
      cy.contains('general').click();
      cy.get('[data-testid="multi-select-copy"]').should('be.visible');
    });

    it('copies only selected channel names and shows the snackbar', () => {
      cy.window().then((win) => {
        const stub = cy.stub(win.navigator.clipboard, 'writeText').resolves();
        cy.get('[aria-label="Toggle multi-select"]').click();
        cy.contains('general').click();
        cy.get('[data-testid="multi-select-copy"]').click().then(() => {
          expect(stub).to.have.been.calledOnce;
          const copiedText = stub.firstCall.args[0];
          expect(copiedText).to.equal('general');
          // dev-chat is unselected, so it must NOT be in the clipboard
          expect(copiedText).not.to.include('dev-chat');
        });
        cy.contains('Copied to clipboard').should('be.visible');
      });
    });
  });

  describe('DM List Copy (multi-select toolbar)', () => {
    beforeEach(() => {
      cy.contains('button', 'DMs').click();
      cy.wait('@getDMs');
    });

    it('does not show the Copy button when nothing is selected', () => {
      cy.get('[data-testid="multi-select-copy"]').should('not.exist');
    });

    it('shows Copy in the multi-select toolbar once a DM is selected', () => {
      cy.get('[aria-label="Toggle multi-select"]').click();
      cy.contains('alice_dev').click();
      cy.get('[data-testid="multi-select-copy"]').should('be.visible');
    });

    it('copies only selected DM names and shows the snackbar', () => {
      cy.window().then((win) => {
        const stub = cy.stub(win.navigator.clipboard, 'writeText').resolves();
        cy.get('[aria-label="Toggle multi-select"]').click();
        cy.contains('alice_dev').click();
        cy.get('[data-testid="multi-select-copy"]').click().then(() => {
          expect(stub).to.have.been.calledOnce;
          const copiedText = stub.firstCall.args[0];
          expect(copiedText).to.include('alice_dev');
          // Other DMs not selected, so should NOT appear
          expect(copiedText).not.to.include('bob_gamer');
          expect(copiedText).not.to.include('charlie_mod');
        });
        cy.contains('Copied to clipboard').should('be.visible');
      });
    });
  });
});
