# Theme Engine v2 Design: 组件槽位 + 深度风格化（手帐样板）

| Field | Value |
|---|---|
| Status | approved (owner ratified 2026-06-12；离场动效确认为方向标不是本轮验收项) |
| 动机 | Owner 裁定：token-only 主题"风格化程度太低，只有配色变化"；theme-system PRD 本就定位 theme = plugin type，应能改结构（方块样子）乃至动效（撕纸/打印）|
| Lineage | MVP-4 theme seam（token 集）→ **v2 = token + 渲染槽位 + 动效缝** → theme-system 完整盘子（L0-L3 级联、theme 即插件）|
| 样板 | 手帐 Stationery 深度版（owner 拍板）；蓝图深度版为后续候选 |

## 0. 三条不动的锁

1. **编辑交互层共享**：拖拽/缩放/网格 state machine 不归主题管（prototype 验证的"同 state 穿多套主题"原则）。主题管表现，不管行为。
2. **`publishedHtml = f(publishedDoc, slug, theme)` 纯函数不变**：槽位组件必须确定性（同输入同输出）；随机性必须从确定性来源派生（如 block.id 哈希 → 旋转角度）。
3. **静态渲染兼容**：所有槽位输出必须 renderToStaticMarkup 可渲染、公开页无 JS 可看（动效退化为 CSS-only）。

## 1. Token 面补全（顺手修 blueprint 的真伤）

Theme tokens 新增三个表面 token，组件中现存的硬编码浅色值全部改为消费它们：

| 新 token | 替换的硬编码 |
|---|---|
| `surfaceInsetBg` | MarkdownRenderView 的 pre/inline-code 底色 `oklch(95% 0.01 80)` |
| `hairline` | markdown 表格边框 / 图片缺资产虚线框 `oklch(85% 0.01 80)` |
| `quoteColor` | blockquote 文字 `oklch(50% 0.02 80)` |

五个现有主题各补三值（蓝图行内 code 白底白字 bug 由此修复）。

## 2. 渲染槽位（结构自由的载体）

```ts
type ThemeSlots = {
  /** 块的"壳"：形状/边缘/装饰（胶带、撕边、角标）。
   *  props: { kind, blockId, children }；缺省 = 现行 blockCardStyle 卡片 */
  BlockFrame?: ComponentType<{ kind: string; blockId: string; children: ReactNode }>;
  /** 底板：不限于网点（横线/方格/图框）。缺省 = canvasBaseplateStyle */
  CanvasSurface?: ComponentType<{ widthPx: number; heightPx: number; children: ReactNode }>;
  /** 页头处理。缺省 = 现行 h1 */
  PageTitle?: ComponentType<{ title: string }>;
  /** 文档级 CSS：伪元素装饰、@keyframes 动效、纹理。
   *  注入静态页 <style> 与 SPA（编辑器/读页）。 */
  globalCss?: string;
};
type Theme = { /* 现有 tokens + §1 三新增 */ } & ThemeSlots;
```

- **缺省即现状**：不提供槽位的主题走现行渲染——风格轮三候选自动保持合法（纯 token 主题），零迁移
- **class 钩子**：缺省渲染与槽位容器输出稳定 class（`skb-block` / `skb-canvas` / `data-kind`），globalCss 可挂伪元素与动画
- 消费方：PublishedCanvas 与编辑器 GridCanvas 的块壳渲染统一改走 `theme.BlockFrame ?? DefaultBlockFrame`（编辑态 overlay/手柄仍叠加在壳外，交互不进主题）

## 3. 动效缝（owner 愿景的分层承接）

- **本轮实装**：入场 + 悬停动效。块挂载即播 CSS animation（无需任何基建）；globalCss 携带 @keyframes。手帐 = 纸片飘落微摆；编辑器与读页同享，静态页 CSS-only 同效
- **挂账（theme-system future）**：离场/操作动效（删除撕掉卷起、移动揭起贴下、蓝图打印/拼装入场序列）需要编辑器**延迟卸载**基建（动画播完才移除 DOM）。BlockFrame 的 class 钩子本轮就按此设计（动效类名约定 `skb-anim-*`），基建到位时主题侧零改动
- 动效必须尊重 `prefers-reduced-motion`（globalCss 模板给出标准写法）

## 4. 手帐深度样板（证明"主题能改方块样子"）

在 v2 引擎上重做 Stationery：

1. **纸片旋转**：每块 ±1.2° 内微旋，角度 = block.id 哈希派生（确定性，锁 2 安全）
2. **和纸胶带**：BlockFrame 顶缘横跨一段半透明"胶带"伪元素（kind 色 → 胶带色），替代现在的 2px 色条
3. **撕纸边缘**：底缘 deckle 效果（clip-path 锯齿或多重 box-shadow，纯 CSS 无外部资产）
4. **纸纹理**：canvas 与纸片的轻微纤维纹理（CSS gradient 噪声，无图片）
5. **入场动效**：纸片落桌（translateY + 微旋安定），hover 轻微浮起
6. **纸片投影**（owner 补充：阴影属风格化武器库）：柔和 drop shadow 让纸片离开桌面；hover 浮起时投影加深拉远
7. token 部分沿用风格轮交付的配色（那轮工作不浪费）

## 5. 文档与决策

- **ADR-0025**：theme = 数据 + 表现槽位（修订 ADR-0024 的"纯数据"表述；纯度论证：组件确定性 ⇒ publishedHtml 纯度无损）；动效分层（入场免费/离场要基建）；缺省即现状的兼容策略
- CONTRACT.md（block-kinds）补：RenderView 与 BlockFrame 的边界（kind 管内容，theme 管壳）
- 风格轮 discussion 文档续写 build log

## 6. 验证

- 确定性：同 (doc, theme) 静态渲染字节一致（含旋转角度——id 哈希）；export round-trip 回归全绿
- 兼容：5 个纯 token 主题经缺省槽位渲染，与 v2 前像素级等价（截图比对级）
- 表面 token：蓝图行内 code 修复断言（暗色主题下 inset 底色生效）
- 三表面一致：手帐深度版在编辑器/读页/静态页同观感；`prefers-reduced-motion` 下动效关闭
- AA 对比在纹理/胶带装饰下不回退

## 7. 不进这轮

离场/操作动效基建（撕掉卷起、打印拼装——钩子就位，基建挂账）、蓝图深度版（表面 token 修复后即可启动，作下一个样板）、theme 运行时加载（plugin-system）、L0-L3 级联。
