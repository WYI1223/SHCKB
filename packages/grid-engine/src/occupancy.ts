/**
 * @skb/grid-engine — occupancy matrix derivation.
 *
 * The matrix is a derived view of GridState.blocks for AABB checks.
 * NOT the source of truth — re-derive after each mutation, do not mutate
 * the matrix in place.
 *
 * Per docs/design/grid-redesign-2026-05-11.md §4.
 */
import type { GridState, Occupancy } from './types';

export function createEmptyState(totalCols: number): GridState {
  return { blocks: [], totalCols };
}

/**
 * Compute the dynamic row count = max(block.row + block.rowSpan).
 *
 * The grid is unbounded vertically; this number is "1 + last occupied row"
 * for rendering / occupancy matrix sizing. Empty state returns 1.
 */
export function totalRows(state: GridState): number {
  if (state.blocks.length === 0) return 1;
  return Math.max(...state.blocks.map((b) => b.row + b.rowSpan));
}

/**
 * Build an occupancy matrix [col][row] → block.id | null.
 *
 * @param state - source GridState
 * @param padRows - extra empty rows below the last block (useful for drop
 *                  intent computation that may target rows beyond current
 *                  document end). Default 0.
 */
export function buildOccupancy(state: GridState, padRows = 0): Occupancy {
  const rows = Math.max(totalRows(state), 1) + padRows;
  const occ: Occupancy = Array.from({ length: state.totalCols }, () =>
    Array.from({ length: rows }, () => null),
  );
  for (const b of state.blocks) {
    for (let c = b.col; c < b.col + b.colSpan; c++) {
      for (let r = b.row; r < b.row + b.rowSpan; r++) {
        if (c >= 0 && c < state.totalCols && r >= 0 && r < rows) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          occ[c]![r] = b.id;
        }
      }
    }
  }
  return occ;
}
