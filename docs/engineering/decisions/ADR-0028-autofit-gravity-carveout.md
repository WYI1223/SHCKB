# ADR-0028: Autofit grow suspends gravity within an atomic edit session

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-13 |
| Authors | W_YI (owner), Claude |
| Supersedes | —（收窄 [grid-engine CONTRACT.md] invariant 4 的 "每个 mutating op 之后 gravity-stable" 表述：增设手势瞬态窗例外）|
| Superseded by | — （本 ADR 完整保留；被 [ADR-0029](./ADR-0029-host-frame-core-blockskin.md) 扩展：autofit 从"markdown autofit"泛化为 block-base capability + 逐 kind `BlockKindModule.autofit` 策略） |
| Source | [2026-06-13-block-autofit-height-design.md](../../superpowers/specs/2026-06-13-block-autofit-height-design.md) §4.4/§9（owner ratified 2026-06-13；PRD-informed：[blocks.md] / [notepage-editing.md] 承接"块高度可由内容在作者约束内自增长"）|

> **Extension (2026-06-14) — [ADR-0029]**：本 ADR 决策的 `pushResize` 引擎原语与 gravity carve-out 不变量**完整保留**。[ADR-0029](./ADR-0029-host-frame-core-blockskin.md) 在此之上扩展：把"markdown autofit"升为 block-base capability（host `BlockFrameCore` 持有可测量盒 + MeasureProbe）；逐 kind 策略通过 `BlockKindModule.autofit` 字段声明（markdown/richtext/code = `grow`，image = `false`，省略 = 可用默认 `off`）；移除两个 `kind === 'markdown'` 闸门，使 toggle 与 probe 对任意可用 kind 生效。

## Context

markdown block 内容超过作者设的 `rowSpan` 时，今天交给主题 frame 滚动。owner reframe 为 **limited-height + grow**：块有作者意图的最小高度（floor / `minRowSpan`），内容只能整行步进往上撑，有效 `rowSpan = max(floor, fit)`（fit = `ceil(内容px / SLOT)`，前端编辑时测量、不持久 fit）。

要让"打字撑高 / 删字回收"在编辑中**可逆且局部**，红队用真引擎语义证伪了原稿假设——"撑开→推碰撞块→跑全局 `applyGravity`"。反例 `G{c0-1,r0,h1}` / `W{c0-5,r1,h1}` / `K{c4-5,r2,h1}`：grow G→h3 把横跨 grower 列+旁列的"桥块" `W` 推下，全局上重力把旁列**毫不相干**的 `K` 吸到 row0；shrink 时上重力只能向上、吸不回去 → K 从 row2 永停 row0。结论：**可逆性 ⊥ 全局 gravity-stable（Option A）**。这是布局质量 + 可逆性缺陷（结果仍 no-overlap + gravity-stable），不是引擎正确性缺陷，但它无法在不触碰 gravity 语义的前提下消除。

spec §4.4 用真引擎语义仿真 + 1000-case fuzz + 命名场景电池在 5 个可逆机制中择优，选定 **C5（base-snapshot + re-push）**：100% 手势内可逆 / 0 旁列误移 / 0 重叠 / 0 不终止，且与未来 Ctrl+Z undo 共快照基元、无 clamp bug 类。C5 在 autofit 编辑手势内**挂起 gravity**——这正是 [grid-engine CONTRACT.md] Versioning 表判定为 "gravity 语义重定义 = major + 新 PRD-informed ADR" 的变更。本 ADR 承接该判定，并把 carve-out **紧紧限定在原子编辑会话**，以免侵蚀别处的 Option-A 心智。

## Decision

### 1. Engine 新增一个纯下推原语 `pushResize`（不调 gravity）

engine 新增 mutation op：

```
pushResize(state: GridState, id: string, newRowSpan: number, opts?: OpOptions) → OpResult
```

语义：把 block `id` 的 `rowSpan` 设为 `newRowSpan`；对每个与撑开后 footprint AABB 碰撞的块，**按竖直重叠深度恰好向下推**，top-down 递归（终止性：每次推严格增大 row，grid 垂直无上界）。**永不调用 `applyGravity`**。它是 grow 与 shrink 的**同一个引擎**——caller 传 base 快照 + 目标 `newRowSpan`，shrink 即从 base 快照重推到更小目标、自然回收空间。

- **输入守卫复用 `isRegionInBounds`**（不外包给某个特定 caller 的 ceil）：`newRowSpan` 必须 integer ≥ 1 且 col/colSpan 合法，否则 reject——failure mode `invalid span` / `out of bounds` / `id not found`，与 `resizeBlock` 对齐。"永不 reject" 收窄为"**永不因垂直空间不足 reject**"（grid 垂直无上界，向下永远有空间）。
- **纯 / kind-opaque / leaf 全保持**（invariant 6/7）：op 是纯函数，**不测量 DOM**；目标 `rowSpan` 由 web 层算好作为 arg 传入。`floor`（`minRowSpan`）与 `autofit` 开关**不进 engine Block 类型**，是 web/server 层拥有的 block metadata（fit 来自 DOM 测量，调和公式 `max(floor, fit)` 是 web 层逻辑）。

### 2. Gravity carve-out（本 ADR 的核心，紧紧限定在原子编辑会话）

> **autofit grow 在原子编辑会话内临时挂起 gravity；页面在完成手势前后于静止态仍 gravity-stable，由从 base 快照重推（或提交时一遍 `applyGravity`）重建，而非连续压实。**

展开为可强制的规则：

1. **快照基元住 web 编辑控制器，不进 engine**：手势开始（块进入 autofit 编辑）对整页布局拍一张 base 快照（`captureLayoutSnapshot(state)` = 深不可变克隆）+ grower id + 其 base `rowSpan`。
2. **手势内每次调和到目标 T**：`reconcile(base, targetRowSpan) = pushResize(base, growerId, target)`，从**同一** base 重推。因为每次都从 base 重新推导，可逆性自动成立——无逆向日志、无 clamp。partial-shrink（+3→+1）结构上等于"直接从 base 推到 +1"。
3. **提交规则（PROBE-2 invariant）**：手势提交（失焦 / idle / autosave-after-gesture）时，若净 `rowSpan` delta ≠ 0 且页面 gravity-on，跑**一遍** `applyGravity` 重新压实（块真变高并保留 → 压实是正确 Option A）；gravity-off 页按推后布局提交（合法浮空，CONTRACT invariant 4 的 gravity-off 分支）。**"提交即压实" 是被强制的 invariant，不是约定。**
4. **原子性 = 硬前提**：grown 期间任何"跑 gravity 的 op"都不得插入手势（现模型每 op 后跑 gravity，插入会在非 gravity-stable 中间态重演桥块泄漏）。grow→shrink 手势须是无 gravity-op 插入的事务单元；autosave 不得在手势未结束时触发"提交即压实"。单用户 debounced-PUT 天然满足，但写成 invariant。

### 3. Invariant 4 的重定义——**只在手势窗内**

[grid-engine CONTRACT.md] invariant 4（Gravity-stable / Option A）原表述为"gravity-on 时每个 mutating op 之后 `∀ block: NOT canRise`"。本 ADR 增设**唯一**例外窗：

- **静止态（手势前/后）**：完全 Option-A 稳定，表述不变。
- **autofit 原子编辑会话内（瞬态）**：gravity **挂起**，grown 中间态合法持浮空块（一个或多个块 `canRise` 为真）。会话结束由从 base 重推（净零 → 逐位还原 base）或提交时一遍 `applyGravity`（净变高）重建 gravity-stable。
- `pushResize` 本身**从不**保证调用后 gravity-stable——它是 gravity-agnostic 原语，gravity-stability 的重建由 caller（web 控制器的提交规则）负责，正如 `{gravity:false}` 已合法持久化非 gravity-stable 布局。

invariant 1（no overlap）/ 2（in bounds）/ 3（discrete spans）/ 5（unique ids）/ 6（purity）/ 7（leaf）**全部不变**：grown 中间态仍无重叠、在界内、span 离散、id 唯一、op 纯。**无持久 schema 变更**（base 快照瞬态、住 web 层，比被淘汰的 C4 home-row 持久列省）。

### 4. 推迟不可逆是被界定、不是被消灭（PROBE-2 / R8）

C5 靠"手势内不压实"换可逆；一旦**提交了一个净变高的块**到 gravity-on 页，下一个普通 op 的 `applyGravity` 会把桥块泄漏带回（K r2→r0）。所以承诺精确表述为：**"编辑会话内可逆；提交一个净变高块后，正常 Option-A 压实生效（这是正确行为——块确实变高了）"**。owner 最怕的"打一行删掉、无关块永久移位"被解决，因为会话内删回即归位、净零不提交变高。base 快照瞬态不持久：reload / 跨手势 undo / 协作远端 op 会让 grown 布局成新 base（此后不可逆，但永不重叠）。单用户 MVP 可接受；协作 / agent 写路径须定义降级 = 无上拉缩（留洞，绝不重叠）。

## Consequences

- 本轮从"加一个 op"升级为**有界但真实的引擎项目**：一个事务性 push op（`pushResize`）+ 一条原子性 invariant + base 快照住 web 控制器 + 本 ADR。markdown-first 仍可发（web 层本就拥有 floor / fit / 快照）；泛化到全 kind 是后续 UI 门控翻转、非更多引擎活。
- carve-out 的瞬态性让 ADR 面收窄：持久 / 静止态完全 Option-A 兼容，现有所有 op（move / insert / delete / 手动 resize）与页面静止态原样不动。
- 快照基元（`captureLayoutSnapshot`）是**未来 Ctrl+Z undo 栈的预定地基**——共享的是基元而非功能（undo = 一栈快照、原样还原；autofit = 一张 gesture-base 快照、`reconcile` 重推）。本轮只发 autofit 这一个消费者，不建栈、不绑 keymap。
- `validateState` 仍 floor-blind：`rowSpan ≥ minRowSpan` 的跨字段兜底落在 web/server 路由层（落库 PUT 在 `validateState` 通过后追加该校验，违则 422），engine 保持 floor-blind。这是全系统唯一兜底落在路由层而非引擎的几何承诺。
- autofit 块在静态 / 读页用 `overflow:hidden` 裁切（非 autofit 保持 `auto`）：尊重无滚轮美学；跨主题漂移由作者手动重开页触发编辑器自愈修正。server / publish 永不测量。

## Alternatives considered

被 spec §4.4 用真引擎语义仿真 + 同种子 fuzz 淘汰的可逆机制（择优 trace 留 spec）：

1. **C1 保留全局 gravity（baseline）** —— 拒绝：70.5% 手势内可逆 / 275 旁列误移；约 30% "打字再删"永久重排无关块，不可发。
2. **C3 位移日志 + canRise 闸缩** —— 拒绝：93% 可逆 / 8 旁列误移；桥块逆向被卡（canRise 无法穿回被重占的行）。
3. **C4 anchored home-row** —— 拒绝：56.7% 可逆 / 61 旁列误移，最差；且要加持久 schema 列 + 迁移，只把"泄漏"换成"钉死"。
4. **C2 push-only + 逆向日志** —— 与 C5 目标上并列（100% / 0），但有 `min(delta,shrink)` load-bearing clamp bug 类 + 日志陈旧风险 + delta Map 状态更重，且 delta 日志弹不出可还原历史态（无法与 undo 共基元）。C5 在 owner tie-breaker（更少 bug 类 / 状态更简 / 与 undo 共基元）上胜出。

## References

- Spec: [2026-06-13-block-autofit-height-design.md](../../superpowers/specs/2026-06-13-block-autofit-height-design.md)（§4.4 机制择优 / §9 契约与 PRD 影响 / §11 测试）
- Engine 契约: [grid-engine CONTRACT.md](../../../packages/grid-engine/CONTRACT.md)（Versioning 表判定本 ADR 触发条件；invariant 4 被本 ADR 收窄）
- PRD（下游待 pass）: [blocks.md](../../product/prd/features/blocks/blocks.md) / [notepage-editing.md](../../product/prd/features/notepage/notepage-editing.md)
- 相关 ADR: [ADR-0019](./ADR-0019-mvp-implementation-baseline.md)（engine lift 基线 / invariant 4 条件化前身）
