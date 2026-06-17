# ADR-0030: Autofit → follow/fix 两模型；删除 floor，每模式 resize

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-15 |
| Authors | W_YI (owner), Claude |
| Supersedes | [2026-06-13-block-autofit-height-design.md](../../superpowers/specs/2026-06-13-block-autofit-height-design.md) §4.3/§5.1/§6/§7 的 floor（`minRowSpan`）/ `max(floor, fit)` 调和 / floor-resize 手柄 / floor-invariant 服务端兜底模型 |
| Amends | [ADR-0028] §2 gravity carve-out 措辞（autofit 原子编辑会话 = **follow only**；fix 块静态、不持手势）；[ADR-0028]/[ADR-0029] 的 `minRowSpan`/floor 与 `max(floor, fit)` 表述（floor 删除）|
| Extends | [ADR-0029] §3 `BlockKindModule.autofit` 字段（enum `{ default: 'off'｜'grow'｜'grow+shrink' }` → 两模型 `{ default: 'follow'｜'fix'; canFollow?: boolean }`）|
| Source | [2026-06-15-autofit-follow-fix-design.md](../../superpowers/specs/2026-06-15-autofit-follow-fix-design.md)（owner ratified 2026-06-15；PRD-informed：[blocks.md] / [notepage-editing.md] 承接"块高度可由内容自增长 / 或作者固定后内容滚动"）|

> **注意**：本 ADR 是 PRD-informed，走 [AUDIT-2026-05.md](./AUDIT-2026-05.md) 流程注册，且**下游于** 2026-06-15 design spec（这是对已决策特性的行为 + 契约变更，按项目纪律权威文档先行）。[ADR-0028] 的 `pushResize` 引擎原语**完整保留**——本 ADR 不碰引擎 op 签名，只重定义 web/server/kind 契约层的 autofit 模型，并据此收窄 [ADR-0028] 的 gravity carve-out 适用面（仅 follow）。[ADR-0029] 把 autofit 升为 block-base capability 的结构保留；本 ADR 改其 `autofit` 字段的取值空间。

## Context

[ADR-0028]/[ADR-0029] 把 autofit 建模为**手动高度上的 assist**：块有一个持久 floor（`minRowSpan`，拖"grow"块底部手柄设定），一个持久 enum `autofit ∈ 'off'｜'grow'｜'grow+shrink'`（**只有 `'grow'` 接线**，`'grow+shrink'` 是死值），开启 grow 时有效 `rowSpan = max(floor, fit)`。

实测暴露两个结构性问题：

- **toggle 说谎**：当 `floor ≥ content`（块被拖得比文本高），开 autofit **看不到任何变化**——ON 与 OFF 在内容溢出 floor 前完全一致，控件像坏了。
- **两个重叠的旋钮表达一个概念**（floor *和* on/off），第三个 enum 值是死的。

owner reframe：这从来不是"auto-height 开/关"，而是一个**有两个正态的模式**——

- **`follow`**（默认）= 高度跟随实测内容。块的自然态。
- **`fix`**（opt-in）= 固定的手动高度；超出部分滚动/裁切。

"关掉 grow"从来不是"关"，而是*切到 fix*——off-framing 藏掉了第二个真实模式。UI 从"auto-height ☑"复选框变成 **Follow / Fix** 模式开关，词汇不再说谎。`follow` 是默认值，已匹配现实（文本 kind 默认 `'grow'`；`image` 是 `autofit: false`，即只能 fixed）。

## Decision

### 1. 两个正态模式 follow / fix（floor 删除）

`autofit` 从 enum 变为**模式**。持久化 / wire 值 = 模式字符串 `'follow' | 'fix'`。

| | **follow**（文本 kind 默认） | **fix**（image 默认；文本 opt-in） |
|---|---|---|
| 高度 | `rowSpan = fit`（实测内容） | `rowSpan` = 固定手动值 |
| 最小 | 硬 **1 行**（`measureFit.ts` 的 `Math.max(1, …)`） | 1 行（grid 最小） |
| overflow | `hidden`（内容恰好落位，无可滚动） | `auto`（内容可超出 → 滚动/裁切） |
| 垂直 resize | **无**——高度由内容拥有 | **有**——拖动设固定高度 |
| 水平 resize | 有（改宽 → 重排 → 新 `fit`） | 有 |
| 活动手势（C5） | 有——边打字边 reconcile 到 `fit` | 无——静态 |
| 测量探针 | 活动时挂载 | 不挂载 |

**`minRowSpan`/floor 整体删除**：follow 用 `fit`（1 行最小活在 `measureFit.ts`），fix 用 `rowSpan`，不再有独立的"作者最小高度"。每个块都有确定的模式；持久 `null` 不再意为"off/legacy"，读时解析到 kind 默认（未知/缺省的安全发布回退 = `'fix'`）。

### 2. follow target = `fit`（1 行最小）

follow 块经 [ADR-0028] 的 C5 base-snapshot 手势活体 reconcile，**目标公式从 `max(floor, fit)` 改为 `Math.max(1, fit)`**——丢掉 `floor` 参数与 `max(floor, fit)` 调和。base-snapshot / reconcile-from-base / commit 生命周期不变（[ADR-0028] 的原子性保留）。1 行最小是 follow 的"地板"，住 `measureFit.ts`，**不是**一个独立的 floor 字段。

### 3. freeze-at-current-height（follow → fix）

用户把块切到 `fix` 时，其固定 `rowSpan` 取**当前显示高度**。对 inactive 块（今天唯一能触达右键 toggle 的地方）`rowSpan` 已等于上次提交的 `fit`，那里是 no-op；但规则须**显式**，使 **active** 块路径（mid-grow 切换）在切换瞬间把活体 `fit` 拷进 `rowSpan`。`fix → follow` 重挂探针并 reconcile 回 `fit`。

### 4. 每模式 resize-handle 策略

- **follow**：**无垂直 resize 手柄**（高度由内容拥有）。[ADR-0028]/今天 `autofitCtx.autofit && verticalOnly` 中"设 floor"的 `beginResize` 分支、`clampFloorPreview`、`setMinRowSpan` 全部**删除**。
- **fix**：所有轴正常 `transform()` resize——即今天的非 autofit resize 路径，不变复用。

### 5. fix overflow 滚动（编辑器内新行为）

`fix` 块内容超出固定高度时须在 frame 内**滚动/裁切**，active *与* inactive 皆然。发布路径今天已经经 `blockOverflow`（`auto`）做到；但编辑器内 active EditView 在溢出 fix 块中是**新行为**，需显式测试。host frame 盒（`BlockFrameCore` / `blockOverflow`）的 overflow 键基于布尔 `follow`：`follow → 'hidden'`，`fix → 'auto'`（映射与旧 autofit 布尔不变，仅命名漂移）。`.skb-content-box` 仍是 overflow 拥有者，host 不变量排序（position/width/height/overflow 最后应用）不变。

### 6. image = fix-only

`image` 无可测文本内容，**不能 follow**——契约 `{ default: 'fix', canFollow: false }`；follow toggle 对 image 缺席，正如今天 autofit toggle 对 image 缺席。下游闸门从 `autofit !== false` 改为 `autofit?.canFollow !== false`（toggle 可见性 / 探针挂载）。**契约 shape（owner locked）** = `{ default: 'follow' | 'fix'; canFollow?: boolean }`（专用 `canFollow` 标志而非重载 `false` sentinel——`false` 旧意"无 autofit"在新模型下正是"fix-only / 无 follow toggle"，命名读得更清，菜单可显示单模式而非消失）。逐 kind：markdown / richtext / code = `{ default: 'follow' }`；image = `{ default: 'fix', canFollow: false }`。

### 7. 收窄 [ADR-0028] gravity carve-out（仅 follow）

[ADR-0028] §2 的 carve-out（autofit grow 在原子编辑会话内挂起 gravity）措辞从 "autofit grow" 收窄为 **"follow 模式 reconcile"**：只有 follow 块持活体手势并触发 carve-out；fix 块静态、走普通 `transform()` resize（每 op 后跑 gravity，无 carve-out）。invariant 4 的瞬态例外窗仅限 follow 原子会话；[ADR-0028] 的所有其余条款（`pushResize` 纯下推、base-snapshot 住 web 控制器、提交即压实 PROBE-2 invariant、原子性硬前提）不变。

## Consequences

- **toggle 不再说谎**：follow/fix 是两个可见的正态；切换 follow ↔ fix 总有可观察效果（follow 缩到内容 / fix 冻结当前高度）。
- **floor 删除是跨层一致删**：DB `min_row_span` 列物理删除（owner locked；后续 task 经表重建迁移）、wire types（web + server + export）、reconcile 数学、floor-resize 手势分支、insert-seed、服务端 422 floor 兜底、migration floor-reset 测试——须在一个 slice 内连贯删除，否则契约破。
- **行为变更（有意）**：former `'grow'` 块若 floor 超过内容，现会**缩到内容**——这是新语义所要。published 快照按纯 enum map 迁移（其 `rowSpan` 已是提交高度）。
- **null 语义变**：持久 `null` 不再意"off"；每块解析到一个模式。特判 `null === off` 的注释/守卫须重定义。
- **export format bump 5→6**：成对 up/down 迁移触 working *与* published blocks；`up` 把 `'grow'`/`'grow+shrink'` → `'follow'`、`'off'`/`null` → `'fix'`、丢 `minRowSpan`；`down`（有损）把 `'follow'` → `'grow'`、`'fix'` → `'off'`、重引入 `minRowSpan: null`。
- **fix-overflow in active editor 是新行为**：只有发布路径曾处理 overflow——编辑器 active fix 块溢出需显式测试，且 fix 块的 host `.skb-content-box`（`auto`）独占滚动 → 无双滚动条。
- **`grid-engine` 不变**：`pushResize`/`reconcileTo`/`commitGesture` op 签名只取目标 `rowSpan`，无逻辑变化；仅契约/注释里的 `max(floor, fit)` / `'grow'` 词汇需 scrub。

## Alternatives considered

1. **保留 enum，只接线 `'grow+shrink'`** —— 拒绝：不解决"toggle 说谎"（floor 仍藏 ON==OFF 的退化态），仍是两个重叠旋钮 + 一个概念。
2. **保留 `false` sentinel 表 image fix-only**（不引入 `canFollow`）—— 拒绝：`false` 在新模型下语义恰为"fix-only / 无 follow toggle"，命名为 `canFollow:false` 读得更清，且让菜单显示单模式而非整个消失（owner locked = 显式 `canFollow`）。
3. **保留 floor 作为可选下限叠在 follow 上** —— 拒绝：floor 正是说谎的根源（floor≥content 时 follow 看不出动作）；删 floor 让 follow = 纯 `fit`、fix = 纯 `rowSpan`，两个互斥的单一真相，无第三个"作者最小高度"。
4. **`min_row_span` 列留死不删** —— 较低风险但留下死 schema；owner locked = 物理删除（表重建迁移）求干净。

## References

- Spec: [2026-06-15-autofit-follow-fix-design.md](../../superpowers/specs/2026-06-15-autofit-follow-fix-design.md)（完整 reframe + change surface 映射 + 风险 + sequencing）
- 被取代 spec: [2026-06-13-block-autofit-height-design.md](../../superpowers/specs/2026-06-13-block-autofit-height-design.md)（§4.3/§5.1/§6/§7 floor 模型 = legacy trace，顶部加 superseded banner）
- 修订/收窄来源 ADR: [ADR-0028](./ADR-0028-autofit-gravity-carveout.md)（gravity carve-out 收窄为 follow only；`pushResize` 与原子性不变）
- 扩展来源 ADR: [ADR-0029](./ADR-0029-host-frame-core-blockskin.md)（§3 `BlockKindModule.autofit` 字段取值空间 enum → 两模型）
- Engine 契约: [grid-engine CONTRACT.md](../../../packages/grid-engine/CONTRACT.md)（op 签名不变；词汇 scrub）
- PRD（下游待 pass）: [blocks.md](../../product/prd/features/blocks/blocks.md) / [notepage-editing.md](../../product/prd/features/notepage/notepage-editing.md)
- Audit register: [AUDIT-2026-05.md](./AUDIT-2026-05.md)
