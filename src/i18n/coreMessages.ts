import i18next from 'i18next';
import { setCoreMessages } from 'discrub-core/messages';

/**
 * Hands discrub-core the current translations for the progress and
 * permission strings it emits. Called after every language change;
 * the core reads its catalog at call time so the next status line is
 * already in the new language.
 */
export function syncCoreMessages(): void {
  const t = i18next.t.bind(i18next);
  setCoreMessages({
    retrievedThreads: (count) => t('core.retrievedThreads', { count }),
    retrievedSearchResults: (count, total) =>
      t('core.retrievedSearchResults', { count, total }),
    retrievedMessages: (count) => t('core.retrievedMessages', { count }),
    retrievingThreadMessages: (threadName) =>
      t('core.retrievingThreadMessages', { threadName }),
    searchingReactions: (index, total) => t('core.searchingReactions', { index, total }),
    resolvingReplyParents: (index, total) =>
      t('core.resolvingReplyParents', { index, total }),
    retrievingReactionUsers: (emojiName, index, total, isCustom) =>
      t(isCustom ? 'core.retrievingReactionUsersCustom' : 'core.retrievingReactionUsers', {
        emojiName,
        index,
        total,
      }),
    retrievingUserAlias: (user) => t('core.retrievingUserAlias', { user }),
    retrievingServerData: (user) => t('core.retrievingServerData', { user }),
    permissionMissingSkippingEdit: () => t('core.permissionMissingSkippingEdit'),
    noPermissionToModifyMessage: () => t('core.noPermissionToModifyMessage'),
    noPermissionToModifyLocation: () => t('core.noPermissionToModifyLocation'),
    unableToRemoveReaction: (user) => t('core.unableToRemoveReaction', { user }),
  });
}
