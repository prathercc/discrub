import type { Message, User, Attachment } from 'discrub-core/types/discord-types';
import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import { AuthorType, HasType, IsPinnedType } from 'discrub-core/discord-enum';
import { groupsToTypes } from '@/utils/systemMessageGroups';

// #201 — system-message refine is CLIENT-SIDE only (Discord's search API has
// no MessageType param). These fields ride on the refine criteria object so
// the single applyRefineCriteria predicate handles them and every
// filteredMessages recompute site inherits the behavior.
export type SystemMessageRefineMode = 'only' | 'hide';

export type RefineCriteria = SearchCriteria & {
  /** Selected system-message bucket keys (see systemMessageGroups). */
  systemMessageGroups?: string[];
  /** 'only' → show just these types; 'hide' → drop them. Defaults to 'only'. */
  systemMessageMode?: SystemMessageRefineMode;
};

/**
 * Whether a refine criteria object has any filter actually set. Used to
 * decide whether a refine needs to be applied at all — an "empty" criteria
 * object is the default state and should be treated as no-op.
 */
export const criteriaIsActive = (criteria: RefineCriteria | null | undefined): boolean => {
  if (!criteria) return false;
  if (criteria.searchMessageContent) return true;
  if (criteria.searchAfterDate || criteria.searchBeforeDate) return true;
  if (criteria.selectedHasTypes && criteria.selectedHasTypes.length > 0) return true;
  if (criteria.userIds && criteria.userIds.length > 0) return true;
  if (criteria.mentionIds && criteria.mentionIds.length > 0) return true;
  if (criteria.isPinned !== undefined && criteria.isPinned !== IsPinnedType.UNSET) return true;
  if (criteria.authorType) return true;
  if (criteria.systemMessageGroups && criteria.systemMessageGroups.length > 0) return true;
  return false;
};

/**
 * Pure client-side filter over Discord messages. Mirrors the criteria the
 * FilterModal's Refine section exposes. Extracted from ServerView so the
 * message slice can reuse it in data-arrival reducers (to keep the refine
 * applied as new pages stream in).
 */
export const applyRefineCriteria = (
  messages: Message[],
  criteria: RefineCriteria | null | undefined,
): Message[] => {
  if (!criteriaIsActive(criteria)) return messages;
  const c = criteria as RefineCriteria;

  // #201 — precompute the selected system-message types once (enum string
  // values → numbers, since msg.type is numeric on the wire).
  const systemTypeSet =
    c.systemMessageGroups && c.systemMessageGroups.length > 0
      ? new Set(groupsToTypes(c.systemMessageGroups).map(Number))
      : null;

  return messages.filter((msg) => {
    if (c.searchMessageContent) {
      const content = msg.content?.toLowerCase() || '';
      if (!content.includes(c.searchMessageContent.toLowerCase())) return false;
    }

    if (c.searchAfterDate || c.searchBeforeDate) {
      const msgDate = msg.timestamp ? new Date(msg.timestamp) : null;
      if (!msgDate) return false;
      if (c.searchAfterDate && msgDate < c.searchAfterDate) return false;
      if (c.searchBeforeDate && msgDate > c.searchBeforeDate) return false;
    }

    if (c.selectedHasTypes && c.selectedHasTypes.length > 0) {
      const hasMatchingType = c.selectedHasTypes.some((type) => {
        switch (type) {
          case HasType.EMBED:
            return !!msg.embeds && msg.embeds.length > 0;
          case HasType.IMAGE:
            return !!msg.attachments?.some((a: Attachment) =>
              a.content_type?.startsWith('image/'),
            );
          case HasType.VIDEO:
            return !!msg.attachments?.some((a: Attachment) =>
              a.content_type?.startsWith('video/'),
            );
          case HasType.SOUND:
            return !!msg.attachments?.some((a: Attachment) =>
              a.content_type?.startsWith('audio/'),
            );
          case HasType.FILE:
            return !!msg.attachments && msg.attachments.length > 0;
          case HasType.LINK:
            return (
              !!msg.content?.includes('http://') ||
              !!msg.content?.includes('https://')
            );
          case HasType.STICKER:
            return !!msg.sticker_items && msg.sticker_items.length > 0;
          case HasType.POLL:
            return !!(msg as Record<string, unknown>).poll;
          case HasType.FORWARD:
            // #197: the load-bearing field is `message_snapshots`. Older
            // code checked `msg.type === 1` (which is RECIPIENT_ADD, not
            // a forward) plus a truthy probe of message_reference.type
            // that worked by coincidence (FORWARD's discriminator value
            // is 1, REPLY's is 0). Snapshot presence is the canonical
            // check — forwards always carry a snapshot, snapshots only
            // exist on forwards.
            return Array.isArray(msg.message_snapshots) && msg.message_snapshots.length > 0;
          default:
            return false;
        }
      });
      if (!hasMatchingType) return false;
    }

    if (c.userIds && c.userIds.length > 0) {
      if (!c.userIds.includes(msg.author?.id || '')) return false;
    }

    if (c.isPinned !== undefined && c.isPinned !== IsPinnedType.UNSET) {
      const isPinned = msg.pinned === true;
      if (c.isPinned === IsPinnedType.YES && !isPinned) return false;
      if (c.isPinned === IsPinnedType.NO && isPinned) return false;
    }

    if (c.authorType) {
      const isBot = msg.author?.bot === true;
      const isWebhook = !!msg.webhook_id;
      switch (c.authorType) {
        case AuthorType.USER:
          if (isBot || isWebhook) return false;
          break;
        case AuthorType.BOT:
          if (!isBot) return false;
          break;
        case AuthorType.WEBHOOK:
          if (!isWebhook) return false;
          break;
      }
    }

    if (c.mentionIds && c.mentionIds.length > 0) {
      const mentionedIds = msg.mentions?.map((u: User) => u.id) || [];
      const hasMention = c.mentionIds.some((id) => mentionedIds.includes(id));
      if (!hasMention) return false;
    }

    // #201 — system-message type filter. 'only' keeps just the selected
    // types (drop everything else); 'hide' drops the selected types.
    if (systemTypeSet) {
      const isSelectedType = systemTypeSet.has(msg.type);
      const mode = c.systemMessageMode ?? 'only';
      if (mode === 'only' && !isSelectedType) return false;
      if (mode === 'hide' && isSelectedType) return false;
    }

    return true;
  });
};
