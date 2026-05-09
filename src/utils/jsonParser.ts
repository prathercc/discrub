import { parseAttachmentCell } from '@/utils/csvParser';
import type { PackageMessage } from '@/features/package/packageTypes';

/**
 * Parses a Discord data package messages.json payload.
 *
 * Discord switched the per-channel messages file from CSV to JSON in their
 * 2024-01-03 export-format change (#163). The JSON shape is an array of
 * objects with PascalCase keys: `ID`, `Timestamp`, `Contents`, `Attachments`.
 * Field semantics match the CSV columns one-for-one — Attachments is still a
 * single whitespace-separated string of URLs, so we route it through the
 * shared `parseAttachmentCell` helper.
 *
 * Tolerates malformed input (returns `[]` rather than throwing) so a single
 * corrupt channel can't take down the whole package import.
 */
/**
 * Wrap unquoted numeric `ID` values in quotes before JSON.parse so
 * 64-bit Discord snowflakes survive as strings. JS Number tops out at
 * 2^53; raw `JSON.parse` rounds the last 3-5 digits of a snowflake,
 * which then breaks every downstream identity check (the AROUND-loop
 * during rehydration calls Discord with the rounded ID, neighbors
 * come back, target is missing, message is marked deleted).
 *
 * The leading `[{,]` anchor only matches a top-level object key — it
 * won't fire inside a string literal because escaped `\"ID\":` has a
 * preceding backslash, and an inner `,"ID":` matched in source has a
 * preceding `\"` rather than a bare `"`. Already-quoted IDs are
 * untouched (the `\d+` lookahead requires digits, not a quote).
 */
function quoteNumericIds(text: string): string {
  return text.replace(/([{,]\s*)"ID":\s*(\d+)/g, '$1"ID":"$2"');
}

export function parseMessagesJson(text: string): PackageMessage[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(quoteNumericIds(text));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (row): row is Record<string, unknown> =>
        typeof row === 'object' &&
        row !== null &&
        'ID' in row &&
        'Timestamp' in row,
    )
    .map((row) => ({
      id: String(row.ID),
      timestamp: String(row.Timestamp),
      content: typeof row.Contents === 'string' ? row.Contents : '',
      attachments: parseAttachmentCell(
        typeof row.Attachments === 'string' ? row.Attachments : undefined,
      ),
    }));
}

/**
 * Counts message rows in a messages.json without retaining the parsed
 * objects. Mirrors `countCsvRows` (csvParser.ts) — used during the initial
 * package scan to populate `messageCount` per channel before the user
 * actually opens a channel.
 *
 * Discord's array shape forces a full parse here (no streaming row count
 * the way CSV permits), but the cost is bounded: the bytes are already
 * decoded to a string by the time this is called, and the parsed array
 * is discarded immediately. If profiles ever flag this on very large
 * channels, swap to a streaming JSON tokenizer.
 */
export function countJsonMessages(text: string): number {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}
