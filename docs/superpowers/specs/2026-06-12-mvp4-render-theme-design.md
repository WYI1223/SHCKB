# MVP-4 Design: 插件就绪 — 渲染统一 + 主题层 + 契约收紧

| Field | Value |
|---|---|
| Status | draft (owner review pending) |
| Theme | "in-tree 的 kind 和 theme 都是恰好住在仓库里的插件" — 为 MVP-5 plugin-system 挣出 API |
| Lineage | MVP-1 核心循环 → MVP-2 可部署 → MVP-3 数据自主权 → **MVP-4 插件就绪** → MVP-5 plugin-system |
| Discussion | build log 落 `docs/engineering/design/discussions/mvp4-scope-2026-06-12.md` |

## 0. 战略定位（为什么是这个，不是直接建 plugin-system）

插件 API 必须从具体实例提炼，不能先验设计（两个同质 kind 不足以归纳总则；API 一旦发布即契约）。MVP-4 的全部工作 = 让 in-tree 实现先变成"恰好住在仓库里的插件"，使 MVP-5 缩小为"registry 静态变动态 + 加载/分发/沙箱"。同时还掉 SSR/SPA 双渲染器 drift 债（其死线本就是 plugin-system）。

## 1. 渲染器统一（还 drift 债）

- RenderView + theme tokens 从 `apps/web` 提升到共享包（`packages/block-kinds`：BlockKindModule 类型 + registry + markdown/image/code 实现；tokens 随包或独立 `packages/theme`，plan 阶段定）
- Server publish 时用 `react-dom/server` 的 `renderToStaticMarkup` 渲染**同一批组件**；`publish-html.ts` 退化为文档外壳（head/CSS 注入/404 页），不再有任何 per-kind 渲染分支
- **运行时性质不变**：HTML 仍是 publish 时渲染一次存库；react-dom 是 publish 时依赖，不是 per-request
- 不变量（theme-system "跨 mode 一致" 的机制化）：编辑器读态、`/read/:slug`、`/notes/:slug` 三处视觉同源——同组件 + 同 token，drift 在机制上不可能

## 2. Theme seam（实例级 + 逐页钉选）

- **Theme = 可替换 token 集**（id/name/tokens，可选组件级覆盖留 seam 不实装）。当前外观固化为第一个主题 `graph-paper`；再做一个**最小第二主题**证明切换真实可用（占位审美即可，正经方案等 §5 风格轮）
- **实例级设置**：新建 `settings` 表（key-value，第一个实例级设置出现的正确容器；migration）。Admin 选实例主题
- **逐页钉选**：`notepages.theme_id` 可空列；空 = 跟随实例。有效主题 = `page.themeId ?? instance.theme`
  - ⚠️ 此处是对 owner "多选跳过重渲染" 提议的**形态替换**（owner 待确认）：跳过重渲染会留下不可再现的旧 HTML（下次 re-publish 仍会变新主题）；钉选达成同样意图（页面保持特定外观）且永远可精确复现
- **换主题 = 全量重渲染所有已发布页**（各按有效主题）。不变量：`publishedHtml` 永远是 `(publishedDoc, slug, 有效主题)` 的纯函数；公开站不存在"碰巧是旧主题"的页面
- 多选管理 UI：页面钉选入口（编辑器 page 设置处）+ admin 主题面板列出钉选页清单
- **不做**：L0-L3 全级联、per-user 切换、运行时 CSS 主题热切——theme-system 完整盘子留给插件机制之后

## 3. 第三个 block kind：code（压测契约的异质样本）

- content = `{ language, source }`；EditView = 语言选择 + 等宽编辑；RenderView = 语法高亮静态渲染
- 选 code 的理由：逼出三个新 API 面——per-block 设置项（language）、重渲染依赖（高亮器）、publish 时与运行时渲染一致性。这些正是未来插件 API 必答题
- **不含执行**：可运行 code + 远程 runner 仍是 future（owner 既定方向）；content shape 不预留 runner 字段（YAGNI，格式迁移管线就是为将来加字段准备的）
- drawing kind **不进这轮**（canvas 状态 + 自定义编辑交互，体量是独立 MVP 级）

## 4. BlockKindModule 收紧为正式契约

- `packages/block-kinds/CONTRACT.md`（per doc convention）：模块表面（kind/label/glyph/defaultSize/createContent/EditView/RenderView/extractText + 本轮新增面）、blob 引用契约（[ADR-0023] 小写 hex sha256 原文）、渲染纯函数要求
- 三个 in-tree kind 全部只经 registry 接入，无任何特例分支（grep 可验证）
- 新 ADR（编号顺延）：渲染统一 + theme seam + 契约收紧的决策记录

## 5. 导出格式 v2（迁移纪律第一次实战）

实例主题（settings）+ 逐页 theme_id 都是数据 → 导出物必须携带 → **格式 v1→v2**：

- v2 变更：manifest 增 settings 节；page.json 增 themeId 字段
- 按 [ADR-0023] 纪律提交**第一对真实 up/down transform**：up = 补默认值；down = 丢弃主题字段，losses 逐项报告（"page X: themeId dropped"）
- `?format=1` 导出端降级随之**真实可用**（v1 实例可吃 v2 实例的降级导出）
- Round-trip 测试矩阵扩展：v2 round-trip 字节级一致 + v2→v1 降级导出可被 MVP-3 版本 import（容器实测旧镜像）

## 6. 验证

- 渲染同源性：同一 publishedDoc，`renderToStaticMarkup` 输出与 SPA RenderView 渲染树文本/结构一致（机制同源后这只是冒烟级断言，无需金丝雀对比管线）
- 主题：换实例主题 → 全部非钉选页 HTML 重渲染且含新 token；钉选页保持钉选主题；新 publish 用有效主题
- code kind：三处渲染（编辑预览/read/静态页）高亮一致
- 格式 v2：round-trip + 降级 + 旧版本 import 兼容（见 §5）
- 全量回归：MVP-3 的 export/import/GC 测试在 v2 下全绿

## 7. 风格化轮（MVP-4 验收后的独立环节，owner 确认 §1-§4 结果后启动）

- 派 **3 个并行 subagent**，各发**不同设计简报**（方向 owner 圈定，候选：graph-paper 正统进化 / 极简编辑部 / 高对比深色等），保证差异度
- 每个 agent 交付：完整 token 集实现（可直接落库的 theme）+ 同一组真实页面的截图对比
- Owner 评审后，入选者成为正式 reference theme（替换/并列 §2 的占位第二主题）；carryover prototype 的 3 套主题变体可作素材参考

## 8. 不进这轮（记录在案）

plugin 运行时加载/分发/沙箱（MVP-5）、L0-L3 级联与 per-user 主题、drawing kind、code 执行/runner、编辑体验杂项（侧栏拖拽排序、markdown 打磨、gravity 重开塌陷 UX——继续挂账，可作 MVP-4 间隙的小件顺手做）
