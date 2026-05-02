import { describe, it, expect } from 'vitest';
import { parseMessagesCsv, countCsvRows } from './csvParser';

const HEADER = 'ID,Timestamp,Contents,Attachments';

describe('parseMessagesCsv', () => {
  it('parses a simple row', () => {
    const csv = `${HEADER}\n123,2022-07-28 22:30:52.800000+00:00,hello,`;
    const rows = parseMessagesCsv(csv);
    expect(rows).toEqual([
      {
        id: '123',
        timestamp: '2022-07-28 22:30:52.800000+00:00',
        content: 'hello',
        attachments: [],
      },
    ]);
  });

  it('treats blank content as empty string', () => {
    const csv = `${HEADER}\n123,2022-07-28 22:30:52.800000+00:00,,`;
    const rows = parseMessagesCsv(csv);
    expect(rows[0].content).toBe('');
  });

  it('handles quoted fields with embedded commas', () => {
    const csv = `${HEADER}\n123,2022-07-28 22:30:52.800000+00:00,"hello, world",`;
    const rows = parseMessagesCsv(csv);
    expect(rows[0].content).toBe('hello, world');
  });

  it('handles quoted fields with embedded newlines', () => {
    const csv = `${HEADER}\n123,2022-07-28 22:30:52.800000+00:00,"line1\nline2",`;
    const rows = parseMessagesCsv(csv);
    expect(rows[0].content).toBe('line1\nline2');
  });

  it('handles escaped double quotes', () => {
    const csv = `${HEADER}\n123,2022-07-28 22:30:52.800000+00:00,"he said ""hi""",`;
    const rows = parseMessagesCsv(csv);
    expect(rows[0].content).toBe('he said "hi"');
  });

  it('captures a single attachment URL', () => {
    const csv = `${HEADER}\n123,2022-07-28 22:30:52.800000+00:00,check this,https://cdn.discordapp.com/attachments/1/2/a.png`;
    const rows = parseMessagesCsv(csv);
    expect(rows[0].attachments).toEqual([
      'https://cdn.discordapp.com/attachments/1/2/a.png',
    ]);
  });

  // Backlog #159: Discord encodes multi-attachment messages as a
  // single CSV cell with whitespace-separated URLs. The parser must
  // expose them as a real list so downstream rendering / export shows
  // every attachment, not one broken concatenated link.
  it('splits multi-attachment cells on whitespace (#159)', () => {
    const cell =
      'https://cdn.discordapp.com/attachments/1/2/a.png ' +
      'https://cdn.discordapp.com/attachments/1/2/b.jpg ' +
      'https://cdn.discordapp.com/attachments/1/2/c.gif';
    const csv = `${HEADER}\n123,2022-07-28 22:30:52.800000+00:00,three pics,${cell}`;
    const rows = parseMessagesCsv(csv);
    expect(rows[0].attachments).toEqual([
      'https://cdn.discordapp.com/attachments/1/2/a.png',
      'https://cdn.discordapp.com/attachments/1/2/b.jpg',
      'https://cdn.discordapp.com/attachments/1/2/c.gif',
    ]);
  });

  it('returns [] for an empty Attachments cell', () => {
    const csv = `${HEADER}\n123,2022-07-28 22:30:52.800000+00:00,no attachment,`;
    const rows = parseMessagesCsv(csv);
    expect(rows[0].attachments).toEqual([]);
  });

  it('drops empty fragments from malformed double-spaced cells', () => {
    const csv =
      `${HEADER}\n123,2022-07-28 22:30:52.800000+00:00,trailing,` +
      'https://cdn.discordapp.com/attachments/1/2/a.png  ';
    const rows = parseMessagesCsv(csv);
    expect(rows[0].attachments).toEqual([
      'https://cdn.discordapp.com/attachments/1/2/a.png',
    ]);
  });

  it('skips empty lines', () => {
    const csv = `${HEADER}\n\n123,2022-07-28 22:30:52.800000+00:00,a,\n\n456,2022-07-29 00:00:00.000000+00:00,b,\n`;
    const rows = parseMessagesCsv(csv);
    expect(rows).toHaveLength(2);
  });

  it('handles Discord-style multi-line quoted content with embedded escaped quotes across many rows', () => {
    // Regression test: real package CSVs contain long runs of multi-line
    // quoted content + escaped quotes that used to collapse the whole file
    // into a single row when papaparse auto-detected `\r\n` newlines.
    const csv = [
      HEADER,
      '1,2022-07-28 22:30:52.800000+00:00,first,',
      '2,2022-07-29 00:00:00.000000+00:00,"multi\nline\ncontent",',
      '3,2022-07-30 00:00:00.000000+00:00,"with ""escaped"" quotes",',
      '4,2022-07-31 00:00:00.000000+00:00,"long text with, commas and\nembedded newlines spanning\nmultiple lines",',
      '5,2022-08-01 00:00:00.000000+00:00,last,',
    ].join('\n');
    const rows = parseMessagesCsv(csv);
    expect(rows).toHaveLength(5);
    expect(rows[0].id).toBe('1');
    expect(rows[4].id).toBe('5');
    expect(rows[2].content).toBe('with "escaped" quotes');
  });

  it('skips rows missing required fields', () => {
    const csv = `${HEADER}\n,,,\n123,2022-07-28 22:30:52.800000+00:00,a,`;
    const rows = parseMessagesCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('123');
  });
});

describe('countCsvRows', () => {
  it('returns 0 for header only', () => {
    expect(countCsvRows(HEADER)).toBe(0);
  });

  it('counts simple rows', () => {
    const csv = `${HEADER}\n1,t,a,\n2,t,b,\n3,t,c,`;
    expect(countCsvRows(csv)).toBe(3);
  });

  it('does not count newlines inside quoted content', () => {
    const csv = `${HEADER}\n1,t,"line1\nline2\nline3",\n2,t,b,`;
    expect(countCsvRows(csv)).toBe(2);
  });

  it('handles escaped quotes inside content without miscounting', () => {
    const csv = `${HEADER}\n1,t,"he said ""hi""",\n2,t,b,`;
    expect(countCsvRows(csv)).toBe(2);
  });

  it('handles trailing newline', () => {
    const csv = `${HEADER}\n1,t,a,\n2,t,b,\n`;
    expect(countCsvRows(csv)).toBe(2);
  });
});
