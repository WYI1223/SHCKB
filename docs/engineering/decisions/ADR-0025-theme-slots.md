# ADR-0025: Theme render slots & surface tokens

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-12 |
| Authors | W_YI (owner), Claude |
| Supersedes | —（修订 [ADR-0024] 的 "theme = 纯数据" 表述）|
| Superseded by | — |
| Source | [2026-06-12-theme-engine-v2-design.md](../../superpowers/specs/2026-06-12-theme-engine-v2-design.md)（owner ratified；动机 = owner 裁定 token-only "风格化程度太低"，theme-system PRD 本就定位 theme 可改结构）|

## Context

MVP-4 的 theme = 纯 token 集，只能表达配色——风格轮三候选证实了这个天花板（owner："只有配色变化"）。同时蓝图候选打出 token 面缺口：MarkdownRenderView 等组件硬编码浅色值，暗色主题行内 code 真坏。theme-system PRD 对 theme 的定位是 plugin type（fork/从零写），应能改方块样子乃至动效（owner 愿景：手帐撕纸、蓝图打印拼装）。

## Decision

### 1. Theme = tokens + 可选渲染槽位

`Theme = ThemeTokens & ThemeSlots`；槽位 `BlockFrame`（块的视觉壳：形状/边缘/装饰）、`CanvasSurface`（底板）、`PageTitle`、`globalCss`（文档级 CSS：伪元素/纹理/@keyframes）。**缺省即现状**：缺省实现（`packages/block-kinds/src/frames.tsx`）就是槽位化之前的渲染，token-only 主题零迁移保持合法。

**纯度论证**（修订 [ADR-0024] 而非推翻）：publishedHtml 纯度从不依赖 "theme 是数据"，依赖的是**渲染确定性**。槽位组件必须确定性、renderToStaticMarkup-safe；随机感从确定性来源派生（手帐倾角 = block.id djb2 哈希）。`同 (doc, slug, theme) → 同字节` 不变量有测试钉死。

### 1b. 增补（owner 反馈轮，2026-06-12）

- **BlockFrame 几何提示**：props 增 `colSpan/rowSpan`（grid 单位）——主题可按尺寸缩放效果（宽块倾角衰减），永不用于布局（几何归 canvas）
- **滚动权归主题壳单独所有**：编辑器内层不再开第二个滚动容器（双滚轮根因）；主题可隐藏滚动条并以视觉提示替代（手帐 = background-attachment local/scroll 分层的滚动感知卷边阴影，无 JS、静态页同效）
- **Chrome 跟随实例主题 token**（撤销 M4-D6 "chrome 留默认" 边界，owner 裁定）：侧栏/编辑器顶栏/登录页消费 token 级主题（Shell 级 ThemeProvider）；chrome 的结构槽位仍是 theme-system future

### 2. 几何/视觉分权

Canvas（PublishedCanvas / GridCanvas）持有几何：定位外层 div（left/top/width/height）+ 编辑交互（拖拽 props、active 光环、删除/缩放手柄）。主题的 BlockFrame 只持有视觉壳。编辑 chrome 落在未旋转的几何盒上——任何主题画什么形状，交互都不受影响（prototype "同 state machine 穿多套主题" 原则的槽位化表达）。

### 3. 表面 token（修蓝图真伤）

`surfaceInsetBg` / `hairline` / `quoteColor` 三 token 取代组件内全部硬编码浅色值（markdown pre/行内 code 底、表格边框、引用色、缺资产虚线框）。暗色主题自此可用。

### 4. 动效分层（owner 愿景的承接计划）

- **现在**：入场/悬停动效经 globalCss（@keyframes + transition），块挂载即播，零基建；静态页 CSS-only 同效；必须带 `prefers-reduced-motion: reduce` 守卫
- **future（theme-system）**：离场/操作动效（手帐撕掉卷起、蓝图打印/拼装序列）需要编辑器**延迟卸载**基建；`skb-anim-*` 类名约定预留，基建落地时主题侧零改动
- class 钩子（`skb-block` / `skb-canvas` / `data-kind`）是 globalCss 的稳定挂点，进入契约

### 5. 样板：手帐深度版

第一个用满槽位的主题：±1.2° 确定性微倾、和纸胶带（kind 色）替代色条、deckle 撕纸底缘（渐变锯齿伪元素）、纸纤维纹理（repeating-gradient）、纸片投影 + hover 浮起、落桌入场动效。证明"主题能改方块样子"。

## Consequences

- 风格轮三候选保持合法（token-only）；蓝图深度版解锁（表面 token 已修暗色路线）
- BlockFrame 与 RenderView 边界进 CONTRACT.md：kind 管内容渲染，theme 管壳；RenderView 不得假设卡片 chrome 形态
- 主题作者获得三级火力：改 token（配色）→ 加 globalCss（装饰/动效）→ 换槽位（结构）——正是 theme-system "fork/compose/from-scratch" 路径的引擎级对应
- 编辑器 active 光环从描边改为几何盒 boxShadow 环（对任意壳形状成立）

## Alternatives considered

1. **theme = 完整组件树（无 token 层）** —— 拒绝：每个主题重新实现一切，fork 成本失控；token 层是 90% 主题的全部所需。
2. **CSS 变量运行时换肤** —— 拒绝：只能换值不能换结构，正是 owner 否决的天花板；且破坏 publishedHtml 烤入语义。
3. **每 kind 自带主题变体**（kind 感知主题）—— 拒绝：M×N 爆炸；壳归 theme、内容归 kind 的分权让两者独立演化。

## References

- Spec: [2026-06-12-theme-engine-v2-design.md](../../superpowers/specs/2026-06-12-theme-engine-v2-design.md)
- 风格轮记录: [mvp4-style-round-2026-06-12.md](../design/discussions/mvp4-style-round-2026-06-12.md)
- 相关 ADR: [ADR-0024](./ADR-0024-render-unification-theme.md)（渲染统一基底，本 ADR 修订其 "纯数据" 表述）
