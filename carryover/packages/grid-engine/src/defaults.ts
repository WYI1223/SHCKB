/**
 * @skb/grid-engine — kind-keyed default sizes for new block insertion.
 *
 * Used by inferDropIntent to compute proposed (colSpan, rowSpan) for a
 * fresh block. Hole-fill clamps these to the empty region's max size,
 * so defaults are aspirational maxima not hard requirements.
 *
 * Per docs/design/grid-redesign-2026-05-11.md §6.
 */
import type { BlockKind } from './types';

export const TOTAL_COLS = 12;

export const DEFAULT_SIZES: Record<BlockKind, { w: number; h: number }> = {
  markdown: { w: 12, h: 1 },
  image: { w: 6, h: 4 },
  code: { w: 12, h: 4 },
  callout: { w: 12, h: 1 },
  math: { w: 12, h: 2 },
  pdf: { w: 12, h: 8 },
  jupyter: { w: 12, h: 6 },
  'nn-viz': { w: 12, h: 6 },
  'agent-flow': { w: 12, h: 6 },
};
