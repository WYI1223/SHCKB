# Feature PRD: Authentication

| Field | Value |
|---|---|
| Status | draft (pass 2 — reviewer findings + Claude challenges 落地) |
| Last updated | 2026-05-17 |
| Owner | W_YI |
| Parent PRD | [project.md] |

## Overview

**Authentication subsystem** 是 SHCKB 的 **system-level Policy Enforcement Point (PEP)**——不是 horizontal feature 而是**架构层 enforcement layer**。每个 API request 必须过 auth middleware chain；每个 resource 操作的 identity verification + authorization 在 middleware 集中 enforce，handler 不写 `if (user.role == ...)` 检查。

跟 [theme-system.md] / [plugin-system.md] 的区别在于：
- Theme = cross-cutting **extensibility framework**（cascade override，多 theme 平级；可缺席）
- Plugin = cross-cutting **extension framework**（多 extension type 平级；可缺席）
- **Auth = cross-cutting enforcement**（必须集中入口；不可缺席；失败模式 = 数据泄漏 / 越权）

**Build vs Buy = Buy**：Day-1 用成熟 TS auth library（**Better-Auth = preferred baseline，pending auth library selection ADR verification**：Bun + Hono + Drizzle + Workers 约束下 verify maturity / API stability / 集成可行性；候选对比 Auth.js core / 自己写 + 小 libs；自研 crypto 仍 rejected）作 implementation 底层。SHCKB **不**自己实现 token rotation / reuse detection / signing key / password hash 等 framework 决策。PRD 只 mandate **SHCKB-own** scope：PEP middleware contract / operator-selected AuthProvider adapter contract / declarative authz route metadata（含 resource ownership）/ ctx.user immutable Value Object 桥接 / admin setup flow / production cookie + CSRF baseline / cross-feature seams。

**关键 framing reframe (2026-05-17)**: AuthProvider **不**是 runtime plugin extension type（跟 BlockPlugin / ThemePlugin 平级是 framing 错误）；AuthProvider 是 **operator-selected adapter / provider option**，跟 [ADR-0007] storage / [ADR-0008] search / [ADR-0017] backup 一个 pattern——切换涉及 schema / secrets / callback URL / 重 deploy；切 OAuth = export-reinstall-import 模式。详 [auth-setup-2026-05-17.md discussion record](../../../../engineering/design/discussions/auth-setup-2026-05-17.md) Section A1。

本 PRD 锁的是 **authentication subsystem 整体的 framing + cross-cutting invariants + cross-feature seams**。具体 library 内部决策（TTL / rotation / signing / hash）**不**写在本 PRD，归 library + future auth library selection ADR。

## Scope

### 本 PRD 子系统负责（SHCKB-own）

- **PEP middleware contract**：所有 API route 过统一 auth middleware chain；ctx.user 是 verified identity；handler 不重复 check
- **Operator-selected AuthProvider adapter contract**：identity 验证机制是 **operator-pluggable adapter** 选项（不是 runtime plugin extension type；跟 storage/search/backup adapter 一个 pattern）；Day-1 ship UsernamePassword built-in adapter；future OAuth / WebAuthn / OIDC 是 operator-enabled provider options（不走 runtime install/uninstall）
- **Declarative authz**：route metadata 声明 required role / permission / **resource ownership policy**（如 `requireOwner(note)`）；middleware 自动 enforce；handler 不散落 role / permission / ownership if-check；集成 [ADR-0009] / [ADR-0012] OpenAPI gen
- **ctx.user 桥接（immutable Value Object）**：跟 plugin sandbox capability ctx（per [ADR-0011]）统一；middleware 在 request entry 设一次；request 内只读；plugin / handler 不可 mutate；不含 token / session secret / refresh token
- **Authenticated role model + anonymous principal state**：`admin` / `author` 是 authenticated roles（入 `users.role`）；anonymous = `ctx.user === null` 合法 principal state（不入 users 表）
- **Anonymous reader first-class**：public notepage 不发 session cookie；不 track；symmetric path：authenticated user / anonymous principal 都能访问 public notepage
- **Auth library safe config exposure**：只暴露 safe config 给 operator（domain / cookie secure / session TTL / signing secret 路径）；library token strategy replacement / rotation 等内部决策**不**M2 暴露
- **Self-host pattern**：first admin via install bootstrap（per [ADR-0018]）；install profile 检测 admin credential 缺失 → reject startup 或 force first-admin setup screen；admin UI in webapp；email optional
- **Browser vs agent/API wire path 分离**：M2 cookie-session auth 承诺仅 cover browser human auth；agent / API token (PAT / MCP / bearer) 是独立 wire path，Phase 2+ 单独设计（cross-ref [ADR-0015]）
- **Production security baseline mandate**：cookie `HttpOnly` / `Secure` / `SameSite` + POST mutation CSRF protected；具体实现由 library 承接但 PRD 给 acceptance 抓手
- **Cross-feature seams**：notepage edit/private 权限 / theme user pref 持久化 / plugin ctx.user 桥接 / discussion 参与（Phase 2+）/ agent auth path（Phase 2+）

### 本 PRD 子系统不负责（边界另一边谁负责）

| 不负责 | 归 | 类型 |
|---|---|---|
| Token rotation / reuse detection / TTL 默认值 / signing key 管理 | auth library + future auth library selection ADR | library 内部决策 |
| Password hash 算法选择（Argon2id / bcrypt） | library 默认 + future ADR | library 内部决策 |
| Cookie / CSRF 实现机制 | library 内部（PRD mandate user-observable security baseline；具体实现库做） | implementation detail |
| Library token strategy replacement / runtime 切换 | future auth library selection ADR；M2 不暴露 | library 内部决策 |
| JWT signing key rotation 流程 | future operator runbook（per [ADR-0018] follow-up）| operator ops |
| Auth library wrapper layer 设计（Better-Auth plugin → SHCKB operator config 适配）| future auth library selection ADR | implementation 架构 |
| Operator-pluggable adapter for storage / search / backup | [self-host-deploy/] / [ADR-0007] / [ADR-0008] / [ADR-0017] | operator-pluggable layer |
| Plugin sandbox 通用机制 / capability 数据流 | [plugin-system.md] / [ADR-0011] / [ADR-0014] | extension framework |
| Notepage edit / view UX | [notepage-editing.md] / [notepage-view.md] | feature PRD |
| Theme user pref UX | [theme-system-user-view.md] | feature PRD |
| Discussion 参与 auth 路径 | [discussion/]（Phase 2+，sidecar plugin pattern）| feature PRD（Phase 2+） |
| Agent / API auth wire path（PAT / MCP / bearer token）| [ai-integration/]（Phase 2+）+ [ADR-0005] / [ADR-0015]；**独立 wire path，不混进 M2 cookie-session 承诺** | feature PRD（Phase 2+） |
| User import / export across SHCKB instances | per [project.md] non-goal "operator pool 独立" | out-of-scope |
| Enterprise SSO（SAML / LDAP / Kerberos） | per [project.md] non-goal | out-of-scope |
| 加 user 的 UX 路径（CLI / minimum admin page / invite token / etc.）| testing + UX implementation phase 决定；PRD 只 mandate multi-user 必须 | implementation choice |

## Cross-cutting invariants

| Invariant | 含义 |
|---|---|
| **Centralized PEP** | 所有 API request 必须过 auth middleware chain；handler 不重复 verify；middleware 决定 anonymous / authenticated / forbidden |
| **ctx.user 是 immutable Value Object** | Middleware 在 request entry 设一次；request 内只读；plugin / handler 不可 mutate（per [ADR-0011] capability ctx 只读契约）；含 minimal identity fields (id / role / displayName / etc.)；**不**含 token / session secret / refresh token；`ctx.user === null` 是合法 anonymous principal state |
| **AuthProvider as operator-pluggable adapter** | Identity verification 走**operator-selected adapter**（不是 runtime plugin extension type；跟 [ADR-0007] storage / [ADR-0008] search / [ADR-0017] backup 一个 pattern）；Day-1 UsernamePassword built-in adapter；future OAuth/* / WebAuthn / OIDC 是 operator-enabled provider options；切换涉及 schema / secrets / callback URL / 重 deploy = export-reinstall-import 模式 |
| **Declarative authz**（含 resource ownership） | Route metadata 声明 required role / permission / **resource policy**（如 `requireOwner(note)`）；middleware 集中 enforce；business handler 不写 `if (role == x)` 或 `if (note.owner_id == ctx.user.id)` 之类的散落 check |
| **Authenticated role model + anonymous principal state** | `users.role` 只含 authenticated roles（`admin` / `author`）；anonymous = `ctx.user === null` 不入 users 表；不是 "third role" |
| **Anonymous first-class** | Public notepage 无 cookie / 无 session；不 track；symmetric path: authenticated / anonymous 都能访问 public notepage |
| **Operator vs user 二分（含 signup policy operator-only）** | Operator config = OS-level（install bootstrap / env / config file per [ADR-0018]）；user role = webapp-level；二者不互通；webapp admin 不可改 operator config；**signup policy toggle = operator config**（admin 不可 toggle；防 admin compromise 变 public signup）|
| **Signup default OFF** | Self-host 公网实例默认无 public signup；invite-only 或 admin-create-user 路径；operator 显式开启 invite/signup 才 ON |
| **First-signup-becomes-admin fallback default OFF** | 漏配 admin credential + 公网实例 = 第一访问者成 admin 是 critical security incident；fallback 默认 off；operator 必须显式 enable；install profile 检测 admin credential 缺失 → reject startup 或 force first-admin setup screen |
| **Browser vs agent/API wire path 分离** | M2 cookie-session auth 承诺仅 cover browser human auth；agent / API (PAT / MCP / bearer token) 是独立 wire path，Phase 2+ 单独设计；不混入 M2 cookie-session 承诺 |
| **Production security baseline** | Cookie production: `HttpOnly` + `Secure` + `SameSite`；POST mutation: CSRF protected；HTTPS only in production（operator config）；具体实现由 library 承接，PRD 给 acceptance 抓手 |
| **Self-host friendly defaults** | Email optional；OAuth optional；first admin via install bootstrap；password reset 在没 SMTP 时 fallback admin manual reset；无 external service required for baseline |
| **Single operator instance = single user pool** | 不跨 SHCKB instance federated identity（per [project.md] non-goal） |

## User stories

### Note author / admin（产品 user）

- As a **first-time operator**, I want to **deploy 后立即用 admin credential 登录**（credential 来自 install bootstrap profile；漏配则 startup reject 或 force first-admin setup），so that **不需额外 setup step + 不会出现公网首访者成 admin 的安全事故**
- As a **note author created by admin**, I want to **用 admin 提供的初始 credential 登录 → 创建 private notepage → logout**，so that **完整内容创作流的最短路径（不依赖 public signup）**
- As a **note author**, I want to **session 跨 browser refresh / 短暂离开后保持**（library refresh token 机制），so that **不被频繁 logout 打断**
- As an **admin**, I want to **创建 user / 重置 password**（M2 minimum admin capability；具体 UX 路径 testing/implementation 决定），so that **管理 user 不需 SSH 改 DB**
- As an **admin without SMTP**, I want to **手动给 user 设新 password**，so that **user 忘 password 时不依赖 email service**

### Reader（产品 user）

- As an **anonymous reader**, I want to **直接访问 public notepage URL 看到内容**（不被 redirect 登录），so that **author 公开内容触达零障碍**
- As an **anonymous reader hitting private notepage**, I want to **被 redirect 到 login（带 return URL）**，so that **登录后回到原 URL**

### Operator（self-host operator）

- As an **operator opening public signup**（如 community 站），I want to **在 install profile / env 显式开启 signup policy**，so that **default OFF 安全；显式 opt-in 才 ON**
- As an **operator switching auth provider**（如 username/password → OAuth），I want to **走 export-reinstall-import 模式**（不是 runtime 热切），so that **schema / secrets / callback URL 迁移有明确 workflow**

### Extension / plugin author（developer-user，cross-feature seam）

- As a **plugin author**, I want to **从 `ctx.user` 拿到当前 user 信息**（immutable Value Object：id / role / displayName / etc.），so that **plugin 可基于 user 决策 + 不需自己 verify session + 不可改 ctx.user**
- As a **plugin author**, I want to **route metadata 声明 required role / permission / resource ownership**（如 plugin 自己注册的 endpoint），so that **跟 framework declarative authz 一致；不重复造轮**

## Functional requirements

### Must (Day-1, M2) — minimum shippable auth

收窄后 M2 scope（per reviewer A3 + Claude self-correction）：admin UI / session device list / logout-all / email reset 全归 **M3 default**；M2 只 ship minimum path。

- **PEP middleware chain**：所有 API route 过 Hono middleware；middleware 验证 token + populate `ctx.user`（immutable Value Object）
- **UsernamePassword AuthProvider built-in adapter**（operator-selected provider 形态；非 runtime plugin）：login / logout / change password；signup endpoint **存在但 default OFF**（policy = operator config）
- **First admin via install bootstrap** (per [ADR-0018])：install profile 含 admin credential（username + bootstrap password）；deploy 后 admin 立即可 login；**install profile 检测 admin credential 缺失 → reject startup 或 force first-admin setup screen**（per A5 invariant；first-signup-becomes-admin fallback default OFF）
- **Multi-user 必须 work**：M2 deploy 后能加 second user + 用 second user login + author role 隔离验证（具体加 user UX 路径——CLI / minimum admin page / invite token / install profile 配置——归 testing + UX implementation phase 决定；PRD 不 mandate 具体形态）
- **Authenticated role model + anonymous principal state**：
  - `users.role` ∈ {`admin`, `author`}（authenticated roles）
  - Anonymous = `ctx.user === null`（principal state；不入 users 表）
- **Anonymous public read**：`/notes/:slug` 公开 notepage 不发 session cookie；不创建 anonymous session record；ctx.user = null
- **Private notepage gating**：
  - API request: 401 if `ctx.user === null`
  - Web navigation: 302 to `/login?return=<encoded-url>`
- **Declarative authz**：route metadata 支持 `requireRole(...)` / `requirePermission(...)` / **`requireOwner(resource)`**；middleware 自动 enforce；handler 不散落 if-check
- **ctx.user immutable Value Object**：middleware 设一次；request 内只读；plugin 试图 mutate → runtime reject（per [ADR-0011] capability ctx）
- **Login UI**：login page；form submit；error message 清晰；（signup page 仅在 operator enable 时显示）
- **Email optional**：signup 不强制 email；admin 可不带 email 创建 user；password reset 在有 email + SMTP 时走 email flow，否则 admin manual reset
- **Production security baseline**：production cookie `HttpOnly` + `Secure` + `SameSite`；POST mutation CSRF protected；HTTPS only（operator config）；具体实现 library 承接 + acceptance verify
- **Auth library safe operator config**：暴露 domain / cookie secure / session TTL / signing secret 路径等 safe config；**不**暴露 token strategy replacement / library 内部 rotation 配置（per A2；M2 用 library recommended default strategy）

### Should (M3 default — 不进 M2 acceptance；只在无成本顺便时 M2 ship)

明确 reviewer A3 要求：以下项 implementation team **不**应读成 M2 blocker。

- **Admin UI for user mgmt**：list users / disable / role change / manual password reset / view session list per user
- **Session list / device list**：user 自己能看 "logged in on N devices" + 单独 logout
- **Logout from all devices**：user 主动 revoke all sessions
- **Password reset via email** (if SMTP configured)：reset link with TTL
- **Rate limit on login attempts**：防 brute force；library 默认 + operator config

### Nice-to-have (M3+ / Phase 2+)

- **OAuth providers as operator-pluggable adapter**（GitHub / Google / OIDC）：每 provider 是 operator-enabled option（不是 runtime plugin install）
- **WebAuthn / Passkey** as operator-pluggable AuthProvider option
- **2FA (TOTP)** as auth extension feature
- **PAT (Personal Access Token)** for API / external client；走独立 wire path（per A10；不混 cookie-session）
- **MCP / agent auth wire path**（per [ADR-0015]）：独立 bearer token；Phase 2+ 单独设计
- **Email verification flow**（separate from password reset）
- **Per-notepage collaborator role**（跟 discussion / shared editing 一起 Phase 2+）

## Non-functional requirements

- **Performance**:
  - Auth middleware overhead < 5ms p95 per request (cached token verify)
  - Login p95 < 200ms (含 password hash verify; library 默认 Argon2id)
- **Security (user-observable mandate)**:
  - Token / password 全走 library 默认（不重写 crypto）
  - HTTPS only in production (operator config)
  - **Cookie**: production `HttpOnly` + `Secure` + `SameSite`（verifiable in dev tools / acceptance test）
  - **POST mutation CSRF protected**（verifiable: POST 无 CSRF token / wrong origin → reject）
  - 具体实现由 library 承接；PRD 给 acceptance 抓手
- **Accessibility**:
  - Login forms WCAG AA contrast + 全键盘可操作 + screen reader friendly
  - Signup forms 同（如 operator enable）
- **Self-host friendly**:
  - 无 external service required for Day-1 baseline (无 SMTP / 无 OAuth provider / 无 KMS)
  - Email / SMTP / OAuth 都是 optional opt-in

## Non-goals

- ❌ **Library 内部 token / hash / signing 决策** —— 归 library + future auth library selection ADR
- ❌ **Library token strategy replacement M2 暴露** —— 用 library recommended default；strategy switch 留 future ADR
- ❌ **AuthProvider as runtime plugin extension type** —— framing 错误（已 reframe 为 operator-pluggable adapter；详 invariants）
- ❌ **Public signup default ON** —— self-host 公网安全风险；default OFF；operator 显式 enable invite/signup
- ❌ **First-signup-becomes-admin default ON** —— critical security incident risk；default OFF；operator 显式 enable
- ❌ **Admin-toggleable signup policy** —— signup policy = operator config；admin 不可 toggle（防 admin compromise 变 public signup）
- ❌ **Agent / API auth 混入 M2 cookie-session 承诺** —— M2 cookie-session 仅 cover browser human auth；agent / API (PAT / MCP / bearer) Phase 2+ 独立 wire path
- ❌ **JWT signing key rotation 流程 M2 ship** —— 归 future operator runbook；M2 不进 acceptance
- ❌ **Operator-pluggable infra adapter**（storage / search / backup） —— 归 [self-host-deploy/]
- ❌ **Enterprise SSO**（SAML / LDAP / Kerberos / Active Directory）—— per [project.md] non-goal
- ❌ **Federated identity across SHCKB instances** —— per [project.md] "operator pool 独立"
- ❌ **Per-block ACL** —— Phase 2+ 跟 discussion / shared editing 一起
- ❌ **RBAC matrix** —— Day-1 simple authenticated role model（admin / author）+ anonymous principal state；matrix Phase 2+ 才考虑
- ❌ **Self-built auth from scratch** —— Build vs Buy = Buy；用 Better-Auth 或类似成熟 library；自研 crypto rejected

## Acceptance criteria

### M2 — minimum shippable

- **E2E (no public signup path)**：first admin via bootstrap login → 创建 author user → author login → 创建 private notepage → logout → anonymous 访问 private 触发 redirect → re-login → 访问 OK
- **Anonymous public read**：无 cookie 访问 public notepage 成功 + 不创建 session + ctx.user === null
- **First admin detection**：install bootstrap profile 含 admin credential → 部署后立即 login OK；**install profile 漏配 admin credential → startup reject 或 force first-admin setup screen**（验证 first-signup-becomes-admin fallback default OFF）
- **Multi-user 验证**：M2 deploy 后能加 second user + 用 second user login + author role 隔离（具体加 user UX path 是 implementation choice；testing 必须 cover）
- **Role + ownership 验证**：admin / author 各 capability 边界 + author 不能编辑他人 private notepage（resource ownership enforce）
- **Cross-feature seams M2**：
  - notepage edit 权限 enforce（author 自己 notepage 可编辑；他人 private notepage 403；走 declarative `requireOwner`）
  - theme user pref server-side persist（user-view PRD M2 align）
- **PEP middleware**：所有 API route 经 middleware；至少 1 个 protected route + 1 个 public route 验证；handler 不重复 verify
- **Declarative authz**：route metadata `requireRole` / `requirePermission` / `requireOwner` 都 work
- **ctx.user immutable**：plugin 试图 mutate ctx.user → runtime reject + log violation
- **Production security baseline**：
  - 生产 cookie 含 `HttpOnly` / `Secure` / `SameSite`（dev tools 可 verify）
  - POST mutation 无 CSRF token / 错 origin → reject
  - HTTPS only in production（operator config 启用）
- **Library 集成**：preferred baseline (Better-Auth) 或 fallback (Auth.js core) 集成 + ctx.user 桥接 + AuthProvider operator-selected adapter 起作用（library selection 待 future ADR 拍）

### M3 — admin polish + a11y

- Admin UI for user mgmt work
- Password reset work (with SMTP optional)
- Session list / logout-everywhere work
- Login / signup forms WCAG AA 100%
- Auth middleware perf < 5ms p95

### M4 — production polish

- 5 deploy mode 全 verify (含 Workers runtime constraint)
- Rate limit baseline shipped
- Operator runbook: JWT signing key rotation flow（per [ADR-0018] follow-up）

### Phase 2+

- OAuth providers as operator-pluggable adapters
- WebAuthn / Passkey
- PAT for API access (独立 wire path)
- MCP / agent auth (per [ADR-0015])
- 2FA

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Install bootstrap admin credential 漏配 | **Default 行为**：startup reject 或 force first-admin setup screen（per A5 invariant；first-signup-becomes-admin fallback default OFF）；operator 可在 profile **显式 enable** fallback（罕见；如 internal sandbox 部署）|
| Operator 显式 enable public signup | Signup endpoint ON；新 user signup → author role；admin 不可在 webapp 内 toggle 此 policy（per B3）|
| Admin 试图在 webapp 内 toggle signup policy | 拒绝（不暴露 toggle UI 给 admin）；admin 想改 signup policy 必须 redeploy / 改 operator config |
| Email 没配 SMTP + user 忘 password | UI 提示 "联系 admin"；admin 走 manual reset；session 不锁 user |
| Concurrent signup with 同 username | Library 默认 race-safe；返回 conflict error |
| Session expire mid-edit | Library refresh token 静默续；refresh 也 expired → 触发 login redirect 保留 return URL |
| Admin disable 自己 account | UI 防呆 + validation reject "cannot disable self"；必须另一 admin 操作；single-admin instance 不允许 disable last admin |
| Single user instance (Solo NAS)，user = admin = author | OK；admin 也能创建 / 编辑自己 notepage |
| Anonymous user 想 follow author / discussion 等 future feature | Phase 2+ 走轻量 auth 路径（归 [discussion/]） |
| API request without session | 401 JSON response (not redirect) |
| Web navigation without session for private | 302 to `/login?return=...` |
| Operator 想换 auth provider（如 username/password → OAuth） | Export-reinstall-import workflow（不是 runtime 切换）；schema / secrets / callback URL 迁移；现有 user 视实际情况 link account |
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

1. **Auth library selection final**：Better-Auth preferred baseline，但 final 选型归 future auth library selection ADR；ADR 需 verify Bun + Hono + Drizzle + Workers 约束；fallback Auth.js core (lower-level)；自研 crypto rejected
2. **Anonymous read 是否要 rate limit**：防爬虫 / 防 DDoS；可能 operator config + reverse proxy 层负责（不归本 PRD），还是要 application-level rate limit?
3. **Admin self-disable 防呆细节**：UI 灰显 vs validation layer reject；single-admin instance 的特殊判断
4. **SMTP-less 部署 password reset UX**：admin manual reset 怎么 surface 给 user（"联系 admin" + admin 联系方式从哪来）
5. **Future agent / API auth wire path 形态**：PAT / MCP / bearer token 具体 wire 形态归 Phase 2+ + [ADR-0015] cross-ref；M2 不承诺

## Surfaced ADR debts

本 PRD 触发的 ADR 层 framing 问题（reframe round 2 candidates，等本批 PRD 全完成后做 ADR round）：

- **Auth library selection ADR (new)**：preferred baseline = Better-Auth；候选对比（Auth.js core / 自己写 + small libs）；Hono + Drizzle adapter + Workers 集成 verify；M2 ship 前 verify checklist；含 AuthProvider operator-pluggable adapter contract（不进 [ADR-0014] plugin contract）；含 Auth library wrapper layer 设计（Better-Auth 内部 plugin → SHCKB operator config 暴露）
- **AuthProvider 不进 [ADR-0014] plugin contract**：AuthProvider 是 operator-pluggable adapter（跟 storage/search/backup 一个 pattern），不是 runtime plugin extension type；[ADR-0014] 只在需要给 plugin 暴露 `ctx.user` / auth capability 时 cross-ref
- **[ADR-0011] ctx.user immutable Value Object pattern**：capability ctx 加 ctx.user 字段；只读契约（plugin 不可 mutate）；含 minimal identity fields；不含 token / secret；anonymous = ctx.user === null 合法 state
- **Declarative authz resource ownership policy (new)**：route metadata 加 resource policy / ownership guard（如 `requireOwner(note)`）；middleware enforce；归 [ADR-0009] / [ADR-0012] OpenAPI gen 链路；handler 不散落 ownership check
- **[ADR-0009] auth endpoints 表 verify**：login / logout / session / reset password 等 endpoint 是否在 [ADR-0009] REST style 覆盖；agent wire path 独立于 cookie session（per A10）
- **Browser vs agent/API auth wire path 分离 ([ADR-0015] cross-ref)**：browser human auth = cookie session；agent/API auth = bearer/PAT/MCP；不共享 token；Phase 2+ 单独设计
- **Production cookie + CSRF baseline mandate**：cookie `HttpOnly` / `Secure` / `SameSite` + POST mutation CSRF；具体实现由 library 承接；归 future auth library selection ADR + acceptance verify
- **[ADR-0002] users / sessions / refresh_tokens schema verify**：library 默认 schema 跟 SHCKB sub schema 兼容性；slug Day-1 immutable invariant 跟 user identity ID 关系
- **[ADR-0018] install profile auth bootstrap**：5 profile 都要 cover admin credential setup + JWT signing key generation + secrets file 写入；first-signup-becomes-admin fallback default OFF；install profile 检测缺失 → reject startup / force setup screen
- **[ADR-0006] backend stack ↔ auth library 兼容**：Bun + Hono + Drizzle 跟 preferred baseline (Better-Auth) 实际集成 verify

详 [AUDIT-2026-05.md] PRD-surfaced debts log + [auth-setup-2026-05-17.md discussion record](../../../../engineering/design/discussions/auth-setup-2026-05-17.md)。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，**必须 align 本 PRD**。本 PRD 触发新 auth library selection ADR + ADR-0014 specialization rework（详 Surfaced ADR debts + [AUDIT-2026-05.md] 流程）。

- **Aligning ADRs**:
  - [ADR-0009](../../../../engineering/decisions/ADR-0009-api-style.md) — API style + auth endpoint 路径
  - [ADR-0011](../../../../engineering/decisions/ADR-0011-sandboxing-evolution.md) — sandbox capability + ctx.user 协议
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — plugin contract（**AuthProvider 不进 ADR-0014**；只在需要 plugin 暴露 ctx.user / auth capability 时 cross-ref）
  - [ADR-0018](../../../../engineering/decisions/ADR-0018-install-bootstrap.md) — install profile + first admin credential bootstrap
  - [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) — users / sessions schema 兼容
  - [ADR-0006](../../../../engineering/decisions/ADR-0006-backend-stack.md) — Bun + Hono + Drizzle stack 跟 auth library 集成
  - [ADR-0015](../../../../engineering/decisions/ADR-0015-agent-wire-protocol.md) — agent auth path cross-ref（Phase 2+）
  - Future auth library selection ADR — 候选承接 library 决策 + verify checklist
- **Parent PRD**: [project.md](../../project.md)
- **Cross-folder PRDs**: [notepage.md](../notepage/notepage.md) / [theme-system.md](../theme-system/theme-system.md) / [plugin-system.md](../plugin-system/plugin-system.md) / [self-host-deploy/](../self-host-deploy/README.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Discussion record**: [auth-setup-2026-05-17.md](../../../../engineering/design/discussions/auth-setup-2026-05-17.md) — round 2 fix 触发的 reviewer findings + Claude challenges + framing reframe history
- **Doc cross-reference convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft (Phase E Day-1 PRD #3)；reframe auth 为 **system-level PEP**（vs horizontal feature）；8 cross-cutting invariants 含 centralized PEP / ctx.user verified identity / AuthProvider as plugin extension type / declarative authz / anonymous first-class / operator-vs-user 二分 / self-host defaults / single instance independence；**Build vs Buy = Buy**（Better-Auth baseline；M2 ship 前 verify maturity；fallback Auth.js core）；3-layer abstraction implied（AuthProvider plugin / TokenStrategy operator-config 接口 / TokenCarrier library 内部）；Day-1 M2 = UsernamePassword + first admin via install bootstrap + 3-role + anonymous public read + PEP middleware；OAuth / WebAuthn / 2FA / PAT 全 Phase 2+ as AuthProvider plugin；email optional；surface ADR debts (auth library selection ADR / ADR-0014 AuthProvider specialization / ADR-0011 ctx.user pattern / ADR-0009 auth endpoint / ADR-0002 schema / ADR-0018 admin bootstrap / ADR-0006 library 集成)
- 2026-05-17 **pass 2 — reviewer findings + Claude challenges 落地**（详 [auth-setup-2026-05-17.md] discussion record）：
  - **A1 framing reframe (owner ratified)**：AuthProvider **不**是 runtime plugin extension type，是 **operator-pluggable adapter**（跟 storage/search/backup 一个 pattern）；不进 [ADR-0014] plugin contract；归 future auth library selection ADR
  - **A2**: M2 不暴露 token strategy replacement；只暴露 safe config（domain / cookie / TTL / signing secret 路径）
  - **A3**: M2 scope 收窄；admin UI / device list / email reset 明确 M3 default
  - **A4**: Signup default OFF invariant；author 由 admin 创建或 operator 显式 enable invite/signup
  - **A5**: First-signup-becomes-admin fallback default OFF invariant；install profile 检测 admin credential 缺失 → reject startup / force first-admin setup screen
  - **A6**: Role 模型改 authenticated only（admin / author 入 users.role）；anonymous = ctx.user === null principal state（不入 users）
  - **A7**: Declarative authz 加 resource ownership policy（route metadata `requireOwner(resource)`）
  - **A8**: Production cookie + CSRF baseline mandate（PRD 给 acceptance 抓手）
  - **A9**: Better-Auth 措辞改 "preferred baseline pending ADR verification"；不 PRD 锁死
  - **A10**: Browser session vs agent/API auth wire path 分离 invariant；M2 cookie-session 仅 cover browser human auth
  - **B3 (Claude)**: Signup policy operator-only toggle invariant（admin 不可 toggle；防 admin compromise）
  - **B4 (Claude)**: ctx.user immutable Value Object invariant（middleware 设一次；request 内只读；不含 token/secret）
  - **B1 / B2 / B5 self-withdrawn**：B1 → future auth library selection ADR；B2 → testing + UX implementation；B5 → future operator runbook（详 discussion record Section B 重新分类）
  - Cross-cutting invariants 8 → 13 条；surface ADR debts 重组（删 ADR-0014 AuthProvider specialization；加 ctx.user immutable / declarative ownership policy / browser-agent path 分离 / cookie+CSRF baseline / library wrapper layer 设计）
  - Methodology lesson（喂回 prd-discipline.md backfill）：判定 PRD challenge 的 user-observable 准则
