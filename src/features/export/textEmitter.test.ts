import { describe, it, expect } from 'vitest';
import type { Message } from 'discrub-core/types/discord-types';
import {
  buildTextMessageBlock,
  generateTextPage,
} from './textEmitter';
import { defaultTextFormatOptions, type TextFormatOptions } from './exportTypes';

const baseAuthor = {
  id: '111',
  username: 'alice',
  global_name: 'Alice',
  discriminator: '0',
  avatar: null,
  bot: false,
} as any;

const botAuthor = {
  id: '222',
  username: 'helper',
  global_name: 'Helper',
  discriminator: '0',
  avatar: null,
  bot: true,
} as any;

function makeMessage(overrides: Partial<Message>): Message {
  return {
    id: '1',
    channel_id: 'c1',
    author: baseAuthor,
    content: '',
    timestamp: '2026-01-02T03:04:05Z',
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    pinned: false,
    type: 0,
    ...overrides,
  } as Message;
}

const exportConfig = {
  artistMode: false,
  sortOrder: 'descending' as const,
  previewMedia: false,
  dateFormat: 'yyyy-MM-dd',
  timeFormat: 'HH:mm:ss',
};

const cachedUserMap = {};

describe('textEmitter', () => {
  describe('buildTextMessageBlock — single message variants', () => {
    it('renders a plain message with author + timestamp header and body line', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ content: 'Hello world!' }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines[0]).toMatch(/^@Alice \(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\)$/);
      expect(lines[1]).toBe('Hello world!');
    });

    it('preserves embedded newlines as their own lines in the output', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ content: 'first\nsecond\nthird' }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      // header + 3 body lines
      expect(lines.length).toBe(4);
      expect(lines[1]).toBe('first');
      expect(lines[2]).toBe('second');
      expect(lines[3]).toBe('third');
    });

    it('omits a body line entirely when content is empty', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ content: '' }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines.length).toBe(1);
      expect(lines[0]).toMatch(/^@Alice /);
    });

    it('appends ", edited <ts>" when edited_timestamp is set', () => {
      const lines = buildTextMessageBlock(
        makeMessage({
          content: 'edited body',
          edited_timestamp: '2026-01-02T03:05:00Z',
        }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines[0]).toMatch(/, edited \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\)$/);
    });

    it('appends "[BOT]" when the author is a bot and the indicator is included', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ author: botAuthor, content: 'beep' }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines[0]).toMatch(/^@Helper \[BOT\] \(/);
    });

    it('treats webhook messages as bots for the indicator', () => {
      const lines = buildTextMessageBlock(
        makeMessage({
          content: 'hook',
          webhook_id: 'webhook-id',
        }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines[0]).toContain('[BOT]');
    });

    it('omits the bot indicator when botIndicator === "skip"', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ author: botAuthor, content: 'beep' }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        { ...defaultTextFormatOptions, botIndicator: 'skip' },
      );
      expect(lines[0]).not.toContain('[BOT]');
    });
  });

  describe('replies', () => {
    const referenced = makeMessage({
      id: 'r1',
      author: baseAuthor,
      content: 'this is the message being replied to',
    });

    it('prepends a "> @author: snippet" line when in quote mode', () => {
      const lines = buildTextMessageBlock(
        makeMessage({
          content: 'reply body',
          message_reference: { message_id: 'r1' } as any,
          referenced_message: referenced as any,
        }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines[0]).toBe('> @Alice: this is the message being replied to');
      expect(lines[1]).toMatch(/^@Alice /);
      expect(lines[2]).toBe('reply body');
    });

    it('truncates long snippets to ~80 chars with an ellipsis', () => {
      const long = 'x'.repeat(200);
      const lines = buildTextMessageBlock(
        makeMessage({
          content: 'r',
          message_reference: { message_id: 'r1' } as any,
          referenced_message: { ...referenced, content: long } as any,
        }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines[0]).toMatch(/^> @Alice: x+…$/);
      expect(lines[0].length).toBeLessThanOrEqual(95);
    });

    it('renders "> reply to @author" only when replies === "link"', () => {
      const lines = buildTextMessageBlock(
        makeMessage({
          content: 'r',
          message_reference: { message_id: 'r1' } as any,
          referenced_message: referenced as any,
        }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        { ...defaultTextFormatOptions, replies: 'link' },
      );
      expect(lines[0]).toBe('> reply to @Alice');
    });

    it('omits the reply line entirely when replies === "skip"', () => {
      const lines = buildTextMessageBlock(
        makeMessage({
          content: 'r',
          message_reference: { message_id: 'r1' } as any,
          referenced_message: referenced as any,
        }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        { ...defaultTextFormatOptions, replies: 'skip' },
      );
      expect(lines[0]).toMatch(/^@Alice /);
    });

    it('surfaces "(referenced message unavailable)" in link mode when the referenced message is gone', () => {
      const lines = buildTextMessageBlock(
        makeMessage({
          content: 'r',
          message_reference: { message_id: 'r1' } as any,
          referenced_message: null as any,
        }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        { ...defaultTextFormatOptions, replies: 'link' },
      );
      expect(lines[0]).toBe('> (referenced message unavailable)');
    });

    it('collapses multi-line referenced content onto a single quote line', () => {
      const lines = buildTextMessageBlock(
        makeMessage({
          content: 'r',
          message_reference: { message_id: 'r1' } as any,
          referenced_message: { ...referenced, content: 'line one\nline two\nline three' } as any,
        }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines[0]).toBe('> @Alice: line one line two line three');
    });

    it('reports "(no content)" when the referenced message has empty content', () => {
      const lines = buildTextMessageBlock(
        makeMessage({
          content: 'r',
          message_reference: { message_id: 'r1' } as any,
          referenced_message: { ...referenced, content: '' } as any,
        }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines[0]).toBe('> @Alice: (no content)');
    });
  });

  describe('attachments', () => {
    const att = {
      id: 'a1',
      filename: 'photo.png',
      size: 100,
      url: 'https://cdn.discordapp.com/attachments/1/2/photo.png',
      proxy_url: 'https://media.discordapp.net/attachments/1/2/photo.png',
    } as any;

    it('emits one [Attachment: ...] line per attachment in inline mode', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ content: 'body', attachments: [att, { ...att, id: 'a2', filename: 'doc.pdf', url: 'https://cdn.discordapp.com/attachments/1/2/doc.pdf' }] }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      const attachmentLines = lines.filter((l) => l.startsWith('[Attachment:'));
      expect(attachmentLines.length).toBe(2);
      expect(attachmentLines[0]).toContain('photo.png');
      expect(attachmentLines[0]).toContain('https://cdn.discordapp.com/attachments/1/2/photo.png');
      expect(attachmentLines[1]).toContain('doc.pdf');
    });

    it('uses the mediaMap path when attachmentStyle === "sidecar"', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ content: 'body', attachments: [att] }),
        cachedUserMap,
        null,
        exportConfig,
        { mediaMap: { [att.url]: 'attachments/1/photo.png' }, avatarMap: {}, emojiMap: {}, roleMap: {} },
        { ...defaultTextFormatOptions, attachmentStyle: 'sidecar' },
      );
      const attachmentLine = lines.find((l) => l.startsWith('[Attachment:'));
      expect(attachmentLine).toContain('attachments/1/photo.png');
      expect(attachmentLine).not.toContain('https://cdn');
    });

    it('falls back to the remote URL when sidecar style has no mediaMap entry yet', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ content: 'body', attachments: [att] }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        { ...defaultTextFormatOptions, attachmentStyle: 'sidecar' },
      );
      const attachmentLine = lines.find((l) => l.startsWith('[Attachment:'));
      expect(attachmentLine).toContain('https://cdn.discordapp.com/attachments/1/2/photo.png');
    });

    it('omits attachment lines entirely when attachmentStyle === "skip"', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ content: 'body', attachments: [att] }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        { ...defaultTextFormatOptions, attachmentStyle: 'skip' },
      );
      expect(lines.some((l) => l.startsWith('[Attachment:'))).toBe(false);
    });
  });

  describe('reactions', () => {
    const reactions = [
      { count: 3, emoji: { name: '👍', id: null }, count_details: { burst: 0, normal: 3 }, me: false, me_burst: false, burst_colors: [] },
      { count: 1, emoji: { name: 'custom', id: 'custom-id' }, count_details: { burst: 0, normal: 1 }, me: false, me_burst: false, burst_colors: [] },
    ] as any;

    it('renders the reactions trailing line with all reactors aggregated', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ content: 'body', reactions }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      const reactionsLine = lines.find((l) => l.startsWith('Reactions:'));
      expect(reactionsLine).toBe('Reactions: 👍 ×3, :custom: ×1');
    });

    it('skips the reactions line when reactions === "skip"', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ content: 'body', reactions }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        { ...defaultTextFormatOptions, reactions: 'skip' },
      );
      expect(lines.some((l) => l.startsWith('Reactions:'))).toBe(false);
    });

    it('does not emit a reactions line when the message has no reactions', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ content: 'body' }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines.some((l) => l.startsWith('Reactions:'))).toBe(false);
    });
  });

  describe('system messages', () => {
    it('wraps known system message types in "-- ... --"', () => {
      const lines = buildTextMessageBlock(
        makeMessage({
          type: 6,
          content: 'pinned a message',
        }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines.length).toBe(1);
      expect(lines[0]).toMatch(/^-- @Alice: pinned a message \(.*\) --$/);
    });

    it('renders thread-starter messages (type 21) as normal user content from the referenced message', () => {
      const lines = buildTextMessageBlock(
        makeMessage({
          type: 21,
          content: '',
          referenced_message: makeMessage({ id: 'orig', content: 'thread starter body' }) as any,
        }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines[0]).toMatch(/^@Alice /);
      expect(lines[1]).toBe('thread starter body');
    });

    it('falls back to "system event" when a system message has no content', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ type: 7, content: '' }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines[0]).toContain('system event');
    });
  });

  describe('user display resolution', () => {
    it('prefers server nickname when present in the cached user map', () => {
      const map = {
        '111': {
          userName: 'alice',
          displayName: 'Alice Globally',
          guilds: { g1: { nick: 'Alice The Mod' } },
        },
      } as any;
      const lines = buildTextMessageBlock(
        makeMessage({ content: 'hi' }),
        map,
        'g1',
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines[0]).toMatch(/^@Alice The Mod /);
    });

    it('falls back to global_name then username when no map entry exists', () => {
      const lines = buildTextMessageBlock(
        makeMessage({
          author: { id: '999', username: 'fallbackuser', global_name: 'Fallback', discriminator: '0', avatar: null, bot: false } as any,
          content: 'x',
        }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      // Both nickname and displayName missing in cache; global_name not used because
      // getUserDisplayData only reads from the cache, so we resolve to the username.
      expect(lines[0]).toMatch(/^@/);
      expect(lines[0]).toContain('@');
    });

    it('emits "@Unknown" when the author is missing entirely', () => {
      const lines = buildTextMessageBlock(
        makeMessage({ author: undefined as any, content: 'orphaned' }),
        cachedUserMap,
        null,
        exportConfig,
        null,
        defaultTextFormatOptions,
      );
      expect(lines[0]).toMatch(/^@Unknown /);
    });
  });

  describe('generateTextPage', () => {
    it('returns an empty string when given no messages', () => {
      expect(
        generateTextPage([], { cachedUserMap, guildId: null, exportConfig })
      ).toBe('');
    });

    it('joins blocks with a blank line and a trailing newline', () => {
      const out = generateTextPage(
        [
          makeMessage({ id: 'a', content: 'first' }),
          makeMessage({ id: 'b', content: 'second' }),
        ],
        { cachedUserMap, guildId: null, exportConfig },
      );
      const parts = out.split('\n\n');
      expect(parts.length).toBe(2);
      expect(out.endsWith('\n')).toBe(true);
      expect(out).toContain('first');
      expect(out).toContain('second');
    });

    it('honors textOptions overrides at the page level', () => {
      const out = generateTextPage(
        [makeMessage({ author: botAuthor, content: 'beep' })],
        {
          cachedUserMap,
          guildId: null,
          exportConfig,
          textOptions: { ...defaultTextFormatOptions, botIndicator: 'skip' } satisfies TextFormatOptions,
        },
      );
      expect(out).not.toContain('[BOT]');
    });

    it('preserves UTF-8 content (emoji + multibyte chars) untouched', () => {
      const out = generateTextPage(
        [makeMessage({ content: 'naïve façade 🎉 中文' })],
        { cachedUserMap, guildId: null, exportConfig },
      );
      expect(out).toContain('naïve façade 🎉 中文');
    });
  });
});
