# Discussion Record: Blocks PRD Alignment

| Field | Value |
|---|---|
| Date | 2026-05-23 |
| Subject | Blocks PRD placement, scope, and markdown runway |
| Participants | Owner, Codex |
| Trigger | Owner asked whether the next PRD should be block or AI integration. |
| Status | partially ratified |
| Output target | `docs/product/prd/features/blocks/blocks.md` |

## Source

- Conversation source: owner/Codex planning discussion on 2026-05-23.
- Files under discussion:
  - `docs/product/prd/features/notepage/notepage.md`
  - `docs/product/prd/features/notepage/notepage-editing.md`
  - `docs/product/prd/features/plugin-system/plugin-system.md`
  - `docs/product/prd/features/plugin-system/new-block.md`
  - `docs/product/prd/features/ai-integration/README.md`
  - `docs/engineering/decisions/ADR-0013-markdown-tile-editor.md`

## Dialogue Log

### 2026-05-23 - Turn 1

- **Owner**: Asked whether the next PRD should be block or AI integration.
- **Codex response**:
  - Recommended writing block first.
  - Reasoned that AI integration consumes the block/notepage/auth/plugin boundaries, so writing AI first would likely invent block operation semantics too early.
  - Said AI integration can later pressure-test and revise PRDs after the block model is clearer.
- **Files mentioned**:
  - `docs/product/prd/features/ai-integration/README.md`
  - `docs/product/prd/features/plugin-system/new-block.md`
  - `docs/product/prd/features/notepage/notepage.md`
- **Action proposed or taken**:
  - Start with block PRD before AI integration.

### 2026-05-23 - Turn 2

- **Owner**: Agreed to write block first and asked for Codex's understanding of block.
- **Codex response**:
  - Initially framed M2 block too broadly around insert/edit/render/save/reload/public view.
  - Proposed that block should be treated as a content-kind capability rather than only plugin author surface.
- **Files mentioned**:
  - `docs/product/prd/features/plugin-system/new-block.md`
  - `docs/product/prd/features/notepage/notepage-editing.md`
  - `docs/product/prd/features/notepage/notepage-view.md`
- **Action proposed or taken**:
  - Refine the layer boundary before writing.

### 2026-05-23 - Turn 3

- **Owner**: Challenged the M2 framing:
  > 你说的M2的功能，这似乎不应该由block负责，而是notepage负责？
- **Codex response**:
  - Accepted the challenge and narrowed the boundary.
  - Restated that notepage owns workflow: create, insert, layout, save/reload, publish, preview, public/private routes.
  - Restated that block owns per-kind content contract: content model, author edit surface, reader render surface, serialization, fallback, responsive baseline, plain-text extraction, accessibility, and future semantic operation surface.
  - Reframed M2 as "markdown block kind is product-complete as a content type", not "markdown block drives the full notepage workflow".
- **Files mentioned**:
  - `docs/product/prd/features/notepage/notepage.md`
  - `docs/product/prd/features/notepage/notepage-editing.md`
  - `docs/product/prd/features/plugin-system/new-block.md`
- **Action proposed or taken**:
  - Write block PRD as content-kind capability PRD.

### 2026-05-23 - Turn 4

- **Owner**: Asked where the block PRD should live.
- **Codex response**:
  - Recommended a new feature folder: `docs/product/prd/features/blocks/`.
  - Recommended `blocks/blocks.md` as the top-level PRD.
  - Said block should not live under `notepage/` because notepage owns composition/workflow.
  - Said block should not live under `plugin-system/` because plugin-system owns extension author lifecycle and registry mechanics.
- **Files mentioned**:
  - `docs/product/prd/features/README.md`
  - `docs/product/prd/features/notepage/`
  - `docs/product/prd/features/plugin-system/`
- **Action proposed or taken**:
  - Create `features/blocks/blocks.md`.
  - Keep `plugin-system/new-block.md` for extension-author concerns.

### 2026-05-23 - Turn 5

- **Owner**: Agreed with the placement plan.
- **Codex response**:
  - Proposed starting with a blocks discussion record, then writing `blocks.md`.
  - Proposed M2 markdown block as product-complete but with conservative UX.
- **Files mentioned**:
  - `docs/product/prd/features/blocks/blocks.md`
- **Action proposed or taken**:
  - Begin discussion record and PRD writing.

### 2026-05-23 - Turn 6

- **Owner**: Clarified that M2 may only commit conservative markdown editing UX, but the structure and library runway must be decided early:
  > 可以只承诺，但是结构，库等都需要提前定，否则需求不明确的情况下M3会推导整个M2重新写。
- **Codex response**:
  - Agreed with the distinction.
  - Proposed "M2 conservative UX, non-disposable architecture."
  - Proposed that M2 can expose a source-compatible markdown editing surface while locking the durable content contract and editor isolation boundary.
  - Proposed a Markdown architecture runway aligned with `ADR-0013`: canonical DB content remains markdown string; the editor is isolated inside each block; future rich markdown editing must not require notepage workflow or storage rewrite.
- **Files mentioned**:
  - `docs/engineering/decisions/ADR-0013-markdown-tile-editor.md`
  - `docs/product/prd/features/blocks/blocks.md`
- **Action proposed or taken**:
  - Add a "Resolved Markdown Architecture Runway" section to the Blocks PRD.
  - Keep M2 rich editing UX out of the ship commitment, but keep the M3 rich editor path structurally prepared.

### 2026-05-23 - Turn 7

- **Owner**: Challenged the first `blocks.md` structure:
  > 很奇怪，我认为blocks应该作为一个统筹，一个顶层abstract存在，而具体的block应该由block-markdown，block-code，block-image等负责
- **Codex response**:
  - Accepted the challenge.
  - Reframed `blocks.md` as the top-level abstract/coordinator PRD only.
  - Proposed concrete sub-PRDs under `features/blocks/`: `block-markdown.md`, `block-code.md`, `block-image.md`, and additional concrete block files only when product behavior needs explicit review.
- **Files mentioned**:
  - `docs/product/prd/features/blocks/blocks.md`
  - `docs/product/prd/features/blocks/block-markdown.md`
  - `docs/product/prd/features/blocks/block-code.md`
  - `docs/product/prd/features/blocks/block-image.md`
- **Action proposed or taken**:
  - Split markdown-specific details out of parent `blocks.md`.
  - Use parent/sub-PRD structure for concrete block kinds.

### 2026-05-23 - Turn 8

- **Owner**: Asked what callout does.
- **Codex response**:
  - Explained that callout usually means a small emphasized note/warning/info block.
  - Said it can often be represented by markdown plus styling unless the product needs a distinct content model or behavior.
- **Owner decision**:
  > 明白，我认为可以先删除这个block功能
- **Action proposed or taken**:
  - Remove callout from the current block candidate list.

### 2026-05-23 - Turn 9

- **Owner**: Asked what standalone math means and whether markdown can already do LaTeX.
- **Codex response**:
  - Clarified that math can initially be treated as a markdown capability rather than a separate block kind.
  - Said a standalone math block would only be justified if it later needs a distinct content model, editor, render lifecycle, or semantic operations.
- **Owner response**:
  > 你说的这个math block难道不就是单独的markdown block只负责math的功能吗？
- **Codex response**:
  - Agreed that, under current requirements, standalone math is premature and should not be a separate current PRD.
- **Action proposed or taken**:
  - Remove standalone math from the current block candidate list.
  - Record math as a future markdown capability under `block-markdown.md`.

### 2026-05-23 - Turn 10

- **Owner**: Selected the concrete block set:
  > markdown, image, code, canvas
- **Codex response**:
  - Accepted markdown/image/code.
  - Challenged the `canvas` name because product-level notepage had already used canvas-like language, and `canvas` also names an HTML implementation primitive.
  - Proposed naming the concrete block `drawing block` instead: a bounded sketch/diagram surface inside one block.
- **Owner**: Asked whether the previous product description "constrained canvas notepage" was accurate.
- **Codex response**:
  - Said the better product description is: "Notepage is a grid-composed web page" or "A notepage is a shareable web page composed from structured blocks on a responsive grid."
  - Clarified that this keeps the layout affordance without implying an infinite whiteboard or a single canvas editor.
- **Owner decision**:
  > 我觉得你的新描述更好，可以改了，然后把新的block sub prd也建立起骨架
- **Action proposed or taken**:
  - Update project/notepage wording toward grid-composed shareable web page.
  - Create `block-markdown.md`, `block-image.md`, `block-code.md`, and `block-drawing.md`.

## Open Items

- Exact M2 markdown authoring surface: source textarea, source-plus-preview, or minimal rich-compatible shell.
- Exact M3 block catalog: image/code/drawing are current candidates, but the count and final catalog remain open.
- Whether the M4 full catalog should include discussion as a block kind or keep discussion solely in the future `discussion/` feature PRD.
- How much of `plugin-system/new-block.md` should be rewritten after `blocks.md` lands.
- Exact drawing block scope: freehand sketch, diagramming, lightweight whiteboard, or smaller MVP.

## Artifact Updates

- 2026-05-23: Created this discussion record.
- 2026-05-23: Added `docs/product/prd/features/blocks/blocks.md`.
- 2026-05-23: Updated `docs/product/prd/features/README.md` so `blocks/` is visible as a Day-1 critical product feature.
- 2026-05-23: Updated `docs/product/prd/project.md` feature list so `blocks/` is visible at project level.
- 2026-05-23: Split `blocks.md` into parent abstraction plus concrete `block-*` sub-PRDs.
- 2026-05-23: Added `block-markdown.md`, `block-image.md`, `block-code.md`, and `block-drawing.md`.
- 2026-05-23: Removed callout and standalone math from current block candidates; math remains a markdown capability.
- 2026-05-23: Updated project/notepage product wording from constrained-canvas language toward grid-composed shareable web page.
- 2026-05-23: Updated plugin-system block catalog references so old "5 light / 9 full" wording no longer hard-codes callout/math.
- 2026-05-23: Removed active PRD/discussion references that could imply executable component syntax as a markdown-block product direction; legacy ADR/frozen references remain for later PRD-informed ADR cleanup.

## References

- Blocks PRD: [blocks.md](../../../product/prd/features/blocks/blocks.md)
- Markdown block PRD: [block-markdown.md](../../../product/prd/features/blocks/block-markdown.md)
- Image block PRD: [block-image.md](../../../product/prd/features/blocks/block-image.md)
- Code block PRD: [block-code.md](../../../product/prd/features/blocks/block-code.md)
- Drawing block PRD: [block-drawing.md](../../../product/prd/features/blocks/block-drawing.md)
- Notepage parent PRD: [notepage.md](../../../product/prd/features/notepage/notepage.md)
- Notepage editing PRD: [notepage-editing.md](../../../product/prd/features/notepage/notepage-editing.md)
- Plugin-system PRD: [plugin-system.md](../../../product/prd/features/plugin-system/plugin-system.md)
- New block extension PRD: [new-block.md](../../../product/prd/features/plugin-system/new-block.md)
- Markdown editor ADR: [ADR-0013](../../decisions/ADR-0013-markdown-tile-editor.md)
- Audit register: [AUDIT-2026-05.md](../../decisions/AUDIT-2026-05.md)

## Changelog

- 2026-05-23 initial record: captured the block-vs-AI sequencing decision, block/notepage/plugin boundary correction, PRD placement decision, and markdown M2/M3 runway framing.
- 2026-05-23 parent/sub split record: captured owner challenge that `blocks.md` should be top-level abstract only; recorded removal of callout/standalone math; recorded drawing naming and grid-composed notepage wording decision.
