# 统一 block 能力架构 — host 持有功能，kind/theme/UI 皆薄插件

**Goal:** 把「可测量的 block 内容盒 + autofit/测量/overflow」等**功能性能力**收归 host，让 kind / theme / UI-plugin 退化为只供给各自专长（content / material-skin / chrome-shape）的**薄插件**；三者在同一个 host 持有的可测量 block 盒上组合。

**Architecture:** 单一 host `frame-core`（活在 `@skb/block-kinds`，编辑器与静态发布同用）持有内容盒不变量；theme 供给 `BlockSkin`（材质/装饰，类型受限到视觉子集，物理上无法破坏盒子）；kind 供给 content + 一个 `autofit` 策略字段；UI-plugin（延后）持有 chrome 与 frame-core 本身（整体替换或加法扩展，永不局部改写）。

**Tech stack:** React + TS monorepo（bun workspace）；`@skb/block-kinds`（kind 契约 + frame-core）、`@skb/theme`（tokens + skin）、`apps/web/src/grid`（canvas 几何 + autofit gesture + MeasureProbe）、静态发布 `renderToStaticMarkup`。

**Status:** brainstorming 产出，待 owner 评审。修订 [ADR-0025]、[ADR-0028]；落地为新 ADR（PRD-informed，走 AUDIT 流程）。

**关系：** 上游延续 `2026-06-13-block-autofit-height-design.md`（autofit 限高+grow + C5 可逆 + MeasureProbe）。本设计在其之上做**架构归位**：把 autofit 从「markdown 实验功能」抬到「block 基座能力」，并把触发它的 frame 结构从 theme 移到 host。

---

## 1. 背景与问题

MVP-9.5 只给 markdown 做了 autofit（实验性）。跑 e2e 时发现：**stationery 主题的 autofit 整个塌掉**——它的 frame 把内容画在绝对定位、`inset` 的内层（`.skb-paper`）里，离屏测量给不到确定高时该层塌成 0 → `fit` 恒为 1 → 6 行内容被压进 1 行（galley 控制组正确量到 6 行；stationery 的 `.skb-paper` scrollHeight=328px 被裁进 46px）。已用 frame-agnostic 测量（commit `b200828`）止血。

但根因不是「某个主题写错了」，而是**结构本就是 theme 的权力**（[ADR-0025] 把 `BlockFrame` 槽位给了 theme）。owner 顺此连出三个问题，最终收敛成一条原则：

- **theme 应否「继承同一个类」？** → 不，且本就不是：kind/theme 都走**接口 + registry**（composition），不是继承链。这是已定的反 base-class 立场。
- **「继承或重写」属于哪一层？** → 属于 **UI-plugin（L1）轴**，不是 theme。当前 UI 本身就是 MVP-7 换上的 `ui-fork/free`（Paste-Up），且 `ui-fork/{free,reader,workbench}` 三支并存。theme 应「简单化」。
- **autofit 该不该是 markdown 专属？** → 不，它本就是 **block 基座能力**：MeasureProbe 量 `blockModule(kind).RenderView`（kind-agnostic）、metadata 是 block-level、gesture 在 host 层——只被两个 `kind === 'markdown'` 闸门 + seeding 绑在 markdown 上（[GridCanvas.tsx:241](../../../apps/web/src/grid/GridCanvas.tsx#L241)、[:338](../../../apps/web/src/grid/GridCanvas.tsx#L338)）。

## 2. 北极星原则

> **功能性 / 结构性能力活在 host；kind / theme / UI-plugin 是薄插件，只供给各自专长 —— kind = content，theme = material/skin，UI-plugin = frame-core/chrome。三者在同一个 host 持有的、可测量的 block 盒上组合。任何一层都没有 base class；要么整体替换，要么加法扩展，永不局部改写。**

本次落地（internal slice）只兑现其中**内容盒**那一块；其余进 deferred UI-plugin pass（§9），且必须**durably 记录**。

## 3. 分层与所有权（the plugin surface）

四方参与，**host frame-core 是它们组合的枢纽**：

| 参与者 | 持有 | 供给 | 能破坏盒子吗 |
|---|---|---|---|
| **Host frame-core**（`@skb/block-kinds`，编辑器+发布同用） | 可测量内容盒、overflow、geometry-fit、autofit 测量/gesture、RenderView 挂载点 | —（它就是枢纽） | n/a |
| **Kind plugin**（`BlockKindModule`） | content + 编辑 | RenderView/EditView/createContent/extractText/tools + **`autofit` 策略** | 否——只供 content |
| **Theme**（简化后） | material | 一个 **`BlockSkin`**（surface/border/overlays/rim + tokens + globalCss） | 否——只是给盒子穿衣，改不了尺寸 |
| **UI plugin**（延后，L1） | chrome/shell，且*可整体替换* frame-core | frame-core 实现 | 是——这正是 inherit/rewrite 轴（北极星） |

**block plugin 直接复用 host**：in-tree 4 个 kind 已经「消费一个插件会消费的同一表面」（[registry.ts](../../../packages/block-kinds/src/registry.ts) 注释）。一个未来的 block plugin 供 content + `autofit`，**白拿**可测量盒 + autofit + 当前 theme 的 skin，且**无法**重写/破坏盒子——stationery 那类 bug 对插件也不可能发生。theme 没有对应 skin 时，host 用**默认 skin**（vanilla floor 不可抽走）。kind→host 契约保持**最小**（YAGNI）：kind 只声明 `autofit`（+ 既有 `defaultSize`）；overflow/盒行为永远是 host+skin，不是 kind。

## 4. Host frame-core 与可测量盒

frame-core（在 `@skb/block-kinds`，取代各 theme 的 `BlockFrame`）在**可见渲染**与 **MeasureProbe** 里是**同一个**组件——故「所测即所渲」由构造保证（今天两边各自 `resolveBlockFrame`，会漂移）。结构：

```
<div class="skb-frame-root" style={fill cell + skin.rootStyle}>   // tilt/transform 在这层
  {skin.behind}                                                   // 撕边、卷角（overlay）
  <div class="skb-content-box"                                    // ← 不变量，host 持有
       style={ ...skin.box, position:'relative', overflow:blockOverflow(autofit) }}>
    <RenderView content={…} />
  </div>
  {skin.front}                                                    // 和纸胶带（overlay）
</div>
```

**盒不变量（功能契约）：** `.skb-content-box` 永远**在正常流、撑出内容自然高、且是 overflow/clip 容器**。这正是 stationery 用 `position:absolute; inset` 破坏掉的东西。

**由「类型」强制，而非约定** —— 这是 A「构造上不可破坏」的关键：`skin.box` 是**只视觉**的受限子集（`background / border / borderRadius / padding / color / boxShadow / backgroundImage / backgroundSize / backgroundRepeat / backgroundPosition / borderImage`），**不是**任意 `CSSProperties`。skin 物理上写不出 `position` / `overflow` / `height` / `display`，且 host 的不变量属性最后应用。任何 skin（或 block plugin）都无法重新引入塌缩。

**测量延续：** 已提交的 MeasureProbe（确定高 + AREA/CONTENT 双层 → chrome）保留，但改包 **frame-core** 而非 `resolveBlockFrame`。因盒子保证在流内，测量由构造稳健 —— frame-agnostic 修复退化为「belt-and-suspenders」备份，而非唯一防线。`feat/autofit` 的工作是被本设计 refactor 的地基，不作废。

**几何不变：** canvas 仍持有定位外层（`left/top/width/height`）并给 frame-core `100%/100%`——[ADR-0025] 的「几何=host」半边保留；只把「壳盒=theme」改成「盒=host，skin=theme」。

## 5. `BlockSkin` 契约

skin = theme 给 host 盒穿的衣。类型上**碰不到**盒的流/高/overflow：

```ts
type BlockSkin = {
  id: string;                 // 持久化（取代今天的 shell id）
  name: string;
  kinds?: string[];           // 适用于这些 kind；省略 = 全部（同 ShellDefinition.kinds）
  root?: {                    // geometry-fill 外层
    className?: string;
    style?: SkinRootStyle;    // 受限：transform/filter/opacity/视觉 —— tilt 在这里；不许 detach
  };
  box?: {                     // host 内容盒
    className?: string;
    style?: SkinBoxStyle;     // 受限：background(含 image)/border/radius/padding/color/boxShadow —— 无 position/overflow/height/display
  };
  behind?: (ctx: SkinCtx) => ReactNode;  // 内容之后的 aria-hidden overlay（撕边、卷角）
  front?:  (ctx: SkinCtx) => ReactNode;  // 内容之前的 aria-hidden overlay（和纸胶带）
};
// SkinCtx = { blockId, kind, colSpan, rowSpan, tokens } —— 够算 tilt 等
```

**theme 暴露：** `skins: Record<id, BlockSkin>`（**取代 `shells`**）+ 一个指定的默认 skin + tokens + `globalCss`（不变）。更大的统一——`papers`（页面表面）与 `palettes`（配色变体）也并入「skin」概念——是**北极星**，不在本 slice（YAGNI；block skin 才是与 bug/frame-core 绑定的部分）。

**image / SVG 作为 skin：**
- SVG / 内联 / data-URI / CSS image **现在就支持**：`behind`/`front` 返回 `ReactNode`（可内联 `<svg>`/`<img>`），stationery 已这么用（`#skb-rough` 内联 SVG）；盒表面图经扩展后的 `SkinBoxStyle`（背景图/border-image）承载，纯视觉、零布局高、不动盒不变量与测量。`data:` URI / 渐变**无需新基建**（theme 是代码）。
- **theme 打包真实图片*文件*（`paper.png`）= 受阻**，但不是被 skin 契约阻，而是**资产投递**：需要 **theme asset pipeline**（已知未建的坑，同「只能用已装字体栈」那个）→ 北极星。
- **信任边界：** theme 是**受信代码**——可自由用 `url()`/SVG；`isSafeCssColor` 闸门只管*作者/operator*输入，不管 theme 代码。未来 theme/UI 成为**不受信第三方**时，公开页上 theme 供给的 SVG/`url()` 是 XSS / 外链隐私向量 → published-asset 安全闸门进北极星。
- **边界一条：** skin 的图是**装饰**——随 host 盒缩放；永不*决定* block 尺寸。「frame 图决定 block 高」是结构 = UI-plugin 轴，不是 skin。

**stationery 映射**（这就是 spike 的清单，证明可逐层复现）：

| stationery 今天的层 | `BlockSkin` 字段 |
|---|---|
| tilt `rotate(f(id,colSpan))` | `root.style.transform` |
| `.skb-paper-slip` | `root.className` |
| 3px 撕边留白 | `root.style.padding: 3px`（盒内缩，撕边在留白里露出） |
| 撕边剪影 `.skb-paper-edge`、卷角 `.skb-curl` | `behind` |
| 和纸胶带 | `front` |
| 纸面背景 + scroll-curl + 隐藏滚动条 | `box.className:'skb-paper'` + theme `globalCss` |
| 纸面 padding `10/8/8` | `box.style.padding` |
| 内容 | host RenderView 在盒内 |

**未知 kind 回退：** 当前 theme 无匹配 skin（如 block plugin 的 kind）时，host 用**框架默认 skin**（极简卡片）。任何 kind 在任何 theme 下都能渲染 —— vanilla floor。

## 6. autofit 升为 block-base 能力

机制*已经* kind-agnostic（见 §1）。改动：

- kind 契约加一个字段：`autofit?: false | { default: 'off' | 'grow' | 'grow+shrink' }`（§3 的最小 kind→host 策略）。
  - `false` = **autofit-unavailable**（不显示 toggle、不挂 probe、忽略 metadata）。
  - `{ default }` = 可用，新块默认该模式。
  - 省略 = 可用、默认 `off`。
- 移除两个 `kind === 'markdown'` 闸门 → toggle 与 probe 对**任意可用 kind** 生效。
- 新块 seeding 读 `kind.autofit.default` 而非硬编码 markdown。

**逐 kind 策略（已定）：**

| kind | `autofit` | 理由 |
|---|---|---|
| markdown / richtext / code | `{ default: 'grow' }` | code 也算文本内容（owner 拍板） |
| image | `false` | autofit-unavailable —— 图块要手控裁切 |
| 省略（未来 plugin） | 可用、默认 `off` | 能力普适，按需 opt-in |

能力普适（host）、默认逐 kind（声明）、作者逐块 toggle（既有，解闸即可）。经 frame-core 组合：MeasureProbe 包*同一个* frame-core，故任意 kind 的测量由构造正确。

## 7. frame-core 的可扩展性（Open/Closed）

三种模式，刻意为之：

- **整体替换 frame-core → 可**（UI-plugin「重写」路径，L1）。全有或全无。能写 frame-core 者即有能力看契约 → **最小约束**，不过多束缚，全权全责。
- **加法扩展 → 可**（「继承」/compose 路径）：插件在稳定 core *周围*加**新**层或 block 级能力（autofit 自身就是这么一个加法能力），不碰 core 的盒逻辑。
- **局部改写 core 内部 → 不可** —— 即 owner 点名的「工程灾难」。永不暴露内部供局部 override。要么 compose，要么整体替换，中间没有。

**即便整体替换也必须守的唯一律**（非过度束缚，而是让 kind/skin/autofit 能组合的那一条契约）：frame-core 必须**让内容可测量、并持有 overflow**。替换者可用任意实现达成（不必用我们的 in-flow div），但不达成则所有 kind/skin/autofit 静默崩。故用**一个共享不变量测试**钉住（就是能抓住 stationery 塌缩的那个）。怎么做自由；可测量盒**能力**是律。

**slice vs 北极星：** 本 slice 只发**一个** frame-core（框架默认）—— 实践上当前是单实现，但**契约干净**，不是「写死」。替换/扩展的*接缝*是延后的 UI-plugin 层（freeze-last）；现在不建 registry/seam，只保证默认 core 的契约是干净、可测的能力，让未来无需返工。

## 8. 迁移、非破坏策略、范围边界

**无数据迁移。** 这是渲染层 + kind 契约的 refactor —— `blocks.autofit` / `minRowSpan`（schema v8）不变，无新 DDL，无 [ADR-0020] forward-migration。发布页下次 publish（或 SPA live）即走新路径。三支 `ui-fork/*` 会偏离但已归档，无 compat 负担。

**stationery-spike-first**（给确定性，不是给承诺）：
1. 建 frame-core + `BlockSkin` 契约 + **不变量测试**（`@skb/block-kinds` + `@skb/theme`）。
2. **只重建 stationery** 到 frame-core + skin；把渲染 DOM/视觉与今天 diff（§5 映射表即清单）。最难的主题先做——它能复现，其余都易；某层复现不了，会在动别处*之前*看到。
3. 迁移其余四个主题（graph-paper/ink 平凡；galley/marginalia 中等）`shells → skins`。
4. 解闸 autofit + 加 kind `autofit` 字段（image `false`，文本 kind `grow`）。
5. 五主题全 skin 化后，删除已死的 `theme.BlockFrame` / `shells` 结构槽。

**范围边界（重要）：** 本 slice **只移 block frame 盒**。`theme.CanvasSurface`（页面底/网格）与 `theme.PageTitle` 也是结构槽，但无可测量 bug、更偏「页面 shell」—— 暂留 theme 槽，随延后的 **UI-plugin pass**（北极星）再移。故 slice 后 theme = tokens + `globalCss` + `CanvasSurface` + `PageTitle` + palettes + papers + **skins**（原 `shells`），减 `BlockFrame`。theme 尚未*完全*「简化」—— 其余结构归位是北极星 UI-plugin 工作。

**测试：**
- **不变量测试** —— 每 skin × 每 kind：内容盒撑高 + 持 overflow（能抓住 stationery 的那个测试）。
- **stationery 保真核对**（spike）—— 渲染输出与 refactor 前一致。
- 把 **e2e `fit-shells`** 泛化到五主题；保留 autofit grow/shrink + publish-clip e2e；加 **autofit-on-all-kinds** e2e（richtext/code grow、image 无 toggle）。
- 已提交的 frame-agnostic 测量修复作 backstop —— 即使某 skin 迁移不完美也不会塌缩测量。

## 9. 北极星 / deferred UI-plugin pass（durably 记录，不随时间消失）

**deferred 清单 —— 逐项列明，各有 durable 归宿：**

| deferred item | 内容 |
|---|---|
| UI-plugin extension type | L1 正式契约：UI plugin 如何注册；可替换/扩展什么 |
| Frame-core replace/extend model | Open/Closed：整体替换（重写）+ 加法扩展；替换者必守的可测量盒能力；共享不变量测试为地板 |
| Theme full simplification | 把 `CanvasSurface` + `PageTitle` 移出 theme → theme = 纯 material |
| Skin unification | `papers` + `palettes` + block `skins` 并入单一 skin 概念；可能独立 skin pack |
| Theme asset pipeline | theme 打包字体/图片*文件*（今天仅 inline/data-URI） |
| Published-asset safety gate | theme/UI 成不受信第三方时，公开页 theme SVG/`url()` 闸门 |
| Additive block capabilities | autofit 之外的新 block 级能力，经 frame-core 扩展槽 |

**「不能消失」保证 —— 三处 durable 归宿，不止一处：**
1. **本设计 spec**（committed 到 `docs/superpowers/specs/`）持有完整北极星 + 上表 —— 详细参照。
2. **PRD Phase-2+ 条目** —— 把上表落进 **plugin-system** 与 **theme-system** PRD。PRD 是 product truth，比任何带日期的文档更长寿、且是人*会去看*的地方。（列为实现计划里一个**显式任务**，不会漏。）
3. **新 ADR** 记录*本*决定并修订旧的 —— 决策链完整。

## 10. ADR 修订

- **[ADR-0025]** §1/§2：block 盒由 theme → host frame-core；theme 供 `BlockSkin`。（其「几何=host」「kind=content」两半保留。）
- **[ADR-0028]**：「markdown autofit」→「block-base autofit 能力 + 逐 kind `autofit` 策略」。
- **新 ADR**（PRD-informed，走 AUDIT 流程注册）：host frame-core + BlockSkin + autofit-for-all-kinds 决定；其「Deferred」节列 §9 表。

## 11. 范围边界小结（slice 现在做什么）

**做（slice）：** frame-core（含盒不变量 + 类型受限 skin.box）；`BlockSkin` 契约（含 image/SVG 视觉子集）；五主题 `shells→skins` 迁移（stationery 先 spike）；autofit 解闸 + kind `autofit` 字段（image `false`、文本 `grow`）；不变量测试 + e2e 泛化；MeasureProbe 改包 frame-core。

**不做（北极星，§9 durable 记录）：** UI-plugin extension type 与 frame-core 替换/扩展*接缝*；CanvasSurface/PageTitle 移出 theme；papers/palettes 并入 skin；theme asset pipeline；published-asset 安全闸门；autofit 外的加法 block 能力。

## 12. 风险

- **R1 skin 装饰 API 表达力不足** → stationery 某层（撕边留白 / scroll-curl 背景）复现失真。缓解：spike-first（最难主题先证），§5 映射表逐层核对，不变量测试 + 视觉保真核对。
- **R2 frame-core 抽取碰发布纯度** → frame-core 必须 `renderToStaticMarkup`-safe（无运行时副作用）。缓解：frame-core 与现 `DefaultBlockFrame` 同住 `@skb/block-kinds`，发布路径已消费它。
- **R3 测量回归** → 改包 frame-core 后 fit 漂移。缓解：保留 AREA/CONTENT 法 + frame-agnostic backstop；e2e fit-shells 泛化五主题。
- **R4 deferred 内容流失** → §9 三处归宿 + PRD 传播列为显式计划任务。

## 13. 后续任务 / follow-ups

- **本 session discussion 补录**：派 agent 把本会话全部 discussion 写成 `docs/engineering/design/discussions/` 文档，参考 mvp1/mvp7/8/9 scope 体例（owner 要求；执行期已启动）。
- **PRD 传播**：§9 表落进 plugin-system + theme-system PRD Phase-2+（实现计划显式任务）。
- **新 ADR 起草 + AUDIT 注册。**
- 实现交给 writing-plans（spike-first 任务序）。
