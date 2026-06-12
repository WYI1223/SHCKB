// @vitest-environment happy-dom
/**
 * T7 (mvp7 review): the autosave debounce semantics EditorPage depends
 * on — most importantly that the LATEST render's save closure fires,
 * so edits inside the debounce window are saved, never a stale snapshot.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutosave } from '../useAutosave';

const MS = 800;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

type Props = { save: () => void; dep: unknown; onDirty?: () => void };

function mount(initial: Props) {
  return renderHook((p: Props) => useAutosave({ save: p.save, deps: [p.dep], ms: MS, onDirty: p.onDirty }), {
    initialProps: initial,
  });
}

describe('useAutosave', () => {
  test('mount never saves; a change saves once after the debounce', () => {
    const save = vi.fn();
    const onDirty = vi.fn();
    const h = mount({ save, dep: 'a', onDirty });
    vi.advanceTimersByTime(MS * 2);
    expect(save).not.toHaveBeenCalled();

    h.rerender({ save, dep: 'b', onDirty });
    expect(onDirty).toHaveBeenCalledTimes(1); // dirty signal is immediate
    expect(save).not.toHaveBeenCalled(); // …but the save waits
    vi.advanceTimersByTime(MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  test('rapid changes coalesce into one save', () => {
    const save = vi.fn();
    const h = mount({ save, dep: 0 });
    for (let i = 1; i <= 5; i++) {
      h.rerender({ save, dep: i });
      vi.advanceTimersByTime(MS / 2);
    }
    vi.advanceTimersByTime(MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  test('the save that fires is the latest closure (title edits are not stale)', () => {
    const calls: string[] = [];
    const saveWith = (title: string) => () => calls.push(title);
    const h = mount({ save: saveWith('old title'), dep: 'x' });
    h.rerender({ save: saveWith('old title'), dep: 'y' });
    vi.advanceTimersByTime(MS / 2);
    // a new save identity (e.g. the user typed in the title) re-arms the timer
    h.rerender({ save: saveWith('new title'), dep: 'y' });
    vi.advanceTimersByTime(MS);
    expect(calls).toEqual(['new title']);
  });

  test('unmount cancels the pending save', () => {
    const save = vi.fn();
    const h = mount({ save, dep: 1 });
    h.rerender({ save, dep: 2 });
    h.unmount();
    vi.advanceTimersByTime(MS * 2);
    expect(save).not.toHaveBeenCalled();
  });
});
