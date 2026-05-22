# Feature PRD: Block - Markdown

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-23 |
| Owner | W_YI |
| Parent PRD | [blocks.md](./blocks.md) |

> **ADR reference status (2026-05-18 owner framing)**: All ADR references in this PRD are pending PRD-driven rework after Phase E. ADRs are downstream implementation decisions and must be re-audited against completed PRDs before being treated as final.

---

## What this PRD covers

Markdown block is the M2 concrete block kind.

This PRD defines markdown block's product commitment: canonical markdown content, author editing, reader rendering, extraction, fallback, accessibility, responsive behavior, and the editor architecture runway needed for later rich editing.

This PRD does not own notepage insert/move/resize/delete workflow, public/private visibility, update-public action, markdown parser library choice, exact TypeScript interfaces, or DB schema.

---

## Why

Markdown is the first block kind because it gives M2 the minimum useful authoring loop without forcing the product to solve every future block type.

The design goal is:

> **M2 markdown UX may be conservative, but the markdown content contract must survive M3 rich editing.**

That means the first implementation can be source-compatible and simple, but it cannot make editor internal state, DOM shape, or grid layout the source of truth.

---

## Product Decisions

### M2 Product Commitment

M2 markdown block must be product-complete as a content type:

- canonical content is markdown text;
- author can edit markdown content through a source-compatible editing surface;
- reader render is readable formatted markdown output;
- preview/read rendering follows the same product rendering expectations;
- plain-text extraction is available for search/discovery;
- public SSR output is readable for supported markdown content;
- unsupported markdown features degrade without breaking the full notepage;
- editor/render failures show a block-level fallback and do not break the page.

M2 does not need to ship a fully polished WYSIWYG/rich-text experience.

### Canonical Content

The canonical stored content is markdown string plus minimal metadata needed for the block kind. Editor internal state is transient and must not become the durable source of truth.

### Author Edit Surface

M2 can choose one of these source-compatible surfaces:

- source textarea;
- source-plus-preview;
- minimal shell that can later host a richer editor.

The exact M2 authoring surface remains open, but it must preserve the markdown string content contract.

### Reader Render Surface

Reader output must render supported markdown as readable formatted content. Author-only controls must not appear in public/read-only rendering.

Unsupported syntax should degrade locally. A parser/render failure should produce a block-level fallback, not a blank notepage.

### Math Capability

Math belongs here as a markdown capability unless a later PRD proves that standalone math needs a separate content model.

M2 may defer polished math rendering. If math support ships later, it should be specified as markdown syntax/rendering behavior first, not as a separate `block-math.md` by default.

### Resolved Markdown Architecture Runway

M2 markdown UX can be conservative, but it must preserve the M3 rich-editor path:

- canonical stored content remains markdown string;
- editor internal state is not the source of truth;
- each markdown block editor is isolated inside the block and does not act as the grid host;
- notepage layout, public state, and route behavior do not depend on markdown editor internals;
- the editor boundary must allow M3 rich editing to replace or enhance the M2 authoring surface without data migration;
- the target rich-editor package remains TBD; any candidate must preserve markdown string as canonical content and must not introduce executable component semantics;
- Tiptap-as-grid-host and editor-as-grid-host patterns are rejected;
- upgrading the markdown editor surface requires round-trip tests from markdown -> editor state -> markdown.

This is an architecture runway for product stability, not an M2 promise that rich editing is complete.

---

## BDD Acceptance Scenarios

```gherkin
Scenario: Markdown block content survives author editing and reading
  Given an author has a notepage with a markdown block
  When the author changes the markdown content through the authoring surface
  Then the block's canonical content remains markdown text
  And the reader rendering can show formatted markdown output
  And the notepage layout state does not depend on markdown editor internals
```

```gherkin
Scenario: Markdown block can be rendered for public read
  Given a public notepage contains a supported markdown block
  When a reader opens the public read route
  Then the markdown block renders as readable formatted content
  And the rendered block does not expose author-only editing controls
  And the block output is readable in server-rendered public HTML
```

```gherkin
Scenario: Markdown block is searchable as text
  Given a markdown block contains user-authored text
  When search/discovery extracts text from the notepage
  Then the block contributes plain text derived from the canonical markdown content
```

```gherkin
Scenario: Markdown editor runway does not force future migration
  Given M2 stores markdown block content as markdown text
  When a later rich markdown editor replaces or enhances the authoring surface
  Then existing markdown block content remains valid
  And notepage workflow does not need to be rewritten
```

```gherkin
Scenario: Unsupported markdown feature degrades locally
  Given a markdown block contains syntax unsupported by the current renderer
  When a reader opens the notepage
  Then the markdown block degrades within that block
  And the rest of the notepage remains readable
```

---

## Non-Goals

- Full rich/WYSIWYG markdown authoring polish in M2.
- Standalone math block.
- Custom component execution inside markdown content.
- Notepage workflow, routes, visibility, delete semantics, or GridState behavior.
- Exact markdown parser/editor package lock.
- Exact DB schema or TypeScript interface fields.

---

## Open Questions

1. **M2 authoring surface**: source textarea, source-plus-preview, or minimal rich-compatible shell.
2. **Markdown dialect**: exact supported syntax set, sanitization rules, and extension policy.
3. **Math timing**: whether math syntax renders in M2, M3, or remains plain markdown text until a later milestone.
4. **Rich editor package**: exact rich markdown editor path should be re-audited after PRDs are complete.
5. **Extraction rules**: exact heading/link/image-alt/code handling belongs to search-discovery, but markdown must expose enough plain text.

---

## Surfaced ADR Debts

- **[ADR-0013] markdown editor runway**: ADR currently carries a richer editor-candidate framing that must be re-audited against this PRD's "M2 conservative UX, non-disposable architecture" framing.
- **[ADR-0002] block storage**: markdown canonical text should align with block storage shape after PRD pass completes.
- **[ADR-0014] block/plugin contract**: EditView/RenderView/extraction expectations should map to the shared block contract without leaking editor internals.
- **[ADR-0008] search abstraction**: markdown plain-text extraction must align with search-discovery.

---

## References

- **Parent**: [blocks.md](./blocks.md)
- **Cross-folder PRDs**: [notepage.md](../notepage/notepage.md) / [notepage-editing.md](../notepage/notepage-editing.md) / [notepage-view.md](../notepage/notepage-view.md) / [notepage-responsive.md](../notepage/notepage-responsive.md) / [plugin-system.md](../plugin-system/plugin-system.md) / [new-block.md](../plugin-system/new-block.md)
- **Aligning ADRs**: [ADR-0013](../../../../engineering/decisions/ADR-0013-markdown-tile-editor.md) / [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) / [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) / [ADR-0008](../../../../engineering/decisions/ADR-0008-search-abstraction.md)
- **Discussion record**: [blocks-prd-alignment-2026-05-23.md](../../../../engineering/design/discussions/blocks-prd-alignment-2026-05-23.md)

---

## Changelog

- 2026-05-23 initial split: extracted markdown-specific M2 commitment and editor runway from parent [blocks.md](./blocks.md).
