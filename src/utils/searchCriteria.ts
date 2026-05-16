import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import { IsPinnedType } from 'discrub-core/discord-enum';

export const countActiveFilters = (criteria: SearchCriteria): number => {
  let count = 0;
  if (criteria.searchMessageContent) count++;
  if (criteria.userIds && criteria.userIds.length > 0) count += criteria.userIds.length;
  if (criteria.selectedHasTypes && criteria.selectedHasTypes.length > 0) {
    count += criteria.selectedHasTypes.length;
  }
  if (criteria.searchAfterDate) count++;
  if (criteria.searchBeforeDate) count++;
  if (criteria.isPinned !== undefined && criteria.isPinned !== IsPinnedType.UNSET) count++;
  if (criteria.authorType) count++;
  if (criteria.mentionIds && criteria.mentionIds.length > 0) count += criteria.mentionIds.length;
  return count;
};

export const countTotalFilters = (search: SearchCriteria, refine: SearchCriteria): number => {
  return countActiveFilters(search) + countActiveFilters(refine);
};

export const hasActiveSearchFilters = (
  criteria: SearchCriteria | null | undefined,
): boolean => {
  if (!criteria) return false;
  return countActiveFilters(criteria) > 0;
};
