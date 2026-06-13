# Block Auto-fit Height（limited-height + grow）— 设计

Date: 2026-06-13
Status: **ratified（owner 批 C5 + MAJOR/ADR 范围，2026-06-13）** — 红队 20 项 + 可逆机制仿真已折入；转 writing-plans（计划末步：bridge 实例入 dev 库）
Topic owner: W_YI
Scope tag: markdown 先行 → block 基础能力（泛化待压测+手测）
Red-team: 30 提 20 确认（§4.2-pre / §10）；可逆机制 = C5 base-snapshot+re-push（5 候选仿真择优，§4.4），与 Ctrl+Z undo 共快照基元（§4.5）

---

## 1. 背景与动机

测试中暴露：markdown block 内容超过作者设的 `rowSpan` 时，当前行为是交给主题
frame 滚动（[GridCanvas.tsx](../../../apps/web/src/grid/GridCanvas.tsx) 内注释"scrolling
belongs to the theme's frame alone"）。owner 要求：**markdown block 默认无滚轮，
高度随文本自动扩张**，写字时不必反复手调高度。

核心张力：今天 `rowSpan` 是作者设的整数，块高 = `rowSpan × SLOT`
（[PublishedCanvas.tsx:81](../../../packages/block-kinds/src/PublishedCanvas.tsx#L81)、
[GridCanvas.tsx:231](../../../apps/web/src/grid/GridCanvas.tsx#L231)），像素级钉死在网格上；
engine 与服务端 publish 渲染器都把 `rowSpan` 当**权威输入**。"高度随内容"会把它
变成派生值，触碰受限画布（"Note = constrained canvas，非 doc flow"）这一核心身份。

**owner 的 reframe（关键）**：不是 auto-height，而是 **limited-height + grow**——
块有一个作者意图的最小高度（地板），内容只能把它**往上撑**，且整行步进。owner
判定这"反而是对受限画布的一种诠释"：作者仍掌握**宽度**与**最小高度**，内容只在
此约束内自增长。本设计采纳该 reframe。

---

## 2. 核心模型：floor / fit / effective rowSpan 三分

把"作者意图的高度"与"实际渲染的高度"拆成两个量，所有矛盾消失：

| 量 | 含义 | 谁写 | 存哪 |
|---|---|---|---|
| **floor**（`minRowSpan`） | 作者的最小意图高度 | 拖高度手柄 / 插入默认 / 填洞钳制 | 新字段（block metadata，web 层拥有） |
| **fit** | 内容实测需要几行 = `ceil(内容px / SLOT)` | 前端编辑时测量 | **不持久化**，编辑时算 |
| **rowSpan**（有效） | 真正渲染 & engine 占用用的高度 = `max(floor, fit)` | 由上两者调和后写入 | state 现有字段（持久化） |

调和公式（autofit 开启时恒成立）：

```
rowSpan = max(floor, fit)
```

这一拆解逐条回应 owner 的细化要求：

- **"地板不一定是默认 6×3"**：`floor` 不是写死的 kind 默认值，它是当前 rowSpan 的
  作者意图分量。**填洞**把块钳到更小尺寸 → floor 取钳后值（与
  [CONTRACT.md hole-fill](../../../packages/grid-engine/CONTRACT.md) 一致，无冲突）；
  作者拖高度手柄 → 重设 floor。
- **"高度 resize 不再被禁止，而是设地板"**：autofit 开启时，垂直 resize 的语义从
  "直接设 rowSpan"变为"设 floor"。若当前内容 fit > 新 floor，块维持在 fit 高度
  （`max` 主导），不会缩到 floor 以下。
- **"不低于地板，除非作者自主更改"**：`max(floor, …)` 天然保证；作者拖手柄改 floor
  即"自主更改"。

---

## 3. autofit 策略 = A（连续调和）

owner 选 **A**：autofit 开启时 rowSpan 始终 `= max(floor, fit)`——既自动**长**也
自动**缩**（缩到 floor 为止）。一个 per-block 开关，**关闭**则回退到今天行为
（手动 resize + 主题 frame 滚动）。

放弃的备选（记录，留升级位）：

- **B — 自动长 + 手动缩**：内容只自动撑大；变矮需作者按"适应内容"按钮/快捷键。
  优点是编辑中不跳动，代价是多一处 UI + 多一动作。
- **升级路径**：A 的已知风险是"编辑中删一段→块即时塌缩→下方块上跳→再打字又下来"
  的跳动感。owner 的压测+手测轮专门盯这一点；若实测跳动明显，把开关从布尔升成
  `off / grow / grow+shrink` 三档，B 即 `grow` 档。**不预先实现 B**（YAGNI），但
  数据字段与 op 设计须容得下三档（见 §6 注）。

---

## 4. engine 变更：单个"向下位移"原语

### 4.1 新 op

engine 新增一个 mutation op（暂名 `growBlock` / `setRowSpanPushing`，最终名 PR 定）：

```
growBlock(state, id, newRowSpan, opts?) → OpResult
```

语义：把 block `id` 的 `rowSpan` 设为 `newRowSpan`；若撑开后与下方块 AABB 碰撞，
**将碰撞块向下局部递归位移**以消重叠（AABB 感知，**不跑全局 gravity**）；缩小则
**从 base 快照重推**回收空间。reflow 模型已定 = **C5 base-snapshot + re-push + 事务挂起
gravity**（见 §4.4，仿真择优；快照住 web 控制器，engine 只多一个事务性 push op）。

- **永不因垂直空间不足 reject**：grid 垂直无上界（CONTRACT invariant 2：`row ≥ 0`，
  无上界），向下永远有空间，grow 不会因没地方而失败。
- **但仍复用 `isRegionInBounds` 守卫输入**（红队 finding）：`newRowSpan` 必须为
  integer ≥ 1 且 col/colSpan 合法，否则 reject（failure mode `invalid span` /
  `out of bounds` / `id not found`，与 `resizeBlock` 对齐）。engine **不**把
  invariant 3 外包给某个特定 caller（如 markdown 的 ceil）——server 复验 / plugin /
  agent 消费者都不走那条路。把"永不 reject"措辞收窄为"永不因垂直空间不足 reject"。
- **批量调和原语**（红队 perf finding）：主题切换 / 挂载自愈要一次性重算 N 个块
  （§5.1.3/4）。若每块一次单 op、每次跑全画布 reflow = O(N×B²×R)。新增可选
  `reconcileRowSpans(state, Map<id,target>, opts?)`：一次应用全部目标 + 位移，reflow
  只跑一遍 → O(B²×R)。minor CONTRACT op 增项，不破架构承诺。

### 4.2-pre · ⚠️ 已被红队推翻的旧假设（保留作 trace）

原稿曾断言"撑开→推碰撞块→跑现有全局 `applyGravity`，gravity 自动收敛按列局部、
**不用选**"。**红队用真引擎语义证伪**：

- **不可逆**：grow 把"桥块"（横跨 grower 列 + 旁列的宽块）推下后，全局上重力会把
  旁列一个**毫不相干**的块吸到 row0；shrink 时上重力只能向上，**吸不回去**。
  → 在块里打一行字再删掉，隔壁列的无关块被永久挪位。反例 `G{c0-1,r0,h1}` /
  `W{c0-5,r1,h1}` / `K{c4-5,r2,h1}`，grow G→h3 再 shrink→h1，K 从 row2 永停 row0。
- **桥块留洞**：同一桥块把 grower 从未触碰的列焊死，留下不可回填的死带。
- 结论：**可逆 ⊥ 全局 gravity-stable（Option A）**。要"打字撑开/删字回收"可逆且
  局部，必须改 reflow 模型——这是 §4.4 的专项，且很可能触碰 gravity 语义（=
  major + 新 PRD-informed ADR，按 CONTRACT 版本规则）。所有 invariant 在旧假设下其实
  **不破**（结果仍 no-overlap + gravity-stable），它是**布局质量 + 可逆性**缺陷，
  不是引擎正确性缺陷。

### 4.2 invariant 影响

- **1 No overlap**：位移消重叠后无重叠（gravity-off 下靠 AABB 递归下推；gravity-on
  下 reflow 保持）。
- **2 In bounds**：垂直无上界，下推不越界；col/colSpan 不变。
- **3 Discrete spans**：`newRowSpan` 为 integer ≥ 1，**engine 侧 `isRegionInBounds`
  守卫**（不依赖 caller，见 §4.1）。
- **4 Gravity-stable**：⚠️ **被 §4.4 机制改写**。autofit 手势期内 gravity **挂起**
  （grown 中间态合法持浮空块），手势**提交**时由"逆回放 / 一遍 applyGravity"重建
  gravity-stable。即：**静止态仍 Option-A 稳定，仅瞬态编辑窗挂起**。这是本设计唯一
  触碰架构承诺之处 → 新 PRD-informed ADR（见 §9）。invariant 1-3/5-7 不受影响。
- **5 Unique ids / 6 Purity / 7 Leaf**：op 是纯函数，**不测量 DOM**——目标 rowSpan
  由 web 层算好作为 arg 传入。engine 仍 kind-opaque、零 runtime lib。

### 4.3 floor / autofit 不进 engine

`minRowSpan`（floor）与 `autofit` 开关**不进 engine Block 类型**。理由：调和公式
`max(floor, fit)` 是 web 层逻辑（fit 来自 DOM 测量），engine 只需收到一个具体的
目标 rowSpan。这样 engine 保持 kind-opaque + pure（invariant 6/7 不动），floor 作为
block metadata 由 web/server 层拥有。

> 推论（红队）：因 floor 不进 engine，`validateState` 无法检 `rowSpan ≥ minRowSpan`。
> 这条跨字段 invariant 的兜底放在 **web/server 路由层**（落库 PUT 在 `validateState`
> 通过后追加 `rowSpan ≥ minRowSpan` 校验，违则 422），engine 保持 floor-blind（见 §6）。

### 4.4 可逆 reflow 模型 —— 已定 = C5（仿真择优，待 owner 批范围）

owner 选"修复可逆性，但先定方案"。5 候选用**真引擎语义仿真 + 1000-case fuzz + 命名
场景电池**择优（见 `autofit-reversibility-mechanisms` 工作流，agent 实跑代码）：

| 机制 | 手势内可逆 | 旁列误移 | 结论 |
|---|---|---|---|
| C1 保留全局 gravity（baseline） | 70.5% | 275 | ~30% 打字再删永久重排，**不可发**（量化问题用） |
| C2 push-only + 逆向日志 | 100% | 0 | 达标，但有 `min(delta,shrink)` clamp bug 类 + 日志陈旧风险 |
| C3 位移日志 + canRise 闸缩 | 93% | 8 | 桥块逆向被卡（canRise 无法穿回被重占的行） |
| C4 anchored home-row | 56.7% | 61 | 最差：加持久字段+迁移，只把"泄漏"换成"钉死" |
| **C5 base-snapshot + re-push（选定）** | **100%** | **0** | 与 C2 并列达标，但更少 bug 类、状态更简、**与 undo 共基元** |

**选定 = C5**（owner 在对话中直觉出的"按计算回到原位"的正确形态）。autofit reconcile
是一个**独立事务手势**——
1. **手势开始**（块进入 autofit 编辑）：对整页布局拍**一张 base 快照**（+ grower id +
   其 base rowSpan）。
2. **每次调和到目标 T**：`reconcile(base, T)` = 从 base 快照出发，把 grower 设为 T，
   对 AABB 碰撞块**局部递归下推**（top-down，**从不跑全局 gravity、从不上拉**）。
3. 因为每次都从**同一 base** 重新推导，**可逆性自动成立**（T 回到 base 的 rowSpan →
   逐位还原 base）。**无逆向日志、无 clamp**——`reconcile(base,T)` 是纯函数，
   partial-shrink（+3→+1）经实测等于"直接从 base 推到 +1"，clamp bug 类**结构上不存在**。

**C5 vs C2（head-to-head，同种子 fuzz）**：目标上**并列**（都 100% 可逆 / 0 旁列误移 /
0 重叠 / 0 不终止，S1–S7 全过）。C5 赢在 owner 的 tie-breaker：① **更少 bug 类**——C2 减
delta 需 load-bearing clamp（STRESS-2 证无 clamp 即重叠），C5 不减任何东西故无此类；
② **状态更简**——C5 = 一张**不可变** base 快照（只读整手势），C2 = 累加 delta Map + 消费
生命周期 + 陈旧风险；③ **与 undo 共基元**（见下）。

**为何"按计算回退"办不到、为何需要快照**（owner 提出，已证伪所有 stateless 缩规则）：
- **块从不跨列**：engine 的 grow/push/gravity 只改 `row`，不改 `col`（改列只在作者拖拽）。
  grow 把下方块**直推下去、留在原列**，**故意不填洞**（填洞才跨列、才不可逆）。owner 的
  `[AA/CC]`+右侧空例子是**列对齐**情形，连纯 gravity 都可逆。
- **reflow 多对一（有损）**：光看当前态无法唯一算回。owner 设想的"存原位算回" = C4
  anchored-home，**实测 56.7%、更差、要持久 schema 列**——被淘汰。C5 的 base 快照绕开了
  "算回"：它不算回，它**从干净的 base 重新推**，所以总对。

**关键 hybrid（机制无关，C5/C2 通用，把范围压回可控）**：
- **现有所有 op（move/insert/delete/手动 resize）与页面静止态，Option A 全局 gravity
  原样不动**。
- autofit reconcile 只在**事务手势期内**挂起 gravity。手势内可逆（打字→删字回到原样）。
- **提交时**（手势结束：失焦/idle/autosave-after-gesture）：若净 rowSpan delta≠0 且页面
  gravity-on，跑**一遍** `applyGravity` 重新压实（块真变高并保留 → 压实是正确 Option A）。
- → 新机制**只活在瞬态编辑窗**，持久/静止态完全 Option-A 兼容，**ADR 面收窄**。

> **手势边界 + 自动保存 + 服务端校验（计划起草揭示，重要澄清）**：grown 中间态是
> **非 gravity-stable** 的；而服务端落库 PUT 对 gravity-on 页跑 `validateState({gravity:true})`
> 会**拒绝**非稳定布局（422）。所以 grown 中间态**永远不出客户端**——autosave 在 autofit
> 手势活跃期间不 PUT grown 态；它在**手势结束（失焦/键入 idle 去抖）时先压实再 PUT**，
> 服务端只见 gravity-stable 的已提交态。**推论：可逆性保证的精确范围 = "一次活跃编辑
> 会话/键入连续段内"**（段内打字→删回 = 原样还原）。若作者打字、**停顿到 idle 提交了
> 净变高**、再删——那是新会话从已提交（已压实）态起，删字按新 base 重推、提交时正常
> Option-A 压实（块确实曾变高）。这是受限画布的正确行为，且正是 owner 最怕的"打一行删
> 掉无关块永久移位"的**反面**：连续段内不会移；只有"停顿确认变高"后才按 gravity 压实。

**⚠️ 不可逆是被"推迟"到提交边界，不是被消灭（PROBE-2）**：C5（和 C2 一样）靠"手势内
不压实"换可逆；一旦**提交了一个净变高的块**到 gravity-on 页，下一个普通 op 的
`applyGravity`（[ops.ts withGravity](../../../packages/grid-engine/src/ops.ts#L25)）会把
桥块泄漏带回（K r2→r0）。所以承诺精确表述为：**"编辑会话内可逆；提交一个净变高块后，
正常 Option-A 压实生效（这是正确行为——块确实变高了）"**。owner 最怕的"打一行删掉、
无关块永久移位"被解决，因为会话内删回即归位、净零不提交变高。**提交边界的"提交即压实"
必须是被强制的 invariant，不是约定。**

**原子性 = 硬前提（STRESS-1 证）**：grown 期间若任何"跑 gravity 的 op"插进来（现模型
**每 op 后都跑 gravity**），会在非 gravity-stable 中间态重演泄漏。故 grow→shrink 手势
须是**无 gravity-op 插入的事务单元**；编辑中的 autosave 不得在手势未结束时触发"提交即
压实"。单用户 debounced-PUT 天然满足，但须写成 invariant。

**快照的家 = web 编辑控制器**（不进 engine）：与 §4.3 让 floor/fit 留 web 层一致，engine
保持 pure（invariant 6）。engine 只多一个"事务性 push" op；re-push 由 web 层从 base 驱动。

**lost-on-reload 兜底**：base 快照瞬态不持久；reload / 跨手势 undo / 协作远端 op 会让
grown 布局成新 base（此后不可逆，但**永不重叠**）。单用户 MVP 可接受；协作/agent 写路径
须定义降级 = 无上拉缩（留洞，绝不重叠）。

### 4.5 与 Ctrl+Z undo 的统一（owner 提出）—— 同一基元，两个消费者，**不是一个功能**

owner 观察：逆向恢复是反复出现的需求（产品至今无 undo）。仿真 judge 确认这是**真共享
基础、非命名假象**，但**共享的是基元而非功能**：

- **共享基元** = "拍一张不可变 working-state 布局快照，之后还原 / 从它推导"。
- **undo** = 一**栈**快照，Ctrl+Z 弹栈**原样还原**。
- **autofit** = **一张** gesture-base 快照，不是原样还原而是 `reconcile(base, T)` **重推**。
- 正因如此 **C5 能统一、C2 不能**：C5 的快照**就是一个布局状态**（undo 栈正需存这个）；
  C2 的 delta 日志是 autofit 专用、弹不出可还原的历史态。

**落法（防止 undo 把 autofit MVP 撑爆）**：
1. autofit MVP 把快照 capture/hold 抽成 web 控制器里一个**极小独立 helper**
   （`captureLayoutSnapshot(state)` → 不可变克隆 + 手势会话持有），**只发 autofit 这一个
   消费者**；不建栈、不建 ring buffer、不绑 Ctrl+Z、不做 redo。
2. spec/ADR 注明该 helper 是**未来 undo 栈的预定地基**，autofit 消费者写成"不独占快照"。
3. **undo 作为独立后续 PRD/功能**，在已发的 helper 上加栈 + keymap。消费者生命周期/触发/
   作用域都不同（autofit=每手势一张、提交即弃；undo=已提交态的有界环），不该耦进引擎 op。

→ owner 要的"统一"以"一个地基"形式拿到，autofit MVP 只多 ~30 行快照 helper，不背 undo。

**C5 无 clamp bug 类**：`reconcile(base,T)` 纯函数性 + partial-shrink（+3→+1 等于直接从
base 推到 +1）须单测；"提交即压实"（gravity-on 净增高块提交时跑一遍 applyGravity）须作为
被强制的 invariant 测试（PROBE-2 防线）。

---

## 5. 测量回路：仅编辑时，结果持久化

owner 修正（perf）：fit **只在编辑时算，算完写进 rowSpan 持久化**；运行时 / 读模式 /
publish 一律不量，只信 state 里存好的值。否则 N 个块每帧测量，聚合性能压力大。

### 5.1 触发测量的离散事件（低频、用户驱动，非每帧）

1. **active 块内容变化**（打字）—— 去抖（如 150–300ms）后测量调和。
2. **该块 colSpan 改变**（作者改宽度）—— 宽度变→换行变→高度变，须重测。
3. **主题 / 字体切换** —— 换主题改 `fontFamily`/`lineHeight`（含 M9-D3 的 `spacing`
   content 字段）→ 文本重排 → 存的 rowSpan 失真（无滚轮则内容被裁/压下方块）。
   换主题时对编辑器内所有 autofit 块做**一次性**重测调和（事件驱动，非轮询）。
4. **编辑器挂载** —— 跑一次自愈 pass，兜住外部导入 / 历史数据 / 跨设备字体差异。

### 5.2 服务端 / publish 永不测量

publish 出的静态页无 JS、无法测量，**必须**信任 publish 那一刻已调和好的 rowSpan。
正常流程下天然成立：autofit 块在编辑期就把 rowSpan 调好，作者点"更新公开页"即按
最新尺寸发布（owner）。服务端落库复验（`validateState`）只检有效 rowSpan 的 engine
invariant；`rowSpan ≥ minRowSpan` 的跨字段兜底在路由层补（§4.3 推论 / §6）。

**红队 finding — 无滚轮在静态页是 CSS 事实而非 JS 事实**：发布帧当前是
`overflow:auto`（[frames.tsx](../../../packages/block-kinds/src/frames.tsx) 等所有壳），
CSS 自带滚动、不需要 JS。存的 rowSpan 只在"测量时那套主题/字体/SLOT"下精确；若
**发布后实例主题变了**（`rerenderAllPublished` 会在新主题下重渲染所有已发布页却不
重测）或读者 fallback 字体不同，内容可能超过冻结高度 → 滚条复活，破坏无滚轮承诺。

owner 裁定 + 处置：
- **存量 / 已发布旧块默认 = 非 autofit**（§6 迁移），不受影响；作者要可逐页开启。
- **autofit 块在静态页用 `overflow:hidden` 裁切**（而非 `auto` 滚动）——尊重无滚轮
  美学；正常流程下 rowSpan = 内容高度恰好装下，无裁切；仅"发布后跨主题漂移"才裁掉
  一线，作者重开该页即触发编辑器自愈（§5.1.3/4）并重发布修正。需把 `autofit` 标志
  透传进 `PublishedDocShape.blocks` + `BlockFrameProps`，让壳对 autofit 块渲染
  `overflow:hidden`、非 autofit 块保持 `auto`。
- **不做重型 stale 机制**（owner 降范围）：靠"编辑期调和 + 重发布"为主路径，跨主题
  漂移的恢复是手动重开页（owner: "用户需要可以找到对应页面更改"）。可选轻量增强：
  实例主题/定制变更时给含 autofit 块的已发布页打一个 `needsRemeasure` 标，编辑器
  下次挂载自愈——列为 nice-to-have，非 MVP 必需。

### 5.3 测量实现 —— 穿真 Frame、按真实几何宽测量

**测量基准 = RenderView（读者所见）**（owner 拍板）。块的持久化高度必须装下读者/
发布态看到的渲染结果，而非 markdown 源码。

**红队 finding — 必须穿真 Frame，不能量裸 RenderView**：直接量"按内容宽布局的裸
RenderView 再减固定 chrome 高"是结构性错误。真实渲染树里 RenderView 是主题 Frame
的**后代**，Frame 决定 ① 可用内容宽（自身 padding，各壳不同且非对称，galley/
stationery 还嵌两层）、② 字号/行高与 `.skb-block` 作用域的后代 CSS（标题/code/pre）。
裸量会**换行宽度和排版都错**，fit 偏好几行 → 无滚轮下内容被裁/压。**减固定高对
宽度轴无效**，是脆弱路径。

正确做法：测量面与**实时/发布块走同一条渲染路径**——
- 用 `resolveBlockFrame(theme, kind, shell) ?? theme.BlockFrame ?? DefaultBlockFrame`
  包住 RenderView（与 [GridCanvas BlockShell](../../../apps/web/src/grid/GridCanvas.tsx#L264)
  / [PublishedCanvas](../../../packages/block-kinds/src/PublishedCanvas.tsx#L72) 同款），
  传同样的 `kind/blockId/colSpan/rowSpan/shell` props，确保主题 `globalCss` 在测量
  子树内生效；
- 离屏盒按**真实几何宽** `colSpan*theme.slot − 2*theme.pad`；
- 量 **Frame wrapper 的外层 `offsetHeight`**，`fit = ceil(outerHeight / SLOT)`——
  **不减 chrome、不算宽度**，因为换行宽与 chrome 由构造天然正确。

测量点：
- **inactive 块**：显示的就是穿 Frame 的 RenderView，直接 `ResizeObserver` 观测其
  Frame wrapper 外层。
- **active 块**：编辑面是**纯 textarea**（源码，高度与渲染无关）。挂一个穿 Frame 的
  测量 RenderView 取 fit。owner 拍板把它做成**右侧对齐的可见悬浮 ghost 预览**（见
  §7），测量与预览一体。source 长于渲染时 textarea 在块内可临时滚动（仅 active 态，
  无滚轮承诺针对静止/阅读态）。

---

## 6. 数据模型与存储

新增 **block-level metadata** 两字段（web/server 层，非 engine、非 kind content）：

- `autofit: TEXT NULL` 持 `'off' | 'grow' | 'grow+shrink'`（null = 旧块/off）。
  **红队 finding — 故意不follow `gravityEnabled` 的 integer-boolean 先例**
  （[schema.ts](../../../apps/server/src/db/schema.ts)）：用 TEXT 列让 A→三档升级是
  纯**解释拓宽**（无第二次 DDL 迁移、无第二个 format-transform 对），正是 §3"数据
  字段须容得下三档"所要求的。MVP 只写/认 `'grow'`、把 null/`'off'` 当关闭（二元
  语义），但列类型从第一天就是 TEXT。
- `minRowSpan: number`（floor；缺省 = 插入时的 rowSpan / 填洞钳后值）。

存储位置选型：**block-level metadata**（与 `shell` 同级，blocks 表新增可空列），
而非 content-level（kind JSON 内，如 spacing/color）。理由：owner 明确这"可作为
block 的基础功能"泛化到所有 kind——block-level 是长期正确的家，避免日后从 content
re-home。markdown-first 只是 **UI 门控**（仅 markdown 暴露开关、默认开），存储层从
一开始就 kind-agnostic。

迁移：schema 加版本，新增 `blocks.autofit`（TEXT）、`blocks.min_row_span`（int），
均 nullable，**旧块 = autofit off / minRowSpan = null**。format transform 成对 up/down，
ExportBlock 字段类型同取 `string|null`（v5 就落最终形，永不需要 v6）。

**红队 finding — 降级丢 minRowSpan 是行为性有损，非外观性**：
- down() 丢 minRowSpan 的 loss 行须表达行为影响（"块最小高度将在重导入时重置，
  不再能缩回当前内容以下"），不可当 shell/background 那种中性丢弃。
- **up() 回升时 minRowSpan 默认取引擎最小（=1 或 kind 插入默认），而非当前
  effective rowSpan**——否则 v5→v4→v5 往返会把 floor 抬到被内容撑大的当前高度，
  永久丢失"地板小于当前内容"的作者意图。加测试断言往返不抬高 floor。

**红队 finding — `rowSpan ≥ minRowSpan` 服务端兜底**（engine 仍 floor-blind）：
`parseWorkingState`（[notepages.ts](../../../apps/server/src/routes/notepages.ts)）
新增解析 `minRowSpan`/`autofit`；落库 PUT 在 `validateState` 通过后追加跨字段校验
`block.rowSpan ≥ block.minRowSpan ≥ 1`（每块，非引擎），违则 422 不部分应用。这是
全系统唯一兜底落在路由层而非引擎的几何承诺，因为 §4.3 让 floor 对引擎不可见。

---

## 7. 交互与 UI

- **无滚轮**：autofit 开启的 markdown 块，frame 不再滚动；body 高度 = 块几何高度，
  内容恰好填满（因 rowSpan ≥ fit）。静态/读页对 autofit 块用 `overflow:hidden`（§5.2）。
- **EditView 改单栏 + 悬浮 ghost 预览**（owner 拍板）：删除
  [MarkdownEditView](../../../packages/block-kinds/src/markdown/MarkdownEditView.tsx)
  的 textarea+预览双栏，active 编辑面只剩**纯 textarea 填满整块**（消除测量歧义、
  统一基准为 RenderView）。**同时把 §5.3 那个穿 Frame 的测量 RenderView 做成可见的
  右侧对齐悬浮 ghost 预览**（不占块内空间、不参与网格）——测量与预览一体，近零边际
  成本，恢复"边写边见渲染"的反馈回路。
  - **红队 finding — 跨 kind 一致性**：删双栏后 markdown 成纯源码编辑，而刚上的
    richtext 是 WYSIWYG；ghost 预览正是为补回 [block-markdown.md](../../product/prd/features/blocks/) 要求的"保住反馈回路"前提。明确产品分工：markdown
    **源码优先**（canonical 是 markdown 文本）+ ghost 渲染预览，richtext WYSIWYG，
    分工是有意的，非疏漏。验收标准（§8/§11）："作者无需失活 markdown 块即可见其
    渲染输出"。
- **垂直 resize 手柄 = 设 floor + reconcile**（autofit 开启时，红队 finding 要求落到
  状态机而非"实现时打磨"）：
  - 手柄**写 `minRowSpan`（floor）**，**不**直接 `transform({rowSpan: previewH})`；
    随后据 `max(floor, fit)` 经新 op 提交有效 rowSpan。
  - **ResizePreview ghost 要诚实**：拖动 previewH **钳到 `max(currentFit, draggedH)`**，
    使 ghost 不显示块不会落到的高度——手势在内容/fit 线"顶住"。
  - **§5.1 新增触发**："floor 经手柄改变"（原四触发——内容/colSpan/主题/挂载——
    不含 floor 改，否则 resize 后的 `max(floor,fit)` 重导出无人调度）。
  - floor 真低于内容时，钳掉的区段可渲染一条 floor 标记线，让作者看到地板意图已记录。
- **水平 resize（colSpan）照常**：宽度是作者一等控制，触发重测。
- **per-block 开关**：markdown 块的**右键菜单**出一个 "auto height" toggle
  （checked 态走 M9-D3 已就位的 menuitemcheckbox；与 shell/edit/delete 同菜单）。
  Properties / 编辑 chrome 可镜像同一开关。位置/形态走现有 chrome 约定，dev/theme
  决定，非 PRD 约束。
- 默认：markdown 新建块 **autofit 开**；存量/迁移块 = 关（§6）。

---

## 8. 范围与 rollout

1. **markdown 先行**：仅 markdown kind 暴露开关、默认开；存储层 kind-agnostic。
2. **压力测试**：随机生成大量不同 kind / 尺寸 / 内容量的画布，跑新 op + reflow。
   property-based 验证 invariant 不破、收敛、reversibility（见 §11）。**红队
   finding — perf gate 须可测**：现有 property test 只断言 invariant、**不测时间**
   （[property.test.ts](../../../packages/grid-engine/src/__tests__/property.test.ts)
   仅 `expect(r.ok)`；CONTRACT 把 large-N benchmark 推到 Phase 2+）。本轮须为新 op
   定**显式延迟预算**（如单次 reconcile 在 B≈500 块下 p95 < X ms）+ 计时 harness，
   否则二次/三次方回归会"全绿通过"。并校正"50k"措辞——现实是 10k（5×2000），要么
   提迭代数要么改文案对齐。
3. **owner 手测**：真浏览器试用，**专盯连续缩（A）的跳动感**与主题切换自愈。
   **红队 finding — 测试 setup**：迁移后存量块全为 autofit-OFF，主题切换自愈 pass 只
   遍历 autofit 块 → 全 OFF 语料**不触发**该路径。手测须在 autofit-ON 块上做：新建块
   即 ON；对既有 dogfooding 笔记手动 toggle 一组代表性旧块到 ON 覆盖（a）跳动、
   （b）自愈。迁移默认 OFF 是有意安全选择（避免加载时全语料大重排），非待测缺口。
4. **泛化**：整体通过后，开放为所有 block kind 的基础能力（UI 门控放开）。
5. **bridge-problem 实例入 owner dev 库（owner 要求，计划最后一步）**：通过真实 HTTP
   API（seed-examples / seed-devdocs 同款姿势）在 owner dev 库播一个**桥块演示页**——
   即 G/W/K 拓扑：一个 autofit markdown 块 `G`（窄、左列）上方/之间，一个**横跨 G 列+旁列
   的宽块** `W`，旁列下方一个块 `K`。owner 据此真浏览器手测最难的可逆路径：在 `G` 里
   打字撑高（看 `W` 下推、`K` 不动）→ 删回（看归位）→ 提交净增高（看"提交即压实"边界
   行为）。这页是 §11 命名 fixture（G/W/K）的活体对照 + owner 验收用例。
---

## 9. 契约与 PRD 影响

- **grid-engine CONTRACT.md**：新增 op（+可选 `reconcileRowSpans` 批量原语）进
  "State mutation" 表；Algorithm details 增"向下位移"小节（含伪代码 + 复杂度，§4.4
  定后补）；op 表给 failure modes（`invalid span` / `out of bounds` / `id not found`）。
- **ADR — 确定需要新 PRD-informed ADR（MAJOR）**：§4.4 选定 C5 = 在 autofit 事务手势
  内挂起 gravity，按 CONTRACT Versioning 表（重定义 gravity 语义 = major + 新 ADR）。
  （C5 vs C2 不改变 ADR 面——两者同样手势内挂起 inv4；C5 还省掉 clamp 回归测试。）
  ADR 须写明 carve-out："autofit grow 在原子编辑会话内临时挂起 gravity；页面在完成手势
  前后于静止态仍 gravity-stable，由逆回放（或提交时一遍 applyGravity）重建，而非连续
  压实。" carve-out 须**紧紧限定在原子编辑会话**，以免侵蚀别处的 Option-A 心智。
  invariant 1-3/5-7 不变；**无持久 schema 变更**（日志瞬态，比 C4 的 homeRow 列省）。
  **范围判定**：这把本轮从"加一个 op"升级为"有界但真实的引擎项目"（一个事务 op +
  原子性 invariant + 日志住 web 控制器 + ADR）；markdown-first 仍可发（web 层本就拥有
  floor/fit/journal，§4.3），泛化到全 kind 是后续 UI 门控翻转、非更多引擎活。
- **PRD pass**（PRD-master 纪律）：blocks.md / notepage-editing.md 需承接"块高度可由
  内容在作者约束内自增长"这一 product-observable 行为，及 floor 语义。属下游义务，
  列入实现计划。

---

## 10. 风险与开放问题

- **R1 正确性部分已由 §4.4 解决，残留=视觉跳动**：曾经的"连续缩永久重排无关块"
  （§4.2-pre）由 C5（100% 手势内可逆 / 0 旁列误移）消除。残留仅"编辑中块随内容长缩、下方
  块跟动"的**视觉跳动感**——纯 UX，非正确性。手测 gate 它；真嫌跳就走 §3 升级位
  `off/grow/grow+shrink`，B（grow-only，删字不缩、手动一键收）作 UX 备选。
- **R2 测量精度 — 已重定方法**：不再"减固定 chrome 高/分壳校"（脆弱、对宽度轴无效）；
  改为穿真 Frame、按真实几何宽量外层 offsetHeight（§5.3）。chrome 与换行宽由构造正确。
- **R3 inactive vs active 高度差 — 已决（owner）**：基准统一 RenderView；EditView 改
  纯 textarea + 悬浮 ghost 预览（穿 Frame，兼测量与可见预览，§5.3/§7）。
- **R4 import / 跨主题已发布页 — 修正（红队）**：§5.1.4 挂载自愈**只覆盖编辑态工作
  块，不覆盖 `/notes/:slug` 服务的已发布快照**（读者不挂载编辑器；自愈后的工作块也
  不流入快照，除非显式重发布）。故对已发布页该窗口**永久**而非暂态。处置 = autofit
  块静态页 `overflow:hidden` 裁切（§5.2）+ 存量默认 OFF + 作者手动重开恢复。
- **R5 / R5b — 已被 §4.4 机制解决**：C5 reconcile **gravity-agnostic**（从不调
  applyGravity，靠从 base 重推）。所以 gravity-off 页面下 shrink = 从 base 重推 →
  **下方块归位、不留洞**（C1/C3/C4 全栽在这；C5 免费解决）。§3 的"自动缩"承诺在
  gravity-off 下也成立。唯一与 toggle 的耦合点 = **提交时**：gravity-on 页净增高块跑一遍
  applyGravity 压实；gravity-off 页按推后布局提交（合法浮空，CONTRACT inv4 gravity-off 分支）。
- **R6 桥块强制空洞（红队）**：宽桥块横跨 grower 列 + 旁列时，旁列下方留不可回填死带
  （§4.2-pre）。不破 invariant（仍 no-overlap + gravity-stable）。§4.4 机制定后据此
  改 §11 的"无 orphan 空洞"断言（要么接受桥块下死带为合法、要么机制消除），并把
  G/W/K、双桥列为命名回归 fixture。
- **R7 cascade 推挤算法是唯一真新引擎逻辑（红队）**：§4.1"位移"非现有 op 可复用
  （现有 resize 遇碰撞 reject，不推）。须在 §9/CONTRACT 补伪代码 + 复杂度界（grow
  O(B²·R) / shrink O(B)；victim 选择 / 每碰撞体推距 / 链式传递 / 终止性=每次推严格
  增 row）。
- **R8 提交时压实边界（仿真 judge）**：§4.4 hybrid 在 gravity-on 页提交净增高块时跑
  一遍 applyGravity。"会话内可逆" 与 "提交后受 gravity 管辖" 的边界须在 ADR 精确界定，
  否则对作者表现为不确定。
- **R9 base 快照生命周期 + 推迟不可逆（仿真 judge）**：base 快照瞬态不持久；reload /
  跨手势 undo / 协作远端 op 会让 grown 布局成新 base（此后不可逆，但永不重叠）。单用户
  MVP 可接受；协作/agent 写路径须定义降级 = 无上拉缩（留洞，绝不重叠）。**原子性**
  （grow→shrink 间无 gravity op 插入、autosave 不在手势中触发"提交即压实"）是硬前提，
  与现"每 op 后跑 gravity"模型冲突，须架构保证。**推迟不可逆**（PROBE-2，§4.4）：提交
  净增高块后下个 op 的 gravity 会带回桥块泄漏——这是"块真变高→压实"的正确行为，但
  "提交即压实"必须是被强制的 invariant 而非约定。

---

## 11. 测试策略

- **engine property test**（按红队修正）：新 op 加入既有 op 序列 + stress；断言
  "grow 后 invariant 1-7"、"`growBlock(newRowSpan<1) → {ok:false}` 且 state 不变"、
  "gravity-off 下 AABB 局部下推无重叠（validate 独立于 gravity 查 overlap）"。
  - **可逆性直接断言**（替换原虚假的"缩后 gravity 吸回"）：随机态 `grow(id,N)` 后
    `grow(id,原值)` 须**精确回到 grow 前布局**（不只是"gravity-stable"），且断言**无
    被编辑块列区间之外的块改变 row**（不许跨无关列 leapfrog）。
  - **命名回归 fixture**：G/W/K 桥块、双桥、全宽堆叠、disjoint 列、同列 cascade、
    gravity-off + autofit-shrink。
  - **perf**：单 op 延迟预算 + stress 墙钟上限（§8.2）；可加"gravity 迭代数随 B 近线性"
    的廉价回归哨兵。
- **web 层**：测量回路去抖 / 调和 `max(floor,fit)` / colSpan 改触发重测 / 主题切换
  重测 / 挂载自愈 / **floor 经 resize 改触发重 reconcile** / 路由层 `rowSpan≥minRowSpan`
  422 / 降级往返不抬 floor，单测（注意本仓 vitest 无 globals、需手动 `afterEach(cleanup)`）。
- **owner 压测脚本**：大量随机画布案例（§8.2）。
- **真浏览器**（Playwright）：打字撑高→下方块下推→删字缩回→旁列块不动；
  **galley/stationery 等非默认壳上 fit == 实时渲染行数**（穿 Frame 测量正确性，§5.3）；
  **作者无需失活 markdown 块即见 ghost 渲染**；publish 静态页高度与编辑期一致、
  **跨主题重发布内容不被裁到不可见**（overflow:hidden 裁切边界 bounded）。

---

## References

- 引擎契约：[`packages/grid-engine/CONTRACT.md`](../../../packages/grid-engine/CONTRACT.md)
- 当前渲染：[`PublishedCanvas.tsx`](../../../packages/block-kinds/src/PublishedCanvas.tsx) /
  [`GridCanvas.tsx`](../../../apps/web/src/grid/GridCanvas.tsx)
- markdown kind：[`packages/block-kinds/src/markdown/`](../../../packages/block-kinds/src/markdown/)
- Product 层依据（待 pass）：[notepage-editing.md](../../product/prd/features/notepage/notepage-editing.md) /
  [blocks.md](../../product/prd/features/blocks/blocks.md)
- Source DI（historical）：[`grid-redesign-2026-05-11.md`](../../engineering/design/_frozen/grid-redesign-2026-05-11.md)
