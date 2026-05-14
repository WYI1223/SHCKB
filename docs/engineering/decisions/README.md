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

## ADR Index (Phase B 待写 16 个；编号从源 DI doc §12 next steps 推出)

| ADR | 主题 | Status | Source frozen DI § |
|---|---|---|---|
| ADR-0001 | 产品定义 + 部署矩阵 | TODO | architecture-rebuild §0.5 + §0.6 |
| ADR-0002 | Substrate: DB-backed + plugin serializer | TODO | architecture-rebuild §3 + §6 L1 |
| ADR-0003 | Grid-engine contract（12-col + AABB + gravity Option A）| TODO | grid-redesign + architecture-rebuild §2 |
| ADR-0004 | Block plugin extension model | TODO | architecture-rebuild §4 |
| ADR-0005 | AI agent semantic API（agentOps = block-scoped tool use）| TODO | architecture-rebuild §5 + §11.3 |
| ADR-0006 | Backend stack（TS + Bun + Hono + Drizzle multi-dialect）| TODO | architecture-rebuild §11.7 + §11.8 |
| ADR-0007 | Storage provider abstraction（local FS + S3-compatible）| TODO | architecture-rebuild §11.13 |
| ADR-0008 | Search provider abstraction（SQLite FTS5 + Postgres tsvector + external）| TODO | architecture-rebuild §11.14 |
| ADR-0009 | API style: GET + POST collapsed | TODO | architecture-rebuild §11.12 |
| ADR-0010 | Performance + Lighthouse acceptance（90+ + backend SLO）| TODO | architecture-rebuild §11.10 |
| ADR-0011 | Plugin sandboxing evolution（inline → worker → WASM）| TODO | architecture-rebuild §11.15 |
| ADR-0012 | OpenAPI gen 链路（zod-first + REST + agent registry split）| TODO | architecture-rebuild §5.5 + 隐含 §11.12 |
| ADR-0013 | Markdown tile editor（Lexical WYSIWYG + DB markdown source）| TODO | architecture-rebuild §11.1 |
| ADR-0014 | Plugin contract details（agentOps signature / capability ctx / versioning）| TODO | architecture-rebuild §11.3 |
| ADR-0015 | Agent wire protocol（MCP + SKILL.md 双层 + REST + SSE）| TODO | architecture-rebuild §11.4 |
| ADR-0016 | CSS framework（Tailwind 4 + cva + shadcn ui + grid-themes）| TODO | architecture-rebuild §11.16 |

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
