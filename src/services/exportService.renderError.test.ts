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

async function exportHtml(
  messages: Message[],
  onRowError?: (messageId: string, error: unknown) => void,
): Promise<string> {
  const service = getExportService();
  await service.exportToZip(
    messages,
    'test-channel',
    'html',
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
  const page = capturedFiles.get('test_channel/test_channel-page-1.html');
  if (page === undefined) {
    throw new Error(`Page not captured. Files: ${[...capturedFiles.keys()].join(', ')}`);
  }
  return page;
}

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
