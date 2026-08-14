import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getExportService } from './exportService';
import { createRowErrorReporter } from '@features/export/exportSlice';
import type { Message, User } from 'discrub-core/types/discord-types';

/**
 * #230 — a message whose formatting throws (the "Invalid string length"
 * poison-message class) must cost one row, not the whole export. The row
 * is replaced with a placeholder carrying the message ID, the caller is
 * notified via onRowError, and every other row renders normally.
 */

// ── Content-Capturing Mock ────────────────────────────────────────
// jsdom's Blob lacks .text(), so we read content via FileReader
let capturedFiles: Map<string, string>;

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

vi.mock('./streamingZipService', () => ({
  StreamingZipService: vi.fn().mockImplementation(() => ({
    addFile: vi.fn(async (blob: Blob, path: string) => {
      const text = await readBlobAsText(blob);
      capturedFiles.set(path, text);
    }),
    finalize: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('./mediaDownloadService', () => ({
  MediaDownloadService: vi.fn().mockImplementation(() => ({
    downloadAllMedia: vi.fn().mockResolvedValue({
      avatarMap: {},
      mediaMap: {},
      emojiMap: {},
      roleMap: {},
    }),
    downloadMediaOnly: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Marker content routes the real formatter into a synthetic blowup —
// the same failure surface (RangeError from string growth) as #230.
const POISON_MARKER = 'POISON_CONTENT_MARKER';

vi.mock('discrub-core/html-formatting-utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('discrub-core/html-formatting-utils')>();
  return {
    ...actual,
    formatContentAsHtml: (content: string, ctx: unknown) => {
      if (typeof content === 'string' && content.includes('POISON_CONTENT_MARKER')) {
        throw new RangeError('Invalid string length');
      }
      return (actual.formatContentAsHtml as (c: string, x: unknown) => string)(
        content,
        ctx,
      );
    },
  };
});

// CSV path: getMessageContent is the per-row surface that explodes on
// oversized content. Same marker convention as the HTML mock above.
vi.mock('discrub-core/discrub-utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('discrub-core/discrub-utils')>();
  return {
    ...actual,
    getMessageContent: (msg: unknown) => {
      const content = (msg as { content?: string })?.content;
      if (typeof content === 'string' && content.includes('POISON_CONTENT_MARKER')) {
        throw new RangeError('Invalid string length');
      }
      return (actual.getMessageContent as (m: unknown) => string)(msg);
    },
  };
});

// Text path: generateTextPage is called once per message by the guarded
// builder, so throwing only for the poison message exercises isolation.
vi.mock('discrub-core/export-utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('discrub-core/export-utils')>();
  return {
    ...actual,
    generateTextPage: (messages: unknown[], opts: unknown) => {
      const poisoned = messages.some((m) => {
        const content = (m as { content?: string })?.content;
        return typeof content === 'string' && content.includes('POISON_CONTENT_MARKER');
      });
      if (poisoned) throw new RangeError('Invalid string length');
      return (actual.generateTextPage as (m: unknown[], o: unknown) => string)(
        messages,
        opts,
      );
    },
  };
});

// ── Fixtures ─────────────────────────────────────────────────────

const AUTHOR: User = {
  id: '100000000000000001',
  username: 'alice',
  discriminator: '0',
  avatar: null,
  global_name: 'Alice Display',
  bot: false,
} as unknown as User;

const GOOD_BEFORE = {
  id: '900000000000000001',
  type: 0,
  content: 'hello before the poison',
  author: AUTHOR,
  timestamp: '2024-01-01T10:00:00.000Z',
} as unknown as Message;

const POISON = {
  id: '900000000000000002',
  type: 0,
  content: `some text ${POISON_MARKER} that explodes`,
  author: AUTHOR,
  timestamp: '2024-01-02T10:00:00.000Z',
} as unknown as Message;

const GOOD_AFTER = {
  id: '900000000000000003',
  type: 0,
  content: 'hello after the poison',
  author: AUTHOR,
  timestamp: '2024-01-03T10:00:00.000Z',
} as unknown as Message;

async function exportAs(
  format: 'html' | 'json' | 'csv' | 'text',
  messages: Message[],
  onRowError?: (messageId: string, error: unknown) => void,
): Promise<string> {
  const service = getExportService();
  await service.exportToZip(
    messages,
    'test-channel',
    format,
    1000,
    false, // includeMedia
    null,  // guild
    {},    // cachedUserMap
    null,  // guildId
    undefined, // onProgress
    undefined, // mediaConfig
    undefined, // exportConfig
    undefined, // shouldContinue
    undefined, // externalZipService
    undefined, // separateThreads
    undefined, // threads
    undefined, // reactionMap
    undefined, // guildRoles
    undefined, // textOptions
    undefined, // zipOptions
    onRowError,
  );
  const ext = format === 'text' ? 'txt' : format;
  const page = capturedFiles.get(`test_channel/test_channel-page-1.${ext}`);
  if (page === undefined) {
    throw new Error(`Page not captured. Files: ${[...capturedFiles.keys()].join(', ')}`);
  }
  return page;
}

const exportHtml = (
  messages: Message[],
  onRowError?: (messageId: string, error: unknown) => void,
) => exportAs('html', messages, onRowError);

beforeEach(() => {
  capturedFiles = new Map();
});

// ── Tests ────────────────────────────────────────────────────────

describe('#230 export render-error isolation', () => {
  it('completes the export and replaces only the poison row with a placeholder', async () => {
    const onRowError = vi.fn();
    const page = await exportHtml([GOOD_BEFORE, POISON, GOOD_AFTER], onRowError);

    // Healthy rows rendered normally
    expect(page).toContain('hello before the poison');
    expect(page).toContain('hello after the poison');

    // Poison row became a placeholder carrying the message ID
    expect(page).toContain('class="message message-render-error"');
    expect(page).toContain(`data-message-id="${POISON.id}"`);
    expect(page).toContain('could not be rendered');
    expect(page).not.toContain(POISON_MARKER);

    // Caller was told exactly which message failed
    expect(onRowError).toHaveBeenCalledTimes(1);
    expect(onRowError).toHaveBeenCalledWith(POISON.id, expect.any(RangeError));
  });

  it('keeps the page structurally valid (balanced divs)', async () => {
    const page = await exportHtml([GOOD_BEFORE, POISON, GOOD_AFTER]);
    const opens = (page.match(/<div/g) || []).length;
    const closes = (page.match(/<\/div>/g) || []).length;
    expect(opens).toBe(closes);
  });

  it('preserves the date divider for a day whose only message failed', async () => {
    const page = await exportHtml([GOOD_BEFORE, POISON, GOOD_AFTER]);
    // The poison message is the sole message on 2024-01-02; its divider
    // is computed outside the guard and must survive the row failure.
    expect(page).toContain('id="date-2024-01-02"');
  });

  it('emits no placeholder when nothing throws', async () => {
    const onRowError = vi.fn();
    const page = await exportHtml([GOOD_BEFORE, GOOD_AFTER], onRowError);
    // The class name legitimately appears in the page stylesheet — assert
    // on the row markup, which only the catch branch emits.
    expect(page).not.toContain('class="message message-render-error"');
    expect(onRowError).not.toHaveBeenCalled();
  });
});

describe('#230 export render-error isolation — non-HTML formats', () => {
  it('JSON: replaces only the unserializable message and stays valid JSON', async () => {
    // Circular reference: JSON.stringify throws for real, no mock needed.
    const circular = {
      id: '900000000000000004',
      type: 0,
      content: 'circular poison',
      author: AUTHOR,
      timestamp: '2024-01-02T10:00:00.000Z',
    } as unknown as Message & { self?: unknown };
    (circular as { self?: unknown }).self = circular;

    const onRowError = vi.fn();
    const page = await exportAs('json', [GOOD_BEFORE, circular, GOOD_AFTER], onRowError);

    const parsed = JSON.parse(page) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(3);
    expect(parsed.map((m) => m.content)).toContain('hello before the poison');
    expect(parsed.map((m) => m.content)).toContain('hello after the poison');

    const placeholder = parsed.find((m) => m.id === circular.id);
    expect(placeholder?.export_error).toContain('could not be serialized');

    expect(onRowError).toHaveBeenCalledTimes(1);
    expect(onRowError).toHaveBeenCalledWith(circular.id, expect.any(TypeError));
  });

  it('JSON: healthy pages are byte-identical to whole-page stringify', async () => {
    const onRowError = vi.fn();
    const page = await exportAs('json', [GOOD_BEFORE, GOOD_AFTER], onRowError);
    // Descending default sort: newest first.
    expect(page).toBe(JSON.stringify([GOOD_AFTER, GOOD_BEFORE], null, 2));
    expect(onRowError).not.toHaveBeenCalled();
  });

  it('CSV: replaces only the poison row and keeps the rest intact', async () => {
    const onRowError = vi.fn();
    const page = await exportAs('csv', [GOOD_BEFORE, POISON, GOOD_AFTER], onRowError);

    const lines = page.split('\n');
    expect(lines[0]).toContain('ID,Timestamp,Username');
    expect(lines).toHaveLength(4); // header + 3 rows
    expect(page).toContain('hello before the poison');
    expect(page).toContain('hello after the poison');

    const poisonRow = lines.find((l) => l.includes(POISON.id!));
    expect(poisonRow).toContain('[This message could not be rendered and was skipped]');
    expect(page).not.toContain(POISON_MARKER);

    expect(onRowError).toHaveBeenCalledTimes(1);
    expect(onRowError).toHaveBeenCalledWith(POISON.id, expect.any(RangeError));
  });

  it('text: replaces only the poison block and keeps the rest intact', async () => {
    const onRowError = vi.fn();
    const page = await exportAs('text', [GOOD_BEFORE, POISON, GOOD_AFTER], onRowError);

    expect(page).toContain('hello before the poison');
    expect(page).toContain('hello after the poison');
    expect(page).toContain(
      `[This message could not be rendered and was skipped. Message ID: ${POISON.id}]`,
    );
    expect(page).not.toContain(POISON_MARKER);

    expect(onRowError).toHaveBeenCalledTimes(1);
    expect(onRowError).toHaveBeenCalledWith(POISON.id, expect.any(RangeError));
  });

  it('non-HTML formats emit no placeholder and no onRowError when nothing throws', async () => {
    for (const fmt of ['json', 'csv', 'text'] as const) {
      capturedFiles = new Map();
      const onRowError = vi.fn();
      const page = await exportAs(fmt, [GOOD_BEFORE, GOOD_AFTER], onRowError);
      expect(page).not.toContain('could not be rendered');
      expect(page).not.toContain('could not be serialized');
      expect(onRowError).not.toHaveBeenCalled();
    }
  });
});

describe('#230 createRowErrorReporter', () => {
  it('warns per failure with the message ID, capped, then summarizes on flush', () => {
    const dispatch = vi.fn();
    const reporter = createRowErrorReporter(dispatch as never, '#general');

    for (let i = 0; i < 12; i++) {
      reporter.onRowError(`msg-${i}`, new RangeError('Invalid string length'));
    }
    // Capped at 10 detailed warnings
    expect(dispatch).toHaveBeenCalledTimes(10);
    const first = dispatch.mock.calls[0][0];
    expect(first.payload.level).toBe('warning');
    expect(first.payload.message).toContain('msg-0');
    expect(first.payload.message).toContain('#general');
    expect(first.payload.message).toContain('Invalid string length');

    reporter.flush();
    expect(dispatch).toHaveBeenCalledTimes(11);
    const summary = dispatch.mock.calls[10][0];
    expect(summary.payload.level).toBe('warning');
    expect(summary.payload.message).toContain('12 messages');
    expect(summary.payload.message).toContain('first 10');
  });

  it('flush is a no-op when nothing failed', () => {
    const dispatch = vi.fn();
    const reporter = createRowErrorReporter(dispatch as never);
    reporter.flush();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
