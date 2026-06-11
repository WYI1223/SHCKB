/**
 * @skb/grid-engine — drop intent inference + hole-fill smart placement.
 *
 * Per docs/design/grid-redesign-2026-05-11.md §3.1 + §3.2.
 *
 * **Hole-fill semantic (v1 fix 2026-05-11)**: the proposed block fills
 * the MAXIMAL empty rectangle CONTAINING the cursor (clamped by default
 * size). NOT a rect anchored AT the cursor growing right+down — that
 * was wrong: a cursor in the middle of a 6×4 hole used to shrink the
 * proposed block to (cursor.row → bottom-of-hole) × (cursor.col → right-
 * of-hole), which is much smaller than the hole. Now we find the
 * maximal axis-aligned empty rect that contains the cursor cell.
 *
 * v1 scope: handles "cursor in empty space" → propose place at the
 * hole's top-left with size = min(default, hole.size). Does NOT handle
 * "cursor on edge of existing block" intent (split-* style); that's v2.
 */
import { findCollidingBlocks, isRegionEmpty } from './collision';
import { buildOccupancy } from './occupancy';
import type { BlockSize, DropIntent, GridState, Region } from './types';

/**
 * Find the maximal axis-aligned empty rectangle that contains the cell
 * (col, row), clamped to (capW × capH).
 *
 * Returns the top-left (col, row) of the rect plus its dimensions.
 * Returns null if (col, row) is itself occupied or out of bounds.
 *
 * Algorithm: for each (top, bottom) pair containing cursor.row where
 * cursor.col is empty across that vertical range, find the max width
 * by extending left + right while keeping all cells in [top..bottom]
 * empty. Track the rect with maximum area.
 *
 * Complexity: O(rows² × cols × rows). Fast enough for prototype-scale
 * grids (~12×30); upgrade to O(rows × cols) histogram-based algorithm
 * if N grows.
 */
export function maxEmptyRectContaining(
  state: GridState,
  cursorCol: number,
  cursorRow: number,
  capW: number,
  capH: number,
): { col: number; row: number; colSpan: number; rowSpan: number } | null {
  if (cursorCol < 0 || cursorCol >= state.totalCols || cursorRow < 0) {
    return null;
  }
  if (!isRegionEmpty(state, { col: cursorCol, row: cursorRow, colSpan: 1, rowSpan: 1 })) {
    return null;
  }
  // We need an occupancy matrix sized large enough to contain any rect
  // we might propose. Pad rows beyond the cursor by capH so we can
  // search downward.
  const padRows = Math.max(capH, 1);
  const occ = buildOccupancy(state, padRows + cursorRow);
  const maxRow = occ[0]!.length - 1;

  let bestRect: { col: number; row: number; colSpan: number; rowSpan: number } | null = null;
  let bestArea = 0;

  // Iterate top from cursorRow downward (extending up), bottom from cursorRow upward (extending down).
  for (let top = cursorRow; top >= 0; top--) {
    if (occ[cursorCol]![top] !== null) break; // cursor's column is blocked above
    for (let bottom = cursorRow; bottom <= maxRow; bottom++) {
      if (occ[cursorCol]![bottom] !== null) break; // cursor's column is blocked below
      const height = bottom - top + 1;
      if (height > capH) break; // cap height — no point extending further
      // Find max horizontal extent given the vertical strip [top..bottom]
      let left = cursorCol;
      while (left > 0 && columnRangeEmpty(occ, left - 1, top, bottom)) {
        left--;
      }
      let right = cursorCol;
      while (
        right < state.totalCols - 1 &&
        columnRangeEmpty(occ, right + 1, top, bottom)
      ) {
        right++;
      }
      // Clamp width to capW (centered around cursor — favor cursor's position)
      let clampedLeft = left;
      let clampedRight = right;
      if (clampedRight - clampedLeft + 1 > capW) {
        // Center the cap around the cursor
        const slack = capW;
        clampedLeft = Math.max(left, cursorCol - Math.floor(slack / 2));
        clampedRight = Math.min(right, clampedLeft + capW - 1);
        clampedLeft = Math.max(left, clampedRight - capW + 1);
      }
      const width = clampedRight - clampedLeft + 1;
      const area = width * height;
      if (area > bestArea) {
        bestArea = area;
        bestRect = {
          col: clampedLeft,
          row: top,
          colSpan: width,
          rowSpan: height,
        };
      }
    }
  }
  return bestRect;
}

function columnRangeEmpty(
  occ: (string | null)[][],
  col: number,
  top: number,
  bottom: number,
): boolean {
  if (col < 0 || col >= occ.length) return false;
  const column = occ[col]!;
  for (let r = top; r <= bottom; r++) {
    if (column[r] !== null && column[r] !== undefined) return false;
  }
  return true;
}

/**
 * @deprecated Use maxEmptyRectContaining for cursor-aware placement.
 * Kept for backward compat with tests + existing prototype variants.
 */
export function maxEmptyRectAt(
  state: GridState,
  col: number,
  row: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  if (!isRegionEmpty(state, { col, row, colSpan: 1, rowSpan: 1 })) {
    return { w: 0, h: 0 };
  }
  let w = 1;
  while (
    w < maxW &&
    col + w < state.totalCols &&
    isRegionEmpty(state, { col: col + w, row, colSpan: 1, rowSpan: 1 })
  ) {
    w++;
  }
  let h = 1;
  while (
    h < maxH &&
    isRegionEmpty(state, { col, row: row + h, colSpan: w, rowSpan: 1 })
  ) {
    h++;
  }
  return { w, h };
}

export function inferDropIntent(
  state: GridState,
  cursorCol: number,
  cursorRow: number,
  /** Proposed (max) size for the new block, from the block-kind module. */
  size: BlockSize,
): DropIntent {
  if (cursorCol < 0 || cursorCol >= state.totalCols || cursorRow < 0) {
    return {
      intent: 'reject',
      col: cursorCol,
      row: cursorRow,
      colSpan: 0,
      rowSpan: 0,
      reason: 'cursor out of bounds',
    };
  }
  const cursorOccupant = findCollidingBlocks(state, {
    col: cursorCol,
    row: cursorRow,
    colSpan: 1,
    rowSpan: 1,
  });
  if (cursorOccupant.length > 0) {
    return {
      intent: 'reject',
      col: cursorCol,
      row: cursorRow,
      colSpan: 0,
      rowSpan: 0,
      reason: `cell occupied by ${cursorOccupant[0]!.id}`,
    };
  }
  // 2026-05-11 fix: find the maximal rect CONTAINING the cursor, not
  // anchored at the cursor. The block fills the hole; placement anchor
  // is the hole's top-left (or clamped position when the hole > cap).
  const rect = maxEmptyRectContaining(state, cursorCol, cursorRow, size.colSpan, size.rowSpan);
  if (rect === null) {
    return {
      intent: 'reject',
      col: cursorCol,
      row: cursorRow,
      colSpan: 0,
      rowSpan: 0,
      reason: 'no empty rect at cursor',
    };
  }
  return {
    intent: 'place',
    col: rect.col,
    row: rect.row,
    colSpan: rect.colSpan,
    rowSpan: rect.rowSpan,
  };
}

/**
 * Re-export Region for callers that want to use the type without
 * re-deriving it.
 */
export type { Region };
