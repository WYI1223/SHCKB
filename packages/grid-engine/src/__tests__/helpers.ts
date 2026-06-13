/**
 * Shared test helpers for grid-engine unit + perf suites.
 * Keep this pure — no vitest imports, no side effects.
 */
import type { Block, GridState } from '../index';

/**
 * Build a tightly-packed single-column stack of `n` blocks, each spanning
 * `cols` columns and 1 row. Useful for cascade + perf tests.
 */
export function buildStack(n: number, cols: number): GridState {
  const blocks: Block[] = [];
  for (let i = 0; i < n; i++) {
    blocks.push({
      id: `b${i}`,
      col: 0,
      row: i,
      colSpan: cols,
      rowSpan: 1,
      kind: 'markdown',
    });
  }
  return { blocks, totalCols: cols };
}
