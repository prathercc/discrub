import { describe, it, expect } from 'vitest';
import { reserveMediaBox } from './reserveMediaBox';

describe('reserveMediaBox', () => {
  it('pins an aspect-ratio when natural dimensions are known', () => {
    const sx = reserveMediaBox({ width: 800, height: 600 }, 300, 400);
    expect(sx.aspectRatio).toBe('800 / 600');
    expect(sx.maxWidth).toBe('100%');
    expect(sx.height).toBe('auto');
  });

  it('fits within the height cap (landscape clamped by maxHeight)', () => {
    // 800x600 into max 400w x 300h: height cap binds first (300/600=0.5),
    // width cap 400/800=0.5 ties — scale 0.5 -> width 400, reserved height 300.
    const sx = reserveMediaBox({ width: 800, height: 600 }, 300, 400);
    expect(sx.width).toBe(400);
  });

  it('fits within the height cap (tall portrait clamped by maxHeight)', () => {
    // 600x1200 into max 400w x 300h: height cap 300/1200=0.25 binds.
    const sx = reserveMediaBox({ width: 600, height: 1200 }, 300, 400);
    expect(sx.width).toBe(150); // 600 * 0.25
    expect(sx.aspectRatio).toBe('600 / 1200');
  });

  it('never upscales beyond natural size (scale capped at 1)', () => {
    const sx = reserveMediaBox({ width: 50, height: 40 }, 300, 400);
    expect(sx.width).toBe(50);
  });

  it('uses only the height cap when maxWidth is omitted (container-width media)', () => {
    // 1000x500 into maxHeight 300, no width cap: scale 300/500=0.6 -> width 600.
    const sx = reserveMediaBox({ width: 1000, height: 500 }, 300);
    expect(sx.width).toBe(600);
    expect(sx.maxWidth).toBe('100%');
  });

  it('falls back to max-only behavior when dimensions are missing', () => {
    expect(reserveMediaBox(undefined, 300, 400)).toEqual({ maxWidth: 400, maxHeight: 300 });
    expect(reserveMediaBox({ width: null, height: null }, 240)).toEqual({
      maxWidth: '100%',
      maxHeight: 240,
    });
  });

  it('falls back when only one dimension is present', () => {
    expect(reserveMediaBox({ width: 800 }, 300, 400)).toEqual({ maxWidth: 400, maxHeight: 300 });
    expect(reserveMediaBox({ height: 600 }, 300, 400)).toEqual({ maxWidth: 400, maxHeight: 300 });
  });

  it('falls back on non-positive dimensions', () => {
    expect(reserveMediaBox({ width: 0, height: 0 }, 300, 400)).toEqual({
      maxWidth: 400,
      maxHeight: 300,
    });
  });
});
