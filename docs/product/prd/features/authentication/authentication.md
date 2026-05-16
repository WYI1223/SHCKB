# Feature PRD: Authentication

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-16 |
| Owner | W_YI |
| Parent PRD | [project.md] |

## Overview

**Authentication subsystem** 是 SHCKB 的 **system-level Policy Enforcement Point (PEP)**——不是 horizontal feature 而是**架构层 enforcement layer**。每个 API request 必须过 auth middleware chain；每个 resource 操作的 identity verification + authorization 在 middleware 集中 enforce，handler 不写 `if (user.role == ...)` 检查。

跟 [theme-system.md] / [plugin-system.md] 的区别在于：
- Theme = cross-cutting **extensibility framework**（cascade override，多 theme 平级；可缺席）
- Plugin = cross-cutting **extension framework**（多 extension type 平级；可缺席）
- **Auth = cross-cutting enforcement**（必须集中入口；不可缺席；失败模式 = 数据泄漏 / 越权）

**Build vs Buy = Buy**：Day-1 用成熟 TS auth library（**Better-Auth baseline**，待 M2 ship 前 verify maturity / Hono 集成 / Drizzle adapter；fallback Auth.js core）作 implementation 底层；SHCKB **不**自己实现 token rotation / reuse detection / signing key / password hash 等 framework 决策。PRD 只 mandate **SHCKB-own** scope：PEP middleware contract / AuthProvider plugin contract / declarative authz route metadata / ctx.user 桥接 / admin setup flow / cross-feature seams。

本 PRD 锁的是 **authentication subsystem 整体的 framing + cross-cutting invariants + cross-feature seams**。具体 library 内部决策（TTL / rotation / signing / hash）**不**写在本 PRD，归 library + future auth library selection ADR。

## Scope

### 本 PRD 子系统负责（SHCKB-own）

- **PEP middleware contract**：所有 API route 过统一 auth middleware chain；ctx.user 是 verified identity；handler 不重复 check
- **AuthProvider plugin contract**：identity 验证机制是 plugin extension type；Day-1 ship UsernamePassword built-in；future OAuth / WebAuthn / OIDC 各自 AuthProvider plugin
- **Declarative authz**：route 定义时声明 required role / permission（route metadata）；middleware 自动 enforce；集成 [ADR-0009] / [ADR-0012] OpenAPI gen
- **ctx.user 桥接**：跟 plugin sandbox capability ctx（per [ADR-0011]）统一；plugin / handler 不直接读 session / cookie
- **3-role identity model**：admin / author / anonymous-reader（Day-1 simple；扩展 Phase 2+）
- **Anonymous reader first-class**：`ctx.user = null` 是合法 state；public notepage 不发 session cookie；不 track
- **TokenStrategy 配置接口**：暴露 library token strategy 作为 operator config（library 默认 hybrid mode；operator 可调）
- **Self-host pattern**：first admin via install bootstrap（per [ADR-0018]）；admin UI in webapp；email optional
- **Cross-feature seams**：notepage edit/private 权限 / theme user pref 持久化 / plugin 权限管理 / discussion 参与（Phase 2+）/ agent auth path（Phase 2+）

### 本 PRD 子系统不负责（边界另一边谁负责）

| 不负责 | 归 | 类型 |
|---|---|---|
| Token rotation / reuse detection / TTL 默认值 / signing key 管理 | auth library (Better-Auth or 类似) + future auth library selection ADR | library 内部决策 |
| Password hash 算法选择（Argon2id / bcrypt） | library 默认 + future ADR | library 内部决策 |
| Cookie SameSite / Secure / HttpOnly / CSRF 实现 | library 内部 | implementation detail |
| Operator-pluggable adapter for storage / search / backup | [self-host-deploy/] / [ADR-0007] / [ADR-0008] / [ADR-0017] | operator-pluggable layer |
| Plugin sandbox 通用机制 / capability 数据流 | [plugin-system.md] / [ADR-0011] / [ADR-0014] | extension framework |
| Notepage edit / view UX | [notepage-editing.md] / [notepage-view.md] | feature PRD |
| Theme user pref UX | [theme-system-user-view.md] | feature PRD |
| Discussion 参与 auth 路径 | [discussion/]（Phase 2+，sidecar plugin pattern）| feature PRD（Phase 2+） |
| Agent auth wire path | [ai-integration/]（Phase 2+）+ [ADR-0005] / [ADR-0015] | feature PRD（Phase 2+） |
| User import / export across SHCKB instances | per [project.md] non-goal "operator pool 独立" | out-of-scope |
| Enterprise SSO（SAML / LDAP / Kerberos） | per [project.md] non-goal | out-of-scope |

## Cross-cutting invariants

| Invariant | 含义 |
|---|---|
| **Centralized PEP** | 所有 API request 必须过 auth middleware chain；handler 不重复 verify；middleware 决定 anonymous / authenticated / forbidden |
| **ctx.user 是 verified identity** | Handler / plugin 收到的 `ctx.user` 已 verify；plugin 不能直接读 session / cookie / token；`ctx.user = null` 是合法 state（anonymous）|
| **AuthProvider as plugin extension type** | Identity verification 走 plugin-system 通用 extension framework；Day-1 UsernamePassword built-in；future OAuth/* / WebAuthn 各 plugin |
| **Declarative authz** | Route 元数据声明 required role / permission；middleware 集中 enforce；business handler 不写 `if (role == x)` |
| **Anonymous first-class** | Public notepage 无 cookie / 无 session；不 track；symmetric: `ctx.user = null` not error |
| **Operator vs user 二分** | Operator config = OS-level（install bootstrap / env / config file per [ADR-0018]）；user role = webapp-level（admin / author）；二者不互通；webapp admin 不可改 operator config |
| **Self-host friendly defaults** | Email optional；OAuth optional；first admin via install bootstrap；password reset 在没 SMTP 时 fallback admin manual reset |
| **Single operator instance = single user pool** | 不跨 SHCKB instance federated identity（per [project.md] non-goal） |

## User stories

### Note author / admin（产品 user）

- As a **first-time operator**, I want to **deploy 后立即用 admin credential 登录**（credential 来自 install bootstrap profile），so that **不需额外 setup step**
- As a **note author**, I want to **signup → login → 创建 private notepage → logout**，so that **完整内容创作流的最短路径**
- As a **note author**, I want to **session 跨 browser refresh / 短暂离开后保持**（library refresh token 机制），so that **不被频繁 logout 打断**
- As an **admin**, I want to **看到本 instance 的 user 列表 / disable user / 重置 password**，so that **管理 user 不需 SSH 改 DB**
- As an **admin without SMTP**, I want to **手动给 user 设新 password**，so that **user 忘 password 时不依赖 email service**

### Reader（产品 user）

- As an **anonymous reader**, I want to **直接访问 public notepage URL 看到内容**（不被 redirect 登录），so that **author 公开内容触达零障碍**
- As an **anonymous reader hitting private notepage**, I want to **被 redirect 到 login（带 return URL）**，so that **登录后回到原 URL**

### Extension / plugin author（developer-user，cross-feature seam）

- As a **plugin author**, I want to **从 `ctx.user` 拿到当前 user 信息**（id / role / displayName），so that **plugin 可基于 user 决策 + 不需自己 verify session**
- As an **AuthProvider plugin author**（future OAuth / WebAuthn），I want to **从一个 well-defined contract 起步**（跟 BlockPlugin / ThemePlugin 同形态），so that **不需重新理解 plugin-system**

## Functional requirements

### Must (Day-1, M2) — minimum shippable auth

- **PEP middleware chain**：所有 API route 过 Hono middleware；middleware 验证 token + populate `ctx.user`
- **UsernamePassword AuthProvider** (built-in)：signup / signin / signout / change password
- **Session 行为**：library 默认 hybrid mode（access token + refresh token；具体 token 形态归 library）；user 跨 tab / refresh 保持登录
- **First admin via install bootstrap** (per [ADR-0018])：install profile 含 admin credential（username + bootstrap password）；deploy 后 admin 立即可 login
- **3-role identity**：
  - `admin` — full instance access；user 管理；config 查看（不改 operator config）
  - `author` — 自己 notepage CRUD；个人 pref；不能管 user
  - `anonymous-reader` — `ctx.user = null`；只能访问 public notepage
- **Anonymous public read**：`/notes/:slug` 公开 notepage 不发 session cookie；不创建 anonymous session record
- **Private notepage gating**：
  - API request: 401 if `ctx.user = null`
  - Web navigation: 302 to `/login?return=<encoded-url>`
- **Login UI**：login page / signup page；form submit；error message 清晰
- **Email optional**：signup 不强制 email；admin 可不带 email 创建 user；password reset 在有 email + SMTP 时走 email flow，否则 admin manual reset

### Should (Day-1 if scope allows, otherwise M3)

- **Admin UI for user mgmt**：list users / disable / role change / manual password reset / view session list per user
- **Session list / device list**：user 自己能看 "logged in on N devices" + 单独 logout
- **Logout from all devices**：user 主动 revoke all sessions
- **Password reset via email** (if SMTP configured)：reset link with TTL
- **Rate limit on login attempts**：防 brute force；library 默认 + operator config

### Nice-to-have (M3+ / Phase 2+)

- **OAuth providers as AuthProvider plugin**：GitHub / Google / OIDC 各自 plugin
- **WebAuthn / Passkey** as AuthProvider plugin
- **2FA (TOTP)** as AuthProvider plugin
- **PAT (Personal Access Token)** for API / external client
- **Email verification flow**（separate from password reset）
- **Per-notepage collaborator role**（跟 discussion / shared editing 一起 Phase 2+）

## Non-functional requirements

- **Performance**:
  - Auth middleware overhead < 5ms p95 per request (cached token verify)
  - Login p95 < 200ms (含 password hash verify; library 默认 Argon2id)
- **Security**:
  - Token / password 全走 library 默认（不重写 crypto）
  - HTTPS only in production (operator config)
  - CSRF protection via library 默认机制
- **Accessibility**:
  - Login / signup forms WCAG AA contrast + 全键盘可操作 + screen reader friendly
- **Self-host friendly**:
  - 无 external service required for Day-1 baseline (无 SMTP / 无 OAuth provider / 无 KMS)
  - Email / SMTP / OAuth 都是 optional opt-in

## Non-goals

- ❌ **Library 内部 token / hash / signing 决策** —— 归 library + future auth library selection ADR
- ❌ **Operator-pluggable infra adapter**（storage / search / backup） —— 归 [self-host-deploy/]
- ❌ **Enterprise SSO**（SAML / LDAP / Kerberos / Active Directory）—— per [project.md] non-goal
- ❌ **Federated identity across SHCKB instances** —— per [project.md] "operator pool 独立"
- ❌ **Per-block ACL** —— Phase 2+ 跟 discussion / shared editing 一起
- ❌ **RBAC matrix** —— Day-1 simple 3-role；matrix Phase 2+ 才考虑
- ❌ **Self-built auth from scratch** —— Build vs Buy = Buy；用 Better-Auth 或类似成熟 library

## Acceptance criteria

### M2 — minimum shippable

- **E2E**：signup → login → 创建 private notepage → logout → anonymous 访问 private 触发 redirect → re-login → 访问 OK
- **Anonymous public read**：无 cookie 访问 public notepage 成功 + 不创建 session
- **First admin**：install bootstrap profile 含 admin credential → 部署后立即 login OK + admin 角色生效
- **3-role 验证**：admin / author / anonymous-reader 各 capability 边界
- **Cross-feature seams M2**：
  - notepage edit 权限 enforce（author 自己 notepage 可编辑；他人 private notepage 403）
  - theme user pref server-side persist（user-view PRD M2 align）
- **PEP middleware**：所有 API route 经 middleware；至少 1 个 protected route + 1 个 public route 验证
- **Library 集成**：Better-Auth（或 fallback）集成 + ctx.user 桥接 + AuthProvider plugin wrapper 起作用

### M3 — admin polish + a11y

- Admin UI for user mgmt work
- Password reset work (with SMTP optional)
- Session list / logout-everywhere work
- Login / signup forms WCAG AA 100%
- Auth middleware perf < 5ms p95

### M4 — production polish

- 5 deploy mode 全 verify (含 Workers runtime constraint)
- TokenStrategy operator config 切换 verified（如换 strategy 在 install profile）
- Rate limit baseline shipped

### Phase 2+

- OAuth providers as AuthProvider plugins
- WebAuthn / Passkey
- PAT for API access
- 2FA

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Install bootstrap admin credential 漏配 | Fallback: first-signup-becomes-admin（operator 可在 profile 关掉此 fallback；详 open question 2） |
| Email 没配 SMTP + user 忘 password | UI 提示 "联系 admin"；admin 走 manual reset；session 不锁 user |
| Concurrent signup with 同 username | Library 默认 race-safe；返回 conflict error |
| Session expire mid-edit | Library refresh token 静默续；refresh 也 expired → 触发 login redirect 保留 return URL |
| Admin disable 自己 account | UI 防呆 + validation reject "cannot disable self"；必须另一 admin 操作；single-admin instance 不允许 disable last admin |
| Single user instance (Solo NAS)，user = admin = author | OK；admin 也能创建 / 编辑自己 notepage |
| Anonymous user 想 follow author / discussion 等 future feature | Phase 2+ 走轻量 auth 路径（归 [discussion/]） |
| API request without session | 401 JSON response (not redirect) |
| Web navigation without session for private | 302 to `/login?return=...` |
| Operator 想换 TokenStrategy（如 hybrid → pure-SSS） | Profile config + restart；现有 session 全 invalidate；user 需 re-login |
| User 多 tab 同时 login + 同时 access token 过期 | Library 默认 race-safe（grace window；不会全 tab 自动 logout） |
| Admin reset user password 后 | User 现有 session 全 invalidate；user 用新 password re-login |
| `ctx.user` 字段被 plugin 试图改 | Plugin 不可写 `ctx.user`（per [ADR-0011] capability ctx 只读契约） |

## Dependencies

PRD 层 upstream 依赖（ADR / library 是 downstream，归 References）：

- **Parent PRD**: [project.md](../../project.md)
- **Cross-folder PRDs**（authentication 跟其他 feature 协同）:
  - [notepage.md](../notepage/notepage.md) — edit 权限 / private read 权限消费者
  - [theme-system-user-view.md](../theme-system/theme-system-user-view.md) — user pref server-side persist 消费者
  - [plugin-system.md](../plugin-system/plugin-system.md) — AuthProvider 作为 plugin extension type；cross-cutting invariants 协同
  - [self-host-deploy/](../self-host-deploy/README.md) — operator-pluggable adapter 边界 + install bootstrap 集成（正式 PRD TODO）
- **External services**: 无 Day-1 必须依赖（SMTP optional；OAuth provider Phase 2+）

## Open questions

1. **Better-Auth 1.0 timing vs M2 ship timing**：library 还在 pre-1.0；M2 实装前 verify maturity / API stability；fallback Auth.js core (lower-level) 何时切？归 future auth library selection ADR
2. **First-signup-becomes-admin fallback 默认开 / 关**：install profile 漏配 admin credential 时；倾向**默认关**（要 operator 显式 enable），防误开放公网 SHCKB instance 第一访问者成 admin
3. **Anonymous read 是否要 rate limit**：防爬虫 / 防 DDoS；可能 operator config + reverse proxy 层负责（不归本 PRD），还是要 application-level rate limit?
4. **Admin self-disable 防呆细节**：UI 灰显 vs validation layer reject；single-admin instance 的特殊判断
5. **SMTP-less 部署 password reset UX**：admin manual reset 怎么 surface 给 user（"联系 admin" + admin 联系方式从哪来）

## Surfaced ADR debts

本 PRD 触发的 ADR 层 framing 问题（reframe round 2 candidates，等本批 PRD 全完成后做 ADR round）：

- **Auth library selection ADR (new)**：Better-Auth baseline；候选对比（Auth.js core / 自己写 + jose/bcryptjs）；Hono integration + Drizzle adapter verify；M2 ship 前 verify checklist
- **[ADR-0014] AuthProvider specialization**：plugin contract 加 AuthProvider per-type specialization（跟 BlockPlugin / ThemePlugin 同模式）；含 provider config / capability declaration
- **[ADR-0011] sandbox cover auth ctx pattern**：ctx.user 怎么 expose 给 plugin；plugin 想自己 verify identity 时（罕见）怎么 isolate
- **[ADR-0009] auth endpoints 表 verify**：login / signup / logout / session / reset password 等 endpoint 是否在 ADR-0009 REST style 覆盖；agent wire path（per [ADR-0015]）auth 路径 cross-ref
- **[ADR-0002] users / sessions / refresh_tokens schema verify**：Better-Auth 默认 schema 跟 SHCKB sub schema 兼容性；slug Day-1 immutable invariant 跟 user identity ID 关系
- **[ADR-0018] install profile auth bootstrap**：5 profile 都要 cover admin credential setup + JWT signing key generation + secrets file 写入
- **[ADR-0006] backend stack ↔ auth library 兼容**：Bun + Hono + Drizzle 跟 Better-Auth 实际集成 verify

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，**必须 align 本 PRD**。本 PRD 触发新 auth library selection ADR + ADR-0014 specialization rework（详 Surfaced ADR debts + [AUDIT-2026-05.md] 流程）。

- **Aligning ADRs**:
  - [ADR-0009](../../../../engineering/decisions/ADR-0009-api-style.md) — API style + auth endpoint 路径
  - [ADR-0011](../../../../engineering/decisions/ADR-0011-sandboxing-evolution.md) — sandbox capability + ctx.user 协议
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — plugin contract（待加 AuthProvider specialization）
  - [ADR-0018](../../../../engineering/decisions/ADR-0018-install-bootstrap.md) — install profile + first admin credential bootstrap
  - [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) — users / sessions schema 兼容
  - [ADR-0006](../../../../engineering/decisions/ADR-0006-backend-stack.md) — Bun + Hono + Drizzle stack 跟 auth library 集成
  - [ADR-0015](../../../../engineering/decisions/ADR-0015-agent-wire-protocol.md) — agent auth path cross-ref（Phase 2+）
  - Future auth library selection ADR — 候选承接 library 决策 + verify checklist
- **Parent PRD**: [project.md](../../project.md)
- **Cross-folder PRDs**: [notepage.md](../notepage/notepage.md) / [theme-system.md](../theme-system/theme-system.md) / [plugin-system.md](../plugin-system/plugin-system.md) / [self-host-deploy/](../self-host-deploy/README.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc cross-reference convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft (Phase E Day-1 PRD #3)；reframe auth 为 **system-level PEP**（vs horizontal feature）；8 cross-cutting invariants 含 centralized PEP / ctx.user verified identity / AuthProvider as plugin extension type / declarative authz / anonymous first-class / operator-vs-user 二分 / self-host defaults / single instance independence；**Build vs Buy = Buy**（Better-Auth baseline；M2 ship 前 verify maturity；fallback Auth.js core）；3-layer abstraction implied（AuthProvider plugin / TokenStrategy operator-config 接口 / TokenCarrier library 内部）；Day-1 M2 = UsernamePassword + first admin via install bootstrap + 3-role + anonymous public read + PEP middleware；OAuth / WebAuthn / 2FA / PAT 全 Phase 2+ as AuthProvider plugin；email optional；surface ADR debts (auth library selection ADR / ADR-0014 AuthProvider specialization / ADR-0011 ctx.user pattern / ADR-0009 auth endpoint / ADR-0002 schema / ADR-0018 admin bootstrap / ADR-0006 library 集成)
