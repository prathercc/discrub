import type { AppSettings } from 'discrub-core/types/discrub-types';
import { DiscrubSetting } from 'discrub-core/discrub-enum';

/**
 * Validate settings before saving
 * Returns array of error messages, empty if valid
 */
export const validateSettings = (settings: AppSettings): string[] => {
  const errors: string[] = [];

  // Validate messages per page
  const messagesPerPage = parseInt(settings[DiscrubSetting.EXPORT_MESSAGES_PER_PAGE]);
  if (isNaN(messagesPerPage) || messagesPerPage < 1 || messagesPerPage > 1000) {
    errors.push('Messages per page must be between 1 and 1000');
  }

  // Validate cached announcement revision
  const cachedRev = parseInt(settings[DiscrubSetting.CACHED_ANNOUNCEMENT_REV]);
  if (isNaN(cachedRev) || cachedRev < 0) {
    errors.push('Cached announcement revision must be a non-negative number');
  }

  return errors;
};
