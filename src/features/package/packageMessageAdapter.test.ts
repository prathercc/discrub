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
        attachments: [],
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

  it('populates a single Attachment from a one-URL list', () => {
    const result = toDiscordMessage(
      {
        id: 'm2',
        timestamp: '2022-08-01 00:00:00.000000+00:00',
        content: 'with file',
        attachments: ['https://cdn.discordapp.com/attachments/1/2/photo.png?ex=0'],
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
        attachments: ['not-a-url'],
      },
      'c200',
      user,
    );

    expect(result.attachments[0].filename).toBe('not-a-url');
  });

  // Backlog #159: messages with multiple attachments shipped as a
  // single space-separated CSV cell upstream. The adapter must build
  // one Attachment per URL with unique synthetic IDs (so React keys
  // don't collide).
  it('builds one Attachment per URL for multi-attachment messages (#159)', () => {
    const result = toDiscordMessage(
      {
        id: 'm5',
        timestamp: '2022-08-01 00:00:00.000000+00:00',
        content: 'three pics',
        attachments: [
          'https://cdn.discordapp.com/attachments/1/2/a.png',
          'https://cdn.discordapp.com/attachments/1/2/b.jpg',
          'https://cdn.discordapp.com/attachments/1/2/c.gif',
        ],
      },
      'c200',
      user,
    );

    expect(result.attachments).toHaveLength(3);
    expect(result.attachments.map((a) => a.id)).toEqual(['m5-0', 'm5-1', 'm5-2']);
    expect(result.attachments.map((a) => a.filename)).toEqual(['a.png', 'b.jpg', 'c.gif']);
  });

  it('sets safe defaults for unused Message fields', () => {
    const result = toDiscordMessage(
      { id: 'm4', timestamp: 't', content: '', attachments: [] },
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
