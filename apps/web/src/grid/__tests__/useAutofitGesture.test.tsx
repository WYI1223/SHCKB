// @vitest-environment happy-dom
/**
 * useAutofitGesture (spec §4.4 C5 controller): capture base on activate,
 * debounce fit, reconcile to Math.max(1, fit) from the BASE every time
 * (follow target = fit, 1-row min in measureFit — no floor), commit once
 * (gravity rule lives in commitGesture), expose gestureActive for autosave
 * atomicity. We drive a fake interaction so the controller's
 * scheduling/debounce/commit wiring is tested in isolation.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { GridState } from '@skb/grid-engine';
import { useAutofitGesture } from '../useAutofitGesture';

afterEach(cleanup);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const DEBOUNCE = 200;

function fakeInteraction(rowSpanOf: () => number) {
  const reconcileTo = vi.fn();
  const commitGesture = vi.fn();
  const state: GridState = {
    totalCols: 12,
    blocks: [{ id: 'g', col: 0, row: 0, colSpan: 2, rowSpan: rowSpanOf(), kind: 'markdown' }],
  };
  return { state, ops: { reconcileTo, commitGesture } } as never;
}

describe('useAutofitGesture', () => {
  test('captures base on activate and reconciles to the measured fit after debounce', () => {
    const i = fakeInteraction(() => 1);
    const h = renderHook(({ fit }) => useAutofitGesture({ interaction: i, activeId: 'g', enabled: true, fit, debounceMs: DEBOUNCE }), {
      initialProps: { fit: 6 },
    });
    // follow target = fit (no floor): fit=6 → 6
    h.rerender({ fit: 6 });
    act(() => vi.advanceTimersByTime(DEBOUNCE));
    const [base, id, target] = (i as any).ops.reconcileTo.mock.calls.at(-1);
    expect(id).toBe('g');
    expect(target).toBe(6);
    expect(base.blocks[0].rowSpan).toBe(1); // reconciled from the captured base
  });

  test('empty content reconciles to the 1-row minimum', () => {
    const i = fakeInteraction(() => 1);
    const h = renderHook(({ fit }) => useAutofitGesture({ interaction: i, activeId: 'g', enabled: true, fit, debounceMs: DEBOUNCE }), {
      initialProps: { fit: 0 },
    });
    h.rerender({ fit: 0 });
    act(() => vi.advanceTimersByTime(DEBOUNCE));
    expect((i as any).ops.reconcileTo.mock.calls.at(-1)[2]).toBe(1); // Math.max(1, 0)
  });

  test('rapid fit changes coalesce into one reconcile (debounced)', () => {
    const i = fakeInteraction(() => 1);
    const h = renderHook(({ fit }) => useAutofitGesture({ interaction: i, activeId: 'g', enabled: true, fit, debounceMs: DEBOUNCE }), {
      initialProps: { fit: 2 },
    });
    for (const fit of [3, 4, 5]) {
      h.rerender({ fit });
      act(() => vi.advanceTimersByTime(DEBOUNCE / 2));
    }
    act(() => vi.advanceTimersByTime(DEBOUNCE));
    expect((i as any).ops.reconcileTo).toHaveBeenCalledTimes(1);
    expect((i as any).ops.reconcileTo.mock.calls[0][2]).toBe(5); // last fit, Math.max(1,5)
  });

  test('on deactivate it commits the gesture with the base rowSpan', () => {
    const i = fakeInteraction(() => 1);
    const h = renderHook(({ activeId }) => useAutofitGesture({ interaction: i, activeId, enabled: true, fit: 4, debounceMs: DEBOUNCE }), {
      initialProps: { activeId: 'g' as string | null },
    });
    act(() => vi.advanceTimersByTime(DEBOUNCE));
    h.rerender({ activeId: null }); // deactivate = gesture end
    expect((i as any).ops.commitGesture).toHaveBeenCalledWith('g', 1);
  });

  test('gestureActive is true only while a block is active (autosave atomicity)', () => {
    const i = fakeInteraction(() => 1);
    const h = renderHook(({ activeId }) => useAutofitGesture({ interaction: i, activeId, enabled: true, fit: 1, debounceMs: DEBOUNCE }), {
      initialProps: { activeId: 'g' as string | null },
    });
    expect(h.result.current.gestureActive).toBe(true);
    h.rerender({ activeId: null });
    expect(h.result.current.gestureActive).toBe(false);
  });

  test('disabled (fix mode) never reconciles', () => {
    const i = fakeInteraction(() => 1);
    const h = renderHook(({ fit }) => useAutofitGesture({ interaction: i, activeId: 'g', enabled: false, fit, debounceMs: DEBOUNCE }), {
      initialProps: { fit: 1 },
    });
    h.rerender({ fit: 5 });
    act(() => vi.advanceTimersByTime(DEBOUNCE * 2));
    expect((i as any).ops.reconcileTo).not.toHaveBeenCalled();
  });
});
