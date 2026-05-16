# ADR-0007: Storage provider abstraction — local FS + S3-compatible pluggable

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.13 |

## Context

Binary content（images / PDFs / Jupyter outputs / nn-viz model weights / video / agent embeddings / etc.）不应进 DB BLOB column（详 ADR-0002）。需要独立 storage layer，且按 operator 部署模式可配置：
- Solo / NAS / 自建 → local filesystem
- VPS / Cloud → managed object storage（R2 / AWS S3 / Backblaze / Tencent COS / Aliyun OSS / 自部署 MinIO）

User 强调 "10G 数据真实 scale" + "不同机型部署需求" → storage tier 必须从 day 1 pluggable。

## Decision

**Pluggable `StorageProvider` interface + 2 个 built-in adapter**：

```ts
interface StorageProvider {
  put(key: string, data: Uint8Array | ReadableStream, metadata: BlobMetadata): Promise<PutResult>;
  get(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, opts?: { expiresIn: number }): Promise<string>;
}

type BlobMetadata = { mime: string };

// put 返回 storage-side 计算得到的事实 —— size 和 hash 是写入过程算出的
// key / mime 是 caller 输入，不在返回值里；URL 永不持久化（读时走 getSignedUrl 即得即用）
type PutResult = { size: number; hash: string };
```

**Key-first 持久引用 invariant**：DB 真相是 `block_blobs.{storage_key, mime, size, hash}`（ADR-0002）。URL **永不入 DB**；读 blob 时通过 `getSignedUrl(key)` 即时取临时 URL。DB row 由 `{ storage_key: key, mime: metadata.mime, size: putResult.size, hash: putResult.hash }` 组装。

Built-in adapters:
- **LocalFsProvider** —— 写 operator config 路径（`/var/lib/skb/blobs/`）
- **S3CompatProvider** —— SDK 通过 AWS S3 协议；cover R2 / B2 / MinIO / Tencent COS / Aliyun OSS / AWS S3

### Install 时 prompt

```bash
STORAGE_PROVIDER=local|s3
# if s3:
STORAGE_S3_ENDPOINT=
STORAGE_S3_BUCKET=
STORAGE_S3_ACCESS_KEY=
STORAGE_S3_SECRET_KEY=
STORAGE_S3_REGION=
```

### Plugin usage

Plugin `agentOp.handler` 通过 `ctx.storage` capability 拿 provider 实例（详 ADR-0014）；不直接 import 全局 singleton。Plugin code stays storage-backend-agnostic。

### Blob lifecycle

**写**：
- Plugin agentOp 调 `storage.put(key, data, { mime })` → 返回 `{ size, hash }`
- Framework / repository 把 `{ storage_key: key, mime, size, hash }` 写入 `block_blobs` 表（ADR-0002 row-of-truth）
- `blobRefs` 是 plugin BlockState 视角的 view（ADR-0014 serializer），**`block_blobs` 是 storage table**；二者一一对应

**读**：
- SSR / EditView 拿到 `block_blobs.storage_key` → `storage.getSignedUrl(key)` 即时取临时 URL → 客户端直 fetch
- URL 永不在 DB 持久化

**删 —— 两段式（与 ADR-0017 retention-aware GC 对齐）**：
1. **Soft-delete**（block delete 或 blob detach 时同步）：framework 在 `block_blobs` row 上写 `deleted_at = now()`；常规读路径过滤 `deleted_at IS NULL`；**不**调 `storage.delete()`
2. **Physical GC**（ADR-0017 retention-aware）：后台 GC job 在 row `deleted_at + 最长 backup retention window` 已过后调 `storage.delete(key)` + `DELETE FROM block_blobs WHERE id = ?`

即 **`StorageProvider.delete()` 是被 ADR-0017 GC job 调，不是 block delete 时同步调**。Plugin / agentOp 代码中不应直接调 `storage.delete()`；如有需要走 framework cleanup API（写 tombstone，不真删）。

## Consequences

**Positive**:
- Operator 自由选 storage layer；NAS local-only 也行，公有云 R2/S3 也行
- 10GB+ binary 不入 DB → DB 文件小 + 备份快 + query 不被 BLOB 拖累
- Plugin code 跨 storage backend 不变；plugin authors 不需关心 storage 细节

**Negative / Trade-offs**:
- 多 adapter implementations 维护成本；mitigate by S3-compatible 覆盖 80%+ cloud cases
- LocalFs vs S3 backup / migration 路径不同；详 runbooks/backup-restore.md（M2+ 写）
- Signed URL 机制需要 timeout / refresh；通过 default expiresIn 5min mitigate

**Risks**:
- Plugin 把大 blob 误塞 DB content_inline → 通过 plugin contract `contentStorageHint: 'blob'` 引导 + code review catch
- Storage 跨 mode 迁移（local → S3）；runbook 提供 `deploy/migrate-storage.sh` 工具

## Alternatives considered

- **DB BLOB only**: solo / 10MB-级数据 OK 但不 scale；rejected per 10GB+ user data
- **Single-vendor object storage SDK (e.g., 只支持 R2)**: vendor lock；rejected per ADR-0001 deploy matrix
- **IPFS / decentralized storage**: 过度复杂 + Day-1 用不上；rejected per scope
- **DB + 文件 hybrid 自卷**: 用 S3-compatible adapter 现成生态比自卷强；rejected
- **每 plugin 独立 storage backend**: 配置爆炸 + 全平台 inconsistent；rejected per single provider 简单

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.13
- Related ADRs: ADR-0001 (canonical deployment artifact), ADR-0002 (substrate), ADR-0004 (plugin model with `contentStorageHint`), ADR-0014 (plugin contract ctx.storage)

## Changelog

- 2026-05-13 initial draft (decision LOCKED 2026-05-12 in source DI doc)
- 2026-05-16 external review fix (cross-ADR alignment with ADR-0002 / ADR-0017):
  - put() 签名 sharpened: `Promise<{ url? }>` → `Promise<{ size, hash }>`；URL 永不入返回值/DB；key + mime 是 caller 输入不是 storage output
  - 加 Key-first persistent reference invariant 段落（DB 真相 = `block_blobs` table，URL 即时取）
  - Blob lifecycle "删" 改为两段式 tombstone + retention-aware GC（与 ADR-0002 `deleted_at` 列 + ADR-0017 GC policy 对齐）；明确 `StorageProvider.delete()` 不是 block delete 时同步调
  - 删除过期 `blob_refs` 措辞（统一到 ADR-0002 `block_blobs` table + ADR-0014 `blobRefs` view 的 row-of-truth / view 二分）
