# ADR-0017: Backup strategy — pluggable BackupProvider

> **DEPRECATED / LEGACY DRAFT (2026-05-23)**: This ADR is retained only as historical carryover. It MUST NOT be used as an authoritative source for product behavior, architecture, implementation plan, or technology-stack choice. Technology choices must be derived from current PRDs and product shape, then captured in new PRD-informed ADRs. Treat any Decision/Consequences/technology names below as suspect until re-ratified.

| Field | Value |
|---|---|
| Status | deprecated (legacy draft; PRD-rework required) |
| Date | 2026-05-14 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | — （emerged from ADR-0002 owner review 2026-05-14；不在原 frozen DI doc） |

## Context

ADR-0002 LOCK 了 DB-backed substrate；owner review 时指出"数据持久化和 git 是两回事，server-side 服务一般是可选自持 + 备份"。Backup 从 ADR-0002 中剥离成独立 concern。

Backup 是否值得独立 ADR（vs 纯 runbook）？决策：**值得**。理由：
- Self-hostable 跨 5 deploy mode × 3 operator scale（详 ADR-0001 + `product/prd/project.md`），各 mode backup 机制差异大
- 跟 storage（ADR-0007）/ search（ADR-0008）一样，backup 应该是 **first-class pluggable abstraction + 文档化策略**，不是放任 operator 自己摸索
- 数据丢失是不可逆灾难；架构层必须给 operator 明确路径

需要 backup 的两个数据源：
1. **DB**（notes / blocks / users / discussions / sessions）—— 结构化关键数据
2. **Object storage blobs**（images / PDFs / 等）—— 大 binary

## Decision

### Pluggable `BackupProvider` interface

```ts
interface BackupProvider {
  backup(opts?: BackupOptions): Promise<BackupResult>;
  restore(backupId: string): Promise<void>;
  list(): Promise<BackupEntry[]>;
  prune(policy: RetentionPolicy): Promise<PruneResult>;
}

type BackupOptions = {
  includeBlobs?: boolean;            // 默认 false：只备 DB（blob 由 storage provider durability 保证）
  label?: string;                     // 手动备份标签
};

type BackupEntry = {
  id: string;
  createdAt: string;
  sizeBytes: number;
  dbIncluded: boolean;
  blobsIncluded: boolean;
  label?: string;
};

type RetentionPolicy = {
  keepDaily?: number;                 // 保留最近 N 天
  keepWeekly?: number;
  keepMonthly?: number;
};
```

### Built-in adapters

| Adapter | 用途 | 适合 |
|---|---|---|
| **LocalFsBackupProvider** | dump DB → 本地目录 + rotation | Solo / NAS / 自建 |
| **S3BackupProvider** | dump DB → 上传 S3-compatible (R2 / B2 / AWS S3 / MinIO / 各家云) | Team / Public / Cloud |
| **LitestreamBackupProvider** | SQLite 连续 replication（streaming WAL → S3-compatible） | SQLite + 想要 point-in-time recovery |

Postgres 部署可走 S3BackupProvider（内部用 `pg_dump`）或 operator 直接用 managed Postgres provider 自带 snapshot（此时 `BACKUP_PROVIDER=none` + 文档说明依赖 provider）。

### DB vs Blob 分离

- **`BackupProvider` 主管 DB** —— 结构化关键数据
- **Object storage blobs** 由 storage provider durability 保证（R2 / S3 自带 11 个 9 durability + versioning）；`includeBlobs: true` 时 BackupProvider 也 snapshot blob（适合 local FS storage 的 operator）
- **一致性 concern**：DB backup at time T 引用的 blob 必须存在。Blob 是 append-mostly（删除走 soft-delete + 延迟 GC，见下），所以 DB-only backup 在大多数情况安全；文档说明 edge case

### Blob retention-aware GC policy

ADR-0002 的 `block_blobs` schema 包含 `deleted_at` tombstone 列；block / blob 删除时只写 tombstone，不直接 `storage.delete()`（详 ADR-0007 blob lifecycle 两段式）。**物理 GC 由本 ADR 负责**：

- **GC trigger window** = `deleted_at + 最长 BACKUP_RETENTION_*`（取 daily / weekly / monthly 中最长那个）
- 物理 GC job：`DELETE FROM block_blobs WHERE deleted_at IS NOT NULL AND deleted_at < now() - retention_max` + 调 `storage.delete(storage_key)`
- 顺序：先 `storage.delete()`，成功后再 `DELETE` DB row；storage 删失败则保留 row 下次 GC 重试（idempotent）
- Job 调度：BackupProvider 实现 hook（cron-style；与 `BACKUP_SCHEDULE` 共调度器；空 schedule 时 GC 不自动跑，operator 走 `deploy/backup.sh gc` 手动触发）

**为什么 window = 最长 retention**：保证任何一份 in-window backup restore 后引用的 blob 仍在 object storage 中可读。换 retention policy 或换 BackupProvider 时 GC window 自动跟着变；substrate 不需感知。

ADR-0002 拥有 schema invariant（`deleted_at` 列 / tombstone never-reuse）；本 ADR 拥有 GC policy（window / 顺序 / 调度）。互相 cross-ref，依赖方向单向（GC → schema）。

### Install 时 prompt

```bash
BACKUP_PROVIDER=local|s3|litestream|none
BACKUP_SCHEDULE=                    # cron expr；空 = 仅手动
BACKUP_RETENTION_DAILY=7
BACKUP_RETENTION_WEEKLY=4
BACKUP_RETENTION_MONTHLY=6
# if s3 / litestream:
BACKUP_S3_ENDPOINT= / BUCKET= / ACCESS_KEY= / SECRET_KEY=
```

### Per deploy-mode 默认

| Deploy mode | 默认 BackupProvider |
|---|---|
| Docker compose (NAS / 自建) | `local`（dump 到 mounted volume） |
| Single binary | `local` |
| Cloud PaaS (Fly / Render / Railway) | `s3`（dump 到 R2 / S3） |
| Cloud VPS | operator 选 |
| Edge (Cloudflare D1) | `none` + 依赖 D1 export / Cloudflare 自带（文档说明） |

### Restore path

- `restore(backupId)` —— 停服 → DB restore → 重启
- CLI 入口：`deploy/backup.sh restore <id>`
- Runbook `runbooks/backup-restore.md`（M2+ 写）详述每 mode step-by-step

### Schedule

- 内置 cron-style scheduler（`BACKUP_SCHEDULE` env）
- 或 operator 自己用系统 cron 调 `deploy/backup.sh`
- 不强制；`BACKUP_SCHEDULE` 空 = 仅手动 + UI 触发

## Consequences

**Positive**:
- Operator 有明确 backup 路径；不靠摸索
- 跟 storage / search 一致的 pluggable abstraction 心智
- DB / blob 分离避免每次 backup 拖大文件
- Litestream adapter 给 SQLite operator point-in-time recovery
- Per-mode 默认让 install 体验顺

**Negative / Trade-offs**:
- 3+ adapter 实现 + 维护成本
- DB / blob 一致性 edge case 需要文档化（soft-delete + 延迟 GC 缓解但非零风险）
- Scheduler 内置增加 server 复杂度（vs 纯依赖系统 cron）；通过 `BACKUP_SCHEDULE` 空值 = 不启用 mitigate

**Risks**:
- Restore 未经充分测试 → 备份无效；mitigate by CI restore-roundtrip test（M3+）+ runbook 强调"定期演练 restore"
- 大 DB（10GB+）backup 耗时 → mitigate by Litestream 连续 replication（增量）+ 文档说明全量 dump 的时间预期

## Alternatives considered

- **纯 runbook（无 abstraction）**: operator 自己跑 pg_dump / SQLite copy；rejected per "backup 应 first-class，不放任摸索"（owner review）
- **Dump 到 git**: git 不为大 binary / 频繁大 dump 设计；rejected per ADR-0002 review（git 是 code-only concern）
- **只依赖 cloud provider snapshot**: solo / NAS / 自建无 cloud snapshot；rejected per ADR-0001 (canonical deployment artifact)
- **DB + blob 强绑一起 backup**: 每次 backup 拖几 GB；rejected per DB / blob 分离更灵活（`includeBlobs` opt-in）
- **第三方 backup SaaS (Backblaze 等专用服务)**: S3BackupProvider 已 cover S3-compatible 目标（含 Backblaze B2）；不需要专用 adapter

## References

- Related ADRs: ADR-0001 (canonical deployment artifact), ADR-0002 (DB substrate — backup 从此剥离), ADR-0006 (DB engine choice), ADR-0007 (storage provider — blob durability)
- Runbook (M2+): `engineering/runbooks/backup-restore.md`
- External: Litestream / pg_dump / SQLite Online Backup API

## Changelog

- 2026-05-14 initial draft (proposed; emerged from ADR-0002 owner review — backup 剥离成独立 first-class pluggable concern)
- 2026-05-16 external review fix (cross-ADR alignment with ADR-0002 / ADR-0007): 新增 "Blob retention-aware GC policy" 段 —— 物理 GC window = max(retention)；ownership split 明确（ADR-0002 schema invariant / 本 ADR GC policy）；调度走 BackupProvider hook
