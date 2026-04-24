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

  describe('Channel List Copy', () => {
    beforeEach(() => {
      cy.selectServer('Cypress Test Server');
      cy.contains('general').should('be.visible');
    });

    it('should have copy channel names button', () => {
      cy.get('[aria-label="Copy channel names"]').should('be.visible');
    });

    it('should show Snackbar after clicking copy', () => {
      cy.window().then((win) => {
        cy.stub(win.navigator.clipboard, 'writeText').resolves();
      });

      cy.get('[aria-label="Copy channel names"]').click();
      cy.contains('Copied to clipboard').should('be.visible');
    });

    it('should copy channel names to clipboard', () => {
      cy.window().then((win) => {
        const stub = cy.stub(win.navigator.clipboard, 'writeText').resolves();
        cy.get('[aria-label="Copy channel names"]').click().then(() => {
          expect(stub).to.have.been.calledOnce;
          const copiedText = stub.firstCall.args[0];
          expect(copiedText).to.include('general');
          expect(copiedText).to.include('dev-chat');
        });
      });
    });
  });

  describe('DM List Copy', () => {
    beforeEach(() => {
      cy.contains('button', 'DMs').click();
      cy.wait('@getDMs');
    });

    it('should have copy DM names button', () => {
      cy.get('[aria-label="Copy DM names"]').should('be.visible');
    });

    it('should show Snackbar after clicking copy', () => {
      cy.window().then((win) => {
        cy.stub(win.navigator.clipboard, 'writeText').resolves();
      });

      cy.get('[aria-label="Copy DM names"]').click();
      cy.contains('Copied to clipboard').should('be.visible');
    });

    it('should copy DM names to clipboard', () => {
      cy.window().then((win) => {
        const stub = cy.stub(win.navigator.clipboard, 'writeText').resolves();
        cy.get('[aria-label="Copy DM names"]').click().then(() => {
          expect(stub).to.have.been.calledOnce;
          const copiedText = stub.firstCall.args[0];
          expect(copiedText).to.include('alice_dev');
          expect(copiedText).to.include('bob_gamer');
          expect(copiedText).to.include('charlie_mod');
        });
      });
    });
  });
});
