/**
 * Debounced autosave, extracted from EditorPage so the closure-capture
 * behavior is testable (T7, mvp7 review).
 *
 * Semantics the editor depends on:
 * - the mount run never saves (initial state is what the server sent);
 * - each change fires `onDirty` immediately and re-arms the timer —
 *   rapid edits coalesce into one save;
 * - the `save` captured by the LATEST render is the one invoked, so a
 *   title edit inside the debounce window is part of the save, never a
 *   stale snapshot.
 */
import { useEffect, useRef } from 'react';

export function useAutosave(opts: {
  save: () => void | Promise<unknown>;
  /** Change signals beyond `save`'s own identity (e.g. content maps). */
  deps: readonly unknown[];
  ms: number;
  onDirty?: () => void;
}): void {
  const firstRun = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDirtyRef = useRef(opts.onDirty);
  onDirtyRef.current = opts.onDirty;

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    onDirtyRef.current?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void opts.save(), opts.ms);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.save, opts.ms, ...opts.deps]);
}
