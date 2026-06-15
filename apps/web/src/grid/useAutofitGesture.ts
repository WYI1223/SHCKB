/**
 * useAutofitGesture — the autofit reconcile controller (spec §4.4 C5).
 *
 * One ATOMIC EDIT GESTURE per active autofit block:
 * 1. On activate (gesture start) capture an immutable BASE snapshot of
 *    the whole layout + the grower's base rowSpan.
 * 2. Each measured fit (debounced ~200ms) reconciles to the follow
 *    target rowSpan = Math.max(1, fit) by re-deriving from the BASE every
 *    time — interaction.ops.reconcileTo(base, id, target). The 1-row min
 *    lives in measureFit.ts (fitFromContent); there is no separate floor.
 *    Gravity stays SUSPENDED within the gesture; reconcile never compacts.
 * 3. On commit (deactivate) interaction.ops.commitGesture(id, baseRowSpan)
 *    applies the COMMIT RULE: one applyGravity iff net delta && gravity-on.
 *
 * ATOMICITY (spec §4.4 / §10 R9): no gravity-running op may interleave a
 * gesture. We expose `gestureActive` so the host suspends the debounced
 * autosave commit while a gesture is live (single-user debounced-PUT
 * makes this an invariant, not a convention).
 *
 * `fit` is fed by MeasureProbe (already ceil(outerHeight/slot)). The
 * follow target is the fit itself (1-row min in measureFit). We never
 * persist fit.
 */
import { useEffect, useRef } from 'react';
import type { GridState } from '@skb/grid-engine';
import { captureLayoutSnapshot } from './captureLayoutSnapshot';
import type { Interaction } from './useGridInteraction';

export type UseAutofitGestureArgs = {
  interaction: Interaction;
  /** The currently active block id (gesture target), or null. */
  activeId: string | null;
  /** Follow mode on for this block (autofit === 'follow'). */
  enabled: boolean;
  /** Latest measured fit rows (from MeasureProbe). */
  fit: number;
  debounceMs?: number;
};

export type AutofitGesture = {
  /** True while an autofit gesture is live — host suspends autosave commit. */
  gestureActive: boolean;
};

export function useAutofitGesture(args: UseAutofitGestureArgs): AutofitGesture {
  const { interaction, activeId, enabled, fit, debounceMs = 200 } = args;
  // The immutable gesture base + the grower's base rowSpan. Captured once
  // per gesture (on the active id changing into a block), cleared on end.
  const baseRef = useRef<GridState | null>(null);
  const baseRowSpanRef = useRef<number>(1);
  const activeRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // hold latest reconcile inputs so the debounced fire reads fresh values
  const latest = useRef({ fit, enabled });
  latest.current = { fit, enabled };

  // Gesture lifecycle: capture base on enter, commit on leave.
  useEffect(() => {
    const prev = activeRef.current;
    if (prev !== activeId) {
      // leaving a block → commit that gesture
      if (prev !== null && baseRef.current) {
        interaction.ops.commitGesture(prev, baseRowSpanRef.current);
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      // entering a block → capture a fresh base
      if (activeId !== null) {
        const base = captureLayoutSnapshot(interaction.state);
        baseRef.current = base;
        baseRowSpanRef.current = base.blocks.find((b) => b.id === activeId)?.rowSpan ?? 1;
      } else {
        baseRef.current = null;
      }
      activeRef.current = activeId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Debounced reconcile on fit change while a gesture is live.
  useEffect(() => {
    if (!enabled || activeId === null || baseRef.current === null) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const base = baseRef.current;
      if (!base) return;
      const { fit: fi } = latest.current;
      const target = Math.max(1, fi); // follow target = fit (1-row min)
      interaction.ops.reconcileTo(base, activeId, target);
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, enabled, fit, debounceMs]);

  return { gestureActive: enabled && activeId !== null };
}
