import { describe, expect, it } from 'vitest';
import { act, fireEvent, renderWithProviders, screen } from '@/test/test-utils';
import { createBaseState } from '@/test/state-factories';
import { applyLanguage } from '@/i18n';
import { defaultSettings } from '@features/app/appSlice';
import LanguageLink from './LanguageLink';

describe('LanguageLink (#124)', () => {
  it('offers the other language and saves it on click', () => {
    const base = createBaseState();
    const { store } = renderWithProviders(<LanguageLink />, {
      preloadedState: { ...base, app: { ...base.app, settings: defaultSettings } },
    });
    expect(screen.queryByTestId('landing-language-en')).toBeNull();
    const de = screen.getByTestId('landing-language-de');
    expect(de).toHaveTextContent('Deutsch');
    expect(de).toHaveAttribute('lang', 'de');
    fireEvent.click(de);
    expect(store.getState().app.settings?.appLanguage).toBe('de');
  });

  it('offers English while German is active', async () => {
    await act(async () => {
      await applyLanguage('de');
    });
    renderWithProviders(<LanguageLink />, { preloadedState: createBaseState() });
    expect(screen.getByTestId('landing-language-en')).toHaveTextContent('English');
    expect(screen.queryByTestId('landing-language-de')).toBeNull();
  });
});
