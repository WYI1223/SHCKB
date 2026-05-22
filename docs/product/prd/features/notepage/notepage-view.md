# Feature PRD: Notepage viewing

| Field | Value |
|---|---|
| Status | draft (pass 4 — route/visibility + BDD rewrite) |
| Last updated | 2026-05-22 |
| Owner | W_YI |
| Parent PRD | [notepage.md](./notepage.md) |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

---

## What this PRD covers

Notepage viewing 定义 reader 如何访问、阅读、分享一个 notepage，以及 author 如何用 reader-like preview 验证公开效果。

本 sub-PRD 只拥有 view/read path：

- public notepage 的 canonical read route。
- private/deleted/nonexistent notepage 的 read response behavior。
- author preview 的 reader-like rendering。
- SSR/SEO/noindex/canonical metadata。
- reader keyboard/focus/scroll behavior。
- view-mode BDD acceptance scenarios。

不拥有：

- Author insert/move/resize/delete/edit controls → [notepage-editing.md](./notepage-editing.md)。
- Viewport projection / mobile layout → [notepage-responsive.md](./notepage-responsive.md)。
- Parent route class / visibility / data boundary decisions → [notepage.md](./notepage.md)。
- Theme cascade internals → [theme-system.md](../theme-system/theme-system.md)。

---

## Why

Reader view is not "editing minus controls". It has its own product responsibilities:

- Public readers need a stable canonical read identity.
- Private and deleted content must not leak through public routes.
- Public pages need SSR and metadata for sharing/SEO.
- Author preview must be reader-like without becoming canonical or indexed.
- Reader interactions must stay clean and free of authoring affordances.

This sub-PRD consumes the parent notepage model: private by default, private/public only, public readers see last completed public state, and route classes matter more than exact path strings.

---

## The whole picture

```text
 notepage view model
 ═══════════════════

  public read route
      canonical for public notepages
      SSR + SEO metadata
      renders last completed public state

  private/inaccessible read
      anonymous readers cannot see content
      response must not leak more than policy allows

  deleted read
      public route does not expose content
      M2 does not require 410 Gone
      internal tombstone belongs to data/ADR layer

  author preview
      authenticated only
      reader-like rendering of author working state
      non-canonical + noindex

  reader interaction
      no authoring controls
      keyboard/focus/scroll behavior
      RenderView per block kind
```

---

## User-Facing Experience

### Public Reading

A public notepage opens through its canonical public read route. The reader sees rendered block content in the notepage layout, with no drag handles, resize handles, palette, selection controls, or authoring chrome.

The public read route renders the **last completed public state**. If the author is currently editing, those unfinished edits are not visible to anonymous readers until the author completes/updates the public state.

### Private And Inaccessible Reading

New notepages are private by default. Anonymous readers must not see private content. For M2, private/deleted/nonexistent public-route requests should use a privacy-preserving response shape; a generic not-found response is preferred over revealing resource history or private existence.

Authenticated but unauthorized users may receive a clearer forbidden response where the product deliberately knows the user identity and can safely explain access denial.

### Author Preview

Author preview renders a reader-like view of the author working state. It is useful for checking content before updating the public state, but it is not the public canonical read route.

Preview must be:

- authenticated;
- non-canonical;
- `noindex`;
- visually close enough to public read mode to validate reader experience.

### SSR And Metadata

Public read routes must support SSR. Public HTML should include complete initial content and metadata needed for title, description, canonical URL, and share previews.

Private, preview, deleted, and inaccessible responses must not be indexable as public canonical content.

### Reader Interaction

Reader interaction should stay simple:

- readers can scroll and select/copy readable content;
- block `RenderView` provides block-specific interaction;
- keyboard navigation supports basic focus movement across blocks;
- browser-native find, scroll, and zoom should not be hijacked.

---

## BDD Acceptance Scenarios

These scenarios define product behavior.

### M2 — Minimum Shippable Viewing

```gherkin
Scenario: Public reader opens a public notepage
  Given a notepage is public
  And it has a completed public state with title and markdown content
  When an anonymous reader opens the canonical public read route
  Then the reader sees the rendered title and markdown content
  And the page does not show authoring controls
  And the route is canonical for that public notepage
```

```gherkin
Scenario: Public reader sees last completed public state
  Given a public notepage has a completed public state
  And the author has unsent or unfinished working edits
  When an anonymous reader opens the canonical public read route
  Then the reader sees the last completed public state
  And the reader does not see the author's unfinished working edits
```

```gherkin
Scenario: Private notepage does not leak to anonymous reader
  Given a notepage is private
  When an anonymous reader requests its public read route
  Then the response does not include private content
  And the response does not need to reveal that the notepage exists
```

```gherkin
Scenario: Unauthorized authenticated reader cannot read private content
  Given a notepage is private
  And an authenticated user is not allowed to read it
  When that user requests the notepage read path
  Then the response denies access
  And the response does not include private content
```

```gherkin
Scenario: Deleted notepage does not expose content
  Given a notepage has been deleted
  When an anonymous reader requests its old public read route
  Then the response does not include deleted content
  And M2 does not require a public 410 tombstone page
```

```gherkin
Scenario: Author preview is reader-like but not canonical
  Given an authenticated author is editing a notepage
  When the author opens preview
  Then the preview renders the author working state with reader-like rendering
  And the preview route is not canonical
  And the preview response is noindex
```

```gherkin
Scenario: Public read route is server-rendered
  Given a public notepage with supported block kinds
  When a reader requests the public read route
  Then the first server response includes readable HTML content
  And the response includes title and description metadata
  And the response can be shared without requiring editor JavaScript first
```

### M3 — Reading Polish

- Full keyboard accessibility baseline across public reading.
- Print-friendly rendering if prioritized.
- Reader focus mode may hide non-content chrome.
- More block kinds have RenderView coverage.

### M4 — Production Viewing

- All built-in block RenderViews work in public read mode.
- Route/view behavior is verified across supported deploy modes.
- Larger notepages have an explicit performance and rendering strategy.

---

## Reference

### View Invariants

| Invariant | Meaning |
|---|---|
| **No authoring controls in public view** | Public readers never see drag/resize/palette/selection UI. |
| **Public read state is completed state** | Reader route renders last completed public state, not unfinished author working edits. |
| **Preview is non-canonical** | Preview may render working state but must not become public canonical content. |
| **Private/deleted content does not leak** | Inaccessible routes must not include private/deleted content in body, metadata, or SSR output. |
| **RenderView per block** | View mode calls each supported block kind's RenderView, not EditView. |
| **SSR public content** | Public notepages have server-rendered initial content and metadata. |

### Response Behavior Matrix

| Request | M2 behavior |
|---|---|
| Anonymous -> public notepage public read route | Render public state, canonical, indexable. |
| Anonymous -> private notepage public read route | No content leak; generic not-found preferred for privacy. |
| Anonymous -> deleted public route | No content leak; 410 tombstone not required in M2. |
| Authenticated unauthorized -> private notepage | Deny access; may use clearer forbidden response. |
| Author -> preview route | Render working state; non-canonical; noindex. |

### Non-Goals

- ❌ Authoring affordances and edit controls.
- ❌ Responsive projection rules.
- ❌ Theme cascade internals.
- ❌ Reader annotations/highlights.
- ❌ Public `410 Gone` tombstone page in M2.
- ❌ Route path syntax finalization beyond route-class behavior.

### Edge Cases

| Scenario | Expected behavior |
|---|---|
| Public notepage has no title | Use a fallback title from metadata policy; do not infer canonical title from arbitrary block content. |
| Public notepage contains unsupported block kind | Render safe fallback for that block; do not break the full page. |
| Reader disables JavaScript | Public SSR HTML remains readable for supported block kinds. |
| Author opens public route while authenticated | Public route still behaves as public read route; authoring route is separate. |
| Private -> public transition | Public route starts serving completed public state after explicit visibility/state update. |
| Public -> private transition | Public route stops serving content; search/index behavior must not keep stale public content as canonical. |

### Dependencies

PRD-layer upstream dependencies:

- **Parent PRD**: [notepage.md](./notepage.md)
- **Sibling PRDs**: [notepage-editing.md](./notepage-editing.md) / [notepage-responsive.md](./notepage-responsive.md)
- **Cross-folder PRDs**:
  - [authentication.md](../authentication/authentication.md)
  - [identity.md](../authentication/identity.md)
  - [theme-system.md](../theme-system/theme-system.md)
  - [plugin-system.md](../plugin-system/plugin-system.md)
  - [self-host-deploy.md](../self-host-deploy/self-host-deploy.md)
- **External services**: none for M2.

### Open Questions

1. **Exact public route path**: M2 may use `/notes/:slug`, but final product URL syntax remains open per parent PRD.
2. **Exact author preview route shape**: query / app route / route segment are implementation choices as long as preview remains authenticated, non-canonical, and noindex.
3. **403 vs generic not-found details**: privacy-preserving default is preferred; exact response differentiation should align with authentication/identity PRDs.
4. **Future 410 tombstone**: not M2; may be revisited if public SEO transparency is prioritized.
5. **Large notepage rendering limit**: M2 can cap or degrade; M4 should define production strategy.

### Surfaced ADR Debts

- **[ADR-0009] route class semantics**: distinguish canonical public read, authoring, and preview route classes.
- **[ADR-0002] visibility/public-read state**: schema must represent private/public, public completed state, and deletion/tombstone metadata.
- **[ADR-0014] RenderView fallback**: unsupported block behavior in public view needs a safe rendering contract.
- **[ADR-0010] SSR/performance budget**: public read route performance and SSR size need alignment with notepage view acceptance.

详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) PRD-surfaced debts log。

### References

- **Aligning ADRs**（pending PRD-driven rework; see top disclaimer）:
  - [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) — visibility/public state and tombstone schema
  - [ADR-0003](../../../../engineering/decisions/ADR-0003-grid-engine-contract.md) — GridState rendering
  - [ADR-0009](../../../../engineering/decisions/ADR-0009-api-style.md) — API/route shape
  - [ADR-0010](../../../../engineering/decisions/ADR-0010-performance-budget.md) — Lighthouse / FCP / LCP
  - [ADR-0013](../../../../engineering/decisions/ADR-0013-markdown-tile-editor.md) — RenderView for markdown
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — RenderView contract
- **Parent**: [notepage.md](./notepage.md)
- **Sibling PRDs**: [notepage-editing.md](./notepage-editing.md) / [notepage-responsive.md](./notepage-responsive.md)
- **Cross-folder PRDs**: [authentication.md](../authentication/authentication.md) / [identity.md](../authentication/identity.md) / [theme-system.md](../theme-system/theme-system.md) / [plugin-system.md](../plugin-system/plugin-system.md)
- **Discussion record**: [notepage-prd-alignment-2026-05-22.md](../../../../engineering/design/discussions/notepage-prd-alignment-2026-05-22.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)
- **PRD form**: [prd-discipline.md](../../../../process/methods/prd-discipline.md)

### Changelog

- 2026-05-16 initial draft；reader view 单独成 sub-PRD（Q1 reframe：view 不是 "edit mode minus controls"，有 reader-centric 独立 concerns —— SSR / SEO / private auth / 404-410-403 / etc.）。
- 2026-05-16 pass 2 layer relationship fix（owner critical framing）：Dependencies 段只列 upstream PRD deps；ADRs 移到 References "Aligning ADRs" 段。
- 2026-05-16 hygiene pass 3 (owner review): 相对链接深度修正。
- 2026-05-22 pass 4 — route/visibility + BDD rewrite：改为 What / Why / Whole picture / User-facing experience / BDD Acceptance / Reference；同步 parent private/public、last completed public state、route-class framing、preview noindex、privacy-preserving delete/default response、BDD acceptance discipline。
