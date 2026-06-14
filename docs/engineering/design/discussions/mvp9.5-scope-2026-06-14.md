# MVP-9.5 范围讨论 — autofit 收尾 + 统一 block 能力架构 brainstorm（2026-06-14）

Status: in progress（autofit slice 已落 e2e 6/6 绿 + commit `b200828`；架构 slice = brainstorm spec 产出待实现）

Branch: feat/autofit

## 背景

上游 autofit 设计（`2026-06-13-block-autofit-height-design.md`，limited-height + grow + C5
可逆 + MeasureProbe）已 ratified 并转 writing-plans，本仓已落到 commit `b200828` 前的一串
autofit commit（`e86cd97` PRD pass / `79287cb` seed-bridge / `ae478e3` MeasureProbe offscreen /
`5efccce` final-review blockers）。计划里**最后一步 e2e** 尚未执行——owner 开盘即点这一步。

本 session 两段：① 把那步 deferred 的 e2e 跑通（结果：抓出 2 个真 product bug）；
② 这两个 bug 中 stationery 的塌缩**触发** owner 一连串架构追问，收敛为一份统一 block
能力架构 brainstorm spec。前者是 tactical floor，后者是 strategic ceiling，owner 明确二者
不冲突。

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
- **deferred 不能消失**：
  > "deferred UI-plugin pass的内容要记录下来，不能随时间消失了。"

  ratify **三处 durable 归宿**：本 spec + PRD Phase-2+（plugin-system / theme-system，列为
  实现计划显式任务）+ 新 ADR。owner 坚持它不随带日期文档蒸发。
- **写 spec + 派 discussion 补录**：
  > "没问题，不如就在这个时候你写spec并派agent去完成这个session的discussion补录。
  > 参考mvp1/mvp7/8/9。"

  spec 写 `docs/superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md`；
  本 session discussion 补录（本文件）= owner 要求的并行 agent 任务。

## 设计桩（brainstorm 中钉定，详见 spec）

**北极星原则：** 功能性 / 结构性能力活在 host；kind / theme / UI-plugin 是薄插件，只供给各自
专长——kind = content，theme = material/skin，UI-plugin = frame-core/chrome。三者在同一个
host 持有的、可测量的 block 盒上组合。任何一层都没有 base class；要么整体替换，要么加法扩展，
永不局部改写。

**Approach A（host frame-core + theme decoration，首选并 ratified）：** 单一 host frame-core
（活在 `@skb/block-kinds`，编辑器 + 静态发布同用）持有内容盒不变量（`.skb-content-box` 永在
正常流、撑自然高、持 overflow/clip）；theme 供 `BlockSkin`（root/box/behind/front），其 `skin.box`
是**类型受限**的只视觉子集（无 `position`/`overflow`/`height`/`display`），**构造上**无法重新引入
stationery 那种塌缩。MeasureProbe 改包同一 frame-core，"所测即所渲"由构造保证；已提交的
frame-agnostic 测量退化为 belt-and-suspenders backstop。

**autofit 升 block-base：** 移除两个 `kind === 'markdown'` 闸门 + 加 kind `autofit` 字段；
能力普适（host）、默认逐 kind（声明）、作者逐块 toggle（既有，解闸即可）。

**迁移：** 无数据迁移（schema v8 不变）；**stationery-spike-first**（最难主题先重建并 diff，
spec §5 映射表即清单）；范围边界 = 本 slice **只移 block frame 盒**，`CanvasSurface`/`PageTitle`
暂留 theme 槽，随北极星 UI-plugin pass 再移。

层归属与详细契约见
[2026-06-14-unified-block-capability-architecture-design.md](../../../superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md)。

## Build log

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
     （nowrap + ellipsis）。澄清：6×3 默认是**网格 footprint（floor）**，与占位文本无关；只在 floor
     小（1）+ 块窄时才咬到，默认 floor=3 永远见不到。
   - **测试问题 #3（非 product bug）**：发布页**无 editor-only `data-block-id`**（只发 `data-kind`），
     测试选择器 `[data-block-id="A"]` 选不到——publish-clip 功能其实正确（A `overflow:hidden`、
     B `overflow:auto`）。修 = 按内容定位发布块。
   - **测试问题 #4（非 product bug）**：fit-shells 在 stationery 的**装饰外层 slip**（washi/curl/
     torn-edge 自带 overflow）上断言"no clip"，断错了元素。修 = 断言到真正的 clip 容器（`.skb-md`
     的父节点：stationery=`.skb-paper`、galley=`.skb-block`）。
   修后 **e2e 6/6 绿**；单测 web 51（+2 新测量测）/ block-kinds 70 / grid-engine 63 / server 114；
   web + block-kinds typecheck 干净。spec §5.3 加 **E2E finding** 注记并改写测量机制（穿真 Frame、
   真实几何宽两条红队结论不变；确定高 + AREA/CONTENT 双层取代 auto-height 外层量法）。
   [ADR-0028] 的 `fit = ceil(内容px/SLOT)` 是概念层决定（编辑时测、不持久、`max(floor,fit)`），
   抽象级正确，按 doc-layering 纪律保持不动。commit `b200828`（只 stage 自己的文件，未碰
   untracked png/tools/asr）。

3. **2026-06-14 · 架构对话：stationery bug → 统一 block 能力（M9.5-D2/D3）** —
   bug 触发 owner 三连追问，逐次纠偏收敛（详 Owner 裁定 D2/D3）。派 background agent 回捞前序
   theme-architecture session（确认"reference-impl not base-class"既有立场源自 session
   `d7b00534`，原话进 [feedback-theme-extensibility-model] 记忆）；并查证 kind 层确认
   `BlockKindModule` = 接口 + registry、autofit 已 kind-agnostic 仅被两个 `markdown` 闸门
   绑定。结论：theme 简化 = 把功能结构（可测量盒）归 host、视觉留 theme；autofit 解闸即抬到
   block 基座。

4. **2026-06-14 · brainstorm spec 产出（M9.5-D4，commit `4557c10`）** —
   走 brainstorming skill 逐段（Section 1 分层与所有权 / 2 host frame-core + 盒不变量 / 3
   `BlockSkin` 契约 + stationery 逐层映射 / 4 autofit-for-all-kinds / 5 迁移 spike-first + 范围边界 /
   6 北极星 + deferred 三归宿 + ADR 修订），每段 owner 确认（"符合，可以继续"/"没问题，下一部分"/
   "没问题"）。Section 6 全六段 approved 后写 spec 到
   `docs/superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md`。spec §13
   列两个 follow-up（PRD 传播 / 新 ADR 起草 + AUDIT 注册）+ 本 discussion 补录。

## Open Items

- **实现交给 writing-plans**（spike-first 任务序：frame-core + BlockSkin + 不变量测试 → 只重建
  stationery 并 diff → 迁移其余四主题 `shells→skins` → 解闸 autofit + kind `autofit` 字段 → 删
  死掉的 `theme.BlockFrame`/`shells`）。spec 尚未转计划。
- **PRD 传播**（PRD-master 纪律）：spec §9 deferred 表落进 plugin-system + theme-system PRD
  Phase-2+，列为实现计划**显式任务**（owner 的"不能消失"保证之一）。
- **新 ADR 起草 + AUDIT 注册**：host frame-core + BlockSkin + autofit-for-all-kinds 决定；修订
  [ADR-0025]（§1/§2：block 盒 theme→host、theme 供 BlockSkin）与 [ADR-0028]（markdown autofit →
  block-base 能力 + 逐 kind `autofit` 策略）。走 AUDIT 流程（PRD-informed，触两个 PRD）。
- **bridge seed 仍未跑**：`seed:bridge`（[seed-bridge.ts](../../../../apps/server/scripts/seed-bridge.ts)）
  写 owner **真 dev库** 的 G/W/K 桥块演示页（autofit 计划 §8.5 最后一步、可逆路径活体对照），
  幂等；e2e 跑的是临时 DB 故未触发，待 owner 决定何时跑。
- **e2e 服务清场副作用**：本 session 起手 kill 了 owner 两个遗留 dev server（:3210 bun / :5173
  vite，配置不明），换 e2e 临时实例；owner 已重启自己的 vite（:5173），:3210 e2e server 已停。
- **code autofit 默认**：brainstorm 中我曾倾向 code=`off`（长代码滚动更合理），owner 拍板 code
  算文本内容 = `grow`。已采纳，记此 trace。
- **空块发布页占位**：bug 2 顺带的开放问题——空 markdown 块是否该在**发布页**渲染占位文本
  ("Empty markdown block")，留后续。

## Artifact Updates

- 2026-06-14：创建本 discussion record。
- 2026-06-14：commit `b200828`（autofit frame-agnostic 测量 + 空块缩回修复，e2e-found）；
  改 `apps/web/src/grid/measureFit.ts` / `MeasureProbe.tsx`、`packages/block-kinds/src/markdown/
  MarkdownRenderView.tsx`、两 e2e spec、spec §5.3。
- 2026-06-14：commit `4557c10`（brainstorm spec
  `docs/superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md`）。
- 2026-06-14：MEMORY.md + project_shckb_current_state.md 记忆补 M9-D2/D3 + autofit 状态。
- 待办（非本 session 产出）：PRD Phase-2+ 传播、新 ADR + AUDIT entry、[ADR-0025]/[ADR-0028] 修订。

## References

- 本轮 spec（详细设计）: [2026-06-14-unified-block-capability-architecture-design.md](../../../superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md)
- 上游 autofit 设计: [2026-06-13-block-autofit-height-design.md](../../../superpowers/specs/2026-06-13-block-autofit-height-design.md)
- 相关 ADR: [ADR-0025](../../decisions/ADR-0025-theme-slots.md)（theme 渲染槽位 / 几何=host、壳=theme；本轮修订其 §1/§2）/ [ADR-0028](../../decisions/ADR-0028-autofit-gravity-carveout.md)（autofit gravity carve-out；本轮泛化其 markdown 范围）
- 前序 UI-fork 记录: [mvp7-scope-2026-06-12.md](./mvp7-scope-2026-06-12.md)（M7-D8 层占据模型 / M7-D9 ui-fork/free 合入）/ [ui-fork-comparison-2026-06-12.md](./ui-fork-comparison-2026-06-12.md)
- 前序 richtext 轮: [mvp9-scope-2026-06-13.md](./mvp9-scope-2026-06-13.md)
- 关键源文件: [GridCanvas.tsx](../../../../apps/web/src/grid/GridCanvas.tsx)（两 `markdown` 闸门 :241/:338）/ [MeasureProbe.tsx](../../../../apps/web/src/grid/MeasureProbe.tsx) / [measureFit.ts](../../../../apps/web/src/grid/measureFit.ts) / [registry.ts](../../../../packages/block-kinds/src/registry.ts) / [stationery.tsx](../../../../packages/theme/src/stationery.tsx)
- AUDIT register: [AUDIT-2026-05.md](../../decisions/AUDIT-2026-05.md)

## Changelog

- 2026-06-14 initial record：autofit deferred-e2e 跑通（M9.5-D1，2 真 bug + commit `b200828`）；
  theme 简化层归位纠偏（M9.5-D2）；autofit 升 block 基座 + kind 反基类确认（M9.5-D3）；统一
  block 能力 brainstorm 选 A + skin 化 + 逐 kind autofit + deferred 三归宿（M9.5-D4）。
