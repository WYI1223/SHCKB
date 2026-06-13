/**
 * Pure arithmetic of the autofit measurement loop (spec §5.3): the
 * offscreen geometry width and the fit = ceil(outerHeight / slot)
 * derivation. No DOM — DOM wiring is MeasureProbe (Task 3).
 */
import { describe, expect, test } from 'vitest';
import { fitFromOuterHeight, measuredWidthPx } from '../measureFit';

describe('measuredWidthPx', () => {
  test('is the block geometry width: colSpan*slot - 2*pad', () => {
    expect(measuredWidthPx(6, 60, 4)).toBe(6 * 60 - 8);
    expect(measuredWidthPx(1, 60, 4)).toBe(52);
  });
});

describe('fitFromOuterHeight', () => {
  test('fit = ceil(outerHeight / slot)', () => {
    expect(fitFromOuterHeight(60, 60)).toBe(1);
    expect(fitFromOuterHeight(61, 60)).toBe(2);
    expect(fitFromOuterHeight(180, 60)).toBe(3);
    expect(fitFromOuterHeight(181, 60)).toBe(4);
  });

  test('never returns below 1 (a block is at least one row)', () => {
    expect(fitFromOuterHeight(0, 60)).toBe(1);
    expect(fitFromOuterHeight(10, 60)).toBe(1);
  });
});
