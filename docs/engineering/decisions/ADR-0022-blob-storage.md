# ADR-0022: Content-addressed local-fs blob storage

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-11 |
| Authors | W_YI (owner), Claude |
| Supersedes | — |
| Superseded by | — |
| Source | [mvp2-scope-2026-06-11.md](../design/discussions/mvp2-scope-2026-06-11.md) M2-D3（PRD-informed：[block-image.md] + [notepage.md] 两态模型） |

## Context

Image block（MVP-2 第二个 block kind）需要二进制资产存储。约束：Solo NAS 低资源默认（local-fs，per [self-host-deploy.md]）；两态模型要求 published 快照引用的资产在作者换图/删图后仍然有效；storage adapter 体系是 future 决策，现在只能留 seam 不建框架（mvp-scope D4）。

## Decision

1. **Content-addressed + 不可变**：blob id = sha256(bytes)；文件按 hash 落 `data/blobs/`（`SHCKB_BLOB_DIR` 可配，默认 DB 同级）；同内容自然去重；**永不改写**——换图 = 新 hash。这一条直接解决两态隐患：快照里的 hash 永远指向原始字节。
2. **元数据进 DB**（`blobs` 表：hash PK / mime / size / created_at；migration 0002），文件系统只存字节。写入走 temp+rename，不暴露半写文件。
3. **API**：`POST /api/blobs`（认证；mime allowlist png/jpeg/gif/webp/avif；≤10 MiB）；`GET /api/public/blobs/:hash`（匿名；`cache-control: immutable` —— content-addressed 使激进缓存绝对安全）。
4. **SVG 排除**：直接导航到 served SVG 会在本源执行脚本（XSS）；进 allowlist 前需要 sanitize 管线，deferred。
5. **Blob URL = capability URL**（记录的 trade-off）：hash 不可枚举，但持有 URL 即可取字节——私有页图片不受 page 级 no-leak 保护。MVP 接受；future 若需要 per-blob 授权，走 signed URL 或 auth-gated read。
6. **不做**：GC/retention（surfaced debt → future backup/retention ADR；备份对象自此 = DB 文件 + blobs 目录）、缩略图/srcset、S3 adapter（`BlobStore` class 即 seam）。

## Consequences

- 备份/恢复语义变化：`data/` 目录整体才是完整实例状态（[ADR-0020] 升级文档同步）
- 删除 notepage/block 不回收 blob——磁盘只增不减，Solo NAS 长期需 GC（显式 debt）
- 第二个 BlockKindModule（image）零特殊化接入 registry/编辑器/读路由，seam 泛化得证

## Alternatives considered

1. **DB 内 BLOB 列** —— 拒绝：SQLite 单文件随图片膨胀，备份/迁移成本失控；WAL 压力大。
2. **可变文件名（uuid，允许覆盖）** —— 拒绝：破坏两态快照引用稳定性，需要引用计数才能安全删除。
3. **直接上 S3 adapter 框架** —— 拒绝：mvp-scope D4（seam 不建系统）；Solo NAS 默认不需要。

## References

- Source discussion: [mvp2-scope-2026-06-11.md](../design/discussions/mvp2-scope-2026-06-11.md)
- PRDs: [block-image.md](../../product/prd/features/blocks/block-image.md) / [notepage.md](../../product/prd/features/notepage/notepage.md) / [self-host-deploy.md](../../product/prd/features/self-host-deploy/self-host-deploy.md)
- Migrations: [ADR-0020](./ADR-0020-db-migrations-upgrade.md)
