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

底层数据 substrate 决定了 read / write / agent / storage 形态。旧 spec 选 MDX 文件 + git-as-DB；framing 复盘暴露这个选择是 "personal markdown wiki" 默认值的产物，不匹配 self-hostable webapp + multi-user + discussion + multi-scale 的真实需求（详 `product/prd/project.md`）。

### 范围澄清

本 ADR 只决定 **operational data 持久化层**（live data store）—— server-side 服务的"数据在哪、形态如何"。以下三件事是**独立 concern**，明确不在本 ADR 范围：

| 独立 concern | 归属 | 与本 ADR 关系 |
|---|---|---|
| **版本控制 (git)** | 只管 codebase / config / docs | 本 ADR **不定义 git 作为 operational data substrate**；git 只在 Alternatives 作历史反例出现 |
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
block_blobs         (id, block_id, storage_key, mime, size, hash,
                     created_at, deleted_at)
#   storage_key 指向 object storage（ADR-0007）；binary bytes 不在 DB
#   deleted_at: timestamp | null —— tombstone soft-delete；常规读路径必过滤 deleted_at IS NULL
#   物理 GC（DELETE row + storage.delete blob）由 ADR-0017 retention-aware policy 触发，不在本 ADR 范围

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

部分 plugin 可拥有 sidecar tables，用于承载 `content_inline` / `props_json` 不适合表达的复杂数据（如 discussion plugin 的 `discussions` / `discussion_posts`，或未来 nn-viz / kernel-session 等高基数子 entry 场景）。

**所有权边界**：
- **Plugin-owned**: sidecar 表的 schema 定义 + migrations（DDL）属于 plugin 自身资产；framework **不**自动生成任意 sidecar 表
- **Framework-coordinated**: framework 只负责 plugin 注册时把 plugin 声明的 migrations 接入全局 migration 调度器，以及为 plugin 提供 repository access boundary（详 ADR-0014 + future ADR）

**Carrier mechanism — intentionally deferred**：

ADR-0002 只**预留** sidecar substrate pattern 和示例表形态，**不定义** sidecar schema / migration 在 BlockPlugin contract 上的具体承载机制。具体携带形态（DDL 文件位置 / Drizzle multi-dialect 路径 / 注册时机 / migration 调度集成点）**intentionally deferred**。

**Blocker invariant**（mechanism-driven，非 milestone-driven）：

> 第一个需要 sidecar tables 的 plugin（不限定哪个 plugin —— discussion / nn-viz / 其他先到先 trigger）在写第一行 sidecar DDL 之前，**必须通过 follow-up ADR 或综合 architecture synthesis 锁定 carrier mechanism**。不允许在 carrier 未 lock 时凭隐式约定开始 sidecar plugin 实装。

理由：当下没有 lived implementation pressure；趁 ADR-0002 review 热度抽象 lock carrier 易自造约束（与本项目 framing-control retro 教训一致 —— 详 `product/retrospectives/framing-control-2026-05.md`，Phase D 待写）。

`contentStorageHint: 'sidecar-table'`（ADR-0004 / ADR-0014）仅作 plugin 声明 hint，不预设 framework 自动建表。

### ID stability invariants

- `blocks.id` UUID (cuid2 / nanoid)，**永不重用**
- `notes.id` 永不重用
- `notes.slug` **Day-1 immutable**（一旦创建不可改）；slug **永不复用**（不同 note 不能拿同一 slug）
- 未来若需支持 note rename：必须新增 `note_slug_aliases` 表（旧 slug → 当前 note_id redirect），旧 slug 仍永不复用；rename 走 alias 而非 mutation
- 跨外部 hyperlink / wikilink / backlink 索引依赖以上 invariants（详 ADR-0013）

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

- **MDX 文件 + git-as-DB**: 不支持 multi-user write + auth；不能存 sessions；rejected per `product/prd/project.md` (self-hostable platform 形态)
- **TOML + per-block files**: file-system metaphor 和 "constrained canvas" 心智不一致；agent access pattern 变弱；rejected per source DI doc §11.2
- **Single-file TOML**: 简化 file count 但仍是 file-not-DB；multi-user write race condition；rejected per §11.2
- **NoSQL (MongoDB / Couchbase)**: relational schema fits notes/blocks/users naturally；NoSQL flexibility 没用；rejected per simplicity preference

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §3 + §6 L1 + §11.2 (closed)
- Related ADRs: ADR-0001 (canonical deployment artifact), ADR-0004 (plugin model), ADR-0006 (backend stack incl. DB), ADR-0007 (storage), ADR-0014 (plugin contract details), ADR-0017 (backup strategy)

## Changelog

- 2026-05-13 initial draft (decision LOCKED 2026-05-11 in source DI doc)
- 2026-05-14 owner review fix (pass 1): removed "Git 关系" subsection — git 只管 codebase 非 substrate concern；backup 分离到独立 ADR-0017；Consequences 去 git-baseline 对比；scope 澄清写入 Context
- 2026-05-14 owner review fix (pass 2): de-git 决策贯穿全文 —— 修 schema 草图 `block_blobs` 自相矛盾（删 `bytes` 选项；纯 metadata + storage_key）；明确 `block_blobs` 表 ↔ ADR-0014 `blobRefs` view 对应关系；schema 草图补 plugin sidecar tables（discussions / discussion_posts）；合并 Context 范围澄清与 "operator 自持" 节去冗余
- 2026-05-16 external review fix (pass 3) —— 4 处必改 + 跨 ADR 一致性：
  - line 22 git 措辞精确化（"不定义 git 为 operational data substrate；只在 Alternatives 作历史反例"）
  - `notes.slug` 加 Day-1 immutable invariant + 未来 rename 走 alias 表（旧 slug 永不复用）
  - sidecar 段重写：plugin-owned schema/migrations + framework-coordinated registration；carrier mechanism intentionally deferred；blocker invariant 绑 "第一个 sidecar plugin 实装"（mechanism-driven）；**不**新开 ADR-0019（与 framing-control retro 教训一致）
  - `block_blobs` schema 加 `deleted_at` tombstone 列；常规读必过滤 tombstone；物理 GC policy 拆给 ADR-0017（retention-aware GC window 不属于 substrate ADR）
