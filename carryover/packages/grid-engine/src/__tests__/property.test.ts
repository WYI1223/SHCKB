/**
 * Property-based test: random op sequences must preserve no-overlap
 * invariant. Replicates the prototype stress runner as a vitest suite.
 */
import { describe, expect, test } from 'vitest';
import {
  type BlockKind,
  type GridState,
  createEmptyState,
  deleteBlock,
  inferDropIntent,
  insertBlock,
  moveBlock,
  resizeBlock,
  validateState,
} from '../index';

const KINDS: BlockKind[] = [
  'markdown',
  'image',
  'code',
  'callout',
  'math',
  'pdf',
  'jupyter',
  'nn-viz',
  'agent-flow',
];

function runRandomOps(iterations: number, seed: number): { ok: boolean; failedAt?: number; failure?: string } {
  // Simple LCG for determinism (vitest doesn't seed Math.random)
  let rng = seed;
  const next = () => {
    rng = (rng * 1664525 + 1013904223) % 2 ** 32;
    return rng / 2 ** 32;
  };
  const pickInt = (n: number) => Math.floor(next() * n);

  let s: GridState = createEmptyState(12);
  for (let i = 0; i < iterations; i++) {
    const op = ['insert', 'move', 'resize', 'delete'][pickInt(4)]!;
    if (op === 'insert' || s.blocks.length === 0) {
      const kind = KINDS[pickInt(KINDS.length)]!;
      const cc = pickInt(s.totalCols);
      const cr = pickInt(12);
      const intent = inferDropIntent(s, cc, cr, kind);
      if (intent.intent === 'place') {
        const r = insertBlock(s, {
          id: `b${i}`,
          col: intent.col,
          row: intent.row,
          colSpan: intent.colSpan,
          rowSpan: intent.rowSpan,
          kind,
        });
        if (r.ok) s = r.state;
      }
    } else if (op === 'delete') {
      const target = s.blocks[pickInt(s.blocks.length)]!;
      s = deleteBlock(s, target.id);
    } else if (op === 'move') {
      const target = s.blocks[pickInt(s.blocks.length)]!;
      const newCol = pickInt(s.totalCols - target.colSpan + 1);
      const newRow = pickInt(12);
      const r = moveBlock(s, target.id, newCol, newRow);
      if (r.ok) s = r.state;
    } else if (op === 'resize') {
      const target = s.blocks[pickInt(s.blocks.length)]!;
      const newW = 1 + pickInt(s.totalCols - target.col);
      const newH = 1 + pickInt(8);
      const r = resizeBlock(s, target.id, newW, newH);
      if (r.ok) s = r.state;
    }
    const v = validateState(s);
    if (!v.ok) {
      return { ok: false, failedAt: i, failure: v.errors.join('; ') };
    }
  }
  return { ok: true };
}

describe('property: no-overlap invariant under random op sequences', () => {
  // 5 deterministic seeds × 2k ops each = 10k random op sequences total.
  // Enough to catch invariant violations without slowing the test suite.
  for (const seed of [42, 137, 8675309, 31337, 9000]) {
    test(`seed ${seed}: 2000 random ops → invariant holds`, () => {
      const r = runRandomOps(2_000, seed);
      if (!r.ok) {
        throw new Error(`failed at iter ${r.failedAt}: ${r.failure}`);
      }
      expect(r.ok).toBe(true);
    });
  }
});
