# MVP-4 风格化轮 — 三向主题候选（owner ratified briefs）

| Field | Value |
|---|---|
| Status | in progress |
| Spec 源 | [2026-06-12-mvp4-render-theme-design.md](../../../docs/superpowers/specs/2026-06-12-mvp4-render-theme-design.md) §7 |
| 基线 | main @ tag `mvp-4`（theme seam 已就绪）|
| 流程 | 3 个并行 subagent 各按一份简报产出 Theme 候选 → 统一渲染样页截图 → owner 评审定夺 |

## 共享硬约束

- 只动 Theme token 面（不碰组件/chrome）；填满 `packages/theme/src/themes.ts` 的全部 Theme 字段 + markdown/image/code 三个 kindHues + codeCss
- oklch 色彩空间；正文对比度 ≥ WCAG AA
- 同一 (doc, theme) 在编辑器 / /read / 静态页三处视觉一致（由共享渲染保证，候选只需对 token 负责）
- 评审材料：同一组样页（markdown 重文 / 图文混排 / code）按主题渲染的静态页截图对比

## 简报 A —「工作台 Workbench」（日常常见）

Notion/Linear 系中性专业风。成功标准 = 没人评论它：近白中性画布、极淡网点或细十字、柔和阴影系卡片、大圆角、低饱和功能色 kindHues、克制标准蓝 accent、GitHub-light 系 codeCss。长文阅读 30 分钟不累。

## 简报 B —「手帐 Stationery」（温馨日记）

Hobonichi/Midori 纸质手帐的数字转译。暖奶油/牛皮纸画布（oklch 暖相 80-100）、网点 = 纸印格、米白纸片卡片 + 铅笔细线/虚线边框 + 圆角、和纸胶带色系 kindHues（低饱和粉/鼠尾草/雾蓝/赭黄）、墨棕文字、暖调低饱和 codeCss。成功标准 = 截图让人想写日记。

## 简报 C —「蓝图 Blueprint」（差异化艺术）

工程制图蓝图 = 产品 DNA 的艺术化表达（constrained canvas / 12 列网格 / AABB 块 → 思想的工程图纸）。深普鲁士蓝画布（oklch 25-30% 蓝）、亮青细线网格、半透明深蓝面板 + 青色描边 + 零圆角、制图笔色 kindHues（青/白/琥珀/品红）、青白文字、磷光系暗色 codeCss。成功标准 = 第一眼"哇"，且只有这个产品撑得住。

## Build log

（按时间追加）
1. 三 agent 并行交付（各自 worktree，互不冲突）：workbench（冷灰 hue 260 单色系 + 伪阴影白卡）/ stationery（奶油纸 + 牛皮虚线裁片 + 和纸胶带 kindHues）/ blueprint（普鲁士蓝图纸 + 60% alpha 青网点 + 半透明面板 + 磷光代码）。全部 oklch + AA 对比 + token 完整性测试过。
2. 整合于 feat/style-round：5 主题注册全绿（server 75 / theme 4 / block-kinds 12）；样页渲染脚本 packages/theme/scripts/render-samples.ts；截图 .playwright-mcp/style-round/shot-*.png。
3. **Blueprint 打出 token 面缺口（差异化方向的预期收益）**：MarkdownRenderView scoped CSS 硬编码浅色——行内 code 在暗色主题真坏（近白底近白字，截图可见）、表格边框/引用色浅色调参；ImageRenderView 缺资产框边框同。Theme-system 需要 surfaceInsetBg / hairline / quoteColor 级表面 token。结论：暗色主题正式上线前必须补 token 面（独立小 pass）。
4. 坑：长寿 vite 进程在 workspace 包结构变化后不会自动跟上（Windows 跨 symlink 监听不可靠，模块图停在 mvp-4 时点，下拉只见两主题）——`bun run dev --force` 重启后五主题全显。规则：新增/重组 packages/* 后必须重启 vite；server 的 bun --watch 不受此影响。
5. **Theme 引擎 v2 落地**（owner 裁定 token-only 风格化不足 → spec theme-engine-v2，ADR-0025）：表面 token 三件（蓝图行内 code 真伤修复，回归断言钉死）；渲染槽位 BlockFrame/CanvasSurface/PageTitle/globalCss（缺省即现状，三候选零迁移）；几何/视觉分权（编辑 active 光环改几何盒环，任意壳形状成立）。
6. **手帐深度样板**：±1.2° 确定性微倾（block.id djb2 哈希，导出字节一致有测试）、和纸胶带替代色条、deckle 撕纸底缘、纸纹理、纸片投影 + hover 浮起、落桌入场动效（prefers-reduced-motion 守卫）。owner 愿景（撕掉卷起/打印拼装离场动效）= skb-anim-* 钩子预留 + 延迟卸载基建挂账。
7. **Owner 反馈轮（手帐步入正轨后的三项打磨）**：(a) 双滚轮根因 = 编辑器内层与主题壳两层 overflow:auto——滚动权改归主题壳单独所有；手帐隐藏滚动条 + 滚动感知卷边阴影（background-attachment local/scroll 分层，上方可滚顶部现卷边、下方可滚底部现卷边，无 JS 静态页同效）。(b) 倾角随宽度衰减：BlockFrameProps 增 colSpan/rowSpan 几何提示（契约扩展），maxTilt = 1.2°×min(1, 4/colSpan)，12 列宽块 0.4°。(c) Chrome 主题化：撤销 M4-D6 边界（owner 裁定），侧栏/顶栏/登录页消费实例主题 token（Shell 级 Provider），编辑器顶栏跟随页面有效主题；web 端 tokens.ts shim 删除。
