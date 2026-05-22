# Feature PRD: Self-host deployment — runtime

| Field | Value |
|---|---|
| Status | draft (pass 2 — operator-lifecycle narrative rewrite) |
| Last updated | 2026-05-22 |
| Owner | W_YI |
| Parent PRD | [self-host-deploy.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

---

## What this PRD covers

Self-host operator 把 SHCKB 部署起来以后，实例在 **SHCKB-autonomous** 状态下持续运行时的 operator-visible 行为。

**Runtime 的核心边界**：SHCKB 已经 running；operator 不主动改 install profile / env / config，不 redeploy。SHCKB 自己做 backup schedule / health check / log / audit / monitoring / anomaly detection。Operator 可以触发 backup、查看 log、查看 health；这些都是 **runtime entry**：调用已有入口，不改变配置，不触发 redeploy。Restore 属 runtime domain，但 **M2 不 ship verified restore endpoint / UI / acceptance gate**，只保留 future runbook boundary。

**不在本 PRD**：first install / config change / SHCKB upgrade / L3 replacement migration / backup schedule config 修改。这些都是 operator-active、需要 redeploy 的 setup-time 操作，归 [setup-time.md]。

---

## Why

**为什么 runtime 要和 setup-time 分开**：

Self-host operator 的运行心智分两种状态。Setup-time 是 operator 主动改变系统：改配置、升级、替换底层组件，必须 redeploy。Runtime 是 SHCKB 已经处于服务状态，operator 不应持续照看它。把两者分开，operator 才知道什么时候需要主动介入，什么时候只需要看状态和响应异常。

**为什么 runtime 要自治**：

Solo NAS / Team VPS operator 不应该自己写 cron、grep 深层日志、猜 backup 是否成功。SHCKB 必须提供最低限度的自运维能力：定期 backup、可被探活、结构化日志、关键 audit event、基础异常信号。

**为什么 runtime entry 不等于 config change**：

Operator 点击 "backup now"、看 `/health`、读取 stdout log，都是调用当前实例的运行入口。它们不能改变 install profile，也不能让一部分组件热加载新配置。改 backup retention / alert webhook / metrics auth 这类配置仍属于 setup-time：改配置 + redeploy。

---

## The whole picture

Runtime 是 setup-time 之间的稳定运行区间。一个 SHCKB instance 从 first install 进入 running 后，主要循环如下：

```text
 running SHCKB instance
 ══════════════════════

  schedule ──► backup job ──► retention / GC ──► backup status
      │              │
      │              └──► audit event + structured log
      │
      ├────► health check endpoint ──► operator / load balancer / monitor
      │
      ├────► stdout JSON logs ───────► docker logs / log driver / aggregator
      │
      ├────► audit events ───────────► security trace / admin inspection
      │
      └────► anomaly detector ───────► log / webhook / email alert (M3+)

  operator-triggered runtime entries:
      backup now / view health / view stdout logs
      = runtime entry, no redeploy

  future runtime-domain entries:
      archive validation / dry-run         M3
      canonical local restore smoke        M4
      cross-deploy restore                 Phase 2+

  operator-active changes:
      change retention / alert target / metrics auth / backup provider
      = setup-time, config + redeploy
```

**Runtime 4 类能力**：

- **Backup**：自动 schedule + retention / GC + manual backup trigger。
- **Health / monitoring**：实例健康状态；M3+ metrics。
- **Log / audit**：stdout structured logs + security-relevant audit events。
- **Anomaly / alerting**：连续失败、关键依赖不可达等异常被 operator 看见；M3+。

---

## User-facing experience

### R1 Automated Backup

Operator 在 setup-time 选择 backup target 和 retention policy。SHCKB 运行后按 schedule 自动备份，并在每次备份后更新 status、写 audit event、执行 retention / GC。

M2 baseline 是 local backup path + daily schedule + manual backup trigger。S3-compatible backup target 可以作为 optional smoke, not release gate，除非后续明确 promote 到 M2 release gate。

**M2 backup success contract**：backup status 只有在完整 backup artifact 写完后才能标 `success`。M2 不锁具体 archive format，但一个有效 local backup 至少要包含 manifest、app/schema version metadata、DB snapshot / dump、blob/storage inclusion policy、checksum 或等价 complete marker。Partial archive 必须标 invalid，不得进入 retention pool 作为有效 backup。

Operator 需要看到：

- last backup time / status；
- 最近 archive list 或可定位 archive ID；
- backup 失败原因；
- retention / GC 是否执行；
- manual backup trigger 的 status。

### R2 Manual Backup / Restore Boundary

Operator 可以在运行期间触发 on-demand backup，例如升级前先备份。这个能力归 runtime M2。

Setup-time M2 upgrade flow 只要求显示 manual backup warning + runbook pointer，指向 runtime manual backup path；不要求一键 pre-upgrade backup UX。M3 可以把 upgrade flow 和 backup-now shortcut / archive validation / dry-run 集成起来。

Restore 是 runtime-domain concept，但 **M2 = backup-only verified path**。M2 不要求 verified restore endpoint、restore UI、restore acceptance gate，也不要求完整 DR runbook。M3 只做 backup artifact validation / dry-run，不承诺真正写入恢复；M4 做 canonical local restore smoke；cross-deploy restore 和完整 human recovery runbook 留 Phase 2+ / future `engineering/runbooks/`。

### R3 Health Check / Monitoring

Operator、load balancer 或 monitoring tool 可以读取实例健康状态。M2 必须有低成本 health check，反映 DB / storage / search / backup / auth 初始化等关键 subsystem 的 reachability。

Health check 必须满足：

- anonymous-friendly，不要求 browser session；
- 不泄露 secrets / PII；
- 足够便宜，不对 Solo NAS 造成明显负担；
- 区分 `ok` / `degraded` / `down`。

**M2 health minimum contract**：`/health` 返回小型 JSON object，至少包含 top-level `status`、`checked_at`、以及 DB / storage / search / backup / auth 的 per-subsystem reachability。Probe 必须 bounded and cheap；response 不得包含 secrets、PII、connection string、raw provider error。

M3+ 增加 metrics endpoint，提供 request count / error rate / latency 等基础 counters，给 Team VPS operator 接入 Prometheus / OpenMetrics 类工具。

### R4 Logs / Audit

SHCKB runtime log 默认走 stdout，适配 Docker / Podman / single-binary 的标准运维方式。Operator 不需要修改配置才能看到基础 log。**M2 log access = structured stdout readable through Docker/Podman logs or single-binary stdout**；M2 不要求 web log viewer、log export endpoint、live tail UI。

Auth-domain audit event names follow [identity.md](../authentication/identity.md)；runtime owns that these events are emitted and observable through structured logs in M2。M2 必须 emit security-relevant audit events：

- admin login / logout；
- user create / disable / role change；
- password reset；
- first admin setup；
- failed login；
- backup created；
- backup restored（仅在 future restore path 存在后）；
- migration started / completed / failed；
- config validation failed；
- critical dependency unreachable。

Audit events 是 operator-visible 的安全轨迹。M2 可以先通过 structured log 暴露；M3 再提供 admin-only audit trail webapp view。

### R5 Anomaly / Alerting

M2 的异常必须至少进入 structured log 和 health status。M3 开始提供 alert path：连续 backup 失败、DB 持续不可达、storage 持续不可达、异常 error rate 等条件应触发 webhook / email / log fallback。

Alert 不应该制造新运维负担：同一 condition 在同一时间窗内去重，避免 alert storm。

---

## MVP — minimum shippable (M2)

**M2 runtime capabilities**：

- **Automated backup baseline**：default daily backup + retention / GC + backup status visible。
- **Manual backup trigger**：admin webapp action and/or CLI `skb backup now`；返回 archive ID / status。Setup-time upgrade warning points here；one-click pre-upgrade integration is M3+。
- **Backup success contract**：successful backup artifact includes manifest、app/schema version metadata、DB snapshot、blob/storage policy、checksum or equivalent complete marker；partial archive invalid。
- **Restore boundary**：restore belongs to runtime domain, but M2 has no verified restore endpoint / UI / acceptance gate。
- **Health check**：`/health` returns bounded subsystem reachability summary；anonymous；low cost；no secrets / PII / raw provider errors。
- **Structured stdout logs**：JSON Lines or equivalent structured format；Docker / single-binary 都可读取；no M2 web log viewer/export/live-tail gate。
- **Audit event baseline**：auth event vocabulary follows [identity.md]；auth / admin user management / backup / migration / config validation 等关键事件可追踪。
- **Runtime overhead baseline**：health + log + backup schedule overhead < 5% on Solo NAS profile。

**M2 runtime capability matrix**：

| Category | M2 behavior | M2 verified gate |
|---|---|---|
| Backup schedule | daily local backup = supported；S3-compatible = optional smoke, not release gate | local backup succeeds + retention/GC works |
| Backup artifact | manifest + metadata + DB snapshot + storage policy + complete marker = supported | `success` only after complete artifact；partial archive invalid |
| Manual backup | supported as runtime entry；does not redeploy | manual trigger returns status/archive ID for a valid backup artifact |
| Restore | runtime-domain concept；M2 = future marker only | no restore endpoint/UI/gate in M2 |
| Health | supported；anonymous-safe；bounded cheap probes | `/health` reports top-level status + checked_at + DB/storage/search/backup/auth reachability |
| Logs | structured stdout = supported；web viewer/export/live-tail = not M2 | Docker logs / single-binary stdout show structured entries |
| Audit | baseline events = supported；auth event names follow [identity.md] | admin login + failed login + user create + backup created + migration events emitted |
| Alerting | log/health signal only in M2；webhook/email alert = M3 | critical failures are visible in log/health |

**M2 acceptance gates**：

- Automated local backup runs on schedule; retention / GC does not delete newest valid backup.
- Backup success is written only after a complete local artifact exists with manifest, app/schema version metadata, DB snapshot, blob/storage policy, and checksum or equivalent complete marker; partial archives are invalid and excluded from retention.
- Manual backup trigger works without redeploy and is the path referenced by setup-time upgrade warning.
- M2 does not include verified restore endpoint, restore UI, or restore acceptance gate.
- `/health` reports `ok` / `degraded` / `down` with `checked_at` and per-subsystem DB/storage/search/backup/auth detail; probes are bounded and cheap; response contains no secrets, PII, connection strings, or raw provider errors.
- Structured stdout logs contain timestamp / level / event / request or actor context where applicable.
- M2 does not include web log viewer, log export endpoint, or live tail UI.
- Audit baseline events emit for admin login, failed login, user creation, backup created, migration started/completed/failed.
- Runtime features do not require operator config hot reload; config changes still require setup-time redeploy.
- Solo NAS overhead remains within budget.

---

## Progressive completeness (M3 → M4)

### M3 — Operator Visibility

- **Metrics endpoint**：Prometheus-compatible or OpenMetrics-compatible counters for request count / error rate / latency。
- **Audit trail webapp view**：admin-only；filter by time / user / event type；不需 grep logs。
- **Backup retention policy view**：admin 可读当前 policy；修改仍走 setup-time redeploy。
- **Anomaly alert baseline**：连续 backup 失败 / DB 持续不可达 / storage 持续不可达 / high error rate 触发 webhook / email / log fallback。
- **Pre-upgrade backup integration support**：为 setup-time upgrade flow 提供 backup-now shortcut / archive validation / dry-run 的 runtime capability；不承诺真实 restore 写入。

### M4 — Production Polish

- **Per-subsystem metrics**：DB query latency / storage latency / search latency / auth latency。
- **Alert acknowledgement**：admin 可 ack alert；同 condition 在 reset 前不重复轰炸。
- **Canonical local restore smoke**：在 canonical local profile 上验证最小 restore path 可跑通；不承诺 cross-deploy restore。
- **5 deploy mode runtime verify**：Docker compose / single-binary / NAS template / VPS template / Workers tier 3 的 runtime behavior 全验证；Workers runtime constraint 明确文档化。
- **Runtime behavior under constrained environments**：Solo NAS 低资源、Workers CPU / background task 限制都给出 clear constraint，不静默失败。

---

## Done — final horizon (Phase 2+)

- **Incremental backup**：只备份 since last full backup 的变化。
- **Cross-region backup replication**：S3-compatible target 的跨区域复制策略。
- **Cross-deploy restore**：Docker compose backup restore 到 single-binary / NAS / VPS / Workers 等不同 deploy mode；需要独立 compatibility gate。
- **Audit log export**：admin 导出 audit log CSV / JSON。
- **Distributed tracing / APM integration**：OpenTelemetry / APM adapter。
- **Self-healing baseline**：可恢复异常自动重试，如 DB reconnect；critical failures 仍需要 operator-visible alert。
- **Multi-instance runtime coordination**：如果未来启用 multi-instance，定义 backup schedule owner、health aggregation、alert dedup。

---

## Reference

### Cross-Cutting Runtime Invariants

| Invariant | 含义 |
|---|---|
| **Runtime = no config mutation** | Runtime entry 可以触发 backup / view stdout log / health；restore 属 runtime domain，但 M2 只是 future marker；任何 runtime entry 都不能改变 install profile / env / config |
| **No runtime config hot reload** | 改 retention / alert target / metrics auth / backup provider = setup-time redeploy |
| **SHCKB-autonomous** | backup schedule / health / logging / baseline audit 不要求 operator 持续介入 |
| **Operator-observable** | runtime success / failure / degraded state 必须能通过 health / log / admin view / alert 看见 |
| **Stdout standard** | logs 默认 stdout；兼容 OCI / docker logs / log driver；不要求 app 自己管理 log files |
| **No PII / secrets in default logs** | password / token / email body / secrets 不进 default log；audit event 只记录必要 security context |
| **Low overhead on Solo NAS** | health / logging / backup schedule 不应显著拖慢弱机型；M2 baseline < 5% overhead |
| **Health is load-balancer friendly** | `/health` anonymous-safe、低成本、无 sensitive data |

### Non-Goals

- ❌ **Runtime config hot reload** —— 改配置仍归 setup-time redeploy。
- ❌ **完整 DR runbook step-by-step** —— 归 future `engineering/runbooks/`。
- ❌ **M2 verified restore UX/API** —— M2 是 backup-only verified path；M3 只做 archive validation / dry-run；M4 才做 canonical local restore smoke。
- ❌ **规定具体 monitoring stack** —— Prometheus / Grafana / Loki / ELK 等是 operator choice；PRD 只锁可观察行为。
- ❌ **M2 web log viewer / export / live tail** —— M2 log access 是 structured stdout。
- ❌ **M2 webhook/email alert** —— M2 只要求 log/health 可见；alert delivery M3。
- ❌ **M2 incremental / cross-region backup** —— Phase 2+。
- ❌ **Host-level monitoring** —— CPU / disk / OS service manager 归 operator / host tooling；SHCKB 可暴露 app-level signals。

### Edge Cases

| 场景 | 期望行为 |
|---|---|
| `/health` 在 DB down 时调用 | 返回 `down` + DB unreachable detail；HTTP 503 或等价 failure signal |
| `/health` 在 storage down 但核心读写仍可运行时调用 | 返回 `degraded` + storage detail；不静默报 `ok` |
| Backup 跑到一半 SHCKB crash | 下次 startup 检测 partial backup → 清理或标记 invalid；不让 partial archive 进 retention pool |
| Backup target storage full | Backup failure visible；触发 log/health degraded；M3+ alert；是否先 GC 旧 backup 归 ADR-0017/runbook |
| Manual backup 与 scheduled backup 同时触发 | 第二个 wait / skip + log；不得并发写出两个相互覆盖的 archive |
| 多个 admin 同时触发 manual backup | Dedup / lock；只生成一个有效 archive 或给 clear busy status |
| Audit log 写入失败 | Critical failure；不得静默丢 audit；instance 至少 degraded + structured error |
| `/metrics` 暴露给公网 | M3+ 由 operator config 控制 auth mode；默认不泄露 sensitive labels |
| Alert webhook URL 不可达 | Retry + log；避免无限重试；同 condition 做 dedup |
| Workers tier 3 无法跑长后台任务 | M4 文档化 constraint；不得假装与 OCI runtime 完全等价 |

### Dependencies

PRD 层 upstream 依赖：

- **Parent PRD**: [self-host-deploy.md](./self-host-deploy.md)
- **Sibling PRDs**: [setup-time.md](./setup-time.md)
- **Cross-folder PRDs**:
  - [authentication.md](../authentication/authentication.md) — auth/admin/audit baseline event 来源
  - [notepage.md](../notepage/notepage.md) — runtime behavior 跨 deploy mode 一致
  - [theme-system.md](../theme-system/theme-system.md) — runtime asset serving 一致
  - [plugin-system.md](../plugin-system/plugin-system.md) — future plugin runtime / background task constraint
- **External services**:
  - Optional log aggregator
  - Optional alert manager / webhook target
  - Optional SMTP for email alert
  - Optional Prometheus-compatible metrics scraper
  - Optional S3-compatible backup target

### Open Questions

1. **Metrics endpoint auth**：anonymous / basic-auth / token？倾向 basic-auth default；归 M3 implementation。
2. **Audit event baseline 是否还需补 notepage events**：如 publish / private→public toggle；需和 notepage PRD 对齐。
3. **Backup includes secrets policy**：备份 archive 是否包含 install profile / secrets；trade-off security vs recoverability；归 future runbook / ADR-0017 follow-up。
4. **Workers runtime path**：Workers 无长驻进程时 backup schedule / background jobs 的替代路径；归 M4 constraint POC。

### Resolved Scope Notes

- **Restore milestone**：M2 = backup-only verified path；M3 = archive validation / dry-run；M4 = canonical local restore smoke；Phase 2+ = cross-deploy restore + full DR runbook。

### Surfaced ADR Debts

- **Runtime metrics + monitoring ADR (new)**：metrics format / auth / label budget / per-subsystem detail；归 [ADR-0010] follow-up。
- **Audit event log ADR (new)**：audit event list / format / retention / export；auth-domain vocabulary follows [identity.md](../authentication/identity.md)；M2 baseline list lock 后 future ADR。
- **Alert delivery ADR (new)**：webhook / email / log fallback；alert frequency dedup；归 future ADR。
- **Backup integrity verification mechanism**：checksum / sampling verify / archive validation / canonical local restore smoke；归 [ADR-0017] follow-up。
- **Runtime job ownership across deploy modes**：OCI / single-binary / Workers 的 background job capability 不同；归 [ADR-0001] + [ADR-0017] follow-up。
- **Log structured schema**：跨 SHCKB / plugin / library 的 log schema 一致性；归 future logging ADR。

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

### References

- **Aligning ADRs**（pending PRD-driven rework；详顶部 disclaimer）:
  - [ADR-0017](../../../../engineering/decisions/ADR-0017-backup-strategy.md) — BackupProvider + retention/GC
  - [ADR-0010](../../../../engineering/decisions/ADR-0010-performance-budget.md) — backend SLO + monitoring baseline
  - [ADR-0009](../../../../engineering/decisions/ADR-0009-api-style.md) — `/health` endpoint REST style
  - [ADR-0001](../../../../engineering/decisions/ADR-0001-deployment-canonical-artifact.md) — stdout log standard + deploy-mode constraints
- **Parent**: [self-host-deploy.md](./self-host-deploy.md)
- **Sibling**: [setup-time.md](./setup-time.md)
- **Cross-folder**:
  - [authentication.md](../authentication/authentication.md)
  - [identity.md](../authentication/identity.md) — auth-domain audit event vocabulary source
  - [notepage.md](../notepage/notepage.md)
  - [theme-system.md](../theme-system/theme-system.md)
  - [plugin-system.md](../plugin-system/plugin-system.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc cross-reference convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)
- **PRD form**: [prd-discipline.md](../../../../process/methods/prd-discipline.md) — operator-lifecycle PRD form

### Changelog

- 2026-05-17 initial draft (Phase E Day-1 PRD #4 sub-PRD)；runtime = SHCKB-autonomous 期间 operator 不主动改的部分；4 H2 sections (automated backup / health monitoring / log + audit / anomaly detection)；7 cross-cutting runtime invariants；M2 baseline (backup + health + log) / M3 polish (metrics + audit view + anomaly alert) / M4 polish + 5 mode verify；surface 5 ADR debts (monitoring metrics ADR / audit event ADR / alert delivery ADR / backup integrity / log structured schema)
- 2026-05-21 setup-time backup scope sync：明确 runtime M2 保留 manual backup endpoint / CLI capability；setup-time M2 upgrade flow 只做 warning + pointer，不要求一键 pre-upgrade backup integration；集成式 backup-now / dry-run / restore verification 当时暂记 M3+，后续 2026-05-22 restore milestone sync 细化为 M3 validation/dry-run、M4 canonical local restore smoke。
- 2026-05-22 pass 2 — operator-lifecycle narrative rewrite：改为 What / Why / Whole picture / User-facing experience / MVP / Progressive / Done / Reference；保留 runtime 自治边界，明确 runtime entry vs setup-time config change；新增 M2 runtime capability matrix；收紧 backup / health / log / audit / alert M-stage；新增 Workers runtime constraint 与 manual restore scope open question。
- 2026-05-22 pass 2 cleanup — reviewer findings applied：restore M2 scope 改为 backup-only verified path；补 M2 backup success contract；audit baseline 对齐 [identity.md] 并补 failed login；M2 log access 明确为 structured stdout only；补 `/health` minimum response contract。
- 2026-05-22 pass 2 restore milestone sync：restore 分层为 M3 archive validation / dry-run、M4 canonical local restore smoke、Phase 2+ cross-deploy restore；补 [identity.md] 作为 auth audit vocabulary source 的 inline/reference 链接。
- 2026-05-22 pass 2 final cleanup：restore milestone 从 Open Questions 移到 Resolved Scope Notes；setup-time M3 pre-upgrade wording 同步为 archive validation / dry-run，不再暗示 M3 restore verification。
