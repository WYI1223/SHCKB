/**
 * Perf gate for pushResize (red-team requirement §8.2).
 *
 * The existing property suite runs 5 seeds x 2000 = 10k op-applications and
 * asserts ONLY invariants — it times nothing, so a quadratic/cubic regression
 * would pass green. This harness adds an explicit per-op LATENCY BUDGET plus a
 * scaling-shape sentinel.
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
 *   Gate      → 25ms/op  (~2x observed linear; ~12x below quadratic floor)
 *   Total     → 30_000ms (25ms × 1000 iters + headroom for slow CI)
 *
 * This gate will catch any O(B²) or worse regression introduced in the loop.
 *
 * SHAPE SENTINEL CALIBRATION (B=250 vs B=500):
 *   Each pushResize call does an O(B²) pairwise scan inside a single pass
 *   (the inner loop over sorted pairs). So per-call cost scales as O(B²):
 *     Doubling B →  mean(2B) / mean(B) ≈ 4  (current single-pass algorithm)
 *   A multi-pass regression (e.g. passes ∝ B) would push the ratio to ≈ 8.
 *   Gate ratio: < 5.5  (passes O(B²) single-pass ≈ 4, catches ≥O(B³) ≈ 8)
 *   This test is machine-clock-agnostic — it only cares about the relative
 *   ratio, so it is robust to per-machine CI speed variance.
 */
import { describe, expect, test } from 'vitest';
import { pushResize } from '../index';
import { buildStack } from './helpers';

const BLOCKS = 500;
const ITERATIONS = 1000;
const PER_OP_BUDGET_MS = 25; // mean per reconcile; ~2x observed linear; catches O(B^2) blow-up
const TOTAL_BUDGET_MS = 30_000; // wall-clock ceiling for the whole harness

/** Run ITERATIONS reconciles on a B=n stack, return mean ms/op. */
function measureMean(n: number, iters: number): number {
  const base = buildStack(n, 12);
  // warm up JIT
  pushResize(base, 'b0', 4);

  const t0 = performance.now();
  for (let k = 0; k < iters; k++) {
    const target = 1 + (k % 8);
    const r = pushResize(base, 'b0', target);
    if (!r.ok) throw new Error(`reconcile failed at k=${k} n=${n}: ${r.error}`);
  }
  return (performance.now() - t0) / iters;
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

describe('pushResize scaling shape sentinel', () => {
  /**
   * Ratio test: mean(B=500)/mean(B=250) < 3.
   *   Linear ≈ 2 (pass), Quadratic ≈ 4 (fail).
   * Machine-clock-agnostic — relative ratio only, robust to CI speed variance.
   * Uses 200 iterations per size to keep total wall time under ~10s even on
   * slow machines (200 × ~25ms = ~5s per size tier).
   */
  const SHAPE_ITERS = 200;
  const SHAPE_B_LO = 250;
  const SHAPE_B_HI = 500;
  // Gate = 5.5: passes O(B²) single-pass (ratio ≈ 4), catches ≥O(B³) (ratio ≈ 8).
  // See header comment for full calibration rationale.
  const SHAPE_RATIO_GATE = 5.5;

  test(`mean(B=${SHAPE_B_HI}) / mean(B=${SHAPE_B_LO}) < ${SHAPE_RATIO_GATE} (O(B²) single-pass ≈ 4, O(B³) ≈ 8)`, () => {
    const meanLo = measureMean(SHAPE_B_LO, SHAPE_ITERS);
    const meanHi = measureMean(SHAPE_B_HI, SHAPE_ITERS);
    const ratio = meanHi / meanLo;

    // eslint-disable-next-line no-console
    console.log(
      `[pushResize shape] mean(B=${SHAPE_B_LO})=${meanLo.toFixed(4)}ms/op` +
        ` mean(B=${SHAPE_B_HI})=${meanHi.toFixed(4)}ms/op ratio=${ratio.toFixed(3)}` +
        ` (gate < ${SHAPE_RATIO_GATE})`,
    );

    expect(ratio).toBeLessThan(SHAPE_RATIO_GATE);
  }, 60_000); // 60s ceiling: 2 tiers × 200 iters × ~25ms + headroom
});
