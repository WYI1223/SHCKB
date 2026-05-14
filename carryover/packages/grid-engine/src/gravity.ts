/**
 * @skb/grid-engine — per-block AABB upward gravity.
 *
 * Per docs/design/grid-redesign-2026-05-11.md §3.3 + §9.1.
 *
 * Algorithm: each block tries to rise (decrement row by 1). A block can
 * rise iff its entire footprint (one-row-up) is empty. Iterate until no
 * block moves (convergence). Block size is preserved during fall;
 * column position never changes.
 *
 * **Option A** (locked 2026-05-11): gravity is invariant on every state
 * change including insert. After EVERY ops.ts call, state is gravity-
 * stable — no floating blocks. This eliminates the surprise where an
 * unrelated delete causes a previously-floating block to leap to row 0.
 */
import { isRegionEmpty } from './collision';
import type { GridState } from './types';

const MAX_PASSES = 1000; // safety cap; convergence is bounded by block count

export function canRise(state: GridState, blockId: string): boolean {
  const block = state.blocks.find((b) => b.id === blockId);
  if (!block) return false;
  if (block.row === 0) return false;
  // Region directly above the block (height 1)
  return isRegionEmpty(
    state,
    {
      col: block.col,
      row: block.row - 1,
      colSpan: block.colSpan,
      rowSpan: 1,
    },
    blockId,
  );
}

export function applyGravity(state: GridState): {
  state: GridState;
  iterations: number;
  movedTotal: number;
} {
  let working = state;
  let iterations = 0;
  let movedTotal = 0;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    // Sort blocks by row ascending — top blocks first. This way bottom
    // blocks see the most up-to-date state when checking canRise.
    const sorted = [...working.blocks].sort((a, b) => a.row - b.row);
    let movedThisPass = 0;
    for (const b of sorted) {
      // Re-find live block — it may have moved already this pass.
      const live = working.blocks.find((x) => x.id === b.id);
      if (!live) continue;
      if (canRise(working, live.id)) {
        const lifted = { ...live, row: live.row - 1 };
        working = {
          ...working,
          blocks: working.blocks.map((x) => (x.id === live.id ? lifted : x)),
        };
        movedThisPass++;
        movedTotal++;
      }
    }
    iterations++;
    if (movedThisPass === 0) break;
  }
  return { state: working, iterations, movedTotal };
}
