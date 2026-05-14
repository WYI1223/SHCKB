# ADR Discipline

**Status**: living
**Last updated**: 2026-05-13
**Source**: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §10 + §12

ADR (Architecture Decision Record) 的写作规则 / append-only 机制 / supersede 流程 / template。

## 核心规则

### 1. ADR 是 immutable decision record

一旦 status 进 `accepted`：
- ❌ 不修改 Context / Decision / Consequences / Alternatives 内容
- ✅ 可改 Status field（`accepted` → `superseded` / `deprecated`）
- ✅ 可在 metadata 加 `Superseded by: ADR-XXXX` link
- ❌ 不删除文件（即使 deprecated）

### 2. 变更决策走 supersede

```
旧决策 → 写新 ADR with `Supersedes: ADR-XXXX` field
旧 ADR 同步更新：Status: superseded + Superseded by: ADR-YYYY
```

旧 ADR 文件不动其他内容；新 ADR 全文重写背景 + 决策 + 替代。

### 3. ADR 编号 append-only

- 4 位数字：`ADR-0001`、`ADR-0042`、`ADR-1000`
- 一旦分配，永不复用（即使该 ADR deprecated）
- 编号自然递增；无 category prefix（想分类用 tag / index README）

### 4. Filename

`ADR-XXXX-<kebab-case-title>.md`

例：`ADR-0006-backend-stack.md` / `ADR-0015-agent-wire-protocol.md`

## Status 流转

```
draft → proposed → accepted → superseded
                              → deprecated
```

- **draft**: 起草中；可被打回
- **proposed**: 待 owner 确认 lock
- **accepted**: 决策生效；append-only 规则开始
- **superseded**: 被新 ADR 替代；保留作历史
- **deprecated**: 决策本身不再适用（不是被新 ADR 替代，而是范畴消失）

## Template

```markdown
# ADR-XXXX: <Concise Title>

| Field | Value |
|---|---|
| Status | proposed / accepted / superseded / deprecated |
| Date | YYYY-MM-DD |
| Authors | <name(s)> |
| Supersedes | ADR-XXXX (if any) |
| Superseded by | ADR-XXXX (filled when this is superseded) |
| Source DI doc | engineering/design/_frozen/<file>.md §<section> |

## Context

（why this decision needed; what problem / constraints / forces at play）

## Decision

（the actual decision；one or two paragraphs；引用 source DI doc 的对应 § 作 reasoning trace）

## Consequences

**正面**：
- ...

**负面 / Trade-offs**：
- ...

**Risks**：
- ...

## Alternatives considered

至少列 2 个被拒方案；每个一两句 why rejected：

- **Alternative A**: brief description → rejected because ...
- **Alternative B**: brief description → rejected because ...

详细 alternative discussion 见 Source DI doc 对应 §。

## References

- Source DI doc：`engineering/design/_frozen/<file>.md` §<section>
- Related ADRs: ADR-XXXX, ADR-YYYY
- 外部 link：<spec / blog / standard>

## Changelog

- YYYY-MM-DD initial draft
- YYYY-MM-DD status changed to accepted
- (if superseded) YYYY-MM-DD superseded by ADR-XXXX
```

## ADR 写作风格

### 长度

- 目标 50-150 lines；多数 80-100 line
- 超 200 line → Context 太长，搬部分到 frozen DI 或 living architecture doc
- 超 300 line → 强信号：决策颗粒度太粗；考虑拆 2 个 ADR

### 内容深度

- **Decision** 段：结论 + 简短 reasoning；3-5 lines
- **Context** 段：足够 reviewer 理解 why；通常 1-2 段
- **Alternatives** 段：列 2-4 个被拒方案；每个一句 why
- 完整 discussion / 怎么辩论出来的 → 留 frozen DI doc，ADR 用 reference link 指向

### Reference 必含

- Source DI doc（哪个 frozen DI doc 的哪个 § 是这个决策的源）
- Related ADRs（如有依赖 / 互相 reference 的）
- 外部 link（如引用 MCP spec / Tailwind docs / etc.）

## ADR vs Frozen DI doc

| | ADR | Frozen DI doc |
|---|---|---|
| 大小 | 50-150 lines | 几百-上千 lines |
| 内容 | 决策结论 + 简短 reasoning | 完整 discussion + framing + 替代方案 + emerge 过程 |
| 修改规则 | Append-only；status field 可改 | Owner-only typo fix；实质不改 |
| 何时读 | 日常 reference："这个决策为什么" | 深度审计："怎么辩论出来的" |
| 一个 source DI → 几个 ADR | N：1 | 1：N |

## ADR vs Living doc

Living doc（mental-model / architecture-overview / 等）跟 ADR 协作：

- ADR 锁单一决策；Living doc 给 cross-cut integration view
- Living doc 引用相关 ADRs（"per ADR-XXXX, we use ..."）
- ADR 变更（supersede）时，living doc 更新引用 + 描述
- Living doc 不锁、不 append-only；ADR 是 append-only
