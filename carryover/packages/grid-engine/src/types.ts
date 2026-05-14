/**
 * @skb/grid-engine — pure types.
 *
 * Block = AABB rectangle on a 12-col × N-row LEGO baseplate.
 * Grid is unbounded vertically; totalCols is fixed (default 12).
 *
 * Per docs/design/grid-redesign-2026-05-11.md.
 */

export type BlockKind =
  | 'markdown'
  | 'image'
  | 'code'
  | 'callout'
  | 'math'
  | 'pdf'
  | 'jupyter'
  | 'nn-viz'
  | 'agent-flow';

export type Block = {
  /** Stable, unique within a GridState. */
  id: string;
  /** 0-indexed top-left col. 0 ≤ col < totalCols. */
  col: number;
  /** 0-indexed top-left row. row ≥ 0 (no upper bound). */
  row: number;
  /** Cell count, ≥ 1, col + colSpan ≤ totalCols. */
  colSpan: number;
  /** Cell count, ≥ 1. */
  rowSpan: number;
  /** Block kind drives render + default size + intent semantics. */
  kind: BlockKind;
};

/** AABB region — same shape as Block minus the metadata. */
export type Region = {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
};

export type GridState = {
  blocks: Block[];
  /** Always TOTAL_COLS in production; param-able for tests. */
  totalCols: number;
};

/** Result of a state-mutating op. Either ok with new state, or rejected with reason. */
export type OpResult =
  | { ok: true; state: GridState }
  | { ok: false; error: string };

/**
 * Occupancy matrix view of a GridState. occupancy[col][row] = block.id | null.
 *
 * NOT the source of truth — derived from GridState.blocks via buildOccupancy.
 * Re-derive after each mutation; do not mutate in place.
 */
export type Occupancy = (string | null)[][];

/** Drop intent inferred from a cursor position over a GridState. */
export type DropIntent = {
  intent: 'place' | 'reject';
  /** The slot at which the new block's top-left will land (post hole-fill). */
  col: number;
  row: number;
  /** The size of the new block (post hole-fill min(default, hole-max)). */
  colSpan: number;
  rowSpan: number;
  /** Populated when intent === 'reject'. */
  reason?: string;
};

/** Validation report for a GridState (no overlap + in bounds + unique ids). */
export type ValidationResult = {
  ok: boolean;
  errors: string[];
};
