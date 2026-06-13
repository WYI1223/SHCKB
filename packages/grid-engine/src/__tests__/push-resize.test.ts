/**
 * Tests for pushResize — the autofit "limited-height + grow" engine op.
 *
 * pushResize(state, id, newRowSpan, opts?) sets block.rowSpan = newRowSpan and
 * pushes every AABB-colliding block DOWN by exactly the vertical overlap depth,
 * recursing top-down. It NEVER calls applyGravity (gravity is suspended within
 * the autofit gesture; the web controller re-derives from a base snapshot).
 *
 * vitest has NO globals and does NOT auto-cleanup — these are pure-function
 * tests so no afterEach(cleanup) is needed (no DOM).
 */
import { describe, expect, test } from 'vitest';
import {
  type GridState,
  createEmptyState,
  insertBlock,
  pushResize,
  validateState,
} from '../index';
import { buildStack } from './helpers';

/** Stable string snapshot of a layout for exact-equality assertions. */
function norm(s: GridState): string {
  return [...s.blocks]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((b) => `${b.id}:${b.col},${b.row},${b.colSpan},${b.rowSpan}`)
    .join('|');
}

describe('pushResize: basic grow pushes colliders down by overlap depth', () => {
  test('grow top block pushes the block directly below down', () => {
    let s = createEmptyState(12);
    const r1 = insertBlock(s, {
      id: 'A',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error('seed A');
    s = r1.state;
    const r2 = insertBlock(s, {
      id: 'B',
      col: 0,
      row: 1,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r2.ok) throw new Error('seed B');
    s = r2.state;

    const r = pushResize(s, 'A', 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.blocks.find((b) => b.id === 'A')!.rowSpan).toBe(3);
    // A now spans rows 0-2; B was at row 1, overlap depth = (0+3)-1 = 2 → row 3.
    expect(r.state.blocks.find((b) => b.id === 'B')!.row).toBe(3);
    // gravity-off result is still a legal no-overlap layout
    expect(validateState(r.state, { gravity: false }).ok).toBe(true);
  });

  test('grow with no block below is a pure rowSpan change (no displacement)', () => {
    let s = createEmptyState(12);
    const r1 = insertBlock(s, {
      id: 'A',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error('seed A');
    s = r1.state;
    // disjoint neighbor in a different column at row 0 — must NOT move
    const r2 = insertBlock(s, {
      id: 'N',
      col: 6,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r2.ok) throw new Error('seed N');
    s = r2.state;

    const r = pushResize(s, 'A', 4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.blocks.find((b) => b.id === 'A')!.rowSpan).toBe(4);
    expect(r.state.blocks.find((b) => b.id === 'N')!.row).toBe(0);
  });

  test('does NOT mutate the input state (purity, invariant 6)', () => {
    let s = createEmptyState(12);
    const r1 = insertBlock(s, {
      id: 'A',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error('seed A');
    s = r1.state;
    const r2 = insertBlock(s, {
      id: 'B',
      col: 0,
      row: 1,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r2.ok) throw new Error('seed B');
    s = r2.state;
    const before = norm(s);

    const r = pushResize(s, 'A', 3);
    expect(r.ok).toBe(true);
    // input snapshot unchanged after the op returned a new state
    expect(norm(s)).toBe(before);
  });

  test('does NOT run gravity: a floating sibling stays floating', () => {
    // gravity-off-style fixture (build by hand; insert+gravity would snap N up).
    const blocks: Block[] = [
      { id: 'A', col: 0, row: 0, colSpan: 6, rowSpan: 1, kind: 'markdown' },
      { id: 'B', col: 0, row: 1, colSpan: 6, rowSpan: 1, kind: 'markdown' },
      // N is disjoint AND floating (row 5, col 6-11) — pushResize must not lift it.
      { id: 'N', col: 6, row: 5, colSpan: 6, rowSpan: 1, kind: 'markdown' },
    ];
    const s: GridState = { blocks, totalCols: 12 };
    const r = pushResize(s, 'A', 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.blocks.find((b) => b.id === 'N')!.row).toBe(5);
  });
});

describe('pushResize: input guards via isRegionInBounds (engine, not caller)', () => {
  function seedOne(): GridState {
    const r = insertBlock(createEmptyState(12), {
      id: 'A',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 2,
      kind: 'markdown',
    });
    if (!r.ok) throw new Error('seed A');
    return r.state;
  }

  test('newRowSpan = 0 rejected (invalid span), state unchanged', () => {
    const s = seedOne();
    const before = norm(s);
    const r = pushResize(s, 'A', 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('invalid span');
    expect(norm(s)).toBe(before);
  });

  test('newRowSpan = -3 rejected (invalid span)', () => {
    const r = pushResize(seedOne(), 'A', -3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('invalid span');
  });

  test('non-integer newRowSpan (2.5) rejected (invalid span), state unchanged', () => {
    const s = seedOne();
    const before = norm(s);
    const r = pushResize(s, 'A', 2.5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('invalid span');
    expect(norm(s)).toBe(before);
  });

  test('unknown id rejected (no such block) — aligns with sibling ops', () => {
    const r = pushResize(seedOne(), 'ghost', 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('no such block');
  });
});

describe('pushResize: named reversibility fixtures (C5 re-push from base)', () => {
  /**
   * Reconcile-from-base round trip:
   *   grown = pushResize(base, id, target)
   *   restored = pushResize(base, id, origRowSpan)   // SAME base, not grown
   * Asserts restored === base exactly, AND every id in `frozen` kept its row
   * (disjoint columns must never leapfrog).
   */
  function assertReversible(
    base: GridState,
    id: string,
    target: number,
    frozen: string[],
  ): void {
    const orig = base.blocks.find((b) => b.id === id)!.rowSpan;
    const baseN = norm(base);

    const grown = pushResize(base, id, target);
    expect(grown.ok).toBe(true);
    if (!grown.ok) return;
    expect(grown.state.blocks.find((b) => b.id === id)!.rowSpan).toBe(target);
    expect(validateState(grown.state, { gravity: false }).ok).toBe(true);

    // disjoint-column blocks must not have moved in the grown layout
    for (const fid of frozen) {
      expect(grown.state.blocks.find((b) => b.id === fid)!.row).toBe(
        base.blocks.find((b) => b.id === fid)!.row,
      );
    }

    // re-push from BASE back to original span → exact return to base
    const restored = pushResize(base, id, orig);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(norm(restored.state)).toBe(baseN);
  }

  test('G/W/K bridge: grow G, W bridges down, K (shares W cols) reverses cleanly', () => {
    // G{c0-1,r0,h1} W{c0-5,r1,h1} K{c4-5,r2,h1}. K shares columns with the
    // bridge W, so K is NOT disjoint; nothing here is frozen-disjoint.
    const base: GridState = {
      blocks: [
        { id: 'G', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind: 'markdown' },
        { id: 'W', col: 0, row: 1, colSpan: 6, rowSpan: 1, kind: 'markdown' },
        { id: 'K', col: 4, row: 2, colSpan: 2, rowSpan: 1, kind: 'markdown' },
      ],
      totalCols: 12,
    };
    assertReversible(base, 'G', 3, []);
  });

  test('double bridge: two stacked bridges over the grower column', () => {
    const base: GridState = {
      blocks: [
        { id: 'G', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind: 'markdown' },
        { id: 'W1', col: 0, row: 1, colSpan: 6, rowSpan: 1, kind: 'markdown' },
        { id: 'W2', col: 0, row: 2, colSpan: 8, rowSpan: 1, kind: 'markdown' },
        { id: 'K', col: 6, row: 3, colSpan: 2, rowSpan: 1, kind: 'markdown' },
      ],
      totalCols: 12,
    };
    assertReversible(base, 'G', 4, []);
  });

  test('full-width stack: every block shares all columns; cascade then reverse', () => {
    const base: GridState = {
      blocks: [
        { id: 'A', col: 0, row: 0, colSpan: 12, rowSpan: 1, kind: 'markdown' },
        { id: 'B', col: 0, row: 1, colSpan: 12, rowSpan: 1, kind: 'markdown' },
        { id: 'C', col: 0, row: 2, colSpan: 12, rowSpan: 1, kind: 'markdown' },
      ],
      totalCols: 12,
    };
    assertReversible(base, 'A', 3, []);
  });

  test('disjoint columns: right-column block R never moves', () => {
    // L{c0-2} grows; R{c6-8} shares no column with L → frozen.
    const base: GridState = {
      blocks: [
        { id: 'L', col: 0, row: 0, colSpan: 3, rowSpan: 1, kind: 'markdown' },
        { id: 'L2', col: 0, row: 1, colSpan: 3, rowSpan: 1, kind: 'markdown' },
        { id: 'R', col: 6, row: 0, colSpan: 3, rowSpan: 5, kind: 'markdown' },
      ],
      totalCols: 12,
    };
    assertReversible(base, 'L', 3, ['R']);
  });

  test('same-column cascade: A pushes B,C,D in one column', () => {
    const base: GridState = {
      blocks: [
        { id: 'A', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind: 'markdown' },
        { id: 'B', col: 0, row: 1, colSpan: 2, rowSpan: 1, kind: 'markdown' },
        { id: 'C', col: 0, row: 2, colSpan: 2, rowSpan: 1, kind: 'markdown' },
        { id: 'D', col: 0, row: 3, colSpan: 2, rowSpan: 1, kind: 'markdown' },
      ],
      totalCols: 12,
    };
    assertReversible(base, 'A', 4, []);
  });

  test('gravity-off + autofit-shrink: shrink from base recovers space, no lift', () => {
    // Start from a grown layout's base, shrink the grower below original.
    // pushResize is gravity-agnostic, so shrinking just re-derives from base:
    // the disjoint block stays put and nothing is pulled up.
    const base: GridState = {
      blocks: [
        { id: 'A', col: 0, row: 0, colSpan: 6, rowSpan: 4, kind: 'markdown' },
        { id: 'B', col: 0, row: 4, colSpan: 6, rowSpan: 1, kind: 'markdown' },
        { id: 'R', col: 6, row: 0, colSpan: 6, rowSpan: 1, kind: 'markdown' },
      ],
      totalCols: 12,
    };
    // shrink A 4 -> 2: B does NOT rise (no gravity); A just occupies less.
    const shrunk = pushResize(base, 'A', 2);
    expect(shrunk.ok).toBe(true);
    if (!shrunk.ok) return;
    expect(shrunk.state.blocks.find((b) => b.id === 'A')!.rowSpan).toBe(2);
    expect(shrunk.state.blocks.find((b) => b.id === 'B')!.row).toBe(4); // unmoved
    expect(shrunk.state.blocks.find((b) => b.id === 'R')!.row).toBe(0); // disjoint, unmoved
    expect(validateState(shrunk.state, { gravity: false }).ok).toBe(true);
    // and grow-then-shrink-from-base round trip back to base
    assertReversible(base, 'A', 6, ['R']);
  });
});

describe('pushResize: determinism + termination', () => {
  test('two identical calls produce identical output (deterministic)', () => {
    const s = buildStack(200, 12);
    const a = pushResize(s, 'b0', 5);
    const b = pushResize(s, 'b0', 5);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(norm(a.state)).toBe(norm(b.state));
  });

  test('terminates on a deep same-column cascade (B=300) and stays no-overlap', () => {
    const s = buildStack(300, 12);
    const r = pushResize(s, 'b0', 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // b0 grew to 10 rows; every block below cascaded down, no overlap.
    expect(r.state.blocks.find((b) => b.id === 'b0')!.rowSpan).toBe(10);
    expect(validateState(r.state, { gravity: false }).ok).toBe(true);
    // each pushed block's row strictly increased (push-down only, never up)
    for (let i = 1; i < 300; i++) {
      const before = s.blocks.find((b) => b.id === `b${i}`)!.row;
      const after = r.state.blocks.find((b) => b.id === `b${i}`)!.row;
      expect(after).toBeGreaterThanOrEqual(before);
    }
  });

  test('idempotent re-apply: pushResize to the same target twice = once', () => {
    const s = buildStack(50, 12);
    const once = pushResize(s, 'b0', 6);
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const twice = pushResize(once.state, 'b0', 6);
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(norm(twice.state)).toBe(norm(once.state));
  });
});
