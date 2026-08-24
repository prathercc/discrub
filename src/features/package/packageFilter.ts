import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import type { PackageMessage } from './packageTypes';
import { messageMatchesAttachmentCriteria } from 'discrub-core/filtering';

/**
 * #172: Predicate applying live FilterModal criteria to package-only data.
 *
 * `PackageMessage` exposes only `id`, `timestamp`, `content`, and
 * `attachments`. Criteria that depend on Tier 2 rehydration data
 * (pinned, mentions, reactions, author, has-type) are silently ignored
 * here — the consumer (PackageMessageTable) hides those controls in
 * `packageMode` so they never get populated, and if they ever did (via
 * a saved preset, for example) we don't want to drop every row.
 */
export function matchesPackageFilter(
  message: PackageMessage,
  criteria: SearchCriteria | null | undefined,
): boolean {
  if (!criteria) return true;

  if (criteria.searchMessageContent) {
    const needle = criteria.searchMessageContent.toLowerCase();
    if (!message.content.toLowerCase().includes(needle)) return false;
  }

  if (criteria.searchAfterDate || criteria.searchBeforeDate) {
    const ts = Date.parse(message.timestamp);
    if (Number.isNaN(ts)) {
      // Malformed timestamp — treat as not matching a date filter
      // rather than silently passing it through.
      return false;
    }
    if (criteria.searchAfterDate) {
      const after = criteria.searchAfterDate instanceof Date
        ? criteria.searchAfterDate.getTime()
        : Date.parse(String(criteria.searchAfterDate));
      if (ts < after) return false;
    }
    if (criteria.searchBeforeDate) {
      const before = criteria.searchBeforeDate instanceof Date
        ? criteria.searchBeforeDate.getTime()
        : Date.parse(String(criteria.searchBeforeDate));
      if (ts > before) return false;
    }
  }

  // GH #13 — attachments in a package are bare CDN URLs; the filename is
  // the last path segment (query string stripped). Same matcher as the
  // live Refine layer so both modes agree.
  if ((criteria.attachmentExtensions?.length ?? 0) > 0 || criteria.attachmentFilename) {
    const attachments = message.attachments.map((url) => ({ filename: packageAttachmentFilename(url) }));
    if (!messageMatchesAttachmentCriteria(attachments, criteria.attachmentExtensions, criteria.attachmentFilename)) {
      return false;
    }
  }

  return true;
}

/** `https://cdn.discordapp.com/attachments/1/2/photo.png?ex=0` → `photo.png`. */
export function packageAttachmentFilename(url: string): string {
  const path = url.split(/[?#]/)[0];
  const segment = path.substring(path.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Returns the subset of `messages` matching `criteria`. Equivalent to
 * `messages.filter((m) => matchesPackageFilter(m, criteria))` but
 * short-circuits to the original array when no criteria is set (avoiding
 * an allocation on the unfiltered hot path).
 */
export function applyPackageFilter(
  messages: PackageMessage[],
  criteria: SearchCriteria | null | undefined,
): PackageMessage[] {
  if (!criteria) return messages;
  if (!hasAnyPackageCriterion(criteria)) return messages;
  return messages.filter((m) => matchesPackageFilter(m, criteria));
}

/**
 * Quick check: does this criteria object carry any criterion the
 * package-side predicate actually evaluates? Used to short-circuit
 * `applyPackageFilter` (and to suppress an "0 of N match" badge when
 * the user opened the modal but didn't change anything).
 */
export function hasAnyPackageCriterion(
  criteria: SearchCriteria | null | undefined,
): boolean {
  if (!criteria) return false;
  return Boolean(
    (criteria.searchMessageContent && criteria.searchMessageContent.length > 0) ||
    criteria.searchAfterDate ||
    criteria.searchBeforeDate ||
    (criteria.attachmentExtensions && criteria.attachmentExtensions.length > 0) ||
    criteria.attachmentFilename,
  );
}
