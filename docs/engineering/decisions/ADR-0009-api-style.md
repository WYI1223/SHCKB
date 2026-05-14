# ADR-0009: API style — GET + POST collapsed, action in path

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.12 |

## Context

REST API 风格选择。Initial 提议 full REST (GET / POST / PATCH / PUT / DELETE)；user 反馈 "业内人士说，GET POST 后来基本上全部都采用 POST 了，其他的很少采用了"。

业内 webapp API 现状（2026）：
- Stripe / Slack / Twitter v2 / Vercel API / Linear（GraphQL）等大厂偏 POST-dominant 95%+
- PATCH / PUT / DELETE 实际很少用

## Decision

**只用 GET + POST**：
- **GET** 用于公开 / authenticated read（CDN cacheable + Lighthouse 友好）
- **POST** 用于全部 mutation（create / update / delete）
- **Action 通过 path 表达，不通过 body discriminator**
- **PATCH / PUT / DELETE 不用**

### Endpoint shape

```
# READ (GET)
GET    /                                          首页（recent / featured）
GET    /notes/:slug                               公开 note SSR HTML
GET    /api/notes/:slug                           note JSON
GET    /api/notes/:slug/blocks/:id                单 block JSON
GET    /api/me                                    当前 user
GET    /api/notes/mine                            我的 notes 列表
GET    /api/agent/schema                          plugin agentOps 发现
GET    /sitemap.xml | /rss.xml

# MUTATION (POST) — session-gated
POST   /api/auth/login | /logout | /register
POST   /api/notes/create                          body: { slug, title, visibility, ... }
POST   /api/notes/:slug/update                    body: { title?, visibility?, theme? }
POST   /api/notes/:slug/delete                    body: {}
POST   /api/notes/:slug/blocks/insert             body: { kind, col, row, colSpan, rowSpan, props, content }
POST   /api/notes/:slug/blocks/:id/move           body: { col, row }
POST   /api/notes/:slug/blocks/:id/resize         body: { colSpan, rowSpan }
POST   /api/notes/:slug/blocks/:id/transform      body: { col?, row?, colSpan?, rowSpan? }
POST   /api/notes/:slug/blocks/:id/delete         body: {}
POST   /api/notes/:slug/blocks/:id/op/:opName     body: pure args (plugin agentOps dispatch)

# AGENT (POST) — API token gated
POST   /api/agent/dispatch                        body: 见 ADR-0015
WS     /api/agent/ws                              streaming bidirectional（Phase 2+；Day-1 SSE 替代）
```

### Exposure 矩阵

| Pattern | 暴露 | 鉴权 |
|---|---|---|
| GET 公开 read | 公开 | none |
| GET 鉴权 read | 公开 endpoint | session cookie |
| POST mutation | 公开 endpoint | session cookie + CSRF token |
| POST agent | 公开 endpoint | bearer token |
| WS agent | 公开 endpoint | bearer token via initial auth msg |

### 内部 grid-engine ops never exposed directly

通过 API endpoint 间接调；endpoint 负责 auth + ownership validation + repository transaction 包装。

## Consequences

**Positive**:
- 中间件简化（CSRF / auth / rate-limit 只 handle POST 一种 mutation）
- 防火墙 / proxy 兼容性最广（部分 corporate proxy 仍 filter PATCH / DELETE）
- CSRF 防护在 POST 上模式成熟
- `fetch` + form action 默认 GET/POST；client code 直观
- CDN / 反代对 GET universal；对 PATCH 偶有怪行为
- Agent semantic API (ADR-0005) 本来就是 POST-RPC；一致
- OpenAPI gen 输出更扁平（一 path 一 operation）；客户端 type 直观

**Negative / Trade-offs**:
- REST 纯粹主义者觉得不 semantic（PATCH = partial update / DELETE = remove）；但工业界 drift 验证此选择
- spec 文件比 full REST 长（每 mutation 独立 endpoint）；but tradeoff 接受

**Risks**:
- 第三方 LLM agent / 自动化工具假设 REST verbs；通过 OpenAPI spec 文档化 endpoint pattern mitigate

## Alternatives considered

- **Full REST (GET / POST / PATCH / PUT / DELETE)**: 旧 repo spec 默认；rejected per industry drift + middleware simplification
- **GraphQL**: 强类型 + 一 endpoint 多 query；但与 §11.4 MCP tool use shape mismatch；rejected per protocol alignment
- **JSON-RPC over single endpoint**: 类 MCP 但人类 UI 不直观；rejected per multi-caller experience
- **gRPC + Protobuf**: 强类型 + 双向 stream 但 browser 不 native；rejected per scope

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.12 + §6 L9.5
- Related ADRs: ADR-0012 (OpenAPI gen), ADR-0015 (agent wire protocol)

## Changelog

- 2026-05-13 initial draft (decision LOCKED 2026-05-12 in source DI doc per user industry feedback)
