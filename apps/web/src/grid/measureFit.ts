/**
 * Pure arithmetic for the autofit measurement loop (spec §5.3).
 *
 * The offscreen measurement box is laid out at the block's EXACT grid
 * geometry width so wrapping matches the live/published render, then
 * fit = ceil(Frame-wrapper outerHeight / slot). We never subtract chrome
 * and never compute width by content — the real theme Frame around the
 * RenderView makes wrapping width + typography correct by construction.
 */

/** The block's content-box width in px: colSpan*slot - 2*pad. */
export function measuredWidthPx(colSpan: number, slot: number, pad: number): number {
  return colSpan * slot - 2 * pad;
}

/** fit (rows) for a measured Frame outer height. Floor of 1 row. */
export function fitFromOuterHeight(outerHeight: number, slot: number): number {
  return Math.max(1, Math.ceil(outerHeight / slot));
}
