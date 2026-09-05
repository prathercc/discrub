import type { AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';
import { t } from '@/i18n';

/**
 * Validate settings before saving
 * Returns array of error messages, empty if valid
 */
export const validateSettings = (settings: AppSettings): string[] => {
  const errors: string[] = [];

  // Validate messages per page
  const messagesPerPage = parseInt(settings[DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]);
  if (isNaN(messagesPerPage) || messagesPerPage < 1 || messagesPerPage > 1000) {
    errors.push(t('settings.validation.messagesPerPage'));
  }

  // Validate cached announcement revision
  const cachedRev = parseInt(settings[DiscrubSetting.CACHED_ANNOUNCEMENT_REV]);
  if (isNaN(cachedRev) || cachedRev < 0) {
    errors.push(t('settings.validation.announcementRev'));
  }

  return errors;
};
