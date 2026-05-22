# Feature PRD: Notepage (top-level)

| Field | Value |
|---|---|
| Status | draft (pass 4 — parent model + BDD rewrite) |
| Last updated | 2026-05-22 |
| Owner | W_YI |
| Parent PRD | [project.md](../../project.md) |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

---

## What this PRD covers

Notepage 是 SHCKB 的核心 user-facing object：一个作者创建、编辑、设为 private/public，并由 reader 通过网页阅读的内容页面。

本 PRD 的边界是 **single-notepage foundation**：只定义一个 notepage 自身成立所需的基础能力。它不试图描述 SHCKB 未来完整的知识组织体验，也不把当前单页模型解释成产品最终边界。

本 parent PRD 锁 notepage feature folder 的共同产品模型：

- **Notepage data boundary**：page metadata + visibility/public-read state + GridState/layout + block state/content + theme reference/override。
- **Author/read separation**：authoring surface 可以即时反馈编辑；public reader 只看到 last completed public state。
- **Visibility model**：new notepage defaults to private；M2 只有 private/public，不暴露 product-level draft version。
- **Route classes**：canonical public read route / authenticated authoring route / noindex preview route；具体 path syntax 不在 parent PRD 锁死。
- **Sub-PRD ownership**：view / editing / responsive 各自拥有细节，但不能重新打开 parent invariants。
- **BDD acceptance discipline**：Acceptance uses user/system observable scenarios；Product Decisions / Invariants / References remain normal PRD sections.

具体细节归 sub-PRD：

- Reader/public/private read behavior 归 [notepage-view.md](./notepage-view.md)。
- Author insert/move/resize/delete/editor behavior 归 [notepage-editing.md](./notepage-editing.md)。
- Viewport projection and touch/mobile behavior 归 [notepage-responsive.md](./notepage-responsive.md)。

---

## Why

**为什么 notepage 是产品核心对象**：

SHCKB 的最短价值路径是 author 创建一个 notepage，写入内容，决定是否公开，然后 reader 能稳定访问和阅读。Notepage 不是纯编辑器 canvas，也不是纯文档页面；它同时承载 authoring、public reading、theme presentation、responsive projection、permissions、SEO、and future extension surfaces。

**为什么 parent PRD 要先锁共同模型**：

View、editing、responsive 三个 sub-PRD 都会触碰同一份 notepage identity、visibility、layout state、block content、theme selection、route semantics。如果这些共同概念不先固定，子 PRD 会各自发明 URL、preview、publish、delete、mobile editing 的语义，后续 ADR 和实现会漂移。

**为什么不提前定义跨页能力**：

Cross-notepage browsing、folder/collection organization、multi-root workspace forest、cross-page block reference/transclusion、backlinks、graph discovery 都是重要的 future UX directions，但它们需要更多工程实践和单独产品建模。当前 PRD 只要求单页基础模型不要挡住这些方向：stable notepage identity、metadata outside GridState、stable block identity/schema debt、visibility/delete semantics、route-class framing 都应为未来扩展留空间。

**为什么 acceptance 使用 BDD 场景**：

PRD 是 product truth，acceptance 应该描述用户/系统可观察行为。BDD scenarios 适合放在 PRD acceptance 中，因为它们表达 "什么行为算产品正确"；产品决策、约束、引用仍由普通 PRD section 承载。

---

## The whole picture

```text
 notepage product model
 ══════════════════════

  page metadata
      title / slug / description / SEO / OG metadata
      outside GridState; canonical for listings, SSR, permissions, sharing

  visibility + public-read state
      private by default
      public readers see last completed public state
      author working edits are not automatically public

  GridState / layout
      logical 12-col state
      render projection differs by viewport
      mode/theme/viewport changes do not mutate GridState

  block state / content
      block kind + props/content/state
      rendered by plugin EditView / RenderView

  theme reference / override
      notepage-level theme selection participates in theme-system cascade
      changing theme does not mutate GridState or block content

  route classes
      canonical public read route
      authenticated authoring route
      noindex preview route

  sub-PRDs
      notepage-view.md       = reader/read route behavior
      notepage-editing.md    = author editing behavior
      notepage-responsive.md = viewport projection behavior
```

**Core mental model**：

- Author creates a notepage; it starts private.
- Author edits in an authenticated authoring surface.
- Author may switch private/public.
- Public readers see only the last completed public state.
- Preview may render author working state, but preview is non-canonical and `noindex`.
- Same notepage identity survives mode, theme, viewport, and deploy-mode changes.

---

## Product Decisions

### Data Boundary

Notepage is not just `GridState`. A notepage contains:

- **Page metadata**: title, slug, description, SEO metadata, OG metadata.
- **Visibility/public-read state**: private/public plus the last completed public representation, if public.
- **GridState/layout**: the logical grid state consumed by view/edit/responsive rendering.
- **Block state/content**: per-block kind, content, props, and plugin-owned state.
- **Theme reference/override**: selected notepage theme and presentation metadata.

Title, slug, description, SEO metadata, and OG metadata are page metadata outside GridState. A future title block may exist as visual content, but it is not the canonical title.

### Visibility

M2 has only two product-level visibility states:

| State | Meaning |
|---|---|
| **Private** | Default on create. Only authorized author/admin paths can access. Public read route must not expose content. |
| **Public** | Public readers can access the canonical public read route and see the last completed public state. |

There is no product-level draft state in M2. Internally, implementation may need author working state so that public readers do not see unfinished edits, but the product model should not expose "draft version" as a third user-facing lifecycle state.

### Author Working State vs Public Read State

Authoring can be immediate inside the editor: markdown/block editing should show feedback to the author as quickly as the editor supports.

Reader visibility follows a stricter rule: public readers see the last completed public state. Author working edits become reader-visible only after an explicit complete/update-public action. The exact UI label and placement belong to the sub-PRD / implementation pass.

### Route Classes

Parent PRD locks route classes, not final path syntax:

| Route class | Canonical? | Indexed? | Purpose |
|---|---|---|---|
| **Public read route** | Yes | Public notepages may be indexed | Shareable reader URL for public state |
| **Authoring route** | No | No | Authenticated author editing surface |
| **Preview route** | No | `noindex` | Reader-like rendering of author working state |

M2 may use `/notes/:slug` as an implementation default for public reads, but `/notes/:slug` is not the permanent product contract. Future shapes such as author-scoped URLs, custom domains, or app-internal authoring routes remain possible if they preserve the route-class behavior.

### Delete And Slug Semantics

Delete semantics must preserve privacy first:

- Deleting a private notepage must not expose its existence to anonymous readers.
- Changing public -> private is not delete; public readers lose access according to the auth/privacy policy.
- Deleting a public notepage should not require M2 to expose `410 Gone`. M2 default is privacy-preserving external behavior, typically `404` for anonymous/public read paths where revealing history is not required.
- Internally, deletion should retain enough tombstone metadata for audit, backup, restore, and slug reuse protection.
- A future explicit public tombstone/`410 Gone` behavior can be introduced if SEO transparency becomes a product goal.
- Deleted public slugs must not be silently reused for unrelated content unless a future alias/tombstone rule defines safe reuse.

---

## BDD Acceptance Scenarios

These scenarios define product behavior.

### M2 — Minimum Shippable Notepage

```gherkin
Scenario: New notepage is private by default
  Given an authenticated author
  When the author creates a new notepage
  Then the notepage is private
  And anonymous readers cannot access its public read route
  And the author can open it in the authoring surface
```

```gherkin
Scenario: Author can publish a completed public state
  Given a private notepage with title and markdown content
  When the author switches the notepage to public
  Then public readers can open the canonical public read route
  And the rendered page includes the title and markdown content
  And the public read route is the canonical indexed route
```

```gherkin
Scenario: Public readers do not see unfinished author edits
  Given a public notepage with a completed public state
  When the author changes content in the authoring surface
  Then the author can see the working change in the editor
  And anonymous readers still see the last completed public state
  Until the author explicitly completes or updates the public state
```

```gherkin
Scenario: Preview is not canonical
  Given an authenticated author editing a notepage
  When the author opens preview
  Then preview renders a reader-like view of the author working state
  And preview is not the canonical public URL
  And preview is noindex
```

```gherkin
Scenario: Deleted content does not leak through public routes
  Given a notepage that has been deleted
  When an anonymous reader requests its public read route
  Then the response does not expose private content
  And the response does not require revealing whether the page used to exist
```

```gherkin
Scenario: View, edit, and responsive sub-PRDs pass together
  Given a public notepage created through the authoring flow
  When the reader opens it on desktop and mobile
  Then view-mode behavior satisfies notepage-view M2
  And editing behavior satisfies notepage-editing M2
  And responsive projection satisfies notepage-responsive M2
```

### M3 — Product Breadth

- 5 block kinds work across view/edit/responsive paths.
- Keyboard accessibility is covered across authoring and reading flows.
- Theme switching polish works without changing GridState, visibility, or public-read state.
- Route-class behavior remains stable if path syntax evolves.

### M4 — Production Polish

- 9 built-in block kinds work across view/edit/responsive paths.
- Deploy-mode verification confirms notepage route classes and public/private behavior across supported deploy modes.
- Undo/redo ships only after the scope across block editor state and notepage GridState is ratified.

---

## Sub-PRDs

| Sub-PRD | Owns | Must consume from parent |
|---|---|---|
| [notepage-view.md](./notepage-view.md) | Public/private read behavior, SSR, SEO, auth redirect/deny behavior, preview rendering, reader edge cases | Visibility model, route classes, delete/privacy semantics, metadata boundary |
| [notepage-editing.md](./notepage-editing.md) | Author insert/move/resize/delete, editor feedback, accessibility, algorithm contract | Author working state vs public read state, GridState invariants, BDD acceptance scenarios |
| [notepage-responsive.md](./notepage-responsive.md) | Desktop/tablet/mobile projection, mobile edit limit, touch affordance, viewport behavior | 12-col logical GridState, viewport projection as render-only, readable typography rule |

---

## Cross-Cutting Invariants

| Invariant | Meaning |
|---|---|
| **Notepage identity survives mode changes** | View/edit/preview are modes or route classes over the same notepage identity, not separate pages. |
| **GridState is not the whole notepage** | Metadata, visibility/public-read state, block state, and theme reference exist outside the grid layout. |
| **Metadata is outside GridState** | Title/slug/description/SEO/OG metadata remain canonical even if visual title blocks are added later. |
| **Private by default** | New notepages start private; public exposure requires explicit author action. |
| **Public readers see completed public state** | Author working edits are not automatically exposed to readers. |
| **Route class over path syntax** | Parent PRD locks canonical/non-canonical/indexing behavior, not exact URL path shape. |
| **Logical 12-col GridState** | Responsive behavior is render projection; viewport changes do not mutate GridState. |
| **Theme does not mutate content/layout** | Theme changes do not rewrite GridState, block state, visibility, or public-read state. |
| **Plugin churn does not break core UX** | Adding/removing block kinds must not break core view/edit/responsive behavior for existing supported blocks. |
| **Acceptance uses BDD scenarios** | M-stage acceptance is expressed as user/system-observable scenarios; Product Decisions, Invariants, and References remain separate PRD sections. |

---

## Cross-Feature Seams

| Adjacent feature | Notepage contact surface |
|---|---|
| [authentication.md](../authentication/authentication.md) / [identity.md](../authentication/identity.md) | Authoring route requires authenticated author/admin context; public/private visibility must align with PEP and audit vocabulary. |
| [theme-system.md](../theme-system/theme-system.md) | Theme cascade controls presentation without mutating notepage content, layout, or visibility. |
| [plugin-system.md](../plugin-system/plugin-system.md) | Block kinds provide EditView/RenderView/default size; plugin churn must preserve core notepage behavior. |
| [self-host-deploy.md](../self-host-deploy/self-host-deploy.md) | Route classes, SSR/public read behavior, and private/public access must work across deploy modes. |
| [discussion](../discussion/README.md)（Phase 2+） | Discussion may become an embedded or adjacent interaction surface, but does not change M2 notepage identity. |
| [ai-integration](../ai-integration/README.md)（Phase 2+） | Agent/API operations should target the same notepage identity and visibility model as human operations. |
| [search-discovery](../search-discovery/)（Phase 2+） | Search indexes public/readable notepage content according to visibility; wikilinks/cross-note discovery belong there. |

---

## Non-Goals

- ❌ **Product-level draft version** —— M2 uses private/public only; author working state is an implementation/product-surface detail, not a third visibility state.
- ❌ **Real-time collaborative editing (CRDT)** —— per [project.md](../../project.md); Day-1 is single-author editing with simplified conflict semantics.
- ❌ **Cross-notepage browsing / folder organization / workspace forest / block reference / graph discovery** —— future cross-page capabilities; not constrained by this single-notepage foundation PRD.
- ❌ **Reader annotations / private reader edits** —— Phase 2+.
- ❌ **Mobile-native app** —— web only.
- ❌ **Notepage nested inside notepage** —— not supported by current grid/block model.

---

## Dependencies

PRD-layer upstream dependencies:

- **Parent PRD**: [project.md](../../project.md)
- **Cross-folder PRDs**:
  - [authentication.md](../authentication/authentication.md)
  - [identity.md](../authentication/identity.md)
  - [theme-system.md](../theme-system/theme-system.md)
  - [plugin-system.md](../plugin-system/plugin-system.md)
  - [self-host-deploy.md](../self-host-deploy/self-host-deploy.md)
- **External services**: none for M2.

---

## Open Questions

1. **Final public URL syntax**: M2 may use `/notes/:slug`, but future product shape may need author-scoped URL, custom domain, or another public route form.
2. **Author complete/update-public action**: exact label, placement, and whether it is automatic on save or explicit in UI.
3. **Public delete external response**: M2 defaults privacy-preserving; future may add explicit `410 Gone` / tombstone page for intentionally removed public content.
4. **Slug reuse and alias policy**: deleted public slugs should not be silently reused; exact alias/tombstone rules remain future work.
5. **Undo/redo scope**: block editor internal undo vs notepage GridState undo vs combined history.
6. **Reader annotation / private reader edit mode**: Phase 2+; should not modify author content.

---

## Resolved Scope Notes

- **Create default**: private.
- **M2 visibility model**: private/public only; no product-level draft state.
- **Title/slug/description/SEO/OG metadata**: page metadata outside GridState.
- **Responsive product rule**: viewport projection is render-only; touch/mouse changes affordances, not canonical layout state.
- **Tablet projection**: tablet keeps 12-col compact projection rather than collapsing to 6-col; mobile remains 1-col flow.
- **Typography wording**: require readable typography per breakpoint/theme token; do not mandate continuous viewport-based font scaling.
- **Single-notepage scope**: current notepage PRDs define single-page foundation only, not the full future knowledge-organization surface.

---

## Surfaced ADR Debts

- **[ADR-0002] notepage schema boundary**: notes/page metadata, GridState, block state, visibility/public-read state, delete tombstone, and slug reuse need schema alignment.
- **[ADR-0003] GridState scope**: clarify GridState is layout state, not whole notepage identity or metadata.
- **[ADR-0009] route classes**: API/web routes should distinguish canonical public read, authoring, and preview route classes without locking product path syntax too early.
- **[ADR-0010] performance budget**: SSR/public read performance should align with notepage-view BDD and responsive projection.
- **[ADR-0014] plugin contract**: EditView/RenderView must support author working state and public read state without leaking implementation-specific plugin internals.
- **Delete/tombstone policy ADR or schema note**: public/private/delete/slug reuse/404-vs-410 must be synchronized with backup, audit, and restore semantics.

详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) PRD-surfaced debts log。

---

## References

- **Aligning ADRs**（pending PRD-driven rework; see top disclaimer）:
  - [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) — DB-backed substrate and schema alignment
  - [ADR-0003](../../../../engineering/decisions/ADR-0003-grid-engine-contract.md) — grid layer architecture induction
  - [ADR-0009](../../../../engineering/decisions/ADR-0009-api-style.md) — API/route shape
  - [ADR-0010](../../../../engineering/decisions/ADR-0010-performance-budget.md) — performance budgets
  - [ADR-0013](../../../../engineering/decisions/ADR-0013-markdown-tile-editor.md) — block editor SoT
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — plugin contract
  - [ADR-0016](../../../../engineering/decisions/ADR-0016-css-framework.md) — CSS framework + theme carrier
- **Parent**: [project.md](../../project.md)
- **Sub-PRDs**:
  - [notepage-view.md](./notepage-view.md)
  - [notepage-editing.md](./notepage-editing.md)
  - [notepage-responsive.md](./notepage-responsive.md)
- **Cross-folder PRDs**:
  - [theme-system.md](../theme-system/theme-system.md)
  - [theme-system-user-view.md](../theme-system/theme-system-user-view.md)
  - [plugin-system.md](../plugin-system/plugin-system.md)
  - [authentication.md](../authentication/authentication.md)
  - [identity.md](../authentication/identity.md)
- **Discussion record**: [notepage-prd-alignment-2026-05-22.md](../../../../engineering/design/discussions/notepage-prd-alignment-2026-05-22.md)
- **Frozen DI**: [grid-redesign-2026-05-11.md](../../../../engineering/design/_frozen/grid-redesign-2026-05-11.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc cross-reference convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)
- **PRD form**: [prd-discipline.md](../../../../process/methods/prd-discipline.md)

---

## Changelog

- 2026-05-16 initial draft；从 features/canvas-editing.md（Phase E pass 1）拆分而来 —— reframe vocab `canvas` → `notepage`（PRD product vocabulary）；hierarchical 结构 with 4 sub-PRDs；top-level 承担 framing + cross-cutting invariants + cross-feature seams 三类内容。
- 2026-05-16 pass 2 layer relationship fix（owner critical framing）：PRD 是 master，ADR 是 downstream；Dependencies 段只列 upstream PRDs；ADRs 移到 References "Aligning ADRs" 段；Parent PRD 加 metadata 字段。
- 2026-05-16 hygiene pass 3 (owner review)：relative links fixed；owner-leaning candidates added for title metadata and canonical notepage identity。
- 2026-05-22 pass 4 — parent model + BDD rewrite：改为 What / Why / Whole picture / Product Decisions / BDD Acceptance / Sub-PRDs / Reference；ratified private-by-default, private/public-only visibility, metadata outside GridState, route-class framing, privacy-preserving delete default, BDD acceptance discipline, and parent-owned data boundary。
- 2026-05-22 pass 4 follow-up：明确本 PRD 只定义 single-notepage foundation，不限制 future cross-page capabilities（multi-note browsing / folder organization / workspace forest / block references / backlinks / graph/search discovery）。
- 2026-05-23 cleanup：future cross-page capabilities 保留为 Non-Goal / resolved boundary，不再列为当前 Open Question 或 Surfaced ADR Debt。
