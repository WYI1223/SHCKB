/**
 * Perf gate for pushResize (red-team requirement §8.2).
 *
 * The existing property suite runs 5 seeds x 2000 = 10k op-applications and
 * asserts ONLY invariants — it times nothing, so a quadratic/cubic regression
 * would pass green. This harness adds an explicit per-op LATENCY BUDGET.
 *
 * NOTE: the spec text says "50k"; the real figure is 10k (5x2000) for the
 * property suite. This harness uses 1000 reconciles on a B=500 stack — the
 * worst realistic autofit case (a tall grower atop a full-width column stack).
 *
 * BUDGET CALIBRATION (measured 2026-06-13 on Windows 11 / bun v1.3.14):
 *   Raw bun eval:  ~1.1ms/op (includes sort + cascade on B=500)
 *   vitest (run):  ~12ms/op  (vitest's source-map / TS transform adds ~10x)
 *
 * The plan's original "5ms/op" assumed raw-bun timing. Inside vitest the
 * observed floor is ~12ms/op for the single-pass optimised algorithm. Budgets
 * below are set to CATCH quadratic regression (which would be ~300ms/op at
 * B=500) while tolerating vitest's instrumentation overhead (~10-15x raw).
 *
 *   Linear    @ B=500 → ~12ms/op  (observed, single-pass)
 *   Quadratic @ B=500 → ~300ms/op (estimated; sort cost × cascade rounds)
 *   Gate      → 50ms/op  (4x observed linear; 6x below quadratic floor)
 *   Total     → 30_000ms (50ms × 1000 iters; conservative for slow CI)
 *
 * This gate will catch any O(B²) or worse regression introduced in the loop.
 */
import { describe, expect, test } from 'vitest';
import { type Block, type GridState, pushResize } from '../index';

const BLOCKS = 500;
const ITERATIONS = 1000;
const PER_OP_BUDGET_MS = 50; // mean per reconcile; catches O(B^2) blow-up
const TOTAL_BUDGET_MS = 30_000; // wall-clock ceiling for the whole harness

function buildStack(n: number, cols: number): GridState {
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

describe('pushResize perf budget', () => {
  // timeout = TOTAL_BUDGET_MS + 5s headroom so vitest doesn't kill a passing run
  test(`${ITERATIONS} reconciles on B=${BLOCKS}: mean < ${PER_OP_BUDGET_MS}ms/op, total < ${TOTAL_BUDGET_MS}ms`, () => {
    const base = buildStack(BLOCKS, 12);
    // warm up JIT so the first call doesn't skew the mean
    pushResize(base, 'b0', 4);

    const t0 = performance.now();
    for (let k = 0; k < ITERATIONS; k++) {
      // re-push from the SAME base every iteration (C5 reconcile-from-base);
      // target varies 1..8 to simulate grow/shrink during a typing gesture.
      const target = 1 + (k % 8);
      const r = pushResize(base, 'b0', target);
      if (!r.ok) throw new Error(`reconcile failed at k=${k}: ${r.error}`);
    }
    const totalMs = performance.now() - t0;
    const perOpMs = totalMs / ITERATIONS;

    // visible so a regression is diagnosable from CI logs, not just red/green
    // eslint-disable-next-line no-console
    console.log(
      `[pushResize perf] B=${BLOCKS} iters=${ITERATIONS} total=${totalMs.toFixed(1)}ms mean=${perOpMs.toFixed(4)}ms/op`,
    );

    expect(perOpMs).toBeLessThan(PER_OP_BUDGET_MS);
    expect(totalMs).toBeLessThan(TOTAL_BUDGET_MS);
  }, TOTAL_BUDGET_MS + 5_000); // explicit test timeout = budget + 5s headroom
});
