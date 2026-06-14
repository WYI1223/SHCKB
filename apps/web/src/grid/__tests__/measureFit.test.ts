/**
 * Pure arithmetic of the autofit measurement loop (spec §5.3): the
 * offscreen geometry width and the fit = ceil((content + chrome + 2*pad) /
 * slot) derivation. No DOM — DOM wiring is MeasureProbe (Task 3).
 */
import { describe, expect, test } from 'vitest';
import { fitFromContent, measuredWidthPx } from '../measureFit';

describe('measuredWidthPx', () => {
  test('is the block geometry width: colSpan*slot - 2*pad', () => {
    expect(measuredWidthPx(6, 60, 4)).toBe(6 * 60 - 8);
    expect(measuredWidthPx(1, 60, 4)).toBe(52);
  });
});

describe('fitFromContent', () => {
  test('fit = ceil((content + chrome + 2*pad) / slot)', () => {
    // chrome 0, pad 4 → the cell-inset term alone: ceil((52+8)/60)=1
    expect(fitFromContent(52, 0, 60, 4)).toBe(1);
    expect(fitFromContent(53, 0, 60, 4)).toBe(2);
    // realistic galley/stationery: content 310 + chrome 24 + 8 = 342 → 6 rows
    expect(fitFromContent(310, 24, 60, 4)).toBe(6);
    // a near-empty placeholder line + default-frame chrome stays one row
    expect(fitFromContent(20, 19, 60, 4)).toBe(1);
  });

  test('the cell vertical inset (2*pad) is what pushes a full-slot block up', () => {
    // 60px of content with zero chrome still needs 2 rows, because the
    // committed cell is only rowSpan*slot - 2*pad tall (the boundary bug).
    expect(fitFromContent(60, 0, 60, 4)).toBe(2);
  });

  test('never returns below 1 (a block is at least one row)', () => {
    expect(fitFromContent(0, 0, 60, 4)).toBe(1);
    // negative/garbage chrome is clamped, never drops below the floor
    expect(fitFromContent(0, -50, 60, 4)).toBe(1);
  });
});
