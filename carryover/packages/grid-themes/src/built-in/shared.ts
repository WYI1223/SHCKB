/**
 * @skb/grid-themes — shared style helpers + per-kind hue vars used by
 * all 3 built-in themes.
 *
 * The hue palette matches the prototype's sample-data KIND_HUES (which
 * derive from ADR-0018 v0.5 D3 token palette). When a future PR
 * promotes design-tokens to OKLCH per-kind exports, themes will
 * consume those instead of these literal cssVars.
 */
import type { Block } from '@skb/grid-engine';

/** Per-kind hue OKLCH values exposed as CSS variables. */
export const KIND_HUE_VARS: Record<string, string> = {
  '--skb-kind-markdown': 'oklch(60% 0.04 280)',
  '--skb-kind-image': 'oklch(65% 0.12 240)',
  '--skb-kind-code': 'oklch(60% 0.10 140)',
  '--skb-kind-callout': 'oklch(65% 0.13 50)',
  '--skb-kind-math': 'oklch(60% 0.10 320)',
  '--skb-kind-pdf': 'oklch(60% 0.10 30)',
  '--skb-kind-jupyter': 'oklch(60% 0.10 80)',
  '--skb-kind-nn-viz': 'oklch(60% 0.10 200)',
  '--skb-kind-agent-flow': 'oklch(60% 0.10 0)',
};

/**
 * Common positioning CSS for a baseplate canvas. Themes wrap the actual
 * rendering style on top.
 *
 * Wave 7 Phase 2D: the baseplate mounts as a positioned-absolute child
 * of the grid container so the parent's CSS Grid (`.skb-grid display: grid`)
 * doesn't reserve a layout cell for it. Container must be
 * `position: relative` (set in `grid.css` `.skb-grid[data-skb-theme]`).
 */
export function baseplateStyle(_slotSize: number): React.CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
  };
}

/**
 * Compute absolute positioning style for a block in the grid coord
 * system. `padding` is per-side padding subtracted from each side
 * (themes that want gutters between blocks pass > 0; LEGO theme passes
 * 0 because blocks butt up against grid lines).
 */
export function blockStyle(
  block: Block,
  slotSize: number,
  padding: number,
): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${block.col * slotSize + padding}px`,
    top: `${block.row * slotSize + padding}px`,
    width: `${block.colSpan * slotSize - 2 * padding}px`,
    height: `${block.rowSpan * slotSize - 2 * padding}px`,
    boxSizing: 'border-box',
    overflow: 'hidden',
  };
}

/**
 * Compute absolute positioning style for a drop-preview ghost rect.
 * Themes wrap the actual border / background style on top.
 */
export function dropPreviewStyle(
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number,
  slotSize: number,
  padding: number,
): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${col * slotSize + padding}px`,
    top: `${row * slotSize + padding}px`,
    width: `${Math.max(colSpan, 1) * slotSize - 2 * padding}px`,
    height: `${Math.max(rowSpan, 1) * slotSize - 2 * padding}px`,
    pointerEvents: 'none',
    zIndex: 3,
  };
}
