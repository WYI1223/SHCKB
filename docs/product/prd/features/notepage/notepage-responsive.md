# Feature PRD: Notepage responsive

| Field | Value |
|---|---|
| Status | draft (pass 4 — viewport projection + BDD rewrite) |
| Last updated | 2026-05-22 |
| Owner | W_YI |
| Parent PRD | [notepage.md](./notepage.md) |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

---

## What this PRD covers

Notepage responsive 定义同一 notepage 在 desktop/tablet/mobile viewport 下如何投影为可阅读、可编辑的网页体验。

本 sub-PRD 拥有：

- logical 12-col GridState 到 desktop/tablet/mobile 的 render projection。
- viewport-width breakpoint rules。
- mobile/tablet touch affordance baseline。
- mobile authoring constraints。
- responsive typography readability rule。
- responsive BDD acceptance scenarios。

不拥有：

- Public/private route and SSR behavior → [notepage-view.md](./notepage-view.md)。
- Desktop authoring algorithm contract → [notepage-editing.md](./notepage-editing.md)。
- Parent data boundary / visibility model → [notepage.md](./notepage.md)。
- CSS framework implementation → [ADR-0016]。

---

## Why

Notepage uses a constrained canvas model, but readers and authors will use it across small phones, tablets, laptops, desktops, and mixed touch/mouse devices. Responsive behavior must preserve the same notepage identity and GridState while making the page usable at each viewport.

The key product rule is:

> **Viewport projection is render-only. It never changes the canonical GridState.**

This lets authors create one notepage instead of maintaining separate mobile/desktop layouts.

---

## The whole picture

```text
 notepage responsive model
 ═════════════════════════

  canonical layout state
      logical 12-col GridState
      never rewritten by viewport changes

  viewport projection
      desktop -> 12-col full projection
      tablet  -> 12-col compact projection
      mobile  -> 1-col flow

  input modality
      touch / mouse / pen affect affordances
      input modality does not pick the projection

  authoring capability
      desktop/tablet: full grid editing path
      mobile: read-first, limited authoring

  typography
      readable per breakpoint/theme tokens
      no mandate for continuous viewport-fluid font sizing
```

---

## User-Facing Experience

### Desktop Projection

Desktop viewport uses the native 12-col projection. Authors get the full editing affordance set owned by [notepage-editing.md](./notepage-editing.md). Readers see the same layout without authoring controls.

### Tablet Projection

Tablet viewport keeps the 12-col projection, but renders it as a compact projection with narrower container constraints and touch-adjusted affordances where needed. Tablet should preserve author layout intent instead of collapsing to an intermediate 6-col grid. If a tablet viewport becomes too narrow to keep content readable, the page should use readability safeguards such as overflow, zoom, min-width, or mobile flow at the mobile breakpoint rather than rewriting GridState.

### Mobile Projection

Mobile viewport uses 1-col flow. Blocks are ordered by canonical reading/layout order. Mobile reader experience is M2 critical.

Mobile authoring is intentionally limited in M2:

- full grid resize is not available on mobile;
- freeform desktop-like layout editing is not required on mobile;
- content editing for supported block kinds may be available;
- simple insert/delete may be available where safe;
- row-level reorder or mobile-first editing polish can move to M3+ unless explicitly promoted.

Mobile must provide a clear path back to full editing on tablet/desktop when an operation is unsupported.

### Input Modality

Viewport width determines projection. Touch/mouse/pen only change affordances.

Examples:

- A wide touch laptop can still use desktop projection.
- A narrow desktop browser window uses compact or mobile projection according to viewport width.
- iPad width determines tablet/desktop projection; touch changes handles/targets, not layout semantics.

### Typography And Readability

Text must be readable at each breakpoint. The product requires responsive typography tokens or breakpoint-specific readable styles, not continuous font-size scaling with viewport width.

Long words, code, tables, media, and plugin-rendered content must avoid breaking the whole page. Individual block RenderView may own its own overflow behavior, but the notepage shell must not make content unreadable by shrinking it below usable bounds.

---

## BDD Acceptance Scenarios

These scenarios define product behavior.

### M2 — Minimum Shippable Responsive Behavior

```gherkin
Scenario: Desktop uses 12-column projection
  Given a notepage has logical 12-column GridState
  When a reader opens it in a viewport at least 1024px wide
  Then the notepage renders in the desktop 12-column projection
  And the underlying GridState is unchanged
```

```gherkin
Scenario: Tablet preserves 12-column compact projection
  Given a notepage has logical 12-column GridState
  When a reader opens it on a tablet-width viewport
  Then the notepage renders in a compact 12-column projection
  And layout proportions such as 2/3 + 1/3 remain representable
  And the projection is based on viewport width, not touch detection
  And the underlying GridState is unchanged
```

```gherkin
Scenario: Mobile uses 1-column flow at the M2 default mobile breakpoint
  Given a notepage has multiple blocks in logical grid order
  When a reader opens it in a viewport narrower than 640px
  Then the blocks render in a one-column readable flow
  And block order follows canonical reading/layout order
  And the underlying GridState is unchanged
```

```gherkin
Scenario: Resizing viewport does not mutate data
  Given an author is viewing a notepage on desktop
  When the viewport is resized across desktop, tablet, and mobile breakpoints
  Then the rendered projection changes
  And the notepage GridState does not change
  And visibility/public-read state does not change
```

```gherkin
Scenario: Mobile reader can read without layout-specific editing controls
  Given a public notepage is opened on mobile
  When a reader scrolls through the page
  Then the content remains readable
  And mobile view does not expose desktop grid resize controls
  And native scroll and zoom are not hijacked
```

```gherkin
Scenario: Mobile author sees clear limitation for unsupported grid editing
  Given an authenticated author opens a notepage on mobile
  When the author attempts a desktop-only grid operation such as freeform resize
  Then the operation is unavailable or rejected clearly
  And the author is told that full grid editing requires tablet or desktop
  And the GridState remains unchanged
```

```gherkin
Scenario: Typography remains readable at each breakpoint
  Given a public notepage contains normal text content
  When the reader opens it on mobile, tablet, and desktop
  Then text uses readable sizing for that breakpoint
  And the product does not require continuous viewport-based font scaling
```

### M3 — Responsive Polish

- Mobile authoring may add safer row reorder or stronger insert/delete flows.
- Breakpoint transitions should reduce visible jumps where feasible.
- Touch affordances should be clearer and easier to use.
- Print layout may be introduced as a separate projection if prioritized.

### M4 — Production Responsive Behavior

- All built-in blocks are verified across desktop/tablet/mobile view projections.
- Orientation changes are polished.
- Large/complex notepages have explicit responsive performance behavior.

---

## Reference

### Projection Rules

| Viewport | Projection | M2 author capability |
|---|---|---|
| Desktop | 12-col full projection | Full grid editing path |
| Tablet | 12-col compact projection | Full grid editing path, touch-adjusted affordances if needed |
| Mobile (< 640px M2 default) | 1-col flow | Read-first; limited authoring; no full grid resize |

### Responsive Invariants

| Invariant | Meaning |
|---|---|
| **Logical 12-col GridState** | Canonical layout state remains 12-col regardless of viewport. |
| **Projection is render-only** | Breakpoint changes never rewrite persisted layout state. |
| **Viewport width decides projection** | Touch/mouse/pen affects affordance, not projection choice. |
| **Tablet preserves layout fidelity** | Tablet does not collapse to 6-col by default; it keeps 12-col compact projection unless future testing proves otherwise. |
| **Mobile is read-first** | Mobile must prioritize readable public/private viewing over full layout editing. |
| **Typography is readable by token/breakpoint** | Readability is required; continuous viewport-scaling font size is not. |
| **Reader/author layout match** | Same viewport sees same projection; authoring controls are the difference. |

### Non-Goals

- ❌ Changing GridState column count per viewport.
- ❌ Separate mobile layout state.
- ❌ Full mobile-native grid editor in M2.
- ❌ Per-block responsive override in M2.
- ❌ Continuous viewport-based font scaling requirement.
- ❌ Native iOS/Android app responsive behavior.

### Edge Cases

| Scenario | Expected behavior |
|---|---|
| Narrow tablet viewport below mobile breakpoint | Mobile 1-col projection can apply, because viewport width decides. |
| iPad landscape / wide tablet viewport | 12-col projection applies; touch affordances may still adjust. |
| Touch laptop at desktop width | Desktop projection with touch-capable targets where needed. |
| Browser resized mid-edit | Projection changes; GridState and accepted author working state remain unchanged. |
| Long code/text in mobile block | Block may wrap or scroll internally; page shell remains readable. |
| Very wide desktop / 4K | Still 12-col; page may use max-width/readability constraints. |
| JS disabled for public read | Public SSR HTML remains readable for supported block kinds; authoring unavailable. |

### Dependencies

PRD-layer upstream dependencies:

- **Parent PRD**: [notepage.md](./notepage.md)
- **Sibling PRDs**: [notepage-view.md](./notepage-view.md) / [notepage-editing.md](./notepage-editing.md)
- **Cross-folder PRDs**:
  - [theme-system.md](../theme-system/theme-system.md)
  - [theme-system-user-view.md](../theme-system/theme-system-user-view.md)
  - [theme-system-author-view.md](../theme-system/theme-system-author-view.md)
  - [plugin-system.md](../plugin-system/plugin-system.md)
- **External services**: none for M2.

### Open Questions

1. **Mobile content editing extent**: M2 allows limited authoring but exact insert/delete/content-edit affordance remains implementation-shaped.
2. **Mobile row reorder**: may be M3 unless owner promotes it.
3. **Print projection**: likely separate from viewport mode; not M2.
4. **Per-block responsive override**: Phase 2+ only.

### Resolved Scope Notes

- **M2 mobile breakpoint default**: mobile projection starts below `640px`; future design/testing may revise this through PRD update.

### Surfaced ADR Debts

- **[ADR-0003] render projection wording**: clarify logical 12-col state, desktop/tablet 12-col projection, and mobile 1-col flow.
- **[ADR-0010] responsive performance budget**: projection changes and mobile rendering need measurable budgets.
- **[ADR-0016] CSS framework / responsive utilities**: ensure CSS strategy can express projection rules without mutating GridState.
- **[ADR-0014] plugin RenderView overflow behavior**: plugin content must not break responsive shell readability.
- **Tablet compact projection**: ADR/design follow-up should verify compact 12-col rendering constraints, min-width behavior, and overflow/zoom safeguards.

详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) PRD-surfaced debts log。

### References

- **Aligning ADRs**（pending PRD-driven rework; see top disclaimer）:
  - [ADR-0003](../../../../engineering/decisions/ADR-0003-grid-engine-contract.md) — logical 12-col + render projection
  - [ADR-0010](../../../../engineering/decisions/ADR-0010-performance-budget.md) — responsive performance
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — RenderView/EditView behavior across projection
  - [ADR-0016](../../../../engineering/decisions/ADR-0016-css-framework.md) — CSS framework + responsive utilities
- **Parent**: [notepage.md](./notepage.md)
- **Sibling PRDs**: [notepage-view.md](./notepage-view.md) / [notepage-editing.md](./notepage-editing.md)
- **Cross-folder PRDs**: [theme-system.md](../theme-system/theme-system.md) / [theme-system-user-view.md](../theme-system/theme-system-user-view.md) / [theme-system-author-view.md](../theme-system/theme-system-author-view.md) / [plugin-system.md](../plugin-system/plugin-system.md)
- **Discussion record**: [notepage-prd-alignment-2026-05-22.md](../../../../engineering/design/discussions/notepage-prd-alignment-2026-05-22.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)
- **PRD form**: [prd-discipline.md](../../../../process/methods/prd-discipline.md)

### Changelog

- 2026-05-16 initial draft；从 features/canvas-editing.md mobile responsive 段拆出 + 扩展（3 breakpoint / touch baseline / 跨 viewport 一致 / mobile 编辑限制）。
- 2026-05-16 pass 2 layer relationship fix（owner critical framing）：Dependencies 段只列 upstream PRD deps；ADRs 移到 References "Aligning ADRs" 段。
- 2026-05-16 hygiene pass 3 (owner review): 相对链接深度修正。
- 2026-05-22 pass 4 — viewport projection + BDD rewrite：改为 What / Why / Whole picture / User-facing experience / BDD Acceptance / Reference；收口 viewport-width projection、mobile 1-col、touch as affordance only、mobile limited authoring、readable typography without continuous viewport font scaling。
- 2026-05-22 pass 4 follow-up：owner rejected tablet 6-col as too lossy for layout fidelity；tablet now preserves 12-col compact projection, while mobile remains 1-col flow。
- 2026-05-22 pass 4 cleanup：set `< 640px` as the M2 default mobile breakpoint and aligned ADR debt wording with desktop/tablet 12-col plus mobile 1-col projection.
