/**
 * Tests for the 3 user-feedback fixes (2026-05-11):
 * 1. Hole-fill uses maxEmptyRectContaining (hole-bound rect), not cursor-anchored
 * 2. transformBlock for atomic left/top-edge resize
 * 3. { gravity: false } option for no-gravity free-placement mode
 */
import { describe, expect, test } from 'vitest';
import {
  type Block,
  createEmptyState,
  deleteBlock,
  inferDropIntent,
  insertBlock,
  maxEmptyRectContaining,
  resizeBlock,
  transformBlock,
} from '../index';

describe('hole-fill via maxEmptyRectContaining (NOT cursor-anchored)', () => {
  test('cursor in MIDDLE of empty hole → rect covers whole hole, not just cursor→right+down', () => {
    // Set up a 12-col grid with one 12×4 block at row 0-3 (top wall).
    // Below: a fully-empty area. Cursor at (col=5, row=8).
    // OLD behavior: rect was (5,8) → (11,11) i.e. 7×4. We placed there.
    // NEW behavior: maxEmptyRectContaining should find a 12×∞ empty rect.
    // Clamped by image's default (6×4), best rect = 6×4 centered around cursor.
    let s = createEmptyState(12);
    const r = insertBlock(s, {
      id: 'topwall',
      col: 0,
      row: 0,
      colSpan: 12,
      rowSpan: 4,
      kind: 'image',
    });
    if (!r.ok) throw new Error();
    s = r.state;
    const intent = inferDropIntent(s, 5, 8, { colSpan: 6, rowSpan: 4 });
    expect(intent.intent).toBe('place');
    expect(intent.colSpan).toBe(6); // proposed w
    expect(intent.rowSpan).toBe(4); // proposed h
    // Anchor row should be ≤ cursor.row (rect contains cursor)
    expect(intent.row).toBeLessThanOrEqual(8);
    expect(intent.row + intent.rowSpan).toBeGreaterThan(8);
    // Anchor col similar
    expect(intent.col).toBeLessThanOrEqual(5);
    expect(intent.col + intent.colSpan).toBeGreaterThan(5);
  });

  test('cursor in top-left of 4-col-wide hole bounded right by a block → rect width is hole width, not extending right', () => {
    let s = createEmptyState(12);
    // Wall on right side: col 4-11, row 0-4
    const r = insertBlock(s, {
      id: 'rightwall',
      col: 4,
      row: 0,
      colSpan: 8,
      rowSpan: 5,
      kind: 'image',
    });
    if (!r.ok) throw new Error();
    s = r.state;
    // Cursor at (0, 0) — hole is cols 0-3, rows 0-4 = 4×5 area
    const intent = inferDropIntent(s, 0, 0, { colSpan: 12, rowSpan: 1 });
    expect(intent.intent).toBe('place');
    // proposed 12×1; clamped to hole's 4 wide.
    expect(intent.colSpan).toBe(4);
    expect(intent.col).toBe(0);
  });

  test('maxEmptyRectContaining returns null when cursor on occupied', () => {
    let s = createEmptyState(12);
    const r = insertBlock(s, {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 4,
      rowSpan: 2,
      kind: 'image',
    });
    if (!r.ok) throw new Error();
    s = r.state;
    expect(maxEmptyRectContaining(s, 1, 1, 6, 6)).toBeNull();
  });
});

describe('transformBlock atomic move+resize', () => {
  test('left-edge resize: col decreases, colSpan increases atomically', () => {
    let s = createEmptyState(12);
    // Place block at (5, 0, 4, 1)
    const r1 = insertBlock(s, {
      id: 'a',
      col: 5,
      row: 0,
      colSpan: 4,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error();
    s = r1.state;
    // User drags left edge 3 cells to the left: col=2, colSpan=7
    const r2 = transformBlock(s, 'a', { col: 2, colSpan: 7 });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      const b = r2.state.blocks.find((x) => x.id === 'a')!;
      expect(b.col).toBe(2);
      expect(b.colSpan).toBe(7);
    }
  });

  test('left-edge resize rejected if would overlap neighbor', () => {
    let s = createEmptyState(12);
    const r1 = insertBlock(s, {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 3,
      rowSpan: 1,
      kind: 'image',
    });
    if (!r1.ok) throw new Error();
    s = r1.state;
    const r2 = insertBlock(s, {
      id: 'b',
      col: 5,
      row: 0,
      colSpan: 3,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r2.ok) throw new Error();
    s = r2.state;
    // Try to left-edge-resize b: col=2, colSpan=6 — would overlap a (col 0-2)
    const r3 = transformBlock(s, 'b', { col: 2, colSpan: 6 });
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.error).toContain('a');
  });
});

describe('{ gravity: false } skips Option A invariant', () => {
  test('insertBlock with gravity: false leaves block at user position', () => {
    const s = createEmptyState(12);
    const r = insertBlock(
      s,
      { id: 'x', col: 5, row: 10, colSpan: 1, rowSpan: 1, kind: 'markdown' },
      { gravity: false },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.blocks[0]!.row).toBe(10);
    }
  });

  test('deleteBlock with gravity: false leaves rest static', () => {
    const blocks: Block[] = [
      { id: 'A', col: 0, row: 0, colSpan: 2, rowSpan: 2, kind: 'markdown' },
      { id: 'B', col: 0, row: 5, colSpan: 2, rowSpan: 2, kind: 'image' },
    ];
    const s = { blocks, totalCols: 12 };
    const after = deleteBlock(s, 'A', { gravity: false });
    // B should NOT rise
    expect(after.blocks.find((b) => b.id === 'B')!.row).toBe(5);
  });

  test('resizeBlock shrink with gravity: false does not lift others', () => {
    let s = createEmptyState(12);
    const r1 = insertBlock(s, {
      id: 'A',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 4,
      kind: 'image',
    });
    if (!r1.ok) throw new Error();
    s = r1.state;
    const r2 = insertBlock(s, {
      id: 'B',
      col: 0,
      row: 5,
      colSpan: 3,
      rowSpan: 1,
      kind: 'callout',
    });
    if (!r2.ok) throw new Error();
    s = r2.state;
    const bRowBefore = s.blocks.find((b) => b.id === 'B')!.row;
    const r3 = resizeBlock(s, 'A', 6, 2, { gravity: false });
    expect(r3.ok).toBe(true);
    if (r3.ok) {
      // B's row should NOT change when gravity: false (even though A shrunk)
      expect(r3.state.blocks.find((b) => b.id === 'B')!.row).toBe(bRowBefore);
    }
  });

  test('default (no options) preserves Option A: gravity runs', () => {
    const s = createEmptyState(12);
    const r = insertBlock(s, {
      id: 'x',
      col: 5,
      row: 10,
      colSpan: 1,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r.ok) throw new Error();
    expect(r.state.blocks[0]!.row).toBe(0); // gravity pulled to top
  });
});
