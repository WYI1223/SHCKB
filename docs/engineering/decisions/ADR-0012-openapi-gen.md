# ADR-0012: OpenAPI gen 链路 — zod-first + REST + agent registry split

> **DEPRECATED / LEGACY DRAFT (2026-05-23)**: This ADR is retained only as historical carryover. It MUST NOT be used as an authoritative source for product behavior, architecture, implementation plan, or technology-stack choice. Technology choices must be derived from current PRDs and product shape, then captured in new PRD-informed ADRs. Treat any Decision/Consequences/technology names below as suspect until re-ratified.

| Field | Value |
|---|---|
| Status | deprecated (legacy draft; PRD-rework required) |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §5.5 + §11.12 + agent API discussions |

## Context

API surface（ADR-0009 REST + ADR-0015 MCP）需要文档化 + client codegen + agent discoverable。zod 已是 plugin contract（ADR-0014）+ DB schema（ADR-0006 Drizzle）的核心 type-source；自然延伸到 API spec。

业内 2026 主流：
- `openapi-typescript` 纯 TS 类型 codegen（轻）
- `orval` / `kubb` / `hey-api` runtime client 
- `@hono/zod-openapi` framework-native plugin
- `@asteasolutions/zod-to-openapi` framework-agnostic
- `redocly` / `swagger-ui` docs site renderer

## Decision

### 链路：zod source-of-truth → 多产物 derive

```
zod schemas (server route + plugin contract)
    │ build-time
    ▼
@hono/zod-openapi 或 @asteasolutions/zod-to-openapi 生成 openapi.json
    │ build-time
    ▼
openapi-typescript 生成 client paths types
    │ build-time + dev hot reload
    ▼
Client import paths types；fetch with TS type safety
    │ runtime
    ▼
Server 用同样 zod schema runtime validate body / params (zod parse)
```

一份 zod schema 衍生：
- OpenAPI spec
- TS client types
- Runtime validation
- IDE autocomplete + 错误检查

### REST endpoint 走 OpenAPI 主线

§6 L9.5 REST endpoints（详 ADR-0009）每个 endpoint 用 `@hono/zod-openapi` route definition；自动 emit 到 openapi.json。

### Agent op registry 走分离 schema 而非全进 OpenAPI

**Why split**: 10 个 plugin × 几个 agentOp/plugin ≈ 50+ agentOp endpoints；全 emit OpenAPI 会膨胀 spec 文件。

**方案 b (chosen)**:
```yaml
# openapi.json 只有 1 个 dispatcher endpoint
/api/agent/dispatch:
  post:
    requestBody: { op: string, args: any }   # any → 文档外补充
    responses: ...
```

`packages/agent-api/src/registry.ts` 单独维护 op-name → arg-schema 映射：

```ts
export const agentOpRegistry = {
  'math.set_tex': { args: z.object({ tex: z.string() }), description: '...' },
  'code.set_source': { args: z.object({ source: z.string(), language: z.string() }), description: '...' },
  // plugin 注册自己的 ops
} satisfies Record<string, AgentOpSchema>;
```

`GET /api/agent/schema` endpoint 暴露 registry → agent 一次 GET 拿全集。MCP `tools/list` 同源 dump（详 ADR-0015）。

### OpenAPI doc site

- `docs/api/openapi.json` 入 git（build artifact）
- CI 每次 build 自动 regen + drift check（diff 不为零 → fail，强制 commit 最新）
- 公开 docs 用 redocly 静态渲染
- Admin-only swagger-ui 是 nice-to-have（Phase 2+）

## Consequences

**Positive**:
- 单 zod source；OpenAPI / TS types / runtime validation 三个产物从同源 derive；no drift
- REST endpoints 自动 documented；agent 端通过 schema discoverable
- Client codegen 简单（openapi-typescript 输出纯类型）
- Plugin agentOps 注册不动 OpenAPI spec；plugin add/remove 不需要 regen 巨大 spec 文件

**Negative / Trade-offs**:
- 两条 discovery 路径（OpenAPI for REST / agent-api registry for tools）；client / agent 需要分别 ingest；mitigate by `GET /api/agent/schema` 端点 unify discovery
- Agent client 不能直接从 OpenAPI 看到所有 op；要单独 ingest registry（多一步）；mitigate by registry 是单 GET 调用

**Risks**:
- OpenAPI spec / zod schemas / registry drift；mitigate by CI build-time check（diff fail）
- redocly / openapi-typescript 演化破坏 tooling；mitigate by pinning versions + 主流工具长期稳定

## Alternatives considered

- **Each agentOp 作 OpenAPI endpoint (方案 a)**: spec 膨胀 50+ endpoints；plugin add 时改 spec；rejected per simplicity
- **GraphQL replacing OpenAPI**: 强 schema + introspection 但与 §11.4 MCP tool use 形态 mismatch；rejected per ADR-0015 alignment
- **手写 OpenAPI YAML**: drift risk + 工作量；rejected per zod-first 自动 gen 更稳
- **No OpenAPI (internal-only types)**: 失去外部 agent / third-party CLI / desktop 接入；rejected per `product/prd/project.md` (self-hostable 多 client 形态)

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §5.5 (zone) + §11.12 (REST style) + agent API discussions
- Related ADRs: ADR-0006 (Bun + Hono stack), ADR-0009 (REST style), ADR-0014 (plugin contract incl. agentOps schema), ADR-0015 (MCP wire protocol)

## Changelog

- 2026-05-13 initial draft (decision LOCKED 2026-05-13 cascading-confirm from §5.5 + §11.12 / supplemental decision derived from REST + MCP integration)
