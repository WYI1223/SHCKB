/**
 * @skb/grid-engine — state invariant validation.
 *
 * Validates: in bounds + no overlap + unique ids + valid spans, plus
 * gravity stability when gravity is enabled (default). A page with the
 * author-facing gravity toggle OFF legally persists floating blocks —
 * callers pass { gravity: false } to skip the stability check.
 *
 * Use in tests, dev-mode debug assertions, and server-side re-validation
 * before persisting a client-supplied working state.
 */
import { isRegionInBounds, regionsOverlap } from './collision';
import { canRise } from './gravity';
import type { GridState, ValidationResult } from './types';

export type ValidateOptions = {
  /** When false, skip the gravity-stability check. Default true. */
  gravity?: boolean;
};

export function validateState(
  state: GridState,
  opts: ValidateOptions = {},
): ValidationResult {
  const errors: string[] = [];
  // 1. spans + bounds
  for (const b of state.blocks) {
    if (b.colSpan < 1 || b.rowSpan < 1) {
      errors.push(`invalid span: ${describe(b)}`);
    }
    if (!isRegionInBounds(state, b)) {
      errors.push(`out of bounds: ${describe(b)}`);
    }
  }
  // 2. pairwise overlap
  for (let i = 0; i < state.blocks.length; i++) {
    for (let j = i + 1; j < state.blocks.length; j++) {
      const a = state.blocks[i]!;
      const b = state.blocks[j]!;
      if (regionsOverlap(a, b)) {
        errors.push(`overlap: ${a.id} ↔ ${b.id}`);
      }
    }
  }
  // 3. unique ids
  const ids = new Set<string>();
  for (const b of state.blocks) {
    if (ids.has(b.id)) errors.push(`duplicate id: ${b.id}`);
    ids.add(b.id);
  }
  // 4. gravity stability (only meaningful on an otherwise-valid state)
  if (opts.gravity !== false && errors.length === 0) {
    for (const b of state.blocks) {
      if (canRise(state, b.id)) {
        errors.push(`not gravity-stable: ${describe(b)} can rise`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function describe(b: {
  id: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}): string {
  return `${b.id} (col=${b.col} row=${b.row} w=${b.colSpan} h=${b.rowSpan})`;
}
