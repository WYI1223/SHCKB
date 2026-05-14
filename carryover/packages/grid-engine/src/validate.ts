/**
 * @skb/grid-engine — state invariant validation.
 *
 * Validates: in bounds + no overlap + unique ids + valid spans. Use in
 * tests + dev-mode debug assertions; production code can skip after
 * each ops.ts mutation since ops always produce valid state.
 */
import { isRegionInBounds, regionsOverlap } from './collision';
import type { GridState, ValidationResult } from './types';

export function validateState(state: GridState): ValidationResult {
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
