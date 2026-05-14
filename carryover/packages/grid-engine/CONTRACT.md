# `@skb/grid-engine` — contract

> **Pure 2D layout engine for SKB blocks on a 12-col × N-row LEGO baseplate.**
> No React, no DOM, no CSS. Just data structures + algorithms.
> Per [`docs/design/grid-redesign-2026-05-11.md`](../../docs/design/grid-redesign-2026-05-11.md).

## Mental model

- 12 columns × unbounded rows of uniform square slots
- Each `Block` is an AABB rectangle occupying contiguous `colSpan × rowSpan` slots
- **Invariant**: no two blocks overlap (enforced by every state-mutating op)
- **Source of truth**: `GridState.blocks` array; occupancy matrix is derived
- **Gravity** (Option A locked): every state mutation runs upward gravity → state is always gravity-stable, no floating blocks

## Public surface

```ts
// types
export type {
  Block, BlockKind, DropIntent, GridState,
  Occupancy, OpResult, Region, ValidationResult,
};
// constants
export { TOTAL_COLS, DEFAULT_SIZES };
// state
export { createEmptyState, totalRows, buildOccupancy };
// collision (pure predicates)
export { regionsOverlap, isRegionEmpty, isRegionInBounds, findCollidingBlocks };
// gravity
export { applyGravity, canRise };
// ops (state mutators returning OpResult)
export { insertBlock, moveBlock, resizeBlock, deleteBlock };
// drop intent
export { inferDropIntent, maxEmptyRectAt };
// debug
export { validateState };
```

## Operation semantics

| op | failure modes | gravity |
|---|---|---|
| `insertBlock(state, block)` | duplicate id, out of bounds, overlap | runs after |
| `moveBlock(state, id, col, row)` | no such id, out of bounds, overlap | runs after |
| `resizeBlock(state, id, w, h)` | no such id, out of bounds, overlap | runs after |
| `deleteBlock(state, id)` | silent no-op if id missing (returns state directly, never fails) | runs after |

All ops returning `OpResult` are **dry-run-able**: failure leaves state unchanged. Caller can inspect `result.error` for human-readable reason.

## Gravity algorithm

```
function applyGravity(state):
  loop:
    moved = false
    for block in state.blocks (sorted by row ascending):
      if canRise(block):  # entire footprint one row up is empty
        block.row -= 1
        moved = true
    if !moved: break
```

- **Per-block AABB upward**: each block tries to rise as a unit; size unchanged
- **Convergence**: bounded by block count × max row; capped at 1000 passes for safety
- **Performance**: O(passes × blocks × cells_per_block); 100 blocks ~10ms in benchmarks

## Hole-fill drop intent

`inferDropIntent(state, cursorCol, cursorRow, blockKind)`:

- If cursor out of bounds → reject
- If cursor on an existing block → reject (v2 will handle edge-of-block intent)
- Else: compute max empty rect containing cursor, capped by `DEFAULT_SIZES[kind]`
- Result: `{ intent: 'place', col, row, colSpan: min(default, holeMaxW), rowSpan: min(default, holeMaxH) }`

The new block fills the hole if hole < default (shrink-to-fit), or uses default if hole ≥ default.

## What this package does NOT do

- **No render** — caller handles UI. `BlockRenderProps` is a theme contract concern, not engine.
- **No theme** — engine is theme-agnostic. Themes live in `editor-shell` (or future `@skb/grid-themes`).
- **No persistence** — caller (e.g. ProseMirror doc, React state) owns the `GridState` lifetime.
- **No undo/redo** — caller's transaction model owns history. Each op produces a new state immutably.
- **No edge-of-block intent (v2)** — current `inferDropIntent` only handles "cursor in empty space".

## Tests

- `__tests__/unit.test.ts` — covers occupancy, collision, ops, gravity, intent, validate
- `__tests__/scenarios.test.ts` — focused scenarios incl. user's design-doc example, gravity cascades, hole-fill, resize collision rejection
- `__tests__/property.test.ts` — N random op sequences, asserts no-overlap invariant always holds

## See also

- [`docs/design/grid-redesign-2026-05-11.md`](../../docs/design/grid-redesign-2026-05-11.md) — design rationale + mental model + theme spec
- (future) `docs/decisions/ADR-0019-grid-engine.md` — locked ADR once production integration begins
