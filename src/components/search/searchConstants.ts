import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import { IsPinnedType } from 'discrub-core/discord-enum';

export const defaultCriteria: SearchCriteria = {
  searchBeforeDate: null,
  searchAfterDate: null,
  searchMessageContent: null,
  selectedHasTypes: [],
  userIds: [],
  mentionIds: [],
  channelIds: [],
  isPinned: IsPinnedType.UNSET,
  authorType: null,
};
