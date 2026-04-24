import { describe, it, expect } from 'vitest';
import { formatMessageTimestamp } from './dateUtils';
import { DateFormat, TimeFormat } from 'discrub-core/discrub-enum';

describe('formatMessageTimestamp', () => {
  const testDate = new Date('2024-03-15T14:30:45.000Z');

  it('formats MM/DD/YYYY with 12 hour time', () => {
    const result = formatMessageTimestamp(testDate, DateFormat.MMDDYYYY, TimeFormat._12HOUR);
    expect(result).toMatch(/03\/15\/2024/);
    expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
  });

  it('formats MM/DD/YYYY with 24 hour time', () => {
    const result = formatMessageTimestamp(testDate, DateFormat.MMDDYYYY, TimeFormat._24HOUR);
    expect(result).toMatch(/03\/15\/2024/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('formats DD/MM/YYYY with 12 hour time', () => {
    const result = formatMessageTimestamp(testDate, DateFormat.DDMMYYYY, TimeFormat._12HOUR);
    expect(result).toMatch(/15\/03\/2024/);
  });

  it('formats DD/MM/YYYY with 24 hour time', () => {
    const result = formatMessageTimestamp(testDate, DateFormat.DDMMYYYY, TimeFormat._24HOUR);
    expect(result).toMatch(/15\/03\/2024/);
  });

  it('formats with 12 hour with seconds', () => {
    const result = formatMessageTimestamp(testDate, DateFormat.MMDDYYYY, TimeFormat._12HOUR_WITH_SECONDS);
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}\s?(AM|PM)/i);
  });

  it('formats with 24 hour with seconds', () => {
    const result = formatMessageTimestamp(testDate, DateFormat.MMDDYYYY, TimeFormat._24HOUR_WITH_SECONDS);
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('formats DD/MM/YYYY with 12 hour with seconds', () => {
    const result = formatMessageTimestamp(testDate, DateFormat.DDMMYYYY, TimeFormat._12HOUR_WITH_SECONDS);
    expect(result).toMatch(/15\/03\/2024/);
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}\s?(AM|PM)/i);
  });

  it('formats DD/MM/YYYY with 24 hour with seconds', () => {
    const result = formatMessageTimestamp(testDate, DateFormat.DDMMYYYY, TimeFormat._24HOUR_WITH_SECONDS);
    expect(result).toMatch(/15\/03\/2024/);
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('accepts string dates', () => {
    const result = formatMessageTimestamp('2024-03-15T14:30:45.000Z', DateFormat.MMDDYYYY, TimeFormat._12HOUR);
    expect(result).toMatch(/03\/15\/2024/);
  });
});
