# Autofit Follow/Fix Mode Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `autofit` enum (`off`/`grow`/`grow+shrink`, only `grow` wired, height = `max(floor, fit)`) with a two-MODE model — **follow** (default; height tracks content, 1-row min, no floor) and **fix** (opt-in; fixed manual height, drag-resizable, content scrolls) — and delete the `minRowSpan`/floor concept entirely.

**Architecture:** Persisted/wire value becomes a mode string `'follow' | 'fix'`. The host frame box (`BlockFrameCore`/`blockOverflow`) keys overflow off a `follow: boolean`. follow blocks live-reconcile to `fit` via the existing C5 base-snapshot gesture (target changes from `max(floor, fit)` to `Math.max(1, fit)`); fix blocks are static and use the normal `transform()` resize path. `image` is fix-only (`canFollow: false`). Export format bumps 5→6 with a paired up/down migration; the `min_row_span` DB column is dropped.

**Tech Stack:** bun workspace; React 18 + vitest (web, block-kinds, theme, grid-engine); Hono + bun:test + drizzle/SQLite (server); Playwright e2e.

**Source of truth:** `docs/superpowers/specs/2026-06-15-autofit-follow-fix-design.md`. Read it before starting.

**Owner decisions (locked):** (a) contract encoding = `{ default: 'follow'|'fix'; canFollow?: boolean }`; (b) physically **drop** the `min_row_span` column.

**Conventions used in this plan:**
- The web interaction record keeps the name `autofit` but its value space becomes `'follow' | 'fix'` (minimizes churn; "autofit mode = fix" reads fine). `isFollow = autofit[id] === 'follow'`.
- `BlockFrameCore` / `PublishedCanvas` / `blockOverflow` take a boolean `follow` (the persisted mode string is mapped to it at the coercion seams). Mapping is unchanged: `follow → 'hidden'`, `fix → 'auto'`.
- Verify commands: per-package `bun run --filter @skb/<name> test` and `… typecheck`; whole suite `bun run test`; e2e `bun run test:e2e`. Filters: `@skb/shckb-web`, `@skb/shckb-server`, `@skb/block-kinds`, `@skb/theme`, `@skb/grid-engine`. Targeted vitest: `cd <pkg> && bun x vitest run <file>`. Targeted server: `cd apps/server && bun test test/<file>`.

**Strict dependency order — do NOT reorder.** Each task ends green (typecheck + that package's tests) before the next. A type rename ripples; the compiler is the safety net, so let it fan out task by task.

---

### Task 0: Docs / authority (must precede code, per project rule)

**Files:**
- Modify: `docs/superpowers/specs/2026-06-13-block-autofit-height-design.md` (add a superseded banner)
- Create: `docs/engineering/decisions/ADR-0030-autofit-follow-fix.md`
- Modify: `docs/engineering/decisions/AUDIT-2026-05.md` (register entry)

- [ ] **Step 1:** Prepend a banner to the 2026-06-13 spec: `> **Superseded 2026-06-15** by docs/superpowers/specs/2026-06-15-autofit-follow-fix-design.md and [ADR-0030]: the floor / max(floor,fit) / floor-resize / floor-invariant model (§4.3/§5.1/§6/§7) is replaced by the follow/fix two-mode model. Sections below are legacy trace.`
- [ ] **Step 2:** Write `ADR-0030-autofit-follow-fix.md` in the repo's ADR form (cite `[ADR-0028]`/`[ADR-0029]`). Decision: two modes follow/fix; floor deleted; follow target = `fit` (1-row min); freeze-at-current-height on follow→fix; per-mode resize-handle policy (follow = no vertical resize, fix = normal); fix overflow scrolls; image = fix-only. Note it amends ADR-0028 §gravity-carve-out wording (autofit atomic session now = follow only) and is downstream of the 2026-06-15 design spec.
- [ ] **Step 3:** Add an `AUDIT-2026-05.md` register row pointing at ADR-0030 (follow the existing table format in that file — read it first).
- [ ] **Step 4: Commit** — `git add docs && git commit -m "docs(autofit): ADR-0030 follow/fix; supersede floor model + AUDIT entry"`

---

### Task 1: Contract — per-kind autofit policy

**Files:**
- Modify: `packages/block-kinds/src/types.ts` (the `autofit` field on `BlockKindModule`)
- Modify: `packages/block-kinds/src/markdown/index.ts`, `richtext/index.ts`, `code/index.ts`, `image/index.ts`
- Test: `packages/block-kinds/src/__tests__/autofit-policy.test.ts`

- [ ] **Step 1: Rewrite the policy test (red).** Replace its assertions with:

```ts
import { describe, expect, test } from 'vitest';
import { blockModule } from '../registry';

describe('per-kind autofit policy (follow/fix)', () => {
  test('text kinds default to follow', () => {
    for (const k of ['markdown', 'richtext', 'code']) {
      expect(blockModule(k)?.autofit).toEqual({ default: 'follow' });
    }
  });
  test('image is fix-only (cannot follow)', () => {
    expect(blockModule('image')?.autofit).toEqual({ default: 'fix', canFollow: false });
  });
});
```

- [ ] **Step 2: Run (fail).** `cd packages/block-kinds && bun x vitest run src/__tests__/autofit-policy.test.ts` → fails (old shape).
- [ ] **Step 3: Change the type.** In `types.ts`, replace the `autofit?: false | { default: 'off' | 'grow' | 'grow+shrink' }` field with:

```ts
  /**
   * Per-kind autofit policy (follow/fix, 2026-06-15 redesign).
   * - `default`: the mode a freshly-inserted block of this kind starts in.
   * - `canFollow`: whether this kind can use follow mode at all. `false` =
   *   fix-only (e.g. image — no measurable text content; the follow toggle is
   *   hidden). Defaults to `true` when omitted.
   * follow = height tracks measured content (1-row min, no floor);
   * fix = fixed manual height, drag-resizable, content scrolls.
   */
  autofit?: { default: 'follow' | 'fix'; canFollow?: boolean };
```

- [ ] **Step 4: Update the four kind modules.** markdown/richtext/code: `autofit: { default: 'follow' }`. image: `autofit: { default: 'fix', canFollow: false }`.
- [ ] **Step 5: Update CONTRACT.md** — `packages/block-kinds/CONTRACT.md`: if it documents the autofit field shape, update it to the new shape (grep for `autofit` there first).
- [ ] **Step 6: Run + typecheck.** `bun run --filter @skb/block-kinds test` and `… typecheck`. The frame/static tests still compile (they use the boolean `BlockFrameCore` prop, untouched here). Expect green.
- [ ] **Step 7: Commit** — `feat(block-kinds): autofit policy → {default, canFollow} (follow/fix)`

---

### Task 2: Host frame box — overflow keys off `follow`

**Files:**
- Modify: `packages/theme/src/themes.ts` (`blockOverflow`)
- Modify: `packages/block-kinds/src/BlockFrameCore.tsx` (prop), `PublishedCanvas.tsx` (doc field + pass-through)
- Test: `packages/block-kinds/src/__tests__/{frame-invariant,BlockFrameCore,frames-autofit,static,slots}.test.{ts,tsx}`; `packages/theme` tests if any assert blockOverflow.

- [ ] **Step 1: Rename `blockOverflow` param.** In `themes.ts`:

```ts
/** follow = content fits exactly (rowSpan == fit) → clip; fix = manual height,
 *  content may exceed → scroll. (mapping unchanged from the old autofit bool.) */
export function blockOverflow(follow: boolean | undefined): 'hidden' | 'auto' {
  return follow ? 'hidden' : 'auto';
}
```
Update its doc comment; the body is unchanged.

- [ ] **Step 2: `BlockFrameCore.tsx`** — rename the prop `autofit?: boolean` → `follow?: boolean`; destructure `follow`; line ~56 `overflow: blockOverflow(follow)`. Preserve the host-invariant ordering (position/width/height/overflow applied LAST on `.skb-content-box`).
- [ ] **Step 3: `PublishedCanvas.tsx`** — `PublishedDocShape.blocks[].autofit?: boolean` → `follow?: boolean`; pass `follow={b.follow}` to `BlockFrameCore`. (The server publish pipeline will set `follow` at the coercion seam in Task 6.)
- [ ] **Step 4: Update the frame tests** (mechanical): every `autofit={…}` / `autofit:` on `BlockFrameCore` or the published doc → `follow={…}` / `follow:`. Keep the overflow assertions: `follow=true → 'hidden'`, `follow=false → 'auto'`. In `frames-autofit.test.ts`, the case "absent autofit defaults to scroll" stays correct (`follow` undefined → `'auto'`) — re-label its comment to "absent follow defaults to scroll (fix fallback)".
- [ ] **Step 5: Run + typecheck.** `bun run --filter @skb/block-kinds test`, `… typecheck`; `bun run --filter @skb/theme test`, `… typecheck`. Green.
- [ ] **Step 6: Commit** — `refactor(block-kinds,theme): frame overflow keys off follow boolean`

---

### Task 3: Wire types — persisted/transport shape

**Files:**
- Modify: `apps/web/src/api/client.ts` (`WorkingBlock`, `PublishedDoc`)
- Modify: `apps/server/src/db/schema.ts` (the `PublishedDoc`/working shape types only — NOT the DDL yet; DDL is Task 8)

- [ ] **Step 1:** In `client.ts` `WorkingBlock`: change `autofit?: 'off' | 'grow' | 'grow+shrink'` → `autofit?: 'follow' | 'fix'`; **remove** the `minRowSpan?: number | null` field. Update the doc comment ("MVP writes/reads only 'grow'" → "follow/fix; floor removed").
- [ ] **Step 2:** In `schema.ts`, the TS `PublishedDoc` shape (lines ~120-123): `autofit?: string` stays a string but document it as `'follow'|'fix'`; **remove** the `minRowSpan?` field from the shape.
- [ ] **Step 3: typecheck both.** `bun run --filter @skb/shckb-web typecheck` and `… @skb/shckb-server typecheck` — this is the **compile fan-out**: every consumer of `minRowSpan` / the old enum now errors. Capture the error list; it is the to-do for Tasks 4–8. Expect RED here (that's the point — the next tasks clear it).
- [ ] **Step 4:** Do NOT commit yet — leave the tree red and proceed to Task 4 (the wire change is only coherent once consumers are updated). *(Exception to per-task-green: Tasks 3+4+5 form one compile unit on the web side; commit at the end of Task 5. Server side clears in Tasks 6–8.)*

---

### Task 4: Web interaction core — delete the floor, retarget the gesture

**Files:**
- Modify: `apps/web/src/grid/useGridInteraction.ts`
- Modify: `apps/web/src/grid/useAutofitGesture.ts`
- Confirm (no change): `apps/web/src/grid/measureFit.ts` (the `Math.max(1, …)` 1-row min is follow's floor — cite it)
- Tests: `apps/web/src/grid/__tests__/{useAutofitGesture,floorResize,reconcileTo,autofitGestureAtomicity,moveAnchor}.test.{ts,tsx}`

- [ ] **Step 1: `useAutofitGesture.ts`** — remove the `floor` field from `UseAutofitGestureArgs`; change the reconcile target at line ~88 from `Math.max(f, fi)` to `Math.max(1, fi)` (the 1-row min); update the header comment ("effective = max(floor, fit)" → "follow target = fit, 1-row min in measureFit"). `enabled` keeps its boolean meaning, now fed `isFollow`.
- [ ] **Step 2: `useGridInteraction.ts`** —
  - Delete `minRowSpan` state, `setMinRowSpan`, the `initialMinRowSpan` config field, and the `minRowSpan` entries in the returned `Interaction` + its type.
  - Delete `clampFloorPreview` (exported fn) and `ResizeState.currentFit`.
  - In `beginResize`: drop the `autofitCtx` param; delete the `if (autofitCtx?.autofit && verticalOnly) { setMinRowSpan…; reconcileTo…; commitGesture… }` branch so **all** resizes go through `transform()` (this is the fix-mode path). Drop `currentFit` from the `setResize` calls.
  - Keep the `autofit: Record<string, string|null>` record + `setAutofit` (values are now `'follow'|'fix'`); update its doc comment.
- [ ] **Step 3: Rewrite the gesture tests.**
  - `useAutofitGesture.test.tsx`: every case passed `floor`; remove it; assert reconcile target = `Math.max(1, fit)` (e.g. fit=6 → 6; fit=0/empty → 1). Drop the "respects floor" cases.
  - `floorResize.test.ts`: this tested `clampFloorPreview` — **delete the file** (floor-resize no longer exists; fix-mode drag-resize is covered by the generic resize path + e2e in Task 9).
  - `reconcileTo.test.ts`, `moveAnchor.test.ts`: these test grid-engine/anchor math, not floor — leave unless they import the deleted `clampFloorPreview`/`currentFit` (fix imports if so).
  - `autofitGestureAtomicity.test.tsx`: `initialAutofit: { a: 'grow' }` → `{ a: 'follow' }`; the atomicity invariant is unchanged (follow blocks hold a live gesture).
- [ ] **Step 4: typecheck + test web.** `bun run --filter @skb/shckb-web typecheck` (still red on GridCanvas/EditorPage — cleared in Task 5) and `cd apps/web && bun x vitest run src/grid/__tests__/useAutofitGesture.test.tsx src/grid/__tests__/autofitGestureAtomicity.test.tsx`. The targeted gesture tests pass.

---

### Task 5: Web UI — toggle, freeze, per-mode resize, overflow, insert defaults

**Files:**
- Modify: `apps/web/src/grid/GridCanvas.tsx`
- Modify: `apps/web/src/grid/overlays.tsx` (ResizeHandles — per-mode handles) and `MeasureProbe.tsx` (prop rename)
- Modify: `apps/web/src/pages/EditorPage.tsx` (insert default + drop floor seed + save mapping + initial seed)
- Modify: `apps/web/src/grid/Properties.tsx` (if it has an autofit toggle — grep; mirror the GridCanvas change incl. active-block freeze)
- Tests: `apps/web/src/grid/__tests__/GridCanvasAutofitMenu.test.tsx`

- [ ] **Step 1: `GridCanvas.tsx`** —
  - `const isFollow = interaction.autofit[block.id] === 'follow';` (replaces `isAutofit === 'grow'`). Replace `isAutofit` everywhere with `isFollow`. `autofitGestureLocked` and `sheetInsertLocked` test `=== 'follow'`.
  - Pass `follow={isFollow}` to `BlockFrameCore`; inner div `overflow: isFollow ? 'hidden' : 'visible'` (unchanged mapping; the frame's `.skb-content-box` `blockOverflow(isFollow)` = `auto` for fix owns the scroll → no double scrollbar).
  - Probe mount gate: `isActive && isFollow && blockModule(block.kind)?.autofit?.canFollow !== false`.
  - Toggle gate (context menu): `blockModule(block.kind)?.autofit?.canFollow !== false` (was `!== false`).
  - Toggle item: `{ label: 'follow content', checked: isFollow, onSelect: () => interaction.setAutofit(block.id, isFollow ? 'fix' : 'follow') }`. (Inactive-block freeze is automatic: `rowSpan` already holds the committed fit, so switching to `fix` keeps that height.)
  - `gesture floor` arg removed from the `useAutofitGesture({…})` call (Task 4 dropped it); pass `enabled: isFollow`.
  - `ResizeHandles`: pass `canResizeVertical={!isFollow}` (replace the old `autofitCtx`).
- [ ] **Step 2: `overlays.tsx` ResizeHandles** — accept `canResizeVertical: boolean`; when `false`, render only the left/right (horizontal) handles, omit bottom/top/corner. Drop the old `autofitCtx` plumbing. `beginResize` is called without the removed param.
- [ ] **Step 3: `MeasureProbe.tsx`** — rename the `BlockFrameCore` `autofit` prop usage to `follow` (probe always renders a follow block → `follow={true}`).
- [ ] **Step 4: `EditorPage.tsx`** —
  - `initialAutofit` seed (line ~106): map server `b.autofit` straight through (it's already `'follow'|'fix'` after Task 8 migration; for safety coerce unknown/`null` → kind default via `blockModule(b.kind)?.autofit?.default ?? 'fix'`). **Delete** `initialMinRowSpan`.
  - `onBlockInserted` (lines ~117-121): replace the `af.default !== 'off'` gate + `setMinRowSpan(block.id, block.rowSpan)` with: `const af = blockModule(block.kind)?.autofit; if (af) interaction.setAutofit(block.id, af.default);` (always seed a mode; no floor seed).
  - `save()` (lines ~138-162): emit `autofit: interaction.autofit[id]` (mode string); **remove** `minRowSpan` from the `WorkingBlock` mapping.
- [ ] **Step 5: `Properties.tsx`** — grep for an autofit toggle; if present, mirror Step 1's toggle. **Active-block freeze:** if the toggle can fire while the block is active (live-growing), on `follow→fix` it must set `rowSpan` to the live `fit` before switching (the active block's `rowSpan` may lag the live measurement). Use `interaction.ops.transform(id, { rowSpan: liveFit })` then `setAutofit(id, 'fix')`. If `Properties` has no autofit control, note it and skip.
- [ ] **Step 6: Rewrite `GridCanvasAutofitMenu.test.tsx`** — assert the menu shows a `follow content` checkbox checked when mode is follow, unchecked → toggling writes `fix`; image (canFollow:false) shows no follow toggle; text kinds do.
- [ ] **Step 7: typecheck + test web (now fully green).** `bun run --filter @skb/shckb-web typecheck` and `bun run --filter @skb/shckb-web test`. Green.
- [ ] **Step 8: Commit (Tasks 3+4+5 together)** — `feat(web): autofit follow/fix — drop floor, per-mode resize, freeze-on-switch`

---

### Task 6: Read/publish coercion seams

**Files:**
- Modify: `apps/web/src/pages/ReadPage.tsx`
- Modify: `apps/server/src/render/publish-html.ts`

- [ ] **Step 1: `ReadPage.tsx`** (lines ~56-61) — change `autofit: b.autofit === 'grow'` to `follow: b.autofit === 'follow'` in the map that builds the `PublishedCanvas` doc (field renamed to `follow` in Task 2). Published render needs only `rowSpan` + `follow` (for overflow).
- [ ] **Step 2: `publish-html.ts`** `toRenderDoc` (lines ~17-25) — `autofit: b.autofit === 'grow'` → `follow: b.autofit === 'follow'`.
- [ ] **Step 3: typecheck both.** `bun run --filter @skb/shckb-web typecheck`, `bun run --filter @skb/shckb-server typecheck`.
- [ ] **Step 4: Commit** — `refactor: read/publish coerce autofit mode → follow boolean`

---

### Task 7: Server route — drop the floor invariant guard

**Files:**
- Modify: `apps/server/src/routes/notepages.ts`
- Test: `apps/server/test/autofit-route.test.ts`

- [ ] **Step 1: Rewrite the route test (red-ish).** In `autofit-route.test.ts`: **delete** the entire "floor invariant guard" `describe` (the 422 case). Rewrite the parsing test: a block with `autofit: 'follow'` (and no `minRowSpan`) round-trips through working-state; `autofit: 'fix'` round-trips; an invalid `autofit` value is rejected/coerced per the route's validation.
- [ ] **Step 2: `notepages.ts`** — line ~99: accept `autofit` only when `=== 'follow' || === 'fix'` (else null/omit). **Delete** the `minRowSpan` parse (lines ~86-87/99-100) and the **422 floor-invariant guard** (lines ~184-204) and the `minRowSpan` strip before `validateState` (lines ~188-191).
- [ ] **Step 3: Run server tests.** `cd apps/server && bun test test/autofit-route.test.ts` then `bun run --filter @skb/shckb-server test` (note: export tests still red until Task 8). The route + non-export suites pass.
- [ ] **Step 4: Commit** — `feat(server): route parses follow/fix; delete floor-invariant guard`

---

### Task 8: Persistence + export migration (FORMAT_VERSION 5→6, drop column)

**Files:**
- Modify: `apps/server/src/db/schema.ts` (drop `minRowSpan` column; autofit comment)
- Create: `apps/server/drizzle/0009_autofit_follow_fix.sql`
- Modify: `apps/server/src/export/format.ts` (`FORMAT_VERSION` 5→6; `ExportBlock`)
- Modify: `apps/server/src/export/migrate-format.ts` (v6 up/down)
- Modify: `apps/server/src/export/exporter.ts`, `importer.ts`
- Tests: `apps/server/test/{export-format,export-import}.test.ts`

- [ ] **Step 1: DB migration `0009_autofit_follow_fix.sql`** —
```sql
-- follow/fix redesign: migrate values, drop the floor column.
UPDATE blocks SET autofit = 'follow' WHERE autofit IN ('grow', 'grow+shrink');
UPDATE blocks SET autofit = 'fix'    WHERE autofit IS NULL OR autofit NOT IN ('follow', 'fix');
ALTER TABLE blocks DROP COLUMN min_row_span;
```
(Bun's SQLite supports `DROP COLUMN`. If a target environment is on SQLite < 3.35, fall back to a table rebuild — note this in the migration header.)
- [ ] **Step 2: `schema.ts`** — remove the `minRowSpan` column definition; change the `autofit` column comment to `'follow' | 'fix'`. Ensure drizzle's migration journal includes 0009 (follow the repo's drizzle setup — read how 0008 is registered).
- [ ] **Step 3: `format.ts`** — `FORMAT_VERSION = 6`; in `ExportBlock`, `autofit?: 'follow' | 'fix'`, **remove** `minRowSpan`.
- [ ] **Step 4: Write the v6 migration tests (red).** In `export-format.test.ts`: a v5 bundle (`autofit:'grow'`, `minRowSpan:2`) `up`-migrates to v6 with `autofit:'follow'` and no `minRowSpan`, on **both** working and `published.blocks`; `'off'`/null → `'fix'`. `down` (v6→v5): `'follow'`→`'grow'`, `'fix'`→`'off'`, `minRowSpan` reintroduced as `null` with a loss note. **Delete** the obsolete "v5→v4→v5 does not raise the floor" assertion.
- [ ] **Step 5: `migrate-format.ts`** — add the v6 up/down transforms:
```ts
// v5 → v6: autofit enum → follow/fix mode; drop minRowSpan (floor removed).
const toMode = (af: unknown) => (af === 'grow' || af === 'grow+shrink' ? 'follow' : 'fix');
const up5to6Block = (b: any) => { const { minRowSpan, ...rest } = b; return { ...rest, autofit: toMode(b.autofit) }; };
// v6 → v5 (lossy): follow→grow, fix→off; floor reintroduced as null.
const down6to5Block = (b: any) => ({ ...b, autofit: b.autofit === 'follow' ? 'grow' : 'off', minRowSpan: null });
```
Apply each to `blocks` AND `published.blocks`; register them in the migration ladder exactly as the v5 transforms are; add the down-loss message (e.g. `"autofit 'fix'→'off' and floor reset (follow/fix collapsed for v5)"`).
- [ ] **Step 6: `exporter.ts`** (lines ~119-120) — stop emitting `minRowSpan`; emit `autofit` mode. `importer.ts` (lines ~81-82, ~276-278) — drop the `minRowSpan` type-guard + insert; tighten the `autofit` guard to `'follow'|'fix'`.
- [ ] **Step 7: Update `export-import.test.ts`** — the v5 round-trip fixtures (`autofit:'grow'`+`minRowSpan:2`) → v6 (`autofit:'follow'`, no minRowSpan); assert survival across export→import.
- [ ] **Step 8: Run full server suite.** `bun run --filter @skb/shckb-server test`. Green.
- [ ] **Step 9: Commit** — `feat(server): FORMAT_VERSION 6 follow/fix migration; drop min_row_span column`

---

### Task 9: Fixtures + e2e

**Files:**
- Modify: `e2e/fixtures/login.ts` (`E2EBlock` type)
- Modify: `e2e/autofit-fit-shells.spec.ts`, `autofit-all-kinds.spec.ts`, `autofit-publish-clip.spec.ts`, `autofit-grow-shrink.spec.ts`, `autofit-ghost-preview.spec.ts`
- Modify: `apps/server/scripts/seed-bridge.ts`

- [ ] **Step 1: `e2e/fixtures/login.ts`** — `E2EBlock.autofit?: 'follow' | 'fix' | null`; **remove** `minRowSpan`.
- [ ] **Step 2: Re-seed the existing specs** — replace `autofit:'grow'`→`'follow'`, `autofit:'off'`→`'fix'`, delete `minRowSpan`. Rename `autofit-grow-shrink.spec.ts` → `autofit-follow.spec.ts`; its grow/shrink reversibility behavior IS follow — keep the typing-grows/deleting-shrinks assertions but update the "shrinks back to floor" expectation to "shrinks to fit (1-row min)". In `autofit-all-kinds.spec.ts`, the toggle label becomes `follow content` and the image case asserts the follow toggle is absent. In `autofit-publish-clip.spec.ts`, `'grow'`→`'follow'` (overflowY hidden) and `'off'`→`'fix'` (overflowY auto).
- [ ] **Step 3: Add `e2e/autofit-fix.spec.ts` (new behaviors):**
  - a `fix` block whose content exceeds its rowSpan shows a vertical scrollbar inside the frame (published + editor);
  - `follow → fix` freezes at the current displayed height (toggle, then assert rowSpan unchanged from the followed height);
  - a `fix` block is drag-resizable (resize handle changes rowSpan) while a `follow` block exposes no bottom resize handle.
- [ ] **Step 4: `seed-bridge.ts`** (lines ~82-83, 108-152) — `autofit` values → follow/fix, drop `minRowSpan` from the seed type + blocks.
- [ ] **Step 5: Run e2e.** Start servers (or rely on the playwright webServer config) and `bun run test:e2e`. (Run under the harness that worked before — `playwright test` via `@playwright/test`.) All green.
- [ ] **Step 6: Commit** — `test(e2e): follow/fix specs — fix-overflow, freeze-on-switch, fix-resize`

---

### Task 10: Doc-comment cleanup

**Files:**
- Modify: `packages/grid-engine/CONTRACT.md`, `apps/web/src/grid/captureLayoutSnapshot.ts`, `packages/grid-engine/src/__tests__/push-resize.test.ts` (headers/comments only)

- [ ] **Step 1:** Grep these for `max(floor, fit)`, `floor`, `'grow'`, `grow+shrink` in comments; replace with follow/fix vocabulary ("follow target = fit, 1-row min"). The grid-engine op (`pushResize`/`reconcileTo`) takes only a target rowSpan — **no logic change**; verify `bun run --filter @skb/grid-engine test` stays green.
- [ ] **Step 2: Commit** — `docs: scrub floor/grow vocabulary from grid-engine contract + comments`

---

### Final verification (before finishing-a-development-branch)

- [ ] `bun run test` — whole suite green (theme, block-kinds, web, server, grid-engine).
- [ ] `bun run --filter @skb/shckb-web typecheck` and `… @skb/shckb-server typecheck` and `… @skb/block-kinds typecheck` and `… @skb/theme typecheck` and `… @skb/grid-engine typecheck` — all clean.
- [ ] `bun run test:e2e` — all green.
- [ ] Grep sweep: no remaining `minRowSpan`, `'grow'`, `'grow+shrink'`, `clampFloorPreview`, `setMinRowSpan` in `apps/`, `packages/`, `e2e/` (except the v6 `down`-migration that intentionally reads/writes the legacy `'grow'`/`minRowSpan` for v5 compat).
- [ ] Adversarial multi-agent review of the whole branch (per ultracode): correctness of the migration up/down round-trip, the freeze-on-switch active path, fix-overflow with no double scrollbar, gesture atomicity keyed off `follow`, and that no floor remnant survives.
- [ ] Hand off via superpowers:finishing-a-development-branch.
