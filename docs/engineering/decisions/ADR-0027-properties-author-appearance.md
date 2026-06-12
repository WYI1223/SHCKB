# ADR-0027: Selection→Properties 检查器 & 作者级外观轴

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-12 |
| Authors | W_YI (owner), Claude |
| Supersedes | — |
| Superseded by | — |
| Source | [2026-06-12-mvp6-design.md](../../superpowers/specs/2026-06-12-mvp6-design.md)（owner ratified："这东西确实通常叫properties"）；决策 M6-D1..D7 见 [mvp6-scope-2026-06-12.md](../design/discussions/mvp6-scope-2026-06-12.md) |

## Context

Owner 的工具面板愿景比 MVP-5 实现大一圈：右键背景改背景色/铺图、右键 block 改外观（纸→白卡、隐藏 image 底纸）、未来 richtext 文字选区声明可改项——或 3D 引擎式侧栏检查器。这是**选择驱动的属性面板**，且引入了第三个自定义轴：作者级、逐块/逐页的外观数据（区别于 operator 级主题自定义 [ADR-0026]）。

## Decision

### 1. Selection → contributors → property sections（M6-D1）

`Selection = page | block`（text-range 为 richtext 预留位）。贡献者三类：host（页面级属性）、theme（外壳策展选项）、kind module（内容工具，[ADR-0026] 既有）。编辑器的 activeId 退化为 selection 的派生。

### 2. 形态：先停靠后悬浮（M6-D2）

检查器停靠于侧栏目录下方（3D 引擎心智模型；经 createPortal 注入 Sidebar 锚点，保持编辑器的 theme/host context）。右键悬浮菜单 = 同一属性区块的快捷投影，后做。形态是 dev 决策；产品锁是属性区块模型。MVP-5 的悬浮 ToolPanel 退役并入。

### 3. 作者级外观 = theme 策展之内的选择（M6-D3/D4）

与 [ADR-0026] M5-D3 同构的纪律——**theme 策展，作者在选项内挑**：

- `Theme.shellOptions?: ShellOption[]`（id 持久化不改名；kinds 白名单可限定适用 kind）；`BlockFrameProps.shell`；未知 id 降级默认壳。首批：stationery card/bare（bare = 拍立得只剩照片，owner 原话场景）、workbench/缺省 frame 通用 flat
- 页面背景 `{color?, blobHash?}` 为 host 级属性（自由色 + blob 图）；host 在画布根应用，`CanvasSurfaceProps.background` 同时传给主题 surface 自行诠释（主题主权）；blobHash 进 blob 引用枚举（export/GC 契约 [ADR-0023]）
- **存储**：blocks.shell + notepages.background（migration 0007，schema v7）。shell 走 working-state 全量 PUT；背景走独立端点
- **两态纪律**：背景与壳都是工作态，publish 快照携带自己的副本——公开页只在显式 publish 时变化（与主题钉选的 render-time 语义刻意不同，钉选不进快照）

### 4. 格式 v4（M6-D5）

page.background + blocks[].shell；up(v3→v4) 补 null 保持 canonical 键序；down(v4→v3) 从工作态**和已发布快照**双双剥离并逐项报损失。importer 校验形状 + 背景 blob 必须随包到达。

### 5. 还账与挂账

- 还 [ADR-0026] 挂账：theme 包 registry 拆分解开 import 环，槽位组件改 useTheme() 渲染时读 token → palettes 对深槽位主题真实生效（stationery kraft 变体落地）。策展纪律记录：变体不得动 globalCss 硬编码的纸面色族
- 挂账：右键悬浮投影；text-range selection（richtext 轮）；页面背景的 theme 策展集（当前自由色，若实践中破坏主题完整性再收紧——与块壳的策展纪律存在张力，记录为观察点）

## Consequences

作者外观链路全通：选择 → 检查器 → 壳/背景 → 工作态 → 快照 → 静态页/SPA/导出。三个自定义轴各就各位：theme 作者（slots/tokens/变体/壳选项）、operator（主题自定义）、author（逐块壳 + 页面背景）——每层都是上一层策展空间内的选择，主题完整性全程未被绕过。
