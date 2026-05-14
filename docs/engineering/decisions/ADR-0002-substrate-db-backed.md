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

**范围澄清**：本 ADR 只决定 **operational data 持久化层**（live data store）。这是一个 server-side 服务的数据层，跟以下两件事是**独立 concern**，不在本 ADR 范围：
- **版本控制 (git)** —— 只管 codebase / config / docs；与数据层无关，不是 substrate 决策
- **备份** —— 独立 operational concern；可配置 backup provider，详 ADR-0017；本 ADR 不规定备份机制

候选 substrate：
- (a) MDX 文件 + git-as-DB
- (b) TOML + per-block files
- (c) Single-file TOML
- (d) Server-side DB
- (e) DB + 多 backend pluggable (SQLite / Postgres / D1)

## Decision

**Server-side DB-backed substrate，DB engine pluggable（详 ADR-0006）**。

### 数据形态

```
Tables (rough shape; plugin contract 决定 props_json / content_inline 列细节):

users               (id, handle, email, password_hash, created_at, role, ...)
notes               (id, slug, owner_id, title, frontmatter_json, visibility, created_at, updated_at)
blocks              (id, note_id, kind, col, row, col_span, row_span, props_json, content_inline, plugin_version)
block_blobs         (block_id, mime, bytes | url_ref)
sessions            (token, user_id, expires_at)
```

### Plugin serializer

Plugin contract 提供 `serializer.{toRow, fromRow}` —— 把 plugin 自定 BlockState 映射到 DB row + blob refs。详 ADR-0004 + ADR-0014。

### ID stability invariants

- `blocks.id` UUID (cuid2 / nanoid)，**永不重用**
- `notes.id` + `notes.slug` 永不重用
- 跨外部 hyperlink / wikilink / backlink 索引依赖此不变量（详 ADR-0013）

### Binary

- 不入 DB BLOB column
- 走 object storage（详 ADR-0007）
- DB 只存 blob URL ref + metadata（mime / size / hash）

### 数据持久化 = operator 自持的 live store

- DB 文件 / 实例由 operator 自持（SQLite 文件在 operator 磁盘 / Postgres operator 自跑或租 managed / D1 on Cloudflare）
- 持久化层的"如何不丢"由**备份**负责，是独立 concern → ADR-0017
- 本 ADR 不规定备份机制；只规定 live data 在 DB

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
- 2026-05-14 owner review fix: removed "Git 关系" subsection — git 只管 codebase 非 substrate concern；backup 分离到独立 ADR-0017；Consequences 去 git-baseline 对比；scope 澄清写入 Context
