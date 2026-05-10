import type { DeleteResult } from './packageSlice';

/**
 * User-facing copy for package status surfaces. Centralized so the
 * banner shown after a delete and the matching status-log entry stay
 * in lockstep, and so the rehydration completion line in two places
 * (inline pill + status log) reads with the same tone (#161).
 *
 * Style rules baked in here:
 *   - Suppress zero-count buckets entirely. The banner used to read
 *     "Deleted 1, already gone 0, forbidden 0, failed 0." which exposed
 *     implementation buckets users don't think in.
 *   - Avoid HTTP / dev jargon. "forbidden" → "no permission" / "no
 *     access". Status codes never appear in copy users read.
 *   - Lead with the success quantity, mention exceptions only when
 *     they happened.
 */

function pluralize(n: number, singular: string): string {
  return `${n.toLocaleString()} ${singular}${n === 1 ? '' : 's'}`;
}

/**
 * Format a `DeleteResult` as a single user-facing sentence (or two)
 * suitable for both the result banner in `PackageMessageTable` and the
 * matching status-log entry emitted from the delete thunk.
 *
 * Examples:
 *   { deleted: 5, alreadyGone: 0, forbidden: 0, failed: 0 }
 *     → "Deleted 5 messages."
 *   { deleted: 5, alreadyGone: 2, forbidden: 1, failed: 0 }
 *     → "Deleted 5 messages. 2 were already gone on Discord. 1 couldn't be deleted (no permission)."
 *   { deleted: 0, alreadyGone: 0, forbidden: 0, failed: 3 }
 *     → "Couldn't delete any messages. 3 had errors."
 *   cancelled: true → trailing " (cancelled)"
 */
export function formatDeleteSummary(result: DeleteResult): string {
  const parts: string[] = [];

  if (result.deleted > 0) {
    parts.push(`Deleted ${pluralize(result.deleted, 'message')}.`);
  } else if (
    result.alreadyGone === 0 &&
    result.forbidden === 0 &&
    result.failed === 0
  ) {
    // Defensive fallback. The thunk rejects before reaching this state
    // so it shouldn't render in practice, but keeps the formatter total.
    parts.push('No messages were deleted.');
  } else {
    parts.push("Couldn't delete any messages.");
  }

  if (result.alreadyGone > 0) {
    parts.push(
      `${pluralize(result.alreadyGone, 'message')} ${result.alreadyGone === 1 ? 'was' : 'were'} already gone on Discord.`,
    );
  }
  if (result.forbidden > 0) {
    parts.push(
      `${pluralize(result.forbidden, 'message')} couldn't be deleted (no permission).`,
    );
  }
  if (result.failed > 0) {
    parts.push(
      `${pluralize(result.failed, 'message')} had ${result.failed === 1 ? 'an error' : 'errors'}.`,
    );
  }

  let sentence = parts.join(' ');
  if (result.cancelled) sentence += ' (cancelled)';
  return sentence;
}

/**
 * Compact inline summary for the rehydration-done pill in
 * `PackageMessageTable`. Suppresses zero buckets, never mentions
 * "forbidden" or "deleted" as nouns (those words have a different
 * meaning in the package-delete context).
 *
 * Examples:
 *   { enriched: 50, unavailable: 0, noAccess: 0 }
 *     → "50 messages"
 *   { enriched: 50, unavailable: 3, noAccess: 0 }
 *     → "50 messages, 3 unavailable"
 *   { enriched: 50, unavailable: 3, noAccess: 1 }
 *     → "50 messages, 3 unavailable, 1 no access"
 *
 * Returns just the count summary — callers prepend the surrounding
 * "Rich data loaded today —" / channel name etc.
 */
export function formatRehydrateInlineSummary(opts: {
  enriched: number;
  unavailable: number;
  noAccess: number;
}): string {
  const parts: string[] = [pluralize(opts.enriched, 'message')];
  if (opts.unavailable > 0) parts.push(`${opts.unavailable.toLocaleString()} unavailable`);
  if (opts.noAccess > 0) parts.push(`${opts.noAccess.toLocaleString()} no access`);
  return parts.join(', ');
}

/**
 * Sentence form of the rehydration completion summary, for the
 * status-log entry emitted at end-of-run. Includes the channel label
 * so users can scan a long log and identify which channel each
 * completion belongs to.
 *
 * Examples:
 *   { channelLabel: 'general', enriched: 50, unavailable: 0, noAccess: 0 }
 *     → 'Rich data loaded for "general": 50 messages.'
 *   { channelLabel: 'general', enriched: 50, unavailable: 3, noAccess: 1, cancelled: true }
 *     → 'Rich data loaded for "general": 50 messages, 3 unavailable, 1 no access. (cancelled)'
 */
export function formatRehydrateLogSummary(opts: {
  channelLabel: string;
  enriched: number;
  unavailable: number;
  noAccess: number;
  cancelled?: boolean;
}): string {
  const summary = formatRehydrateInlineSummary({
    enriched: opts.enriched,
    unavailable: opts.unavailable,
    noAccess: opts.noAccess,
  });
  let sentence = `Rich data loaded for "${opts.channelLabel}": ${summary}.`;
  if (opts.cancelled) sentence += ' (cancelled)';
  return sentence;
}

/**
 * Compact ETA shown on the rehydrate button label, e.g.
 *   `"~5 min"`, `"~1h 30m"`, `"~25s"`.
 *
 * Drives off `messages.length × searchDelayMs`. Real runs typically
 * finish faster (search preflight covers most messages without
 * per-message AROUND calls), so the estimate skews high — but a
 * worst-case figure is the right thing to show before the user
 * commits to the run. The breakdown helper below documents the
 * underlying assumptions.
 *
 * Switches to `~Xh Ym` past the hour mark so multi-hour rehydrates
 * don't render as "~78 min" — at that scale a user is likely to
 * walk away from the tab and wants to plan around the duration.
 */
export function formatRehydrateEta(
  totalMessages: number,
  searchDelayMs: number,
): string {
  if (totalMessages <= 0) return '<1s';
  const totalSec = (totalMessages * searchDelayMs) / 1000;
  if (totalSec < 60) return `~${Math.max(1, Math.round(totalSec))}s`;
  if (totalSec < 3600) {
    const mins = Math.round(totalSec / 60);
    return `~${mins} min`;
  }
  const hours = Math.floor(totalSec / 3600);
  const minsRemainder = Math.round((totalSec % 3600) / 60);
  if (minsRemainder === 0) return `~${hours}h`;
  return `~${hours}h ${minsRemainder}m`;
}

/**
 * Multi-line breakdown surfaced on hover of the rehydrate button.
 * Shows what's driving the headline ETA so a user about to commit to
 * a long run knows whether their assumption ("~5 min") matches the
 * actual upper bound ("3,200 messages, ~1/sec, expected ~50 min").
 */
export function formatRehydrateEtaBreakdown(
  totalMessages: number,
  searchDelayMs: number,
): string {
  if (totalMessages <= 0) return 'No messages to rehydrate.';
  const messagesPerSec = searchDelayMs > 0 ? 1000 / searchDelayMs : 0;
  const rate =
    messagesPerSec >= 1
      ? `~${messagesPerSec.toFixed(messagesPerSec >= 10 ? 0 : 1)} per second`
      : `~${(searchDelayMs / 1000).toFixed(1)}s per message`;
  const eta = formatRehydrateEta(totalMessages, searchDelayMs);
  return (
    `${totalMessages.toLocaleString()} ${totalMessages === 1 ? 'message' : 'messages'} · ` +
    `${rate} · expected ${eta}. ` +
    `Discord caps fetch rate; the search preflight may finish sooner ` +
    `if it covers most messages in one pass.`
  );
}
