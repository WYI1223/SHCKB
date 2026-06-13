/**
 * Floor-resize honesty (spec §7): when autofit is on, the bottom handle
 * sets the FLOOR (minRowSpan) and the ghost previewH is clamped to
 * max(currentFit, draggedH) so it never shows a height the block cannot
 * fall to. clampFloorPreview is the pure clamp the ghost + commit share.
 */
import { describe, expect, test } from 'vitest';
import { clampFloorPreview } from '../useGridInteraction';

describe('clampFloorPreview', () => {
  test('dragging below the current fit is clamped up to the fit', () => {
    // content needs 4 rows; dragging the floor down to 2 → ghost stays 4
    expect(clampFloorPreview(2, 4)).toBe(4);
  });

  test('dragging above the current fit honors the drag (raising the floor)', () => {
    expect(clampFloorPreview(6, 4)).toBe(6);
  });

  test('never below 1 row', () => {
    expect(clampFloorPreview(0, 0)).toBe(1);
  });
});
