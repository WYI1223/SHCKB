# Feature PRD: Self-host deployment — setup-time

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-18 |
| Owner | W_YI |
| Parent PRD | [self-host-deploy.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

## Overview

**Setup-time** = operator-active 改动期间。Self-host operator 主动触发 + 几乎都要 **redeploy**（per [ADR-0001] canonical OCI + [self-host-deploy.md] cross-cutting invariant "no runtime config hot reload"）。

本 PRD cover 5 类 setup-time 操作（5 H2 sections 下面）：

1. **First-time install**（T0：从 zero 部署到首次 running）
2. **Initial adapter config**（T0 + T2：选 storage / search / backup / DB adapter）
3. **L4 option add / config change**（T2：加 provider option / 改 secrets / 改 config）
4. **SHCKB version upgrade**（T3：升级到新 SHCKB 版本 + schema migration）
5. **L3 replacement migration**（T5：替换 AuthAdapter / DB engine / storage backend；export-redeploy-import）

不锁：
- Run-time SHCKB 自治期间操作（→ [runtime.md]）
- Library 内部决策（→ future ADRs）
- Runbook step-by-step（→ future `engineering/runbooks/`）

## Scope

### 本 PRD 负责

- 5 类 setup-time 操作的 **user-observable WHAT**（operator 看到 / 操作 / 失败提示）
- 跨 5 类操作的 cross-cutting setup-time invariants
- Operator-facing CLI / install bootstrap UX
- Setup-time error handling baseline（失败可恢复；不静默 fail）

### 本 PRD 不负责

| 不负责 | 归 |
|---|---|
| Run-time monitoring / backup schedule / health | [runtime.md] |
| Auth library internal token / hash 决策 | [authentication.md] + future auth library selection ADR |
| Plugin sandbox / lifecycle 通用机制 | [plugin-system.md] / [ADR-0011] / [ADR-0014] |
| Cookie / CSRF library 内部实现 | [authentication.md] + library |
| 具体 runbook step | future `engineering/runbooks/` |

## §1 First-time install

### User stories

- As a **first-time operator (Solo NAS)**, I want to **`docker compose up -d` → 浏览器访问 → first-admin setup screen → 创建 admin → 用 admin 登录**，so that **< 10 min E2E onboarding；无需 SSH 改 DB / 改 env / 复杂步骤**
- As a **first-time operator (Team VPS)**, I want to **类似 Docker compose 流程 + 配置 Postgres / S3-compat 入口**，so that **能选择更适合 Team scale 的 adapter；不强制单一 SQLite**
- As a **first-time operator**, I want to **install bootstrap profile 检测 admin credential 缺失 → reject startup 或 force first-admin setup screen**（per [authentication.md] A5 invariant），so that **公网部署不会出现"第一访问者成 admin"安全事故**

### Must (M2)

- **Canonical OCI image + Docker compose**：`docker compose up -d` 启动 SHCKB instance
- **Install profile selection**（per [ADR-0018] 5 profile）：profile 选 1 个；profile 决定 default deploy mode + default adapter set + default admin credential bootstrap method
- **First-admin setup**（per [authentication.md] A5）：install profile 含 admin credential → deploy 后立即 login；漏配 → startup reject 或 force setup screen
- **Signing key generation**（auto；不进 OCI image）：install bootstrap 时 generate；写 secrets file / env；rotation 走 future operator runbook（M2 不 ship rotation）
- **Single-binary 备用 path**：操作 + UX 跟 Docker compose 对齐；同 source；不分叉
- **< 10 min onboarding E2E**（per [self-host-deploy.md] M2 invariant）：Docker compose up → first admin login → 创建 author user → 创建 markdown notepage 端到端
- **Onboarding 错误可恢复**：admin credential 错 / DB connection 失败 / port 占用 / etc. → 清晰 error message + 修复路径

### Should (M3)

- **NAS-specific templates**（Synology DSM Docker / TrueNAS apps / Unraid Community Apps；至少一个 verify）
- **VPS templates**（含 systemd unit + Caddy reverse proxy template）
- **Migration importer**（M2 没 export 来源；M3 实际启用）

### Nice-to-have (M4+)

- **Cloudflare Workers tier 3 install path**（M4 verify；如 known constraint 文档化）
- **PaaS templates**（Coolify / Dokploy；兼容不依赖）
- **GUI install wizard**（替代 first-admin setup screen 的 webapp 内 UI；Phase 2+）

## §2 Initial adapter config

### User stories

- As a **Team VPS operator**, I want to **install 时选 Postgres + S3-compat + Postgres tsvector**（替代 default SQLite + local-fs + FTS5），so that **跟 Team scale 资源匹配**
- As a **Solo NAS operator**, I want to **不操作 adapter config 也能 work**（用 default SQLite + local-fs），so that **零配置部署到 NAS**

### Must (M2)

- **4 horizontal subsystem adapter** initial config（per [ADR-0006] / [ADR-0007] / [ADR-0008] / [ADR-0017]）：
  - DB engine（SQLite / Postgres / MySQL via Drizzle multi-dialect）
  - Storage provider（local-fs / S3-compat）
  - Search provider（SQLite FTS5 / Postgres tsvector / Meilisearch）
  - Backup provider（local / S3）
- **Default sensible**：Solo NAS profile default = SQLite + local-fs + FTS5 + local-backup；零配置 work
- **Operator-friendly config syntax**：env var / install profile YAML / .env file；统一 schema；详 future operator runbook
- **Config validation**：startup 时校验 config 完整性；缺失必填项 → reject startup + 清晰提示

### Should (M3)

- **Adapter config UI in admin webapp**（read-only；显示当前 config；改要 redeploy）—— Phase 2+ 可能开 read-write 但有 redeploy gate

### Nice-to-have (Phase 2+)

- **Adapter health check at install**：连 Postgres / S3 失败 → setup-time abort + 清晰提示（不要 deploy 后 runtime 才发现）

## §3 L4 option add / config change

### User stories

- As an **operator adding OAuth provider**（如在 username-password 之外加 GitHub OAuth），I want to **改 install profile 加 OAuth provider option config + redeploy → 现有 user 不变，可主动 link GitHub account**（per [authentication.md] AuthAdapter 4-layer L4 add），so that **加 provider 不触发 user migration**
- As an **operator changing secrets**（如轮换 OAuth client secret），I want to **改 env secret + redeploy → session 不 invalidate**（per library default refresh），so that **secret 改不破 user session**
- As an **operator changing notepage domain**, I want to **改 env DOMAIN + redeploy → cookie domain / OAuth callback URL / SEO meta 全部 sync**，so that **domain 改不破 auth / public read**

### Must (M2)

- **L4 add ≠ migration**（per [plugin-system.md] round 5 sync）：加 OAuth provider option / 改 backup retention / 加 storage S3 bucket 等都是 **config + redeploy + coexist**；不触发 export → reinstall → import workflow
- **Coexist invariant**：加 provider option 后既有 login 方式（如 username-password）保留；既有 user 不变；新 provider 是 opt-in for new user / 现有 user 可主动 link
- **Secrets rotation 路径**：admin password reset / OAuth client secret 改 / signing key 改都走 setup-time（编辑 secrets + redeploy）；具体 key rotation runbook 归 future engineering/runbooks/
- **Domain / callback URL 改**：env DOMAIN 改 → cookie domain / OAuth callback / SEO meta 全部 sync；不需手动改多处

### Should (M3)

- **Pre-deploy validation tool**：CLI 工具 `skb config validate` 在 redeploy 前 detect config 冲突；防 redeploy 后 startup 失败

### Nice-to-have (M3+)

- **Config diff preview**：redeploy 前显示 config 变化预览

## §4 SHCKB version upgrade

### User stories

- As an **operator on SHCKB v1.0 wanting to upgrade to v1.1**, I want to **拉新 image / 拉新 binary → redeploy → SHCKB 自动 schema migration → operator 验证 → ok**（typical case），so that **upgrade 是低风险常规操作**
- As an **operator with version skip (v1.0 → v1.3)**, I want to **得到清晰 upgrade path 提示**（"upgrade through v1.1 / v1.2 first" 或 "direct upgrade supported per migration matrix"），so that **不会 skip 触发 unknown 数据状态**

### Must (M2)

- **Schema migration on startup**（per [ADR-0002] + library 默认 migration tool）：startup 时 detect schema version；自动 forward migration（不 backward）
- **Migration log**：startup-time 写 migration log；operator 可见
- **Migration failure isolation**：migration 失败 → startup reject + 保留旧 schema + 清晰错误（不 partial migration）
- **Plugin migration**（per [ADR-0014]）：plugin semver + library 的 lazy migration；旧 row 自动升新 plugin version；失败 → 同 schema migration policy
- **Version skip compatibility window**：support n-2 跳级 upgrade（n-3 触发警告 + 提示 step-by-step）；具体 window 归 future versioning runbook

### Should (M3)

- **Pre-upgrade dry-run tool**：CLI `skb upgrade dry-run` 显示会 migrate 的 schema + plugin；不实际写
- **Backup before upgrade prompt**：upgrade 前提示 operator 跑 backup；admin 可 skip 但有 warning

### Nice-to-have (Phase 2+)

- **Auto-backup before upgrade**：upgrade 前 SHCKB 自动跑 backup（per [runtime.md] backup schedule）—— Phase 2+ 因为需要 backup integration

## §5 L3 replacement migration

### User stories

- As an **operator switching DB from SQLite (Solo) → Postgres (Team scale grew)**, I want to **走 export → redeploy with Postgres config → import workflow**（per [self-host-deploy.md] adapter change ladder），so that **数据完整迁移到新 DB engine**
- As an **operator switching AuthAdapter implementation**（per [authentication.md] 4-layer L3 replacement；如 Better Auth adapter → Auth.js adapter），I want to **走同 export-redeploy-import workflow**，so that **user pool 不丢；session 重 issue OK**

### Must (M4 — migration workflow Phase 2+ aspiration；M4 baseline)

- **Export tool**：`skb export --include=users,auth,notepages,blocks,sessions,blob-refs,etc.` → 输出 standardized archive（format 归 future ADR）
- **Import tool**：`skb import <archive>` → write 新 instance；schema 校验 + 兼容性 check
- **Migration runbook**：step-by-step operator 操作（归 future `engineering/runbooks/`；本 PRD mandate 存在）
- **L1 / L2 永远不换**（per [authentication.md] invariant 同源）：本 migration workflow 只 cover L3 replacement / 完整 provider model 替换；L1 / L2（SHCKB auth subsystem / AuthAdapter interface / 等）不在 migration scope

### Should (Phase 2+)

- **Partial migration**：只 migrate 部分 user / 部分 notepage
- **Cross-instance migration**：从另一 SHCKB instance import（per [project.md] "operator pool 独立" 限制：不算 federated identity；是 explicit operator-initiated copy）

### Nice-to-have (Phase 2+)

- **Bi-directional migration**：rollback to old L3 implementation（需 dual-import；rare）

## Cross-cutting setup-time invariants

| Invariant | 含义 |
|---|---|
| **All setup-time operations require redeploy** | 没有 runtime config hot reload；改 config = redeploy；统一 mental model |
| **Failure-isolated** | Setup-time 失败 → startup reject + 保留旧状态 + 清晰错误；不 partial state |
| **Operator-observable** | Setup-time 操作的 success / failure / progress 都 operator-visible（log / CLI output / setup screen）|
| **Idempotent re-run** | 同 install profile + 同 env 多次 redeploy → 结果一致；不重复 init / 不破现有 state |
| **No silent fallback** | 缺 admin credential / 缺必填 config / unknown profile → reject startup；不静默 fallback default |
| **Adapter change ladder**（per round 5）| L4 option add = config + redeploy + coexist；L3 replacement = export → redeploy → import；L1/L2 = NEVER |

## Acceptance criteria

### M2

- **§1 First-time install**：Docker compose + single-binary 都 < 10 min E2E onboarding；first-admin detect + reject startup if 漏配
- **§2 Initial adapter config**：Solo NAS default 零配置 work；Team VPS 可选 Postgres + S3
- **§3 L4 option add**：加 1 个 provider option（如新 OAuth）+ redeploy → coexist 验证；secrets 改 + redeploy → session 不破
- **§4 Upgrade**：schema migration on startup work；failure → reject startup 保旧 schema
- **§5 L3 replacement**：baseline export tool（出 archive）；import tool 接受 archive（M4 完整 verify）

### M3

- NAS / VPS templates ship
- Pre-deploy validation tool
- Migration importer 完整 verify
- Backup-before-upgrade prompt

### M4

- 5 deploy mode 跨 setup-time 全 verify
- L3 replacement migration workflow 完整（runbook + tooling）
- Workers tier 3 setup path verify（或 known constraint 文档化）

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Docker compose up 后 DB connection 失败 | Startup reject + 清晰 error + 修复提示（"check DATABASE_URL env"）|
| Install profile 漏配 admin credential | Reject startup OR force first-admin setup screen（per A5）；不静默 fallback "第一访问者成 admin" |
| Operator 改 env DOMAIN + redeploy | Cookie domain / OAuth callback / SEO meta 全 sync；现有 session 视 library policy invalidate / 保留 |
| Upgrade migration 中途失败 | Reject + 保留旧 schema + 清晰错误；operator 走 runbook recovery |
| Operator export archive 后改 schema 又 import | Import 校验 schema 兼容；不兼容 → reject import + 提示版本 mismatch |
| 漏配 storage S3 但选 S3 provider | Startup reject + 提示 "S3_BUCKET / S3_ACCESS_KEY 缺失" |
| Concurrent redeploy (rare race) | 第二个 redeploy 等第一个完成 OR reject；具体归 implementation |
| L3 replacement 中 import 失败 | Restore 到 redeploy 前 state（rollback OCI image + 旧 archive）；归 future migration runbook |

## Dependencies

- **Parent PRD**: [self-host-deploy.md](./self-host-deploy.md)
- **Sibling PRDs**: [runtime.md](./runtime.md)
- **Cross-folder PRDs**:
  - [authentication.md](../authentication/authentication.md) — install bootstrap 提供 admin credential + signing key + L4 provider option config
  - [notepage.md](../notepage/notepage.md) — URL / SSR 跨 mode 一致（cross-feature seam）
  - [theme-system.md](../theme-system/theme-system.md) — SSR theme bundling 一致
  - [plugin-system.md](../plugin-system/plugin-system.md) — plugin closed registry deploy
- **External services**: Container runtime / Optional reverse proxy / Optional SMTP / Optional S3-compat

## Open questions

1. **Migration archive format**：JSON / SQLite dump / 自定 binary？归 future migration workflow ADR
2. **Plugin migration data ownership during L3 DB engine replacement**：plugin sidecar tables（[ADR-0002] deferred）怎么 export-import；归 future ADR
3. **Workers tier 3 setup-time gap**：Workers 不支持 long-running process（migration 可能 timeout）；setup-time 在 Workers 走什么 path；归 M4 verify
4. **Auto rollback on migration failure**：当前 mandate "reject + 保旧 schema"；是否要 auto rollback OCI image 到旧 version？倾向 not auto（operator-active 决策）；归 future runbook

## Surfaced ADR debts

- **Migration archive format (new)**：归 future migration workflow ADR；含 schema version metadata / partial migration support / 跨 deploy mode 兼容
- **Install profile schema validation timing**：startup pre-check vs lazy check；归 [ADR-0018] follow-up
- **Plugin migration 跟 L3 DB replacement 协同**：plugin sidecar tables export-import semantics；归 future ADR + [ADR-0014] cross-ref
- **Versioning compatibility window**：n-2 跳级 support；具体 window definition 归 future versioning ADR

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

- **Aligning ADRs**:
  - [ADR-0001](../../../../engineering/decisions/ADR-0001-deployment-canonical-artifact.md) — Canonical OCI + 3-tier support
  - [ADR-0018](../../../../engineering/decisions/ADR-0018-install-bootstrap.md) — install profile + first admin
  - [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) — schema migration baseline
  - [ADR-0006](../../../../engineering/decisions/ADR-0006-backend-stack.md) — Drizzle multi-dialect
  - [ADR-0007](../../../../engineering/decisions/ADR-0007-storage-provider.md) / [ADR-0008](../../../../engineering/decisions/ADR-0008-search-provider.md) / [ADR-0017](../../../../engineering/decisions/ADR-0017-backup-strategy.md) — adapter abstractions
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — plugin migration
- **Parent**: [self-host-deploy.md](./self-host-deploy.md)
- **Sibling**: [runtime.md](./runtime.md)
- **Discussion record**: [auth-setup-2026-05-17.md](../../../../engineering/design/discussions/auth-setup-2026-05-17.md) Section G follow-up — adapter change ladder cross-cutting
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)

## Changelog

- 2026-05-17 initial draft (Phase E Day-1 PRD #4 sub-PRD)；setup-time = operator-active redeploy 期间；5 H2 sections (first install / initial adapter config / L4 option add / upgrade / L3 replacement migration)；6 cross-cutting setup-time invariants；M2 / M3 / M4 acceptance；surface 4 ADR debts (migration archive format / install profile validation timing / plugin migration during L3 replacement / versioning compatibility window)
