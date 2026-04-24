import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { calculateRandomDelay } from './delayUtils';

describe('delayUtils', () => {
  describe('calculateRandomDelay', () => {
    let mathRandomSpy: MockInstance<[], number>;

    beforeEach(() => {
      mathRandomSpy = vi.spyOn(Math, 'random');
    });

    afterEach(() => {
      mathRandomSpy.mockRestore();
    });

    it('should calculate delay with zero random component', () => {
      mathRandomSpy.mockReturnValue(0);

      const result = calculateRandomDelay(2, 1);

      expect(result.baseDelay).toBe(2);
      expect(result.modifier).toBe(1);
      expect(result.randomComponent).toBe(0);
      expect(result.delaySec).toBe(2);
      expect(result.delayMs).toBe(2000);
    });

    it('should calculate delay with maximum random component', () => {
      mathRandomSpy.mockReturnValue(1);

      const result = calculateRandomDelay(2, 1);

      expect(result.baseDelay).toBe(2);
      expect(result.modifier).toBe(1);
      expect(result.randomComponent).toBe(1);
      expect(result.delaySec).toBe(3);
      expect(result.delayMs).toBe(3000);
    });

    it('should calculate delay with mid-range random component', () => {
      mathRandomSpy.mockReturnValue(0.5);

      const result = calculateRandomDelay(2, 1);

      expect(result.baseDelay).toBe(2);
      expect(result.modifier).toBe(1);
      expect(result.randomComponent).toBe(0.5);
      expect(result.delaySec).toBe(2.5);
      expect(result.delayMs).toBe(2500);
    });

    it('should round delay seconds to 2 decimal places', () => {
      mathRandomSpy.mockReturnValue(0.333);

      const result = calculateRandomDelay(1, 1);

      expect(result.randomComponent).toBe(0.33);
      expect(result.delaySec).toBe(1.33);
    });

    it('should round delay milliseconds to nearest integer', () => {
      mathRandomSpy.mockReturnValue(0.3333);

      const result = calculateRandomDelay(1, 1);

      // 1.3333 * 1000 = 1333.3, rounds to 1333
      expect(result.delayMs).toBe(1333);
    });

    it('should handle zero base delay', () => {
      mathRandomSpy.mockReturnValue(0.5);

      const result = calculateRandomDelay(0, 2);

      expect(result.baseDelay).toBe(0);
      expect(result.modifier).toBe(2);
      expect(result.randomComponent).toBe(1);
      expect(result.delaySec).toBe(1);
      expect(result.delayMs).toBe(1000);
    });

    it('should handle zero modifier', () => {
      mathRandomSpy.mockReturnValue(0.5);

      const result = calculateRandomDelay(5, 0);

      expect(result.baseDelay).toBe(5);
      expect(result.modifier).toBe(0);
      expect(result.randomComponent).toBe(0);
      expect(result.delaySec).toBe(5);
      expect(result.delayMs).toBe(5000);
    });

    it('should handle large delays', () => {
      mathRandomSpy.mockReturnValue(0.5);

      const result = calculateRandomDelay(60, 30);

      expect(result.baseDelay).toBe(60);
      expect(result.modifier).toBe(30);
      expect(result.randomComponent).toBe(15);
      expect(result.delaySec).toBe(75);
      expect(result.delayMs).toBe(75000);
    });

    it('should handle fractional base delays', () => {
      mathRandomSpy.mockReturnValue(0);

      const result = calculateRandomDelay(0.5, 0);

      expect(result.baseDelay).toBe(0.5);
      expect(result.delaySec).toBe(0.5);
      expect(result.delayMs).toBe(500);
    });

    it('should handle fractional modifiers', () => {
      mathRandomSpy.mockReturnValue(1);

      const result = calculateRandomDelay(1, 0.5);

      expect(result.modifier).toBe(0.5);
      expect(result.randomComponent).toBe(0.5);
      expect(result.delaySec).toBe(1.5);
      expect(result.delayMs).toBe(1500);
    });
  });
});
