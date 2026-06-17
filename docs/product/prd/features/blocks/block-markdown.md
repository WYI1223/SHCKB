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

Markdown block is the M2 concrete block kind. Each markdown block instance is one concrete markdown content carrier inside a notepage.

This PRD defines the markdown block kind's product commitment: canonical markdown content, block-instance author editing, reader rendering, extraction, fallback, accessibility, responsive behavior, and the editor replacement boundary needed for later editor changes.

This PRD does not own notepage insert/move/resize/delete workflow, public/private visibility, update-public action, page-level editing session orchestration, exact markdown package versions, exact TypeScript interfaces, or DB schema.

---

## Why

Markdown is the first block kind because it gives M2 the minimum useful authoring loop without forcing the product to solve every future block type.

The design goal is:

> **M2 markdown UX may be conservative, but the markdown content contract must survive future editor replacement.**

That means the first implementation can be source-compatible and simple, but it cannot make editor internal state, DOM shape, or grid layout the source of truth. Markdown is one block-kind capability inside a notepage, not a page-level editor.

---

## Product Decisions

### M2 Product Commitment

M2 markdown block must be product-complete as a content type:

- canonical content is markdown text;
- author can edit markdown content inside an active markdown block instance through a source-compatible editing surface;
- reader render is readable formatted markdown output;
- preview/read rendering follows the same product rendering expectations;
- plain-text extraction is available for search/discovery;
- public SSR output is readable for supported markdown content;
- unsupported markdown features degrade without breaking the full notepage;
- editor/render failures show a block-level fallback and do not break the page.

M2 does not need to ship a fully polished WYSIWYG/rich-text experience.

### Canonical Content

The canonical stored content for each markdown block instance is markdown string plus minimal metadata needed for that block kind. Editor internal state is transient and must not become the durable source of truth.

Markdown block metadata is limited to markdown-block semantics and rendering/extraction hints. It does not own block instance identity, GridState placement, page visibility, public-read state, timestamps, audit fields, routing, persistence status, or update-public orchestration. Those belong to the notepage host, block instance host, or substrate layers.

A notepage may contain multiple markdown block instances and multiple non-markdown block instances. Markdown block A and markdown block B are the same kind, but their content, transient editor state, dirty state, validation/fallback state, and block-local undo state are instance-isolated.

### Author Edit Surface

Markdown editing happens inside a markdown block instance. Notepage edit mode hosts and coordinates block instances, but it does not own markdown editing semantics.

M2 preferred shape:

- inactive markdown blocks always display the latest rendered preview in the authoring surface;
- the active markdown block mounts a lightweight source-compatible editing surface;
- source-plus-preview is preferred for the active markdown block so authors can see rendered markdown without leaving editing flow;
- activation/focus/selection are coordinated by notepage editing, but markdown parsing, markdown shortcuts, preview rendering, and markdown edit errors stay inside the markdown block;
- leaving the active markdown block hands the current markdown content to the notepage host for author working state orchestration, unmounts the editing surface, and returns that block to its latest rendered preview;
- switching focus between blocks does not publish content and does not rewrite GridState.

M2 default authoring direction is a React-hosted lightweight source-plus-preview surface:

- a native textarea or minimal React source editor for markdown input;
- a rendered preview paired with the active editor where feasible;
- rendered preview for inactive markdown blocks;
- a minimal shell that can later host a replacement editor.

A simpler source textarea remains acceptable only if the implementation spike shows it preserves the author feedback loop and rendered inactive previews. The product contract is not full WYSIWYG; it is source-compatible markdown editing with a replacement path.

Focus leave is an authoring-state transition only. The markdown block hands accepted block-local content to the notepage host for author working state orchestration; public readers still see the last completed public state until the notepage-level complete/update-public action runs.

The markdown block must not write page-level working state, public-read state, or persistence records directly. Persistence timing, retry, conflict handling, and update-public promotion belong to notepage/substrate implementation and later ADR/API work.

### Performance Boundary

A markdown block instance is not the same thing as a mounted markdown editor. A notepage may contain many markdown block instances, but M2 should keep mounted editor count bounded.

M2 performance rules:

- every markdown block instance keeps a lightweight block shell;
- inactive markdown blocks render cached or freshly computed preview/readable output, not editor UI;
- only the active markdown block mounts the editing surface;
- editor code may be preloaded or kept warm after entering notepage edit mode, selecting a markdown block, or inserting a markdown block;
- switching active blocks reuses loaded editor code where possible;
- preview rendering may be cached by block content version/hash and updated after accepted content changes;
- markdown content changes do not trigger GridState recomputation.

### React Host and Markdown Product Constraints

M2 can assume React as the frontend host. The markdown block should still keep parsing, rendering, sanitization, and extraction behind block-owned functions instead of letting notepage workflow or a single React component define the markdown contract.

M2 product constraints:

- authoring surface: native textarea or minimal React source editor, paired with rendered preview for the active block when feasible;
- markdown baseline: CommonMark-compatible markdown plus GFM-style product expectations unless the implementation spike finds a narrower M2 subset is necessary;
- rendering pipeline: use mature markdown ecosystem tooling rather than custom parsing/rendering, with sanitization before public or preview rendering;
- React adapter: a React render component may be used, including a wrapper around a mature markdown component, but it must call the markdown block's render/extract/sanitize surface rather than becoming the durable content contract;
- extraction: derive plain text from the parsed markdown representation, not from rendered DOM scraping;
- editor upgrade path: a richer source editor remains an upgrade candidate if the lightweight textarea/source-plus-preview spike fails, but it is not the default M2 commitment;
- excluded: MDX or executable component semantics, custom markdown parser/renderer/editor, Tiptap-as-grid-host, and editor-as-grid-host patterns.

Exact package choices should be confirmed by an implementation spike or later ADR after the PRD pass. Named parser, renderer, sanitizer, React adapter, or editor packages are spike candidates only; they are not ratified product truth in this PRD. The product constraint is source-compatible markdown content, React-hosted UI, reusable render/extract/sanitize surfaces, and no executable markdown component model.

The markdown render/extract/sanitize path should be treated as a block-owned module. React components are adapters at the UI seam, not the source of truth for markdown semantics.

### Auto-fit + editing surface (this round)

Markdown blocks default to **auto-fit on** (see blocks.md). The active-editing surface is a
**single source textarea** filling the block, accompanied by a **floating rendered preview**
(right-aligned) so the author still sees rendered output without leaving the editing flow —
this satisfies the source-plus-preview feedback-loop requirement above via a floating preview
rather than a split pane. New markdown blocks start auto-fit on; pre-existing blocks remain off
until the author opts them in.

### Reader Render Surface

Reader output must render supported markdown as readable formatted content. Author-only controls must not appear in public/read-only rendering.

Unsupported syntax should degrade locally. A parser/render failure should produce a block-level fallback, not a blank notepage.

### Math Capability

Math belongs here as a markdown capability unless a later PRD proves that standalone math needs a separate content model.

M2 may defer polished math rendering. If math support ships later, it should be specified as markdown syntax/rendering behavior first, not as a separate `block-math.md` by default.

### Editor Replacement Boundary

M2 markdown UX can be conservative, but it must preserve a future editor replacement path:

- canonical stored content remains markdown string;
- editor internal state is not the source of truth and is scoped to one markdown block instance;
- each markdown block editor is isolated inside the block and does not act as the grid host;
- notepage layout, public state, and route behavior do not depend on markdown editor internals;
- the editor boundary must allow a later markdown editor to replace or enhance the M2 authoring surface without data migration;
- the target editor package remains TBD; any candidate must preserve markdown string as canonical content and must not introduce executable component semantics;
- Tiptap-as-grid-host and editor-as-grid-host patterns are rejected;
- upgrading the markdown editor surface requires round-trip tests from markdown -> editor state -> markdown.

This is a replacement boundary for product stability, not an M2 promise that rich editing is complete.

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
Scenario: Multiple markdown block instances are isolated
  Given a notepage contains markdown block A and markdown block B
  When the author edits markdown block A
  Then block A's canonical markdown content changes
  And block B's canonical markdown content does not change
  And block B's transient editor state is not affected
```

```gherkin
Scenario: Notepage hosts markdown editing without owning markdown semantics
  Given an author activates a markdown block in notepage edit mode
  When the author edits markdown content inside that block
  Then markdown parsing and editing behavior stay inside the markdown block
  And notepage edit mode only coordinates the block instance and layout workflow
  And GridState geometry is not rewritten by markdown content changes
```

```gherkin
Scenario: Leaving markdown editing shows the latest rendered preview
  Given an author is editing a markdown block
  When the author moves focus to another block
  Then the markdown block hands the current markdown content to the notepage host for author working state orchestration
  And the previous markdown block returns to rendered preview
  And public readers do not see the change until the notepage is explicitly updated for public read
```

```gherkin
Scenario: Multiple markdown blocks do not mount multiple editors
  Given a notepage contains several markdown blocks
  When only one markdown block is active for content editing
  Then only that markdown block mounts the markdown editing surface
  And inactive markdown blocks show rendered previews
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
Scenario: Markdown editor replacement does not force future migration
  Given M2 stores markdown block content as markdown text
  When a later markdown editor replaces or enhances the authoring surface
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
- Page-level markdown editor semantics.
- Custom markdown parser, renderer, or editor.
- Notepage workflow, routes, visibility, delete semantics, or GridState behavior.
- Exact markdown parser/editor package lock.
- Exact DB schema or TypeScript interface fields.

---

## Resolved Closeout Notes

- **M2 authoring direction**: React-hosted lightweight source-plus-preview is the preferred product shape; richer editor packages remain future replacement candidates, not M2 commitments.
- **Multiple instance state**: a notepage may host many markdown block instances, but only the active markdown block mounts the editing surface.
- **Focus leave behavior**: leaving the active markdown block hands block-local content to the notepage host for author working state orchestration, updates the inactive preview, and unmounts the editor.
- **Public state separation**: handing block-local content to the notepage host for author working state orchestration does not update public readers; public read state changes only through the notepage update-public flow.
- **Layout separation**: markdown content edits and focus switches must not mutate GridState geometry.
- **Prototype result**: a throwaway state-model prototype validated the active-editor / inactive-preview / author-working-state / public-state / GridState separation for two markdown block instances.

---

## Open Questions

1. **Markdown dialect**: exact CommonMark/GFM subset, sanitization rules, and extension policy.
2. **Math timing**: whether math syntax renders in M2, M3, or remains plain markdown text until a later milestone.
3. **Future editor replacement candidate**: exact markdown editor path should be re-audited after PRDs are complete and should not be inferred from deprecated ADRs; richer source editor packages are candidates only if the lightweight M2 source editor is insufficient.
4. **Extraction rules**: exact heading/link/image-alt/code handling belongs to search-discovery, but markdown must expose enough plain text.
5. **Preview cache policy**: exact cache invalidation key and debounce timing belong to implementation/ADR, but product behavior requires latest accepted content to render after focus leave.
6. **Implementation spike**: confirm source-plus-preview behavior, render/sanitize/extract pipeline, focus-leave preview update, and many-markdown-block performance before locking packages.

---

## Surfaced ADR Debts

- **[ADR-0013] markdown editor framing**: ADR is deprecated legacy draft and carries a richer editor-candidate framing that must be re-audited against this PRD's "block-instance editing boundary + future editor replacement boundary" framing.
- **[ADR-0002] block storage**: markdown canonical text should align with block storage shape after PRD pass completes.
- **[ADR-0014] block/plugin contract**: EditView/RenderView/extraction expectations should map to the shared block contract without leaking editor internals.
- **[ADR-0008] search abstraction**: markdown plain-text extraction must align with search-discovery.
- **Markdown stack ADR/spike**: exact parser, renderer, sanitizer, React adapter, and future editor package choices should be decided after PRD pass by implementation spike or ADR; package names in discussion history are not product commitments.

---

## References

- **Parent**: [blocks.md](./blocks.md)
- **Cross-folder PRDs**: [notepage.md](../notepage/notepage.md) / [notepage-editing.md](../notepage/notepage-editing.md) / [notepage-view.md](../notepage/notepage-view.md) / [notepage-responsive.md](../notepage/notepage-responsive.md) / [plugin-system.md](../plugin-system/plugin-system.md) / [new-block.md](../plugin-system/new-block.md)
- **Aligning ADRs**: [ADR-0013](../../../../engineering/decisions/ADR-0013-markdown-tile-editor.md) / [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) / [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) / [ADR-0008](../../../../engineering/decisions/ADR-0008-search-abstraction.md)
- **Discussion record**: [blocks-prd-alignment-2026-05-23.md](../../../../engineering/design/discussions/blocks-prd-alignment-2026-05-23.md)

---

## Changelog

- 2026-05-23 initial split: extracted markdown-specific M2 commitment and editor boundary from parent [blocks.md](./blocks.md).
- 2026-05-23 block-instance edit pass: clarified markdown is a block-kind internal capability, not a page-level editor; added active-block editing boundary, multiple-instance isolation, no custom markdown wheel-rebuild, and future editor replacement framing.
- 2026-05-23 lightweight editor performance pass: clarified inactive blocks show rendered preview, active block mounts a lightweight source-compatible editor, focus leave hands content to the notepage host for author working state orchestration, and mounted editor count stays bounded.
- 2026-05-23 React markdown stack direction pass: captured React as the frontend host assumption while keeping markdown render/extract/sanitize behavior behind block-owned boundaries.
- 2026-05-23 closeout pass: resolved the M2 authoring direction to React-hosted lightweight source-plus-preview, captured prototype-validated state separation, and narrowed remaining open questions to package/dialect/cache/extraction details.
- 2026-05-23 review cleanup: downgraded named markdown libraries to spike/ADR candidates, clarified markdown metadata ownership, and made notepage-owned persistence orchestration explicit.
- 2026-06-14 autofit PRD pass: added "Auto-fit + editing surface (this round)" — markdown defaults to auto-fit on; single textarea + floating preview reconciles the source-plus-preview requirement; opt-in semantics for pre-existing blocks (source: autofit spec §9 / [ADR-0028]).
