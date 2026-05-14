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
import { findCollidingBlocks, isRegionInBounds } from './collision';
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

function describe(b: { id?: string } & Region): string {
  return `${b.id ?? '?'} (col=${b.col} row=${b.row} w=${b.colSpan} h=${b.rowSpan})`;
}
