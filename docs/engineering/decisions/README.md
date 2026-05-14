# Architecture Decision Records (ADRs)

**Append-only** decision records。锁定后内容不改；变更走 supersede 机制。

## 规则

详见 [`../../process/methods/adr-discipline.md`](../../process/methods/adr-discipline.md)。摘要：

- ❌ 不修改已 `accepted` 的 ADR（除 metadata 类 status 更新）
- ✅ 变更决策 → 新 ADR with `Supersedes: ADR-XXXX`；旧 ADR 改 status 为 `superseded`，加 link 到新 ADR
- ❌ 不删除（即使 superseded，保留作历史）
- ✅ Status field 可改（proposed → accepted → superseded → deprecated）；其他字段冻结
- ✅ 编号 append-only：新 ADR 取下一个号；不复用 deprecated 号

## Template

每个 ADR 形态见 [`../../process/methods/adr-discipline.md`](../../process/methods/adr-discipline.md)。基本结构：

```markdown
# ADR-XXXX: <title>

| Status | proposed / accepted / superseded / deprecated |
| Date | YYYY-MM-DD |
| Authors | <name> |
| Supersedes | ADR-XXXX (if any) |
| Superseded by | ADR-XXXX (if any) |
| Source DI doc | engineering/design/_frozen/<file>.md §<section> |

## Context
## Decision
## Consequences
## Alternatives considered
## References
```

## ADR Index

**Review status (2026-05-14)**: ADR-0001..0016 由 Phase B 批量起草，初始误标 `accepted`；现已全部改回 `proposed` 等 owner review-gate。Owner 逐个 / 逐批确认后改 `accepted`。

Owner review findings 已处理：
- ADR-0017 是 owner review ADR-0002 时新增（backup 从 substrate 剥离成独立 pluggable concern）
- ADR-0001 owner review 指出原稿是 product vision 不是 decision → product 定义剥离到 `product/prd/project.md`；ADR-0001 reframe 为真正决策 "canonical deployment artifact = multi-arch Docker image"

| ADR | 主题 | Status | Source frozen DI § |
|---|---|---|---|
| [ADR-0001](./ADR-0001-deployment-canonical-artifact.md) | Deployment — multi-arch Docker image as canonical artifact | proposed | architecture-rebuild §0.6（product 定义已剥离到 `product/prd/project.md`）|
| [ADR-0002](./ADR-0002-substrate-db-backed.md) | Substrate: DB-backed + plugin serializer | proposed | architecture-rebuild §3 + §6 L1 |
| [ADR-0003](./ADR-0003-grid-engine-contract.md) | Grid-engine contract（12-col + AABB + gravity Option A）| proposed | grid-redesign + architecture-rebuild §2 |
| [ADR-0004](./ADR-0004-block-plugin-model.md) | Block plugin extension model | proposed | architecture-rebuild §4 |
| [ADR-0005](./ADR-0005-agent-semantic-api.md) | AI agent semantic API（agentOps = block-scoped tool use）| proposed | architecture-rebuild §5 + §11.3 |
| [ADR-0006](./ADR-0006-backend-stack.md) | Backend stack（TS + Bun + Hono + Drizzle multi-dialect）| proposed | architecture-rebuild §11.7 + §11.8 |
| [ADR-0007](./ADR-0007-storage-abstraction.md) | Storage provider abstraction（local FS + S3-compatible）| proposed | architecture-rebuild §11.13 |
| [ADR-0008](./ADR-0008-search-abstraction.md) | Search provider abstraction（SQLite FTS5 + Postgres tsvector + external）| proposed | architecture-rebuild §11.14 |
| [ADR-0009](./ADR-0009-api-style.md) | API style: GET + POST collapsed | proposed | architecture-rebuild §11.12 |
| [ADR-0010](./ADR-0010-performance-budget.md) | Performance + Lighthouse acceptance（90+ + backend SLO）| proposed | architecture-rebuild §11.10 |
| [ADR-0011](./ADR-0011-sandboxing-evolution.md) | Plugin sandboxing evolution（inline → worker → WASM）| proposed | architecture-rebuild §11.15 |
| [ADR-0012](./ADR-0012-openapi-gen.md) | OpenAPI gen 链路（zod-first + REST + agent registry split）| proposed | architecture-rebuild §5.5 + §11.12 |
| [ADR-0013](./ADR-0013-markdown-tile-editor.md) | Markdown tile editor（Lexical WYSIWYG + DB markdown source）| proposed | architecture-rebuild §11.1 |
| [ADR-0014](./ADR-0014-plugin-contract.md) | Plugin contract details（agentOps signature / capability ctx / versioning）| proposed | architecture-rebuild §11.3 |
| [ADR-0015](./ADR-0015-agent-wire-protocol.md) | Agent wire protocol（MCP + SKILL.md 双层 + REST + SSE）| proposed | architecture-rebuild §11.4 |
| [ADR-0016](./ADR-0016-css-framework.md) | CSS framework（Tailwind 4 + cva + shadcn ui + grid-themes）| proposed | architecture-rebuild §11.16 |
| [ADR-0017](./ADR-0017-backup-strategy.md) | Backup strategy（pluggable BackupProvider）| proposed | — (owner review of ADR-0002, 2026-05-14) |

## 编号约定

- 4 位数字，零填充：ADR-0001 / ADR-0042 / ADR-1000
- 一旦分配，永不复用（即使 deprecated）
- Filename: `ADR-XXXX-<kebab-case-title>.md`
- 编号自然递增；无 "category prefix"（如 ADR-S001 / ADR-T001 等）—— 想分类用 tag / index

## ADR 写作风格

- 简洁：50-150 lines 目标；超 200 line 通常说明 "Context" 太长，搬部分到 frozen DI 或 living doc
- 决策**结论 + 简短 reasoning** 留 ADR；**完整 discussion / 替代方案 trace** 留 frozen DI doc
- Alternatives considered 至少列 2 个被拒选项（不必每个 deep dive；point 到 frozen DI 即可）
- References 必含 source frozen DI 链接
