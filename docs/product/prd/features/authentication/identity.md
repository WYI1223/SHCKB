# Feature PRD: Authentication — Identity management domain

| Field | Value |
|---|---|
| Status | draft (setup-time sync cleanup) |
| Last updated | 2026-05-21 |
| Owner | W_YI |
| Parent PRD | [authentication.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

## Overview

**Identity management** 是 auth subsystem 的 **identity lifecycle domain**——从 first admin bootstrap 到 user verify、role assign、user mgmt、audit。本 sub-PRD cover auth subsystem 4-layer abstraction 的 L2/L3/L4 + 跨 install/operator/admin 协同（per [authentication.md] 4-layer abstraction）。

**Scope**：AuthAdapter implementation (L3) + provider options (L4) + signup policy + first admin via install bootstrap + role model + admin user mgmt + audit baseline + cookie + CSRF mandate。

**不锁**（归 [pep.md]）：PEP middleware contract / ctx.user immutable / declarative authz / browser vs agent path 分离。

**不锁**（归 [authentication.md] top）：4-layer abstraction diagram / 13 cross-cutting invariants 总表 / cross-feature seams / Build vs Buy 决策。

**不锁**（归 [authentication.md] top + library + future ADR）：Library 内部 token rotation / hash / signing key / AuthAdapter interface signature。

## User stories

### Operator（self-host operator 主要 audience）

- As a **first-time operator**, I want to **install bootstrap profile 提供 admin credential → deploy 后立即 login**，so that **< 10 min onboarding；不需 SSH 改 DB**
- As a **first-time operator漏配 admin credential**, I want to **internet-exposed bootstrap mode startup reject，或 dev-local bootstrap mode 用 first-admin setup screen + one-time setup token**，so that **公网部署不会出现"第一访问者成 admin"安全事故，本地开发仍有便利路径**
- As an **operator adding OAuth provider option**（如 username-password 之外加 GitHub OAuth）, I want to **改 install profile + redeploy → 现有 user 不变，可主动 link GitHub account**，so that **加 provider 不触发 user migration（per [authentication.md] L4 add coexist）**
- As an **operator opening public signup**, I want to **在 install profile / env 显式开启 signup policy**，so that **default OFF 安全；显式 opt-in 才 ON；admin 不可 toggle**

### Admin（in-webapp user role）

- As an **admin**, I want to **创建 user / 重置 password**（M2 minimum admin capability；具体 UX 路径 testing/implementation 决定），so that **管理 user 不需 SSH 改 DB**
- As an **admin without SMTP**, I want to **手动给 user 设新 password**，so that **user 忘 password 时不依赖 email service**

### End-user（note author / reader）

- As a **note author created by admin**, I want to **用 admin 提供的初始 credential 登录 → 创建 private notepage → logout**，so that **完整内容创作流的最短路径（不依赖 public signup）**
- As a **note author**, I want to **session 跨 browser refresh / 短暂离开后保持**（library refresh token 机制），so that **不被频繁 logout 打断**
- As an **anonymous reader**, I want to **直接访问 public notepage URL 看到内容**（不被 redirect；不发 session cookie），so that **author 公开内容触达零障碍**

## Functional requirements

### Must (Day-1, M2)

- **AuthAdapter L3 implementation baseline**（per [authentication.md] 4-layer + Build/Buy = Buy）：preferred baseline = Better-Auth pending ADR verification；fallback Auth.js core；自研 crypto rejected
- **Username-password provider option** (L4 built-in)：login / logout / change password；signup endpoint **存在但 default OFF**（policy = operator config）
- **First admin via install bootstrap** (per [ADR-0018])：install profile 含 admin credential（username + bootstrap password）；deploy 后 admin 立即可 login；**internet-exposed bootstrap mode 缺 admin credential → reject startup；dev-local bootstrap mode 可 force first-admin setup screen + one-time setup token**（per [authentication.md] invariant + [self-host-deploy/setup-time.md]）
- **First-signup-becomes-admin fallback default OFF**（per [authentication.md] invariant）：漏配 admin + 公网部署不会让第一访问者成 admin；fallback 必须 operator 显式 enable
- **Multi-user 必须 work**：M2 deploy 后能加 second user + 用 second user login + author role 隔离（具体加 user UX path 是 testing + UX implementation choice；PRD 不 mandate 具体形态）
- **Authenticated role model + anonymous principal state**（per [authentication.md] invariant）:
  - `users.role` ∈ {`admin`, `author`}（authenticated roles）
  - Anonymous = `ctx.user === null`（principal state；不入 users 表）
- **Signup policy operator-only toggle**（per [authentication.md] invariant）：admin 不可 toggle；webapp 内无 toggle UI；想改 = redeploy + 改 operator config
- **Email optional**：signup 不强制 email；admin 可不带 email 创建 user；password reset 在有 email + SMTP 时走 email flow，否则 admin manual reset
- **Production security baseline**（per [authentication.md] invariant；PRD mandate；具体实现 library 承接）：
  - Cookie production: `HttpOnly` + `Secure` + `SameSite`
  - POST mutation: CSRF protected（无 token / 错 origin → reject）
  - HTTPS only in production（operator config）
- **Audit baseline events**（per [runtime.md] audit trail；M2 必须 emit）:
  - Admin login / logout
  - User create / disable / role change
  - Password reset (admin manual or email)
  - First admin setup
  - Failed login (rate limit candidate)
- **Auth library safe operator config**：暴露 domain / cookie secure / session TTL / signing secret 路径等 safe config；**不**暴露 token strategy replacement / library 内部 rotation 配置（per [authentication.md] M2 不暴露）

### Should (M3 default — 不进 M2 acceptance；只在无成本顺便时 M2 ship)

- **Admin UI for user mgmt**：list users / disable / role change / manual password reset / view session list per user
- **Session list / device list**：user 自己能看 "logged in on N devices" + 单独 logout
- **Logout from all devices**：user 主动 revoke all sessions
- **Password reset via email** (if SMTP configured)：reset link with TTL
- **Rate limit on login attempts**：防 brute force；library 默认 + operator config

### Nice-to-have (M3+ / Phase 2+)

- **OAuth provider options inside L3** (GitHub / Google / OIDC)：每 provider 是 operator-enabled option（per [authentication.md] L4 add coexist；不走 runtime install）
- **WebAuthn / Passkey** as L4 provider option
- **2FA (TOTP)** as auth extension feature
- **Email verification flow**（separate from password reset）
- **Per-notepage collaborator role**（跟 discussion / shared editing 一起 Phase 2+）
- **L3 replacement migration**（如 Better Auth adapter → Auth.js adapter；per [authentication.md] 4-layer + [self-host-deploy/setup-time.md] §5 L3 replacement migration workflow）

## Non-functional requirements

- **Performance**:
  - Login p95 < 200ms（含 password hash verify；library 默认 Argon2id）
- **Security (user-observable mandate)**:
  - Token / password 全走 library 默认（不重写 crypto）
  - 详 Must 段 Production security baseline
- **Accessibility**:
  - Login forms WCAG AA contrast + 全键盘可操作 + screen reader friendly
  - Signup forms 同（如 operator enable）
- **Self-host friendly**:
  - 无 external service required for Day-1 baseline (无 SMTP / 无 OAuth provider / 无 KMS)
  - Email / SMTP / OAuth 都是 optional opt-in

## Non-goals

- ❌ **PEP middleware / ctx.user / declarative authz 细节** —— 归 [pep.md]
- ❌ **Library 内部 token / hash / signing 决策** —— 归 library + future auth library selection ADR
- ❌ **AuthAdapter interface signature 字段集** —— 归 future auth library selection ADR + packages/auth/CONTRACT.md
- ❌ **Public signup default ON** —— self-host 公网安全风险
- ❌ **Admin-toggleable signup policy** —— signup policy = operator config；admin 不可 toggle
- ❌ **First-signup-becomes-admin default ON** —— critical security incident risk
- ❌ **Agent / API auth 混入 M2 cookie-session 承诺** —— 归 [pep.md] browser vs agent path 分离
- ❌ **L3 replacement migration M2 ship** —— Phase 2+；M2 只保留 future contract marker；不 ship export/import CLI skeleton，不提供 user-facing migration guarantee（per [self-host-deploy/setup-time.md]）
- ❌ **Enterprise SSO**（SAML / LDAP / Kerberos）—— per [project.md] non-goal
- ❌ **Federated identity across SHCKB instances** —— per [project.md] non-goal
- ❌ **RBAC matrix** —— Day-1 simple authenticated role model；matrix Phase 2+

## Acceptance criteria

### M2

- **E2E (no public signup path)**：first admin via bootstrap login → 创建 author user → author login → 创建 private notepage → logout → re-login → 访问 OK
- **First admin detection**：install bootstrap profile 含 admin credential → 部署后立即 login OK；**internet-exposed bootstrap mode 漏配 → startup reject；dev-local bootstrap mode 漏配 → setup screen + one-time setup token**（验证 first-signup-becomes-admin fallback default OFF）
- **Multi-user 验证**：M2 deploy 后能加 second user + 用 second user login + author role 隔离（具体加 user UX path 是 implementation choice；testing 必须 cover）
- **Role 验证**：admin / author capability 边界（author 不能 mgmt user 等）
- **Signup policy operator-only**：admin webapp 无 toggle UI；改 signup policy 必须 redeploy + 改 operator config
- **Email optional**：admin 可不带 email 创建 user；password reset 在 SMTP 配置下走 email；否则 admin manual reset
- **Production security baseline**：
  - 生产 cookie 含 `HttpOnly` / `Secure` / `SameSite`（dev tools 可 verify）
  - POST mutation 无 CSRF token / 错 origin → reject
  - HTTPS only in production（operator config 启用）
- **Audit baseline events** emit（admin login / user create / password reset / first admin setup / failed login）
- **Library 集成**：preferred baseline (Better-Auth) 或 fallback (Auth.js core) 集成 + SHCKB AuthAdapter thin wrapper 起作用（library selection 待 future ADR 拍）
- **Mainline POC gate** (per [authentication.md] M2 acceptance)：Bun + Hono + Drizzle + SQLite/Postgres + auth library + AuthAdapter wrapper 端到端 work

### M3

- Admin UI for user mgmt work
- Password reset via email (if SMTP)
- Session list / logout-everywhere
- Login / signup forms WCAG AA 100%
- Audit trail webapp view（admin-only；filter by time / user / event；per [runtime.md] audit）

### M4

- **Constraint POC verified**（Workers + D1 + auth library；如不支持 → 文档化为 known constraint；per [authentication.md] M4）
- 5 deploy mode 全 verify identity behavior 一致
- Rate limit baseline shipped

### Phase 2+

- OAuth provider options (GitHub / Google / OIDC)
- WebAuthn / Passkey
- PAT for API access（per [pep.md] browser vs agent path）
- MCP / agent auth (per [ADR-0015])
- 2FA
- L3 replacement migration workflow（complete）
- Per-notepage collaborator role

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Install bootstrap admin credential 漏配 | **Internet-exposed bootstrap mode**：startup reject；**dev-local bootstrap mode**：force first-admin setup screen + one-time setup token；first-signup-becomes-admin fallback default OFF |
| Operator 显式 enable public signup | Signup endpoint ON；新 user signup → author role；admin 不可在 webapp 内 toggle 此 policy |
| Admin 试图在 webapp 内 toggle signup policy | 拒绝（不暴露 toggle UI 给 admin）；admin 想改 signup policy 必须 redeploy / 改 operator config |
| Email 没配 SMTP + user 忘 password | UI 提示 "联系 admin"；admin 走 manual reset；session 不锁 user |
| Concurrent signup with 同 username | Library 默认 race-safe；返回 conflict error |
| Admin disable 自己 account | UI 防呆 + validation reject "cannot disable self"；必须另一 admin 操作；single-admin instance 不允许 disable last admin |
| Single user instance (Solo NAS)，user = admin = author | OK；admin 也能创建 / 编辑自己 notepage |
| Operator 添加 provider option co-exist（如 UsernamePassword ⊕ 加 OAuth-GitHub）| 加 operator config + 重 deploy；现有 user 不变；user 可主动 link OAuth account；**不**走 export-reinstall-import |
| Operator 替换 identity source（强制现有 user 改用 OAuth；password 失效）| User-level migration / link flow（不在 M2 acceptance）；归 future migration runbook + auth library selection ADR |
| Operator 替换 AuthAdapter implementation / backing auth library 或完整 provider model | Export users/session-relevant data → redeploy with new AuthAdapter implementation/config → import/migrate/link users；schema / secrets / callback URL 迁移；不在 M2 acceptance |
| Admin reset user password 后 | User 现有 session 全 invalidate；user 用新 password re-login |
| User 多 tab 同时 login + 同时 access token 过期 | Library 默认 race-safe（grace window；不会全 tab 自动 logout） |

## Dependencies

PRD 层 upstream 依赖：

- **Parent PRD**: [authentication.md](./authentication.md)
- **Sibling PRDs**: [pep.md](./pep.md)（identity 提供 ctx.user 来源；PEP 消费 identity 决策）
- **Cross-folder PRDs**:
  - [self-host-deploy/setup-time.md](../self-host-deploy/setup-time.md) — install bootstrap + L4 option add + L3 replacement migration workflow
  - [self-host-deploy/runtime.md](../self-host-deploy/runtime.md) — audit baseline event emit at runtime
  - [theme-system-user-view.md](../theme-system/theme-system-user-view.md) — user pref server-side persist 消费者
  - [plugin-system.md](../plugin-system/plugin-system.md) — AuthAdapter / provider options 不是 plugin extension type（per Section A1 reframe）
- **External services**: SMTP optional / OAuth provider Phase 2+

## Open questions

1. **Auth library selection final**：Better-Auth preferred baseline，但 final 选型归 future auth library selection ADR；ADR 需 verify Bun + Hono + Drizzle + Workers 约束；fallback Auth.js core
2. **Anonymous read 是否要 rate limit**：防爬虫 / 防 DDoS；可能 operator config + reverse proxy 层负责（不归本 PRD），还是要 application-level rate limit？
3. **Admin self-disable 防呆细节**：UI 灰显 vs validation layer reject；single-admin instance 的特殊判断
4. **SMTP-less 部署 password reset UX**：admin manual reset 怎么 surface 给 user（"联系 admin" + admin 联系方式从哪来）

## Surfaced ADR debts

Identity-specific debts（cross-cutting debts 详 [authentication.md] top）:

- **Auth library/provider selection ADR (new)**：preferred baseline = Better-Auth；候选对比；Hono + Drizzle + Workers 集成 verify；含 SHCKB AuthAdapter thin-wrapper contract（不进 [ADR-0014] plugin contract）；含 provider option → operator config 映射；含 L3 replacement migration workflow
- **AuthAdapter / provider options 不进 [ADR-0014] plugin contract**：AuthAdapter 是 SHCKB auth subsystem 的 stable boundary + library wrapper；provider options 是 operator config；二者都不是 runtime plugin extension type
- **[ADR-0002] users / sessions / refresh_tokens schema verify**：library 默认 schema 跟 SHCKB sub schema 兼容性；slug Day-1 immutable invariant 跟 user identity ID 关系
- **[ADR-0018] install profile auth bootstrap**：5 profile 都要 cover admin credential setup + library signing key generation + secrets file 写入；first-signup-becomes-admin fallback default OFF；install profile 检测缺失 → reject startup / force setup screen
- **[ADR-0006] backend stack ↔ auth library 兼容**：Bun + Hono + Drizzle 跟 preferred baseline (Better-Auth) 实际集成 verify
- **Auth schema ownership**：library schema vs [ADR-0002] 草图；三个 wrapper 候选；M2 ship 前必须 lock
- **Endpoint wrapper strategy**：library native endpoints vs SHCKB wrapper 维持 [ADR-0009]；M2 ship 前必须 lock
- **Role mapping**：library admin plugin roles/permissions matrix vs SHCKB 2-role + anonymous state；避免 import RBAC matrix 进 M2
- **AuthAdapter interface surface area scope**（per [authentication.md] Sharpen A）：PRD 锁语义边界 / ADR 锁 signature / CONTRACT 锁字段集 三层划分

详 [AUDIT-2026-05.md] PRD-surfaced debts log + [authentication.md] surfaced debts + [auth-setup-2026-05-17.md] Section E "still needs confirmation"。

## References

- **Aligning ADRs**（pending PRD-driven rework；详顶部 disclaimer）:
  - [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) — users / sessions schema 兼容
  - [ADR-0006](../../../../engineering/decisions/ADR-0006-backend-stack.md) — Bun + Hono + Drizzle stack 跟 auth library 集成
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — plugin contract（**AuthAdapter / provider options 不进 ADR-0014**）
  - [ADR-0018](../../../../engineering/decisions/ADR-0018-install-bootstrap.md) — install profile + first admin credential bootstrap
  - Future auth library selection ADR — 候选承接 library 决策 + verify checklist + L3 replacement migration workflow
- **Parent**: [authentication.md](./authentication.md)
- **Sibling**: [pep.md](./pep.md)
- **Cross-folder**: [self-host-deploy/setup-time.md](../self-host-deploy/setup-time.md) / [self-host-deploy/runtime.md](../self-host-deploy/runtime.md) / [notepage.md](../notepage/notepage.md) / [theme-system.md](../theme-system/theme-system.md) / [plugin-system.md](../plugin-system/plugin-system.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Discussion records**:
  - [auth-setup-2026-05-17.md](../../../../engineering/design/discussions/auth-setup-2026-05-17.md)（reviewer 10 findings + Section E Better Auth investigation + Section F AuthAdapter terminology + Section G modular pattern）
  - [self-host-setup-time-2026-05-21.md](../../../../engineering/design/discussions/self-host-setup-time-2026-05-21.md) — setup-time first-admin bootstrap mode sync

## Changelog

- 2026-05-18 initial draft (split from authentication.md pass 4)；Identity management domain；含 AuthAdapter L3 implementation + L4 provider options + signup policy operator-only + first admin via install bootstrap + role model + admin user mgmt + audit baseline + cookie/CSRF mandate；E2E user stories cover operator / admin / end-user 三 audience
- 2026-05-21 setup-time sync cleanup：first-admin detection 改为 internet-exposed / dev-local bootstrap mode split；L3 replacement M2 scope 对齐 setup-time：future contract marker only，无 CLI skeleton / user-facing migration guarantee。
