# Feature PRD: Self-host deployment (top-level)

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-18 |
| Owner | W_YI |
| Parent PRD | [project.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

## Overview

**Self-host deployment** 是 SHCKB 的 **operator-facing feature folder**——定义 operator 从 zero 到 running SHCKB instance 的完整生命周期。**Audience = operator**（self-host party），跟其他 feature PRD（notepage / theme-system / plugin-system 的 end-user 或 extension author audience）不同。

**跟 horizontal subsystem 的关键区别**：
- Horizontal subsystem (auth / theme / plugin) 影响每个 user request / render / extension
- Self-host-deploy **不**是 cross-feature horizontal subsystem；是 operator deployment / lifecycle 的产品定义

**关键 framing 二分（per 2026-05-17 owner ratify）**：Self-host operator 的活动按时间维度切两段——**setup-time vs run-time**：

| 维度 | Setup-time | Run-time |
|---|---|---|
| **Operator 角色** | active；几乎都要 redeploy | passive；SHCKB-autonomous |
| **触发事件** | First install / config change / option add / upgrade / L3 replacement | 24/7 self-running |
| **典型操作** | redeploy / migration / secrets change | backup schedule / health check / log / monitoring |
| **Sub-PRD** | [setup-time.md] | [runtime.md] |

本 PRD top 锁的是 **self-host-deploy 整体 framing + 3-tier operator profile + 5 deploy mode + cross-cutting invariants + cross-feature seams + sub-PRD 索引**。具体阶段细节归各 sub-PRD。

## Scope

### 本 PRD 子系统负责（SHCKB-own）

- **3-tier operator profile coverage**（Solo NAS / Team VPS / Public Cloud；per [project.md]）
- **5 deploy mode** 的 user-observable behavior 一致（per [ADR-0001]）
- **Canonical OCI image cross-mode consistency**（同 image + diff config；不为每 mode 分叉 build）
- **Operator vs end-user 边界** invariants（跟 [authentication.md] invariant 6 同源）
- **Setup-time vs Run-time 时间维度分层**（per 2026-05-17 framing）
- **Cross-feature seams**：跟 authentication / notepage / theme-system / plugin-system 协同
- **Build vs Buy = Build SHCKB own + standard tools**（Docker / systemd / wrangler；不依赖 PaaS 如 Coolify / Dokploy）

### 本 PRD 子系统不负责（边界另一边谁负责）

| 不负责 | 归 | 类型 |
|---|---|---|
| AuthAdapter implementation 细节 / library 内部 token | [authentication.md] + future auth library selection ADR | feature + ADR |
| Notepage URL / SSR / SEO behavior | [notepage.md] | feature PRD |
| Theme SSR bundling / asset path | [theme-system.md] | feature PRD |
| Plugin lifecycle / register / version | [plugin-system.md] | feature PRD |
| Library 内部决策（DB driver / search engine / etc.）| [ADR-0006] / [ADR-0008] / library | library / ADR |
| Runbook step-by-step（key rotation / DR / scaling 具体操作）| future `engineering/runbooks/` | runbook |
| K8s / enterprise orchestration | per [project.md] non-goal | out-of-scope |
| Plugin marketplace / 第三方 plugin discovery | per [project.md] Phase 2+ | future |
| Real-time collaborative editing | per [project.md] non-goal | out-of-scope |
| Multi-region / 跨地域 deploy | per [project.md] non-goal "enterprise on-call 栈" | out-of-scope |

## 3-tier Operator Profile

复用 [project.md] target operators 表，加 deploy mode + adapter 推荐：

| Profile | 部署环境 | 用户数 | 性能瓶颈 | 推荐 deploy mode | 推荐 DB / storage / search |
|---|---|---|---|---|---|
| **Solo NAS** | NAS (Synology/QNAP/TrueNAS/Unraid) / RPi / 低配 VPS | 1-5 | RAM / CPU 吃紧；要节能 | Docker compose / single-binary | SQLite / local-fs / SQLite FTS5 |
| **Team VPS** | VPS (Tencent/Aliyun/AWS Lightsail/Hetzner) / 内部服务器 / 轻量 K8s | 100-2000 | Concurrent WS / 全文搜索 / 备份 | Docker compose | Postgres / local-fs 或 S3-compat / Postgres tsvector |
| **Public Cloud** | Cloud platform (Fly/Render/Vercel/Cloudflare) / 自建 VPS 集群 / CDN | 10k-100k | Edge cache / 横向 scale / 防 DDoS / 媒体 CDN | Docker compose / Workers tier 3 | Postgres / S3-compat + CDN / Postgres tsvector 或 Meilisearch |

## 5 Deploy Modes (per [ADR-0001])

| Mode | Support tier | M-stage | 适用 profile |
|---|---|---|---|
| **Canonical OCI image** (Docker compose) | Canonical (tier 1) | **M2** | 全部 3 tier |
| **Single-binary (Bun)** | Full-parity secondary (tier 2) | **M2** | Solo NAS / Team VPS |
| **NAS-specific templates** (Synology / TrueNAS / Unraid) | Canonical OCI variant | M3 | Solo NAS |
| **Self-managed VPS** (Coolify / Dokploy 兼容；非依赖) | Canonical OCI variant | M3 | Team VPS / Public Cloud |
| **Cloudflare Workers** | Supported-with-constraints (tier 3) | M4 | Public Cloud (subset features) |

## Cross-cutting invariants

| Invariant | 含义 |
|---|---|
| **Canonical OCI image cross-mode consistency** | 同 OCI image 跨 5 deploy mode；不为某 mode 分叉 build；配置差异通过 env / install profile 表达（per [ADR-0001]） |
| **Operator vs end-user 边界** | Operator config = OS-level（install profile / env / config file per [ADR-0018]）；user-role = webapp-level；二者不互通；admin 不可改 operator config（跟 [authentication.md] invariant 6 同源） |
| **Setup-time / Run-time 时间分层** | Operator-active 改动归 setup-time（必须 redeploy）；SHCKB-autonomous 运营归 run-time；中间没有"运行时热改 config"的灰色地带（per 2026-05-17 framing） |
| **Adapter change ladder**（per round 5 sync） | L4 option add/enable = config + redeploy + coexist；L3 replacement = export → redeploy → import migration workflow；L1/L2 = NEVER（跟 [authentication.md] 4-layer abstraction + [plugin-system.md] 切换机制 sharpen 协同） |
| **Self-host onboarding < 10 min**（M2 mandate） | Docker compose `docker compose up -d` → 浏览器访问 → first-admin setup → 创建 author → 创建 notepage 端到端 < 10 min；per [project.md] success criterion |
| **Secrets management baseline** | Signing key / admin credential / OAuth client secret 不进 image；走 secrets file / env / vault path（具体 carrier 归 [ADR-0018] / future operator runbook）|
| **Migration workflow contract**（跨 horizontal subsystem 统一） | L3 replacement 走 3-步：export users/auth/notepage/etc. → redeploy with new L3 implementation/config → import/migrate；跨 auth / DB / storage / search / backup adapter 统一 pattern |
| **Per-tier 资源 baseline** | Solo NAS：SQLite + local-fs default；不强制 Postgres；不默认启用 heavy plugins。Team VPS：可选 Postgres。Public Cloud：推荐 Postgres + S3 + CDN |
| **Operator 不主动改 runtime config** | Run-time 没有 "config hot reload"；想改 config = setup-time redeploy；这条简化 SHCKB internal state management |
| **First admin detection invariant**（跟 [authentication.md] A5 同源） | Install profile 漏配 admin credential → startup reject 或 force first-admin setup screen；不静默 fallback |
| **No PaaS dependency** | SHCKB 用 Docker / systemd / wrangler 等 standard tools；不依赖 Coolify / Dokploy / 等 self-host PaaS（兼容但不依赖） |
| **5 deploy mode = same canonical artifact + diff config** | 不为某 mode 分叉 binary；Single-binary build 是 OCI image 的 secondary artifact，不是独立 source（per [ADR-0001]）|

## Sub-PRDs

| Sub-PRD | Audience trigger | Scope |
|---|---|---|
| [setup-time.md](./setup-time.md) | Operator-active redeploy 任意时刻 | First install / initial adapter config / L4 option add / SHCKB version upgrade / L3 replacement migration |
| [runtime.md](./runtime.md) | SHCKB-autonomous 运营期间 | Automated backup schedule / health check / monitoring baseline / log access / anomaly detection |

## Cross-feature seams

| Adjacent feature | Self-host-deploy 跟它的接触面 |
|---|---|
| [authentication.md] | Install bootstrap 提供 admin credential + signing key path + L4 provider option config（per [ADR-0018]）；first admin detection + reject startup 跟 auth invariant 协同 |
| [notepage.md] | URL `/notes/:slug` 跨 5 deploy mode 稳定；SEO / SSR HTML 一致；private notepage redirect path 跨 mode 一致 |
| [theme-system.md] | SSR theme CSS bundling 跨 mode 一致；asset path 不分叉；theme switching 跨 mode UX 同 |
| [plugin-system.md] | Closed registry Day-1：plugin code 跟 OCI image 一起 ship；future open registry / marketplace Phase 2+ 需 deploy mechanism extension（per discussion record Section G runtime extension catalog variant） |
| [ai-integration/]（Phase 2+） | Agent / MCP wire path 跨 deploy mode 一致；secrets / API key 走 same secrets baseline |
| [discussion/]（Phase 2+） | Sidecar plugin pattern；deploy mode 不影响 discussion 数据 schema |

## Acceptance criteria (top-level；具体阶段 acceptance 见各 sub-PRD)

### M2 — minimum shippable

- **Canonical OCI image + Docker compose** work 跨 3-tier profile（至少 Solo NAS + Team VPS 二者验证）
- **Single-binary (Bun)** work（M2 ship；Workers tier 3 移 M4）
- **Self-host onboarding < 10 min** E2E（Docker compose → first admin login → markdown notepage）
- **Setup-time / Run-time 分层 work**：操作分别在两 entry 触发；不混淆
- **Canonical OCI cross-mode consistency**：Docker compose / single-binary 跑同一份 source；不分叉

### M3 — deploy mode breadth

- **NAS-specific templates** ship（Synology / TrueNAS / Unraid 至少一个 verify）
- **Self-managed VPS templates** ship（含 systemd unit / nginx reverse proxy template）
- **第二 operator** 能按文档自部署到他的 NAS / VPS（per [project.md] M4 success criterion 提前到 M3 verify）

### M4 — production polish

- **Cloudflare Workers tier 3** verify（如 library 不支持 → 文档化为 known constraint；不静默失败；per [authentication.md] M4 constraint POC gate）
- **5 deploy mode 全 verify**
- **Operator runbook baseline** ship（key rotation / DR / scaling；归 future `engineering/runbooks/`，本 PRD mandate 存在）

### Phase 2+

- K8s / 复杂 cloud orchestration（如 owner 拍 enable；当前 [project.md] non-goal）
- Plugin marketplace deploy mechanism
- Multi-region / 跨地域 deploy

## Non-goals

- ❌ **K8s / enterprise orchestration / 多 region** —— per [project.md] non-goal
- ❌ **PaaS 强依赖**（Coolify / Dokploy 等）—— 兼容但不依赖
- ❌ **运行时 config hot reload** —— 想改 config = redeploy；简化 internal state mgmt
- ❌ **Plugin marketplace deploy** —— Phase 2+
- ❌ **跨 SHCKB instance 数据 federation / sync** —— per [project.md] "operator pool 独立"
- ❌ **Multi-region active-active** —— Phase 2+
- ❌ **Custom binary per deploy mode** —— canonical OCI cross-mode consistency invariant
- ❌ **Library 内部决策** —— 归 library + future ADRs

## Dependencies

PRD 层 upstream 依赖（ADRs 是 downstream，归 References 段）：

- **Parent PRD**: [project.md](../../project.md)
- **Sibling PRDs (intra-folder)**:
  - [setup-time.md](./setup-time.md)
  - [runtime.md](./runtime.md)
- **Cross-folder PRDs（self-host-deploy 跟其他 feature 协同）**:
  - [authentication.md](../authentication/authentication.md) — install bootstrap admin / signing key / L4 provider option config
  - [notepage.md](../notepage/notepage.md) — URL / SSR / SEO 跨 mode 一致
  - [theme-system.md](../theme-system/theme-system.md) — SSR theme bundling 跨 mode 一致
  - [plugin-system.md](../plugin-system/plugin-system.md) — plugin closed registry deploy；future open registry deploy mechanism
- **External services**:
  - Container runtime (Docker / Podman) for Canonical OCI mode
  - Optional reverse proxy (nginx / Caddy) for production
  - Optional Cloudflare Workers for tier 3 mode

## Open questions

1. **NAS-specific template 优先级**：M3 ship 哪个 NAS 平台？（Synology DSM Docker / TrueNAS apps / Unraid Community Apps）—— 倾向 Synology 先（用户群最大）；归 owner decision
2. **VPS template 推荐 reverse proxy**：nginx / Caddy / Traefik？倾向 Caddy（自动 TLS；简单）；归 implementation phase
3. **Single-binary build artifact 怎么 ship**：GitHub Releases / 自建 mirror / 兼容容器 image registry？归 [ADR-0001] follow-up
4. **Workers tier 3 features 降级文档**：哪些 feature 在 Workers runtime 不可用 → user 看到 clear constraint；归 M4 verify gate
5. **Backup / restore 跨 deploy mode 一致性**：Docker compose backup 出来的 archive 能 restore 到 single-binary instance 吗？倾向 yes（同 schema + same canonical image）；归 setup-time + runtime sub-PRDs verify

## Surfaced ADR debts

本 PRD 触发的 ADR 层 framing 问题（reframe round 2 candidates，等本批 PRD 全完成后做 ADR round）：

- **[ADR-0001] deploy mode tier 跟 M-stage align verify**：M2 ship Canonical + single-binary；M3 加 NAS / VPS templates；M4 Workers tier 3 verify；ADR 应 align 此 M-stage 分配
- **[ADR-0018] install profile 5 profile 跟 3-tier operator profile 映射 verify**：install profile 5 个（Solo Docker / Solo binary / Team Docker / Public Docker / Public Workers）跟 operator profile 3 tier 是否 1-to-many / many-to-1 mapping；需 ADR-0018 显式
- **[ADR-0006] backend stack 跟 5 deploy mode 兼容 verify**：Bun + Hono + Drizzle 跟 Workers tier 3 实际兼容（per [authentication.md] constraint POC gate cross-ref）
- **Operator runbook 归属**：key rotation / DR / scaling 具体 step 归 future `engineering/runbooks/`；本 PRD mandate 存在但不展开；归 future engineering layer
- **Migration workflow 跨 subsystem 统一 contract**（cross-cutting；per discussion record Section G follow-up）：auth / storage / search / backup / DB 都有 L3 replacement migration；具体 contract（export format / import 校验 / partial migration）归 future migration workflow ADR
- **No-PaaS-dependency 怎么 enforce**：本 PRD mandate 不依赖 Coolify / Dokploy；但 deploy templates 兼容它们；boundary 怎么写进 acceptance；归 implementation phase

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，**必须 align 本 PRD**。

- **Aligning ADRs**:
  - [ADR-0001](../../../../engineering/decisions/ADR-0001-deployment-canonical-artifact.md) — Canonical OCI artifact + 3-tier support model
  - [ADR-0006](../../../../engineering/decisions/ADR-0006-backend-stack.md) — Bun + Hono + Drizzle backend stack
  - [ADR-0007](../../../../engineering/decisions/ADR-0007-storage-provider.md) — StorageProvider abstraction
  - [ADR-0008](../../../../engineering/decisions/ADR-0008-search-provider.md) — SearchProvider abstraction
  - [ADR-0010](../../../../engineering/decisions/ADR-0010-performance-budget.md) — Lighthouse 90 + backend SLO
  - [ADR-0017](../../../../engineering/decisions/ADR-0017-backup-strategy.md) — BackupProvider + retention/GC
  - [ADR-0018](../../../../engineering/decisions/ADR-0018-install-bootstrap.md) — install profile + first admin bootstrap
  - [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) — DB schema 跨 deploy mode 兼容
- **Parent PRD**: [project.md](../../project.md)
- **Sibling PRDs**: [setup-time.md](./setup-time.md) / [runtime.md](./runtime.md)
- **Cross-folder PRDs**: [authentication.md](../authentication/authentication.md) / [notepage.md](../notepage/notepage.md) / [theme-system.md](../theme-system/theme-system.md) / [plugin-system.md](../plugin-system/plugin-system.md)
- **Discussion record**: [auth-setup-2026-05-17.md](../../../../engineering/design/discussions/auth-setup-2026-05-17.md) Section G "Cross-subsystem modular pattern symmetry"（adapter change ladder cross-cutting reference）
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc cross-reference convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-17 initial draft (Phase E Day-1 PRD #4)；framing 为 **operator-facing feature folder**（vs end-user feature / horizontal subsystem）；按 owner 2026-05-17 拍板 **setup-time vs run-time 时间维度二分**（per discussion 候选 Y）；2 sub-PRDs（[setup-time.md] / [runtime.md]）；12 cross-cutting invariants 含 canonical OCI cross-mode / operator-vs-user 边界 / setup-runtime 分层 / adapter change ladder（per round 5 sync）/ secrets baseline / migration workflow / per-tier resource baseline / no-PaaS-dependency / 5 mode = same artifact + diff config；3-tier operator profile + 5 deploy mode 表展开；M2 = Canonical OCI + single-binary；M3 = NAS / VPS templates；M4 = Workers tier 3 verify + 5 mode 全 verify；surface ADR debts (deploy mode M-stage align / install profile 5 vs 3-tier mapping / backend stack + Workers verify / runbook 归属 / migration workflow contract / no-PaaS enforce)
