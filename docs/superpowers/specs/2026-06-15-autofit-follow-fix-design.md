# Autofit → Follow/Fix Mode Redesign — Design

**Date:** 2026-06-15
**Status:** design, pending owner review → implementation slice
**Supersedes:** the `max(floor, fit)` / floor-resize / floor-invariant model in
`docs/superpowers/specs/2026-06-13-block-autofit-height-design.md` (§4.3, §5.1, §6, §7)
and the autofit references in `[ADR-0028]` (gravity carve-out) / `[ADR-0029]` (frame-core).
A new ADR + `AUDIT-2026-05` register entry is authored in the implementation slice (this is a
behavioral + contract change to a previously-decided feature, so the authority docs must move first).

---

## 1. Motivation — the reframe

Autofit today is modeled as an **assist on a manual height**:

- A block has a persisted **floor** (`minRowSpan`, set by dragging a "grow" block's bottom handle).
- A persisted enum `autofit ∈ 'off' | 'grow' | 'grow+shrink'`, of which **only `'grow'` is wired**
  (`'grow+shrink'` is vestigial — it appears in type unions and comments but is never read).
- When `'grow'`, the effective height = `max(floor, fit)` (fit = measured content rows).

Two problems:

1. **The toggle lies.** When `floor ≥ content` (a block dragged taller than its text), turning autofit
   ON does **nothing visible** — ON looks identical to OFF until the content overflows the floor. The
   control appears broken.
2. **Two overlapping knobs** (the floor *and* the on/off) express one concept badly, and the third enum
   value is dead.

**The reframe (owner):** it is not "auto-height on/off." It is a **mode** with two *positive* states:

- **`follow`** (default) — height tracks content. The natural state of a block.
- **`fix`** — opt-in. Height is a fixed manual value; content beyond it scrolls/clips.

"Turning off grow" was never "off" — it was *switching to fix*. The off-framing hid the second real
mode. The UI becomes a **Follow / Fix** mode switch, not an "auto-height ☑" checkbox, and the vocabulary
stops lying. **`follow` is the default**, which already matches reality (text kinds default to `'grow'`;
`image` is `autofit: false`, i.e. it can only ever be fixed).

---

## 2. The model

| | **follow** (default for text kinds) | **fix** (default for image; opt-in for text) |
|---|---|---|
| height | `rowSpan = fit` (measured content) | `rowSpan` = a fixed manual value |
| minimum | hard **1 row** (already enforced in `fitFromContent`, `Math.max(1, …)`) | 1 row (grid minimum) |
| overflow | `hidden` (content lands exactly; nothing to scroll) | `auto` (content may exceed → scroll/clip) |
| vertical resize | **none** — height is content-owned | **yes** — drag to set the fixed height |
| horizontal resize | yes (changes width → reflow → new `fit`) | yes |
| live gesture (C5) | yes — reconciles to `fit` as you type | no — static |
| measurement probe | mounted while active | not mounted |

**`minRowSpan`/floor is deleted entirely.** follow uses `fit` (1-row min lives in `measureFit.ts`); fix
uses `rowSpan`. There is no separate "author min."

**Every block now has a definite mode** (`follow` or `fix`). Persisted `null` no longer means
"off/legacy" — on read it resolves to the kind default (and `'fix'` is the safe published fallback for an
unknown/absent value).

**`image` is fix-only** — it cannot follow (it has no measurable text content); the follow toggle is
absent for image, exactly as the autofit toggle is absent today.

---

## 3. The two transitions that are genuinely new

### 3.1 Freeze-at-current-height (`follow → fix`)
When the user switches a block to `fix`, its fixed `rowSpan` becomes its **current displayed height**.
For an inactive block (the only place the context-menu toggle is reachable today) `rowSpan` already
equals the last committed `fit`, so this is a no-op there; the rule must be made explicit so the
**active**-block path (e.g. a Properties-panel toggle, or toggling mid-grow) copies the live `fit` →
`rowSpan` at the moment of the switch. `fix → follow` re-mounts the probe and reconciles to `fit`.

### 3.2 Resize-handle ownership flips
- **follow**: no vertical resize handle (height is content-owned). Today's `autofitCtx.autofit &&
  verticalOnly` branch in `beginResize` — which *sets the floor* — is **deleted**, along with
  `clampFloorPreview` and `setMinRowSpan`.
- **fix**: normal `transform()`-based resize on all axes — this is the existing `else` branch, so fix
  reuses today's non-autofit resize path unchanged.

### 3.3 Fix-overflow in the editor (new, currently untested)
A `fix` block whose content exceeds its fixed height must **scroll/clip inside the frame** while active
*and* inactive. Today the published path already does this via `blockOverflow` (`auto`), but the editor's
active EditView in an overflowing fixed block is new behavior and needs explicit tests.

---

## 4. Change surface (verified against the codebase)

### 4.1 Contract — `packages/block-kinds`
- `types.ts` `BlockKindModule.autofit`: replace `false | { default: 'off'|'grow'|'grow+shrink' }` with
  **`{ default: 'follow' | 'fix'; canFollow?: boolean }`**.
  - `markdown` / `richtext` / `code` → `{ default: 'follow' }` (`canFollow` defaults `true`).
  - `image` → `{ default: 'fix', canFollow: false }`.
  - Downstream gates change from `autofit !== false` to `autofit?.canFollow !== false` (toggle
    visibility; probe mount).
  - *(Decision: a dedicated `canFollow` flag rather than overloading the `false` sentinel — `false` used
    to mean "no autofit at all," which under the new model is precisely "fix-only / no follow toggle," so
    naming it reads cleaner and lets the menu show a disabled/single mode rather than vanish.)*
- `BlockFrameCore.tsx` + `PublishedCanvas.tsx`: rename the `autofit?: boolean` prop / `PublishedDocShape`
  field to carry mode (`mode?: 'follow'|'fix'`, or keep a boolean named `follow`). `.skb-content-box`
  stays the overflow owner; host-invariant ordering (position/width/height/overflow applied **last**) is
  unchanged.
- `@skb/theme` `blockOverflow`: rename the param from `autofit` to `follow`/`mode`; mapping is
  **unchanged** (`follow → hidden`, `fix → auto`) — only naming + doc comment drift. (Touches the curated
  shells that import it.)

### 4.2 Web interaction — `apps/web/src/grid`
- `useGridInteraction.ts`: **delete** `minRowSpan` state/setter/seed and `clampFloorPreview`; the
  `autofit` record becomes the mode record (`'follow'|'fix'`). In `beginResize`, delete the
  floor-setting branch — fix uses the plain `transform()` path.
- `useAutofitGesture.ts`: reconcile **target = `Math.max(1, fit)`** (drop the `floor` arg and
  `max(floor, fit)`). The base-snapshot / reconcile-from-base / commit lifecycle is unchanged
  (atomicity preserved). `enabled` keys off `mode === 'follow'`.
- `GridCanvas.tsx`: `isAutofit` / `sheetInsertLocked` / `autofitGestureLocked` key off
  `mode === 'follow'`; the context-menu toggle (line 250) becomes a **follow/fix** toggle (writing
  `'follow'`/`'fix'` and implementing the freeze-at-current-height copy on `follow→fix`); the toggle
  gate uses `canFollow`; probe mount gate uses `mode === 'follow'`; ResizeHandles suppress vertical
  resize for follow.
- `measureFit.ts`: **no change** — it is the home of the 1-row minimum (`Math.max(1, …)`). Cite it as
  such.
- `MeasureProbe.tsx`, `captureLayoutSnapshot.ts`, `overlays.tsx`: thread the renamed prop; mount probe
  for follow only; per-mode handle policy in `overlays`/`ResizeHandles`. Scrub stale floor comments.
- `EditorPage.tsx` `onBlockInserted`: always seed a mode (text → `follow`, image → `fix`); **delete** the
  floor seed (`setMinRowSpan(block.rowSpan)`); `save()` stops emitting `minRowSpan`.
- `api/client.ts` `WorkingBlock`/`PublishedDoc`: `autofit` union → `'follow'|'fix'`; drop `minRowSpan`.
- `ReadPage.tsx`: enum→mode passthrough (`b.autofit` → mode); published render needs only `rowSpan` +
  mode (for overflow).

### 4.3 Server — `apps/server`
- `routes/notepages.ts`: parse `autofit ∈ {follow, fix}` only; **delete the 422 floor-invariant guard**
  and the `minRowSpan` parse/strip.
- `render/publish-html.ts` `toRenderDoc`: enum→mode (`'grow'`→`'follow'`).
- `db/schema.ts` + `drizzle/`: `autofit` text column values migrate to `follow|fix`. The
  `min_row_span` column is removed (a new `0009` table-rebuild migration) — *or* left dead. **Recommend
  drop** for cleanliness; leaving it dead is acceptable if the rebuild is judged too risky. (Decision for
  owner — see §8.)
- Export: `export/format.ts` **`FORMAT_VERSION` 5 → 6**; `migrate-format.ts` adds a v6 up/down:
  - `up()`: `'grow'`/`'grow+shrink'` → `'follow'`, `'off'`/`null` → `'fix'`, drop `minRowSpan` — touching
    **both** working blocks **and** `published.blocks`.
  - `down()`: `'follow'` → `'grow'`, `'fix'` → `'off'`, re-introduce `minRowSpan: null` with a lossy note.
  - `exporter.ts` / `importer.ts`: stop emitting/parsing `minRowSpan`; tighten the `autofit` guard.

### 4.4 Data migration of existing rows
- `'grow'`/`'grow+shrink'` → `follow`; `'off'`/`null` → `fix`. `minRowSpan` dropped.
- **Intended behavior change:** a former `'grow'` block whose floor exceeded its content will now shrink
  to its content. That is the new semantics the redesign wants. Published snapshots migrate by the same
  pure enum map (their `rowSpan` is already the committed height; no `fit`/`floor` lives in a snapshot).

### 4.5 Tests + fixtures (rewritten / added)
- Rewrite: `autofit-policy.test` (new contract shape), `frame-invariant` / `BlockFrameCore` /
  `frames-autofit` / `static` (mode prop), `useAutofitGesture.test` (pure-fit target, no floor),
  `floorResize.test` (**delete or repurpose** to fix-mode drag-resize), `GridCanvasAutofitMenu`
  (follow/fix toggle), `autofitGestureAtomicity` (`mode === 'follow'`), `autofit-route.test` (drop the
  floor-guard `describe`), `export-format` / `export-import` (v6 transform + round-trip + loss).
- Keep: `measureFit.test` (pins the 1-row min — the home of follow's floor).
- New e2e: follow grows **and** shrinks (rename `autofit-grow-shrink`); a `fix` block whose content
  exceeds its height **scrolls**; `follow→fix` **freezes** at current height; `fix` is **drag-resizable**.
  Re-seed all `autofit-*.spec`, `e2e/fixtures/login.ts` `E2EBlock`, and `seed-bridge.ts` to follow/fix and
  drop `minRowSpan`.

### 4.6 Docs / authority
- Amend `2026-06-13-block-autofit-height-design.md` (§4.3/§5.1/§6/§7): floor / `max(floor,fit)` /
  floor-resize / floor-invariant are superseded by follow/fix.
- New ADR (the two-mode model, death of floor, freeze-on-switch, per-mode resize, fix-overflow=scroll) +
  `AUDIT-2026-05` register entry.
- Scrub `grid-engine/CONTRACT.md`, `captureLayoutSnapshot.ts`, and `push-resize` test headers of the
  `max(floor,fit)` / `'grow'` vocabulary (the engine op takes only a target `rowSpan` — no logic change).

---

## 5. What does **not** change

- The C5 base-snapshot reconcile + single-commit-gravity machinery (only the *target formula* and the
  *mode predicate* change).
- `MeasureProbe`'s frame-agnostic AREA/CONTENT measurement.
- The host-frame box invariant (`.skb-content-box` owns position/width/height/overflow, applied last).
- `grid-engine` `pushResize`/`reconcileTo`/`commitGesture` op signatures (they already take only a target
  `rowSpan`).

---

## 6. Risks (from the mapping pass)

1. **Floor removal is a load-bearing multi-layer delete** — DB column, wire types (web + server +
   export), reconcile math, the floor-resize gesture branch, the seed-on-insert, the server 422 guard,
   and the migration's floor-reset tests. Must be removed coherently in one slice or contracts break.
2. **Format-version coordination** — `FORMAT_VERSION` bump gates cross-version import; the v6 transform
   must touch working *and* published blocks; SQLite can't cheaply drop a column (table rebuild).
3. **Fix-overflow in the active editor** is new behavior (only the published path handled overflow
   before) — needs explicit tests.
4. **Null semantics change** — persisted `null` stops meaning "off"; every block resolves to a mode.
   Comments/guards that special-case `null === off` must be redefined.
5. **Authority contradiction** — live code cites a floor model this deletes; the spec/ADR amendment is a
   precondition, not an afterthought.

---

## 7. Implementation sequencing (slice outline for the plan)

0. **Docs first** — amend the autofit design spec + draft the ADR + AUDIT entry (per project rule: the
   slice must not contradict its cited authority).
1. **Contract** — `block-kinds/types.ts` field + 4 kind modules + `autofit-policy.test`.
2. **Frame box** — `BlockFrameCore` / `PublishedCanvas` / `blockOverflow` rename + frame tests.
3. **Wire types** — `client.ts` + server `PublishedDoc` shape (compile-time fan-out exposes consumers).
4. **Web interaction core** — `useGridInteraction` (delete floor) + `useAutofitGesture` (target = fit) +
   confirm `measureFit`; rewrite gesture/floor tests.
5. **Web UI** — follow/fix toggle + freeze-at-current-height + per-mode resize handles +
   `mode==='follow'` locks + editor fix-overflow + insert defaults; rewrite menu/atomicity tests.
6. **Read/publish coercion** — `ReadPage` + `publish-html`.
7. **Server route** — parse follow/fix, delete the 422 floor guard; rewrite `autofit-route.test`.
8. **Persistence + migration** — schema/DDL decision + `0009` (if dropping the column) + `FORMAT_VERSION`
   6 + v6 up/down + exporter/importer; rewrite export tests, add v6 round-trip + loss tests.
9. **Fixtures + e2e** — re-seed follow/fix, drop `minRowSpan`, add the new fix/freeze/resize tests.
10. **Doc-comment cleanup** — `grid-engine` CONTRACT + snapshot/push-resize comments.

---

## 8. Open decisions for owner

- **(a) Contract encoding** — `{ default: 'follow'|'fix'; canFollow?: boolean }` (recommended) vs keeping
  the `false` sentinel for image. *Recommend the explicit `canFollow`.*
- **(b) `min_row_span` column** — physically drop via a `0009` table-rebuild (cleaner) vs leave it dead
  (lower risk). *Recommend drop.*
- Everything else (the two-mode semantics, freeze-on-switch, fix-resizable, 1-row follow min) is already
  agreed.
