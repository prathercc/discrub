import { useEffect } from 'react';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { useAppSelector } from '@/app/hooks';
import { selectSettings } from '@features/app/appSlice';
import { applyLanguage } from './index';
import { normalizeLanguage } from './language';

/**
 * Mirrors the persisted `APP_LANGUAGE` setting into i18next. Runs before
 * settings load too (English), so the landing page renders immediately.
 */
export function useLanguageSync(): void {
  const stored = useAppSelector(selectSettings)?.[DiscrubSetting.APP_LANGUAGE];
  const language = normalizeLanguage(stored);
  useEffect(() => {
    void applyLanguage(language);
  }, [language]);
}
