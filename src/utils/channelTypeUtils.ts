import { ChannelType } from 'discrub-core/discord-enum';
import type { Channel } from 'discrub-core/types/discord-types';

/**
 * Guild channel types that carry fetchable messages. Voice (2) and
 * Stage (13) carry persistent text chat under the same channel ID
 * since Discord's 2021 Voice Channel Messages rollout — same
 * `GET /channels/{id}/messages` endpoint, same permission gate as
 * text. See backlog #160. Shared by ChannelList (click gating) and
 * the multi-server purge (#255, channel discovery per server).
 */
export const MESSAGE_CHANNEL_TYPES: ReadonlyArray<ChannelType> = [
  ChannelType.GUILD_TEXT,
  ChannelType.GUILD_ANNOUNCEMENT,
  ChannelType.GUILD_FORUM,
  ChannelType.GUILD_MEDIA,
  ChannelType.GUILD_VOICE,
  ChannelType.GUILD_STAGE_VOICE,
];

export const isMessageChannel = (channel: Pick<Channel, 'type'>): boolean =>
  MESSAGE_CHANNEL_TYPES.includes(channel.type);
