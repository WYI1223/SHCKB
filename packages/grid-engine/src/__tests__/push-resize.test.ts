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
  type Block,
  type GridState,
  createEmptyState,
  insertBlock,
  pushResize,
  validateState,
} from '../index';

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
