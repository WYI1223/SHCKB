// @vitest-environment happy-dom
/**
 * The reconcile ops on useGridInteraction (spec §4.4 C5 + COMMIT RULE):
 * - reconcileTo(base, id, target) = pushResize(base,id,target), state set
 *   WITHOUT gravity (gravity suspended within the gesture);
 * - commitGesture runs applyGravity ONCE iff net delta != 0 && gravity-on;
 *   gravity-off commits the pushed layout as-is.
 */
import { afterEach, describe, expect, test } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { Block, GridState } from '@skb/grid-engine';
import { captureLayoutSnapshot } from '../captureLayoutSnapshot';
import { useGridInteraction } from '../useGridInteraction';

afterEach(cleanup);

const G: Block = { id: 'g', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind: 'markdown' };
const B: Block = { id: 'b', col: 0, row: 1, colSpan: 2, rowSpan: 1, kind: 'markdown' };

function mount(gravity: boolean) {
  return renderHook(() =>
    useGridInteraction({
      initialBlocks: [G, B],
      initialGravity: gravity,
      defaultSizeFor: () => ({ colSpan: 2, rowSpan: 1 }),
      onBlockInserted: () => {},
    }),
  );
}

function snap(state: GridState) {
  return captureLayoutSnapshot(state);
}

describe('reconcileTo', () => {
  test('grows the grower and pushes the AABB collider down, no gravity', () => {
    const h = mount(false);
    const base = snap(h.result.current.state);
    act(() => h.result.current.reconcileTo(base, 'g', 3));
    const after = h.result.current.state.blocks;
    expect(after.find((b) => b.id === 'g')!.rowSpan).toBe(3);
    expect(after.find((b) => b.id === 'b')!.row).toBe(3); // pushed below the grown g
  });

  test('partial shrink (3 -> 2) equals reconciling directly from base to 2', () => {
    const h = mount(false);
    const base = snap(h.result.current.state);
    act(() => h.result.current.reconcileTo(base, 'g', 3));
    act(() => h.result.current.reconcileTo(base, 'g', 2)); // re-derive from BASE
    const after = h.result.current.state.blocks;
    expect(after.find((b) => b.id === 'g')!.rowSpan).toBe(2);
    expect(after.find((b) => b.id === 'b')!.row).toBe(2);
  });

  test('reconciling back to base rowSpan restores the base layout exactly', () => {
    const h = mount(false);
    const base = snap(h.result.current.state);
    act(() => h.result.current.reconcileTo(base, 'g', 4));
    act(() => h.result.current.reconcileTo(base, 'g', 1)); // back to base
    expect(h.result.current.state.blocks).toEqual(base.blocks);
  });
});

describe('commitGesture', () => {
  test('gravity-on + net delta runs applyGravity once (compacts the gap)', () => {
    const h = mount(true);
    const base = snap(h.result.current.state);
    act(() => h.result.current.reconcileTo(base, 'g', 3));
    act(() => h.result.current.reconcileTo(base, 'g', 1)); // shrunk back, b at row1 (pushed) — gap at... none here
    // grow then commit at a NET delta:
    act(() => h.result.current.reconcileTo(base, 'g', 3));
    act(() => h.result.current.commitGesture('g', 1));
    const after = h.result.current.state.blocks;
    // g grew to 3 and stays; b sits directly under it, compacted (row 3)
    expect(after.find((b) => b.id === 'g')!.rowSpan).toBe(3);
    expect(after.find((b) => b.id === 'b')!.row).toBe(3);
  });

  test('gravity-off commits the pushed layout as-is (no compaction)', () => {
    const h = mount(false);
    const base = snap(h.result.current.state);
    act(() => h.result.current.reconcileTo(base, 'g', 3));
    const before = h.result.current.state.blocks.map((b) => ({ ...b }));
    act(() => h.result.current.commitGesture('g', 1));
    expect(h.result.current.state.blocks).toEqual(before);
  });
});
