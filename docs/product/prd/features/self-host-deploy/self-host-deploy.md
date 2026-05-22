# Feature PRD: Self-host deployment (top-level)

| Field | Value |
|---|---|
| Status | draft (pass 2 — operator-lifecycle framing rewrite) |
| Last updated | 2026-05-22 |
| Owner | W_YI |
| Parent PRD | [project.md](../../project.md) |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

---

## What this PRD covers

Self-host deployment 是 SHCKB 的 **operator-facing feature folder**：定义 self-host operator 如何从 zero 到 running SHCKB instance，并在后续升级、配置、备份、监控、异常处理时维持同一套操作心智。

本 top-level PRD 锁的是 self-host-deploy 的共同产品模型：

- **3-tier operator profile**：Solo NAS / Team VPS / Public Cloud。
- **5 deploy mode**：Canonical OCI / single-binary / NAS template / VPS template / Workers tier 3。
- **Lifecycle split**：setup-time vs runtime。
- **Bootstrap security mode**：internet-exposed vs dev-local，正交于 operator profile。
- **Cross-feature seams**：authentication / notepage / theme / plugin 等 feature 如何受 self-host deploy 约束。

具体阶段细节不在本 top-level 展开：

- Operator-active 的 first install / config change / upgrade / L3 replacement 归 [setup-time.md]。
- SHCKB-autonomous 的 backup / health / logs / audit / alerting 归 [runtime.md]。

---

## Why

**为什么 self-host deployment 是产品能力，不只是打包方式**：

SHCKB 的目标 operator 包括 Solo NAS 用户、Team VPS 管理者、以及未来 Public Cloud / Workers 场景。对这些 operator 来说，"能跑起来"只是起点；产品还必须定义 first admin 安全边界、升级失败语义、备份恢复路径、运行时可观测性、以及不同部署方式之间的行为一致性。

**为什么它不是 horizontal subsystem**：

Authentication / theme / plugin 这类 subsystem 会影响每个 user request 或 render path。Self-host-deploy 不直接定义 end-user 内容体验；它定义 operator 如何部署和运营同一个 SHCKB 产品。它是 operator lifecycle feature folder，而不是横切业务能力。

**为什么坚持 standard tools 而不是 PaaS 依赖**：

SHCKB 可以兼容 Coolify / Dokploy / NAS app store / cloud platform，但不能依赖它们。M2 必须用 Docker / Podman / single-binary 等 standard tools 自洽运行。这样 Solo operator 不被某个 PaaS 绑定，Team operator 也能接入自己的 reverse proxy、monitoring、backup target。

**为什么先写两个 sub-PRD**：

Operator 的生命周期天然分两段：

- setup-time：operator 主动改变系统，通常需要 redeploy。
- runtime：SHCKB 已经 running，operator 只观察或调用 runtime entry，不改配置。

如果这两段混在一份 PRD 里，reader 会混淆 "我要 redeploy 才能改" 与 "我可以在 running instance 上查看/触发"。Top-level PRD 只锁共同模型，细节由两个 sub-PRD 承接。

---

## The whole picture

Self-host deployment 由四个正交维度组成：

```text
 self-host deployment model
 ══════════════════════════

  operator profile
      Solo NAS / Team VPS / Public Cloud
      = who runs it, at what scale, with what resource assumptions

  deploy mode
      OCI / single-binary / NAS template / VPS template / Workers
      = how the same product artifact is packaged and launched

  bootstrap mode
      internet-exposed / dev-local
      = first-admin security posture, orthogonal to profile

  lifecycle phase
      setup-time  -> operator-active, config + redeploy
      runtime     -> SHCKB-autonomous, no config mutation

  sub-PRDs
      setup-time.md = active changes
      runtime.md    = autonomous operations
```

**Core mental model**：

- Operator chooses an operator profile and deploy mode.
- Install profile / env / secrets express deploy-specific config.
- Bootstrap mode controls first-admin safety.
- First install and every later config mutation go through setup-time.
- A running instance exposes runtime signals and runtime entries.
- Same source and canonical artifact family must behave consistently across supported deploy modes.

---

## Operator-facing experience

### Choosing a Profile

Operator profile describes the operator's environment and scale, not a build target.

- **Solo NAS** should work with low-resource defaults: SQLite, local-fs, SQLite FTS5, minimal moving parts.
- **Team VPS** should support a more durable shared instance: Postgres path, local or S3-compatible storage, structured logs, runtime visibility.
- **Public Cloud** is a future-facing profile for edge/CDN/cloud constraints; Workers is supported-with-constraints and not a Day-1 parity promise.

Profile choice should help docs, defaults, and validation explain what is supported. It must not fork application behavior.

### Choosing a Deploy Mode

Deploy mode describes how the same product is launched. M2 ships two real outputs:

- Canonical OCI image / Docker compose path.
- Single-binary path built from the same source and expected to be feature-equivalent where the runtime supports it.

NAS templates and VPS templates are M3 packaging affordances around the canonical artifact. Workers is M4 supported-with-constraints, because runtime/background capability differs materially from OCI/single-binary environments.

### Choosing a Bootstrap Mode

Bootstrap mode is an install-bootstrap security mode, not an operator profile:

- **Internet-exposed bootstrap mode** requires install-profile-seeded admin credential; missing admin rejects startup.
- **Dev-local bootstrap mode** may allow first-admin setup screen with one-time setup token.

This prevents "first public visitor becomes admin" while preserving local-dev convenience.

### Living With the Instance

After first install, operator should use one lifecycle rule:

- If the operator changes config, secrets, provider options, deploy mode, app version, or underlying implementation, it is setup-time and must redeploy.
- If the operator views health/logs/audit state or triggers backup, it is runtime and does not mutate config.

This rule is the core product simplification for self-host operations.

---

## MVP — minimum shippable (M2)

M2 proves that self-host SHCKB is runnable, safe to bootstrap, observable enough to operate, and consistent across the two Day-1 artifacts.

**Top-level M2 gates**：

- **Canonical OCI + Docker compose** works for at least Solo NAS and Team VPS verified paths.
- **Single-binary** works from the same source and matches Docker compose user-observable behavior for M2 scope.
- **Self-host onboarding < 10 min**: internet-exposed bootstrap mode with profile-seeded admin login → create author → author creates markdown notepage.
- **Dev-local bootstrap path** separately verifies setup screen + one-time setup token.
- **Setup-time M2 passes** per [setup-time.md]: first install, initial adapter config validation, safe config redeploy, SHCKB upgrade warning/migration, L3 replacement future marker.
- **Runtime M2 passes** per [runtime.md]: backup artifact contract, manual backup trigger, `/health`, structured stdout logs, audit baseline.
- **No runtime config hot reload**: config mutation always goes through setup-time redeploy.
- **No custom build per deploy mode**: deploy modes use same source and canonical artifact family; differences are install profile / env / launch wrapper.
- **No PaaS dependency**: standard tools path works without Coolify / Dokploy / proprietary platform.

---

## Progressive completeness (M3 → M4)

### M3 — Deploy Breadth + Operator Visibility

- **NAS-specific template**: at least one NAS family verified, likely Synology first unless owner changes priority.
- **Self-managed VPS template**: reverse proxy + TLS template; Caddy preferred unless implementation constraints change.
- **Pre-deploy validation**: config validation before redeploy, reducing startup-time failure surprises.
- **Runtime visibility**: metrics endpoint, audit trail webapp view, anomaly alert baseline.
- **Pre-upgrade backup integration**: backup-now shortcut + archive validation / dry-run; canonical restore smoke follows runtime M4.
- **Second operator self-host trial**: another operator can deploy by following docs without private context.

### M4 — Production Polish + Deploy-Mode Verification

- **Cloudflare Workers tier 3 verify**: known runtime constraints documented; unsupported features fail clearly.
- **5 deploy mode full verify**: Docker compose / single-binary / NAS template / VPS template / Workers tier 3 each run their relevant acceptance path.
- **Canonical local restore smoke** per [runtime.md]: proves the minimal restore path on canonical local profile; cross-deploy restore remains Phase 2+.
- **Operator runbook baseline**: key rotation / DR / scaling / recovery procedures exist at the engineering/runbook layer.

---

## Done — final horizon (Phase 2+)

- **Cross-deploy restore**: restore across deploy modes, such as Docker compose backup to single-binary or NAS/VPS target.
- **Plugin marketplace deploy mechanism**: third-party plugin discovery / installation / upgrade path.
- **K8s / enterprise orchestration**: only if owner later overrides current non-goal.
- **Multi-region / active-active deployment**: out of M2-M4; enterprise/on-call stack territory.
- **Cross-instance data migration**: explicit copy/import between SHCKB instances, not federation.

---

## Reference

### Operator Profiles

| Profile | 部署环境 | 用户数 | 性能瓶颈 | 推荐 deploy mode | 推荐 DB / storage / search |
|---|---|---|---|---|---|
| **Solo NAS** | NAS (Synology/QNAP/TrueNAS/Unraid) / RPi / 低配 VPS | 1-5 | RAM / CPU 吃紧；要节能 | Docker compose / single-binary | SQLite / local-fs / SQLite FTS5 |
| **Team VPS** | VPS (Tencent/Aliyun/AWS Lightsail/Hetzner) / 内部服务器 | 100-2000 | Concurrent WS / 全文搜索 / 备份 | Docker compose | Postgres / local-fs 或 S3-compatible / Postgres tsvector |
| **Public Cloud** | Cloud platform / 自建 VPS 集群 / CDN / Workers | 10k-100k | Edge cache / 横向 scale / 防 DDoS / 媒体 CDN | Docker compose / Workers tier 3 | Postgres / S3-compatible + CDN / Postgres tsvector 或 external search |

### Deploy Modes

| Mode | Support tier | M-stage | 适用 / verification scope | Notes |
|---|---|---|---|---|
| **Canonical OCI image** (Docker compose) | Canonical (tier 1) | M2 | Targets all 3 profiles; M2 verifies Solo NAS + Team VPS | Default release artifact |
| **Single-binary (Bun)** | Full-parity secondary (tier 2) | M2 | M2 verifies Solo NAS + Team VPS | Same source; no separate behavior fork |
| **NAS-specific templates** | Canonical OCI variant | M3 | Solo NAS | Packaging / docs wrapper around canonical path |
| **Self-managed VPS templates** | Canonical OCI variant | M3 | Team VPS / Public Cloud | Reverse proxy / TLS / service template |
| **Cloudflare Workers** | Supported-with-constraints (tier 3) | M4 | Public Cloud subset | Runtime constraints documented; not parity by default |

### Bootstrap Modes

| Bootstrap mode | Missing admin credential behavior | Scope |
|---|---|---|
| **Internet-exposed bootstrap mode** | Reject startup | Default for public / production-facing deploys |
| **Dev-local bootstrap mode** | First-admin setup screen allowed with one-time setup token | Local/dev convenience path |

### Cross-Cutting Invariants

| Invariant | 含义 |
|---|---|
| **Canonical artifact family** | Same source and canonical artifact family across deploy modes; no custom source fork per mode |
| **Operator vs end-user boundary** | Operator config = install profile / env / secrets; admin/user roles live inside webapp and cannot mutate operator config |
| **Setup-time / runtime split** | Operator-active changes require redeploy; SHCKB-autonomous operations do not mutate config |
| **Bootstrap mode is orthogonal** | Internet-exposed/dev-local mode is a security posture, not a fourth operator profile |
| **Adapter change ladder** | L4 option add = config + redeploy + coexist; L3 replacement = export → redeploy → import; L1/L2 = never |
| **Self-host onboarding < 10 min** | M2 canonical path must reach profile-seeded admin login → author → markdown notepage within 10 minutes |
| **Secrets management baseline** | Signing key / admin credential / provider secrets are never baked into image |
| **No PaaS dependency** | SHCKB may be compatible with self-host PaaS tools but must not require them |
| **Runtime signals exposed, stack chosen by operator** | SHCKB exposes health/log/audit/metrics/alert signals; operator chooses Prometheus/Grafana/Loki/ELK/etc. |

### Sub-PRDs

| Sub-PRD | Audience trigger | Scope |
|---|---|---|
| [setup-time.md](./setup-time.md) | Operator-active changes | First install / initial adapter config / config change / SHCKB upgrade / L3 replacement marker |
| [runtime.md](./runtime.md) | SHCKB-autonomous running instance | Backup / manual backup / health / logs / audit / metrics / alerting / restore milestone |

### Cross-Feature Seams

| Adjacent feature | Self-host-deploy 跟它的接触面 |
|---|---|
| [authentication.md](../authentication/authentication.md) | Install bootstrap admin credential / signing key / provider config；first-admin safety must align with bootstrap mode |
| [identity.md](../authentication/identity.md) | Auth-domain audit vocabulary and first-admin behavior |
| [notepage.md](../notepage/notepage.md) | URL / SSR / SEO behavior must stay stable across deploy modes |
| [theme-system.md](../theme-system/theme-system.md) | SSR theme CSS / asset path must not fork by deploy mode |
| [plugin-system.md](../plugin-system/plugin-system.md) | Closed registry Day-1 ships with app artifact; future marketplace requires deploy mechanism extension |
| [ai-integration](../ai-integration/README.md)（Phase 2+） | Agent / MCP wire path and API secrets must follow same operator config / secrets boundary |
| [discussion](../discussion/README.md)（Phase 2+） | Discussion data schema must not depend on deploy mode |

### Non-Goals

- ❌ **Runtime config hot reload** —— 想改 config = setup-time redeploy。
- ❌ **K8s / enterprise orchestration / multi-region active-active** —— current [project.md] non-goal until owner override。
- ❌ **PaaS dependency** —— Coolify / Dokploy compatibility OK; dependency not OK。
- ❌ **Custom source fork per deploy mode** —— deploy mode cannot change product behavior by forking code。
- ❌ **Plugin marketplace deploy** —— Phase 2+。
- ❌ **Cross-SHCKB federation / sync** —— explicit import/copy may exist later; federation is not M2-M4。
- ❌ **Library-internal implementation decisions** —— DB driver / auth library internals / monitoring stack specifics belong to ADR/library/runbook layers。

### Dependencies

PRD 层 upstream 依赖：

- **Parent PRD**: [project.md](../../project.md)
- **Sibling PRDs**: [setup-time.md](./setup-time.md) / [runtime.md](./runtime.md)
- **Cross-folder PRDs**:
  - [authentication.md](../authentication/authentication.md)
  - [identity.md](../authentication/identity.md)
  - [notepage.md](../notepage/notepage.md)
  - [theme-system.md](../theme-system/theme-system.md)
  - [plugin-system.md](../plugin-system/plugin-system.md)
- **External services**:
  - Container runtime (Docker / Podman)
  - Optional reverse proxy / TLS automation
  - Optional SMTP
  - Optional S3-compatible storage / backup target
  - Optional metrics / logging / alerting stack chosen by operator

### Open Questions

1. **NAS-specific template priority**：M3 先 Synology / TrueNAS / Unraid 哪个？倾向 Synology first。
2. **VPS reverse proxy default**：Caddy / nginx / Traefik？倾向 Caddy for automatic TLS。
3. **Single-binary distribution**：GitHub Releases / registry-attached artifact / mirror？归 [ADR-0001] follow-up。
4. **Workers runtime constraints**：backup schedule / background jobs / migration path 怎么表达；归 [runtime.md] M4 constraint POC。
5. **Cross-deploy restore**：Docker compose backup restore 到 single-binary/NAS/VPS/Workers 的 compatibility；not M2；follows [runtime.md] Phase 2+ restore scope。

### Surfaced ADR Debts

- **[ADR-0001] deploy mode tier vs M-stage**：M2 Canonical OCI + single-binary；M3 NAS/VPS templates；M4 Workers tier 3 constraints。
- **[ADR-0018] install profile mapping**：5 install profiles vs 3 operator profiles vs bootstrap mode orthogonality must be explicit。
- **[ADR-0006] backend stack deploy-mode compatibility**：Bun + Hono + Drizzle + Workers constraint POC。
- **[ADR-0017] backup/restore artifact semantics**：runtime backup artifact contract, validation, canonical restore smoke, cross-deploy restore future scope。
- **Migration workflow cross-subsystem ADR (new)**：auth / DB / storage / search / backup L3 replacement share export → redeploy → import shape。
- **Operator runbook ownership**：key rotation / DR / scaling / restore procedure belongs in future `engineering/runbooks/`。
- **No-PaaS-dependency enforcement**：templates can be compatible with PaaS tools without making them dependencies。

详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) PRD-surfaced debts log。

### References

- **Aligning ADRs**（pending PRD-driven rework；详顶部 disclaimer）:
  - [ADR-0001](../../../../engineering/decisions/ADR-0001-deployment-canonical-artifact.md) — Canonical OCI artifact + 3-tier support model
  - [ADR-0006](../../../../engineering/decisions/ADR-0006-backend-stack.md) — Bun + Hono + Drizzle backend stack
  - [ADR-0007](../../../../engineering/decisions/ADR-0007-storage-provider.md) — StorageProvider abstraction
  - [ADR-0008](../../../../engineering/decisions/ADR-0008-search-provider.md) — SearchProvider abstraction
  - [ADR-0010](../../../../engineering/decisions/ADR-0010-performance-budget.md) — backend SLO + runtime visibility
  - [ADR-0017](../../../../engineering/decisions/ADR-0017-backup-strategy.md) — BackupProvider + retention/GC
  - [ADR-0018](../../../../engineering/decisions/ADR-0018-install-bootstrap.md) — install profile + first admin bootstrap
  - [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) — DB schema 跨 deploy mode 兼容
- **Parent**: [project.md](../../project.md)
- **Sibling**: [setup-time.md](./setup-time.md) / [runtime.md](./runtime.md)
- **Cross-folder**: [authentication.md](../authentication/authentication.md) / [identity.md](../authentication/identity.md) / [notepage.md](../notepage/notepage.md) / [theme-system.md](../theme-system/theme-system.md) / [plugin-system.md](../plugin-system/plugin-system.md)
- **Discussion records**:
  - [auth-setup-2026-05-17.md](../../../../engineering/design/discussions/auth-setup-2026-05-17.md)
  - [self-host-setup-time-2026-05-21.md](../../../../engineering/design/discussions/self-host-setup-time-2026-05-21.md)
  - [self-host-runtime-2026-05-22.md](../../../../engineering/design/discussions/self-host-runtime-2026-05-22.md)
  - [self-host-deploy-2026-05-22.md](../../../../engineering/design/discussions/self-host-deploy-2026-05-22.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc cross-reference convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)
- **PRD form**: [prd-discipline.md](../../../../process/methods/prd-discipline.md) — operator-lifecycle PRD form

### Changelog

- 2026-05-17 initial draft (Phase E Day-1 PRD #4)；framing 为 operator-facing feature folder；setup-time vs runtime 时间维度二分；2 sub-PRDs；3-tier operator profile + 5 deploy mode；M2 = Canonical OCI + single-binary；M3 = NAS/VPS templates；M4 = Workers tier 3 verify。
- 2026-05-21 setup-time sync cleanup：first-admin detection 按 internet-exposed / dev-local bootstrap mode 明确；`<10 min` onboarding 改为 profile-seeded admin login canonical path；dev-local setup screen 作为便利路径；References 增加 setup-time discussion record。
- 2026-05-22 runtime restore milestone sync：backup/restore cross-deploy open question 明确不是 M2；restore milestone follows [runtime.md]（M3 validation/dry-run；M4 canonical local smoke；Phase 2+ cross-deploy restore）。
- 2026-05-22 pass 2 — operator-lifecycle framing rewrite：改为 What / Why / Whole picture / Operator-facing experience / MVP / Progressive / Done / Reference；top-level 只锁共同模型，setup-time/runtime 细节归 sub-PRD；新增 bootstrap mode 正交维度、runtime signals stack-choice invariant、restore M-stage summary。
