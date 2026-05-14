# ADR-0006: Backend stack — TS + Bun + Hono + Drizzle multi-dialect

| Field | Value |
|---|---|
| Status | accepted |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.7 + §11.8 |

## Context

选 backend language + runtime + framework + DB + ORM + deploy target。约束：
- Plugin extension（ADR-0004）shouldn't be limited by backend language
- Cross-arch / multi-OS / multi-PaaS（ADR-0001 deployment matrix）
- 10GB+ 数据 scale 而 backend memory 不储存 corpus（流过）
- 性能不能明显差于同类方案
- Solo dev + AI 加持

旧 spec ADR-0001 选 Python FastAPI（理由 "与 Jupyter 同语言"）；framing 复盘暴露 Pyodide 在 client-side，server 不需 Python，且 plugin extension 模型强烈要求 server 同 TS 才能让 plugin 单包含 client + server code。

## Decision

### Backend language: **TS LOCKED**

Plugin extension model 是硬要求；plugin 同包含 server-side handler (agentOps) + client-side EditView / RenderView 必须同语言，否则 plugin author 写两套 + 双 registry 注册 + serializer 同步问题。

旧 Python FastAPI 的理由（"与 Jupyter 同语言"）moot 了：Pyodide 在 client-side。

### Runtime: **Bun 主线 + Node fallback**

- Bun 一线：`bun build --compile` 出真 single binary（cross-platform）；memory baseline 30-60MB（接近 Go）；cold start 30-80ms；TS 原生；2025+ 稳定生产
- Node fallback：同一 codebase 跑 Node 兼容 small-niche 环境
- Cloudflare Workers (Bun-compat Hono build)：edge runtime；冷启动快但 vendor lock

### Framework: **Hono**

Runtime-agnostic（Bun / Node / Workers 都跑）；middleware ecosystem 健全（zod-openapi / OAuth / CSRF / rate-limit / etc.）；轻量；与 §11.4 wire protocol 选择（详 ADR-0015）兼容。

### DB engine: **Pluggable via Drizzle ORM**

```bash
# install 时 prompt
DATABASE_URL=                  # sqlite | postgres | d1
```

支持 SQLite (default solo / NAS) / Postgres (managed PaaS) / Cloudflare D1 (edge)。Drizzle 同 query API 跨 dialect。Schema migration via drizzle-kit（一份 schema 跨 dialect）。

### Deploy target matrix

详 ADR-0001 §0.6。5 mode 全 first-class：
- Docker compose（NAS / 自建 / VPS）
- Single binary（NAS / 主机 / 低端 VPS）—— Bun-compiled
- Cloud PaaS（Fly / Render / Railway）—— managed Postgres
- Cloud VPS（Tencent / Aliyun / AWS Lightsail / Hetzner）—— operator 选
- Edge / Workers（Cloudflare）—— D1 + R2

### Cross-arch + OS

- x86_64 + ARM64
- Linux 主线；macOS dev；Windows via WSL2 / Docker

## Consequences

**Positive**:
- Plugin extension 单包模型 work（核心动机）
- Carryover 100% TS（grid-engine / grid-themes / kernel-*) 完全复用
- Bun footprint 接近 Go；NAS 部署友好
- Single-binary deploy 接近 Pocketbase 体验
- Multi-dialect DB → operator 自由度高

**Negative / Trade-offs**:
- Bun 比 Node mainstream 较新；某些 npm package 兼容性 edge case；mitigate by Node fallback
- 没有 native Python pipeline；如未来 server-side ML 大量介入，需加 Python side-car
- Drizzle ORM 比 Prisma 略 niche；mitigate by good ecosystem traction 2025+

**Risks**:
- Bun runtime / Hono / Drizzle 任一关键依赖 deprecate → mitigate by Node fallback + Hono 多 framework 备选 + Drizzle migration 可导 SQL
- 大型 PR 性能调优（10k 并发 WS 等）；mitigate by Phase 2+ benchmark + 横向 scale stateless 设计

## Alternatives considered

- **Python FastAPI**: 旧 spec；rejected per plugin extension model + Pyodide moot
- **Go (Pocketbase pattern)**: 优秀 footprint 但 plugin 单包模型 break；rejected per ADR-0004
- **Rust (axum)**: 同 Go；steeper learning；rejected
- **Node-only (no Bun)**: 失去 single-binary 部署 + 较重 baseline；Bun 已稳定可生产；rejected per better tradeoff
- **Next.js / Remix as framework**: 绑 React-server-component 范式；与 Hono runtime-agnostic 设计 mismatch；rejected
- **Postgres-only DB**: 失去 SQLite solo / NAS friendliness；rejected per ADR-0001 deploy matrix
- **SQLite-only DB**: 失去 multi-write Postgres scenario；rejected
- **NoSQL**: relational shape fits notes/blocks/users naturally；rejected per simplicity
- **Prisma over Drizzle**: codegen heavier + multi-dialect 不如 Drizzle；rejected

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.7 + §11.8
- Related ADRs: ADR-0001 (deploy matrix), ADR-0002 (DB-backed substrate), ADR-0004 (plugin model), ADR-0010 (performance SLO)

## Changelog

- 2026-05-13 initial draft + accepted (LOCKED 2026-05-12 in source DI doc)
