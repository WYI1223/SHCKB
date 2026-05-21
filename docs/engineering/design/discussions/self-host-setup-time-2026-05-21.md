# Discussion Record: Self-host setup-time PRD narrative form review

| Field | Value |
|---|---|
| Date | 2026-05-21 |
| Subject | self-host-deploy/setup-time.md pass 2 narrative form + scope review |
| Participants | W_YI + Codex |
| Trigger | After authentication PRD closeout, owner asked to review `setup-time.md` and evaluate whether this PRD form should become the default for next PRDs |
| Status | partially ratified — narrative-first form accepted for suitable PRDs; readability/accuracy constraint added |
| Output target | `docs/product/prd/features/self-host-deploy/setup-time.md`; possible later sync to `self-host-deploy.md` / `AUDIT-2026-05.md` |

## Context

`setup-time.md` pass 2 changed from section-by-section checklist form into a narrative-first form:

- What this PRD covers
- Why
- The whole picture
- User-facing experience
- MVP / Progressive completeness / Done
- Reference appendix

Codex assessment: this form is good for **operator-facing lifecycle PRDs** and other system-facing PRDs where the reader must first understand a timeline / mental model / operating mode. It should not be applied mechanically to every PRD. For user-facing feature PRDs, the same skeleton can work only if the narrative preserves explicit user stories, milestone acceptance, dependencies, open questions, and surfaced debts.

Recommended future rule:

- Use this **narrative-first + reference appendix** form for lifecycle / operator / system-facing PRDs.
- Keep compact user-story / functional-requirement form for narrow end-user flows.
- Do not let narrative form hide M-stage scope. M2/M3/M4 acceptance must remain explicit and mechanically reviewable.

## Section A — Reviewer findings verbatim

**Codex review, pasted verbatim from prior response:**

```text
我看的是当前工作区版本：[setup-time.md](D:/Learn/CS/github/SelfKnowledgeBaseWeb/docs/product/prd/features/self-host-deploy/setup-time.md:1)。整体方向是对的，`What / Why / Whole picture / UX / MVP / Progressive / Reference` 这种“总分总”比之前按 5 个 H2 平铺更适合 PRD，也更适合之后抽到 ADR / release note / runbook。

但我建议先别直接收口，有 4 个点需要和撰稿人确认或修一轮。

**必须确认 / 修改**

1. **M2 不应承诺 OAuth provider add**

   [setup-time.md:185](D:/Learn/CS/github/SelfKnowledgeBaseWeb/docs/product/prd/features/self-host-deploy/setup-time.md:185) 和 [setup-time.md:208](D:/Learn/CS/github/SelfKnowledgeBaseWeb/docs/product/prd/features/self-host-deploy/setup-time.md:208) 把 “Add OAuth” 写进 M2 baseline / acceptance。
   但 [identity.md](D:/Learn/CS/github/SelfKnowledgeBaseWeb/docs/product/prd/features/authentication/identity.md:80) 里 OAuth provider options 是 M3+ / Phase 2+。这里会把 auth scope 偷偷拉大。

   建议：M2 只验证 **L4 config change semantics**，例子换成 `cookie domain / session TTL / signup policy / backup retention`，或者写 “OAuth provider option if auth PRD later promotes it”。不要把 OAuth 作为 M2 gate。

2. **First admin flow 有歧义**

   [setup-time.md:104](D:/Learn/CS/github/SelfKnowledgeBaseWeb/docs/product/prd/features/self-host-deploy/setup-time.md:104) 写 operator 填 admin credential；[setup-time.md:117](D:/Learn/CS/github/SelfKnowledgeBaseWeb/docs/product/prd/features/self-host-deploy/setup-time.md:117) 又写漏配时 `reject startup 或 force first-admin setup screen`；M2 demo [setup-time.md:194](D:/Learn/CS/github/SelfKnowledgeBaseWeb/docs/product/prd/features/self-host-deploy/setup-time.md:194) 看起来默认走 setup screen 创建 admin。

   需要定清楚：M2 canonical 是 “profile seed admin 后直接 login”，还是 “首次打开 web setup screen 创建 admin”。如果两者都支持，也要写清默认和安全条件。我的建议：public/production profile 缺 admin credential 默认 reject；localhost/dev profile 可以 force setup screen，最好带 one-time setup token。

3. **Migration failure “保留旧 schema”承诺过强**

   [setup-time.md:149](D:/Learn/CS/github/SelfKnowledgeBaseWeb/docs/product/prd/features/self-host-deploy/setup-time.md:149) 和 [setup-time.md:186](D:/Learn/CS/github/SelfKnowledgeBaseWeb/docs/product/prd/features/self-host-deploy/setup-time.md:186) 写 migration failure 保旧 schema。这个作为愿景可以，但作为跨 SQLite/Postgres/MySQL 的 PRD 承诺偏硬。DDL 是否事务化、Drizzle 能否完整 rollback，不能在 PRD 里一笔带过。

   建议改成：startup migration failure 必须 reject startup + 明确错误 + 不静默继续；对“旧 schema 未改变”的保证只限 transactional / preflight-failed cases。完整 recovery 依赖 backup/runbook。

4. **M2 L3 replacement skeleton 可能过早**

   [setup-time.md:187](D:/Learn/CS/github/SelfKnowledgeBaseWeb/docs/product/prd/features/self-host-deploy/setup-time.md:187) 和 [setup-time.md:208](D:/Learn/CS/github/SelfKnowledgeBaseWeb/docs/product/prd/features/self-host-deploy/setup-time.md:208) 要 M2 有 `skb export` / `skb import` skeleton。可问题是 [identity.md:110](D:/Learn/CS/github/SelfKnowledgeBaseWeb/docs/product/prd/features/authentication/identity.md:110) 明确 L3 replacement migration M2 不 ship。

   如果只是“未来 contract marker”，不要写成 M2 acceptance gate。建议 M2 改为 “export/import workflow documented as future contract；no user-facing migration guarantee”。真正 CLI skeleton 放 M3，verified import / full runbook 放 M4。

**方向上我认可的部分**

- setup-time vs runtime 的时间切分是正确的，operator-active/redeploy 与 SHCKB-autonomous 这个边界很清楚。
- L4 option add vs L3 replacement 的语义已基本接住 auth 那轮讨论。
- “Whole picture” timeline 可复用价值高，建议保留。
- Reference sections 放后面是对的，主体 narrative 现在更像 PRD，而不是 checklist dump。

**我的批复意见**

这版可以作为 setup-time PRD 的主结构通过，但需要一轮 scope cleanup。核心修法：M2 只保留 first install、initial config validation、safe config redeploy、upgrade preflight/forward migration；OAuth add、完整 L3 replacement、import verification 都不要变成 M2 用户可见承诺。First admin 默认路径和 migration failure 保证需要写得更精确。
```

## Section B — Owner response verbatim

**W_YI response, pasted verbatim:**

```text
这个形式如何？跟前面的形式不太类似，接下来我打算都采取这种形式让撰稿人撰写。如果没问题写一个新的discussions，把你提到的问题原封不动的放入，同样的也贴上我的答复。
```

## Section C — Current recommendation

Adopt the narrative-first form selectively:

- **Yes** for setup-time / runtime / self-host / migration / operator lifecycle PRDs.
- **Yes** for PRDs where a timeline, mental model, or cross-subsystem operating mode is the primary product truth.
- **Use with caution** for narrow feature PRDs. They still need direct user stories and acceptance gates visible enough for reviewer grep.

Immediate writer follow-up for `setup-time.md`:

1. Remove OAuth as an M2 acceptance example unless auth PRD explicitly promotes OAuth to M2.
2. Clarify canonical first-admin path by profile: production/public profile vs localhost/dev profile.
3. Weaken migration failure guarantee from "保留旧 schema" to "reject startup + no silent continue; old schema preservation only when transactional/preflight-safe".
4. Move `skb export/import` from M2 gate to future contract marker, or explicitly reclassify skeleton as non-user-facing and non-semantic.

## Section D — Owner follow-up after writer pass 3

**W_YI reply to writer, pasted verbatim:**

```text
看一下最新的discussion吧？整体上对于这种新的形式看起来都没有意见，并认为可以采用。唯一一个我认为可以修改的地方就是，用词向不要写成那种只有自
  己能看懂的PRD，这毕竟要给予所有的开发人员看，所以易读性和准确性非常重要。最新的discussion里写了还有一些细节问题。
```

Codex interpretation:

- The **narrative-first PRD form is accepted** as a usable form, especially for operator lifecycle / system-facing PRDs.
- This is not permission to write private shorthand. PRD language must be readable by all developers, not only by the current writer / reviewer pair.
- Technical terms such as L3 / L4 / adapter / provider option may appear, but the first use must include plain-language meaning and M-stage scope.
- If narrative form hides M2/M3/M4 boundaries, the form is failing even if the prose reads well.

Applied follow-up in `setup-time.md`:

- Removed remaining early-section phrasing that implied OAuth/provider add is M2 baseline.
- Replaced over-strong "redeploy is transactional / rollback / no partial state" wording with the narrower preflight/transactional guarantee.
- Kept L3/L4 terminology only after plain-language labels: "配置选项变更" and "底层组件替换".

## Section E — Codex takeover cleanup applied（2026-05-21）

**Trigger**: owner asked Codex to take over the next step after writer pass 3, with the instruction that the new PRD form is acceptable but wording must remain readable and accurate for all developers.

**Applied to `setup-time.md`**:

- Kept the narrative-first structure.
- Removed remaining early text that still implied "add OAuth / add provider" was part of M2 setup-time baseline.
- Changed T2 timeline wording from "config change / add provider" to "config change / add option", with explicit M2 examples limited to cookie domain / session TTL / signup policy / backup retention.
- Clarified that OAuth/OIDC/passkey only appear after the auth PRD promotes those provider options to a specific milestone.
- Replaced "redeploy is transactional / rollback / no partial state" with the narrower, implementable guarantee:
  - preflight / transactional failures can preserve old state;
  - partially executed migration failures must reject startup and require backup + runbook recovery;
  - PRD does not promise automatic rollback across all DB engines.
- Preserved L3/L4 terminology only as secondary labels after the plain-language names "配置选项变更" and "底层组件替换".

**Resulting PRD status**: `setup-time.md` pass 3 is acceptable as a structure-level cleanup, pending any owner/writer objections to the specific first-admin profile split or migration failure wording.

## Section F — Second-pass multi-angle review（2026-05-21）

**Trigger**: owner asked Codex to review the latest `setup-time.md` pass 3 from multiple angles:

1. 文档 / PRD 角度
2. 撰写者 / 阅读者 / 执行者角度
3. 社区 / 开源贡献者角度
4. 可发展 / 可拓展 / 可维护角度
5. Agent 限定角度（灵活性 vs 关键限制）

### Overall judgment

Current judgment: **`setup-time.md` pass 3 can pass as an operator-lifecycle PRD structure**, and it is materially better than the earlier checklist form for this topic. The narrative-first shape works because setup-time is primarily a lifecycle / mental-model problem: reader must understand active operator moments, redeploy boundaries, and failure semantics before implementation details.

But this form should **not** become the default for every PRD. It should be the default only for lifecycle / operator / system-facing PRDs. Narrow feature PRDs still need compact user-story / functional-requirement structure, with acceptance gates visible enough for reviewer grep.

### Highest-priority remaining issues

1. **First-admin canonical path is now precise in `setup-time.md`, but not yet synced across related PRDs.**

   `setup-time.md` now says production/public profile uses **profile-seeded admin → direct login**, while localhost/dev may use setup screen + one-time setup token. Parent `self-host-deploy.md` still says `<10 min = first-admin setup → author → notepage`, and `identity.md` still uses the broader "reject startup 或 force setup screen" wording.

   **Recommended action**: sync parent PRD + `identity.md` to the profile split:

   - internet-exposed / production profile: admin credential must be seeded in install profile; missing admin rejects startup.
   - dev-local profile: setup screen is allowed, gated by one-time setup token.

2. **M2 upgrade recovery depends on backup/runbook, but backup prompt is currently M3.**

   `setup-time.md` correctly weakens migration failure guarantees: partial migration failure rejects startup and recovery depends on backup + runbook. However, backup-before-upgrade prompt is currently listed under M3. That leaves an M2 failure path that tells operator to rely on backup while not requiring even a manual backup warning.

   **Recommended action**: M2 should at least mandate a manual backup warning / runbook pointer before upgrade. Auto-backup can remain M3+ / Phase 2+.

3. **PRD body should remove internal review provenance such as "per Codex finding".**

   Those references are useful in discussion/changelog but read as internal process leakage in a PRD intended for developers and external contributors.

   **Recommended action**: keep provenance in this discussion record and changelog; in PRD body, state the product decision directly.

4. **Support matrix should split "config vocabulary" from "M2 verified combinations".**

   M2 currently lists several adapter families in one sentence: DB SQLite/Postgres/MySQL, storage local/S3, search FTS5/tsvector/Meilisearch, backup local/S3. For execution, that can be read as all combinations are M2 acceptance scope.

   **Recommended action**: add a small table:

   | Category | M2 config vocabulary | M2 verified gate |
   |---|---|---|
   | DB | SQLite / Postgres / MySQL via Drizzle | SQLite + one Team VPS Postgres path |
   | Storage | local-fs / S3-compatible | local-fs + one S3-compatible smoke path |
   | Search | SQLite FTS5 / Postgres tsvector / external | profile-matched default |
   | Backup | local / S3 | manual/local baseline; stronger path later |

### Angle 1 — document / PRD form

The form is strong for this PRD because it separates:

- narrative mental model (`What / Why / Whole picture`);
- operator experience (`User-facing experience`);
- explicit milestone scope (`MVP / Progressive / Done`);
- lookup appendix (`Reference`).

The main risk is **narrative hiding scope**. Pass 3 mitigates this with explicit M2 gates, but the template should include a rule: narrative-first PRDs still need a mechanically reviewable milestone gate section.

### Angle 2 — writer / reader / executor

**Writer**: the form helps avoid checklist dumping, but it can encourage private shorthand. Writer must introduce technical terms through plain-language names first.

**Reader**: the timeline is effective and should stay. It lets a new developer understand setup-time vs runtime quickly.

**Executor**: executor still needs sharper gates around adapter combinations, backup warning, and first-admin path. Without that, an implementation agent may overbuild or test the wrong matrix.

### Angle 3 — community / open-source contributor

The document is moving toward open-source readability, but two wording issues remain:

- `production/public profile` may be confused with the `Public Cloud` operator tier. Recommended canonical term: **internet-exposed profile** vs **dev-local profile**.
- Internal process references like "per Codex finding" should not appear in the PRD body. Community readers need the decision, not the review origin.

### Angle 4 — evolution / extensibility / maintainability

The L4 vs L3 distinction is good and should stay:

- L4 = additive config / coexisting option; redeploy but no user-data migration.
- L3 = backing implementation replacement; export → redeploy → import; rare and not M2.

Maintainability risk is **cross-document drift**. First-admin behavior now appears in `setup-time.md`, `self-host-deploy.md`, and `identity.md`. The project should treat `setup-time.md` as the canonical table for profile-specific bootstrap behavior, and other docs should summarize or reference it rather than restating a broader rule.

### Angle 5 — agent constraints

This version gives agents better constraints than pass 2:

- no OAuth provider add as M2 gate;
- no `skb export/import` CLI skeleton in M2;
- no automatic rollback promise across DB engines;
- no runtime config hot reload;
- no silent fallback for missing admin / config.

Remaining agent risk: an implementation agent may still overbuild from future-contract language. Recommended PRD phrasing for M2:

- "Do not implement export/import CLI in M2."
- "Do not implement OAuth/OIDC/passkey provider add unless identity PRD promotes it."
- "Do not implement auto rollback for partially applied migrations."
- "Do implement startup rejection, clear error, and manual backup/runbook warning."

### Recommended follow-up order

1. Sync first-admin profile split into `self-host-deploy.md` and `identity.md`.
2. Add M2 manual backup warning / runbook pointer before upgrade.
3. Remove "per Codex finding" style provenance from PRD body.
4. Split adapter support into "config vocabulary" vs "M2 verified combinations".
5. If this form becomes a reusable template, record it in `prd-discipline.md` as **operator-lifecycle PRD form**, not universal PRD form.

### Execution note — Codex applied cleanup（2026-05-21）

Applied after owner approved the recommended direction:

- `setup-time.md`: switched first-admin terminology to **internet-exposed bootstrap mode** vs **dev-local bootstrap mode**; added M2 manual backup warning + runbook pointer; split adapter support into roadmap vocabulary / M2 selectable / M2 verified gate; removed internal review provenance from PRD body.
- `self-host-deploy.md`: synced `<10 min` onboarding and first-admin invariant to the bootstrap-mode split.
- `authentication.md` / `identity.md`: synced first-admin detection / onboarding wording and clarified that L3 replacement is M2 future-contract marker only, with no export/import CLI skeleton or user-facing migration guarantee.
- `prd-discipline.md`: recorded the narrative-first form as an **operator-lifecycle PRD form**, not a universal PRD template.

### Follow-up review after cleanup（2026-05-21）

Codex reviewed the cleanup diff across `setup-time.md`, `self-host-deploy.md`, `authentication.md`, `identity.md`, `prd-discipline.md`, and this discussion record.

**What is fixed**:

- First-admin behavior is now mostly synchronized across setup-time, self-host top PRD, and identity PRD.
- Internal review provenance such as "per Codex finding" has been removed from the PRD body and kept in changelog/discussion context.
- L3 replacement M2 scope is now aligned: future contract marker only; no export/import CLI skeleton; no user-facing migration guarantee.
- The operator-lifecycle PRD form is now recorded in `prd-discipline.md` with the right scope limitation.

**Remaining issues**:

1. **M2 backup scope conflict between setup-time and runtime PRDs**

   `setup-time.md` says M2 upgrade flow only requires **manual backup warning + runbook pointer**, while backup-now shortcut / tighter backup integration can move to M3+. But `runtime.md` still mandates an M2 **manual trigger endpoint / CLI `skb backup now`**.

   Recommended resolution: distinguish the two concerns explicitly:

   - `runtime.md` M2 may keep **manual backup endpoint / CLI exists** as a runtime capability.
   - `setup-time.md` M2 upgrade flow only mandates **warning + pointer to that manual backup path**, not an integrated one-click pre-upgrade backup UX.
   - M3 can then mean **upgrade flow integrates backup-now** (shortcut / dry-run / restore verification), not that manual backup first appears in M3.

2. **`bootstrap mode` is introduced but not yet defined as a first-class dimension**

   The new terms **internet-exposed bootstrap mode** and **dev-local bootstrap mode** are clearer than production/public vs localhost/dev, but readers still need to know whether bootstrap mode is an install profile field, derived from deploy mode, or a security dimension.

   Recommended resolution: add one sentence near the first bootstrap-mode table:

   > Bootstrap mode is an install-bootstrap security mode, orthogonal to operator profile; install profile selects it or derives it from exposure.

   This prevents future writers / agents from turning bootstrap mode into a fourth operator profile or confusing it with Public Cloud.

3. **Adapter matrix column language is improved but still slightly soft**

   The new matrix solves the earlier all-combinations ambiguity, but the column name "M2 selectable / accepted" and phrases like "optional smoke" / "if provider configured" can still be read inconsistently.

   Recommended resolution:

   - Rename the column to **M2 selectable behavior**.
   - Each row should use one of three explicit states:
     - `supported`
     - `unsupported with clear error`
     - `optional smoke, not release gate`

   This makes implementation-agent scope tighter and avoids accidental release gating on optional adapter paths.

### Execution note — follow-up fixes applied（2026-05-21）

Applied after owner approved direct cleanup:

- `setup-time.md`: added bootstrap mode definition as an install-bootstrap security mode orthogonal to operator profile.
- `setup-time.md`: renamed adapter matrix column to **M2 selectable behavior** and rewrote rows with explicit `supported` / `unsupported with clear error` / `optional smoke, not release gate` states.
- `runtime.md`: clarified that M2 manual backup endpoint / CLI remains a runtime capability, while setup-time M2 upgrade flow only warns and points to that path; one-click pre-upgrade backup integration remains M3+.
- `prd-discipline.md`: sharpened the operator-lifecycle PRD form rule for support matrices with the same explicit-state vocabulary.

## Section G — References

- PRD under review: [setup-time.md](../../../product/prd/features/self-host-deploy/setup-time.md)
- Parent PRD: [self-host-deploy.md](../../../product/prd/features/self-host-deploy/self-host-deploy.md)
- Sibling PRD: [runtime.md](../../../product/prd/features/self-host-deploy/runtime.md)
- Related auth PRDs: [authentication.md](../../../product/prd/features/authentication/authentication.md) / [identity.md](../../../product/prd/features/authentication/identity.md) / [pep.md](../../../product/prd/features/authentication/pep.md)
- Related discussion: [auth-setup-2026-05-17.md](./auth-setup-2026-05-17.md)
- Audit register: [AUDIT-2026-05.md](../../decisions/AUDIT-2026-05.md)

## Changelog

- 2026-05-21 initial record: captured setup-time PRD narrative-form assessment, Codex four findings verbatim, owner response verbatim, and current recommendation for writer follow-up.
- 2026-05-21 owner follow-up captured: narrative-first PRD form accepted for suitable docs, with explicit constraint that terminology must be readable and accurate for all developers. Recorded Codex interpretation and the follow-up cleanup applied to `setup-time.md`.
- 2026-05-21 Codex takeover cleanup captured: documented the pass 3 cleanup applied to `setup-time.md`, including OAuth/M2 scope correction, config-change wording, migration failure guarantee narrowing, and readability constraints around L3/L4 terminology.
- 2026-05-21 second-pass multi-angle review captured: documented pass 3 acceptance as an operator-lifecycle PRD form, remaining cross-document sync issues, M2 backup-warning gap, open-source readability concerns, support-matrix sharpening, and agent overbuild constraints.
- 2026-05-21 execution note captured: owner-approved cleanup applied to setup-time, parent self-host PRD, authentication/identity PRDs, and prd-discipline.
- 2026-05-21 follow-up review after cleanup captured: remaining issues narrowed to setup-time/runtime backup scope distinction, bootstrap-mode definition, and adapter matrix wording.
- 2026-05-21 follow-up fixes captured: bootstrap mode definition, adapter matrix explicit-state wording, setup-time/runtime backup boundary, and prd-discipline support-matrix rule were applied.
