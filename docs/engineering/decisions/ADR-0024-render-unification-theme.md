# ADR-0024: Render unification & theme seam

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-12 |
| Authors | W_YI (owner), Claude |
| Supersedes | — |
| Superseded by | — |
| Source | [mvp4-scope-2026-06-12.md](../design/discussions/mvp4-scope-2026-06-12.md) + spec [2026-06-12-mvp4-render-theme-design.md](../../superpowers/specs/2026-06-12-mvp4-render-theme-design.md)（owner ratified；PRD-informed：theme-system "跨 mode 一致" invariant + plugin-system 前置） |

## Context

MVP-2 的静态发布留下双渲染器 drift 债：SPA RenderView 与 server 手写 HTML 渲染器平行实现"已发布页长什么样"，靠手抄对齐。其死线是 plugin-system——插件作者只交一个 RenderView，server 不可能为第三方 kind 手写镜像分支。同时 owner 决定主题化（风格化）进入产品（实例级 + 逐页），而主题恰好需要渲染统一提供的同一块基建（token 共享包）。

## Decision

### 1. 渲染统一：同一批组件渲染所有表面

- RenderView/EditView/registry 提升到 `packages/block-kinds`，theme tokens 提升到 `packages/theme`
- Publish 时 server 用 `react-dom/server` 的 `renderToStaticMarkup` 渲染共享的 `PublishedCanvas`（与 SPA `/read` 同一组件）——**drift 在机制上不可能**
- 运行时性质不变：HTML 仍 publish 时渲染一次存库；react-dom 是 publish 时依赖，非 per-request SSR
- 不变量：**`publishedHtml = renderStaticPage(publishedDoc, slug, 有效主题)` 纯函数**

### 2. Theme = 可替换 token 集（数据，非代码）

- `Theme` 类型 + `THEMES` registry；graph-paper（现外观固化）+ ink（最小第二主题，证明切换；正式候选来自风格化轮）
- **实例级设置**：`settings` 表（key-value，第一个实例级设置）；admin 切换
- **逐页钉选**：`notepages.theme_id` 可空 = 跟随实例。有效主题 = 钉选 ?? 实例 ?? 默认；未知 id 渲染时降级（数据保留）
- **换主题 = 全量重渲染所有已发布页**（各按有效主题）。Owner 原提议"多选跳过重渲染"被形态替换为钉选（owner ratified）：跳过产生不可再现状态（下次 re-publish 仍变新主题），钉选达成同样意图且永远可复现
- 边界（M4-D6）：theme 管**内容面**（编辑画布/读页/静态页）；app chrome 留默认 token——L0-L3 级联与 per-user 切换是 theme-system 完整盘子，插件机制之后

### 3. 契约收紧（plugin-system 前置）

- `packages/block-kinds/CONTRACT.md` 正式化模块面；**HostServices context**（uploadBlob）= 插件 host API 雏形，EditView 触达宿主只许经它
- 第三 kind = code（language 设置项 / highlight.js 重渲染依赖 / 三表面一致）——异质样本压测契约；不含执行（runner 是 future family）
- In-tree kind 全部仅经 registry 接入，无特例分支

### 4. 导出格式 v2（[ADR-0023] 纪律第一次实战）

实例主题 + 逐页钉选是数据 → 进导出物 → FORMAT_VERSION 2：

- manifest 增 `settings: {theme}`；page.json 增 `themeId`
- **第一对真实 up/down transform**：up 补默认值（无损）；down 丢弃主题字段并逐项报告损失
- `?format=1` 导出端降级实际可用（v1 实例可吃降级导出）；`&dryRun=1` 先看损失清单

## Consequences

- mvp2 双渲染器 drift 债**还清**（AUDIT 同步标记）
- server 依赖 react/react-dom（publish 时执行路径）；web bundle 通过入口分离（`/static` 子入口）隔离 react-dom/server
- 大实例换主题 = 全量重渲染的可见停顿（操作者可接受；记录）
- 风格化轮（spec §7）现在有了干净的目标面：一套 Theme token 集 = 一个候选方案

## Alternatives considered

1. **请求时 SSR** —— 拒绝：公开读路径失去"零会话查询 + 静态直出"性质，引入运行时 React 服务负担。
2. **CSS 变量运行时换肤（发布页）** —— 拒绝：publishedHtml 不再是纯函数（外观依赖运行时注入），破坏导出确定性与缓存语义。
3. **保留手写渲染器 + 金丝雀对比测试** —— 拒绝：测试只能抓内容级 drift，抓不住视觉级；且对插件 kind 完全不可行。
4. **跳过式重渲染豁免（owner 原提议）** —— 形态替换为逐页钉选（见 Decision 2，owner ratified）。

## References

- Spec: [2026-06-12-mvp4-render-theme-design.md](../../superpowers/specs/2026-06-12-mvp4-render-theme-design.md)
- Contract: [packages/block-kinds/CONTRACT.md](../../../packages/block-kinds/CONTRACT.md)
- 相关 ADR: [ADR-0023](./ADR-0023-export-import-format.md)（格式迁移纪律 + blob 引用契约）/ [ADR-0022](./ADR-0022-blob-storage.md)
