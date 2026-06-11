/**
 * @skb/grid-engine — AABB collision detection + region queries.
 *
 * Per docs/design/grid-redesign-2026-05-11.md §2.
 */
import type { Block, GridState, Region } from './types';

/**
 * AABB overlap test for 2 regions on the same grid. Returns true iff
 * they share at least one cell.
 */
export function regionsOverlap(a: Region, b: Region): boolean {
  return (
    a.col < b.col + b.colSpan &&
    b.col < a.col + a.colSpan &&
    a.row < b.row + b.rowSpan &&
    b.row < a.row + a.rowSpan
  );
}

/**
 * Find blocks that overlap with the given region.
 *
 * @param ignoreId - for moves / resizes where the moving block's old
 *                   position should not collide with itself.
 */
export function findCollidingBlocks(
  state: GridState,
  region: Region,
  ignoreId?: string,
): Block[] {
  return state.blocks.filter(
    (b) => b.id !== ignoreId && regionsOverlap(b, region),
  );
}

export function isRegionEmpty(
  state: GridState,
  region: Region,
  ignoreId?: string,
): boolean {
  return findCollidingBlocks(state, region, ignoreId).length === 0;
}

export function isRegionInBounds(state: GridState, region: Region): boolean {
  return (
    region.col >= 0 &&
    region.row >= 0 &&
    region.colSpan >= 1 &&
    region.rowSpan >= 1 &&
    region.col + region.colSpan <= state.totalCols
    // No vertical bound — grid grows down freely
  );
}
