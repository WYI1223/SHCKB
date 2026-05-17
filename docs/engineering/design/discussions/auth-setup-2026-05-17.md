# Discussion Record: Authentication subsystem framing & setup

| Field | Value |
|---|---|
| Date | 2026-05-17 |
| Subject | Phase E Day-1 PRD #3 authentication framing review |
| Participants | Owner (W_YI) / external reviewer / Claude |
| Trigger | `authentication.md` initial draft (commit 6748872, 2026-05-16) |
| Status | Reviewer findings + Claude challenges 待整合落地 round 2 fix |
| Output target | `authentication.md` round 2 修订 + 连锁 PRD sync (plugin-system / new-block / AUDIT) |

## Context

`authentication.md` initial draft 提交后（commit 6748872），reviewer 跟 owner 进行了 framing 层 review，并把 10 条 findings 写入 [AUDIT-2026-05.md](../../decisions/AUDIT-2026-05.md) 的 `From authentication/ PRD (2026-05-16 Day-1 PRD #3)` + `Follow-up reviewer audit — authentication PRD initial draft (2026-05-16)` 两段。

**Owner 拍板的关键 reframe**（在 reviewer findings 表格上方明示）：

> Initial draft 把 AuthProvider 写成跟 BlockPlugin / ThemePlugin 平级 plugin extension type；owner clarified：这里想表达的是类似 DB / storage / search 的 **operator-selected provider / adapter option**，不是 runtime plugin。Library 内部决策（token rotation / hash / signing key 等）**不**进 PRD，归 future auth library/provider selection ADR。

也就是 reviewer Finding 1 已经 ratified 为方向决策；其他 9 条作为 discussion findings 仍待逐条 owner 拍板。

Claude 在 review reviewer findings 后**全 10 条接受**，且自己额外提出 5 条 challenge（reviewer 没 catch 的点），见下文。

本 record 整理所有 finding + challenge，作为 round 2 fix 的 input。本 record 是 living discussion record，不是 ADR 也不是 PRD——只记录讨论过程 + 拍板 / 待拍板状态。

## Section A — Reviewer findings (10 条；逐条引用)

来源：[AUDIT-2026-05.md](../../decisions/AUDIT-2026-05.md) line 318-349。引用准确无删改。

### A1. AuthProvider as plugin extension type 用词错误

| Field | Value |
|---|---|
| Finding | auth provider 影响 user pool / session schema / secrets / callback URL / security boundary，应与 DB / storage / search 的不同可选 provider 对齐，而不是跟 BlockPlugin / ThemePlugin 拉平 |
| ADR / PRD impact | authentication.md / plugin-system.md / future auth library/provider selection ADR / [ADR-0018] |
| Source PRD | authentication.md / plugin-system.md |
| Suggested action | 改成 **operator-selected auth provider / adapter**：M2 local username-password provider；future OAuth / WebAuthn / OIDC 是 operator-enabled provider options；不走 runtime plugin install/uninstall，不归 [ADR-0014] plugin contract |
| Owner status | **已 ratify** as 方向决策（见 AUDIT line 320 owner clarification） |
| Claude 评价 | 接受。回到 plugin-system PRD 已 lock 的 "plugin vs operator-pluggable" 二分判定，AuthProvider 完全 fit operator-pluggable（切换涉及 schema / secrets / callback URL / 重 deploy；切 OAuth = export-reinstall-import 模式），不是 runtime plugin |

### A2. TokenStrategy operator config 过早暴露

| Field | Value |
|---|---|
| Finding | M2 让 operator 切 token strategy 会扩大安全配置面；auth 默认应强而少配置 |
| ADR / PRD impact | future auth library selection ADR / [ADR-0018] |
| Source PRD | authentication.md |
| Suggested action | M2 使用 library recommended/default strategy；只暴露 safe config（domain / secret / cookie secure / session TTL 等）；strategy replacement 留给 future ADR，不放 M2 Must |
| Owner status | Pending ratify |
| Claude 评价 | 接受。跟 owner 之前 framing "DB 一样抽象 + operator 部署时自选"不冲突——方向保留，但 M2 不强求暴露 strategy switch；只暴露安全配置。Strategy replacement 留 future ADR |

### A3. M2 scope 需收薄

| Field | Value |
|---|---|
| Finding | admin UI user mgmt / session device list / logout-all / email reset 容易被实现计划读成 M2 blocker |
| ADR / PRD impact | authentication.md / project roadmap |
| Source PRD | authentication.md / project.md |
| Suggested action | M2 锁 minimum path：first admin、login/logout、session、public/private notepage gating、author edit ownership、ctx.user；admin polish / email reset / device list 明确 M3 |
| Owner status | Pending ratify |
| Claude 评价 | 接受。这些项已经在 Should 不在 Must，但 reviewer 担心 implementation team 误读 Should → 实施。建议明确写成 "Should = M3 default; only ship in M2 if 无成本顺便" |

### A4. Signup policy 暗示过开放

| Field | Value |
|---|---|
| Finding | user story 写 `signup → login`，但 self-host 公网实例默认开放注册会引入 spam / 越权风险 |
| ADR / PRD impact | authentication.md / [ADR-0018] |
| Source PRD | authentication.md |
| Suggested action | M2 默认 public signup **off**；first admin 来自 install bootstrap；author 账号由 admin 创建或 operator 显式开启 invite/signup |
| Owner status | Pending ratify |
| Claude 评价 | 接受。Pocketbase / 主流 self-host 都 default OFF。3-tier operator profile 都 fit：Solo NAS admin 手动加 user；Team VPS 内部 invite；Public Cloud operator 显式开 |

### A5. first-signup-becomes-admin fallback 默认必须关

| Field | Value |
|---|---|
| Finding | 否则漏配 admin credential 的公网实例可能让第一访问者成为 admin |
| ADR / PRD impact | [ADR-0018] / authentication.md |
| Source PRD | authentication.md |
| Suggested action | 将 open question 倾向升级为 invariant：fallback 默认 off，必须 operator 显式 enable；install profile 应检测并提示 admin bootstrap 缺失 |
| Owner status | Pending ratify |
| Claude 评价 | 接受。Open question 2 升级为 invariant。漏配 + 公网部署 + 首访问者成 admin = critical security incident。Install profile 检测缺失 + 拒绝启动 OR 强制走 first-admin setup screen 更安全 |

### A6. `anonymous-reader` 更像 state，不像 role

| Field | Value |
|---|---|
| Finding | 把 anonymous 写成第三 role 会混淆 authenticated role model 与 unauthenticated principal state |
| ADR / PRD impact | [ADR-0002] / [ADR-0009] / authentication.md |
| Source PRD | authentication.md |
| Suggested action | role 模型改为 authenticated roles：`admin` / `author`；anonymous = `ctx.user = null` 的合法 principal state，不入 users.role |
| Owner status | Pending ratify |
| Claude 评价 | 接受。DB schema 里 anonymous 不该有 user row。Framing 精确化：authenticated roles {admin, author}；anonymous principal state = ctx.user === null。跟 invariant 5 "Anonymous first-class" 一致但 role 表述错 |

### A7. Declarative authz 不能只写 role/permission

| Field | Value |
|---|---|
| Finding | notepage edit 核心是 resource ownership（如 `note.owner_id == ctx.user.id`），只靠 role 会逼 handler 手写判断 |
| ADR / PRD impact | [ADR-0009] / [ADR-0011] / authentication.md |
| Source PRD | authentication.md |
| Suggested action | route metadata 支持 resource policy / ownership guard（如 `requireOwner(note)`）；handler 不散落 ownership if-check |
| Owner status | Pending ratify |
| Claude 评价 | 接受。维度扩展：declarative authz = role + permission + resource policy 三层。跟 Spring `@PreAuthorize` SpEL 一致（`@notePolicy.canEdit(#noteId, principal)`）。Route metadata 加 `requireOwner(resource)` / `requirePolicy(...)` |

### A8. 安全 invariant 不应完全交给 library 内部

| Field | Value |
|---|---|
| Finding | cookie / CSRF 的实现归 library，但 PRD 仍需给验收抓手 |
| ADR / PRD impact | authentication.md / future auth library selection ADR |
| Source PRD | authentication.md |
| Suggested action | PRD mandate production cookie `HttpOnly` / `Secure` / `SameSite` + POST mutation CSRF protected；具体实现仍由 library / ADR 选型承接 |
| Owner status | Pending ratify |
| Claude 评价 | 接受。这条不跟 Build/Buy=Buy 冲突——PRD 给 user/security-observable acceptance criteria 是合理的；具体怎么实现 cookie flags 是 library 的事 |

### A9. Better-Auth baseline 不宜 PRD 锁死

| Field | Value |
|---|---|
| Finding | 方向可以是 preferred baseline，但 final selection 应由 ADR 验证 Bun + Hono + Drizzle + Workers 约束 |
| ADR / PRD impact | future auth library selection ADR / [ADR-0006] |
| Source PRD | authentication.md |
| Suggested action | 文案改为 "preferred baseline pending ADR verification"；ADR 比较 Better-Auth / Auth.js core / small libs，自研 crypto 仍 rejected |
| Owner status | Pending ratify |
| Claude 评价 | 接受。措辞修订。Workers runtime constraint 是 reviewer 加的好 catch——Better-Auth 在 Workers 是否 work 需 verify |

### A10. Agent/API auth 应与 browser session 分离

| Field | Value |
|---|---|
| Finding | PAT / MCP / bearer token 不应混进 M2 cookie-session auth 承诺 |
| ADR / PRD impact | [ADR-0015] / authentication.md / ai-integration PRD |
| Source PRD | authentication.md |
| Suggested action | Browser human auth = cookie session；agent/API auth = bearer/PAT/MCP path，Phase 2+ 单独设计并 cross-ref [ADR-0015] |
| Owner status | Pending ratify |
| Claude 评价 | 接受。架构层 wire path 分离比 token strategy 分离更深：browser session ≠ agent API token；M2 cookie-session 不承诺 cover agent path。新 invariant 候选 |

## Section B — Claude challenges (5 条)

Claude 在 review reviewer findings 后自己提出的 challenge。**Owner 2026-05-17 review 后 catch B2 的 layer 错误**：B2 不属 PRD 层，是 testing / UX 实施任务（multi-user 在 [project.md] 已 mandate；具体加 user 路径是 implementation choice）。Claude self-extend 后判定 **B1 / B5 同样 layer 错误**——B1 属 future auth library selection ADR 内部讨论；B5 属 operator runbook task。

**重新分类**：

| Challenge | 真实 layer | PRD challenge? | Status |
|---|---|---|---|
| B1 Better-Auth wrapper layer | Future auth library selection ADR 内部 | ❌ | **withdrawn from PRD scope** → rerouted to ADR |
| B2 M2 admin 加 user UX gap | Testing + UX 实施任务 | ❌ | **withdrawn from PRD scope** → rerouted to test/impl |
| B3 Signup policy operator-only vs admin-toggleable | Product 决策（user-observable） | ✅ | retained as PRD challenge |
| B4 ctx.user immutable Value Object | 半 PRD 半 ADR | ✅ | retained as PRD challenge（+ [ADR-0011] cross-ref） |
| B5 Multi-instance JWT key rotation | Operator runbook 任务 | ❌ | **withdrawn from PRD scope** → rerouted to ops runbook |

只保留 B3 + B4 作为真 PRD challenge；B1 / B2 / B5 内容保留作历史 record 但标 withdrawn + rerouted。

### Methodology lesson（2026-05-17 self-correction）

判定准则：**当提出 PRD challenge 时，自问 "去掉这条 challenge 后，user 能不能感知到产品差异？" 不能 → 不是 PRD challenge**。

- B2: user 感知到 "M2 不能加第二个 user" = 不能（[project.md] 已 mandate multi-user）；具体路径 user 不感知 → not PRD
- B1: user 完全不感知 library wrapper layer → not PRD
- B5: user 在 ops 触发；不在产品行为路径 → ops task
- B3: user 感知 "操作 signup 入口在哪 / 谁能改" → PRD（user-observable）
- B4: plugin author 感知 "ctx.user 能不能 mutate" → PRD（developer-user observable）

这条 lesson 喂回 [prd-discipline.md] backfill todo：**"判定 PRD challenge 的 user-observable 准则"**。

跟 plugin-system / theme-system PRD 反复 reviewer round 4 轮的 root cause 同源——**framing 时分不清 layer**。

### B1. Better-Auth 内部 plugin architecture vs SHCKB operator-pluggable framing 的 tension

**Status**: withdrawn from PRD scope (2026-05-17). Rerouted to **future auth library selection ADR** 内部讨论。

**Issue**: Better-Auth 内部把 OAuth / 2FA / passkey 都 model 为 **Better-Auth plugin**（runtime 配置）。如果 SHCKB 把 AuthProvider 当 operator-pluggable adapter（per A1），需要 **wrapper layer** 把 Better-Auth 内部 plugin 暴露为 SHCKB operator config option（不暴露 runtime plugin install/uninstall）。

**Impact**: Auth library selection ADR + verify checklist 要加：
- Better-Auth provider 配置可被 SHCKB 包成 deploy-time operator option
- 如果 wrapper 太复杂 → fallback Auth.js core 或自己写 thin layer

**Action**: 新 AUDIT debt 候选——auth library wrapper layer design。

### B2. M2 admin 加第二个 user 的 UX gap

**Status**: withdrawn from PRD scope (2026-05-17). Owner catch: multi-user 在 [project.md] 已是 PRD 必须；具体 "加 user 的 UX 路径"（CLI / minimum admin page / invite token / install profile 配置多 user 等）是 **testing + UX implementation 任务**，不是 PRD challenge。Testing 必须 cover M2 multi-user 场景。

**Issue**: 接受 A3（admin UI → M3）+ A4（signup default OFF）后，**M2 operator 想加第二个 user 怎么办？** 比如 Solo NAS 部署后第二个家庭成员，或 Team VPS 内部新员工。

**候选方案对比**:

| 候选 | 评价 |
|---|---|
| A. CLI tool (`skb user create`) | 跟 webapp 主流偏离 |
| B. Hardcoded in install profile | 不 scalable |
| **C. Open invite token**（admin 在 install bootstrap / webapp 内 mint；user 凭 token signup；token 单次用 + TTL） | Pocketbase 风格；UX 流畅；security 可控；跟 A4 "operator 显式开启 invite" 完全一致 |
| D. M2 ship minimum admin "create user" page（不是完整 admin UI） | 跟 A3 部分冲突；但实际只一个 page |
| E. M2 不解决；多 user 等 M3 | 牺牲 Solo Team 场景 |

**Claude lean**: C（invite token）——解决 Solo Team M2 加 user；不引入完整 admin UI；security tight。

**新 invariant 候选**: M2 user 加入路径 = invite token（admin 凭 admin 权限 mint）；不是 open signup；不是 admin UI 完整 user mgmt。

### B3. Signup policy toggle 是 operator config 还是 admin UI?

**Issue**: A4 说 "operator 显式开启 invite/signup"，但没明确**谁可以 toggle**：

| 候选 | 含义 | Trade-off |
|---|---|---|
| **A. Operator-only toggle**（install profile / env） | Admin 不可改；想 enable signup 要 redeploy / config 改 | Security tighter；防 admin 被攻陷后 open signup |
| B. Admin-toggleable | Admin 在 webapp 改 setting | UX flex；但 admin 跨越 operator/user 二分；Pocketbase 走这条 |

**Claude lean**: A operator-only——跟 invariant 6 "operator vs user 二分" 一致；security > UX flex；admin compromise 不会变成 public signup。

**Sharpening**（解决 B2 + B3 矛盾）：
- invite token mint = **admin webapp action**（admin 可 mint，不跨越二分）
- invite token mint policy（"admin can mint up to N tokens with M TTL"）= **operator config**（admin 不可改 policy）
- 两层不同 —— admin 用现有 policy mint，但不能改 policy

### B4. ctx.user 是 immutable Value Object

**Issue**: Reviewer A6 把 ctx.user pattern 推 [ADR-0011]，但没明确：
- ctx.user 在 request 内是否 immutable？
- middleware 设一次后任何 handler / plugin 读到的 ctx.user 都一致？
- 是否 frozen 对象？

**Claude proposal**: `ctx.user` 是 **immutable Value Object**：
- middleware 在 request entry 设一次
- request 内只读
- plugin 不可 mutate（per [ADR-0011] capability ctx 只读契约）
- 字段 = minimal identity fields (id / role / displayName / etc.)
- **不含** token / session secret / refresh token（plugin 不应见这些）

**新 invariant 候选**。

### B5. Multi-instance secret rotation (JWT signing key)

**Status**: withdrawn from PRD scope (2026-05-17). Rerouted to **future operator runbook**（per [ADR-0018] / future deploy ops runbook）。Key rotation 是 ops 操作不在产品行为路径；M2 不 ship + acceptance 不含。

**Issue**: self-host operator 想轮换 signing key 怎么办？
- 现有 session 全 invalidate（粗暴）？
- Dual-key grace period（library 支持？）？
- Operator runbook step-by-step（手动）？

**Note**: A2 把 token rotation 推 library；但 **key rotation ≠ token rotation**，是 operator-level 决策。

**Claude lean**: M2 不 ship key rotation；当作 future operator runbook + auth library selection ADR cover。本 PRD 加 surfaced debt 即可，不进 M2 acceptance。

## Section C — Reframe 的连锁 sync 工作（A1 触发）

A1 "AuthProvider = operator-pluggable 不是 plugin" 是 framing 修订；之前几个 commit 留下的反向 sync 要清理：

| 文件 | 修订内容 |
|---|---|
| `plugin-system.md` future extension type 列表 | **删** AuthProvider 一行；改放到 plugin-system "operator-pluggable 例子" 表加 auth provider |
| `plugin-system.md` cross-folder ref to authentication | **改**：authentication 是 system-level PEP + AuthProvider as operator-pluggable adapter（跟 storage/search/backup 一个 pattern） |
| `new-block.md` cross-ref "plugin author 视角 AuthProvider extension type 对比" | **改**：去掉 AuthProvider 类比；只留 ctx.user 桥接 |
| AUDIT 之前的 "[ADR-0014] AuthProvider specialization" debt | **删**（已在 reviewer 修订时迁出，见 AUDIT line 325） |
| `authentication.md` "AuthProvider as plugin extension type" 多处措辞 | **改**：operator-selected auth provider / adapter；invariant 3 重写 |

## Section D — Pending owner decisions（2026-05-17 修订）

经 owner catch + Claude self-extend 后，B1 / B2 / B5 withdrawn from PRD scope（详 Section B 重新分类）。需要 owner 拍板的清单收窄为：

| # | Decision | 默认 lean | 影响 |
|---|---|---|---|
| 1 | 接受 reviewer A2-A10（A1 已 ratify）？ | accept all | round 2 fix scope |
| 2 | **B3** signup policy = operator-only toggle（admin 不可改） | yes | invariant 6 sharpening |
| 3 | **B4** ctx.user immutable Value Object 升 invariant | yes | new invariant + [ADR-0011] debt |
| 4 | 现在执行 round 2 fix（single commit）还是分批？ | single commit | execution rhythm |

**Withdrawn 项的 rerouting**（非 PRD owner decision；归对应 layer）：
- B1 → future auth library selection ADR（reviewer 或 ADR author 决策）
- B2 → testing + UX implementation 任务（implementation phase 决策 + QA mandate cover multi-user）
- B5 → future operator runbook（M2+ ops 任务；不进 acceptance）

## Section E — References

- `authentication.md` initial draft: commit 6748872
- AUDIT-2026-05.md `From authentication/ PRD` + reviewer follow-up: line 318-349
- 相关已 ratified ADR: [ADR-0011] / [ADR-0014] / [ADR-0009] / [ADR-0002] / [ADR-0006] / [ADR-0018] / [ADR-0015]
- 相关 PRD: [authentication.md](../../../product/prd/features/authentication/authentication.md) / [plugin-system.md](../../../product/prd/features/plugin-system/plugin-system.md) / [project.md](../../../product/prd/project.md)
- 跟 plugin-system PRD 已 lock 的 "plugin vs operator-pluggable" 二分（per 2026-05-16 plugin-system reframe commit 8cc43d2）

## Changelog

- 2026-05-17 initial record；整理 reviewer 10 findings + Claude 5 challenges + A1 触发的连锁 sync 工作；待 owner 拍板后 round 2 fix 落地
- 2026-05-17 self-correction（owner catch B2 layer 错误）：B1 / B2 / B5 withdrawn from PRD scope；B1 rerouted to future auth library selection ADR；B2 rerouted to testing + UX implementation；B5 rerouted to future operator runbook。Section B 重新分类 + Section D pending decisions 收窄。加 Methodology lesson "判定 PRD challenge 的 user-observable 准则"；喂回 [prd-discipline.md] backfill todo
