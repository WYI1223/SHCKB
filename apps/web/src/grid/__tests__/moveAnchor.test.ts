/**
 * T4 (mvp7 review): the grab-offset anchor math is preview honesty —
 * dragover ghost and drop share it, so it must be exactly right.
 */
import { describe, expect, test } from 'vitest';
import { moveAnchor } from '../useGridInteraction';

const rect = { left: 100, top: 50 };
const SLOT = 60;

describe('moveAnchor', () => {
  test('block lands relative to the grab point, not the cursor', () => {
    // grabbed 1.0 slot right / 0.5 slot down inside the block
    const grab = { grabPxX: 60, grabPxY: 30 };
    // cursor over cell (3, 2): x = 100 + 3*60, y = 50 + 2*60
    const point = { clientX: 100 + 3 * SLOT, clientY: 50 + 2 * SLOT };
    const a = moveAnchor(point, rect, SLOT, grab, { colSpan: 4 });
    expect(a).toEqual({ col: 2, row: 2 }); // 3 - 1 grab col; 2 - 0.5 rounds back to 2
  });

  test('rounds to the nearest cell edge (not floor)', () => {
    const grab = { grabPxX: 0, grabPxY: 0 };
    // 2.6 slots → col 3; 2.4 slots → col 2
    expect(moveAnchor({ clientX: 100 + 2.6 * SLOT, clientY: 50 }, rect, SLOT, grab, { colSpan: 1 }).col).toBe(3);
    expect(moveAnchor({ clientX: 100 + 2.4 * SLOT, clientY: 50 }, rect, SLOT, grab, { colSpan: 1 }).col).toBe(2);
  });

  test('clamps left/top at 0 even when the grab offset pushes past the origin', () => {
    const grab = { grabPxX: 120, grabPxY: 120 };
    const a = moveAnchor({ clientX: 100, clientY: 50 }, rect, SLOT, grab, { colSpan: 2 });
    expect(a).toEqual({ col: 0, row: 0 });
  });

  test('clamps right so the block never overflows the 12-col grid', () => {
    const grab = { grabPxX: 0, grabPxY: 0 };
    const a = moveAnchor({ clientX: 100 + 11 * SLOT, clientY: 50 }, rect, SLOT, grab, { colSpan: 4 });
    expect(a.col).toBe(8); // 12 - 4
  });
});
