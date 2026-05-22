# Discussion Record: Notepage PRD template and sub-PRD alignment review

| Field | Value |
|---|---|
| Date | 2026-05-22 |
| Subject | Notepage parent PRD template and sub-PRD alignment |
| Participants | W_YI + Codex |
| Trigger | Owner asked whether notepage PRDs should follow the newer PRD discipline after the self-host PRD cleanup |
| Status | pending owner/writer rewrite |
| Output target | `docs/product/prd/features/notepage/notepage.md`; possible follow-up edits to `notepage-view.md`, `notepage-editing.md`, and `notepage-responsive.md` |

## Source

- Conversation source: W_YI and Codex discussion on 2026-05-22.
- Files under discussion:
  - `docs/product/prd/features/notepage/notepage.md`
  - `docs/product/prd/features/notepage/notepage-view.md`
  - `docs/product/prd/features/notepage/notepage-editing.md`
  - `docs/product/prd/features/notepage/notepage-responsive.md`
  - `docs/process/methods/prd-discipline.md`
- Related background:
  - Prior self-host PRD cleanup for `setup-time.md`, `runtime.md`, and `self-host-deploy.md`.
  - Updated discussion-record rule: discussion records should be append-only factual logs, not second-pass summaries.

## Dialogue Log

### 2026-05-22 - Turn 1

- **Owner**: Asked whether `notepage.md` should also be changed to the latest template.
- **Codex response**:
  - Said `notepage.md` should be upgraded, but with a different application of the template than `setup-time.md` / `runtime.md`.
  - Said the self-host sub-PRD form is suited to operator-lifecycle documents; notepage parent PRD should instead act as the feature-folder parent.
  - Said `notepage.md` should lock shared product concepts and cross-cutting invariants rather than duplicate sub-PRD acceptance details.
  - Said sub-PRDs should not be mechanically converted into the self-host operator-lifecycle form.
- **Files mentioned**:
  - `docs/product/prd/features/notepage/notepage.md`
  - `docs/product/prd/features/notepage/notepage-view.md`
  - `docs/product/prd/features/notepage/notepage-editing.md`
  - `docs/product/prd/features/notepage/notepage-responsive.md`
  - `docs/process/methods/prd-discipline.md`
- **Action proposed or taken**:
  - Proposed parent-first rewrite:
    1. Rewrite `notepage.md` as the parent PRD.
    2. Keep sub-PRDs in standard feature PRD form.
    3. Align sub-PRDs only after parent-level invariants are clarified.

### 2026-05-22 - Turn 2

- **Owner**: Asked whether sub-PRD descriptions should align with the current standard, especially under the same evaluation angles used earlier: document/PRD, writer/reader/executor, community/open-source, maintainability/extensibility, and agent constraints.
- **Codex response**:
  - Said yes, sub-PRD descriptions should align with the newer discipline.
  - Clarified that "alignment" means description/scope cleanup, not a full template migration.
  - Said the parent PRD should own shared invariants, and sub-PRDs should reference those invariants instead of reopening them.
  - Said several existing open questions appear to be parent-level product decisions that should be ratified or explicitly kept pending before ADR rework.
- **Files mentioned**:
  - `notepage.md`: parent-level owner-leaning decisions around canonical URL and title metadata were called out.
  - `notepage-view.md`: author preview URL wording, concrete keyboard bindings, and scroll-state storage wording were called out.
  - `notepage-editing.md`: current structure was described as mostly aligned because it separates algorithm contract, user behavior, accessibility baseline, and out-of-PRD implementation choices.
  - `notepage-responsive.md`: mobile edit scope, tablet breakpoint behavior, viewport-vs-touch detection, and viewport-driven font sizing wording were called out.
- **Action proposed or taken**:
  - Proposed sub-PRD alignment pass after parent rewrite.
  - Proposed keeping `notepage-editing.md` mostly intact.
  - Proposed giving `notepage-responsive.md` the heaviest cleanup because some Must statements still overlap with Open questions.

### 2026-05-22 - Turn 3

- **Owner**: Asked Codex to write the two rounds of conversation into a new discussion record.
- **Codex response**:
  - Created `docs/engineering/design/discussions/notepage-prd-alignment-2026-05-22.md`.
  - Initial version used a synthesized Section A/B/C style summary.
- **Files mentioned**:
  - `docs/engineering/design/discussions/notepage-prd-alignment-2026-05-22.md`
- **Action proposed or taken**:
  - Discussion record was created.

### 2026-05-22 - Follow-up

- **Owner**: Said future discussion templates should respect factual dialogue, use append-only form, and avoid second-pass summary content.
- **Codex response**:
  - Updated `docs/engineering/design/discussions/README.md` to define discussion records as append-only factual logs.
  - Reworked this notepage discussion record into the same dialogue-log shape.
- **Files mentioned**:
  - `docs/engineering/design/discussions/README.md`
  - `docs/engineering/design/discussions/notepage-prd-alignment-2026-05-22.md`
- **Action proposed or taken**:
  - Template updated.
  - This record converted from synthesized summary form to factual dialogue-log form.

### 2026-05-22 - Turn 4

- **Owner**: Responded to Codex's proposed parent-level decisions:
  > 我对于你说的这几个需要的决策进行回答，然后你把你和我的对话补录回discussion中。1. create默认private比较合适，没有draft版本，可以切换至public。author只有完成编辑reader才能看到比较合适，没有立刻看到改动的需要，只有在编辑面比如说写markdown block的时候最好要立刻能看到改动，当然，这个不是必须的。publish这个前面有讲，简化至private/public就够了。delete后这个需要你细讲？2. URL目前的设计只能说是temp版本，这个版本太限制发挥，我需要看看你的想法。345都同意
- **Codex response**:
  - Said the owner answer makes the parent PRD direction clearer: newly created notepages should default to private, and the product-level visibility model should be simplified to private/public rather than a visible draft/publish workflow.
  - Noted a remaining modeling tension: if readers should not see author edits until the author finishes editing, the implementation still needs some separation between author working state and public read state. Codex recommended not exposing this as a product-level "draft version"; instead the PRD can describe it as "public readers see the last completed public state; author working edits become reader-visible only after an explicit complete/update-public action."
  - Said markdown/block editing can still show immediate feedback inside the author editing surface without making those partial edits public.
  - Explained the delete question as a visibility/URL decision:
    - `private -> delete`: no public URL semantics; normal read path should not reveal the resource to anonymous users.
    - `public -> private`: should not be treated as delete; public readers lose access, and the URL should not leak more than the chosen auth/privacy policy allows.
    - `public -> delete`: the current `notepage-view.md` says old URL returns `410 Gone`, but Codex recommended challenging that for M2. A privacy-preserving default is external `404` for deleted/private-inaccessible content, with internal `deleted_at` / tombstone retained for backup, audit, and slug reuse protection. `410 Gone` can be a later explicit public tombstone choice if SEO transparency is preferred over privacy.
    - Slug reuse must be decided together with delete. Codex recommended "do not silently reuse a deleted public slug for unrelated new content" unless an explicit alias/tombstone rule is defined.
  - Said the current `/notes/:slug` design should be treated as temporary route syntax, not as the final product URL contract.
  - Proposed a more flexible URL framing for the parent PRD:
    - Parent PRD should lock route classes, not exact path strings.
    - There is one canonical public read identity per public notepage.
    - Author edit and preview surfaces are non-canonical and `noindex`.
    - Internal identity should be stable even if visible URL syntax later changes.
    - M2 can use `/notes/:slug` as an implementation default, but the PRD should allow future shapes such as author-scoped URLs, custom domains, or app-internal edit routes.
    - A possible mental model is: public read route = canonical/shareable; authoring route = authenticated app surface; preview route = noindex non-canonical reader rendering of author working state.
  - Recorded that owner agreed with Codex's earlier points 3/4/5:
    - Parent PRD should define notepage data boundary as page metadata + GridState/layout + block state/content + visibility/public-read state + theme reference/override.
    - `notepage-responsive.md` should clean up Must/Open Question conflicts around mobile edit scope, tablet 6-col behavior, and viewport-vs-touch detection.
    - Font-size wording should avoid requiring continuous viewport-based fluid type; it should instead require readable typography per breakpoint/theme token.
- **Files mentioned**:
  - `docs/product/prd/features/notepage/notepage.md`
  - `docs/product/prd/features/notepage/notepage-view.md`
  - `docs/product/prd/features/notepage/notepage-responsive.md`
  - `docs/product/prd/features/notepage/notepage-editing.md`
- **Action proposed or taken**:
  - Append this turn to the discussion record.
  - Keep URL syntax as a temporary M2 implementation detail until the parent PRD rewrite locks route classes and canonical/non-canonical behavior.
  - Carry the delete/visibility decision into the parent PRD rewrite before updating `notepage-view.md`.

### 2026-05-22 - Turn 5

- **Owner**: Synchronized a future delivery discipline before the notepage sub-PRD rewrite:
  > 那我们先准备做一轮notepage这部分的sub PRD更改？更改之前，我需要向你同步一个信息，即之后执行我认为需要采用TDD+BDD双轨模式。
- **Codex response**:
  - Interpreted the proposed dual track as:
    - **TDD track**: implementation discipline for each vertical slice, using behavior tests through public interfaces and red/green/refactor.
    - **BDD track**: PRD/acceptance discipline, using user-observable scenarios such as `Given / When / Then`.
  - Recommended keeping TDD out of product PRDs and using PRDs to capture BDD scenarios and product acceptance.
  - Recommended carrying TDD into implementation issues / PRs, where each PR should identify the covered BDD scenario, observe a failing test, implement the minimal change, and show green verification.
- **Files mentioned**:
  - `docs/product/prd/features/notepage/notepage.md`
  - `docs/product/prd/features/notepage/notepage-view.md`
  - `docs/product/prd/features/notepage/notepage-editing.md`
  - `docs/product/prd/features/notepage/notepage-responsive.md`
- **Action proposed or taken**:
  - Use BDD scenarios in notepage PRDs.
  - Treat TDD as delivery discipline for M-stage implementation issues / PRs, not as product-spec content.

### 2026-05-22 - Turn 6

- **Owner**: Clarified the boundary:
  > 我觉PRD里至写BDD就够了，TDD应该落实到每个M stage里，或者说，每一个PR里。
- **Codex response**:
  - Agreed with the boundary.
  - Restated the rule as:
    - PRD writes BDD only: user/system observable behavior and acceptance scenarios.
    - TDD belongs to M-stage implementation slices, issues, and PR checklists.
    - M-stage sections may state behavior coverage expectations, but should not describe red/green/refactor process.
  - Proposed that future implementation PRs include:
    - BDD scenario covered.
    - failing test observed.
    - green verification command.
  - Recommended that the notepage PRD rewrite add `BDD Acceptance Scenarios` or convert acceptance sections into scenario-shaped checks.
- **Files mentioned**:
  - `docs/product/prd/features/notepage/notepage.md`
  - `docs/product/prd/features/notepage/notepage-view.md`
  - `docs/product/prd/features/notepage/notepage-editing.md`
  - `docs/product/prd/features/notepage/notepage-responsive.md`
- **Action proposed or taken**:
  - Append this conversation to the discussion record.
  - Start rewriting the notepage PRD set with BDD scenarios in PRDs and TDD reserved for later implementation issues / PRs.

## Open Items

- Owner/writer has not yet rewritten `notepage.md`.
- Owner/writer has not yet ratified whether `/notes/:slug` is the single canonical public identity with edit/preview as non-canonical mode variants.
- Owner/writer has not yet ratified whether title, slug, description, SEO metadata, and OG metadata are page metadata outside GridState.
- Owner/writer has not yet ratified author preview URL/state shape.
- Owner/writer has not yet ratified mobile Day-1 edit scope.
- Owner/writer has not yet ratified whether tablet behavior is fixed as 6-col by viewport width.
- Owner/writer has not yet ratified whether viewport width is the responsive product rule and touch/mouse only changes affordances.
- Owner/writer has not yet ratified undo/redo scope across block editor state and notepage GridState.

### Follow-up status after 2026-05-22 Turn 4

- Owner has indicated `create` should default to private.
- Owner has indicated notepage visibility can be simplified to private/public and should not expose a separate product-level draft version.
- Owner has indicated reader-visible updates should happen only after author finishes editing, while author-side markdown/block editing may still show immediate feedback in the editing surface.
- Owner has agreed that parent PRD should define the notepage data boundary.
- Owner has agreed that `notepage-responsive.md` needs Must/Open Question cleanup.
- Owner has agreed that font readability wording should not mandate continuous viewport-based fluid font sizing.
- URL route syntax remains open; Codex recommended route-class framing instead of locking `/notes/:slug` as the final product contract.
- Delete semantics remain open; Codex recommended resolving public/private/delete/slug-reuse/404-vs-410 together before rewriting `notepage-view.md`.
- Owner and Codex agreed that PRDs should carry BDD acceptance scenarios only.
- Owner and Codex agreed that TDD belongs to M-stage implementation issues / PRs, not to PRD body text.

### Follow-up status after PRD rewrite pass

- `notepage.md` was rewritten around parent model, data boundary, private/public visibility, author working state vs public read state, route classes, privacy-preserving delete default, and BDD acceptance scenarios.
- `notepage-view.md` was rewritten around canonical public read route, private/deleted no-leak behavior, preview noindex, SSR/SEO, response behavior matrix, and view BDD scenarios.
- `notepage-editing.md` was rewritten around author working state, insert/move/resize/delete behavior, update-public action, product-facing algorithm contract, and editing BDD scenarios.
- `notepage-responsive.md` was rewritten around viewport-width projection, desktop 12-col / tablet 6-col / mobile 1-col, touch as affordance only, mobile limited authoring, readable typography, and responsive BDD scenarios.
- `features/README.md` was synchronized with the rewritten notepage PRD scopes.
- Remaining open decisions after rewrite:
  - final public URL syntax;
  - exact update-public action label/placement;
  - future public tombstone / `410 Gone` behavior;
  - slug reuse / alias policy;
  - undo/redo scope;
  - exact mobile content-editing extent beyond M2 baseline.

### 2026-05-22 - Turn 7

- **Owner**: Pointed out that the current notepage PRDs describe only foundational single-page capabilities, while future UX improvements may include:
  - switching/browsing multiple notes within the same page or context;
  - placing notes into folders for organization;
  - referencing blocks across pages.
- **Owner**: Clarified that these future capabilities should not be prematurely constrained by the current PRDs:
  > 对，目前这些是基础功能，所以我们先不设限。像是不同文件夹还会涉及到单根多根森林做法，引用还会涉及到删除等问题。这些都是需要大量工程实践经验才会有的。所以主要是，强调这些PRD只限制在单页最基础功能，而不是提前说明这是全部功能。
- **Codex response**:
  - Agreed that the current notepage PRDs should be framed as **single-notepage foundation**, not the final product boundary.
  - Said cross-notepage browsing, folders/collections, single-root vs multi-root workspace forest, cross-page block references, backlinks, and graph/search discovery should remain future cross-page capabilities.
  - Recommended that the parent PRD explicitly state that it only defines one notepage's foundational behavior and must not preclude later organization/reference models.
  - Noted that the current parent decisions still help future extension by preserving stable notepage identity, metadata outside GridState, visibility/delete semantics, and route-class framing.
- **Files mentioned**:
  - `docs/product/prd/features/notepage/notepage.md`
  - `docs/product/prd/features/notepage/notepage-view.md`
  - `docs/product/prd/features/notepage/notepage-editing.md`
  - `docs/product/prd/features/notepage/notepage-responsive.md`
- **Action proposed or taken**:
  - Add a single-notepage foundation boundary note to the parent PRD.
  - Keep cross-page organization/reference features out of M2 notepage sub-PRDs.

### 2026-05-22 - Turn 8

- **Owner**: Challenged the responsive rewrite's tablet 6-col projection:
  > tablet 6-column是个很尴尬的数，建议同样的12col，因为6col无法处理2/3 1/3大小
- **Codex response**:
  - Agreed with changing the direction to 12-col for tablet.
  - Clarified that `2/3 + 1/3` can be represented mathematically as `4 + 2` in 6-col, but the stronger product issue is that 6-col weakens layout fidelity and splits author mental model between desktop and tablet.
  - Recommended changing tablet from `6-col projection` to `12-col compact projection`.
  - Recommended keeping mobile as 1-col flow.
  - Recommended solving tablet readability through container constraints, touch-friendly affordances, min-width/overflow/zoom safeguards, and mobile breakpoint fallback instead of rewriting the column system.
- **Files mentioned**:
  - `docs/product/prd/features/notepage/notepage-responsive.md`
  - `docs/product/prd/features/notepage/notepage.md`
  - `docs/product/prd/features/README.md`
- **Action proposed or taken**:
  - Replace tablet 6-col with tablet 12-col compact projection in responsive PRD.
  - Synchronize parent PRD and feature index wording.

### 2026-05-22 - Turn 9

- **Owner**: Asked Codex to review the latest notepage PRD rewrite pass:
  > 进行了一轮修改，你看一下？
- **Codex response**:
  - Said the overall direction is correct: the rewrite moves notepage toward a parent model plus clearer `view` / `editing` / `responsive` sub-PRD ownership.
  - Said the following directions are stronger than the previous version:
    - `private/public only`;
    - `last completed public state`;
    - route class over exact path syntax;
    - metadata outside GridState;
    - tablet `12-col compact` instead of tablet `6-col`.
  - Raised five findings:
    1. `notepage-prd-alignment-2026-05-22.md` still has stale `Open Items` that say parent PRD / title metadata / tablet 6-col decisions are not ratified, even though later turns and rewrite status supersede them. Codex recommended appending a new current-open-items section instead of editing old entries.
    2. `notepage-responsive.md` still has old `12/6/1-col render projections` wording in a surfaced ADR debt; Codex said this should be changed to desktop/tablet `12-col` plus mobile `1-col` wording.
    3. `notepage.md` lists child sub-PRDs under `PRD-layer upstream dependencies`; Codex said this conflicts with the upstream-only dependency rule because the parent owns the sub-PRDs. Codex recommended keeping sub-PRDs in the `Sub-PRDs` section and References, not Dependencies.
    4. `notepage.md` says `PRD uses BDD only`; Codex said this is too strong because the PRD still needs Product Decisions, Invariants, and Reference sections. Recommended wording: acceptance uses BDD scenarios; TDD belongs to issues/PRs.
    5. `notepage-responsive.md` hardcodes mobile as `< 640px` in BDD while also keeping exact breakpoint as open. Codex said either `640px` should become the M2 default product value, or the BDD should say `below the configured mobile breakpoint`.
- **Files mentioned**:
  - `docs/engineering/design/discussions/notepage-prd-alignment-2026-05-22.md`
  - `docs/product/prd/features/notepage/notepage.md`
  - `docs/product/prd/features/notepage/notepage-responsive.md`
  - `docs/product/prd/features/notepage/notepage-view.md`
  - `docs/product/prd/features/notepage/notepage-editing.md`
- **Action proposed or taken**:
  - Append this review to the discussion record.
  - Do not directly rewrite old discussion entries.
  - Recommended follow-up cleanup before treating the notepage rewrite as ready for ADR rework.

### Current Open Items after 2026-05-22 rewrite cleanup

These items supersede the earlier historical `Open Items` list without editing that list in place.

- Final public URL syntax: M2 may use `/notes/:slug`, but route-class behavior is the product contract.
- Author complete/update-public action: exact label, placement, and automatic-vs-explicit behavior.
- Future public delete response: whether to add intentional public tombstone / `410 Gone` behavior after M2.
- Slug reuse and alias policy for deleted or renamed public pages.
- Undo/redo scope across block editor state, notepage GridState, and combined author history.
- Mobile content-editing extent beyond the M2 read-first baseline and limited authoring allowance.
- Future cross-page capabilities: multi-note browsing, folders/collections, workspace forest, cross-page block references, backlinks, and graph/search discovery.

## Artifact Updates

- 2026-05-22: Created this discussion record.
- 2026-05-22: Updated `docs/engineering/design/discussions/README.md` to define future discussion records as append-only factual logs.
- 2026-05-22: Converted this discussion record into the factual `Dialogue Log` form.
- 2026-05-22: Appended owner answers and Codex follow-up on private-by-default create, no product-level draft version, reader-visible update timing, URL route-class framing, delete semantics, data boundary, responsive cleanup, and font readability wording.
- 2026-05-22: Appended owner/Codex agreement that PRDs should express BDD scenarios, while TDD belongs to M-stage implementation issues and PR execution discipline.
- 2026-05-22: Recorded notepage parent/view/editing/responsive PRD rewrite pass and remaining open decisions.
- 2026-05-22: Appended owner/Codex discussion that current notepage PRDs define single-notepage foundation only and must not preclude future cross-page browsing, folder/workspace organization, or block reference capabilities.
- 2026-05-22: Appended owner/Codex discussion rejecting tablet 6-col and switching tablet responsive behavior to 12-col compact projection.
- 2026-05-22: Appended Codex review of the latest notepage PRD rewrite pass, including stale discussion open items, residual 6-col wording, dependency-layer cleanup, BDD wording precision, and mobile breakpoint ambiguity.
- 2026-05-22: Appended current open items after rewrite cleanup, treating earlier open-item lists as historical log entries.

## References

- Parent PRD under discussion: [notepage.md](../../../product/prd/features/notepage/notepage.md)
- Sub-PRDs:
  - [notepage-view.md](../../../product/prd/features/notepage/notepage-view.md)
  - [notepage-editing.md](../../../product/prd/features/notepage/notepage-editing.md)
  - [notepage-responsive.md](../../../product/prd/features/notepage/notepage-responsive.md)
- PRD discipline: [prd-discipline.md](../../../process/methods/prd-discipline.md)
- Discussion record template: [README.md](./README.md)
- Audit register: [AUDIT-2026-05.md](../../decisions/AUDIT-2026-05.md)
- Related discussion records:
  - [self-host-setup-time-2026-05-21.md](./self-host-setup-time-2026-05-21.md)
  - [self-host-runtime-2026-05-22.md](./self-host-runtime-2026-05-22.md)
  - [self-host-deploy-2026-05-22.md](./self-host-deploy-2026-05-22.md)

## Changelog

- 2026-05-22 initial record: created after owner asked to capture the two notepage PRD alignment turns.
- 2026-05-22 format correction: converted from synthesized Section A/B/C summary into factual `Dialogue Log` form after owner updated discussion-record expectations.
- 2026-05-22 follow-up: appended owner answers and Codex response on visibility, edit/public-read separation, URL flexibility, delete semantics, data boundary, responsive cleanup, and font readability wording.
- 2026-05-22 BDD/TDD boundary: appended agreement that notepage PRDs should contain BDD acceptance scenarios only; TDD is enforced later per M-stage implementation issue / PR.
- 2026-05-22 rewrite status: recorded parent and three sub-PRD rewrite outputs plus remaining open decisions.
- 2026-05-22 single-page scope: appended clarification that current notepage PRDs define single-notepage foundation and leave future cross-page organization/reference capabilities unconstrained.
- 2026-05-22 responsive tablet follow-up: appended owner challenge and direction to use tablet 12-col compact projection instead of tablet 6-col.
- 2026-05-22 rewrite review: appended Codex review findings after the notepage parent/sub-PRD rewrite pass.
- 2026-05-22 rewrite cleanup: appended current open items after resolving stale open-item framing, residual 6-col wording, dependency layering, BDD wording, and mobile breakpoint ambiguity.

## Append-Only Continuation

### 2026-05-23 - Turn 10

- **Owner**: Clarified that the 2026-05-22 dates in the PRD metadata/changelog are correct because the relevant work was done on 2026-05-22:
  > 日期是没问题的，那些工作都是22日做的。可以更新到discussion里了
- **Codex response**:
  - Accepted the owner's date clarification.
  - Said the date/timeline concern from the latest review should be dropped.
  - Kept the remaining substantive finding: `notepage.md` still has a semantic mismatch where the body requires an explicit complete/update-public action before readers see author edits, but the Open Question still asks whether the action is automatic on save or explicit.
  - Recommended changing the open question to keep only label, placement, and possible UI coupling with save, without reopening the already-decided explicit reader-visible update boundary.
- **Files mentioned**:
  - `docs/product/prd/features/notepage/notepage.md`
  - `docs/product/prd/features/notepage/notepage-editing.md`
  - `docs/engineering/design/discussions/notepage-prd-alignment-2026-05-22.md`
- **Action proposed or taken**:
  - Append this review clarification to the discussion record.
  - Preserve 2026-05-22 timestamps as correct historical dates.
  - Treat the only remaining review concern as the `automatic on save` wording in the parent PRD Open Questions.

### 2026-05-23 - Artifact Update

- Appended owner date clarification and Codex's narrowed review finding. No previous dialogue entries were edited.
