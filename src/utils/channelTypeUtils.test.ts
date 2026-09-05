import { describe, it, expect } from 'vitest';
import { ChannelType } from 'discrub-core/discord-enum';
import { isMessageChannel, MESSAGE_CHANNEL_TYPES } from './channelTypeUtils';

describe('channelTypeUtils', () => {
  it('accepts every guild channel type that carries messages', () => {
    for (const type of [
      ChannelType.GUILD_TEXT,
      ChannelType.GUILD_ANNOUNCEMENT,
      ChannelType.GUILD_FORUM,
      ChannelType.GUILD_MEDIA,
      ChannelType.GUILD_VOICE,
      ChannelType.GUILD_STAGE_VOICE,
    ]) {
      expect(isMessageChannel({ type })).toBe(true);
    }
    expect(MESSAGE_CHANNEL_TYPES).toHaveLength(6);
  });

  it('rejects categories and other non-message containers', () => {
    expect(isMessageChannel({ type: ChannelType.GUILD_CATEGORY })).toBe(false);
    expect(isMessageChannel({ type: ChannelType.GUILD_DIRECTORY })).toBe(false);
  });
});
