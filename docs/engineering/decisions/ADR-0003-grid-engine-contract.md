# ADR-0003: Grid-engine layer — constrained canvas 的架构 induction

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-05-13 (rewritten pass 2: 2026-05-16) |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/grid-redesign-2026-05-11.md` (entire) + `architecture-rebuild-2026-05-11.md` §2 |

## Context

产品形态 **"constrained canvas"** 已在 `product/prd/project.md` + frozen DI `grid-redesign-2026-05-11.md` §1-2 + `architecture-rebuild-2026-05-11.md` §2 锁定。心智参考: iOS Springboard / Bento dashboards / Sims build mode / LEGO baseplate —— **约束做 affordance 不做 cage**。

**本 ADR 要回答的问题**：这个产品形态推出哪些**不可避让的架构事实**？

> Reframe pass 2 (2026-05-16)：初版（Phase B）按 package contract 风格写（列 Public API 函数签名 / OpResult shape / per-kind defaultSize / constraints）；owner review 指出 ADR-0003 位于"第三个 ADR"位置，应停在 **架构 induction** 层，不应下降到 contract / 函数签名层。具体 type / op / 算法详情已下沉到 `packages/grid-engine/CONTRACT.md`。

## Decision: 6 条 architectural inductions

从 "constrained canvas" 产品形态推出以下不可避让的架构事实。每条都是一个**单独的架构选择**，每条都对应一族被否决的对照轴（详 Alternatives 段）。

### Induction 1 — Layout Source-of-Truth 必须在独立 headless 层

"Constrained canvas" 要求 2D 位置 invariant（no overlap / discrete spans / gravity-stable / 等）**跨多 consumer 一致**。如果把 SoT 藏在 CSS Grid（implicit）/ editor doc tree（per-editor）/ API endpoint logic（per-endpoint）任一处，invariant 会随 consumer 漂移。

→ **必须存在一个独立 layout package**，命名 `@skb/grid-engine`，独占承担 layout SoT 与 invariant 保护。

### Induction 2 — 结构约束：monorepo 依赖图叶子（leaf node）

Grid-engine 在 monorepo package import 关系图上：**只有别人指向它的箭头，它自己不指向任何其他 internal `@skb/*` package**。

具体允许 / 不允许：

- ✅ **允许 import**：TypeScript 标准库 + 类型工具（**type-level only，无 runtime 行为**）
- ❌ **不允许 import**：**任何 runtime library（含 zod / immer / lodash / 等）** / 本 monorepo 任何其他 `@skb/*` package / React / DOM / Drizzle / Lexical / Hono / fetch / IndexedDB / 任何 framework 或 runtime API

**Escape hatch**（防止永久卡死）：若 implementation 判断需要 runtime lib，必须在 PR review 中显式说明理由 + 验证不破 invariant 6（purity / determinism / no side effect / reentrance）。默认 reject —— grid-engine 是 layout math，**不需要** runtime validation / parsing / 等行为；caller 在边界验证输入即可。

**这是结构约束，不是行为承诺**。Leaf 位置是 induction 2 推论行为承诺的**必要支撑但不充分**——一个 leaf package 在源码里仍然可以写 `Math.random()` / `Date.now()` / 模块级 `const cache = new Map()` / 读 `globalThis` 等破坏 purity 的代码。Purity / statelessness 必须**显式承诺**，不能从 leaf 位置"自然推出"。

### Induction 2 推论 — 行为承诺：pure / stateless / framework-agnostic / deterministic

这组行为承诺**架构上源自 induction 1**（多 consumer 共享底层共同语言要求 reentrant），**结构上由 induction 2 leaf 提供支撑**：

**Induction 链**：

```
Induction 1: layout SoT 必须独立 → 被 editor / API / agent / plugin 多 consumer 同时消费
  ↓
跨 consumer 并发 / 交错调用 engine（API server 多请求 + agent dispatch + plugin code 同时跑）
  ↓
Engine 必须 reentrant —— 每个 call site 看到的行为与其他 call site 无关
  ↓
Reentrant 要求: 无全局可变 state / 无 side effect / 确定性输出
```

**Engine 显式承诺**（不是"副作用"，是架构承诺）：

- **Pure function** —— 不调 `Math.random()` / `Date.now()` / `crypto.randomUUID()`；不读 `globalThis` / `process.env`；不做 IO（fetch / fs / network）。所有需要的随机 / 时间 / id 由 caller 在 args 里传入
- **Stateless** —— 无模块级 mutable state（无 `let x = ...` 在 top-level）；无内部 cache / memoization across calls；caller 自管 GridState 传入传出
- **Framework-agnostic** —— 即便允许 import 纯 utility，也不暗藏 React / DOM / DB / network 形态假设
- **Deterministic** —— 同 `(state, op, args)` → 同 `(new state, result)`，property-based test 可重现

**Leaf（结构）+ 显式承诺（行为）两层都要**：leaf 防 framework 渗透；显式承诺防 module-level cache / non-determinism。两层都缺一不可。

### Induction 3 — 只承载 block-as-AABB + layout invariant

Block 在 engine 视野下是 **不透明 AABB 矩形**，仅有 `{ id, kind, col, row, colSpan, rowSpan }` 6 字段进入 engine 关注范围。**`kind` 字段对 engine 是纯 passthrough tag**：engine **不读、不消费、不做任何 lookup**；它只是被 engine 携带过去给 caller（renderer 用它 lookup theme / icon；agent dispatch 用它 lookup plugin handler；DB 持久化它）。

**Engine 不做 kind→X lookup**。具体来说：

- ❌ Engine **不**做 `kind → defaultSize` lookup（caller 自己 lookup `BlockPlugin.defaultSize`，把算好的 proposed size 传给 `inferDropIntent`）
- ❌ Engine **不**做 `kind → 验证规则` lookup
- ❌ Engine **不**做 `kind → 行为分支`

Block 的内容（`content_inline` / `props_json`）**完全不在本层**。

→ 推出：engine 是 **kind-opaque + content-opaque**。Plugin churn（新增 kind / 修改 plugin 内容）不波及 engine；editor SoT（Lexical / textarea / canvas / 其他）也不波及 engine。

> Carryover 实现 note：`carryover/packages/grid-engine/src/intent.ts` 的 `inferDropIntent(state, cursorCol, cursorRow, blockKind)` 内部做 `DEFAULT_SIZES[blockKind]` lookup —— **这是 transitional carryover 实现**，违反本 induction。Phase F lift / first plugin author trigger 之前必须修正为 `inferDropIntent(state, cursor, proposedSize)`，由 caller 传 proposed size。详 `packages/grid-engine/CONTRACT.md` 演化路径。

### Induction 4 — 该层是跨时间 invariant guardian（不是数据持有者）

Engine 的核心价值不是"承载数据 structure"，是**承担时间一致性承诺**。每个 op 之后，engine 保证：

| 不变量类型 | 内容 |
|---|---|
| 空间不变量 | no AABB overlap |
| 代数不变量 | discrete-int spans（≥ 1 整数；col + colSpan ≤ totalCols；row ≥ 0） |
| 时间不变量 | **Option A gravity-stable** —— 每个 mutating op default 跑 `applyGravity` 到收敛（除非 caller 显式 `{ gravity: false }`） |
| 因果不变量 | pure-function determinism —— `(state_t, op) → (state_{t+1}, result)` 完全可重现 |

**为什么 Option A 是架构决策不是 algorithm choice**：Option A 说的不是"gravity 用什么算法"，而是 "state 在任意 op 后是否保证 gravity-stable"。这是对时间一致性的承诺：**不会出现浮空 block，因此不会出现"无关 delete 触发跳"的 surprise leap**。算法实现细节归 `CONTRACT.md`，invariant 承诺归本 ADR。

### Induction 5 — 提供三类能力面（不锁函数签名）

Engine 对外能力划分为三类：

| 能力类别 | 说明 |
|---|---|
| **State mutation** | 改 GridState 的 op 集合（insert / move / resize / transform / delete 形态） |
| **Invariant query / intent inference** | 不改 state，从 state 提取信息（hole-fill 空 rect 查找；drop intent 推断；gravity check 等） |
| **Validation** | 显式检 invariant，property-based test / CI guard 用 |

具体函数签名 / 类型 shape / 算法细节见 [`packages/grid-engine/CONTRACT.md`](../../../packages/grid-engine/CONTRACT.md)。**本 ADR 不锁签名**——内部包 contract 可以小步演化，不必走 ADR supersede。架构决策在"提供三类能力面"+"承担 induction 1-4 与 6 的承诺"，不在"具体几个函数叫什么名字"。

### Induction 6 — Consumer 拓扑单向

所有 import 箭头指向 engine，**engine 不出**：

```
editor shell        ─consumes──→
API endpoints       ─consumes──→     @skb/grid-engine
agent dispatch      ─consumes──→     （pure / stateless / framework-agnostic）
plugin code         ─consumes via──→
                      ctx.engine
                      read-only facade
                      (ADR-0014)
theme components    ─consumes──→
                      (reads block positions)
```

→ 推出：sandbox / capability boundary（plugin 只能读不能写）可以在 **facade 层**（ADR-0014 `ctx.engine` 是 read-only wrapper）实施；engine 自身不需要分二（不在 engine 端区分"read api 和 write api"两个 export）。

## Scope boundary

明确**不在本 ADR 范围**：

| Concern | 归属 | 与本 ADR 关系 |
|---|---|---|
| 具体函数签名 / 类型 shape / 算法实现细节 | [`packages/grid-engine/CONTRACT.md`](../../../packages/grid-engine/CONTRACT.md) | 本 ADR 锁架构 induction；contract 锁 surface |
| Block 内容 / kind 语义 / `props_json` / `content_inline` | ADR-0004 plugin model + ADR-0014 plugin contract | Engine kind-opaque（induction 3） |
| DB schema for blocks/positions | ADR-0002 substrate | `Block` ↔ `blocks` row 映射归 ORM |
| Per-kind defaultSize 数值 + caller-side `kind → defaultSize` lookup | ADR-0014 `BlockPlugin.defaultSize` | Engine kind-opaque（induction 3）；caller 自己 lookup 后把 proposed size 传给 `inferDropIntent` |
| Editor SoT inside a block（Lexical state / 等） | ADR-0013 markdown tile editor | Engine 不知道 block 内部编辑器（induction 3） |
| API endpoint signatures / wire shape | ADR-0009 | API endpoint 是 engine consumer |
| Sandbox / capability ctx | ADR-0011 + ADR-0014 `ctx.engine` | Read facade 在 ctx 层，不在 engine 端（induction 6） |
| Theme / render system | 待 future render-system ADR | Engine 端只承诺 theme-agnostic invariant（induction 3）；render 系统决策不在本 ADR |
| Virtualization / 大 N 性能 | render-layer concern（Phase 2+） | Engine 提供 pure data，render 优化在 consumer 层 |
| Constrained-canvas **产品心智**（为什么不是 Notion / free canvas / Tetris） | frozen DI grid-redesign §1-2 + `product/prd/project.md` + `engineering/design/mental-model.md`（Phase C 待写） | 本 ADR 编码 invariant，不重决策心智 |

## Consequences

按 induction 维度组织（每条 consequence 标注源自哪条 induction）：

**Positive**：

- Property-based test 可行；invariant 算法验证（45/45 scenarios + 50k stress on carryover code 已 validated）—— 来自 induction 4 + 5
- Theme / plugin / editor 替换不波及 layout —— 来自 induction 3 opacity + induction 6 单向拓扑
- 多 consumer 共享底层共同语言；no 算法重复 —— 来自 induction 1 + 6
- 算法细节可独立演化，不破坏架构承诺 —— 来自 induction 5（不锁签名）
- Plugin code 在 sandbox 中只读 engine，不需 engine 自身做权限分支 —— 来自 induction 6

**Negative / Trade-offs**：

- 固定 12 col（来自 induction 1+3 不变量）—— **GridState 的 logical coordinate system 是 12-col**；responsive 12/6/1 是 **render projection**，不改变 GridState，不进入 engine mutation semantics（mobile 1-col 视图不是另一个 engine state，是同一 GridState 的另一种 render 投影）；mitigate by viewport-level 12/6/1 切换（CSS-only，render layer）
- N row 无上界 → 不能简单 cap memory；mitigate by virtualization at render layer（Phase 2+）
- Engine kind-opaque → 跨 kind 协同（"移动该 block 同时调整邻居中 markdown 块字号"等假设需求）必须在更高 layer 协调；engine 自身不提供
- 不锁签名（induction 5）→ contract 演化无 ADR-level audit；mitigate by `packages/grid-engine/CONTRACT.md` 是 SoT，contract 变化走 PR review

**Risks**：

- 算法实现偏离 invariant 承诺 → property-based test 充当 regression guard（已 validate）
- 大 N（1000+ block）gravity 迭代性能 → benchmark Phase 2+；算法 worst-case 见 CONTRACT.md

## Alternatives considered

按 induction 维度组织 rejected 选项。**每条 induction 都有对照轴可被推翻；本 ADR 锁的是每条 induction 当下选择**：

### Induction 1 alt（layout SoT 必须独立）

- "CSS Grid 当 SoT"：`grid-area` 重合时 CSS 静默 overlap；`grid-auto-flow` 不可控；rejected
- "Editor doc tree 当 SoT"（per-editor）：多 consumer（API / agent / theme）共享语言失效；rejected
- "Row-stream model (1D doc-flow + col)"：旧 Wave 5 路径；与 canvas 心智不符；rejected

### Induction 2 alt（依赖图叶子）

- "Engine 持内部 state"：失去 pure-function purity 与 property-based test 能力；rejected per induction 4 + test discipline
- "Engine 依赖 editor / DB"：多 consumer 共享语言失效；rejected per induction 1

### Induction 3 alt（kind-opaque + content-opaque）

- "Engine 知道 kind 语义 / 嵌 plugin code"：内核被 plugin churn 污染；plugin 改不能不动 engine；rejected per evolutionary stability

### Induction 4 alt（跨时间 invariant guardian）

- **Option B gravity**（仅 delete 触发）：surprise leap —— 浮空 block 在无关 delete 后突然跳；rejected per UX
- "无 gravity"：用户视角"积木掉下来"心智失效；rejected per mental model
- "自由 overlap"：失去 constrained canvas 心智核心；rejected per product shape
- "Fractional / fluid spans"：与 LEGO baseplate 心智不符；user 反复纠对；rejected

### Induction 5 alt（不锁签名）

- "ADR 锁完整 API surface"：内部包 contract 小改也要 supersede ADR；违 ADR 性质（架构决策不是 contract 决策）；rejected

### Induction 6 alt（consumer 拓扑单向）

- "Engine 跟 editor 双向依赖"：失去叶子位置带来的 invariant 链；rejected per induction 2
- "Engine 内置 sandbox / capability 检查"：把 ADR-0011 sandbox concern 揉进 engine；rejected per separation of concerns

### 其他被否决的整体形态

- **Tetris-style 系统决定 tile 形状**：user 失去 agency；mode mismatch（详 grid-redesign §2.5 rhetorical 区分）；rejected
- **Continuous coordinates (Figma free canvas)**：失去对齐 affordance；user 反复纠对；rejected per mental model

## References

- **Product 形态**：`product/prd/project.md`（constrained canvas non-goals + criteria）
- **Mental model**：`engineering/design/mental-model.md`（Phase C 待写）
- **Source DI docs**：
  - `engineering/design/_frozen/grid-redesign-2026-05-11.md`（entire）
  - `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §2
- **Package contract**：[`packages/grid-engine/CONTRACT.md`](../../../packages/grid-engine/CONTRACT.md)（具体 type / op / 算法；同 commit 落地）
- **Contracts 索引**：[`docs/engineering/contracts/README.md`](../contracts/README.md)
- **Carryover validated**：`carryover/packages/grid-engine/` (45/45 scenarios + 50k stress + Option A locked；提升到 `packages/grid-engine/` 走 Phase F)
- **Related ADRs**：
  - ADR-0002（`blocks` table row mapping）
  - ADR-0004（plugin model）
  - ADR-0005（agent semantic API — engine 是 agent dispatch consumer）
  - ADR-0009（API style — endpoint 是 engine consumer）
  - ADR-0011（sandbox — read facade 在 ctx 层不在 engine）
  - ADR-0013（editor SoT 内部 — 不归 engine）
  - ADR-0014（plugin contract `ctx.engine` + `BlockPlugin.defaultSize`）

## Changelog

- 2026-05-13 initial draft（carryover package 已 validated；mental model LOCKED 2026-05-11；Phase B 批量起草误按 package-contract 风格写）
- 2026-05-16 owner review reframe (pass 2)：ADR-0003 重写为 **architecture-induction-style**（与 ADR-0001 / 0002 同形态）：
  - 删除具体 Public API 函数签名列表 → 下沉 `packages/grid-engine/CONTRACT.md`
  - 删除 `OpResult` / `Block` field shape → 同上
  - 删除 per-kind `defaultSize` 表 → 归 ADR-0014
  - 删除 `Constraints` 段（integer span / col 上界等）→ 归 CONTRACT.md
  - 重组 `Decision` 段为 **6 条 induction chain**（layout SoT 独立 / 依赖叶子 / kind-opaque / 跨时间 invariant guardian / 三类能力面不锁签名 / 单向拓扑）
  - 新增 `Scope boundary` 段（out-of-scope 表）
  - `Alternatives` 段按 induction 维度组织，明确每条 induction 都对应一族被否决对照轴
  - 承接 owner review challenges：(1) "只承载 block" → "承载 block-as-AABB + invariant" 精确化；(2) 加跨时间 invariant 维度；(3) "engine 是依赖图叶子"作为 induction 2，导出 pure/stateless/agnostic 三条承诺的根因
- 同步落地：`packages/grid-engine/CONTRACT.md` 初版（从 carryover types.ts + grid-redesign §3-4 + §6 提炼）+ `docs/engineering/contracts/README.md` 索引页 + `process/methods/adr-discipline.md` 补 foundational ADR induction-chain pattern
- 2026-05-16 friend review pass 2.1 fixes:
  - **Induction 2 拆分** —— "leaf 是结构约束" 与 "pure/stateless/agnostic/deterministic 是行为承诺" 拆开；行为承诺源自 induction 1（多 consumer reentrant 要求），由 leaf 结构支撑但**不自动推出**；显式列禁用项（`Math.random` / `Date.now` / module-level mutable state / etc.）
  - **Induction 3 kind-opaque 收紧** —— 删除"kind 用于 intent inference / defaults lookup"措辞；明确 engine 不读、不消费 kind、不做 `kind → X` lookup；caller 自己做 `kind → defaultSize` lookup 把 proposed size 传给 engine；carryover `inferDropIntent` 现状标注为 transitional 实现
  - **Scope boundary 表 defaultSize 行更新** —— 明确 caller-side `kind → defaultSize` lookup 也在本 ADR 范围外
  - **12-col 精确化** —— "logical coordinate system" vs "render projection" 二分；mobile 1-col 视图不是另一 engine state
  - **mental-model 路径修正** —— `engineering/design/living/mental-model.md` → `engineering/design/mental-model.md`（与 PRD / docs/README / engineering/README 索引对齐）
  - **Leaf 定义精确化** —— 是 monorepo 依赖图叶子（不 import 其他 `@skb/*`），不是"零 import"；允许 import std lib / 类型工具 / 纯 utility lib（如 zod）
