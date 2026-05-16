# ADR Discipline

**Status**: living
**Last updated**: 2026-05-16

ADR (Architecture Decision Record) 的写作规则 / append-only 机制 / supersede 流程 / template。Source: architecture-rebuild-2026-05-11.md §10 + §12（footer 含 link）。

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

**正面**:
- ...

**负面 / Trade-offs**:
- ...

**Risks**:
- ...

## Alternatives considered

至少列 2 个被拒方案；每个一两句 why rejected:

- **Alternative A**: brief description → rejected because ...
- **Alternative B**: brief description → rejected because ...

详细 alternative discussion 见 Source DI doc 对应 §。

## References

- Source DI doc: [<filename>](path/to/frozen/<file>.md) §<section>
- Related ADRs: ADR-XXXX, ADR-YYYY（footer 链接 markdown 形式；正文用 plain identifier）
- 外部 link: [<spec name>](https://...)

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
- 完整 discussion / 怎么辩论出来的 → 留 frozen DI doc，ADR 用 reference 指向

### Reference 必含

- Source DI doc（哪个 frozen DI doc 的哪个 § 是这个决策的源）
- Related ADRs（如有依赖 / 互相 reference 的）
- 外部 link（如引用 MCP spec / Tailwind docs / etc.）

### Cross-reference 风格

遵 doc-conventions.md：in-text 用 plain identifier（"per ADR-0003"），markdown link 集中在 References 段。

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

## ADR vs Package CONTRACT.md

包契约文档（`packages/<pkg>/CONTRACT.md`）跟 ADR 配对协作：

| | ADR | CONTRACT.md |
|---|---|---|
| 锁什么 | **Architectural induction**（架构承诺） | **Surface**（types / op set / 算法形态） |
| 例子 | "engine 必须 pure / 必须 kind-opaque / Option A gravity 不变量承诺" | `OpResult` shape / `applyGravity` 算法伪代码 / `DEFAULT_SIZES` 表 |
| 演化 | Append-only；变更走 supersede | 跟随包演化；breaking change 走 PR review；不每次走 ADR supersede |
| 何时 supersede ADR | 破坏 induction 承诺时（如 gravity Option A → B） | 仅修改 surface 不破 induction 时不触发 ADR supersede |
| 物理位置 | `docs/engineering/decisions/ADR-XXXX-*.md` | `packages/<pkg>/CONTRACT.md`（贴源码） |
| 索引 | `docs/engineering/decisions/README.md` | `docs/engineering/contracts/README.md` |

**规则**：ADR 锁的是不可避让的架构承诺；CONTRACT 锁的是当下实现的 surface。Surface 可以演化，承诺不能；前者归 PR review，后者归 ADR supersede。

## Foundational ADR 写作 pattern（induction-chain style）

部分 ADR 不是"二选一"型决策（"我们选 X 因为 Y"），而是 **product → architecture induction**：给定产品形态，推出哪些不可避让的架构事实。这类 ADR 通常出现在项目早期（大致 ADR-0001 ~ ADR-0004 量级），承担"框架奠基"角色。

### 何时用 induction-chain pattern

| 特征 | induction-chain 适用 |
|---|---|
| ADR 在项目早期，决策"层是否存在 / 责任范围 / 对外形态" | ✓ |
| 单个决策可被否决，但被否决会破多个 invariant | ✓ |
| 产品形态对架构有连锁约束 | ✓ |
| Component-level "选 X 不选 Y"二选一（如选 Hono 不选 Express） | ✗ 用普通 pattern |
| Contract-level "字段 A 是 string 不是 enum" | ✗ 归 CONTRACT.md |

### Structure

```markdown
## Context
  - 产品形态（引用 PRD + frozen DI，不重定义）
  - 本 ADR 要回答的问题：该形态推出哪些不可避让的架构事实

## Decision: N 条 architectural inductions
  ### Induction 1 — <one-line statement>
    （Reasoning：从产品形态推到这条 induction 的链；2-4 lines）
    → 推出 X / Y / Z（具体承诺）
  ### Induction 2 — <one-line statement>
    ...
  ...

## Scope boundary
  Out-of-scope 表（每条邻近 concern → 归属 ADR / CONTRACT / Living doc / etc.）

## Consequences
  按 induction 维度组织
  每条 consequence 标注源自哪条 induction

## Alternatives considered
  按 induction 维度组织 rejected 选项
  每条 induction 对应一族被否决对照轴
```

### 颗粒度规则

- 不下沉到函数签名 / 类型 shape（归 CONTRACT.md）
- 不重复 product PRD 的 WHAT（用 reference）
- 不下沉到具体 algorithm（伪代码归 CONTRACT.md）
- 保留：架构事实 / 不变量承诺 / 责任边界 / consumer 拓扑关系

### Reframe 信号

当一份 ADR 出现以下症状时，考虑 reframe 成 induction-chain：

- ADR 内嵌 `interface X { ... }` TypeScript 大段定义
- ADR 列具体函数签名表（`insertBlock(state, block) → ...`）
- ADR 段落写"该包提供以下函数: a / b / c / ..."（即"contract surface 枚举"）
- ADR 内嵌算法伪代码（"loop until convergence ..."）
- ADR 长度超 200 line 且 60%+ 是 code block

这些症状表明 ADR 误把 CONTRACT 内容当 ADR 内容写。处理方式：**reframe 为 induction-chain ADR + 同步新增对应 CONTRACT.md**。参见 ADR-0003 pass 2 reframe (2026-05-16) 实际样例。

### 与其他 ADR 类型的关系

不是所有 ADR 都用 induction-chain。常见类型对照：

| ADR 类型 | 例子 | Pattern |
|---|---|---|
| Foundational induction | ADR-0001 / ADR-0002 / ADR-0003 / ADR-0004 | induction-chain |
| Stack 选型 | ADR-0006（Bun + Hono）/ ADR-0016（Tailwind） | "选 X 因为 Y"二选一 |
| Pluggable abstraction | ADR-0007 / ADR-0008 / ADR-0017 | interface + adapter 表（contract 颗粒度，但因为对外扩展点正当） |
| Cross-cutting quality | ADR-0010（perf budget）/ ADR-0011（sandbox） | invariant + 量化指标 |
| Protocol / format | ADR-0009（API style）/ ADR-0015（agent wire） | 形态决策 + 实例 |
| Detail / contract level | ADR-0014（plugin contract field-by-field） | 字段级 spec —— 因为 plugin 是**外部扩展点**，contract surface 本身即架构决策 |

判定方法：**audience 是谁** —— 如果 contract surface 锁定的是**外部 author / operator** 看的契约（plugin author / API client / wire protocol consumer），下沉到字段级 ADR 是正当的；如果是**内部包**的契约，下沉到字段级走 CONTRACT.md。

## References

- Source DI doc: [architecture-rebuild-2026-05-11.md](../../engineering/design/_frozen/architecture-rebuild-2026-05-11.md) §10 + §12
- Doc cross-reference convention: [doc-conventions.md](./doc-conventions.md)
- PRD writing method: [prd-discipline.md](./prd-discipline.md)
- DI doc taxonomy: [di-doc-class.md](./di-doc-class.md)
- ADR index: [decisions/README.md](../../engineering/decisions/README.md)
- CONTRACT index: [contracts/README.md](../../engineering/contracts/README.md)
- Audit register: [AUDIT-2026-05.md](../../engineering/decisions/AUDIT-2026-05.md)

## Changelog

- 2026-05-13 initial draft (Phase A framework)
- 2026-05-16 ADR vs CONTRACT + Foundational ADR induction-chain pattern + audience-based 颗粒度规则 (triggered by ADR-0003 pass 2 reframe)
- 2026-05-16 cross-reference 风格 follow doc-conventions.md (in-text plain + footer link)
