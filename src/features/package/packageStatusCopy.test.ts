import { describe, it, expect } from 'vitest';
import {
  formatDeleteSummary,
  formatRehydrateInlineSummary,
  formatRehydrateLogSummary,
} from './packageStatusCopy';
import type { DeleteResult } from './packageSlice';

const baseDeleteResult: DeleteResult = {
  deleted: 0,
  alreadyGone: 0,
  forbidden: 0,
  failed: 0,
  cancelled: false,
  confirmedGoneIds: [],
};

describe('formatDeleteSummary', () => {
  it('reports a clean success with only the deleted count', () => {
    expect(formatDeleteSummary({ ...baseDeleteResult, deleted: 5 })).toBe(
      'Deleted 5 messages.',
    );
  });

  it('uses singular "message" when exactly one was deleted', () => {
    expect(formatDeleteSummary({ ...baseDeleteResult, deleted: 1 })).toBe(
      'Deleted 1 message.',
    );
  });

  it('appends an "already gone" sentence only when alreadyGone > 0', () => {
    expect(
      formatDeleteSummary({ ...baseDeleteResult, deleted: 5, alreadyGone: 2 }),
    ).toBe('Deleted 5 messages. 2 messages were already gone on Discord.');
  });

  it('uses singular "was" for an alreadyGone count of one', () => {
    expect(
      formatDeleteSummary({ ...baseDeleteResult, deleted: 5, alreadyGone: 1 }),
    ).toBe('Deleted 5 messages. 1 message was already gone on Discord.');
  });

  it('replaces HTTP "forbidden" jargon with plain language', () => {
    expect(
      formatDeleteSummary({ ...baseDeleteResult, deleted: 5, forbidden: 1 }),
    ).toBe(
      "Deleted 5 messages. 1 message couldn't be deleted (no permission).",
    );
  });

  it('phrases failures naturally with singular vs plural error noun', () => {
    expect(
      formatDeleteSummary({ ...baseDeleteResult, deleted: 5, failed: 1 }),
    ).toBe('Deleted 5 messages. 1 message had an error.');
    expect(
      formatDeleteSummary({ ...baseDeleteResult, deleted: 5, failed: 3 }),
    ).toBe('Deleted 5 messages. 3 messages had errors.');
  });

  it('combines all non-zero buckets into one readable sentence', () => {
    expect(
      formatDeleteSummary({
        ...baseDeleteResult,
        deleted: 8,
        alreadyGone: 2,
        forbidden: 1,
        failed: 3,
      }),
    ).toBe(
      "Deleted 8 messages. 2 messages were already gone on Discord. 1 message couldn't be deleted (no permission). 3 messages had errors.",
    );
  });

  it('suppresses every zero bucket — the screenshot regression', () => {
    // The exact case from the user's 2026-05-03 screenshot. Banner used
    // to read "Deleted 1, already gone 0, forbidden 0, failed 0." which
    // is what filed Backlog #161 in the first place.
    expect(formatDeleteSummary({ ...baseDeleteResult, deleted: 1 })).toBe(
      'Deleted 1 message.',
    );
  });

  it('leads with failure language when nothing was successfully deleted', () => {
    expect(
      formatDeleteSummary({
        ...baseDeleteResult,
        deleted: 0,
        forbidden: 2,
        failed: 1,
      }),
    ).toBe(
      "Couldn't delete any messages. 2 messages couldn't be deleted (no permission). 1 message had an error.",
    );
  });

  it('appends "(cancelled)" when the run was cancelled', () => {
    expect(
      formatDeleteSummary({
        ...baseDeleteResult,
        deleted: 5,
        cancelled: true,
      }),
    ).toBe('Deleted 5 messages. (cancelled)');
  });

  it('handles a cancelled run that touched nothing', () => {
    expect(
      formatDeleteSummary({ ...baseDeleteResult, cancelled: true }),
    ).toBe('No messages were deleted. (cancelled)');
  });

  it('formats large counts with locale-aware thousands separators', () => {
    expect(
      formatDeleteSummary({ ...baseDeleteResult, deleted: 12345 }),
    ).toBe('Deleted 12,345 messages.');
  });
});

describe('formatRehydrateInlineSummary', () => {
  it('returns just the count when no exceptions exist', () => {
    expect(
      formatRehydrateInlineSummary({ enriched: 50, unavailable: 0, noAccess: 0 }),
    ).toBe('50 messages');
  });

  it('uses singular when exactly one message was loaded', () => {
    expect(
      formatRehydrateInlineSummary({ enriched: 1, unavailable: 0, noAccess: 0 }),
    ).toBe('1 message');
  });

  it('appends "unavailable" only when there are any', () => {
    expect(
      formatRehydrateInlineSummary({ enriched: 50, unavailable: 3, noAccess: 0 }),
    ).toBe('50 messages, 3 unavailable');
  });

  it('appends "no access" only when there are any', () => {
    expect(
      formatRehydrateInlineSummary({ enriched: 50, unavailable: 0, noAccess: 1 }),
    ).toBe('50 messages, 1 no access');
  });

  it('combines all three when all buckets have content', () => {
    expect(
      formatRehydrateInlineSummary({ enriched: 50, unavailable: 3, noAccess: 1 }),
    ).toBe('50 messages, 3 unavailable, 1 no access');
  });
});

describe('formatRehydrateLogSummary', () => {
  it('quotes the channel label and uses sentence form', () => {
    expect(
      formatRehydrateLogSummary({
        channelLabel: 'general',
        enriched: 50,
        unavailable: 0,
        noAccess: 0,
      }),
    ).toBe('Rich data loaded for "general": 50 messages.');
  });

  it('appends "(cancelled)" outside the period', () => {
    expect(
      formatRehydrateLogSummary({
        channelLabel: 'general',
        enriched: 50,
        unavailable: 3,
        noAccess: 1,
        cancelled: true,
      }),
    ).toBe(
      'Rich data loaded for "general": 50 messages, 3 unavailable, 1 no access. (cancelled)',
    );
  });
});
