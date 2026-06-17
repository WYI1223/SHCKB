/**
 * captureLayoutSnapshot — the WEB SNAPSHOT PRIMITIVE (autofit C5 base
 * snapshot; also the predeclared foundation of a future Ctrl+Z undo).
 * Must be a DEEP immutable clone: mutating the source after capture must
 * never reach the snapshot, and the snapshot itself must be frozen.
 */
import { describe, expect, test } from 'vitest';
import type { GridState } from '@skb/grid-engine';
import { captureLayoutSnapshot } from '../captureLayoutSnapshot';

function state(): GridState {
  return {
    totalCols: 12,
    blocks: [
      { id: 'g', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind: 'markdown' },
      { id: 'w', col: 0, row: 1, colSpan: 6, rowSpan: 1, kind: 'markdown' },
    ],
  };
}

describe('captureLayoutSnapshot', () => {
  test('clone is structurally equal to the source', () => {
    const s = state();
    expect(captureLayoutSnapshot(s)).toEqual(s);
  });

  test('clone is a different object graph (no shared references)', () => {
    const s = state();
    const snap = captureLayoutSnapshot(s);
    expect(snap).not.toBe(s);
    expect(snap.blocks).not.toBe(s.blocks);
    expect(snap.blocks[0]).not.toBe(s.blocks[0]);
  });

  test('mutating the source after capture never reaches the snapshot', () => {
    const s = state();
    const snap = captureLayoutSnapshot(s);
    s.blocks[0]!.rowSpan = 99;
    s.blocks.push({ id: 'x', col: 8, row: 0, colSpan: 1, rowSpan: 1, kind: 'markdown' });
    expect(snap.blocks[0]!.rowSpan).toBe(1);
    expect(snap.blocks).toHaveLength(2);
  });

  test('the snapshot is frozen (immutable)', () => {
    const snap = captureLayoutSnapshot(state());
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.blocks)).toBe(true);
    expect(Object.isFrozen(snap.blocks[0])).toBe(true);
  });
});
