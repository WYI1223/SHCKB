# Feature PRD: Self-host deployment — runtime

| Field | Value |
|---|---|
| Status | draft (setup-time backup scope sync) |
| Last updated | 2026-05-21 |
| Owner | W_YI |
| Parent PRD | [self-host-deploy.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

## Overview

**Run-time** = SHCKB-autonomous 运营期间。Operator **不主动改** config / redeploy（per [self-host-deploy.md] cross-cutting invariant "no runtime config hot reload"）；SHCKB 自治期间做 **automated backup / health check / monitoring / log access / anomaly detection** 等不需 operator intervention 的事。

本 PRD cover 4 类 runtime 行为：

1. **Automated backup schedule**（per [ADR-0017]：retention / GC / backup target）
2. **Health check / monitoring baseline**（operator-observable metrics）
3. **Log access / audit trail**（SHCKB-emitted logs + audit events）
4. **Anomaly detection / alerting baseline**（M3+）

**关键 boundary**: operator 触发的 backup / restore / log 查看是 **runtime entry**（SHCKB 提供 endpoint；operator 调用但不 redeploy）；改 backup schedule 本身是 **setup-time**（改 config + redeploy）。Setup-time M2 upgrade flow 只要求 warning + pointer 指向此 manual backup path；一键 pre-upgrade backup integration 属 M3+。

不锁：
- Setup-time 任何 operator-active 改动（→ [setup-time.md]）
- Library 内部 monitoring 实现（→ library + future ADRs）
- Runbook step-by-step（DR / scaling / incident response → future `engineering/runbooks/`）

## Scope

### 本 PRD 负责

- 4 类 runtime 行为的 **operator-observable WHAT**（operator 能看 / 调用 / 触发 alert 的）
- Cross-cutting runtime invariants（automation；observability；no-required-intervention）
- Runtime endpoint baseline（health / metrics / log access）
- Operator triggered actions 走 runtime entry（不 redeploy）的边界

### 本 PRD 不负责

| 不负责 | 归 |
|---|---|
| Backup schedule config / retention 改 | [setup-time.md] §3 (L4 config change) |
| First install / upgrade / L3 migration | [setup-time.md] §1/§4/§5 |
| Auth library 内部 token / session 管理 | [authentication.md] |
| Specific monitoring stack (Prometheus / Grafana / etc.) | library / operator choice；future ADR-0010 follow-up |
| Specific log aggregator (Loki / ELK / etc.) | operator choice |
| Runbook DR / incident response step-by-step | future `engineering/runbooks/` |

## §1 Automated backup schedule

### User stories

- As a **Solo NAS operator**, I want to **SHCKB 自动每日 backup 到 local backup path + 自动 GC old backups**（per [ADR-0017] retention policy），so that **不需手动 cron；数据有保障**
- As a **Team VPS operator with S3-compat configured**, I want to **SHCKB 自动 backup 到 S3 + 跨 region redundancy**（如 backup provider 支持），so that **跨基础设施数据安全**
- As an **operator wanting on-demand backup**, I want to **触发 manual backup endpoint** (e.g., before upgrade)，so that **关键时刻立即备份；不等下次 schedule**

### Must (M2)

- **Backup schedule baseline**（per [ADR-0017]）：default 每日 backup；具体 schedule 在 setup-time config（per [setup-time.md] §2 initial adapter config）
- **Backup target = backup provider adapter**（per [ADR-0017]）：local / S3 / etc.；具体选 setup-time
- **Retention + GC**（per [ADR-0017]）：默认 retain N=14 daily backups；GC 跑在 backup 完成后；具体 N 是 operator config
- **Backup includes**：DB dump + blob references（不含 blob 本身 if storage 跟 backup 不同 target；具体归 [ADR-0017]）+ install profile / secrets（可选；security trade-off）+ schema version metadata
- **Manual trigger endpoint**：admin webapp 内 / CLI `skb backup now` 触发 on-demand backup；返回 archive ID + status。此项是 runtime M2 capability；setup-time M2 upgrade flow 只提示 operator 使用该路径，不要求一键集成。
- **Backup integrity check**：backup 完成后 SHCKB 验证 archive 完整性（checksum / 抽样 verify）；失败 → log + retain 旧 backup + retry policy
- **Backup status visible**：admin 可见上次 backup time / status / archive list

### Should (M3)

- **Backup retention policy UI**（read-only）：admin 看 retention policy；改要 setup-time redeploy
- **Backup failure alert**：连续 N 次 backup 失败 → alert path（log / email / webhook；具体 alert path 归 §4）

### Nice-to-have (Phase 2+)

- **Incremental backup**（per [ADR-0017] Phase 2+ 可能）：只 backup 变化 since last full backup
- **Cross-region backup replication**

## §2 Health check / monitoring baseline

### User stories

- As an **operator deploying SHCKB**, I want to **`/health` endpoint 返回 instance health**（DB connection / storage reachable / etc.），so that **load balancer / monitoring tool 能 detect instance failure**
- As an **operator on Team VPS**, I want to **基本 metrics endpoint**（request count / error rate / DB query latency baseline），so that **能集成 Prometheus / 等监控**
- As an **operator on Solo NAS**, I want to **健康检查不消耗大量资源**，so that **不影响弱机型正常运营**

### Must (M2)

- **`/health` endpoint**（per [ADR-0009] REST style）：返回 instance health summary
  - DB connection reachable
  - Storage provider reachable
  - Search provider reachable
  - Backup provider reachable
  - Auth library initialized
- **Health response format**：JSON；status: ok / degraded / down + 各 subsystem 细节
- **Anonymous access**（不需 auth）：health endpoint 不 sensitive；load balancer 不带 cookie
- **Health check 低成本**：< 50ms p95 response；不打 heavy DB query；不影响 user request

### Should (M3)

- **`/metrics` endpoint** baseline（per [ADR-0010] backend SLO）：basic counters（request / error / latency histogram）
  - Format: Prometheus-compatible 或 OpenMetrics
  - Anonymous or basic-auth（operator config）
- **Per-subsystem metrics**：DB query latency / storage upload latency / search query latency / etc.
- **Resource metrics**：process memory / CPU / disk usage（host-level 归 OS monitoring；本 PRD 不重复）

### Nice-to-have (Phase 2+)

- **Distributed tracing baseline**（OpenTelemetry export；Phase 2+；非 Day-1 self-host scale）
- **Application performance monitoring (APM) integration**

## §3 Log access / audit trail

### User stories

- As an **operator debugging issue**, I want to **看到 SHCKB log**（structured + filterable + tail-able），so that **能 diagnose problem 不需 SSH 改 verbose mode**
- As an **operator on compliance audit**, I want to **audit trail 包含 admin 操作 / user creation / auth event / failed login 等关键事件**，so that **能回溯安全相关操作**
- As an **operator with log aggregator**（Loki / ELK / 等），I want to **SHCKB log 走 stdout（OCI 标准）**，so that **不需配置 log driver**

### Must (M2)

- **Structured logging**：JSON Lines 格式；每条 log 含 timestamp / level / event / context（user_id / request_id / etc.）
- **Stdout 输出**（per OCI 标准）：不写本地 file（operator 用 docker logs / log driver 收集）；single-binary 同
- **Log levels**：error / warn / info / debug；debug 默认 OFF；setup-time config 可开
- **Audit events 明确**（baseline list）：
  - Admin login / logout
  - User create / disable / role change
  - Password reset (admin manual or email)
  - First admin setup
  - Backup created / restored
  - Migration started / completed / failed
  - Config validation failed
  - Critical errors（DB / storage / search provider unreachable）

### Should (M3)

- **Audit trail webapp view**（admin-only）：admin 能在 webapp 内查 audit events（不需 grep log）；过滤 by time / user / event type
- **Log retention policy**：log file 不应无限增长（即便 stdout；OS log rotation 归 operator config）；本 PRD 不 mandate retention（OCI standard）

### Nice-to-have (Phase 2+)

- **Audit event export**（CSV / JSON）：admin 触发 audit log export endpoint
- **Real-time log streaming**（WebSocket / SSE）admin webapp 内 tail

## §4 Anomaly detection / alerting baseline (M3+)

### User stories

- As an **operator wanting awareness of system issues**, I want to **SHCKB 提供 alert webhook integration**（如连续 N 次 backup 失败 / DB connection 持续断 / etc.），so that **能集成自己的 alert manager**
- As an **operator on Solo NAS**, I want to **基本 anomaly detection 不消耗大量资源**，so that **弱机型 OK**

### Must (M3)

- **Anomaly detection baseline**：明确哪些 condition 触发 alert
  - 连续 N 次 backup 失败（per §1）
  - DB connection 持续断 > X seconds
  - Storage provider unreachable > X seconds
  - 异常 high error rate（per [ADR-0010] SLO threshold）
  - First admin credential 漏配（Solo / startup-time；其实属 §1 first install verify）
- **Alert delivery path** (operator config in setup-time)：
  - Webhook (POST to operator-provided URL)
  - Email (if SMTP configured；per [authentication.md] email optional)
  - Log (always；fallback)
- **Alert frequency baseline**：avoid alert storm；同 condition 同时间窗只 alert 1 次

### Should (M4)

- **Alert config UI in admin webapp**（read-only；改要 setup-time）
- **Alert acknowledgement**：admin 在 webapp 内 ack alert；ack 后该 condition stop emitting alert until reset

### Nice-to-have (Phase 2+)

- **Self-healing baseline**：某些 anomaly SHCKB 自动尝试 recover（如 reconnect DB；非 critical event）

## Cross-cutting runtime invariants

| Invariant | 含义 |
|---|---|
| **No operator-required intervention** | Runtime 期间 SHCKB 自治；operator 不主动改 config；backup / health / log / monitoring 都 SHCKB-driven |
| **Operator-observable** | Runtime 行为 operator 可见（log / health endpoint / admin webapp view）；不静默运营 |
| **Stdout 标准** | Log 走 stdout；不写本地 file；兼容 OCI / docker logs / log driver |
| **No PII in log by default** | User id / request id OK；password / token / email body 不在 default log；audit event 可含必要 PII（admin-only access） |
| **Low overhead on Solo NAS** | Health check / metrics / log overhead < 5% baseline；弱机型 OK |
| **Anonymous health check** | `/health` endpoint 不需 auth；load balancer 友好 |
| **Trigger ≠ change config** | Operator 触发 backup / restore / view log = runtime entry（不 redeploy）；改 schedule / retention / alert config = setup-time（redeploy） |

## Acceptance criteria

### M2

- **§1 Automated backup**：default daily backup 跑 + retention work + manual trigger endpoint（setup-time upgrade warning points here；one-click pre-upgrade integration is M3+）
- **§2 Health check**：`/health` returns subsystem reachability JSON；anonymous；< 50ms p95
- **§3 Logging**：stdout JSON Lines；audit events baseline emit（admin login / user create / backup / migration）
- **Runtime overhead baseline**：health + log + backup schedule overhead < 5% on Solo NAS profile（per cross-cutting invariant）

### M3

- **§2 `/metrics` endpoint**：Prometheus-compatible counters
- **§3 Audit trail webapp view**（admin-only）：filter by time / user / event
- **§4 Anomaly detection baseline**：webhook alert path work；连续 backup 失败触发 alert

### M4

- **Per-subsystem metrics** detailed
- **Alert config + acknowledgement** in admin webapp
- **5 deploy mode 全 verify** runtime behavior 一致

### Phase 2+

- Distributed tracing / APM
- Incremental backup / cross-region replication
- Audit log export
- Self-healing baseline

## Edge cases

| 场景 | 期望行为 |
|---|---|
| `/health` 在 DB down 时调用 | 返回 status: down + DB unreachable detail；HTTP 503 |
| `/health` 在 storage down 但 DB OK 时调用 | 返回 status: degraded + storage detail；HTTP 200（degraded but functioning） |
| Backup 跑到一半 SHCKB 进程 crash | 下次 startup 检测 partial backup → 清理 + 重新 schedule（不让 partial archive 进 retention pool）|
| `/metrics` 暴露给公网 | Operator config 决定（anonymous / basic-auth）；default basic-auth recommended |
| Log 输出体积过大 | Stdout 标准 + OS log rotation；本 PRD 不 mandate；归 operator config |
| Alert webhook URL 不可达 | Retry N 次 + log；不丢 alert state（next condition trigger 仍 emit）|
| Audit log 写入失败（rare：DB issue） | 致命；instance 触发 anomaly alert + degraded mode（不静默丢 audit）|
| Operator 跑 manual backup 时 schedule 也 trigger | 二选一：第二个 wait OR skip + log；归 implementation；建议 skip + log |
| Multi-tab admin 同时触发 manual backup | Library-level race-safe / dedup window；不重复 backup |
| Backup target storage full | 触发 anomaly alert + 旧 backup GC 释放空间 OR 拒绝 backup（具体归 [ADR-0017]）|

## Dependencies

- **Parent PRD**: [self-host-deploy.md](./self-host-deploy.md)
- **Sibling PRDs**: [setup-time.md](./setup-time.md)
- **Cross-folder PRDs**:
  - [authentication.md](../authentication/authentication.md) — audit event 包含 auth event；`/health` endpoint anonymous（per anonymous reader pattern）
  - [notepage.md](../notepage/notepage.md) — runtime behavior 跨 deploy mode 一致
  - [theme-system.md](../theme-system/theme-system.md) — runtime asset serving 一致
  - [plugin-system.md](../plugin-system/plugin-system.md) — plugin runtime（如 background tasks；本 PRD 不展开 plugin runtime；归 plugin-system）
- **External services**:
  - Optional log aggregator
  - Optional alert manager (webhook)
  - Optional Prometheus (metrics scraper)

## Open questions

1. **Metrics endpoint authentication**：anonymous / basic-auth / token？倾向 basic-auth default；归 implementation
2. **Audit event 完整 list**：M2 baseline list 是否够？还需加哪些（如 notepage publish / private→public toggle / etc.）？归 implementation + future audit log ADR
3. **Backup includes secrets 选项**：含 vs 不含 secrets in backup archive；trade-off security vs recoverability；归 future operator runbook
4. **Multi-instance runtime coordination**：如果 future Phase 2+ multi-instance load balancing，backup schedule 谁跑？health check 怎么 aggregate？归 Phase 2+ ADR
5. **Log structured schema 是否归 ADR**：跨 SHCKB / plugin emit 的 log 是否要 standardized schema；归 future logging ADR

## Surfaced ADR debts

- **Runtime metrics + monitoring ADR (new)**：`/metrics` format + auth + per-subsystem detail；归 [ADR-0010] follow-up
- **Audit event log ADR (new)**：audit event list + format + retention + export；M2 baseline list lock 后 future audit ADR
- **Alert delivery ADR (new)**：webhook / email / log fallback；alert frequency dedup；归 future ADR
- **Backup integrity verification mechanism**：checksum / 抽样 verify 具体形态；归 [ADR-0017] follow-up
- **Log structured schema**：跨 SHCKB / plugin / library 的 log schema 一致性；归 future logging ADR

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

- **Aligning ADRs**:
  - [ADR-0017](../../../../engineering/decisions/ADR-0017-backup-strategy.md) — BackupProvider + retention/GC
  - [ADR-0010](../../../../engineering/decisions/ADR-0010-performance-budget.md) — backend SLO + monitoring baseline
  - [ADR-0009](../../../../engineering/decisions/ADR-0009-api-style.md) — `/health` endpoint REST style
  - [ADR-0001](../../../../engineering/decisions/ADR-0001-deployment-canonical-artifact.md) — stdout log standard
- **Parent**: [self-host-deploy.md](./self-host-deploy.md)
- **Sibling**: [setup-time.md](./setup-time.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc cross-reference convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-17 initial draft (Phase E Day-1 PRD #4 sub-PRD)；runtime = SHCKB-autonomous 期间 operator 不主动改的部分；4 H2 sections (automated backup / health monitoring / log + audit / anomaly detection)；7 cross-cutting runtime invariants；M2 baseline (backup + health + log) / M3 polish (metrics + audit view + anomaly alert) / M4 polish + 5 mode verify；surface 5 ADR debts (monitoring metrics ADR / audit event ADR / alert delivery ADR / backup integrity / log structured schema)
- 2026-05-21 setup-time backup scope sync：明确 runtime M2 保留 manual backup endpoint / CLI capability；setup-time M2 upgrade flow 只做 warning + pointer，不要求一键 pre-upgrade backup integration；集成式 backup-now / dry-run / restore verification 留 M3+。
