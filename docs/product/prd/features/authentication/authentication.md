# Feature PRD: Authentication (top-level)

| Field | Value |
|---|---|
| Status | draft (setup-time sync cleanup) |
| Last updated | 2026-05-21 |
| Owner | W_YI |
| Parent PRD | [project.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

## Overview

**Authentication subsystem** 是 SHCKB 的 **system-level Policy Enforcement Point (PEP)**——不是 horizontal feature 而是**架构层 enforcement layer**。每个 API request 必须过 auth middleware chain；每个 resource 操作的 identity verification + authorization 在 middleware 集中 enforce，handler 不写 `if (user.role == ...)` 检查。

跟 [theme-system.md] / [plugin-system.md] 的区别在于：
- Theme = cross-cutting **extensibility framework**（cascade override，多 theme 平级；可缺席）
- Plugin = cross-cutting **extension framework**（多 extension type 平级；可缺席）
- **Auth = cross-cutting enforcement**（必须集中入口；不可缺席；失败模式 = 数据泄漏 / 越权）

**Build vs Buy = Buy**：Day-1 用成熟 TS auth library（**Better-Auth = preferred baseline，pending auth library selection ADR verification**：Bun + Hono + Drizzle + Workers 约束下 verify maturity / API stability / 集成可行性；候选对比 Auth.js core / 自己写 + 小 libs；自研 crypto 仍 rejected）作 implementation 底层。SHCKB **不**自己实现 token rotation / reuse detection / signing key / password hash 等 framework 决策。

本 PRD top 锁的是 **authentication subsystem 整体的 framing + 4-layer abstraction + 13 cross-cutting invariants + cross-feature seams + sub-PRD 索引**。具体 domain 细节归各 sub-PRD（[pep.md] / [identity.md]）。

**关键 framing reframe（2026-05-17 pass 4）**: 早期 draft 用 "AuthProvider" 一词同时承担 adapter / library plugin / identity source model 三种语义，**framing 模糊**。Pass 4 收紧为 4-layer abstraction（下面 diagram）；pass 5（2026-05-18）按 domain split sub-PRD：

| Sub-PRD | Domain | Main concern |
|---|---|---|
| [pep.md](./pep.md) | **PEP enforcement** | 每 API request 怎么 enforce auth/authz；ctx.user 怎么交付给 handler / plugin |
| [identity.md](./identity.md) | **Identity management** | Identity 怎么 verify / mgmt；AuthAdapter 4-layer impl；admin / signup / audit |

## 4-layer abstraction（per 2026-05-17 pass 4 terminology sharpen；discussion record Section F）

Auth subsystem 的核心 mental model 是 **4-layer stable-replaceable boundary**：上 2 层 SHCKB-owned 稳定不换；下 2 层是 implementation + operator config 可替换。

```
┌──────────────────────────────────────────────────────┐
│ L1 Auth subsystem (SHCKB-owned; STABLE)              │  ← 永远不换
│    PEP middleware / ctx.user / declarative authz     │     SHCKB auth contract 不漂
│    requireOwner / operator policy / first admin      │     (详 [pep.md] + [identity.md])
│    browser-vs-agent path separation                  │
├──────────────────────────────────────────────────────┤
│ L2 AuthAdapter interface (SHCKB-owned; STABLE)       │  ← 永远不换
│    thin wrapper interface expose to L1               │     decouple L1 from L3
├──────────────────────────────────────────────────────┤
│ L3 AuthAdapter implementation (REPLACEABLE)          │  ← 可替换
│    Better Auth adapter / Auth.js adapter / custom    │     operator deploy-time choose
│    thin layer                                        │     (详 [identity.md])
├──────────────────────────────────────────────────────┤
│ L4 Auth provider options (operator CONFIG)           │  ← operator config
│    username-password / GitHub OAuth / OIDC / passkey │     opt-in via install profile
│    (inside L3 implementation)                        │     可 co-exist
└──────────────────────────────────────────────────────┘

Change semantics (per [self-host-deploy/setup-time.md] §3 / §5 + [plugin-system.md] round 5 sync):
  + Add provider option @ L4         → operator config only; co-exist with existing; no migration
  Replace identity source @ L4       → user-level migration / link flow (not M2 acceptance)
  Replace L3 implementation          → operator migration workflow (export → redeploy → import)
  Replace L1 / L2                    → NEVER (subsystem contract stable; 不漂)
```

## Scope

### 本 PRD top 负责（cross-cutting framing）

- 4-layer abstraction + change semantics
- 13 cross-cutting invariants（全部 sub-PRD 共享）
- Cross-feature seams（notepage / theme / plugin / self-host）
- Build vs Buy = Buy decision + preferred baseline
- Sub-PRD 索引 + audience guidance

### 本 PRD top 不展开（归 sub-PRD）

| Domain | 归 |
|---|---|
| PEP middleware contract / ctx.user / declarative authz | [pep.md] |
| AuthAdapter 4-layer impl / provider options / signup policy / first admin / role model / admin mgmt / audit baseline / cookie+CSRF mandate | [identity.md] |
| Library 内部决策（token rotation / hash / signing key） | future auth library selection ADR + library |
| Install bootstrap mechanism | [self-host-deploy/setup-time.md] §1 |
| L3 replacement migration workflow | [self-host-deploy/setup-time.md] §5 |
| Audit event emit at runtime | [self-host-deploy/runtime.md] §3 |

## Cross-cutting invariants

跨 [pep.md] + [identity.md] 共同 hold 的不变量。

| Invariant | 含义 |
|---|---|
| **Centralized PEP** | 所有 API request 必须过 auth middleware chain；handler 不重复 verify；middleware 决定 anonymous / authenticated / forbidden（详 [pep.md]） |
| **ctx.user 是 immutable Value Object** | Middleware 在 request entry 设一次；request 内只读；plugin / handler 不可 mutate（per [ADR-0011] capability ctx）；含 minimal identity fields；**不**含 token / session secret / refresh token；`ctx.user === null` 是合法 anonymous principal state（详 [pep.md]） |
| **AuthAdapter as operator-pluggable adapter** | Identity verification 走**operator-selected adapter**（不是 runtime plugin extension type）；详 4-layer diagram + [identity.md] |
| **Declarative authz**（含 resource ownership） | Route metadata 声明 required role / permission / **resource policy**（如 `requireOwner(note)`）；middleware 集中 enforce；详 [pep.md] |
| **Authenticated role model + anonymous principal state** | `users.role` 只含 authenticated roles（`admin` / `author`）；anonymous = `ctx.user === null`；详 [identity.md] |
| **Anonymous first-class** | Public notepage 无 cookie / 无 session；不 track；详 [pep.md] |
| **Operator vs user 二分（含 signup policy operator-only）** | Operator config = OS-level；user role = webapp-level；webapp admin 不可改 operator config；signup policy toggle = operator config；详 [identity.md] |
| **Signup default OFF** | Self-host 公网实例默认无 public signup；invite-only 或 admin-create-user 路径；详 [identity.md] |
| **First-signup-becomes-admin fallback default OFF** | 漏配 admin credential + 公网实例 = critical security incident；详 [identity.md] |
| **Browser vs agent/API wire path 分离** | M2 cookie-session auth 承诺仅 cover browser human auth；agent / API token Phase 2+ 独立 wire path；详 [pep.md] |
| **Production security baseline** | Cookie production: `HttpOnly` + `Secure` + `SameSite`；POST mutation: CSRF protected；HTTPS only in production；详 [identity.md] |
| **Self-host friendly defaults** | Email optional；OAuth optional；first admin via install bootstrap；password reset 在没 SMTP 时 fallback admin manual reset；详 [identity.md] |
| **Single operator instance = single user pool** | 不跨 SHCKB instance federated identity（per [project.md] non-goal） |

## Sub-PRDs

| Sub-PRD | Scope | Main audience |
|---|---|---|
| [pep.md](./pep.md) | PEP middleware + ctx.user immutable + declarative authz (含 resource ownership) + anonymous principal state + browser vs agent path 分离 | handler author / plugin author |
| [identity.md](./identity.md) | AuthAdapter 4-layer impl + provider options + signup policy + first admin via install bootstrap + role model + admin user mgmt + audit baseline + cookie/CSRF mandate | operator / admin / end-user |

## Cross-feature seams

| Adjacent feature | Auth 跟它的接触面 |
|---|---|
| [notepage.md] | Edit / private read 权限走 declarative authz `requireOwner(noteId)`；详 [pep.md] |
| [theme-system-user-view.md] | User pref server-side persist 依赖 ctx.user identity；详 [identity.md] |
| [plugin-system.md] | Plugin 通过 capability ctx 拿 ctx.user；**AuthAdapter / provider options 不是 plugin extension type**（详 4-layer + Section A1 reframe） |
| [self-host-deploy/setup-time.md] | Install bootstrap 提供 admin credential / signing key / L4 provider config（per [identity.md] M2 + [setup-time.md] §1） |
| [self-host-deploy/runtime.md] | Audit event emit at runtime（per [identity.md] audit baseline + [runtime.md] §3） |
| [ai-integration/]（Phase 2+） | Agent / MCP wire path（per [pep.md] browser vs agent path 分离 + [ADR-0015] cross-ref） |
| [discussion/]（Phase 2+） | Discussion participant 轻量 auth（sidecar plugin pattern）|

## Acceptance criteria (top level — sub-PRD 各自展开)

### M2 — minimum shippable

- [pep.md] M2 acceptance pass（PEP middleware + declarative authz + ctx.user immutable + anonymous/private gating）
- [identity.md] M2 acceptance pass（first admin via bootstrap + multi-user + role + signup default OFF + production security baseline + audit baseline）
- Cross-PRD E2E：first admin login → 创建 author → author 创建 private notepage → logout → anonymous 访问 private 触发 redirect → re-login → 访问 OK
- **Self-host onboarding < 10 min** (per [self-host-deploy.md] M2 invariant)：覆盖 profile-seeded first admin login → author login → markdown notepage 端到端；dev-local setup screen path separately verified
- **Mainline POC gate** (per 2026-05-17 Section E recommendation #6)：Bun + Hono + Drizzle + SQLite/Postgres + auth library + AuthAdapter wrapper + ctx.user mapping 端到端 work

### M3

- [pep.md] M3 acceptance（per-route audit log / authz decision trace tool）
- [identity.md] M3 acceptance（admin UI / device list / email reset / a11y 100% / audit trail webapp view）

### M4

- [pep.md] M4（5ms p95 perf verify across 5 deploy mode；edge case 完整）
- [identity.md] M4（Constraint POC verified: Workers + D1 + auth library；rate limit baseline）
- 5 deploy mode 全 verify auth behavior 一致

### Phase 2+

- OAuth provider options as L4 add
- WebAuthn / Passkey
- PAT / MCP / bearer (per [pep.md] agent/API wire path Phase 2+)
- 2FA
- L3 replacement migration workflow complete

## Non-goals (top level)

- ❌ **Library 内部 token / hash / signing 决策** —— 归 library + future auth library selection ADR
- ❌ **AuthAdapter / provider options as runtime plugin extension type** —— framing 错误（已 reframe 为 4-layer abstraction）
- ❌ **替换 L1 / L2** —— 永远不换（SHCKB auth contract 不漂）；可换的只是 L3 implementation 或 L4 provider options
- ❌ **Operator-pluggable infra adapter**（storage / search / backup） —— 归 [self-host-deploy/]
- ❌ **Enterprise SSO**（SAML / LDAP / Kerberos / Active Directory）—— per [project.md] non-goal
- ❌ **Federated identity across SHCKB instances** —— per [project.md] "operator pool 独立"
- ❌ **Per-block ACL** —— Phase 2+ 跟 discussion / shared editing 一起
- ❌ **RBAC matrix** —— Day-1 simple authenticated role；matrix Phase 2+
- ❌ **Self-built auth from scratch** —— Build vs Buy = Buy；自研 crypto rejected

## Dependencies

- **Parent PRD**: [project.md](../../project.md)
- **Sibling PRDs (intra-folder)**:
  - [pep.md](./pep.md)
  - [identity.md](./identity.md)
- **Cross-folder PRDs**:
  - [notepage.md](../notepage/notepage.md) — edit / private read 权限消费者
  - [theme-system-user-view.md](../theme-system/theme-system-user-view.md) — user pref server-side persist 消费者
  - [plugin-system.md](../plugin-system/plugin-system.md) — plugin 通过 ctx.user 协同（**AuthAdapter / provider options 不是 plugin extension type**）
  - [self-host-deploy/setup-time.md](../self-host-deploy/setup-time.md) — install bootstrap + L4 option add + L3 replacement migration workflow
  - [self-host-deploy/runtime.md](../self-host-deploy/runtime.md) — audit event runtime emit
- **External services**: 无 Day-1 必须依赖（SMTP optional；OAuth provider Phase 2+）

## Open questions (top level — sub-PRD specific 见各自)

1. **Auth library selection final**：详 [identity.md] Q1 + future auth library selection ADR
2. **Cross-feature consistency**：未来 Phase 2+ feature（discussion / ai-integration）的 auth 接触面 framing 需 PRD-informed audit；本 PRD top 不预写

## Surfaced ADR debts

本 PRD top 触发的 cross-cutting ADR 层 framing 问题（sub-PRD specific 见各自；reframe round 2 candidates，等本批 PRD 全完成后做 ADR round）：

- **Auth library/provider selection ADR (new)**：preferred baseline = Better-Auth；候选对比；含 SHCKB AuthAdapter thin-wrapper contract（不进 [ADR-0014]）；含 provider option → operator config 映射；含 L3 replacement migration workflow；详 [identity.md] surfaced debts
- **AuthAdapter / provider options 不进 [ADR-0014] plugin contract**：详 4-layer + Section A1 reframe
- **[ADR-0011] ctx.user immutable Value Object pattern**：详 [pep.md] surfaced debts
- **Declarative authz resource ownership policy (new)**：详 [pep.md] surfaced debts
- **Browser vs agent/API auth wire path 分离 ([ADR-0015] cross-ref)**：详 [pep.md] surfaced debts
- **Production cookie + CSRF baseline mandate**：详 [identity.md] surfaced debts
- **[ADR-0002] users / sessions / refresh_tokens schema verify**：详 [identity.md] surfaced debts
- **[ADR-0018] install profile auth bootstrap**：详 [identity.md] surfaced debts
- **[ADR-0006] backend stack ↔ auth library 兼容**：详 [identity.md] surfaced debts
- **Auth schema ownership / endpoint wrapper strategy / role mapping**（2026-05-17 Section E）：详 [identity.md] surfaced debts
- **AuthAdapter interface surface area scope**（2026-05-17 pass 4 Sharpen A）：PRD/ADR/CONTRACT 三层划分；详 [identity.md] surfaced debts

详 [AUDIT-2026-05.md] PRD-surfaced debts log + [auth-setup-2026-05-17.md] discussion record。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策（pending PRD-driven rework；详顶部 disclaimer）。

- **Aligning ADRs**:
  - [ADR-0009](../../../../engineering/decisions/ADR-0009-api-style.md) — API style + auth endpoint 路径（详 [pep.md]）
  - [ADR-0011](../../../../engineering/decisions/ADR-0011-sandboxing-evolution.md) — sandbox capability + ctx.user 协议（详 [pep.md]）
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — plugin contract（**AuthAdapter / provider options 不进 ADR-0014**）
  - [ADR-0018](../../../../engineering/decisions/ADR-0018-install-bootstrap.md) — install profile + first admin credential bootstrap（详 [identity.md]）
  - [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) — users / sessions schema 兼容（详 [identity.md]）
  - [ADR-0006](../../../../engineering/decisions/ADR-0006-backend-stack.md) — Bun + Hono + Drizzle stack 跟 auth library 集成
  - [ADR-0015](../../../../engineering/decisions/ADR-0015-agent-wire-protocol.md) — agent auth path cross-ref（Phase 2+；详 [pep.md]）
  - Future auth library selection ADR — 候选承接 library 决策 + verify checklist
- **Parent PRD**: [project.md](../../project.md)
- **Sibling PRDs**: [pep.md](./pep.md) / [identity.md](./identity.md)
- **Cross-folder PRDs**: [notepage.md](../notepage/notepage.md) / [theme-system.md](../theme-system/theme-system.md) / [plugin-system.md](../plugin-system/plugin-system.md) / [self-host-deploy/self-host-deploy.md](../self-host-deploy/self-host-deploy.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Discussion records**:
  - [auth-setup-2026-05-17.md](../../../../engineering/design/discussions/auth-setup-2026-05-17.md) — reviewer findings + Claude challenges + framing reframe history（Section F AuthAdapter terminology / Section G modular pattern）
  - [self-host-setup-time-2026-05-21.md](../../../../engineering/design/discussions/self-host-setup-time-2026-05-21.md) — setup-time first-admin bootstrap mode sync
- **Doc cross-reference convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft (Phase E Day-1 PRD #3)；reframe auth 为 system-level PEP（vs horizontal feature）；8 cross-cutting invariants；Build vs Buy = Buy；3-layer abstraction implied（AuthProvider plugin / TokenStrategy / TokenCarrier）；Day-1 M2 = UsernamePassword + first admin via install bootstrap + 3-role + anonymous public read + PEP middleware
- 2026-05-17 pass 2 — reviewer 10 findings + Claude 2 challenges 落地（详 [auth-setup-2026-05-17.md] Section A/B）；Cross-cutting invariants 8 → 13 条；A1 framing reframe (AuthProvider = operator-pluggable not plugin)；A2-A10 + B3/B4 全接受
- 2026-05-17 pass 3 — Round 3 cleanup（reviewer Better Auth source-backed Section E + Rec #4 leftover + 3 sharpenings）；加 3 个 surfaced debts (schema ownership / endpoint wrapper / role mapping)；加 POC acceptance gate (M2 Mainline + M4 Constraint)
- 2026-05-17 pass 4 — AuthAdapter terminology sharpened (5 词 + 4-layer abstraction visual)；round 4 5 sharpenings：A interface surface area / B 4-layer ASCII diagram / C cross-subsystem modular pattern symmetry (discussion record Section G) / D plugin-system+new-block 反向 sync / E Non-goal L171 + L1/L2 stability
- 2026-05-18 **pass 5 — split into sub-PRDs**（per owner 2026-05-18 catch "authentication 文档有些大"）：authentication.md 388 行 → 拆 3 PRDs（top + [pep.md] + [identity.md]）；按 domain split (**PEP enforcement** vs **Identity management**)；top 保留 4-layer abstraction + 13 cross-cutting invariants + cross-feature seams + sub-PRD 索引 + cross-cutting Non-goals/Dependencies/Surfaced debts；user stories / functional req / detailed acceptance / edge cases 分到 sub-PRDs；ADR refs 自然 distribute (PEP → ADR-0009/0011/0012/0015；Identity → ADR-0002/0006/0014/0018)；top ~200 行 / pep ~150 / identity ~210（更平衡）
- 2026-05-18 **全 PRD ADR-pending disclaimer**（per owner 2026-05-18 framing rule）：顶部加 disclaimer block；所有 ADR refs pending PRD-driven rework；同步规则 ADR 改时 grep 全 PRD 同步
- 2026-05-21 setup-time sync cleanup：Self-host onboarding E2E 改为 profile-seeded first admin login canonical path；dev-local setup screen 单独验证；References 增加 setup-time discussion record。
