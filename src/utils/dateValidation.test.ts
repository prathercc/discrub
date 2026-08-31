import { describe, it, expect } from 'vitest';
import { isInvalidDate, dropInvalidDate } from './dateValidation';

describe('dateValidation (#250)', () => {
  describe('isInvalidDate', () => {
    it('is true for an Invalid Date (what MUI pickers emit mid-typing)', () => {
      expect(isInvalidDate(new Date(NaN))).toBe(true);
      expect(isInvalidDate(new Date('nonsense'))).toBe(true);
    });

    it('is false for a real date', () => {
      expect(isInvalidDate(new Date('2026-08-29T10:00:00Z'))).toBe(false);
    });

    it('is false for null and undefined (no bound is not an invalid bound)', () => {
      expect(isInvalidDate(null)).toBe(false);
      expect(isInvalidDate(undefined)).toBe(false);
    });
  });

  describe('dropInvalidDate', () => {
    it('passes a real date through untouched', () => {
      const d = new Date('2026-08-29T10:00:00Z');
      expect(dropInvalidDate(d)).toBe(d);
    });

    it('turns an Invalid Date into null', () => {
      expect(dropInvalidDate(new Date(NaN))).toBeNull();
    });

    it('normalizes null and undefined to null', () => {
      expect(dropInvalidDate(null)).toBeNull();
      expect(dropInvalidDate(undefined)).toBeNull();
    });
  });
});
