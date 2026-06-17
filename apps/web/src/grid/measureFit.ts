/**
 * Pure arithmetic for the autofit measurement loop (spec §5.3).
 *
 * The offscreen measurement box is laid out at the block's EXACT grid
 * geometry width so wrapping matches the live/published render, then the
 * frame is given a DEFINITE tall cell height so it lays out exactly as it
 * does on the real canvas (frames fill the cell they're given — some draw
 * their content in an absolutely-positioned, inset layer that collapses to
 * zero height without a cell, so measuring the frame's auto height is not
 * frame-agnostic). We measure two things inside the real frame: the
 * available content AREA (a child stretched to height:100%) and the
 * content's NATURAL height (a child at auto height). The difference between
 * the probe cell height and the area is the frame's vertical chrome — no
 * per-frame knowledge, no getComputedStyle.
 */

/** The block's content-box width in px: colSpan*slot - 2*pad. */
export function measuredWidthPx(colSpan: number, slot: number, pad: number): number {
  return colSpan * slot - 2 * pad;
}

/**
 * fit (rows) for measured content. The committed block lives in a cell of
 * height rowSpan*slot - 2*pad (the canvas insets every block by `pad` on
 * each side), and the frame's vertical chrome sits inside that cell. So the
 * minimal rowSpan whose content area holds the content is
 *   ceil((contentHeight + chrome + 2*pad) / slot)
 * with a floor of one row.
 */
export function fitFromContent(
  contentHeight: number,
  chrome: number,
  slot: number,
  pad: number,
): number {
  return Math.max(1, Math.ceil((contentHeight + Math.max(0, chrome) + 2 * pad) / slot));
}
