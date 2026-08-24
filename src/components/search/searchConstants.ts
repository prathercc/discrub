import type { SearchCriteria } from 'discrub-core/types/discrub-types';
import { IsPinnedType } from 'discrub-core/discord-enum';

export const defaultCriteria: SearchCriteria = {
  searchBeforeDate: null,
  searchAfterDate: null,
  searchMessageContents: [],
  selectedHasTypes: [],
  userIds: [],
  mentionIds: [],
  channelIds: [],
  isPinned: IsPinnedType.UNSET,
  authorType: null,
  attachmentExtensions: [],
  attachmentFilename: null,
};
