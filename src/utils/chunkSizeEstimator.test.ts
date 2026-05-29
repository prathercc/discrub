import { describe, it, expect } from 'vitest';
import { createChunkSizeEstimator } from './chunkSizeEstimator';

describe('createChunkSizeEstimator', () => {
  it('returns the fallback before anything is measured', () => {
    const est = createChunkSizeEstimator(160);
    expect(est.estimate()).toBe(160);
  });

  it('defaults the fallback to 160', () => {
    expect(createChunkSizeEstimator().estimate()).toBe(160);
  });

  it('averages recorded heights', () => {
    const est = createChunkSizeEstimator(160);
    est.record('a', 100);
    est.record('b', 300);
    expect(est.estimate()).toBe(200);
  });

  it('rounds the average to a whole pixel', () => {
    const est = createChunkSizeEstimator(160);
    est.record('a', 100);
    est.record('b', 100);
    est.record('c', 101);
    expect(est.estimate()).toBe(100); // 301/3 = 100.33 -> 100
  });

  it('updates rather than double-counts a re-measured chunk', () => {
    const est = createChunkSizeEstimator(160);
    est.record('a', 100);
    est.record('a', 400); // same key, new height
    expect(est.estimate()).toBe(400); // single entry, not (100+400)/2
  });

  it('ignores a no-op re-measure at the same height', () => {
    const est = createChunkSizeEstimator(160);
    est.record('a', 250);
    est.record('a', 250);
    est.record('b', 150);
    expect(est.estimate()).toBe(200); // (250+150)/2
  });

  it('ignores non-positive and non-finite heights', () => {
    const est = createChunkSizeEstimator(160);
    est.record('a', 0);
    est.record('b', -50);
    est.record('c', NaN);
    est.record('d', Infinity);
    expect(est.estimate()).toBe(160); // nothing valid recorded -> fallback
  });

  it('ignores an empty key', () => {
    const est = createChunkSizeEstimator(160);
    est.record('', 500);
    expect(est.estimate()).toBe(160);
  });

  it('reset() drops all measurements and returns to the fallback', () => {
    const est = createChunkSizeEstimator(160);
    est.record('a', 400);
    est.record('b', 200);
    expect(est.estimate()).toBe(300);
    est.reset();
    expect(est.estimate()).toBe(160);
    // and a fresh measurement after reset is not polluted by the old ones
    est.record('c', 100);
    expect(est.estimate()).toBe(100);
  });
});
