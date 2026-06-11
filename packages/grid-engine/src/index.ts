/**
 * @skb/grid-engine — pure 2D grid layout engine.
 *
 * Per docs/design/grid-redesign-2026-05-11.md.
 *
 * Headless: no React, no CSS, no DOM, no Tiptap, no ProseMirror.
 * Just data structures + algorithms for placing AABB rectangles on a
 * 12-col × N-row LEGO baseplate without overlap.
 *
 * Pure functions: input state in, output state out. Caller (e.g.
 * editor-shell) owns the state and renders it.
 */
export type {
  Block,
  BlockKind,
  BlockSize,
  DropIntent,
  GridState,
  Occupancy,
  OpResult,
  Region,
  ValidationResult,
} from './types';

export { TOTAL_COLS } from './defaults';

export { buildOccupancy, createEmptyState, totalRows } from './occupancy';

export {
  findCollidingBlocks,
  isRegionEmpty,
  isRegionInBounds,
  regionsOverlap,
} from './collision';

export { applyGravity, canRise } from './gravity';

export {
  deleteBlock,
  insertBlock,
  moveBlock,
  resizeBlock,
  transformBlock,
  type OpOptions,
} from './ops';

export { inferDropIntent, maxEmptyRectAt, maxEmptyRectContaining } from './intent';

export { validateState, type ValidateOptions } from './validate';
