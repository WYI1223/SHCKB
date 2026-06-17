/**
 * @skb/grid-engine — state-mutating operations.
 *
 * Per docs/design/grid-redesign-2026-05-11.md §3 + §9 (Option A locked
 * but pluggable: `{ gravity: false }` opts out for power-user free-
 * placement mode).
 *
 * Every op:
 * 1. Validates the operation against current state (in bounds + no
 *    overlap + valid id).
 * 2. Returns OpResult — either { ok: true, state: new } or
 *    { ok: false, error: human-readable }.
 * 3. Applies upward gravity AFTER the change UNLESS `options.gravity ===
 *    false`. Default = `true` to preserve Option A invariant.
 *
 * deleteBlock returns GridState directly (no failure mode — deleting a
 * non-existent id is a silent no-op).
 */
import { findCollidingBlocks, isRegionInBounds, regionsOverlap } from './collision';
import { applyGravity } from './gravity';
import type { Block, GridState, OpResult, Region } from './types';

export type OpOptions = { gravity?: boolean };

function withGravity(state: GridState, options?: OpOptions): GridState {
  if (options?.gravity === false) return state;
  return applyGravity(state).state;
}

export function insertBlock(
  state: GridState,
  block: Block,
  options?: OpOptions,
): OpResult {
  if (!isRegionInBounds(state, block)) {
    return { ok: false, error: `out of bounds: ${describe(block)}` };
  }
  if (state.blocks.some((b) => b.id === block.id)) {
    return { ok: false, error: `duplicate id: ${block.id}` };
  }
  const colliders = findCollidingBlocks(state, block);
  if (colliders.length > 0) {
    return {
      ok: false,
      error: `overlap with ${colliders.map((b) => b.id).join(', ')}`,
    };
  }
  const seeded: GridState = { ...state, blocks: [...state.blocks, block] };
  return { ok: true, state: withGravity(seeded, options) };
}

export function moveBlock(
  state: GridState,
  id: string,
  newCol: number,
  newRow: number,
  options?: OpOptions,
): OpResult {
  const block = state.blocks.find((b) => b.id === id);
  if (!block) return { ok: false, error: `no such block: ${id}` };
  const moved: Block = { ...block, col: newCol, row: newRow };
  if (!isRegionInBounds(state, moved)) {
    return { ok: false, error: `out of bounds: ${describe(moved)}` };
  }
  const colliders = findCollidingBlocks(state, moved, id);
  if (colliders.length > 0) {
    return {
      ok: false,
      error: `overlap with ${colliders.map((b) => b.id).join(', ')}`,
    };
  }
  const newBlocks = state.blocks.map((b) => (b.id === id ? moved : b));
  return { ok: true, state: withGravity({ ...state, blocks: newBlocks }, options) };
}

export function resizeBlock(
  state: GridState,
  id: string,
  newColSpan: number,
  newRowSpan: number,
  options?: OpOptions,
): OpResult {
  const block = state.blocks.find((b) => b.id === id);
  if (!block) return { ok: false, error: `no such block: ${id}` };
  const resized: Block = { ...block, colSpan: newColSpan, rowSpan: newRowSpan };
  if (!isRegionInBounds(state, resized)) {
    return { ok: false, error: `out of bounds: ${describe(resized)}` };
  }
  const colliders = findCollidingBlocks(state, resized, id);
  if (colliders.length > 0) {
    return {
      ok: false,
      error: `overlap with ${colliders.map((b) => b.id).join(', ')}`,
    };
  }
  const newBlocks = state.blocks.map((b) => (b.id === id ? resized : b));
  return { ok: true, state: withGravity({ ...state, blocks: newBlocks }, options) };
}

/**
 * Atomic move + resize. Useful for left-edge / top-edge resize where
 * both position and size change in one user gesture (sequential
 * moveBlock + resizeBlock would not be atomic — first op could leave
 * block in a half-mutated state if second op fails).
 */
export function transformBlock(
  state: GridState,
  id: string,
  changes: Partial<Pick<Block, 'col' | 'row' | 'colSpan' | 'rowSpan'>>,
  options?: OpOptions,
): OpResult {
  const block = state.blocks.find((b) => b.id === id);
  if (!block) return { ok: false, error: `no such block: ${id}` };
  const transformed: Block = { ...block, ...changes };
  if (!isRegionInBounds(state, transformed)) {
    return { ok: false, error: `out of bounds: ${describe(transformed)}` };
  }
  const colliders = findCollidingBlocks(state, transformed, id);
  if (colliders.length > 0) {
    return {
      ok: false,
      error: `overlap with ${colliders.map((b) => b.id).join(', ')}`,
    };
  }
  const newBlocks = state.blocks.map((b) => (b.id === id ? transformed : b));
  return { ok: true, state: withGravity({ ...state, blocks: newBlocks }, options) };
}

/**
 * Delete a block. Silent no-op if id doesn't exist. Always runs gravity
 * unless `options.gravity === false`.
 */
export function deleteBlock(
  state: GridState,
  id: string,
  options?: OpOptions,
): GridState {
  const newBlocks = state.blocks.filter((b) => b.id !== id);
  return withGravity({ ...state, blocks: newBlocks }, options);
}

/**
 * Autofit "limited-height + grow" engine op (markdown-first; kind-opaque).
 *
 * Sets block `id`'s rowSpan to `newRowSpan`, then resolves the resulting AABB
 * collisions by pushing every colliding block DOWN by exactly the vertical
 * overlap depth, recursing top-down. The SAME engine serves grow AND shrink:
 * the caller (web autofit controller) passes the gesture's BASE snapshot plus
 * a target rowSpan, so reconcile(base, target) = pushResize(base, growerId,
 * target). It is the caller's job to re-derive from the base snapshot every
 * reconcile — pushResize keeps no journal and applies no clamp.
 *
 * NEVER calls applyGravity: gravity is suspended within the atomic autofit
 * gesture. The COMMIT RULE (page-level applyGravity once on gesture commit when
 * net rowSpan delta != 0 and gravity is ON) lives in the web controller, not
 * here. `opts` is accepted for signature parity with sibling ops; the gravity
 * field is intentionally not consulted by the layout pass.
 *
 * Guards via isRegionInBounds: newRowSpan must be an integer >= 1 with valid
 * col/colSpan, else { ok:false } ('invalid span' / 'out of bounds'). Vertical
 * space is unbounded so grow never fails for lack of room. Pure: returns a new
 * GridState; never mutates the input (invariant 6). Leaf-preserving (invariant
 * 7): only `row` and the grower's `rowSpan` change; col/colSpan/kind/id never.
 */
export function pushResize(
  state: GridState,
  id: string,
  newRowSpan: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _opts?: OpOptions,
): OpResult {
  const grower = state.blocks.find((b) => b.id === id);
  if (!grower) return { ok: false, error: `no such block: ${id}` };
  if (!Number.isInteger(newRowSpan) || newRowSpan < 1) {
    return { ok: false, error: `invalid span: ${describe({ ...grower, rowSpan: newRowSpan })}` };
  }
  const grown: Block = { ...grower, rowSpan: newRowSpan };
  if (!isRegionInBounds(state, grown)) {
    return { ok: false, error: `out of bounds: ${describe(grown)}` };
  }

  // Working copy — never mutate input blocks. Use a Map for O(1) row/rowSpan
  // updates during the displacement pass (avoids repeated full-array scans).
  const blockMap = new Map<string, Block>(
    state.blocks.map((b) => [b.id, b.id === id ? grown : { ...b }]),
  );

  // Top-down displacement via a single-pass sweep repeated until stable.
  // Each pass: sort all blocks top-down (row asc, col asc, id asc), then for
  // each pusher, push every victim whose AABB overlaps it downward by the exact
  // vertical overlap depth. Victims' updated rows are immediately visible to
  // subsequent pushers in the same pass (top-down chain propagation).
  //
  // Complexity: each pass is O(B²) (sort O(B log B) + O(B²) pairwise scan).
  // The re-sort at the start of every pass guarantees convergence: after a pass
  // with no pushes, the layout is stable and the loop exits. Empirically this
  // converges in ≤ 2 passes over 20k random layouts — the common linear-stack
  // pattern resolves in a single pass because blocks enter already sorted by row
  // and each push strictly increases a victim's row, so no pushed block can
  // circle back above its pusher. There is no asserted O(B³) worst case; the
  // MAX_PASSES cap is a safety net far above any realistic cascade depth.
  //
  // Terminates: every push strictly increases a block's row, the grid is
  // vertically unbounded (invariant 2: row ≥ 0, no upper bound), so no block
  // can loop back to a lower row, and each pass reduces the total overlap count.
  const MAX_PASSES = 1_000; // safety cap far above any realistic cascade depth
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const sorted = [...blockMap.values()].sort(
      (a, b) => a.row - b.row || a.col - b.col || (a.id < b.id ? -1 : 1),
    );
    let anyPush = false;
    for (let i = 0; i < sorted.length; i++) {
      const pusher = sorted[i]!;
      for (let j = i + 1; j < sorted.length; j++) {
        const victim = sorted[j]!;
        // Only consider victims that are lower (or same row with higher id).
        // Since sorted is row-asc, victim.row >= pusher.row always here.
        if (!regionsOverlap(pusher, victim)) continue;
        const d = pusher.row + pusher.rowSpan - victim.row;
        if (d > 0) {
          // Push depth is ≥ minimal (transitive same-pass pushes may carry a
          // victim further than the strict minimum), but never < minimal.
          const updated = { ...victim, row: victim.row + d };
          blockMap.set(victim.id, updated);
          // Update sorted[j] in-place so downstream pushers in this pass
          // see the updated row (enables single-pass cascade propagation).
          sorted[j] = updated;
          anyPush = true;
        }
      }
    }
    if (!anyPush) break;
    if (pass === MAX_PASSES - 1) {
      return { ok: false, error: 'pushResize did not terminate' };
    }
  }

  return { ok: true, state: { ...state, blocks: [...blockMap.values()] } };
}

function describe(b: { id?: string } & Region): string {
  return `${b.id ?? '?'} (col=${b.col} row=${b.row} w=${b.colSpan} h=${b.rowSpan})`;
}
