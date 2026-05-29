/**
 * Running-average size estimator for the virtualized message feed (#190).
 *
 * TanStack's `useVirtualizer` lays each not-yet-measured row out at a single
 * `estimateSize` value, then a ResizeObserver snaps it to its true height
 * after paint. With a flat estimate that is far from reality (message chunks
 * vary from one-liners to embed+attachment+reaction stacks), that snap is
 * large and shifts every row below it — the visible "jump" while scrolling up.
 *
 * Feeding the virtualizer a running average of the heights we *have* measured
 * makes unmeasured rows start much closer to their real size, so the snap —
 * and the jump — is smaller. It never eliminates the snap (the first
 * measurement of any row is always a guess), it just shrinks it.
 *
 * Heights are keyed by the stable chunk key so re-measuring the same chunk
 * (e.g. a resize) updates rather than double-counts it.
 */
export interface ChunkSizeEstimator {
  /** Record (or update) the measured pixel height of a chunk. */
  record: (key: string, height: number) => void;
  /** Best current estimate for an unmeasured chunk, in pixels. */
  estimate: () => number;
  /** Drop all measurements (e.g. when the feed switches channels). */
  reset: () => void;
}

export function createChunkSizeEstimator(fallback = 160): ChunkSizeEstimator {
  const heights = new Map<string, number>();
  let sum = 0;

  return {
    record(key, height) {
      if (!key || !Number.isFinite(height) || height <= 0) return;
      const prev = heights.get(key);
      if (prev === height) return;
      heights.set(key, height);
      sum += height - (prev ?? 0);
    },
    estimate() {
      return heights.size > 0 ? Math.round(sum / heights.size) : fallback;
    },
    reset() {
      heights.clear();
      sum = 0;
    },
  };
}
