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

## Section E — Better Auth capability investigation（2026-05-17）

**Trigger**: commit `2050a2d` 落地 authentication round 2 后，owner 要求确认：

1. 哪些修复仍需再确认 / 再调查；
2. Better Auth 能承接哪些层；
3. Better Auth 不能替代哪些 SHCKB-own 决策。

**Scope note**: 本节只是 source-backed discussion note，**不修改 ADR**。最终 auth library/provider selection ADR 等所有 PRD 完成后，在更大的 product / architecture view 下统一写。

### Official sources checked

Access date: 2026-05-17.

| Source | URL | 用来判断什么 |
|---|---|---|
| Better Auth installation | https://better-auth.com/docs/installation | server/client 初始化、base path、环境变量、通用 setup 形态 |
| Better Auth Hono integration | https://better-auth.com/docs/integrations/hono | Hono handler / middleware / `getSession` 集成方式 |
| Better Auth database concepts | https://better-auth.com/docs/concepts/database | schema、adapter、migration、Drizzle/Kysely 关系 |
| Better Auth cookies | https://better-auth.com/docs/concepts/cookies | cookie 配置、跨域/子域 cookie、secure cookie 相关能力 |
| Better Auth security reference | https://canary.better-auth.com/docs/reference/security | trusted origins、CSRF / origin / fetch metadata 等安全边界参考 |
| Email/password auth | https://better-auth.com/docs/authentication/email-password | email/password sign-up/sign-in、reset/change password 能力 |
| Username plugin | https://better-auth.com/docs/plugins/username | username 登录/注册能力；是否能替代“无 email user” |
| Admin plugin | https://better-auth.com/docs/plugins/admin | create/list users、roles、ban/impersonate/session 管理等 admin 能力 |
| API key plugin | https://better-auth.com/docs/plugins/api-key | Phase 2+ API/PAT 候选能力 |
| JWT plugin | https://better-auth.com/docs/plugins/jwt | token mint / JWKS 等 Phase 2+ 候选能力 |
| Bearer plugin | https://better-auth.com/docs/plugins/bearer | bearer token 作为非 browser session wire path 的候选能力 |

### What Better Auth can carry

| SHCKB need | Better Auth fit | Notes |
|---|---|---|
| Browser human auth session | **Good candidate** | 可承接 cookie session、sign-in/sign-out、session lookup、password reset/change password 等 auth-library 层能力 |
| Hono integration | **Good candidate** | 官方 Hono integration 提供 handler / middleware / `getSession` path；SHCKB 仍需把结果转成自己的 `ctx.user` immutable Value Object |
| Database-backed auth tables | **Possible, needs schema decision** | Better Auth 有自有 schema / adapter / CLI；但 ADR-0002 的 `users/sessions` 草图不能假设零摩擦复用 |
| Drizzle integration | **Possible, POC required** | Better Auth 支持 Drizzle schema generation；但 programmatic migration 语义和 Drizzle/SHCKB migration pipeline 要验证 |
| Cookie/session security baseline | **Good candidate for implementation** | cookie flags / trusted origins / CSRF-origin 类机制可由 library 承接；PRD 仍保留 security acceptance 抓手 |
| Signup disabled by default | **Can help implement** | 可以通过 config / hooks / disabled paths / route policy 实现；但“默认 off、operator-only toggle”是 SHCKB product policy |
| Admin create user / reset password | **Likely useful** | Admin plugin 可作为 M2/M3 user management 底层候选；但是否采用 plugin、是否暴露 UI、role mapping 仍归 SHCKB |
| OAuth / OIDC / passkey / 2FA | **Phase 2+ provider candidate** | Better Auth 内部把这些建模为 library plugins；SHCKB 应包装为 operator-enabled auth provider options，不暴露为 SHCKB runtime plugin |
| API key / JWT / bearer | **Phase 2+ candidate** | 可作为 PAT / API / agent auth 的底层候选，但不能混入 M2 browser cookie-session 承诺 |

### What Better Auth should not replace

| SHCKB-own surface | Why Better Auth cannot replace it |
|---|---|
| Auth = system-level PEP framing | Better Auth 是 auth library；它不定义 SHCKB 全 API 的 enforcement architecture |
| Declarative authz / `requireOwner(note)` | Better Auth 能给 identity/session；notepage visibility、owner_id、author/admin capability 是 SHCKB resource policy |
| `ctx.user` immutable Value Object | Better Auth 可返回 user/session；“middleware 设一次、request 内只读、plugin 不可 mutate、不含 token/secret”是 SHCKB sandbox/capability contract |
| Signup default OFF / operator-only toggle | Library 可以实现开关；默认值和谁能改是 SHCKB product/security policy |
| First admin bootstrap | Better Auth 不替代 install profile、secret generation、startup reject / setup screen、first admin seed flow |
| Browser vs agent/API wire path separation | Better Auth 的 API key/JWT/bearer 插件可作为底层候选；ADR-0015 / MCP / PAT 的 product wire path 仍由 SHCKB 设计 |
| Install / deploy / backup / restore semantics | auth tables、secrets、provider config、key rotation、backup restore 都要进 SHCKB operator story / runbook |
| ADR-0009 endpoint style | Better Auth 默认 endpoint 形态不自动等于 SHCKB `/api/auth/login|logout|register`；需要 wrapper 或改 ADR |

### Still needs confirmation / investigation

| Item | Why it matters | Suggested investigation |
|---|---|---|
| **Email optional vs Better Auth email requirement** | PRD 当前写 admin 可不带 email 创建 user；Better Auth email/password 与 username plugin 仍倾向 email-based user model | 先拍 product stance：M2 是否允许 truly no-email user？若允许，验证 Better Auth 是否支持；否则改 PRD 为 email optional only for SMTP, not user record |
| **Username plugin boundary** | Username plugin 可能支持 username login，但不等于“纯 username/password without email” | POC sign-up payload + DB row，确认 email 是否 required、unique constraint 如何处理 |
| **Hono + Bun + Drizzle + SQLite/Postgres path** | M2 canonical likely Bun/Hono/Drizzle；auth library selection 必须先证明主路径能跑 | Minimal POC：sign-in/out、session cookie、schema migration、ctx.user mapping |
| **Workers + D1 path** | ADR-0001 M4 includes Workers supported-with-constraints；Better Auth + Hono + Drizzle/D1 能否 work 不能凭想象 | 单独 Workers POC；如果成本高，auth library ADR 写成 M4 verify gate 而非 M2 blocker |
| **CSRF coverage scope** | Better Auth 可保护自己的 auth endpoints；SHCKB 其他 POST mutation 仍要保护 | 区分 library-provided auth endpoint protection vs SHCKB app-wide POST mutation CSRF/origin middleware |
| **Endpoint wrapper strategy** | Better Auth default endpoints may not match ADR-0009 path table | Auth ADR 时二选一：accept Better Auth native `/api/auth/*` namespace，或写 thin SHCKB wrapper maintaining ADR-0009 surface |
| **Schema ownership** | Better Auth schema may be `user/session/account/verification` style；ADR-0002 草图是 `users/sessions/refresh_tokens` | Decide whether auth tables are Better Auth-owned sub-schema, SHCKB-owned schema, or mapped wrapper; do not mix ad hoc |
| **Role mapping** | PRD wants `admin` / `author`; Better Auth admin plugin has its own roles/permissions model | POC mapping: Better Auth role field vs SHCKB `users.role`; avoid importing full RBAC matrix into M2 |
| **Admin create second user path** | PRD says M2 multi-user must work but does not mandate UX path | Implementation planning must choose CLI / minimum admin page / invite token / install seed; discussion lean still invite token/minimum path, but not PRD-mandated |
| **Provider switching semantics** | Current PRD says OAuth switch = export-reinstall-import; may be too broad | Distinguish adding a provider to existing user pool vs migrating provider/user identity source; only the latter needs export-reinstall-import |

### Recommendations / direction

1. Keep `2050a2d` main direction: AuthProvider is **operator-pluggable provider/adapter**, not SHCKB runtime plugin.
2. Keep Better Auth as **preferred baseline pending ADR verification**, not PRD-locked final choice.
3. Treat Better Auth as implementation substrate for browser human auth, not as the owner of SHCKB authorization policy.
4. Add one small PRD cleanup pass before moving on:
   - `authentication.md` Dependencies still says AuthProvider is plugin extension type.
   - `authentication.md` References intro still says ADR-0014 specialization rework.
   - Optional: AUDIT old initial-draft/changelog wording can remain historical, but current-state paragraphs should avoid suggesting ADR-0014 AuthProvider specialization.
5. For future auth library/provider ADR, evaluate at least these tracks:
   - Better Auth direct integration + SHCKB wrapper.
   - Auth.js core / lower-level auth library.
   - Small-libs thin layer only if Better Auth/Auth.js fail stack constraints; self-built crypto remains rejected.
6. Before implementation planning, run two small POCs:
   - Mainline POC: Bun + Hono + Drizzle + SQLite/Postgres + Better Auth + ctx.user mapping.
   - Constraint POC: Workers + D1 + Better Auth feasibility, allowed to become M4 gate if not needed for M2.

### Provisional source-backed conclusion

Better Auth can probably cover **session/authentication mechanics** for M2 browser human auth. It should not be allowed to own **authorization semantics**, **operator policy**, **plugin/sandbox contract**, **install bootstrap**, or **agent/API wire path**. The correct SHCKB shape is therefore:

`Better Auth or fallback library` → wrapped by `SHCKB AuthAdapter` → feeds `PEP middleware` → emits immutable `ctx.user` → SHCKB route/resource policies enforce capabilities.

## Section F — Verbatim conversation: AuthAdapter terminology clarification（2026-05-17）

**Trigger**: after commit `0b9a3bd`, owner and reviewer clarified that "replacing auth" should not mean replacing SHCKB's whole auth subsystem. It means replacing the external backing auth implementation through a SHCKB-owned thin wrapper.

### Verbatim chat excerpt

**User**

```text
你说的这个第一点有什么问题吗？能简单解释一下吗？
```

**Assistant**

```text
问题是它把 **“加一个 OAuth 登录方式”** 和 **“更换整个身份来源模型”** 混成了一件事。

比如现在系统已有 username/password 用户。后来 operator 想加 GitHub OAuth：

- 这通常只是 **新增一个 provider**。
- 现有用户池还在。
- 现有账号可以继续用密码登录。
- 用户以后可以把 GitHub account link 到原账号。
- 这不需要 export-reinstall-import。

但如果是另一种情况：operator 要从“本地 username/password 用户池”整体迁到“LDAP-only / 外部身份源唯一可信”，那才像是 **换身份模型**：

- 原 user identity source 变了。
- 账号映射/迁移规则要重定。
- 旧 password 可能失效。
- schema/secrets/callback/user linking 都要迁移。
- 这才可能需要 export-reinstall-import 或 migration runbook。

所以顶部那句 “切 OAuth = export-reinstall-import” 太一刀切。更准确是：

> Auth provider 变更分层处理：新增 provider 可共存；替换 identity source 需要 user-level migration/link flow；完全切 provider model 才走 export-reinstall-import。
```

**User**

```text
可能是搞错了，我原本的意思是，如果想替换整个auth层，就要导出数据+redeploy项目选新的auth+导入。我当时觉得这是一个稳定性+灵活性的选择。
```

**Assistant**

```text
那你的意思是成立的，而且我同意这个设计取向。

我刚才担心的是它被读成“加 OAuth provider 也要 export-reinstall-import”。如果你说的是 **替换整个 auth layer / auth library / auth provider model**，那 export → redeploy with new auth → import 是合理的，甚至是更稳的：

- 避免 runtime 热切 auth 这种高风险能力。
- 避免把 session/schema/secrets/callback/user-linking 做成在线迁移大怪物。
- operator 明确进入 maintenance/migration mode。
- auth 层和 DB/search/storage 一样，属于部署期选择，不是运行期插件。

建议把文案改成这个粒度：

> Adding an auth provider may be config-only and can coexist with existing login methods. Replacing the whole auth layer/provider model is an operator migration workflow: export data → redeploy with new auth config/library → import/migrate users.

这样既保留你的稳定性+灵活性选择，也不会误伤“新增 OAuth provider”这种更轻的场景。
```

**User**

```text
我们和刚刚讨论的其实是auth system with betterauth吧？不能说成整个auth，起码要有个外部thin wrapper去承载这个不同的auth系统？你怎么看？
```

**Assistant**

```text
对，我会把它表述成 **SHCKB AuthAdapter / thin wrapper**，而不是“替换整个 auth”。

更准确的分层是：

- **SHCKB auth subsystem**：稳定不换。包括 PEP middleware、`ctx.user`、declarative authz、`requireOwner`、operator policy、first admin bootstrap、browser vs agent path 分离。
- **AuthAdapter / provider implementation**：可替换。比如 Better Auth adapter、Auth.js adapter、future custom thin adapter。
- **Provider options inside adapter**：可配置。比如 username-password、GitHub OAuth、OIDC、passkey。

所以替换时不是“换掉 auth system”，而是：

> 替换 SHCKB AuthAdapter 的 implementation / backing auth library。

这样 `ctx.user`、API policy、ownership check、operator config shape 尽量稳定，换的是底层 authentication mechanics。

我建议术语统一成：

- `Auth subsystem` = SHCKB-owned stable layer
- `AuthAdapter` = SHCKB thin wrapper interface
- `AuthAdapter implementation` = Better Auth / Auth.js / custom thin layer
- `Auth provider option` = username-password / GitHub OAuth / OIDC / passkey
- `Auth migration workflow` = export users/session-relevant data → redeploy with new AuthAdapter implementation/config → import/link users

这样你的稳定性+灵活性选择会更清楚：**外部库可以换，但 SHCKB 的 auth contract 不漂。**
```

**User**

```text
那你觉得我们需要怎么改现在的auth prd？然后把我们的对话一字不差的同步至discussion record。
```

### Resulting PRD direction

Current PRD should use this terminology:

| Term | Meaning |
|---|---|
| **Auth subsystem** | SHCKB-owned stable layer: PEP middleware, `ctx.user`, declarative authz, `requireOwner`, operator policy, first admin bootstrap, browser vs agent path separation |
| **AuthAdapter** | SHCKB thin wrapper interface between SHCKB auth subsystem and backing auth library/provider implementation |
| **AuthAdapter implementation** | Better Auth adapter / Auth.js adapter / custom thin layer |
| **Auth provider option** | username-password / GitHub OAuth / OIDC / passkey inside an AuthAdapter implementation |
| **Auth migration workflow** | export users/session-relevant data → redeploy with new AuthAdapter implementation/config → import/migrate/link users |

**Decision shape**:

- Adding an OAuth/OIDC/passkey provider option does **not** imply export-reinstall-import.
- Replacing identity source requires user-level migration/link flow.
- Replacing AuthAdapter implementation / backing auth library or full provider model uses the operator migration workflow.
- SHCKB auth subsystem itself remains stable; only the backing implementation is replaceable.

## Section G — Cross-subsystem modular pattern symmetry（2026-05-17 round 4 Sharpen C）

**Trigger**: pass 4 把 auth 收紧到 4-layer abstraction 后，发现 SHCKB 几个 horizontal subsystem 用同一 modular pattern。这条 architectural symmetry 应该显式记录，让未来 horizontal subsystem 设计有 reference。**当前归 discussion record；未来 [architecture-overview.md] (Phase C 待写) 写时 lift 过去**。

### Pattern

所有 SHCKB horizontal subsystem 遵循 **SHCKB-owned stable layer + replaceable layer + operator config opt-in** 三段结构：

| Subsystem | L1 SHCKB stable layer | L3 replaceable layer | L4 operator opt-in |
|---|---|---|---|
| **Plugin system** | plugin-system framework (registry / lifecycle / sandbox / capability ctx) | block / theme **plugin extension type** (runtime register; built-in + future 3rd-party) | plugin enable/disable (M2 closed registry; Phase 2+ open) |
| **Theme system** | theme-system + 4-layer cascade rules + L0 hard invariants | L2 built-in themes (graph-paper / lego-studs / bento-canvas) + L3 plugin themes (Phase 2+) | theme selection (user pref + notepage metadata) |
| **Auth subsystem** | Auth subsystem (PEP / ctx.user / declarative authz / requireOwner / first admin / browser-agent path) + **AuthAdapter interface (L2)** | AuthAdapter implementation (Better Auth adapter / Auth.js adapter / custom thin) | provider options inside L3 (username-password / OAuth / OIDC / passkey) |
| **Storage** ([ADR-0007]) | StorageProvider interface | local-fs / S3-compat adapter | env config (path / bucket / etc.) |
| **Search** ([ADR-0008]) | SearchProvider interface | SQLite FTS5 / Postgres tsvector / Meilisearch adapter | env config |
| **Backup** ([ADR-0017]) | BackupProvider interface + GC policy | local / S3 adapter | env config |
| **DB** ([ADR-0006]) | Drizzle multi-dialect abstraction | SQLite / Postgres / MySQL backend | env config |

### Architectural principle (extracted)

```
SHCKB Horizontal Subsystem Pattern:
   ┌──────────────────────────────────────┐
   │ L1: SHCKB stable layer (contract)    │  ← never replaced
   │     defines invariants + interfaces  │
   ├──────────────────────────────────────┤
   │ L2: SHCKB-owned thin wrapper (opt.)  │  ← decouples L1 from L3 (auth-style)
   │     (only for subsystems where the   │     not all subsystems need L2 —
   │      backing library API is volatile  │     storage/search/backup go L1→L3 direct
   │      enough to need a wrapper)        │
   ├──────────────────────────────────────┤
   │ L3: Replaceable implementation       │  ← operator deploy-time choose
   │     (adapter or built-in catalog)    │
   ├──────────────────────────────────────┤
   │ L4: Operator config opt-in           │  ← env / install profile
   │     (which options enabled, if any)  │
   └──────────────────────────────────────┘

Change ladder (uniform across subsystems):
  + Add option @ L4              → operator config; co-exist
  Replace L3 implementation      → operator migration workflow
                                   (export → redeploy → import)
  Replace L1 / L2                → NEVER (subsystem contract stable)
```

### Reviewer follow-up: pattern variants, not one uniform migration ladder（post-6a95eaa）

**Catch**: `6a95eaa` 的 Section G 抽象方向有价值，但 "所有 SHCKB horizontal subsystem 遵循 operator config opt-in" + "Change ladder uniform across subsystems" 泛化过头。它对 **auth / storage / search / backup / DB** 这类 deploy-time adapter/provider 成立；对 **plugin / theme** 这类 runtime extension / catalog / user-selection path 不成立。

需要保留的 insight：

- SHCKB horizontal subsystem 都应有 **L1 stable layer**：framework-owned invariants / interface / enforcement boundary 不漂。
- 有些 subsystem 需要 **L2 SHCKB-owned thin wrapper** 隔离 volatile L3 implementation。当前最明显例子是 auth。
- L3 / L4 的 change semantics 必须按 subsystem variant 拆，不应一刀切。

建议未来 lift 到 `architecture-overview.md` 时拆成两个 variants：

| Variant | Applies to | L3 meaning | L4 meaning | Change ladder |
|---|---|---|---|---|
| **Runtime extension / catalog variant** | plugin-system / theme-system | plugin extension type / built-in or third-party catalog item / theme module | runtime enable/disable / user preference / notepage metadata selection | register / version / migration / disable / fallback；**不**套 export-redeploy-import |
| **Operator-pluggable adapter variant** | auth / storage / search / backup / DB | deploy-time adapter / provider / backing implementation | env / install profile / operator config | add option/config may coexist；replace L3 may require operator migration workflow (export → redeploy → import) |

Auth-specific current truth remains:

- Add L4 provider option（如 username-password 之外加 GitHub OAuth）→ operator config + redeploy；co-exist；不迁移 user pool。
- Replace identity source → user-level migration / link flow。
- Replace L3 AuthAdapter implementation / backing auth library 或完整 provider model → export users/session-relevant data → redeploy with new AuthAdapter implementation/config → import/migrate/link users。
- Replace L1 / L2（SHCKB auth subsystem / AuthAdapter interface）→ NEVER。

**Follow-up suggested for PRD cleanup**: [plugin-system.md] `Plugin vs operator-pluggable` 表的 "切换机制" 行应避免写成所有 operator-pluggable 都是 `导出 → 重新安装 → 导入`，尤其不能让读者误解为新增 OAuth provider option 也要 export/import。更精确：L3 infrastructure/AuthAdapter replacement 可能进入 migration workflow；L4 provider option add/enable 是 config + redeploy + coexist。

### When L2 is needed

不是所有 horizontal subsystem 都需要 L2 thin wrapper：

- **L2 needed**: when L3 implementation API is volatile / 跨 implementation 差异大 / 想 isolate L1 from L3 churn。**例**: auth (different libraries 暴露 surface 差异大，wrapper 隔离)
- **L2 not needed**: when L3 implementations 已经 implement 同一 stable interface naturally。**例**: storage / search / backup（adapter pattern already standardizes via SHCKB-defined interface）；DB（Drizzle 已经是 multi-dialect abstraction）

Auth 是当前唯一显式需要 L2 wrapper 的 horizontal subsystem。

### Implications for future subsystem design

新增 horizontal subsystem 时 follow 此 pattern：
1. 明确 L1 invariants + interface（SHCKB stable）
2. 判断是否需要 L2 wrapper（library volatility / API churn risk）
3. 定义 L3 replaceable adapter / implementation 候选
4. 定义 L4 operator opt-in mechanism（env / install profile）
5. 明确 change ladder（add option vs replace implementation vs never）

这条 pattern 喂回 [prd-discipline.md] backfill todo："horizontal subsystem modular pattern" 准则。

## Section H — References

- `authentication.md` initial draft: commit 6748872
- `authentication.md` round 2 fix: commit 2050a2d
- `authentication.md` AuthAdapter terminology sharpen: post-0b9a3bd discussion
- AUDIT-2026-05.md `From authentication/ PRD` + reviewer follow-up: line 318-349
- 相关已 ratified ADR: [ADR-0011] / [ADR-0014] / [ADR-0009] / [ADR-0002] / [ADR-0006] / [ADR-0018] / [ADR-0015]
- 相关 PRD: [authentication.md](../../../product/prd/features/authentication/authentication.md) / [plugin-system.md](../../../product/prd/features/plugin-system/plugin-system.md) / [project.md](../../../product/prd/project.md)
- 跟 plugin-system PRD 已 lock 的 "plugin vs operator-pluggable" 二分（per 2026-05-16 plugin-system reframe commit 8cc43d2）

## Changelog

- 2026-05-17 initial record；整理 reviewer 10 findings + Claude 5 challenges + A1 触发的连锁 sync 工作；待 owner 拍板后 round 2 fix 落地
- 2026-05-17 self-correction（owner catch B2 layer 错误）：B1 / B2 / B5 withdrawn from PRD scope；B1 rerouted to future auth library selection ADR；B2 rerouted to testing + UX implementation；B5 rerouted to future operator runbook。Section B 重新分类 + Section D pending decisions 收窄。加 Methodology lesson "判定 PRD challenge 的 user-observable 准则"；喂回 [prd-discipline.md] backfill todo
- 2026-05-17 Better Auth capability investigation 写入：source-backed 记录官方 docs 调查；列清 Better Auth 可承接的 session/auth mechanics、不应替代的 SHCKB-own policy/PEP/authz/sandbox/install/agent path；登记还需确认的 email optional、Workers/D1、Drizzle migration、endpoint wrapper、schema ownership、role mapping、provider switching 等问题；明确 ADR 暂不改，等 PRD 全完成后写 auth library/provider selection ADR。
- 2026-05-17 AuthAdapter terminology clarification 写入：逐字同步 owner/reviewer 对话；将 "替换整个 auth" 收紧为 "替换 SHCKB AuthAdapter implementation / backing auth library 或完整 provider model"；明确 SHCKB auth subsystem 稳定不换，provider options 位于 AuthAdapter 内部。
- 2026-05-17 Section G "Cross-subsystem modular pattern symmetry" 写入（per Claude round 4 Sharpen C）：抽取 SHCKB horizontal subsystem 通用 L1-L4 pattern (stable layer / optional L2 wrapper / replaceable implementation / operator opt-in)；列对比表覆盖 plugin / theme / auth / storage / search / backup / DB；明确 L2 何时需要（library API volatility）；喂回 [prd-discipline.md] backfill todo "horizontal subsystem modular pattern" 准则；未来 architecture-overview.md 写时 lift 过去。Section G/H 编号下移 References 段。
- 2026-05-17 post-6a95eaa reviewer follow-up 写入：Section G 的 L1-L4 insight 保留，但记录 "uniform migration ladder" 泛化过头；未来 architecture-overview.md 应拆 Runtime extension / catalog variant（plugin/theme；register/version/disable/fallback，不套 export-redeploy-import）与 Operator-pluggable adapter variant（auth/storage/search/backup/DB；L3 replacement 可能 export → redeploy → import）。同时标记 plugin-system.md `Plugin vs operator-pluggable` 表需要避免把新增 auth provider option 误写成 export/import migration。
