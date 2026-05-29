/**
 * Reserve layout space for remote feed media so it doesn't reflow the message
 * feed when it finishes decoding (#190 scroll-jump).
 *
 * Inline attachment/embed images were sized with only `maxWidth`/`maxHeight`,
 * so before the bytes arrived each one occupied ~0 height, then snapped to its
 * real size on load — shifting every row below it. That snap is what made
 * scrolling back up "jump." When Discord hands us the natural dimensions
 * (it does on attachments and embed image/thumbnail/video objects) we fit them
 * into the max box and pin an `aspect-ratio`, so the browser sizes the box
 * before the image loads. `maxWidth: '100%'` + `height: 'auto'` keep it fluid
 * and undistorted in narrow containers.
 *
 * When natural dimensions are missing we fall back to the original max-only
 * behavior — no reservation is possible, but nothing regresses.
 */
export interface NaturalSize {
  width?: number | null;
  height?: number | null;
}

export interface ReservedMediaSx {
  width?: number;
  aspectRatio?: string;
  maxWidth: number | string;
  maxHeight?: number;
  height?: 'auto';
}

/**
 * @param natural   Discord-reported intrinsic size of the media.
 * @param maxHeight Hard pixel cap on rendered height.
 * @param maxWidth  Hard pixel cap on rendered width. Omit for container-width
 *                  media (renders with `maxWidth: '100%'`).
 */
export function reserveMediaBox(
  natural: NaturalSize | null | undefined,
  maxHeight: number,
  maxWidth?: number,
): ReservedMediaSx {
  const nw = natural?.width ?? 0;
  const nh = natural?.height ?? 0;

  if (nw > 0 && nh > 0) {
    const widthCap = maxWidth ?? Infinity;
    const scale = Math.min(widthCap / nw, maxHeight / nh, 1);
    return {
      width: Math.round(nw * scale),
      aspectRatio: `${nw} / ${nh}`,
      maxWidth: '100%',
      height: 'auto',
    };
  }

  // Unknown intrinsic size: preserve the prior max-only behavior.
  return { maxWidth: maxWidth ?? '100%', maxHeight };
}
