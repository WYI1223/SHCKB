# MVP-9.5 范围讨论 — autofit 收尾 + 统一 block 能力架构（2026-06-14）

Status: done — 两 slice 已 merge feat/mvp9（merge f0f2b53，2026-06-17）

Branch: feat/frame-core → feat/autofit-followfix（线性叠放，两次 `--no-ff` merge 回 feat/mvp9）

## 背景

上游 autofit 设计（`2026-06-13-block-autofit-height-design.md`，limited-height + grow + C5
可逆 + MeasureProbe）已 ratified 并转 writing-plans，本仓已落到 commit `b200828` 前的一串
autofit commit（`e86cd97` PRD pass / `79287cb` seed-bridge / `ae478e3` MeasureProbe offscreen /
`5efccce` final-review blockers）。计划里**最后一步 e2e** 尚未执行——owner 开盘即点这一步。

MVP-9.5 最终成形为**两个 slice**，都已 merge 进 `feat/mvp9`：

1. **frame-core / 统一 block 能力**（[ADR-0029]）——把可测量 block 内容盒收归 host，theme
   退化为供给纯视觉 `BlockSkin`，autofit 升为 block 基座能力。
2. **autofit follow/fix 重设计**（[ADR-0030]）——把 autofit 从 floor+grow 的"assist"重构为
   follow / fix **两个正态模式**，删除 floor。

二者的关系：① 是 stationery bug 触发的架构归位（北极星全设计、internal slice 落地），把
autofit 抬到 block 顶端；② 是抬上去之后立刻暴露的"模型本身说谎"问题的收尾——把 autofit 的
**语义**也重做对。前者是结构，后者是语义；先后顺序天然，owner 在 ① 收尾后才看见 ②。

开盘还做了两件 housekeeping：理解当前项目进度（全景同步）+ **记忆库补到 M9-D3**
（MEMORY.md frontmatter 与索引行原停在 M9-D1，补齐 D2/D3 + 当前 autofit 状态）。

## Owner 裁定

### M9.5-D1 · 跑 deferred e2e（2026-06-14）

> "启动vite，运行你没有执行的e2e"

起一个**抛弃式 DB** 的 API server（:3210，临时 temp DB，owner dev库 不碰）+ vite（:5173
代理 :3210）+ 装 Chromium，跑计划里没跑的 Playwright 全套。

> （续，发现两个 bug + 重启后的追问）"theme stationery 被破坏是否代表着，我们渲染端
> 返回的内容应该内化一部分？参考prd的theme，是否应该继承底层UI组件而不是theme是一个
> 全新UI和其他原本的材质都是一个全新的内容呢？而为了不限制theme的发挥，是不是应该
> 只内化功能类的内容呢？……对于bug 2，这个place holder具体是代表什么？……bridge seed
> 具体是什么？"

stationery 的塌缩不是"某主题写错"——owner 直接把它读成结构性问题：**渲染端是否该
内化一部分？只内化功能类内容、把视觉自由留给 theme？** 这一问开启了下面整段架构对话。

### M9.5-D2 · theme 简化的层归位纠偏（2026-06-14）

我先把 owner 的问题误接成"theme 应否继承同一个类"，owner 当场纠偏：

> "哦哦，这里，其实是有一点误区的，theme确实不应该。应该简单化。而整个UI的plugin，
> 应该是可以继承的，或者选择重写。就像前面一次mvp更换成当前的UI/以及目前还有几个
> 存在的UI分支。你可以再去看一下记录。"

**theme = 简单（material/skin），「继承或重写」属于 UI-plugin（L1）层，不是 theme。**
证据：当前 UI 本身就是 MVP-7 换上的 `ui-fork/free`（Paste-Up），且 `ui-fork/{free,reader,
workbench}` 三支并存（[mvp7-scope-2026-06-12.md] M7-D9 / [ui-fork-comparison-2026-06-12.md]）。
推论：stationery bug 的真根因是 **结构本就是 theme 的权力**（[ADR-0025] 把 `BlockFrame`
槽位给了 theme），"简化 theme" = 把功能结构从 theme 挪到 host/UI-plugin 轴。

> **纠偏注记**：我此前把 owner 问题误接成"theme 继承基类"，被当场纠正。owner 的"内化
> 功能类内容"= 把**可测量内容盒**这一功能结构归 host；视觉装饰留 theme。与项目既有
> "几何归 canvas，壳归 theme"（[ADR-0025] §2）同向，只是把"壳盒"再细分：盒=host、皮=theme。

### M9.5-D3 · autofit 是 block 基座能力（2026-06-14）

owner 再 reframe，找到更深的根：

> "等一下，我理解问题在哪了。主要问题在，我们这次只给markdown block做了这个功能，
> 只是实验性功能，而最后的目的应该是把这个功能直接给到block的顶端。而我又在想，所有
> kind的block是否是继承的同一个类呢？又或者说他们的同样功能是否统一起来呢？"

查证 kind 层后确认：**kind 不继承基类**——`BlockKindModule` 是接口 + registry（composition），
与 theme 同一反 base-class 立场（[registry.ts] 注释"In-tree kinds are plugins that happen
to live in this repo"）。**共享功能统一在 host、不在 kind**：autofit 的 metadata 是
block-level、gesture 在 host、MeasureProbe 量 `blockModule(kind).RenderView`（kind-agnostic），
**只被两个 `kind === 'markdown'` 闸门 + markdown seeding 绑死**（[GridCanvas.tsx:241] toggle /
[GridCanvas.tsx:338] probe mount）。即 autofit **已经在 block 顶端**，只是实验性 gate 在 markdown。

> owner 的三问其实是一条原则：theme/UI/kind 都落在"功能性能力归 host、可插拔物只供专长、
> 永不基类"。**可测量盒**与 **autofit 能力**是同一个 host 责任——"autofit 对任意 kind 在
> 任意 theme 下都对" 即"功能到 block 顶端"。

### M9.5-D4 · brainstorm 范围 + 选 Approach A + skin 化（2026-06-14）

走 brainstorming skill，逐段裁定（owner 原话要点逐条）：

- **冻结范围**（第一问，定调）：**北极星全设计、internal slice 落地**——设计统一目标，但只
  承诺建/冻 internal reallocation（host 持有盒 + autofit-for-all-kinds + theme 卸结构、修
  [ADR-0025]），正式 UI-plugin extension type 仍"freeze last"。
- **选 A**：
  > "A会破坏stationary theme吗？不会有破坏性更改就可以A。如果会有，告诉我是如何破坏的。
  > 同时，我还在想一个我猜测可能会简化思路，但是可能更难实现的方式。目前theme比如说
  > stationary的纸张/颜色，是block的一种皮肤。也许我们可以单独拆出来，在后面每个theme
  > 插件就是更换或者增加这些皮肤。"

  ratify A（host frame-core + theme 装饰），条件是 stationery 无**用户可见**破坏（代码会重写、
  视觉不破，靠 stationery-spike-first 求证）。owner 自发提出 **skin 概念**——纸张/颜色/纹理
  是 block 的"皮肤"，theme 插件 = 换/加皮肤；今天散在 `shells`/`papers`/`palettes` 三处。
  采纳：A 的装饰层就叫 **`BlockSkin`**，但**统一 papers/palettes 进 skin** = 北极星（YAGNI，
  block skin 才是与 bug/frame-core 绑定的部分）。
- **block plugins 复用 host**：
  > "我认为选1，但是做之前考虑一下未来block plugins，能否也可以使用这个host呢？"

  in-tree 4 kind 已"消费插件会消费的同一表面"；未来 block plugin 供 content + autofit 即
  **白拿**可测量盒 + autofit + 当前 theme 的 skin，且**无法**破坏盒子——stationery 那类 bug
  对插件也不可能发生。约束：host-core + skin 是**插件可达的共享原语**，不是 apps/web 内部。
- **frame-core 可扩展性 = Open/Closed**：
  > "未来plugin可以做到新增这部分core frame内容吗（不开放更改原来的内容，因为更改的话
  > 可能是一个工程灾难，除非允许plugin替换整个frame-core，而插件作者能写frame-core也
  > 代表他有这个能力去看到相关内容，无许过多束缚）？还是说这个是写死的？"

  ratify 三模式：**整体替换 frame-core = 可**（L1 重写路径，全权全责、最小约束）；**加法扩展
  = 可**（compose/继承路径，autofit 自身就是一例）；**局部改写 core 内部 = 不可**（owner 点名
  的"工程灾难"）。唯一律 = "让内容可测量 + 持 overflow"，用**一个共享不变量测试**钉死（即能抓
  stationery 塌缩的那个）。本 slice 只发**一个**默认 core，但契约干净、非写死。
- **image / SVG 支持**：SVG/内联/data-URI/CSS image 现在就支持（`behind`/`front` 返回
  ReactNode + 加宽 `SkinBoxStyle` 含背景图/border-image）；theme 打包真实图片**文件** = 受阻于
  **theme asset pipeline**（北极星，同"只能用已装字体栈"的坑）；theme 是受信代码可用 url()/SVG，
  未来 theme/UI 成不受信第三方时公开页 SVG/url() 闸门 = 北极星。
- **逐 kind autofit 策略**（owner 拍板 code）：
  > （Section 4 追问后）"code 也算文本内容"

  `autofit?: false | { default }` kind 字段——**image = `false`（autofit-unavailable）**；
  markdown/richtext/**code** = `{ default: 'grow' }`；省略 = 可用、默认 `off`。
  （此 enum 形状在第二 slice 被 follow/fix 取代，见 M9.5-D6。）
- **deferred 不能消失**：
  > "deferred UI-plugin pass的内容要记录下来，不能随时间消失了。"

  ratify **三处 durable 归宿**：本 spec + PRD Phase-2+（plugin-system / theme-system，列为
  实现计划显式任务）+ 新 ADR。owner 坚持它不随带日期文档蒸发。
- **写 spec + 派 discussion 补录**：
  > "没问题，不如就在这个时候你写spec并派agent去完成这个session的discussion补录。
  > 参考mvp1/mvp7/8/9。"

  spec 写 `docs/superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md`；
  本 session discussion 补录（本文件）= owner 要求的并行 agent 任务。

### M9.5-D5 · frame-core slice 实现（2026-06-14..17）

brainstorm spec 转 writing-plans（`2026-06-14-unified-block-capability-slice.md`，16 任务、
**spike-first**），按 subagent-driven-development 逐任务落地：

- **契约先行**（Phase 1）：`@skb/theme` 新增 `BlockSkin`/`resolveSkin`/`skinOptionsFor`（皮的
  `box`/`root` style 是**类型受限的只视觉子集**，物理上写不出 `position`/`overflow`/`height`/
  `display`）；`@skb/block-kinds` 新增 host `BlockFrameCore`（持 `.skb-content-box`，host 不变量
  属性**最后应用**）+ 框架默认 skin；**跨 skin×kind×theme 的盒不变量测试**——即能抓 stationery
  塌缩的那个 guardrail。
- **stationery 先 spike**（Phase 2）：最难主题先重建为 skin（paper-slip/polaroid/card/bare），
  逐层 diff 求证视觉不破——`rootStyleOf(ctx)` 承载逐块 tilt，撕边/卷角/和纸胶带走 `behind`/
  `front` overlay，纸面背景仍由 `.skb-paper` + globalCss 承载，3px 撕边留白走 `root.style.padding`。
- **其余主题迁移**（Phase 3）：galley/marginalia 中等、token-only 主题（graph-paper/ink/blueprint/
  workbench）自动落到框架默认 skin、零改；`shells → skins` 全仓改名。
- **三渲染site 统一**（Phase 4）：editor（GridCanvas）、发布（PublishedCanvas）、MeasureProbe
  **包同一个 frame-core** → "所测即所渲"由构造保证；删除 legacy `theme.BlockFrame`/`shells`/
  `resolveBlockFrame`/`shellOptionsFor`/`ShellDefinition`/`DefaultBlockFrame`（零运行时消费者）。
- **autofit 解闸**（Phase 5）：`BlockKindModule.autofit` 字段 + 移除两个 `kind === 'markdown'`
  闸门；逐 kind 策略（文本 grow / image false）；seeding 读 `kind.autofit.default`。
- **测试 + 文档**（Phase 6/7）：e2e `fit-shells` 泛化五主题（断言移到 `.skb-content-box`）+
  新增 `autofit-all-kinds`（code grow / image 无 toggle）；PRD Phase-2+ 传播（plugin-system +
  theme-system）+ [ADR-0029] 起草 + 修订 [ADR-0025]/[ADR-0028] + AUDIT 注册。

并行做了**图像优先的开发者文档页**（块系统·抽象逻辑 / 实现与权衡）：走 HTML→PNG→blob 管线
（`tools/block-doc-art`，**render under node 不是 bun**——见坑），把架构页做成 figure 而非
grid-as-canvas（[feedback-visual-docs-image-figures] 纪律）。slice 收口：**391 unit + 12 e2e 全绿**。

### M9.5-D6 · autofit follow/fix 重设计（2026-06-15..17）

frame-core 把 autofit 抬到 block 顶端后，owner 立刻看见模型本身的毛病并 reframe：autofit
不是"floor + grow 的 assist"，而是**两个正态模式**的选择——

- **`follow`**（文本 kind 默认）= 高度跟随实测内容（1 行最小，无 floor，C5 可逆，clip）。
- **`fix`**（opt-in；image 只能 fix）= 固定手动高度、可拖动 resize、内容滚动。

reframe 的动机是两个结构性问题：① **toggle 说谎**——当 floor ≥ 内容（块被拖得比文本高），开
autofit 看不到任何变化，控件像坏了；② 两个重叠旋钮（floor *和* on/off）表达一个概念，第三个
enum 值 `'grow+shrink'` 是死的。"关掉 grow"从来不是"关"，而是*切到 fix*——off-framing 藏掉了
第二个真实模式。

落地路径（**design spec 先行**，按项目纪律权威文档先于代码）：写
`2026-06-15-autofit-follow-fix-design.md` → [ADR-0030] + AUDIT 注册 + 给旧 autofit spec 加
superseded banner → 11 任务计划（`2026-06-15-autofit-follow-fix-slice.md`，严格依赖序）→ 经
**4 个编排 workflow** 实现：1 个 change-surface MAPPING workflow（先把删 floor 的跨层删除面
摸清）+ 3 个顺序实现 phase，每 phase 带双 spec/quality + 对抗 review。最后做了一次
**4-agent 整支对抗 review**，抓出并修掉一个重要契约缺口——**EditorPage 把 null autofit 解析成
`'fix'` 而非 kind 默认**（文本块以 null 抵达编辑器会错误地加载成 fix 而非 follow；改为经
`blockModule(kind)?.autofit?.default` 解析，发布路径 null→fix 作为安全回退保留）。

owner 收尾 refinement：右键 toggle 从 checked-by-default 的 **"follow content"** 翻成 opt-in 的
**"Fixed height"** 复选框（checked = fix，default follow = 不勾）——因为 follow 是默认态，
"uncheck 才偏离"的控件很别扭；翻成"勾选才偏离"读得更顺，UI label 也对齐内部 `fix` 模式名。

**硬事实（落地）：**

- **floor / `minRowSpan` 跨层全删**：DB 列、wire types（web + server + export）、reconcile 数学、
  floor-resize 手势分支、insert-seed、服务端 422 floor 兜底、migration floor-reset 测试。
- **DB 迁移 drizzle `0009`**（`0009_autofit_follow_fix.sql`）：迁 autofit 值（grow/grow+shrink →
  follow；null/off/unknown → fix）+ **DROP `min_row_span` 列** → **schema 9**（runtime applier 从
  最高迁移文件名推导 schemaVersion，无常量可 bump；`/api/health` 报 schemaVersion 9；Bun SQLite
  实测 DROP COLUMN 可用，file header 注明 SQLite < 3.35 的表重建回退）。
- **export `FORMAT_VERSION` 5→6**：成对 up/down 触 working *与* published blocks；`up` 把
  grow/grow+shrink → follow、off/null → fix、丢 minRowSpan；`down`（有损）follow → grow、
  fix → off、重引入 `minRowSpan: null`（带 loss note；`'grow+shrink'` 折进 follow 再回 grow
  无损，因其本是死值）。
- **1 行最小住 `measureFit.ts`**（`Math.max(1, …)`）——不是独立 floor 字段；follow target 从
  `max(floor, fit)` 改为 `Math.max(1, fit)`。
- **逐 kind 契约**：`autofit?: { default: 'follow' | 'fix'; canFollow?: boolean }`——markdown/
  richtext/code = `{ default: 'follow' }`；image = `{ default: 'fix', canFollow: false }`（image
  无可测文本内容，fix-only，follow toggle 缺席）；下游闸门从 `autofit !== false` 改为
  `autofit?.canFollow !== false`。owner locked = 显式 `canFollow` 标志而非重载 `false` sentinel。
- **收窄 [ADR-0028] gravity carve-out**：只 follow 块持活体手势触发 carve-out；fix 块静态、走
  普通 `transform()` resize。`pushResize` 引擎 op 签名与原子性完整不变，仅契约/注释 scrub。

slice 收口 green：**web 56 / server 108 / block-kinds / theme / grid-engine + e2e 15/15**。

### M9.5-D7 · 开发者文档一致性收尾（本 session，2026-06-17）

follow/fix 落地后，dev-doc 仍画着被删的 floor 模型——做一轮 doc 一致性收尾：

- **更新 autofit 图（③）**：块系统·抽象逻辑的 figure ③ 从 `max(floor,fit)` / minRowSpan /
  image=off·文本=grow 的旧模型，重画为 follow/fix 两模式（follow 默认、跟随内容、1 行最小、无
  floor、clip、C5 可逆 vs fix opt-in、固定高、可拖动、滚动；image fix-only），含"Fixed height"
  opt-in toggle + 逐 kind 默认；权衡图（⑥）的 autofit 行 + 示例行 + fig③ alt 同步。重渲 + 重 seed
  dev库。
- **doc 审计**：其余架构页**已是 frame-core-correct**、无残留 stale autofit；旧词汇只存活在
  带日期的 spec/plan 里（作为历史 trace 正确保留，未动）。还 scrub 了 seed header 里最后一处
  stale autofit 注释（floor/fit/effective → follow/fix）。
- **退役旧 thin 架构/块系统页**：被新的图像优先 pair（抽象逻辑 / 实现与权衡）取代——从
  seed-devdocs 删 `seedBlockSystem()` 调用，并把两处入站 `see('块系统')` 链接（结构导图 overview
  + 写一个块）repoint 到 **块系统·抽象逻辑**；live dev库 删页 + repoint 两链接。

### M9.5-D8 · 两 slice merge 回 feat/mvp9（2026-06-17）

线性叠放的两 slice 经**两次 `--no-ff` merge** 回 `feat/mvp9`：`mvp9 → frame-core（+19）→
autofit（+15）`，最终 merge `f0f2b53`。两个已冗余的 branch 指针删除。mvp9 **未 push**。

> 拓扑注记：frame-core slice tip `20c9c38` 即 follow/fix 的 **design spec** 那个 commit——
> spec 落在 frame-core 分支末端（先有结构、才看见语义问题），autofit slice 从该 tip 分叉，
> plan/[ADR-0030]/实现全在 autofit 分支。两次 merge 把这条线性栈重锚回 feat/mvp9。

## 设计桩（两 slice 钉定，详见各自 spec / ADR）

**北极星原则（frame-core）：** 功能性 / 结构性能力活在 host；kind / theme / UI-plugin 是薄插件，
只供给各自专长——kind = content，theme = material/skin，UI-plugin = frame-core/chrome。三者在
同一个 host 持有的、可测量的 block 盒上组合。任何一层都没有 base class；要么整体替换，要么加法
扩展，永不局部改写。

**Approach A（host frame-core + theme decoration，ratified）：** 单一 host frame-core（活在
`@skb/block-kinds`，编辑器 + 静态发布同用）持有内容盒不变量（`.skb-content-box` 永在正常流、撑
自然高、持 overflow/clip，host 不变量属性**最后应用**）；theme 供 `BlockSkin`（root/box/behind/
front），其 `skin.box` 是**类型受限**的只视觉子集，**构造上**无法重新引入 stationery 那种塌缩。
MeasureProbe 改包同一 frame-core，"所测即所渲"由构造保证。

**follow/fix 模型（autofit）：** autofit 从 enum（`off`/`grow`/`grow+shrink`，只 `grow` 接线，
`max(floor, fit)`）变为两个互斥单一真相的正态模式——follow = 纯 `fit`（1 行最小活在
`measureFit.ts`），fix = 纯 `rowSpan`（固定、可拖、滚动）。floor / `minRowSpan` 整体删除，不再有
"作者最小高度"第三概念。host frame 盒 overflow 键基于布尔 `follow`（`follow → hidden`，
`fix → auto`，映射与旧 autofit 布尔不变，仅命名漂移）。

**迁移：** frame-core slice **无数据迁移**（渲染层 + kind 契约 refactor，schema 不变）；autofit
slice **有迁移**（drizzle 0009 删列至 schema 9 + export FORMAT_VERSION 5→6 成对 up/down）。范围
边界 = 两 slice 都**只动 block frame/autofit**，`CanvasSurface`/`PageTitle` 暂留 theme 槽，随
北极星 UI-plugin pass 再移。

层归属与详细契约见
[2026-06-14-unified-block-capability-architecture-design.md](../../../superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md)
与 [2026-06-15-autofit-follow-fix-design.md](../../../superpowers/specs/2026-06-15-autofit-follow-fix-design.md)。

## Build Log

（按时间追加）

1. **2026-06-14 · 进度同步 + 记忆库补 M9-D3** —
   开盘"理解目前整个项目的进度"全景同步（MVP-1..8 已 merge main、MVP-9 richtext 轮
   feat/mvp9 进行中 D1-D3）；MEMORY.md frontmatter 与索引行原停 M9-D1，补齐 M9-D2（编辑面
   Notion 化）/ M9-D3（菜单统一面 + 颜色/间距）+ 当前 autofit 进行状态。

2. **2026-06-14 · deferred autofit e2e 跑通（M9.5-D1）= 抓出 2 真 bug + 2 测试问题，commit `b200828`** —
   Playwright config 的 `webServer` 用 POSIX `VAR=val cmd` 前缀语法（Windows cmd.exe 不能
   parse），故手动起服务让 Playwright `reuseExistingServer` 复用。**起前清场**：:3210 有上一
   会话遗留的 `bun --watch`、:5173 有遗留 vite，配置不明（可能指向 owner **真 dev库**，e2e 建页/
   发布会污染）→ 两个都 kill，换**临时 temp DB** 的干净实例（owner dev库 全程未碰）。装 Chromium。
   首跑 **3 passed / 3 failed**（passing 3 = galley fit / ghost preview / smoke）。三败 triage：
   - **Bug 1（真 product bug）= stationery autofit 测量塌缩**：MeasureProbe 把 RenderView 包进
     真 Frame **按 auto 高**量外层 offsetHeight。in-flow frame（graph-paper 默认壳、galley）撑内容
     量得对；**stationery** 把内容画进绝对定位 `inset:3px` 的 `.skb-paper`，无确定高时该层**塌成
     0** → `fit` 恒为 **1**，与内容无关。throwaway 诊断 spec 出硬数：**stationery committed G=52px /
     rowSpan=1 / `.skb-paper` scrollHeight=328px 被裁进 46px；galley 控制组 committed 352px /
     rowSpan=6（正确）**。旧公式还漏了画布 `2*pad` 格子内缩（边界内容溢出几像素）。
     修 = MeasureProbe 给**确定高**格子 + **AREA**（height:100% → 内容区）/ **CONTENT**
     （height:auto → 自然高）双层；`chrome = cellHeight − area`；`fit = ceil((content+chrome+2*pad)/
     slot)`——frame-agnostic、不读 getComputedStyle（`measureFit.fitFromContent` 取代
     `fitFromOuterHeight`）。
   - **Bug 2（真 product bug）= 清空块缩不回地板**：`MarkdownRenderView` 对空内容渲染占位文本
     **"Empty markdown block"**——在窄块（2 列）里**折成 2 行** → 空块量到 fit=2 → G 缩不回
     floor=1 → 下方 W 卡一行。占位是 editor chrome 非内容，不该撑高测量。修 = 占位强制单行
     （nowrap + ellipsis）。（后续 commit `935e13b` 进一步让空块直接渲空、彻底丢掉占位文本。）
     澄清：6×3 默认是**网格 footprint（floor）**，与占位文本无关；只在 floor 小（1）+ 块窄时才咬到。
   - **测试问题 #3（非 product bug）**：发布页**无 editor-only `data-block-id`**（只发 `data-kind`），
     测试选择器 `[data-block-id="A"]` 选不到——publish-clip 功能其实正确。修 = 按内容定位发布块。
   - **测试问题 #4（非 product bug）**：fit-shells 在 stationery 的**装饰外层 slip** 上断言"no clip"，
     断错了元素。修 = 断言到真正的 clip 容器。
   修后 **e2e 6/6 绿**；单测 web 51（+2 新测量测）/ block-kinds 70 / grid-engine 63 / server 114；
   web + block-kinds typecheck 干净。commit `b200828`（只 stage 自己的文件，未碰 untracked png/
   tools/asr）。

3. **2026-06-14 · 架构对话：stationery bug → 统一 block 能力（M9.5-D2/D3）** —
   bug 触发 owner 三连追问，逐次纠偏收敛（详 Owner 裁定 D2/D3）。派 background agent 回捞前序
   theme-architecture session（确认"reference-impl not base-class"既有立场源自 session
   `d7b00534`，原话进 [feedback-theme-extensibility-model] 记忆）；并查证 kind 层确认
   `BlockKindModule` = 接口 + registry、autofit 已 kind-agnostic 仅被两个 `markdown` 闸门绑定。

4. **2026-06-14 · brainstorm spec 产出（M9.5-D4，commit `4557c10`）** —
   走 brainstorming skill 逐段（6 段），每段 owner 确认。spec 写到
   `docs/superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md`，§13 列两个
   follow-up（PRD 传播 / 新 ADR 起草 + AUDIT 注册）+ 本 discussion 补录。

5. **2026-06-14..17 · frame-core slice 落地（M9.5-D5）= 19 commit（`a899761..20c9c38`）** —
   spike-first 16 任务（subagent-driven-development）。关键 commit：契约
   `a899761`（BlockSkin + resolveSkin/skinOptionsFor）/ `7929012`（host BlockFrameCore）/
   `6fd1b36`（跨 skin×kind×theme 盒不变量 guardrail）；stationery spike `3334823`（paper-slip/
   polaroid/card/bare）；其余主题 `854017c`（galley/marginalia/flat；token-only 落框架默认）；
   发布路径 `098612e` + editor `3fd5213`（统一包 BlockFrameCore、解闸 autofit）；autofit 升基座
   `df6f0d7`（image unavailable / 文本 grow）；删 legacy `565c437`（BlockFrame/shells/
   resolveBlockFrame/shellOptionsFor/ShellDefinition/DefaultBlockFrame，零运行时消费者）；e2e
   `a735605` + `4595ecc`（fit-shells 泛化五主题、断言移到 `.skb-content-box`；autofit-all-kinds
   按 UI **可用性**断言——image 无 toggle / code 有，"All 12 e2e green"）；文档 `c5f884e`（PRD
   Phase-2+ + [ADR-0029] + 修订 [ADR-0025]/[ADR-0028]）。并行：图像优先 dev-doc pair `2c75ab0`/
   `c336fe3`/`5164479`（seed → canvas diagram → HTML→PNG→blob figure，`tools/block-doc-art`）。
   slice 收口：**391 unit + 12 e2e 全绿**（中途 checkpoint：theme 18 / block-kinds 111 / web 51）。

6. **2026-06-15..17 · autofit follow/fix slice 落地（M9.5-D6）= 15 commit（`b911f29..f50f6d7`，base `20c9c38` spec）** —
   design spec `20c9c38`（落 frame-core 分支末端）→ plan `b911f29` → [ADR-0030] + AUDIT + 旧 spec
   superseded banner `3600a39`。实现经 1 MAPPING + 3 顺序 phase（双 spec/quality + 对抗 review）：
   契约 `a60e740`（`{default, canFollow}`）/ frame overflow 键 follow `a15f489` / web 交互
   `ce74dd5`（删 floor、per-mode resize、freeze-on-switch）/ ReadPage legacy-aware 强制
   `b1e8af6`（SPA/static parity）/ 服务端路由 `36222c9`（解析 follow/fix、删 422 floor guard）/
   持久化 `90fd8cf`（**drizzle 0009 删 min_row_span 至 schema 9** + **FORMAT_VERSION 6** 成对
   up/down）/ e2e `63fcaef`（fix-overflow / freeze-on-switch / fix-resize）/ T10 注释 scrub +
   freeze-test polling `a095535`。**4-agent 整支对抗 review** 抓出 `3d7ec03`（EditorPage null→
   kind 默认；契约缺口）。owner refinement `f4b074c`（toggle 翻成 opt-in "Fixed height" 复选框，
   menu 单测 8 例重写）。dev-doc 收尾 `b97b68e`（autofit 图 ③ → follow/fix）/ `65033b3`（scrub
   最后一处 stale 注释）/ `f50f6d7`（退役旧 thin 块系统页 + repoint 两入站链接）。slice 收口：
   **web 56 / server 108 / block-kinds / theme / grid-engine + e2e 15/15 全绿**。

7. **2026-06-17 · 两 slice merge 回 feat/mvp9（M9.5-D8）** —
   两次 `--no-ff` merge：`16fa6d8`（Merge feat/frame-core — unified block-capability slice，
   ADR-0029）+ `f0f2b53`（Merge feat/autofit-followfix — autofit follow/fix two-mode model，
   ADR-0030）。线性栈 `mvp9 → frame-core +19 → autofit +15`；两冗余 branch 指针删除；mvp9 未 push。

## 坑 / 教训

- **bun 跑 Playwright 会挂**：bun 的 Playwright `headless_shell` 启动卡在 CDP pipe → doc-art 渲染
  与截图都**在 node 下跑，不在 bun**（图像优先 dev-doc 管线 `tools/block-doc-art` 的固定纪律，
  见 [feedback-visual-docs-image-figures]）。
- **Windows WinNAT 保留端口阻断 `Bun.serve` 绑定**：保留区间（2807–3506 等）会让 Bun.serve 绑不
  上 → e2e 跑在隔离端口 **3600/5273**（config 临时改后改回），并在 **bash 里预启服务**——因为
  Playwright 的 `VAR=value cmd` webServer 字符串是 bash-only（cmd.exe spawn 不了）。
- **`seed-devdocs.ts --replace` 会清掉整棵 开发者文档 树**（含图像优先 pair 所在的 架构 子夹），
  但**不重 seed 那对 pair**——它来自独立的 `seed-block-system-doc.ts`；任何 devdocs `--replace`
  之后须**重跑** `seed-block-system-doc.ts`。
- **编排 workflow 撞 API 529 过载**：有几次 orchestration workflow 命中瞬时 529；一次 map run
  丢了 4/5 agent，靠 completeness critic 自己的 grep sweep 把变更面捞了回来（对抗 review 的冗余
  在此兑现）。
- **floor 删除是 load-bearing 跨层删**：DB 列 + wire types（web/server/export）+ reconcile 数学 +
  floor-resize 手势分支 + insert-seed + 服务端 422 guard + migration floor-reset 测试——必须**一个
  slice 内连贯删**，否则契约破（[ADR-0030] §Consequences）。整支对抗 review 正是为抓这类残留 +
  null 语义变更（持久 null 不再意 "off"）而设，并确实抓出 EditorPage 的 null→fix 缺口。

## Open Items

- **PRD 传播已落**（不再 open）：[ADR-0029] §Deferred 表已传到 plugin-system + theme-system PRD
  Phase-2+（owner 的"不能消失"保证之一，见 AUDIT entry）。
- **北极星 / deferred UI-plugin pass**（freeze-last，durable 记录于 spec §9 + 两 PRD + [ADR-0029]）：
  UI-plugin extension type / frame-core 替换-扩展 seam（Open/Closed）/ theme full simplification
  （CanvasSurface/PageTitle 移出）/ skin unification（papers + palettes + block skins 并一）/
  theme asset pipeline / published-asset 安全闸门 / autofit 外的加法 block 能力。
- **active-block freeze 路径延后**：follow→fix 的 freeze-at-current-height 在 inactive 块是
  no-op（rowSpan 已等于 committed fit），active 块 mid-grow 切换的活体 fit→rowSpan 拷贝路径
  [ADR-0030] §3 已写明规则但实现延后（GridCanvas 注明）；当前 toggle 只在 inactive 触达，无暴露。
- **`b.shell` 字段名保留**：持久化的 skin id 仍叫 `shell`（rename 到 `skinId` = 北极星数据
  rename，避免数据迁移）；`resolveSkin` 把它当 skin id 读。
- **bridge seed 仍未跑**：`seed:bridge` 写 owner **真 dev库** 的 G/W/K 桥块演示页，幂等；e2e 跑
  临时 DB 故未触发，待 owner 决定何时跑（注：autofit slice 已把 seed-bridge 的 autofit 值改 follow/
  fix、删 minRowSpan）。
- **空块发布页占位**：bug 2 顺带的开放问题——空 markdown 块在**发布页**的渲染（已让编辑器空块渲空），
  发布页行为留后续。

## Artifact Updates

- 2026-06-14：创建本 discussion record；后续扩成完整 MVP-9.5 记录（本次）。
- 2026-06-14：commit `b200828`（autofit frame-agnostic 测量 + 空块缩回修复，e2e-found）；
  commit `4557c10`（frame-core brainstorm spec）。
- 2026-06-14..17：frame-core slice 19 commit（`a899761..20c9c38`）；新建 spec
  `2026-06-14-unified-block-capability-architecture-design.md` + plan
  `2026-06-14-unified-block-capability-slice.md` + [ADR-0029] + 修订 [ADR-0025]/[ADR-0028] +
  AUDIT entry + 两 PRD Phase-2+ + 图像优先 dev-doc pair（`tools/block-doc-art`）。
- 2026-06-15..17：autofit slice 15 commit（`b911f29..f50f6d7`）；新建 spec
  `2026-06-15-autofit-follow-fix-design.md` + plan `2026-06-15-autofit-follow-fix-slice.md` +
  [ADR-0030] + AUDIT entry；drizzle `0009_autofit_follow_fix.sql`（schema 9）；export
  FORMAT_VERSION 6；旧 autofit spec 加 superseded banner；dev-doc autofit 图 ③ 重画。
- 2026-06-17：两次 `--no-ff` merge（`16fa6d8` frame-core / `f0f2b53` autofit）回 feat/mvp9；
  退役旧 thin 块系统页 + repoint 两入站链接（`f50f6d7`）；删两冗余 branch 指针；mvp9 未 push。

## References

- 本轮 spec（frame-core）: [2026-06-14-unified-block-capability-architecture-design.md](../../../superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md)
- 本轮 spec（autofit follow/fix）: [2026-06-15-autofit-follow-fix-design.md](../../../superpowers/specs/2026-06-15-autofit-follow-fix-design.md)
- 实现计划: [2026-06-14-unified-block-capability-slice.md](../../../superpowers/plans/2026-06-14-unified-block-capability-slice.md) / [2026-06-15-autofit-follow-fix-slice.md](../../../superpowers/plans/2026-06-15-autofit-follow-fix-slice.md)
- 上游 autofit 设计（被 follow/fix 取代 §4.3/§5.1/§6/§7）: [2026-06-13-block-autofit-height-design.md](../../../superpowers/specs/2026-06-13-block-autofit-height-design.md)
- 本轮 ADR: [ADR-0029](../../decisions/ADR-0029-host-frame-core-blockskin.md)（host frame-core + BlockSkin；修订 [ADR-0025] §1/§2、扩展 [ADR-0028]）/ [ADR-0030](../../decisions/ADR-0030-autofit-follow-fix.md)（follow/fix 两模型；取代 floor 模型、收窄 [ADR-0028] gravity carve-out、扩展 [ADR-0029] §3 autofit 字段）
- 上游 ADR: [ADR-0025](../../decisions/ADR-0025-theme-slots.md)（theme 渲染槽位）/ [ADR-0028](../../decisions/ADR-0028-autofit-gravity-carveout.md)（autofit gravity carve-out）
- 前序 UI-fork 记录: [mvp7-scope-2026-06-12.md](./mvp7-scope-2026-06-12.md) / [ui-fork-comparison-2026-06-12.md](./ui-fork-comparison-2026-06-12.md)
- 前序 richtext 轮: [mvp9-scope-2026-06-13.md](./mvp9-scope-2026-06-13.md)
- 关键源文件: [BlockFrameCore.tsx](../../../../packages/block-kinds/src/BlockFrameCore.tsx) / [skin.ts](../../../../packages/theme/src/skin.ts) / [GridCanvas.tsx](../../../../apps/web/src/grid/GridCanvas.tsx) / [MeasureProbe.tsx](../../../../apps/web/src/grid/MeasureProbe.tsx) / [measureFit.ts](../../../../apps/web/src/grid/measureFit.ts) / [registry.ts](../../../../packages/block-kinds/src/registry.ts) / [stationery.tsx](../../../../packages/theme/src/stationery.tsx) / [0009_autofit_follow_fix.sql](../../../../apps/server/drizzle/0009_autofit_follow_fix.sql)
- 图像优先 dev-doc 管线: [tools/block-doc-art](../../../../tools/block-doc-art)（HTML→PNG→blob，render under node）/ [seed-block-system-doc.ts](../../../../apps/server/scripts/seed-block-system-doc.ts)
- AUDIT register: [AUDIT-2026-05.md](../../decisions/AUDIT-2026-05.md)（[ADR-0029] / [ADR-0030] 已注册）

## Changelog

- 2026-06-14 initial record：autofit deferred-e2e 跑通（M9.5-D1，2 真 bug + commit `b200828`）；
  theme 简化层归位纠偏（M9.5-D2）；autofit 升 block 基座 + kind 反基类确认（M9.5-D3）；统一
  block 能力 brainstorm 选 A + skin 化 + 逐 kind autofit + deferred 三归宿（M9.5-D4）。
- 2026-06-17 extended to full MVP-9.5 record：frame-core slice 实现（M9.5-D5，19 commit，391 unit +
  12 e2e）；autofit follow/fix 重设计（M9.5-D6，15 commit，floor 全删 + drizzle 0009 schema 9 +
  FORMAT_VERSION 6 + canFollow 契约 + 整支对抗 review 抓 null→fix 缺口 + Fixed-height 复选框
  refinement）；dev-doc 一致性收尾（M9.5-D7）；两 `--no-ff` merge 回 feat/mvp9（M9.5-D8，merge
  `f0f2b53`）。Status → done。补 Build Log / 坑·教训 / 设计桩双 slice / References。
