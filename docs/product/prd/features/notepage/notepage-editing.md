# Feature PRD: Notepage editing

| Field | Value |
|---|---|
| Status | draft (pass 6 — mode model update [ADR-0031]) |
| Last updated | 2026-06-18 |
| Owner | W_YI |
| Parent PRD | [notepage.md](./notepage.md) |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

---

## What this PRD covers

Notepage editing 定义 author 如何在 authenticated authoring surface 中创建内容、调整布局、编辑 block、删除 block，并把完成后的状态更新为 public-reader 可见状态。

本 sub-PRD 拥有：

- author working state 的编辑体验。
- block insert / move / resize / delete 的 user-observable behavior。
- grid algorithm contract 的 product-facing obligations。
- editor feedback, failure feedback, and accessibility baseline。
- editing BDD acceptance scenarios。
- complete/update-public action 的 editing-side product expectation, while exact UI remains open。

不拥有：

- Public/private read route and SSR behavior → [notepage-view.md](./notepage-view.md)。
- Viewport projection / mobile edit limitations → [notepage-responsive.md](./notepage-responsive.md)。
- Parent visibility/data boundary decisions → [notepage.md](./notepage.md)。
- Single block editor internals → [ADR-0013] / block plugin contract。
- Exact visual form factor chosen by theme/dev layer。

---

## Why

Editing is the author productivity surface. It must make notepage composition feel immediate without exposing unfinished work to readers.

The key product split from parent PRD is:

- Author edits operate on **author working state**.
- Public readers see **last completed public state** (a separately published edition).
- Editing and reading are **two modes of the same page** for the author: the author can switch between editing and a read-only preview of their own draft instantly, without a save step and without losing their place. The published edition the public sees is a distinct, separate thing.
- Author must explicitly complete/update public state before reader-visible content changes.

This lets the product avoid a user-facing "draft version" lifecycle while still protecting public readers from half-finished edits. Architecture for the mode model: [ADR-0031].

---

## The whole picture

```text
 notepage editing model
 ══════════════════════

  authoring surface
      authenticated
      works on author working state
      can switch to read-only preview of own draft (instant; no save step; no position loss)
      edit and read = two modes of the same page

  grid operations
      insert / move / resize / delete
      engine validates layout invariants
      invalid mutation = no state change + visible failure feedback

  block editing
      block EditView owns internal editing behavior
      author should see local feedback quickly
      block content becomes part of author working state

  public update
      explicit complete/update-public action
      promotes completed working state to public-read state
      exact UI label/placement TBD

  UI freedom
      palette / handles / selection / feedback form are theme/dev decisions
      product locks behavior, not form factor
```

---

## Author-Facing Experience

### Starting From An Empty Private Notepage

New notepages start private. An author can open the authoring surface, add a first markdown block, write content, and keep editing without exposing the page to anonymous readers.

The authoring surface should make the empty state actionable, but the exact form factor is not fixed by this PRD.

### Edit/Read Mode Toggle

While working on a page, the author can switch to a read-only view of their own working content at any moment. The switch is instant — no save step is required and the author does not lose their place in the content. Switching back to editing is equally instant.

This read-only view shows the author's current working draft, not the published edition that public readers see. The author can use it to check how the page reads before choosing to publish.

**Following internal links while editing** takes the author to the editing view of the target page, not to a public read view. The author stays in editing mode as they navigate their own content. A link can target a specific block on the destination page; following such a link brings that block into view.

### Editing Block Content

When the author edits markdown or another supported block kind, the editor should show author-side feedback immediately where feasible. This is local/author feedback; it does not imply public readers see the change.

Author working state must persist reliably enough that refresh/navigation does not lose normal edits once they have been accepted by the editor.

### Layout Operations

The author can:

- insert a block;
- move an existing block;
- resize a block where supported by viewport/editor mode;
- delete a block.

Layout operations must preserve grid invariants and surface failures. The user must be able to understand that an operation failed and broadly why.

- **Vertical resize handle on an auto-fit block sets the floor** (minimum height), not a fixed
  height: content taller than the floor keeps the block at content height; dragging shorter
  than current content "bottoms out" at the content line. Width resize behaves as before.
- Auto-fit reflow is **reversible within an active editing session** and never disturbs blocks
  in columns the edited block does not occupy, within that session (see blocks.md / [ADR-0028]).

### Gravity Toggle

The authoring surface exposes the per-notepage gravity setting ([notepage.md] Gravity Setting): with gravity ON, layout operations re-settle blocks upward; with gravity OFF, the author places blocks freely and floating layouts persist. The toggle's exact control form factor is a dev/theme decision; the behavior — author-only ownership, per-page persistence, no GridState rewrite on toggle itself — is product-locked. Re-enable collapse UX follows the parent PRD's open question.

### Completing Public State

For public notepages, author working edits do not automatically change reader-visible content. The author must have an explicit complete/update-public action that makes the completed state visible to public readers.

The exact label is open. Product examples include "Update public page", "Publish changes", or "Done editing", but this PRD only requires the behavior.

### Accessibility

M2 must not require a mouse-only editing model. Keyboard and assistive technology support are part of the editing product baseline, even if exact keybindings remain dev/theme decisions.

---

## BDD Acceptance Scenarios

These scenarios define product behavior.

### M2 — Minimum Shippable Editing

```gherkin
Scenario: Author creates first content in a private notepage
  Given an authenticated author has created a new private notepage
  When the author adds a markdown block
  And writes markdown content
  Then the author sees the edited content in the authoring surface
  And anonymous readers cannot access the private notepage content
```

```gherkin
Scenario: Insert fits a new block into available space
  Given an author is editing a notepage with available grid space
  When the author inserts a block from the available block types
  Then the block appears in a valid grid position
  And the layout remains valid
  And the engine does not need to know the block kind's semantic meaning
```

```gherkin
Scenario: Move preserves existing block size
  Given an author is editing a notepage with an existing block
  When the author moves the block to a valid empty position
  Then the block moves to the new position
  And the block keeps its previous size
  And the layout remains valid
```

```gherkin
Scenario: Resize changes size only when valid
  Given an author is editing a notepage with a selected block
  When the author resizes the block to a valid size
  Then the block size changes
  And the layout remains valid
  When the author attempts an invalid resize
  Then the block state does not change
  And the author receives failure feedback
```

```gherkin
Scenario: Delete removes block and stabilizes layout
  Given an author is editing a notepage with multiple blocks
  When the author deletes one block
  Then the block is removed
  And remaining blocks settle according to the grid gravity rule
  And the layout remains valid
```

```gherkin
Scenario: Public readers do not see unfinished edits
  Given a notepage is public
  And public readers can see its completed public state
  When the author changes content in the authoring surface
  Then the author sees the working change
  And public readers still see the previous completed public state
```

```gherkin
Scenario: Author updates public state after editing
  Given a public notepage has author working changes
  When the author completes or updates the public state
  Then public readers can see the updated content
  And the public read route still has no authoring controls
```

```gherkin
Scenario: Editing can be completed without a mouse
  Given an author is using keyboard navigation
  When the author focuses blocks and performs supported editing operations
  Then the author can complete the M2 editing path without requiring pointer-only actions
```

### M3 — Editing Breadth

- At least 5 block kinds can be inserted and edited.
- Failure feedback has non-color affordance where possible.
- Keyboard accessibility receives deeper validation across editing operations.
- Author update-public action has a polished, discoverable UI.

### M4 — Editing Polish

- All PRD-approved built-in block kinds can be edited across the supported catalog.
- Undo/redo ships only after scope across block editor state and GridState is ratified.
- Multi-select remains future unless explicitly promoted.

---

## Reference

### Algorithm Contract

These are product-facing obligations of the grid engine behavior validated by the existing prototype and ADR direction. Exact implementation remains ADR/code-level.

| Contract | Product meaning |
|---|---|
| **Insert hole-fill** | New block proposed size may be clamped to available hole; too-small holes reject. |
| **Kind-opaque layout** | Grid engine handles geometry; block semantic meaning belongs to plugin/block layer. |
| **Move preserves size** | Moving an existing block does not auto-shrink it to fit like insert. |
| **Resize axes** | Resize supports the agreed axes where mode/viewport allows; invalid transforms reject. |
| **Atomic resize transform** | Top/left resize changes position and span together so state never enters broken intermediate form. |
| **Gravity-stable state** | Mutating operations settle into the chosen gravity-stable layout. |
| **Invalid op = state no-op + user feedback** | Rejected operations do not mutate state and must be visible to the author. |

### UI Freedom

This PRD intentionally does not prescribe the visual/control form:

| Concern | Examples allowed |
|---|---|
| Insert entry | toolbar, palette, slash command, context menu, empty-state action |
| Selection visual | outline, shadow, tint, focus ring |
| Drag/resize handles | always visible, hover, focus, touch-specific handles |
| Reject feedback | toast, inline message, status area, accessible announcement |
| Keyboard bindings | standard web/OS conventions chosen by implementation |
| Palette sorting | category, frequency, alphabetical |

Themes may vary the form factor as long as parent and editing behavior invariants remain true.

### Non-Goals

- ❌ Public read route / SEO behavior.
- ❌ Mobile/tablet projection rules.
- ❌ Theme cascade internals and exact visual affordance choices.
- ❌ Block kind enumeration.
- ❌ Multi-select in M2.
- ❌ Product-level draft version.

### Edge Cases

| Scenario | Expected behavior |
|---|---|
| Empty notepage | Author can discover at least one way to add the first block. |
| No grid space for insert | Insert rejects and author receives understandable feedback. |
| Move out of bounds | Block remains at prior valid position and author receives feedback. |
| Resize below minimum | Resize rejects and state remains valid. |
| Delete selected block | Selection clears or moves predictably; layout remains valid. |
| Network fails after accepted local edit | Author sees persistence failure/retry state; public state is not updated accidentally. |
| Session expires mid-edit | Editing operations are disabled or fail clearly; private content is not exposed. |
| Same notepage open in multiple tabs | M2 uses simplified conflict semantics; no CRDT or explicit collaborative conflict UX. |

### Dependencies

PRD-layer upstream dependencies:

- **Parent PRD**: [notepage.md](./notepage.md)
- **Sibling PRDs**: [notepage-view.md](./notepage-view.md) / [notepage-responsive.md](./notepage-responsive.md)
- **Cross-folder PRDs**:
  - [authentication.md](../authentication/authentication.md)
  - [identity.md](../authentication/identity.md)
  - [theme-system.md](../theme-system/theme-system.md)
  - [theme-system-author-view.md](../theme-system/theme-system-author-view.md)
  - [plugin-system.md](../plugin-system/plugin-system.md)
- **External services**: none for M2.

### Open Questions

1. **Update-public action UX**: exact label, placement, and whether the explicit reader-visible update action is visually coupled with save controls remain open; the requirement for an explicit reader-visible update is not open.
2. **Persistence semantics**: exact autosave/retry timing belongs to implementation/ADR, but accepted author edits must not be casually lost.
3. **Undo/redo scope**: per-block editor undo vs notepage GridState undo vs combined history.
4. **Multi-tab conflict policy**: M2 can remain simplified, but ADR/API should eventually define conflict semantics.
5. **Mobile editing capability**: consumed from [notepage-responsive.md](./notepage-responsive.md); this PRD owns desktop/tablet-capable editing behavior.

### Surfaced ADR Debts

- **[ADR-0003] grid engine contract**: ensure pass 4/5 PRD language aligns with hole-fill, move-size preservation, resize axes, atomic transform, and gravity.
- **[ADR-0013] block editor state**: clarify how block internal editing state participates in author working state.
- **[ADR-0014] plugin contract**: EditView must support authoring without leaking public read state.
- **[ADR-0009] mutation API**: update-public action and author working state persistence need endpoint semantics.
- **Undo/redo ADR or ADR extension**: unresolved cross-layer behavior.
- **Conflict semantics**: multi-tab/last-write behavior needs explicit API/substrate alignment.
- **[ADR-0031] view-mode navigation + first-class links** (proposed, 2026-06-17): surface model (edit/read modes of same page, draft preview, published edition); mode-preserving navigation from editing; block-targeted links. Realizes the mode-model invariants added in this PRD's pass 6.

详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) PRD-surfaced debts log。

### References

- **Aligning ADRs**（pending PRD-driven rework; see top disclaimer）:
  - [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) — author working state / public read state persistence
  - [ADR-0003](../../../../engineering/decisions/ADR-0003-grid-engine-contract.md) — gravity / drop intent / AABB invariants
  - [ADR-0009](../../../../engineering/decisions/ADR-0009-api-style.md) — mutation endpoints
  - [ADR-0010](../../../../engineering/decisions/ADR-0010-performance-budget.md) — drag fps / op latency
  - [ADR-0013](../../../../engineering/decisions/ADR-0013-markdown-tile-editor.md) — block EditView internals
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — defaultSize / EditView / RenderView contract
  - [ADR-0031](../../../../engineering/decisions/ADR-0031-view-mode-navigation.md) — view-mode surface model, mode-preserving navigation from editing, first-class links (downstream of this PRD)
- **Parent**: [notepage.md](./notepage.md)
- **Sibling PRDs**: [notepage-view.md](./notepage-view.md) / [notepage-responsive.md](./notepage-responsive.md)
- **Cross-folder PRDs**: [authentication.md](../authentication/authentication.md) / [identity.md](../authentication/identity.md) / [theme-system.md](../theme-system/theme-system.md) / [theme-system-author-view.md](../theme-system/theme-system-author-view.md) / [plugin-system.md](../plugin-system/plugin-system.md)
- **Contract**: [grid-engine CONTRACT.md](../../../../../packages/grid-engine/CONTRACT.md)
- **Frozen DI**: [grid-redesign-2026-05-11.md](../../../../engineering/design/_frozen/grid-redesign-2026-05-11.md)
- **Prototype references**:
  - `carryover/_reference/prototype/useGridInteraction.ts`
  - `carryover/_reference/prototype/shared-overlays.tsx`
  - `carryover/_reference/prototype/MiniPalette.tsx`
- **Discussion record**: [notepage-prd-alignment-2026-05-22.md](../../../../engineering/design/discussions/notepage-prd-alignment-2026-05-22.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)
- **PRD form**: [prd-discipline.md](../../../../process/methods/prd-discipline.md)

### Changelog

- 2026-05-16 initial draft；从 features/canvas-editing.md 拆出 edit-specific 内容。
- 2026-05-16 pass 2 (owner review against prototype)：WHAT vs HOW 边界 sharpen；algorithm contract 与 prototype 验证对齐；implementation prescriptions 移出 PRD；keyboard a11y baseline 保留。
- 2026-05-16 pass 3 layer relationship fix（owner critical framing）：Dependencies 段只列 upstream PRD deps；ADRs / Contract / Prototype 移到 References。
- 2026-05-16 hygiene pass 4 (owner review)：relative links fixed；kind-opaque insert signature corrected；invalid op changed from silent no-op to state no-op + mutation rejected + UI must surface failure。
- 2026-05-22 pass 5 — authoring state + BDD rewrite：改为 What / Why / Whole picture / Author-facing experience / BDD Acceptance / Reference；同步 parent private/public、author working state vs public read state、update-public action、BDD acceptance discipline，同时保留 algorithm contract as product-facing obligations。
- 2026-06-11 gravity toggle absorption：Author-Facing Experience 加 Gravity Toggle 节（行为 product-locked / 形态 dev-theme / re-enable UX 随 parent open question）；对应 [notepage.md] 2026-06-11 Gravity Setting 决策。
- 2026-05-23 closeout：收窄 update-public Open Question；只保留 label / placement / save-control coupling，explicit reader-visible update boundary 不再重开。
- 2026-06-14 autofit PRD pass: Layout Operations 增 auto-fit resize 语义（floor-not-fixed-height / bottoms-out / width-unchanged）+ session-reversibility + 旁列不扰（source: autofit spec §9 / [ADR-0028]）。
- 2026-06-18 pass 6 — mode model update [ADR-0031]：Why 节更新为"edit/read 是同一页的两个模式、即时切换、无需保存、不丢位置；published edition 是独立分开的东西"；Whole picture authoring surface 描述同步；新增 Edit/Read Mode Toggle 节（instant toggle、draft preview、following links while editing stays in edit mode、block-targeted links）；Surfaced ADR Debts + References 新增 ADR-0031。
