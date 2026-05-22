# Feature PRD: Blocks

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-23 |
| Owner | W_YI |
| Parent PRD | [project.md](../../project.md) |

> **ADR reference status (2026-05-18 owner framing)**: All ADR references in this PRD are pending PRD-driven rework after Phase E. ADRs are downstream implementation decisions and must be re-audited against completed PRDs before being treated as final. If an ADR changes later, grep all PRD ADR references and sync them to avoid PRD/ADR drift. See [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md).

---

## What this PRD covers

Blocks are the content-kind capability layer used inside notepages.

This parent PRD defines the common product contract that every block kind must satisfy: what a block kind must declare, how it participates in author editing and reader rendering, how failure is contained, how content can be extracted for other surfaces, and how the built-in block catalog evolves.

Concrete block behavior belongs in sub-PRDs:

| Sub-PRD | Status | Scope |
|---|---|---|
| [block-markdown.md](./block-markdown.md) | draft | M2 product-complete markdown block and markdown editor runway |
| [block-image.md](./block-image.md) | skeleton | image/media block candidate |
| [block-code.md](./block-code.md) | skeleton | code block candidate |
| [block-drawing.md](./block-drawing.md) | skeleton | bounded drawing/sketch/diagram block candidate |

This PRD does not own notepage routes, page visibility, author/public state, grid placement workflow, plugin registration/lifecycle, blob storage schema, search ranking, or AI workflows.

---

## Why

Notepage needs stable content kinds before AI integration, search discovery, plugin-system rework, and ADR rework can converge. If block is defined only as a plugin mechanism, product behavior becomes under-specified. If block is defined only inside notepage, it becomes a page implementation detail and cannot cleanly serve search, AI, export, and future extension surfaces.

The main design goal is:

> **M2 can ship conservative block UX, but M2 block architecture must not be disposable.**

For M2 this mainly applies to markdown. For later milestones it means image, code, drawing, and heavier block kinds must plug into the same product contract rather than forcing notepage, search, or AI to special-case every content type.

---

## Whole Picture

```text
notepage = page identity / visibility / routes / public state / layout workflow
grid state = geometry / placement / collision / gravity
block = content model / edit surface / render surface / fallback / extraction
plugin system = registration / extension authoring / sandbox / versioning
```

A block is consumed by notepage but not owned by notepage. A block may be implemented through plugin-system mechanics, but the product contract exists even for built-in blocks.

---

## Product Decisions

### Block Is A Top-Level Abstract

`blocks.md` is the parent abstraction. It does not act as the markdown PRD, image PRD, code PRD, or drawing PRD.

Each concrete block kind gets a `block-*.md` sub-PRD when its product behavior needs explicit review.

### Block vs Notepage

Notepage owns workflow. Block owns content-kind behavior.

Examples:

- "Author can insert a block into available grid space" belongs to notepage editing.
- "Markdown block stores markdown content and renders readable formatted output" belongs to `block-markdown.md`.
- "Public readers see last completed public state" belongs to notepage.
- "A failing block RenderView must not break the whole public page" belongs to the shared block contract and is consumed by notepage view.

### Block vs Plugin-System

Plugin-system is the extension framework. Blocks are product content kinds.

The built-in block kinds must satisfy this PRD even if third-party plugin installation is not available. `plugin-system/new-block.md` should eventually narrow to extension-author concerns: how a developer creates a new block kind, declares capabilities, handles versioning, and registers with the framework.

### Naming: Drawing, Not Canvas

The product-level notepage is a grid-composed web page. A concrete freeform sketch/diagram surface inside one block should be called `drawing block`, not the overloaded canvas wording.

This avoids overloading `canvas` across:

- the historical product metaphor;
- the notepage/grid composition model;
- the HTML canvas implementation primitive;
- a future bounded drawing/sketch/diagram block.

### Built-In Catalog Roadmap

| Milestone | Block catalog product target |
|---|---|
| M2 | [block-markdown.md](./block-markdown.md) is product-complete as the first concrete block kind. Other built-in kinds may be placeholders or absent from user-facing flows. |
| M3 | Light block breadth expands from markdown toward image, code, and drawing candidates. Exact count and final catalog are not locked by this PRD. |
| M4 | Heavier built-in block kinds may be added after M3 validates the shared block contract. Candidate list remains owner-driven and PRD-dependent. |
| Phase 2+ | Third-party block discovery/install, marketplace, custom namespacing, and block-specific advanced operations. |

Math is treated as a markdown block capability unless a later PRD proves that standalone math needs a separate content model. Callout is removed from the current candidate list.

Discussion as a block-like surface remains owned by future `discussion/` until that PRD promotes a concrete block kind.

---

## Shared Block Contract

Each concrete block PRD must define these surfaces when applicable:

| Surface | Product responsibility |
|---|---|
| Content model | Canonical user-authored content and metadata owned by the block kind. |
| Author edit surface | How authors create and modify the block content. |
| Reader render surface | How readers see the block in public/read-only contexts. |
| Serialization | Whether content survives save/reload/backup/restore/upgrade. |
| Fallback | What happens when the block kind is unsupported, dependencies are missing, or rendering fails. |
| Extraction | What text or structured summary search, export, and future AI may consume. |
| Accessibility | How non-visual users can understand or operate the block. |
| Responsive baseline | How content remains usable under notepage viewport projection. |
| Future semantic operations | What later AI/API operations may act on, without requiring M2 AI features. |

---

## Shared BDD Acceptance Scenarios

These scenarios define behavior every concrete block kind inherits unless its sub-PRD explicitly narrows the scenario.

```gherkin
Scenario: Block render failure is contained
  Given a notepage contains a block whose renderer fails
  When a reader opens the notepage
  Then the failing block shows a safe fallback for that block
  And the rest of the notepage remains readable
```

```gherkin
Scenario: Unsupported block kind does not corrupt content
  Given a notepage contains a block kind unavailable in the current runtime
  When an author opens the notepage
  Then the unavailable block is identified as unsupported
  And the original block content is preserved
  And the author is not allowed to silently overwrite it with incompatible content
```

```gherkin
Scenario: Block content does not own layout
  Given a block has content changes
  When the author edits that content
  Then GridState geometry is not rewritten as part of the content edit
```

```gherkin
Scenario: Block exposes extraction behavior
  Given search or export consumes a notepage
  When it reaches a supported block
  Then the block either contributes extractable content
  Or explicitly declares that it is non-searchable or extraction-limited
```

---

## Cross-Cutting Invariants

| Invariant | Meaning |
|---|---|
| **Block content is not layout** | Block content changes do not rewrite GridState geometry. |
| **Grid engine is kind-opaque** | Geometry behavior cannot depend on block semantic kind. |
| **Editor internals are contained** | Editor state belongs inside the block editor and cannot become notepage/page source of truth. |
| **Reader render is safe** | One failing or unsupported block cannot break the full notepage. |
| **Canonical content survives upgrades** | M2 content must remain valid through M3/M4 editor/catalog evolution. |
| **Built-in first, third-party later** | M2/M3/M4 focus on built-in block capability; marketplace is Phase 2+. |
| **AI-ready does not mean AI-shipped** | Blocks preserve future semantic operation surfaces, but M2 does not ship user-visible AI block operations. |

---

## Non-Goals

- Third-party plugin marketplace or runtime install in M2.
- Notepage insert/move/resize/delete workflow.
- Page routes, public/private visibility, update-public action, or delete semantics.
- Exact TypeScript interface fields for `BlockPlugin`.
- Exact API endpoint or database schema shape.
- Search ranking or indexing implementation.
- AI product workflows.
- Standalone callout block in the current roadmap.
- Standalone math block before markdown math capability proves insufficient.

---

## Dependencies

PRD-layer upstream dependencies:

- **Parent PRD**: [project.md](../../project.md)
- **Concrete block PRDs**:
  - [block-markdown.md](./block-markdown.md)
  - [block-image.md](./block-image.md)
  - [block-code.md](./block-code.md)
  - [block-drawing.md](./block-drawing.md)
- **Cross-folder PRDs**:
  - [notepage.md](../notepage/notepage.md)
  - [notepage-editing.md](../notepage/notepage-editing.md)
  - [notepage-view.md](../notepage/notepage-view.md)
  - [notepage-responsive.md](../notepage/notepage-responsive.md)
  - [theme-system.md](../theme-system/theme-system.md)
  - [plugin-system.md](../plugin-system/plugin-system.md)
  - [authentication.md](../authentication/authentication.md)
- **External services**: none for M2.

---

## Open Questions

1. **M3 catalog exactness**: whether M3 targets exactly four visible block kinds, a fifth light block kind, or a broader plugin-system breadth goal.
2. **Drawing block scope**: whether drawing means freehand sketch, diagramming, lightweight whiteboard, or a narrower MVP.
3. **M4 heavy block catalog**: exact heavy block set remains owner-driven after M3 validates block contract breadth.
4. **Plugin-system sync depth**: how much of `plugin-system/new-block.md` should be rewritten now versus after AI/search PRDs.
5. **Search extraction detail**: exact searchable text rules belong to search-discovery, but each block must expose enough product expectation here.

---

## Surfaced ADR Debts

- **[ADR-0013] markdown editor runway**: see [block-markdown.md](./block-markdown.md).
- **[ADR-0004] block plugin model naming/scope**: ADR title and scope may still imply plugin = block. Blocks PRD separates product content kind from plugin extension mechanics.
- **[ADR-0014] plugin contract granularity**: contract fields should align to block product obligations without forcing product PRD to own TypeScript details.
- **[ADR-0005] agent semantic API**: block semantic operations should consume this block contract later; M2 does not require user-visible AI.
- **[ADR-0008] search abstraction**: plain-text extraction obligations need alignment with search-discovery PRD.
- **[ADR-0002] block storage and sidecar carrier**: markdown is canonical inline text for M2, but blob/heavy-block storage needs later alignment.

See [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) for PRD-surfaced debts.

---

## References

- **Concrete block PRDs**: [block-markdown.md](./block-markdown.md) / [block-image.md](./block-image.md) / [block-code.md](./block-code.md) / [block-drawing.md](./block-drawing.md)
- **Parent**: [project.md](../../project.md)
- **Cross-folder PRDs**: [notepage.md](../notepage/notepage.md) / [notepage-editing.md](../notepage/notepage-editing.md) / [notepage-view.md](../notepage/notepage-view.md) / [notepage-responsive.md](../notepage/notepage-responsive.md) / [plugin-system.md](../plugin-system/plugin-system.md) / [new-block.md](../plugin-system/new-block.md) / [theme-system.md](../theme-system/theme-system.md) / [authentication.md](../authentication/authentication.md)
- **Discussion record**: [blocks-prd-alignment-2026-05-23.md](../../../../engineering/design/discussions/blocks-prd-alignment-2026-05-23.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)
- **PRD form**: [prd-discipline.md](../../../../process/methods/prd-discipline.md)

---

## Changelog

- 2026-05-23 initial draft: created separate `blocks/` feature PRD for block content-kind capability; separated block product contract from notepage workflow and plugin-system extension-author lifecycle.
- 2026-05-23 parent/sub-PRD split: narrowed `blocks.md` to the top-level block abstraction; moved markdown-specific M2/runway detail to [block-markdown.md](./block-markdown.md); added skeleton sub-PRDs for image, code, and drawing; removed callout and standalone math from the current candidate list.
