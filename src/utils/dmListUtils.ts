/**
 * DM-list helpers shared by the sidebar rows and the list ordering
 * (#248) — extracted from `DMList.tsx` so `sortDms` labels conversations
 * exactly the way the rows render them.
 */

import type { Channel } from 'discrub-core/types/discord-types';
import { DmSortOrder } from 'discrub-core/discrub-enum';

// #227: type 3 = GROUP_DM. A group stays a group no matter how many
// recipients remain — Discord shows its custom name (when set) as the
// primary label, so we do too.
export const isGroupDm = (dm: Channel) => dm.type === 3;

export const getDmName = (dm: Channel) => {
  if (isGroupDm(dm) && dm.name) {
    return dm.name;
  }
  if (dm.recipients && dm.recipients.length > 0) {
    return dm.recipients.map((r) => r.username).join(', ');
  }
  return isGroupDm(dm) ? 'Group DM' : 'Direct Message';
};

export const getDmDisplayName = (dm: Channel) => {
  // Groups never borrow a single recipient's display name (#227) — that's
  // exactly how a dying group masquerades as a 1:1 DM.
  if (isGroupDm(dm)) return null;
  if (dm.recipients && dm.recipients.length === 1) {
    const r = dm.recipients[0];
    if (r.global_name && r.global_name !== r.username) return r.global_name;
  }
  return null;
};

/** Member count shown on group rows: remaining recipients + you. */
export const getGroupMemberCount = (dm: Channel) =>
  (dm.recipients?.length ?? 0) + 1;

/**
 * Millisecond timestamp of the conversation's last message, decoded from
 * the `last_message_id` snowflake. Null when the DM has no last message
 * or the id isn't a snowflake (deleted-channel edge cases).
 */
export const getDmLastMessageTime = (dm: Channel): number | null => {
  const lastMsgId = dm.last_message_id;
  if (!lastMsgId) return null;
  try {
    return Number(BigInt(lastMsgId) >> 22n) + 1420070400000;
  } catch {
    return null;
  }
};

/**
 * Order the DM list per the APP_DM_SORT_ORDER setting (#248).
 *
 * - `recent`: newest `last_message_id` first; DMs without one sink to the
 *   bottom. Ties and the bottom group keep the API's relative order
 *   (Array.prototype.sort is stable).
 * - `name`: alphabetical by the row's primary label (display name for
 *   1:1 DMs, custom name for groups — the same label the row renders).
 * - `discord`: the API's order, untouched.
 */
export const sortDms = (dms: Channel[], order: string): Channel[] => {
  if (order === DmSortOrder.RECENT) {
    return [...dms].sort(
      (a, b) => (getDmLastMessageTime(b) ?? -1) - (getDmLastMessageTime(a) ?? -1),
    );
  }
  if (order === DmSortOrder.NAME) {
    return [...dms].sort((a, b) =>
      (getDmDisplayName(a) || getDmName(a)).localeCompare(
        getDmDisplayName(b) || getDmName(b),
        undefined,
        { sensitivity: 'base' },
      ),
    );
  }
  return dms;
};
