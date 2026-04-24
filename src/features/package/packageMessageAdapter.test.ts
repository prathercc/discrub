import { describe, it, expect } from 'vitest';
import { toDiscordMessage } from './packageMessageAdapter';
import type { PackageUser } from './packageTypes';

const user: PackageUser = {
  id: 'u1',
  username: 'tester',
  globalName: 'Tester',
  avatarHash: 'abc',
};

describe('toDiscordMessage', () => {
  it('maps basic fields from PackageMessage', () => {
    const result = toDiscordMessage(
      {
        id: 'm1',
        timestamp: '2022-07-28 22:30:52.800000+00:00',
        content: 'hello',
        attachment: null,
      },
      'c200',
      user,
    );

    expect(result.id).toBe('m1');
    expect(result.channel_id).toBe('c200');
    expect(result.content).toBe('hello');
    expect(result.timestamp).toBe('2022-07-28 22:30:52.800000+00:00');
    expect(result.author.id).toBe('u1');
    expect(result.author.username).toBe('tester');
    expect(result.attachments).toEqual([]);
  });

  it('populates attachments array from attachment URL', () => {
    const result = toDiscordMessage(
      {
        id: 'm2',
        timestamp: '2022-08-01 00:00:00.000000+00:00',
        content: 'with file',
        attachment: 'https://cdn.discordapp.com/attachments/1/2/photo.png?ex=0',
      },
      'c200',
      user,
    );

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].url).toBe(
      'https://cdn.discordapp.com/attachments/1/2/photo.png?ex=0',
    );
    expect(result.attachments[0].filename).toBe('photo.png');
  });

  it('falls back to raw URL for non-parseable attachment strings', () => {
    const result = toDiscordMessage(
      {
        id: 'm3',
        timestamp: '2022-08-01 00:00:00.000000+00:00',
        content: '',
        attachment: 'not-a-url',
      },
      'c200',
      user,
    );

    expect(result.attachments[0].filename).toBe('not-a-url');
  });

  it('sets safe defaults for unused Message fields', () => {
    const result = toDiscordMessage(
      { id: 'm4', timestamp: 't', content: '', attachment: null },
      'c200',
      user,
    );

    expect(result.embeds).toEqual([]);
    expect(result.mentions).toEqual([]);
    expect(result.mention_everyone).toBe(false);
    expect(result.pinned).toBe(false);
    expect(result.type).toBe(0);
    expect(result.tts).toBe(false);
    expect(result.edited_timestamp).toBeNull();
  });
});
