# ADR-0008: Search provider abstraction — pluggable FTS

| Field | Value |
|---|---|
| Status | accepted |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.14 |

## Context

10 年 / 10GB+ / 数千 entries 的 KB scale 下 full-text search 是核心 user value。不同 operator scale 需要不同 search backend：
- Solo / 几百篇 → SQLite FTS5 built-in，零 ops
- Team / 几千篇 → Postgres tsvector + GIN index
- Public / 几万 + 高并发 → 外部 search service（Meilisearch / Typesense / Elasticsearch）

Old spec 选 Pagefind（build-time 静态索引）；framing 复盘暴露这是 static-site default 产物，不适合 multi-user write + 实时 query 场景。

## Decision

**Pluggable `SearchProvider` interface + 3 built-in adapter + 外部 service adapter**：

```ts
interface SearchProvider {
  index(documents: SearchDocument[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
  query(q: string, opts?: SearchOptions): Promise<SearchResult[]>;
  rebuild(): Promise<void>;            // full reindex
}

type SearchDocument = {
  id: string;                          // typically block.id 或 note.id
  type: 'note' | 'block';
  title?: string;
  content: string;                     // plain text extracted from block
  tags?: string[];
  noteId?: string;
  blockKind?: string;
  metadata?: Record<string, unknown>;
};

type SearchOptions = {
  filter?: { type?, blockKind?, tags?, noteId?, ... };
  limit?: number;
  offset?: number;
  highlight?: boolean;
};

type SearchResult = {
  id: string;
  score: number;
  snippet?: string;
  document: SearchDocument;
};
```

Built-in adapters:
- **SqliteFtsProvider** —— SQLite FTS5 内置，零额外 service；solo / NAS default
- **PostgresFtsProvider** —— tsvector + GIN index；Postgres deploy default
- **MeilisearchProvider** —— external Meilisearch service；high-scale / 复杂 search needs
- **(future) TypesenseProvider / ElasticProvider** —— Phase 2+ 按需

### Install 时 prompt（受 §11.7 DB 选择影响）

```bash
SEARCH_PROVIDER=sqlite-fts|postgres-fts|meilisearch
# if meilisearch:
SEARCH_MEILI_URL=
SEARCH_MEILI_API_KEY=
```

Default: 跟 DB 选择匹配（`DATABASE_URL=sqlite:...` → `SEARCH_PROVIDER=sqlite-fts`；`DATABASE_URL=postgres:...` → `SEARCH_PROVIDER=postgres-fts`）。Operator 可 override（e.g., Postgres DB + Meilisearch search）。

### Indexing trigger

- Block / note insert / update → background async index update（不阻塞 write transaction）
- Block delete → remove from index
- Plugin agentOp 自动 trigger reindex via framework wrapper
- Full rebuild via `rebuild()` 命令（runbooks）

### Plain text extraction

每 plugin 提供 `extractPlainText(state: BlockState) → string` helper（plugin contract optional method，详 ADR-0014）。Framework call 此提取 → 喂 SearchProvider.index。

## Consequences

**Positive**:
- Operator 自由选 search backend
- Day-1 SQLite FTS5 零额外 service；solo deploy 体验最简
- Phase 2+ 可升级 external Meilisearch / Typesense；不需改 plugin code
- Plugin `extractPlainText` 是 native 实现；不依赖 generic markdown stripping

**Negative / Trade-offs**:
- 3 个 adapter 实现 + 维护成本；mitigate by SQLite FTS5 + Postgres tsvector 是 built-in DB features 不是新 service
- Async indexing 引入 brief inconsistency 窗口（write 后立刻 search 可能 miss）；mitigate by short async timeout（< 1s）+ 文档说明
- 跨 search provider 行为差异（相关性算法 / highlight 格式）；framework 提供 normalized result shape

**Risks**:
- 大 reindex 耗时（10GB / 数千 block）；通过 background job + progress reporting + runbook 文档
- SQLite FTS5 vs Postgres tsvector 中文 / CJK tokenization 不同；通过 adapter-level config 暴露

## Alternatives considered

- **Pagefind (static index)**: build-time only；不支持 multi-user write 后 incremental update；rejected per ADR-0001 product environment
- **Algolia / Elasticsearch SaaS only**: external service mandatory；不适合 solo / NAS；rejected
- **DB LIKE / ILIKE queries**: 性能差 + 无 ranking；rejected per scale
- **Vector-only search (embedding)**: 适合 semantic search 但不替代 FTS；Phase 2+ 作 augment 加（rejected for Day-1 primary）

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.14
- Related ADRs: ADR-0001 (deploy matrix), ADR-0006 (DB choice influences default), ADR-0014 (plugin extractPlainText)

## Changelog

- 2026-05-13 initial draft + accepted (LOCKED 2026-05-12 in source DI doc)
