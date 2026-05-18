# Feature PRD: Authentication — PEP (Policy Enforcement Point) domain

| Field | Value |
|---|---|
| Status | draft (split from authentication.md pass 4) |
| Last updated | 2026-05-18 |
| Owner | W_YI |
| Parent PRD | [authentication.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

## Overview

**PEP (Policy Enforcement Point)** 是 auth subsystem 的 **enforcement domain**——把"identity 已验证"翻译成"每个 API request 的 access control 决策"。本 sub-PRD cover auth subsystem L1 stable layer 中跟 enforcement / 跨 middleware / 跨 plugin sandbox 协同的部分（per [authentication.md] 4-layer abstraction）。

**Scope**：PEP middleware contract / ctx.user immutable Value Object / declarative authz (含 resource ownership) / anonymous principal state / browser vs agent/API wire path 分离。

**不锁**（归 [identity.md]）：AuthAdapter 4-layer impl / provider options / role model / admin mgmt / audit baseline / cookie + CSRF mandate / library 内部决策。

**不锁**（归 [authentication.md] top）：4-layer abstraction diagram / 13 cross-cutting invariants 总表 / cross-feature seams / Build vs Buy 决策。

## User stories

### Handler / plugin author（developer-user 主要 audience）

- As a **handler author**, I want to **route metadata 声明 `requireRole('admin')` / `requirePermission('note:edit')` / `requireOwner(noteId)`**，so that **handler 不重复写 `if (ctx.user.role !== 'admin') { 403 }` 这种散落 check**
- As a **plugin author**, I want to **从 `ctx.user` 拿到 verified identity**（immutable Value Object：id / role / displayName），so that **plugin 可基于 user 决策 + 不必自己 verify session / cookie / token**
- As a **plugin author**, I want to **`ctx.user === null` 是合法 anonymous principal state**（不是 error），so that **public-facing plugin 也能 work 不需特殊 anonymous handling**
- As a **plugin author**, I want to **不可 mutate `ctx.user`**（compile-time + runtime guard），so that **意外 mutation 不破 PEP 决策一致性**

### Operator（间接 audience）

- As an **operator**, I want to **PEP middleware 在所有 API route 都过**，so that **没有 route 绕开 auth 直接暴露 resource**

## Functional requirements

### Must (Day-1, M2)

- **PEP middleware chain**：所有 API route 经统一 Hono middleware；middleware 验证 token + populate `ctx.user`；handler 不重复 verify
- **ctx.user immutable Value Object**（per [authentication.md] cross-cutting invariant）：
  - middleware 在 request entry 设一次；request 内只读
  - plugin / handler 不可 mutate（runtime guard reject + log violation）
  - 含 minimal identity fields：id / role / displayName（不含 token / session secret / refresh token）
  - `ctx.user === null` 是合法 anonymous principal state
- **Declarative authz**：route metadata 支持三层：
  - `requireRole('admin' | 'author')`
  - `requirePermission(...)` — 后续扩展
  - **`requireOwner(resource)`** — resource ownership policy（如 `requireOwner(noteId)`）
- **Authz enforcement 集中**：middleware 自动 enforce route metadata；handler 不散落 if-check
- **Anonymous principal handling**：
  - Public notepage route：`ctx.user === null` 合法；middleware 不发 session cookie；不创建 anonymous session record
  - Private notepage route：`ctx.user === null` → API 401 / web navigation 302 to `/login?return=<encoded-url>`
- **Browser vs agent/API wire path 分离**（per [authentication.md] invariant）：
  - M2 cookie-session auth 承诺**仅 cover browser human auth**
  - Agent / API（PAT / MCP / bearer token）是独立 wire path，Phase 2+ 单独设计（cross-ref [ADR-0015]）
  - 同一 PEP middleware 可走两路 (browser cookie / API bearer)，但 token strategy 独立

### Should (M3 default)

- **Per-route authz audit log**：何 route / 何 user / 何 decision (allow/deny) 写 audit；详 [identity.md] audit baseline
- **Authz decision trace tool**：dev mode 显示 route metadata 跟 enforcement result 链路

### Nice-to-have (M3+ / Phase 2+)

- **Custom policy plugin**（route metadata 允许 reference custom policy function）— Phase 2+
- **Attribute-based access control (ABAC)** — Phase 2+（Day-1 simple authenticated role 够）

## Non-functional requirements

- **Performance**:
  - Auth middleware overhead < 5ms p95 per request (cached token verify)
  - Authz check (含 requireOwner DB lookup) < 10ms p95
- **Determinism**:
  - 同 ctx.user + 同 route metadata → 同 authz decision（无 race / 无 randomness）

## Non-goals

- ❌ **AuthAdapter / provider options 详细** —— 归 [identity.md]
- ❌ **Role model / admin user mgmt** —— 归 [identity.md]
- ❌ **First admin via install bootstrap** —— 归 [identity.md]
- ❌ **Cookie / CSRF 实现细节** —— 归 [identity.md]（PRD mandate）+ library 内部
- ❌ **Run-time policy hot reload** —— Day-1 不做；改 policy = redeploy
- ❌ **Plugin can read raw session/cookie/token** —— per ctx.user immutable invariant；plugin 走 ctx.user only

## Acceptance criteria

### M2

- **PEP middleware** 跨所有 API route 验证（至少 1 protected + 1 public route 端到端 test）
- **ctx.user immutable**：plugin 试图 `ctx.user.role = 'admin'` → runtime reject + log violation
- **Declarative authz 3 层**：`requireRole` / `requirePermission` / `requireOwner` 都 work
- **Anonymous public read**：public notepage 无 cookie → 200 + ctx.user === null
- **Private gating**：private notepage 无 session → API 401 / web 302
- **Browser vs API path 分离**：M2 cookie-session 仅 browser；API key / bearer 走 401（M2 不 implement；reject 即可）
- **Plugin 拿 ctx.user**：sample plugin 通过 capability ctx 拿到当前 user info；不 access session 内部

### M3

- Per-route authz audit log 集成（跟 [identity.md] audit baseline 协同）
- Authz decision trace dev tool

### M4

- Performance baseline 5ms p95 verify across 5 deploy mode
- Edge case 覆盖完整（含 token expire mid-edit / multi-tab race / etc.）

### Phase 2+

- Custom policy plugin
- ABAC

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Plugin 试图改 `ctx.user.role` | Runtime guard reject + log violation；request 继续走（不 crash） |
| Plugin 试图读 `ctx.session.token` | Capability ctx 不暴露 raw session；access reject；详 [ADR-0011] |
| Route 漏写 require* metadata | Default deny（unauthenticated 不可访问）OR default allow（authenticated 任意 role 可）？倾向 default deny；具体归 implementation |
| `requireOwner(noteId)` 但 noteId 在 URL 缺失 | 400 Bad Request；middleware 不 deny silently |
| `requireRole('admin')` + ctx.user.role === 'author' | 403 Forbidden（authenticated but unauthorized；不是 401） |
| Anonymous accessing private notepage via API | 401 JSON response (not redirect) |
| Anonymous accessing private notepage via web | 302 to `/login?return=...` |
| Session expire mid-request | Library refresh 静默续；如 refresh expired → 401/302 同 anonymous treatment |
| Multi-tab same user，concurrent token refresh | Library default race-safe；中间 short grace window；不全 tab 强制 logout |
| API request with bearer token (M2 unimplemented) | 401 + clear "API auth Phase 2+" message |
| Custom policy throws exception | Default deny + log；不 crash middleware；user 看到 generic 403 |

## Dependencies

PRD 层 upstream 依赖：

- **Parent PRD**: [authentication.md](./authentication.md)
- **Sibling PRDs**: [identity.md](./identity.md)（PEP 消费 identity 决策；identity 提供 ctx.user 来源）
- **Cross-folder PRDs**:
  - [notepage.md](../notepage/notepage.md) — notepage edit/private 权限消费 declarative authz `requireOwner`
  - [theme-system-user-view.md](../theme-system/theme-system-user-view.md) — user pref persist 依赖 ctx.user
  - [plugin-system.md](../plugin-system/plugin-system.md) — plugin 通过 capability ctx 拿 ctx.user；不绕开 PEP

## Open questions

1. **Route metadata default policy**：漏写 require* 时 default deny vs default allow？倾向 default deny（safer）；归 implementation
2. **`requireOwner` 校验时机**：middleware (early DB lookup) vs handler entry (lazy)？trade-off perf vs handler logic clarity；归 implementation
3. **Custom policy 语义**：Phase 2+ 加 custom policy plugin 时是 sync function (ABAC-style) 还是 async (DB-aware)？

## Surfaced ADR debts

PEP-specific debts（cross-cutting debts 详 [authentication.md] top）:

- **[ADR-0011] ctx.user immutable Value Object pattern**：capability ctx 加 ctx.user 字段；只读契约；含 minimal identity；不含 token；anonymous = null
- **Declarative authz resource ownership policy**：route metadata 加 `requireOwner(resource)`；middleware enforce；归 [ADR-0009] / [ADR-0012] OpenAPI gen 链路
- **Browser vs agent/API wire path 分离 ([ADR-0015] cross-ref)**：browser human auth = cookie session；agent/API auth = bearer/PAT/MCP；不共享 token；Phase 2+ 单独设计

详 [AUDIT-2026-05.md] PRD-surfaced debts log + [authentication.md] surfaced debts。

## References

- **Aligning ADRs**（pending PRD-driven rework；详顶部 disclaimer）:
  - [ADR-0009](../../../../engineering/decisions/ADR-0009-api-style.md) — API style + route metadata
  - [ADR-0011](../../../../engineering/decisions/ADR-0011-sandboxing-evolution.md) — capability ctx + ctx.user 桥接
  - [ADR-0012](../../../../engineering/decisions/ADR-0012-openapi-gen.md) — OpenAPI gen + declarative authz 集成
  - [ADR-0015](../../../../engineering/decisions/ADR-0015-agent-wire-protocol.md) — agent auth path cross-ref（Phase 2+）
- **Parent**: [authentication.md](./authentication.md)
- **Sibling**: [identity.md](./identity.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Discussion record**: [auth-setup-2026-05-17.md](../../../../engineering/design/discussions/auth-setup-2026-05-17.md)

## Changelog

- 2026-05-18 initial draft (split from authentication.md pass 4)；PEP enforcement domain；含 PEP middleware contract / ctx.user immutable Value Object / declarative authz 3 层（含 resource ownership）/ anonymous principal state / browser vs agent/API wire path 分离
