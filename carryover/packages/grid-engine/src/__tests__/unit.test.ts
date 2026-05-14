/**
 * Unit tests for grid-engine pure functions.
 */
import { describe, expect, test } from 'vitest';
import {
  type Block,
  applyGravity,
  buildOccupancy,
  canRise,
  createEmptyState,
  deleteBlock,
  findCollidingBlocks,
  inferDropIntent,
  insertBlock,
  isRegionEmpty,
  isRegionInBounds,
  maxEmptyRectAt,
  moveBlock,
  regionsOverlap,
  resizeBlock,
  totalRows,
  validateState,
} from '../index';

describe('regionsOverlap', () => {
  test('disjoint regions', () => {
    expect(
      regionsOverlap(
        { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
        { col: 5, row: 5, colSpan: 2, rowSpan: 2 },
      ),
    ).toBe(false);
  });
  test('touching edges (no overlap)', () => {
    expect(
      regionsOverlap(
        { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
        { col: 2, row: 0, colSpan: 2, rowSpan: 2 },
      ),
    ).toBe(false);
  });
  test('overlapping by 1 cell', () => {
    expect(
      regionsOverlap(
        { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
        { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
      ),
    ).toBe(true);
  });
});

describe('isRegionInBounds', () => {
  const state = createEmptyState(12);
  test('in bounds', () => {
    expect(isRegionInBounds(state, { col: 0, row: 0, colSpan: 12, rowSpan: 1 })).toBe(
      true,
    );
  });
  test('col + colSpan > totalCols', () => {
    expect(isRegionInBounds(state, { col: 8, row: 0, colSpan: 6, rowSpan: 1 })).toBe(
      false,
    );
  });
  test('negative col', () => {
    expect(isRegionInBounds(state, { col: -1, row: 0, colSpan: 1, rowSpan: 1 })).toBe(
      false,
    );
  });
  test('zero span', () => {
    expect(isRegionInBounds(state, { col: 0, row: 0, colSpan: 0, rowSpan: 1 })).toBe(
      false,
    );
  });
});

describe('insertBlock', () => {
  test('valid insert', () => {
    const state = createEmptyState(12);
    const r = insertBlock(state, {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.blocks).toHaveLength(1);
  });

  test('rejects overlap', () => {
    const state = createEmptyState(12);
    const r1 = insertBlock(state, {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 2,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error('seed failed');
    const r2 = insertBlock(r1.state, {
      id: 'b',
      col: 3,
      row: 1,
      colSpan: 6,
      rowSpan: 2,
      kind: 'image',
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toContain('a');
  });

  test('rejects duplicate id', () => {
    const state = createEmptyState(12);
    const r1 = insertBlock(state, {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error('seed failed');
    const r2 = insertBlock(r1.state, {
      id: 'a',
      col: 6,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'image',
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toContain('duplicate');
  });

  test('Option A: insert at floating row auto-snaps to row 0', () => {
    const state = createEmptyState(12);
    const r = insertBlock(state, {
      id: 'x',
      col: 5,
      row: 10,
      colSpan: 1,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r.ok) throw new Error('insert failed');
    expect(r.state.blocks[0]!.row).toBe(0);
  });
});

describe('moveBlock', () => {
  test('valid move', () => {
    const r1 = insertBlock(createEmptyState(12), {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 1,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error();
    const r2 = moveBlock(r1.state, 'a', 5, 0);
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.state.blocks[0]!.col).toBe(5);
  });
  test('rejects move to occupied', () => {
    let s = createEmptyState(12);
    const r1 = insertBlock(s, {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 1,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error();
    s = r1.state;
    const r2 = insertBlock(s, {
      id: 'b',
      col: 5,
      row: 0,
      colSpan: 1,
      rowSpan: 1,
      kind: 'image',
    });
    if (!r2.ok) throw new Error();
    s = r2.state;
    const r3 = moveBlock(s, 'a', 5, 0);
    expect(r3.ok).toBe(false);
  });
});

describe('resizeBlock', () => {
  test('valid resize', () => {
    const r1 = insertBlock(createEmptyState(12), {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error();
    const r2 = resizeBlock(r1.state, 'a', 12, 1);
    expect(r2.ok).toBe(true);
  });
  test('rejects resize into neighbor (cf-20d gap)', () => {
    let s = createEmptyState(12);
    const r1 = insertBlock(s, {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error();
    s = r1.state;
    const r2 = insertBlock(s, {
      id: 'b',
      col: 6,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'image',
    });
    if (!r2.ok) throw new Error();
    s = r2.state;
    const r3 = resizeBlock(s, 'a', 9, 1);
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.error).toContain('b');
  });
});

describe('deleteBlock + gravity', () => {
  test('user design-doc example: delete C → D rises by 1', () => {
    const blocks: Block[] = [
      { id: 'A', col: 0, row: 0, colSpan: 2, rowSpan: 2, kind: 'markdown' },
      { id: 'B', col: 2, row: 0, colSpan: 1, rowSpan: 3, kind: 'image' },
      { id: 'C', col: 0, row: 2, colSpan: 2, rowSpan: 2, kind: 'code' },
      { id: 'D', col: 0, row: 4, colSpan: 3, rowSpan: 1, kind: 'callout' },
    ];
    const state = { blocks, totalCols: 3 };
    const after = deleteBlock(state, 'C');
    expect(after.blocks.find((b) => b.id === 'A')!.row).toBe(0);
    expect(after.blocks.find((b) => b.id === 'B')!.row).toBe(0);
    expect(after.blocks.find((b) => b.id === 'D')!.row).toBe(3);
  });
});

describe('inferDropIntent', () => {
  test('place in empty area', () => {
    const r = inferDropIntent(createEmptyState(12), 0, 0, 'markdown');
    expect(r.intent).toBe('place');
  });
  test('reject on occupied cell', () => {
    const r1 = insertBlock(createEmptyState(12), {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 2,
      kind: 'image',
    });
    if (!r1.ok) throw new Error();
    const r = inferDropIntent(r1.state, 2, 0, 'markdown');
    expect(r.intent).toBe('reject');
  });
  test('hole-fill shrink-to-fit', () => {
    let s = createEmptyState(12);
    const r1 = insertBlock(s, {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 12,
      rowSpan: 4,
      kind: 'image',
    });
    if (!r1.ok) throw new Error();
    s = r1.state;
    const r2 = insertBlock(s, {
      id: 'x',
      col: 0,
      row: 4,
      colSpan: 7,
      rowSpan: 4,
      kind: 'code',
    });
    if (!r2.ok) throw new Error();
    s = r2.state;
    // image default 6×4; cursor at col=7 row=4; only 5 cols (12-7) wide
    const intent = inferDropIntent(s, 7, 4, 'image');
    expect(intent.intent).toBe('place');
    expect(intent.colSpan).toBe(5);
    expect(intent.rowSpan).toBe(4);
  });
});

describe('validateState', () => {
  test('empty state is valid', () => {
    expect(validateState(createEmptyState(12)).ok).toBe(true);
  });
  test('catches overlap', () => {
    const state = {
      blocks: [
        { id: 'a', col: 0, row: 0, colSpan: 5, rowSpan: 5, kind: 'markdown' as const },
        { id: 'b', col: 2, row: 2, colSpan: 5, rowSpan: 5, kind: 'image' as const },
      ],
      totalCols: 12,
    };
    const v = validateState(state);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('overlap'))).toBe(true);
  });
});

describe('totalRows + buildOccupancy', () => {
  test('empty state → 1 row', () => {
    expect(totalRows(createEmptyState(12))).toBe(1);
  });
  test('matrix shape matches', () => {
    const r1 = insertBlock(createEmptyState(12), {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 3,
      rowSpan: 2,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error();
    const occ = buildOccupancy(r1.state);
    expect(occ).toHaveLength(12);
    expect(occ[0]).toHaveLength(2);
    expect(occ[0]![0]).toBe('a');
    expect(occ[5]![0]).toBe(null);
  });
});

describe('canRise', () => {
  test('block at row 0 cannot rise', () => {
    const r1 = insertBlock(createEmptyState(12), {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 1,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error();
    expect(canRise(r1.state, 'a')).toBe(false);
  });
});

describe('isRegionEmpty / findCollidingBlocks', () => {
  test('finds collisions', () => {
    const r1 = insertBlock(createEmptyState(12), {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 5,
      rowSpan: 5,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error();
    expect(
      isRegionEmpty(r1.state, { col: 2, row: 2, colSpan: 1, rowSpan: 1 }),
    ).toBe(false);
    const colliders = findCollidingBlocks(r1.state, {
      col: 2,
      row: 2,
      colSpan: 1,
      rowSpan: 1,
    });
    expect(colliders).toHaveLength(1);
    expect(colliders[0]!.id).toBe('a');
  });
  test('ignoreId works', () => {
    const r1 = insertBlock(createEmptyState(12), {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 5,
      rowSpan: 5,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error();
    expect(
      isRegionEmpty(
        r1.state,
        { col: 2, row: 2, colSpan: 1, rowSpan: 1 },
        'a',
      ),
    ).toBe(true);
  });
});

describe('maxEmptyRectAt', () => {
  test('full grid empty: returns capped default', () => {
    const r = maxEmptyRectAt(createEmptyState(12), 0, 0, 6, 4);
    expect(r).toEqual({ w: 6, h: 4 });
  });
  test('cursor on occupied: returns 0×0', () => {
    const r1 = insertBlock(createEmptyState(12), {
      id: 'a',
      col: 0,
      row: 0,
      colSpan: 5,
      rowSpan: 5,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error();
    expect(maxEmptyRectAt(r1.state, 2, 2, 6, 4)).toEqual({ w: 0, h: 0 });
  });
});

describe('applyGravity convergence', () => {
  test('10 stacked blocks with gaps converge to rows 0-9', () => {
    const blocks: Block[] = Array.from({ length: 10 }, (_, i) => ({
      id: `b${i}`,
      col: 0,
      row: i * 2,
      colSpan: 1,
      rowSpan: 1,
      kind: 'markdown' as const,
    }));
    const state = { blocks, totalCols: 12 };
    const r = applyGravity(state);
    expect(r.iterations).toBeLessThan(20);
    for (let i = 0; i < 10; i++) {
      expect(r.state.blocks.find((b) => b.id === `b${i}`)!.row).toBe(i);
    }
  });
});
