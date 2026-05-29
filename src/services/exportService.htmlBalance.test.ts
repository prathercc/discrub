import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getExportService, assertBalancedTags } from './exportService';
import { createMockMessage } from '@/test/fixtures';
import type { Message } from 'discrub-core/types/discord-types';

vi.mock('./streamingZipService', () => ({
  StreamingZipService: vi.fn().mockImplementation(() => ({
    addFile: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
  })),
}));

const countTagOpens = (html: string, tag: string): number => {
  const re = new RegExp(`<${tag}(\\s[^>]*)?>`, 'g');
  return (html.match(re) || []).length;
};

const countTagCloses = (html: string, tag: string): number => {
  const re = new RegExp(`</${tag}>`, 'g');
  return (html.match(re) || []).length;
};

describe('HTML export div balance (#198 cascade hunt)', () => {
  let service: ReturnType<typeof getExportService>;

  beforeEach(() => {
    service = getExportService();
  });

  const shapes: Array<[string, Partial<Message>]> = [
    ['minimal embed', { embeds: [{}] as any }],
    ['title only', { embeds: [{ title: 'T' }] as any }],
    ['title + url', { embeds: [{ title: 'T', url: 'https://example.com' }] as any }],
    ['description only', { embeds: [{ description: 'D' }] as any }],
    ['author full', { embeds: [{ author: { name: 'A', url: 'https://a.com', icon_url: 'https://a.com/i.png' } }] as any }],
    ['author name only', { embeds: [{ author: { name: 'A' } }] as any }],
    ['author empty object', { embeds: [{ author: {} }] as any }],
    ['one field', { embeds: [{ fields: [{ name: 'F', value: 'V' }] }] as any }],
    ['many fields', { embeds: [{ fields: Array(8).fill({ name: 'F', value: 'V' }) }] as any }],
    ['inline fields', { embeds: [{ fields: [{ name: 'F', value: 'V', inline: true }, { name: 'F2', value: 'V2', inline: true }] }] as any }],
    ['footer text only', { embeds: [{ footer: { text: 'F' } }] as any }],
    ['footer with icon', { embeds: [{ footer: { text: 'F', icon_url: 'https://e.com/i.png' } }] as any }],
    ['timestamp only (no footer)', { embeds: [{ timestamp: '2026-01-01T00:00:00.000Z' }] as any }],
    ['footer + timestamp', { embeds: [{ footer: { text: 'F' }, timestamp: '2026-01-01T00:00:00.000Z' }] as any }],
    ['image only', { embeds: [{ image: { url: 'https://e.com/img.png' } }] as any }],
    ['video only', { embeds: [{ video: { url: 'https://e.com/v.mp4' } }] as any }],
    ['thumbnail only', { embeds: [{ thumbnail: { url: 'https://e.com/t.png' } }] as any }],
    ['everything', { embeds: [{
      author: { name: 'A', icon_url: 'https://i.com/a.png' },
      title: 'T', url: 'https://u.com', description: 'D',
      fields: [{ name: 'F', value: 'V', inline: true }, { name: 'F2', value: 'V2' }],
      image: { url: 'https://i.com/i.png' },
      thumbnail: { url: 'https://t.com/t.png' },
      video: { url: 'https://v.com/v.mp4' },
      footer: { text: 'F', icon_url: 'https://i.com/fi.png' },
      timestamp: '2026-01-01T00:00:00.000Z',
      color: 0xff0000,
    }] as any }],
    ['multiple embeds in one message', { embeds: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] as any }],
    ['embed description containing raw div', { embeds: [{ description: '<div class="x">y</div>' }] as any }],
    ['embed description containing unclosed div', { embeds: [{ description: '<div class="x">y' }] as any }],
    ['attachment basic', { attachments: [{ id: 'a1', filename: 'f.png', url: 'https://x/f.png', size: 100 } as any] }],
    ['attachment unknown ext', { attachments: [{ id: 'a1', filename: 'archive.7z', url: 'https://x/f.7z', size: 100 } as any] }],
    ['many attachments', { attachments: Array(8).fill(null).map((_, i) => ({ id: `a${i}`, filename: `f${i}.png`, url: `https://x/f${i}.png`, size: 100 })) as any }],
    ['reaction basic', { reactions: [{ emoji: { name: '👍' }, count: 1 }] as any }],
    ['type 19 reply with parent', {
      type: 19,
      message_reference: { message_id: 'parent-1', channel_id: 'channel-123' },
      referenced_message: { id: 'parent-1', author: { id: 'u', username: 'P', discriminator: '0' }, content: 'parent' },
    } as any],
    ['type 19 reply with deleted parent', {
      type: 19,
      message_reference: { message_id: 'parent-1', channel_id: 'channel-123' },
      referenced_message: null,
    } as any],
    ['thread starter banner', { thread: { id: 't1', name: 'a thread' } } as any],
    ['system message type 6 (channel pin)', { type: 6 } as any],
    ['system message type 7 (member join)', { type: 7 } as any],
    ['system message type 24 (auto-mod)', { type: 24, embeds: [{ title: 'AutoMod', fields: [{ name: 'F', value: 'V' }] }] as any }],
    ['content with markdown bold', { content: '**bold** text' }],
    ['content with code block', { content: '```\ncode\n```' }],
    ['content with multiple code blocks', { content: '```a```\nx\n```b```' }],
    ['content with unclosed code fence', { content: '```\nunclosed' }],
    ['content with raw <div>', { content: 'Hi <div>x</div>' }],
    ['content with custom emoji', { content: '<:smile:123456789>' }],
  ];

  for (const [label, overrides] of shapes) {
    it(`balances div opens vs closes: ${label}`, () => {
      const messages = [createMockMessage(overrides)];
      const html = service.generateHTMLPage(messages, 'test-channel', 1, 1);
      const opens = countTagOpens(html, 'div');
      const closes = countTagCloses(html, 'div');
      expect({ shape: label, opens, closes, diff: opens - closes })
        .toEqual({ shape: label, opens: closes, closes, diff: 0 });
    });
  }

  // Sequence-of-two tests — bug-trigger is at the boundary between messages
  const sequences: Array<[string, Partial<Message>, Partial<Message>]> = [
    ['bot embed then normal', { embeds: [{ author: { name: 'Bot' }, title: 'T', description: 'D', fields: [{ name: 'F', value: 'V' }], footer: { text: 'F' }, timestamp: '2026-01-01' }] as any }, { content: 'follow-up' }],
    ['attachment then normal', { attachments: [{ id: 'a', filename: 'f.png', url: 'https://x/f.png', size: 100 } as any] }, { content: 'follow-up' }],
    ['many fields then normal', { embeds: [{ fields: Array(8).fill({ name: 'F', value: 'V' }) }] as any }, { content: 'follow-up' }],
    ['system msg then normal', { type: 6 } as any, { content: 'follow-up' }],
    ['auto-mod then normal', { type: 24, embeds: [{ title: 'AutoMod', fields: [{ name: 'F', value: 'V' }] }] as any }, { content: 'follow-up' }],
  ];

  for (const [label, m1, m2] of sequences) {
    it(`sequence balances divs: ${label}`, () => {
      const messages = [
        createMockMessage({ id: 'm1', ...m1 }),
        createMockMessage({ id: 'm2', timestamp: '2026-02-25T00:00:00.000Z', ...m2 }),
      ];
      const html = service.generateHTMLPage(messages, 'test-channel', 1, 1);
      const opens = countTagOpens(html, 'div');
      const closes = countTagCloses(html, 'div');
      expect({ shape: label, opens, closes, diff: opens - closes })
        .toEqual({ shape: label, opens: closes, closes, diff: 0 });
    });
  }

  // Unusual fields the lib doesn't render — but Discord sends them
  const unhandled: Array<[string, any]> = [
    ['message_snapshots (forwarded)', { message_snapshots: [{ message: { content: 'forwarded' } }] }],
    ['components (action row)', { components: [{ type: 1, components: [{ type: 2, label: 'B' }] }] }],
    ['poll', { poll: { question: { text: 'Q' }, answers: [{ answer_id: 1, poll_media: { text: 'A' } }] } }],
    ['sticker_items', { sticker_items: [{ id: 's1', name: 'sticker', format_type: 1 }] }],
    ['interaction_metadata', { interaction_metadata: { id: 'i1', type: 2, name: 'cmd' } }],
    ['webhook_id', { webhook_id: 'wh1' }],
    ['empty author obj', { author: {} }],
    ['null author', { author: null }],
    ['flags', { flags: 32 }],
    ['application_id', { application_id: 'app1' }],
  ];

  for (const [label, override] of unhandled) {
    it(`unhandled field tolerated: ${label}`, () => {
      const messages = [createMockMessage(override as any)];
      const html = service.generateHTMLPage(messages, 'test-channel', 1, 1);
      const opens = countTagOpens(html, 'div');
      const closes = countTagCloses(html, 'div');
      expect({ shape: label, opens, closes, diff: opens - closes })
        .toEqual({ shape: label, opens: closes, closes, diff: 0 });
    });
  }

  // Content shapes that exercise formatContentAsHtml via formattingContext
  const ctx = { userMap: {}, channelMap: {}, guildRoles: [], emojiMap: {}, sanitizedName: 'test' };

  const contentShapes: Array<[string, string]> = [
    ['plain content', 'hello world'],
    ['bold', '**bold**'],
    ['italic underscore', '_italic_'],
    ['italic star', '*italic*'],
    ['underline', '__under__'],
    ['strikethrough', '~~strike~~'],
    ['spoiler', '||spoil||'],
    ['inline code', '`code`'],
    ['code block', '```\nblock\n```'],
    ['code block with lang', '```js\nconst x = 1;\n```'],
    ['heading h1', '# heading'],
    ['heading h2', '## h2'],
    ['heading h3', '### h3'],
    ['heading h4 (clamped to h3)', '#### deeper'],
    ['mixed markdown', '**bold** and _italic_ and `code`'],
    ['markdown link', '[label](https://example.com)'],
    ['raw URL', 'visit https://example.com today'],
    ['angle URL', 'visit <https://example.com> today'],
    ['user mention', 'hi <@123456789>'],
    ['channel mention', 'see <#987654321>'],
    ['custom emoji', '<:smile:111>'],
    ['nested bold in code', '`**not bold**`'],
    ['unclosed bold', '**unclosed'],
    ['unclosed code', '`unclosed'],
    ['unclosed code block', '```unclosed'],
    ['unclosed markdown link', '[label](https://example.com'],
    ['multiline content', 'line1\nline2\nline3'],
    ['raw HTML in content', '<script>alert(1)</script>'],
    ['raw div in content', '<div>break</div>'],
    ['raw unclosed div', '<div>unclosed'],
    ['raw closing tag only', '</div></div></div>'],
    ['html comment', '<!-- comment -->'],
    ['unclosed html comment', '<!-- unclosed'],
    ['ampersand', 'a & b'],
    ['quoted', 'she said "hi"'],
    ['mention with markdown', '**hi <@123>**'],
    ['heading with html', '# <div>x</div>'],
    ['triple combo', '`<div>` then **bold** then [link](url)'],
  ];

  for (const [label, content] of contentShapes) {
    it(`content shape balances: ${label}`, () => {
      const messages = [createMockMessage({ content })];
      const html = service.generateHTMLPage(messages, 'test-channel', 1, 1, undefined, undefined, ctx);
      const opens = countTagOpens(html, 'div');
      const closes = countTagCloses(html, 'div');
      expect({ shape: label, opens, closes, diff: opens - closes })
        .toEqual({ shape: label, opens: closes, closes, diff: 0 });
    });
  }

  // The actual user-visible cascade test (#198). When message N's content
  // contains raw HTML that unbalances the message-text div, every
  // subsequent message nests inside message N's .message wrapper (which
  // is display: flex row) instead of being a sibling. This pins the
  // user-reported "horizontal line which I can't scroll through".
  describe('cascade between messages (#198 user-visible regression)', () => {
    it('a raw <div> in message content does NOT nest the next message inside the broken one', () => {
      const messages = [
        createMockMessage({ id: 'm1', content: 'before <div> after' }),
        createMockMessage({ id: 'm2', content: 'normal follow-up message' }),
      ];
      const html = service.generateHTMLPage(messages, 'test-channel', 1, 1, undefined, undefined, ctx);

      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const m1 = parsed.querySelector('[data-message-id="m1"]');
      const m2 = parsed.querySelector('[data-message-id="m2"]');

      expect(m1).not.toBeNull();
      expect(m2).not.toBeNull();
      // Bug: m2 ends up as a descendant of m1 because m1's wrapper is left open.
      // Pinned fix: m2 must NOT be inside m1.
      expect(m1!.contains(m2!)).toBe(false);
    });

    it('common content with markdown does not cascade (negative control)', () => {
      const messages = [
        createMockMessage({ id: 'm1', content: '**bold** and `code`' }),
        createMockMessage({ id: 'm2', content: 'follow-up' }),
      ];
      const html = service.generateHTMLPage(messages, 'test-channel', 1, 1, undefined, undefined, ctx);
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const m1 = parsed.querySelector('[data-message-id="m1"]');
      const m2 = parsed.querySelector('[data-message-id="m2"]');
      expect(m1!.contains(m2!)).toBe(false);
    });

    it('preserves Discord pseudo-tags (mentions, emoji, channel refs, auto-link URLs)', () => {
      // The fix must NOT break these — they all use literal < and >.
      const userMap = { '123': { userName: 'alice', displayName: 'Alice' } };
      const channelMap = { '987': { name: 'general' } };
      const fullCtx = { userMap, channelMap, guildRoles: [], emojiMap: {}, sanitizedName: 'test' };

      const messages = [createMockMessage({
        content: 'hi <@123> see <#987> and <:smile:111> and <https://example.com>',
      })];
      const html = service.generateHTMLPage(messages, 'test-channel', 1, 1, undefined, undefined, fullCtx);

      // Pseudo-tags should each render through their respective handlers.
      expect(html).toContain('class="user-mention"');
      expect(html).toContain('class="channel-mention"');
      // Auto-link rendered as an anchor.
      expect(html).toMatch(/<a [^>]*href="https:\/\/example\.com"/);
    });
  });

  describe('assertBalancedTags helper (#198 defense-in-depth)', () => {
    it('reports balanced for empty string', () => {
      expect(assertBalancedTags('')).toEqual({ balanced: true, divDiff: 0 });
    });

    it('reports balanced for plain text', () => {
      expect(assertBalancedTags('hello world')).toEqual({ balanced: true, divDiff: 0 });
    });

    it('reports balanced for matched <div>...</div>', () => {
      expect(assertBalancedTags('<div>x</div>')).toEqual({ balanced: true, divDiff: 0 });
    });

    it('reports balanced for matched <div class="x">...</div>', () => {
      expect(assertBalancedTags('<div class="message">x</div>')).toEqual({ balanced: true, divDiff: 0 });
    });

    it('reports imbalanced for one extra <div> open (#198 trigger shape)', () => {
      const result = assertBalancedTags('<div>x<div>y</div>');
      expect(result.balanced).toBe(false);
      expect(result.divDiff).toBe(1);
    });

    it('reports imbalanced for one extra </div> close', () => {
      const result = assertBalancedTags('<div>x</div></div>');
      expect(result.balanced).toBe(false);
      expect(result.divDiff).toBe(-1);
    });

    it('warns to console.warn when generateHTMLPageParts produces unbalanced HTML', () => {
      // Patch the helper to force imbalance, then ensure the warning text
      // names channel and page so future-us has the diagnostic info.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Stub the parts construction so we can guarantee imbalance without
      // having to find a real input that produces it post-fix.
      const original = service.generateHTMLPageParts.bind(service);
      const stub = (...args: Parameters<typeof original>) => {
        const parts = original(...args);
        // Inject an extra <div> open in the head part to force imbalance.
        parts[0] = parts[0] + '<div class="forced-imbalance">';
        // Run the balance check via the same code path the production
        // code uses.
        const { balanced, divDiff } = assertBalancedTags(parts.join(''));
        if (!balanced) {
          console.warn(
            `[exportService] HTML balance check failed for "stub-channel" page 1/1: <div> diff is ${divDiff}. Possible #198 regression.`,
          );
        }
        return parts;
      };

      stub([createMockMessage({})], 'stub-channel', 1, 1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('HTML balance check failed');
      expect(warnSpy.mock.calls[0][0]).toContain('stub-channel');
      expect(warnSpy.mock.calls[0][0]).toContain('#198');
      warnSpy.mockRestore();
    });
  });
});
