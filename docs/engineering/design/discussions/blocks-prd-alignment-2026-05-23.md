# Discussion Record: Blocks PRD Alignment

| Field | Value |
|---|---|
| Date | 2026-05-23 |
| Subject | Blocks PRD placement, scope, and markdown block boundary |
| Participants | Owner, Codex |
| Trigger | Owner asked whether the next PRD should be block or AI integration. |
| Status | partially ratified |
| Output target | `docs/product/prd/features/blocks/` |

## Source

- Conversation source: owner/Codex planning discussion on 2026-05-23.
- Files under discussion:
  - `docs/product/prd/features/blocks/blocks.md`
  - `docs/product/prd/features/blocks/block-markdown.md`
  - `docs/product/prd/features/blocks/block-image.md`
  - `docs/product/prd/features/blocks/block-code.md`
  - `docs/product/prd/features/blocks/block-drawing.md`
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

### 2026-05-23 - Turn 11

- **Owner**: Asked to reconsider markdown block definition and pointed out that markdown is only one capability inside one block:
  > 你有考虑到，markdown只是一个block里的功能吗？一个页面里会有多个block。可能不同功能，也可能相同功能。view界面我认为暂时不需要担心，但editor界面需要考虑。我们编辑内容是block里编辑，block是内容的载体，notepage不管这些。
- **Codex response**:
  - Reframed markdown as a block-kind internal capability, not a page-level editor.
  - Stated that notepage edit mode hosts block instances and coordinates selection/focus/layout workflow, but does not own markdown parsing or markdown editing semantics.
  - Proposed that a page may contain multiple markdown block instances and multiple non-markdown block instances; same-kind markdown instances must keep content/editor state isolated.
- **Action proposed or taken**:
  - Update `block-markdown.md` with block-instance editing boundary.
  - Add BDD for multiple markdown block instance isolation and notepage-hosted editing without owning markdown semantics.

### 2026-05-23 - Turn 12

- **Owner**: Asked whether the current block definition was clear.
- **Codex response**:
  - Split the term into `block kind` and `block instance`.
  - Defined `block kind` as a content capability type such as markdown/image/code/drawing.
  - Defined `block instance` as one concrete content carrier inside a notepage with identity, kind, layout placement, durable content, and instance-local transient editing state.
  - Recommended moving this terminology from `block-markdown.md` up into parent `blocks.md`.
- **Owner decision**:
  > 可以，补以下
- **Action proposed or taken**:
  - Add parent `blocks.md` terminology for block kind, block instance, block content, and block surface.
  - Align `block-markdown.md` with that parent terminology.

### 2026-05-23 - Turn 13

- **Owner**: Raised performance concern for pages with many markdown block instances:
  > 在进行下一步的时候，需要考虑一个问题，一个页面里有诸多block markdown，多个实例会不会导致性能问题？你觉得怎么解决合适？
- **Codex response**:
  - Said performance problems occur if every markdown block instance permanently mounts a full editor/runtime.
  - Proposed the rule: a block instance can always exist, but editor runtime should exist only when needed.
  - Split "needed" into shell/preview/editor levels:
    - all block instances need lightweight shell;
    - visible or near-visible blocks need preview/render;
    - only the active content-editing block needs editor runtime.
- **Action proposed or taken**:
  - Prepare markdown PRD wording that distinguishes block instance, preview shell, and mounted editor.

### 2026-05-23 - Turn 14

- **Owner**: Asked when "needed" should be determined:
  > 这个needed的做法很聪明，但我先确认以下，你说的needed该什么时候判断？是当前页面看到的block全部认为是needed，还是点击才确定谁是needed并开始加载？
- **Codex response**:
  - Recommended three levels:
    - shell needed: all block instances;
    - preview/render needed: visible, near-visible, changed, or SSR-required blocks;
    - editor needed: only active content editing block.
  - Clarified that visible markdown blocks should render preview, not mount editor.
  - Clarified that clicking/focus/keyboard activation/new insertion can make a block editor-needed.
- **Action proposed or taken**:
  - Use active-block-only editor mounting in `block-markdown.md`.

### 2026-05-23 - Turn 15

- **Owner**: Asked whether repeated focus switching would cause latency/performance problems.
- **Codex response**:
  - Distinguished first editor runtime load from active-block switching cost.
  - Recommended a lightweight M2 editor and optional prewarm:
    - editor code can preload after entering notepage edit mode, selecting a markdown block, hovering/focusing, or inserting a markdown block;
    - switching active blocks should reuse loaded editor code;
    - mounted editor count should remain bounded.
- **Action proposed or taken**:
  - Keep PRD product rule focused on bounded mounted editor count and optional prewarm, leaving exact debounce/cache implementation to implementation/ADR.

### 2026-05-23 - Turn 16

- **Owner**: Ratified the lightweight active-editor model and clarified wording:
  > 我同意足够light，而且不需要编辑就能看到渲染后的markdown。而且每个block在这个设定下不会特别大。每次切换焦点时，退出edit模式，并能看到最新的block。你怎么看？
  >
  > 可以，这个做法很合适，我刚刚说的是light，其实我的意思是足够lite。先把我们的需求和看法先写回block markdown吧？并把我们的对话写回discussion如何？
- **Codex response**:
  - Proposed the final M2 rule:
    - inactive markdown block = rendered preview;
    - active markdown block = lightweight source-compatible editor plus rendered preview where feasible;
    - focus leave = accept current content into author working state, unmount editor, show latest rendered preview;
    - this is not publish/update-public.
- **Action proposed or taken**:
  - Write lightweight active-editor/focus-leave behavior into `block-markdown.md`.
  - Record this dialogue in this discussion record.

### 2026-05-23 - Turn 17

- **Owner**: Agreed with the proposed markdown stack direction and added a frontend constraint:
  > 我比较同意你的做法，并且我可以提前向你保证，前端技术栈大概率是REACT，不会采取其他的方式。
- **Codex response**:
  - Treated React as a product-level host assumption for M2 markdown UI.
  - Kept the core markdown contract independent from a single React component: canonical content remains markdown string; parsing, rendering, sanitization, and extraction should live behind markdown block-owned boundaries.
  - Recommended M2 direction:
    - React-hosted lightweight source editor or textarea;
    - source-plus-preview preferred for active markdown block where feasible;
    - inactive markdown blocks render preview/read output, not mounted editors;
    - mature markdown ecosystem pipeline rather than custom parser/renderer/editor;
    - CommonMark-compatible baseline plus GFM-style product expectations;
    - sanitization before preview/public rendering;
    - React markdown component may be used as an adapter, but must not become the content contract;
    - CodeMirror remains a later candidate if the lightweight M2 source editor is insufficient;
    - MDX/executable component semantics remain out of scope.
- **Action proposed or taken**:
  - Add React-hosted markdown stack direction to `block-markdown.md`.
  - Keep exact package/version lock for implementation spike or later ADR.

### 2026-05-23 - Turn 18

- **Owner**: Asked Codex to review a broad blocks PRD change and qualitative reframing:
  > 刚刚进行了一个大范围改动和定性，你先看一下？
- **Codex response**:
  - Reviewed changes to `blocks.md`, `block-markdown.md`, and this discussion record.
  - Said the main direction is correct: blocks are now framed as the content-kind capability layer between notepage and plugin-system, and markdown is constrained as a block-kind internal capability rather than a page-level editor.
  - Said the new distinction between `block kind` and `block instance` is important because it supports multiple markdown instances in one notepage, future search/AI/export behavior, and plugin-system rework.
  - Said the lightweight active-editor model is sound:
    - inactive markdown block = rendered preview;
    - active markdown block = lightweight source-compatible editor plus preview where feasible;
    - focus leave = accept block-local content into author working state, unmount editor, show latest rendered preview;
    - focus leave is not publish/update-public.
  - Said React/unified/remark/rehype direction is not blocking as long as package choices remain implementation-spike or ADR candidates rather than product-hard commitments.
  - Raised three concrete findings:
    1. `blocks.md` defines `Block instance` as having `layout placement`, which can conflict with the same PRD's rule that GridState owns geometry/placement and block content is not layout. Recommended wording: block instance has identity/kind/content/editor state, and placement is associated by the notepage/GridState host rather than owned by block kind/content semantics.
    2. `blocks.md` lists concrete block PRDs under `PRD-layer upstream dependencies`. Recommended moving concrete block PRDs out of Dependencies and keeping them in the top sub-PRD table plus References, because the parent owns the sub-PRDs rather than depending on them.
    3. Parent `blocks.md` still uses `markdown editor runway`; `block-markdown.md` now uses `editor replacement boundary`. Recommended synchronizing parent wording to avoid carrying the old ADR-0013 framing forward.
  - Recommended strengthening one sentence around the markdown stack: unified/remark/rehype/React component/CodeMirror are implementation-spike candidates, while the product hard constraints are React-hosted UI, markdown string as canonical content, block-owned render/extract/sanitize boundaries, and no executable markdown component model.
- **Files mentioned**:
  - `docs/product/prd/features/blocks/blocks.md`
  - `docs/product/prd/features/blocks/block-markdown.md`
  - `docs/engineering/design/discussions/blocks-prd-alignment-2026-05-23.md`
- **Action proposed or taken**:
  - Append this review to the discussion record.
  - Treat the three findings as cleanup items before blocks PRDs feed AI-Integration, search-discovery, plugin-system, or ADR rework.

### 2026-05-23 - Turn 19

- **Owner**: Asked Codex to use `grill-with-docs`, `improve-codebase-architecture`, and `prototype` to do a more complete closeout for the blocks PRD.
- **Codex response**:
  - Used `grill-with-docs` against the current PRDs and discussion record rather than asking new owner questions where the existing docs already answered the branch:
    - block kind vs block instance is the correct canonical split;
    - notepage owns workflow and GridState placement;
    - block kind owns content semantics, render/edit/extract/fallback behavior;
    - plugin-system remains extension mechanics, not the definition of block product behavior.
  - Used `improve-codebase-architecture` framing to identify two deep modules the implementation should preserve later:
    - a block-kind module whose interface is the shared block surface consumed by notepage, search, export, and future AI;
    - a markdown render/extract/sanitize module where React components act as UI adapters at the seam, not as the source of markdown semantics.
  - Used `prototype` as a throwaway logic prototype, not a UI prototype, because the risky question was state-model correctness.
  - Prototype question:
    - Does the markdown block state model preserve one active editor, isolated block content, preview updates on focus leave, public-state separation, and GridState stability?
  - Prototype verdict:
    - two markdown block instances can keep isolated working content;
    - only the active block mounts an editor;
    - focus switch/blur accepts active content into author working state and updates inactive preview;
    - public readers stay on old public state until update-public;
    - markdown content/focus actions do not mutate GridState.
- **Action proposed or taken**:
  - Updated `blocks.md` to clarify block instance placement ownership, remove concrete sub-PRDs from upstream dependencies, replace markdown runway wording with editor replacement framing, and record block-kind module depth as the stable product interface.
  - Updated `block-markdown.md` to resolve M2 authoring direction as React-hosted lightweight source-plus-preview, capture prototype-validated state separation, and narrow remaining open questions.
  - Deleted the throwaway prototype after absorbing its verdict into durable PRD/discussion text.

## Open Items

- Exact M2 markdown stack package lock: likely unified/remark/rehype-family rendering/sanitization/extraction with a React adapter, but final package/version choices need an implementation spike or later ADR.
- Exact M2 markdown implementation details: concrete textarea/minimal-source-editor adapter, preview debounce/cache key, and supported CommonMark/GFM subset.
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
- 2026-05-23: Added block kind / block instance / block content / block surface terminology to `blocks.md`.
- 2026-05-23: Updated `block-markdown.md` with block-instance editing boundary, lightweight active editor behavior, rendered preview for inactive markdown blocks, focus-leave accept-to-author-working-state behavior, bounded mounted editor count, and performance boundary.
- 2026-05-23: Updated `block-markdown.md` with React-hosted markdown stack direction while preserving markdown string as the content contract and keeping render/extract/sanitize behavior behind block-owned boundaries.
- 2026-05-23: Appended broad blocks PRD review covering block instance placement boundary, parent/sub-PRD dependency layering, parent wording cleanup, and markdown stack commitment precision.
- 2026-05-23: Closed Turn 18 findings in `blocks.md`; updated `block-markdown.md` with closeout notes from a throwaway markdown block state prototype; deleted the prototype after absorbing the verdict.

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
- Deprecated markdown editor ADR: [ADR-0013](../../decisions/ADR-0013-markdown-tile-editor.md)
- Audit register: [AUDIT-2026-05.md](../../decisions/AUDIT-2026-05.md)
- CommonMark: <https://commonmark.org/>
- unified: <https://github.com/unifiedjs/unified>
- remark: <https://github.com/remarkjs>
- micromark: <https://github.com/micromark/micromark>
- rehype-sanitize: <https://github.com/rehypejs/rehype-sanitize>
- CodeMirror basic editor example: <https://codemirror.net/examples/basic/>

### 2026-05-23 - Turn 20

- **Owner**: Asked Codex to re-review `block-markdown.md` using the earlier multi-angle review standard:
  > 可以，以这个标准再审一下block-markdown？
- **Codex response**:
  - Reviewed `block-markdown.md` against:
    - document / PRD angle;
    - writer, reader, and executor angle;
    - community / open-source contributor angle;
    - extensibility / maintainability angle;
    - agent constraint angle.
  - Said the document is directionally much stronger than the previous version because it now frames markdown as a block-kind internal capability rather than a page-level editor.
  - Said `Resolved Closeout Notes` are useful because they clarify active-editor behavior, focus leave, public-state separation, layout separation, and prototype validation.
  - Raised four findings:
    1. The `React Host and Markdown Stack Direction` section still leans toward HOW because it names candidate technologies such as `unified`, `remark`, `rehype`, and `CodeMirror`. Codex recommended keeping product constraints in PRD and moving package/library choices to ADR debt or implementation spike notes.
    2. The canonical content wording says `markdown string plus minimal metadata`, but it does not define the metadata boundary. Codex recommended clarifying that markdown block metadata is only markdown semantics/rendering metadata; identity, placement, visibility, public-state, timestamps, and host orchestration belong to notepage / block instance host / substrate layers.
    3. The focus-leave BDD says content is accepted into author working state. Codex said this is correct but should make clear that the notepage host owns persistence orchestration so an implementation agent does not let markdown block directly write page-level working state.
    4. Non-goals say exact parser/editor package lock is out of scope, while the preferred stack section names candidate libraries. Codex recommended adding a clarification that named libraries are spike candidates only, not ratified product truth.
  - Multi-angle summary:
    - **Document / PRD**: structure is clear; technology candidates should be downgraded from product truth.
    - **Writer / reader / executor**: reader can understand markdown as block-kind behavior; executor needs clearer persistence ownership.
    - **Community / open-source**: `block kind` / `block instance` terminology is contributor-friendly; `author working state` should be introduced as a notepage term.
    - **Extensibility / maintainability**: editor replacement boundary is the right long-term frame; metadata boundary needs tightening.
    - **Agent constraints**: no MDX, no executable components, no page-level editor, active-editor-only mounting are good hard limits; risk remains that agents may over-read `unified/remark/rehype` as fixed stack.
- **Files mentioned**:
  - `docs/product/prd/features/blocks/block-markdown.md`
  - `docs/product/prd/features/blocks/blocks.md`
  - `docs/product/prd/features/notepage/notepage.md`
  - `docs/product/prd/features/notepage/notepage-editing.md`
- **Action proposed or taken**:
  - Append this review to the discussion record.
  - Treat the four findings as cleanup items before using `block-markdown.md` as input to ADR rework or AI/search PRD design.

### 2026-05-23 - Artifact Update

- Appended Codex's five-angle review of `block-markdown.md`, including technology-stack wording, metadata boundary, notepage-owned persistence orchestration, package-lock ambiguity, and agent constraint risks.

## Changelog

- 2026-05-23 initial record: captured the block-vs-AI sequencing decision, block/notepage/plugin boundary correction, PRD placement decision, and early markdown editor-boundary framing.
- 2026-05-23 parent/sub split record: captured owner challenge that `blocks.md` should be top-level abstract only; recorded removal of callout/standalone math; recorded drawing naming and grid-composed notepage wording decision.
- 2026-05-23 markdown editor model record: captured block kind vs block instance terminology, markdown block-instance editing boundary, performance concern for many markdown instances, and the ratified lightweight active-editor / rendered-preview / focus-leave behavior.
- 2026-05-23 React markdown stack record: captured React as the frontend host assumption and recorded the mature markdown pipeline direction without binding the product contract to one React component.
- 2026-05-23 broad blocks review record: integrated the broad PRD reframing review into the main dialogue log instead of a separate continuation section.
- 2026-05-23 skill closeout record: captured grill-with-docs conclusions, architecture deepening candidates, prototype verdict, and resulting PRD cleanup.
- 2026-05-23 block-markdown five-angle review: appended Codex review findings as Turn 20 on technology-stack wording, metadata boundary, persistence ownership, package-lock ambiguity, and agent constraints.
