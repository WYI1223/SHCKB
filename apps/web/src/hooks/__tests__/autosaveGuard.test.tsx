// @vitest-environment happy-dom
/**
 * EditorPage autosave-guard (spec §4.4 atomicity): the save callback
 * closes over activeId and returns early (no PUT) while a block is active.
 * After deactivation (activeId → null) the next debounce fires the PUT.
 *
 * We test at the smallest honest seam: useAutosave + a save closure that
 * mirrors EditorPage's guard. No full EditorPage mount needed.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAutosave } from '../useAutosave';

afterEach(cleanup);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const MS = 800;

/**
 * Build a save function that mirrors the EditorPage guard:
 *   if (activeId !== null) return true;  // skip the PUT
 *   apiSave();                           // the PUT
 */
function makeGuardedSave(getActiveId: () => string | null, apiSave: () => void) {
  return async () => {
    if (getActiveId() !== null) return true; // atomicity guard — no PUT
    apiSave();
    return true;
  };
}

describe('EditorPage autosave guard', () => {
  test('(a) while activeId !== null, content changes do NOT trigger a PUT', () => {
    const apiSave = vi.fn();
    let activeId: string | null = 'block-1';

    const h = renderHook(
      (props: { dep: unknown; save: () => Promise<boolean> }) =>
        useAutosave({ save: props.save, deps: [props.dep], ms: MS }),
      {
        initialProps: {
          dep: 'initial',
          save: makeGuardedSave(() => activeId, apiSave),
        },
      },
    );

    // Simulate a content change while block is active
    h.rerender({ dep: 'changed-while-active', save: makeGuardedSave(() => activeId, apiSave) });
    act(() => vi.advanceTimersByTime(MS * 2));

    expect(apiSave).not.toHaveBeenCalled();
  });

  test('(b) after deactivation (activeId → null), a PUT of the committed state fires', () => {
    const apiSave = vi.fn();
    let activeId: string | null = 'block-1';

    const h = renderHook(
      (props: { dep: unknown; save: () => Promise<boolean> }) =>
        useAutosave({ save: props.save, deps: [props.dep], ms: MS }),
      {
        initialProps: {
          dep: 'initial',
          save: makeGuardedSave(() => activeId, apiSave),
        },
      },
    );

    // Content change while active — no PUT
    h.rerender({ dep: 'changed-while-active', save: makeGuardedSave(() => activeId, apiSave) });
    act(() => vi.advanceTimersByTime(MS / 2));
    expect(apiSave).not.toHaveBeenCalled();

    // Deactivate: activeId → null, trigger another dep change (committed state)
    activeId = null;
    h.rerender({ dep: 'committed', save: makeGuardedSave(() => activeId, apiSave) });
    act(() => vi.advanceTimersByTime(MS));

    expect(apiSave).toHaveBeenCalledTimes(1);
  });
});
