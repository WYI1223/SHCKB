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

  // Working copy — never mutate input blocks.
  let blocks: Block[] = state.blocks.map((b) =>
    b.id === id ? grown : { ...b },
  );

  // Top-down displacement. Each iteration finds the single highest pusher that
  // overlaps a lower (or id-tie) pushee and shoves the pushee down by the exact
  // overlap depth. Deterministic order: row asc, then col asc, then id asc.
  // Terminates: every move strictly increases a block's row, the grid is
  // vertically unbounded, and no move ever decreases a row.
  const MAX_PUSHES = 100_000; // safety cap; real cascades are O(B)
  for (let guard = 0; ; guard++) {
    if (guard > MAX_PUSHES) {
      return { ok: false, error: 'pushResize did not terminate' };
    }
    const sorted = [...blocks].sort(
      (a, b) => a.row - b.row || a.col - b.col || (a.id < b.id ? -1 : 1),
    );
    let pusheeId: string | null = null;
    let depth = 0;
    outer: for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]!;
      for (let j = 0; j < sorted.length; j++) {
        if (i === j) continue;
        const b = sorted[j]!;
        if (!regionsOverlap(a, b)) continue;
        // pusher = higher top (smaller row); id-tie broken deterministically.
        const aIsPusher = a.row < b.row || (a.row === b.row && a.id < b.id);
        const pusher = aIsPusher ? a : b;
        const pushee = aIsPusher ? b : a;
        const d = pusher.row + pusher.rowSpan - pushee.row;
        if (d > 0) {
          pusheeId = pushee.id;
          depth = d;
          break outer;
        }
      }
    }
    if (pusheeId === null) break;
    const pid = pusheeId;
    const dy = depth;
    blocks = blocks.map((b) => (b.id === pid ? { ...b, row: b.row + dy } : b));
  }

  return { ok: true, state: { ...state, blocks } };
}

function describe(b: { id?: string } & Region): string {
  return `${b.id ?? '?'} (col=${b.col} row=${b.row} w=${b.colSpan} h=${b.rowSpan})`;
}
