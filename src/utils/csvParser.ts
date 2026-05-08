import Papa from 'papaparse';
import type { PackageMessage } from '@/features/package/packageTypes';

/**
 * Parses a Discord data package messages.csv payload.
 *
 * Format is fixed: 4 columns (ID, Timestamp, Contents, Attachments) with
 * a header row. Fields containing commas or newlines are quoted; embedded
 * quotes are escaped as "". Multi-attachment messages encode their URLs
 * in the single Attachments cell separated by whitespace — split here so
 * downstream consumers see a real list (#159).
 */
export function parseMessagesCsv(csv: string): PackageMessage[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    // Discord CSVs are LF-terminated. Papaparse's auto newline detection
    // picks `\r\n` when it sees a stray CR inside quoted content, which
    // then treats the rest of the file as one single field and collapses
    // hundreds of rows into one. Force `\n` to match Discord's actual
    // format. Verified against a 763-message DM export.
    newline: '\n',
  });

  return result.data
    .filter((row) => row.ID && row.Timestamp)
    .map((row) => ({
      id: row.ID,
      timestamp: row.Timestamp,
      content: row.Contents ?? '',
      attachments: parseAttachmentCell(row.Attachments),
    }));
}

/**
 * Discord's CDN URLs never contain whitespace internally (paths are
 * URL-encoded), so a naive whitespace split is safe. Empty / missing
 * cell → `[]`. Filter empty fragments to defend against trailing
 * whitespace or double spaces in malformed exports.
 *
 * Exported so the JSON message parser (#163) can reuse the same
 * splitting rule — Discord's `Attachments` field carries the same
 * whitespace-separated URL format in both CSV cells and JSON values.
 */
export function parseAttachmentCell(cell: string | undefined): string[] {
  if (!cell) return [];
  return cell.split(/\s+/).filter((u) => u.length > 0);
}

/**
 * Counts message rows in a CSV without fully parsing content.
 *
 * Used during the initial package scan to populate `messageCount` per
 * channel without holding every row in memory. Newlines inside quoted
 * message content would break a naive line count, so this streams through
 * the CSV tracking quote state.
 */
export function countCsvRows(csv: string): number {
  let rows = 0;
  let inQuotes = false;
  let sawContent = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];

    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      sawContent = true;
      continue;
    }

    if (ch === '\n' && !inQuotes) {
      if (sawContent) rows++;
      sawContent = false;
      continue;
    }

    if (ch !== '\r') sawContent = true;
  }

  if (sawContent) rows++;

  return Math.max(0, rows - 1);
}
