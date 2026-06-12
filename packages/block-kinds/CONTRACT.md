# CONTRACT — @skb/block-kinds

| Field | Value |
|---|---|
| Status | living（MVP-4 收紧为正式契约，[ADR-0024]）|
| Consumers | apps/web（编辑器/读页）、apps/server（publish 时静态渲染）、未来 plugin-system |
| 原则 | **In-tree kind 就是恰好住在仓库里的插件**：只许消费本契约面，不许有任何特例分支 |

## BlockKindModule

| Field | 语义 |
|---|---|
| `kind` | 全局唯一字符串 id；进 DB（blocks.kind）与导出格式，**永不改名** |
| `label` / `glyph` | palette 展示 |
| `defaultSize` | 新块初始 `{colSpan, rowSpan}` |
| `createContent()` | 空内容；**content 形状归 kind 所有，平台不解释**（kind-opaque） |
| `EditView` | 只挂在单个 active block 上（性能边界）；props = `{content, onChange}` |
| `RenderView` | 非活动预览 + 公开读 + publish 静态渲染共用；props = `{content}` |
| `extractText(content)` | 搜索/导出用纯文本，从 content 派生（不许读 DOM） |
| `tools?` | 工具面板贡献（MVP-5）：`Array<{id, label, View}>`；View props = `{content, onChange}`（与 EditView 同面） |

## RenderView 纯度要求

- **renderToStaticMarkup-safe**：首帧渲染必须完整（state/effect 允许，但不得依赖 effect 才出内容）
- 不发网络请求、不渲染 author-only 控件
- 主题只经 `useTheme()`（@skb/theme ThemeContext）读取，**不许 import 具体主题**——publishedHtml 纯度依赖于此
- 同一 (content, theme) 必须产出确定性标记（导出确定性的依赖）

## HostServices（插件 host API 雏形）

EditView 触达宿主能力**只许**经 `useHost()`（HostContext）。当前面：

- `uploadBlob(file) → {hash, size, mimeType}`

增长规则：只许增量添加，不许破坏性变更（插件作者将依赖它）。

## Blob 引用契约（[ADR-0023]）

kind 在 content JSON 中引用 blob **必须用小写 hex sha256 原文**。这使 kind-opaque 的引用枚举（export/GC）成立；违反 = blob 可能被 GC 误删。

## BlockFrame 与 RenderView 边界（[ADR-0025]）

- **kind 管内容，theme 管壳**：RenderView 渲染 content 本身，不得假设卡片 chrome 形态（边框/圆角/投影/装饰归主题的 BlockFrame 或缺省 frame）
- 表面细节经表面 token（`surfaceInsetBg`/`hairline`/`quoteColor`），不得硬编码颜色——这是暗色主题成立的前提
- class 钩子 `skb-block`/`skb-canvas`/`data-kind` 是主题 globalCss 的稳定挂点；`skb-anim-*` 类名为未来操作动效预留

## 贡献点与分权规则（MVP-5 M5-D4/D6）

**模块管面板内容，host 管面板位置与布局**（主题轮"几何/视觉分权"在 chrome 上的同构）：

- **Insert palette**：条目 = `(kind, label, glyph)`，host 纯遍历 registry 渲染，零硬编码；模块对条目形态（按钮样式/位置）无发言权
- **Tool panel**：`module.tools` 声明工具；host 决定面板在哪、何时显示（仅 active block）、如何排版。工具 View 用 **@skb/ui-kit 原语**拼装（UiSelect/UiButton/UiTextInput/UiToggle——主题经 token 一次染色所有控件）；触达宿主能力仍只经 `useHost()`
- 工具属于**编辑面**：RenderView 及静态渲染路径不可触达 tools（纯度要求不变）
- host 保留面（模块无贡献点）：侧栏目录、主题/钉选选择、Export/Import、块头部 chrome（host 读模块元数据渲染）

## Registry

`BLOCK_KINDS` / `blockModule(kind)` / `defaultSizeFor(kind)` 是唯一接入点。未知 kind 的行为由消费方按 blocks.md contained-failure 规则降级（内容保留、本地降级、永不炸页）。

## 入口边界

- 包根入口 `@skb/block-kinds`：类型 + registry + PublishedCanvas（web 可用）
- `@skb/block-kinds/static`：renderStaticPage / NOT_FOUND_HTML——**仅 server**（拉 react-dom/server，web bundle 禁止 import）
