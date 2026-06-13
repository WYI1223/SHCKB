/**
 * The WEB SNAPSHOT PRIMITIVE (autofit reflow model C5, spec §4.4/§4.5).
 *
 * Captures a deep, immutable clone of a GridState — the gesture's BASE.
 * autofit reconcile re-derives every target from this base (no journal,
 * no clamp), so the clone must NOT share any reference with the live
 * state and must be frozen so a consumer cannot corrupt the base
 * mid-gesture.
 *
 * This is deliberately the SHARED foundation for a future Ctrl+Z undo
 * stack (spec §4.5: one basis primitive, two consumers). We ship ONLY
 * the autofit consumer now — no stack, no ring buffer, no keymap, no
 * redo. The undo feature is a separate later PRD that builds on this.
 *
 * Web layer (NOT engine): keeps the engine pure/kind-opaque (invariant
 * 6), consistent with floor/fit also living in the web layer (spec §4.3).
 */
import type { Block, GridState } from '@skb/grid-engine';

export function captureLayoutSnapshot(state: GridState): GridState {
  const blocks = state.blocks.map((b): Block => Object.freeze({ ...b }) as Block);
  return Object.freeze({
    totalCols: state.totalCols,
    blocks: Object.freeze(blocks) as Block[],
  }) as GridState;
}
