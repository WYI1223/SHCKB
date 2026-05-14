# ADR-0002: Substrate — DB-backed with plugin serializer

| Field | Value |
|---|---|
| Status | accepted |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §3 + §6 L1 + §11.2 |

## Context

底层数据 substrate 决定了所有 read / write / agent / storage / git diff / backup 形态。旧 spec 选 MDX 文件 + git-as-DB；framing 复盘暴露这个选择是 "personal markdown wiki" 默认值的产物，不匹配 self-hostable webapp + multi-user + discussion + multi-scale 的真实需求（详 ADR-0001）。

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

### Git 关系

- Source code / config / migrations / docs 走 git
- Notes / blocks / discussions / sessions 全在 DB
- Backup: DB dump → git or object storage（详 runbooks）

## Consequences

**Positive**:
- 支持 multi-user write（git-as-DB 不能）
- 支持 transactional ACID 操作
- Schema migration 工具化（Drizzle 等）
- Read path SSR 直接从 DB 渲染 → 低延迟 + CDN cacheable
- Plugin contract 解耦 plugin 内部表达和持久化形态

**Negative / Trade-offs**:
- "vim 改一个文件" 这种 git-native workflow 失去；改 plugin content 必须经 API
- Backup 不是 git commit 自带，需要 explicit dump
- Operator 需配置 DB connection（vs git pull / push 简单）

**Risks**:
- DB schema 变更需谨慎；plugin version migration 必须 robust（详 ADR-0014）
- 单 SQLite 文件高写入下需要 WAL mode + 不同 backup 策略

## Alternatives considered

- **MDX 文件 + git-as-DB**: 不支持 multi-user write + auth；不能存 sessions；rejected per ADR-0001 product environment
- **TOML + per-block files**: file-system metaphor 和 "constrained canvas" 心智不一致；agent access pattern 变弱；rejected per source DI doc §11.2
- **Single-file TOML**: 简化 file count 但仍是 file-not-DB；multi-user write race condition；rejected per §11.2
- **NoSQL (MongoDB / Couchbase)**: relational schema fits notes/blocks/users naturally；NoSQL flexibility 没用；rejected per simplicity preference

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §3 + §6 L1 + §11.2 (closed)
- Related ADRs: ADR-0001 (product), ADR-0004 (plugin model), ADR-0006 (backend stack incl. DB), ADR-0007 (storage), ADR-0014 (plugin contract details)

## Changelog

- 2026-05-13 initial draft + accepted (LOCKED 2026-05-11 in source DI doc)
