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

## Section F — References

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
