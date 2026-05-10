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

/**
 * `JSON.parse`, but pre-quotes unquoted numeric snowflake fields so
 * 64-bit Discord IDs survive as strings.
 *
 * The same Number-precision pitfall that hit `messages.json`'s `ID`
 * field can hit any sibling JSON Discord ships with a numeric ID
 * literal: `account/user.json#id`, `servers/{id}/guild.json#id`,
 * `messages/{cid}/channel.json#id` (and `guild.id`, `recipients[]`).
 *
 * The fixtures in this repo emit IDs as strings, but real packages in
 * the wild ship them either way depending on the export year. JS
 * `Number` tops out at 2^53, so a raw `JSON.parse` rounds the last
 * 3-5 digits of a 19-digit snowflake; downstream the user.id no
 * longer matches the authenticated user, the package falls into
 * read-only mode, search routes to the wrong guild, etc.
 *
 * The regex anchors `"<field>":<digits>` to a real object key
 * (preceding char is `{` or `,`), so it can't fire inside a JSON-
 * encoded string literal where internal quotes are escaped.
 *
 * Applied at every package-metadata JSON.parse site in both
 * packageParseService and packageStreamService — including
 * messages/index.json, where the values are channel names (no IDs)
 * but the helper is a no-op there. Routing all parses through one
 * helper keeps the two services from drifting apart.
 */
const SNOWFLAKE_FIELD_NAMES = [
  'id',
  'channel_id',
  'guild_id',
  'user_id',
  'message_id',
  'owner_id',
  'recipient_id',
  'application_id',
  'target_id',
  'webhook_id',
  'integration_id',
];

const SNOWFLAKE_FIELD_PATTERN = new RegExp(
  `([{,]\\s*)"(${SNOWFLAKE_FIELD_NAMES.join('|')})":\\s*(\\d+)`,
  'g',
);

function quoteSnowflakeJsonFields(text: string): string {
  let out = text.replace(SNOWFLAKE_FIELD_PATTERN, '$1"$2":"$3"');
  // `recipients` ships as `[<id>, <id>, ...]` in older formats; current
  // exports already quote them. Wrap any bare numerics inside the array
  // body so DM channel members survive precision-loss.
  out = out.replace(
    /"recipients"\s*:\s*\[([^\]]*)\]/g,
    (_match, inner: string) =>
      `"recipients":[${inner.replace(
        /(^|,)(\s*)(\d+)(\s*)(?=,|\]|$)/g,
        '$1$2"$3"$4',
      )}]`,
  );
  return out;
}

export function parseSnowflakeJson<T = unknown>(text: string): T {
  return JSON.parse(quoteSnowflakeJsonFields(text)) as T;
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
