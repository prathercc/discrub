import { afterEach, describe, expect, it } from 'vitest';
import { coreMessages, resetCoreMessages } from 'discrub-core/messages';
import { applyLanguage } from './index';

describe('core message bridge (#124)', () => {
  afterEach(async () => {
    await applyLanguage('en');
    resetCoreMessages();
  });

  it('hands discrub-core German strings after a language switch and English again after switching back', async () => {
    await applyLanguage('de');
    expect(coreMessages().retrievedMessages(12)).toBe('12 Nachrichten geladen');
    expect(coreMessages().retrievingReactionUsers('fire', 2, 5, true)).toBe(
      'Reaktionsnutzer für fire werden geladen (2/5) [benutzerdefiniert]',
    );
    expect(coreMessages().noPermissionToModifyMessage()).toBe(
      'Du hast keine Berechtigung, diese Nachricht zu ändern!',
    );
    await applyLanguage('en');
    expect(coreMessages().retrievedMessages(12)).toBe('Retrieved 12 messages');
    expect(document.documentElement.lang).toBe('en');
  });

  it('sets the document language', async () => {
    await applyLanguage('de');
    expect(document.documentElement.lang).toBe('de');
  });
});
