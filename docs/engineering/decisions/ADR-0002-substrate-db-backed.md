# ADR-0002: Substrate — DB-backed with plugin serializer

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §3 + §6 L1 + §11.2 |

## Context

底层数据 substrate 决定了 read / write / agent / storage 形态。旧 spec 选 MDX 文件 + git-as-DB；framing 复盘暴露这个选择是 "personal markdown wiki" 默认值的产物，不匹配 self-hostable webapp + multi-user + discussion + multi-scale 的真实需求（详 ADR-0001）。

### 范围澄清

本 ADR 只决定 **operational data 持久化层**（live data store）—— server-side 服务的"数据在哪、形态如何"。以下三件事是**独立 concern**，明确不在本 ADR 范围：

| 独立 concern | 归属 | 与本 ADR 关系 |
|---|---|---|
| **版本控制 (git)** | 只管 codebase / config / docs | 与数据层完全无关；不是 substrate 决策；本 ADR 不提 git |
| **备份** | ADR-0017 (pluggable BackupProvider) | live data 在 DB；"如何不丢"由备份负责；本 ADR 不规定备份机制 |
| **持久化由谁运维** | operator 自持 | DB 文件 / 实例由 operator 自持（SQLite 文件在 operator 磁盘 / Postgres operator 自跑或租 managed / D1 on Cloudflare）；本 ADR 只规定 live data 在 DB，不规定 operator 如何运维它 |

候选 substrate：
- (a) MDX 文件 + git-as-DB
- (b) TOML + per-block files
- (c) Single-file TOML
- (d) Server-side DB
- (e) DB + 多 backend pluggable (SQLite / Postgres / D1)

## Decision

**Server-side DB-backed substrate，DB engine pluggable（详 ADR-0006）**。

### 数据形态

Schema 草图（rough shape；plugin contract 决定 `props_json` / `content_inline` 列细节）：

```
# Core tables
users               (id, handle, email, password_hash, role, created_at)
sessions            (token, user_id, expires_at)
notes               (id, slug, owner_id, title, frontmatter_json, visibility, created_at, updated_at)
blocks              (id, note_id, kind, col, row, col_span, row_span,
                     props_json, content_inline, plugin_version)

# Blob 元数据表 —— 纯 metadata + storage key，不存 binary 本身
block_blobs         (id, block_id, storage_key, mime, size, hash, created_at)
#   storage_key 指向 object storage（ADR-0007）；binary bytes 不在 DB

# Plugin sidecar tables —— plugin 声明 contentStorageHint: 'sidecar-table' 时框架建
#   例：discussion plugin（ADR-0004）
discussions         (id, note_id, block_id, enabled, settings_json)
discussion_posts    (id, discussion_id, author_id, body_md, parent_id, created_at)
```

### Binary —— 不入 DB

- Binary content（image / pdf / etc.）**不入 DB BLOB column**
- 实际 bytes 走 object storage（详 ADR-0007）
- DB 的 `block_blobs` 表只存 **metadata + `storage_key`**（mime / size / hash / 指向 object storage 的 key）

### Plugin serializer ↔ blob 表对应关系

Plugin contract 提供 `serializer.{toRow, fromRow}`（详 ADR-0004 + ADR-0014）：
- `serializer.toRow` 输出 `DbRow = { contentInline?, blobRefs?: Array<{key, mime, size?, hash?}> }`
- 持久化层（§6 L3）把 `DbRow.contentInline` 写 `blocks.content_inline`，把 `DbRow.blobRefs` 每条写一行到 `block_blobs` 表
- `serializer.fromRow` 反向：从 `blocks` row + 关联 `block_blobs` rows 重组 `DbRow` → plugin BlockState
- 即：`blobRefs` 是 serializer 的 **view**；`block_blobs` 是它的 **storage table**；一一对应

### Plugin sidecar tables

Plugin 声明 `contentStorageHint: 'sidecar-table'`（ADR-0004）时，框架为该 plugin kind 建 sidecar 表（如 discussion plugin 的 `discussions` / `discussion_posts`）。多 author / 大量子 entry 的 plugin 用此模式而非 `content_inline`。

### ID stability invariants

- `blocks.id` UUID (cuid2 / nanoid)，**永不重用**
- `notes.id` + `notes.slug` 永不重用
- 跨外部 hyperlink / wikilink / backlink 索引依赖此不变量（详 ADR-0013）

## Consequences

**Positive**:
- 支持 multi-user write
- 支持 transactional ACID 操作
- Schema migration 工具化（Drizzle 等）
- Read path SSR 直接从 DB 渲染 → 低延迟 + CDN cacheable
- Plugin contract 解耦 plugin 内部表达和持久化形态

**Negative / Trade-offs**:
- 改 plugin content 必须经 API（不能直接编辑底层文件）
- Operator 需配置 DB connection（SQLite 文件路径 / Postgres connection string）
- 备份是独立 operational concern，需要明确策略（详 ADR-0017），不是 substrate 自带

**Risks**:
- DB schema 变更需谨慎；plugin version migration 必须 robust（详 ADR-0014）
- 单 SQLite 文件高写入下需要 WAL mode；备份策略详 ADR-0017

## Alternatives considered

- **MDX 文件 + git-as-DB**: 不支持 multi-user write + auth；不能存 sessions；rejected per ADR-0001 product environment
- **TOML + per-block files**: file-system metaphor 和 "constrained canvas" 心智不一致；agent access pattern 变弱；rejected per source DI doc §11.2
- **Single-file TOML**: 简化 file count 但仍是 file-not-DB；multi-user write race condition；rejected per §11.2
- **NoSQL (MongoDB / Couchbase)**: relational schema fits notes/blocks/users naturally；NoSQL flexibility 没用；rejected per simplicity preference

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §3 + §6 L1 + §11.2 (closed)
- Related ADRs: ADR-0001 (product), ADR-0004 (plugin model), ADR-0006 (backend stack incl. DB), ADR-0007 (storage), ADR-0014 (plugin contract details), ADR-0017 (backup strategy)

## Changelog

- 2026-05-13 initial draft (decision LOCKED 2026-05-11 in source DI doc)
- 2026-05-14 owner review fix (pass 1): removed "Git 关系" subsection — git 只管 codebase 非 substrate concern；backup 分离到独立 ADR-0017；Consequences 去 git-baseline 对比；scope 澄清写入 Context
- 2026-05-14 owner review fix (pass 2): de-git 决策贯穿全文 —— 修 schema 草图 `block_blobs` 自相矛盾（删 `bytes` 选项；纯 metadata + storage_key）；明确 `block_blobs` 表 ↔ ADR-0014 `blobRefs` view 对应关系；schema 草图补 plugin sidecar tables（discussions / discussion_posts）；合并 Context 范围澄清与 "operator 自持" 节去冗余
