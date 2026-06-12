# ADR-0026: 工具面板贡献点 & 主题自定义层

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-12 |
| Authors | W_YI (owner), Claude |
| Supersedes | — |
| Superseded by | — |
| Source | [2026-06-12-mvp5-design.md](../../superpowers/specs/2026-06-12-mvp5-design.md)（owner ratified scope；决策 M5-D1..D7 见 [mvp5-scope-2026-06-12.md](../design/discussions/mvp5-scope-2026-06-12.md)）|

## Context

Owner 判定通用工具面板是 plugin-system 主线前的 chrome 障碍：每个 kind 把工具内嵌进自己的 EditView（code 语言选择、image alt），插件时代会导致各插件自造 UI、主题无法统一染色。同期 owner 提出字体/颜色更改与"更高自定义化主题"（表面材质/主题配对调色板）诉求。三个场景案例（M5-D1 需求探测器）证实了两者的真实负载。

## Decision

### 1. 工具面板贡献点（M5-D4）

`BlockKindModule.tools?: Array<{id, label, View}>`；View props = `{content, onChange}`（与 EditView 同面）。**模块管面板内容，host 管面板位置与布局**——[ADR-0025] 几何/视觉分权在 chrome 上的同构。工具属于编辑面：RenderView 与静态渲染路径不可触达。host 仅对 active block 渲染其模块声明的工具。

### 2. 主题化表单原语 @skb/ui-kit（M5-D5）

工具与自定义 UI 的控件词汇表：UiSelect/UiButton/UiTextInput/UiToggle/UiPaletteSwatches，纯 token 消费（无自有 context——TDZ 结构性免疫），主题经 token 一次染色所有控件。控件圆角随主题语言但 cap 8px。准入标准 = "≥2 个消费者"；Modal/文件选择器/插件设置页明确不做。

### 3. 主题自定义 = 主题授权的数据（M5-D3）

**自由调色 rejected**（破坏主题视觉完整性 + QA 面爆炸）。模型：

- `Theme.palettes?: PaletteVariant[]` —— 主题策展的官方配色变体（科研 colormap 式）；类型级排除几何 token（slot/pad/dotSize/blockRadius 不进变体）
- `Theme.customizableTokens?` —— 直接覆写的 opt-in 白名单（缺省全锁）
- `applyCustomization(base, c)` 纯函数：base → 变体 → 白名单过滤覆写；slots/identity 原样穿过。未知 paletteId / 越权键静默降级（主题升级移除变体时页面照常渲染）
- 存储：settings `themeCustomization` = JSON keyed by themeId（换主题不丢各自选择）；读取时再过滤（单一真理源 `sanitizeCustomization` 同时服务 admin 端点与 importer——手编包无法走私越权覆写）
- **重渲染不变量**：任何被接受的自定义写操作触发全量重渲染（同换主题）；publishedHtml = f(doc, slug, effectiveTheme) 签名与纯度不变，自定义经 effectiveTheme 流入；SPA 读路由与公开 payload 携带 customization 用同一 applyCustomization 合成——三处渲染一致性维持

### 4. 导出格式 v3

manifest.settings 增可选 `themeCustomization`；成对 transform：up(v2→v3) 恒等（缺席即"无"），down(v3→v2) 丢字段且逐主题报损失。exporter 对 themeId 键排序（确定性不变量）。

### 5. 边界与挂账

- **深槽位主题暂不参与变体**：stationery 的槽位组件闭包引用 TOKENS 常量（[ADR-0025] 的 TDZ 规避手法），token 变体只会部分生效（根 bg 变、桌面纹理不变）。挂账：槽位组件改为渲染时读 token（需解决 theme 包内 context 循环）后 stationery 才开放 palettes
- 字体覆写限于已安装字体栈；字体文件 = theme 资产管线 future（[ADR-0025] 同款挂账）
- 面板放权清单（M5-D6）：DRAG TO INSERT registry 纯驱动、工具面板内容放权；侧栏/主题选择/Export-Import/块头部 chrome host 保留

## Consequences

插件 host API 三件套成形：registry（kind 注册）+ HostServices（能力注入）+ tools（chrome 贡献点），加上 ui-kit 控件词汇表与 theme 槽位/token/变体——plugin-system 正轮的 API 面已全部有真实在树消费者。CONTRACT.md "贡献点与分权规则"章为正式契约面。
