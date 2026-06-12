# MVP-7 Code Review — Findings Register

五维度并行 review（安全 / 契约漂移 / 错误处理 / 测试盲区 / 依赖构建）。下表 = 汇编 + 我的修复建议分级。owner 裁决"修哪些"。

## 🔴 建议立即修（真洞 / 真崩溃面）

| # | 维度 | 文件 | 问题 | 建议 |
|---|---|---|---|---|
| S1 | 安全 | block-kinds/static.ts:35 + theme/themes.ts applyCustomization | **CSS→HTML 注入**：admin 可覆写的 `fontFamily`/`accent` token 裸插进 `<style>` 块，值含 `</style><script>` 即在所有公开静态页注入脚本。当前信任模型 = admin 即 operator，但 customizableTokens 隐含"只接受 CSS 值"的承诺没兑现 | `sanitizeCustomization` 加 `!v.includes('</')` 一行——封死注入路径且不误伤任何合法 CSS 值。多 admin / 第三方主题时这是必须 |
| E1 | 错误 | server/routes/notepages.ts + tree.ts + settings.ts + export/* （~12 处） | **裸 JSON.parse 崩请求**：published_doc/content/background 等存储列的 parse 全无 try/catch，无 Hono onError，一个坏行 = 500 裸崩。最坏 `/public/notes` 列表与 `rerenderAllPublished` 遍历所有页，一坏行毁整个响应/整次换主题 | 抽 `safeParse` helper；列表路由 per-row catch-and-skip；并加 Hono `app.onError` 兜底返回 `{error}` shape |

## 🟡 建议修（中等，影响真实但非紧急）

| # | 维度 | 问题 | 建议 |
|---|---|---|---|
| H1 | 安全 | import zip 无解压上限（zip bomb / OOM）；Bun.serve 无 maxRequestBodySize | 加 body 上限 + fflate 流式解压带字节计数中止 |
| E2 | 错误 | EditorPage 的 publish/toggleVisibility/pinTheme/changeBackground 全无 try/catch，失败静默（publish 尤其要命——用户以为发布了其实没有） | 各包 try/catch → setStatus 错误态 |
| C-img | 契约 | ImageRenderView 的"图裂→fallback"靠 `onError` 浏览器事件，静态页永不触发——发布页图裂无兜底 | RenderView 加服务端可判的 fallback，或文档明确"裂图兜底仅 SPA" |
| C-code | 契约 | CodeEditView 硬编码 `background:'white'`，暗色主题（blueprint）下编辑器视觉破裂 | 改用 theme.blockBg / surfaceInsetBg |
| M1 | 安全 | background.color 仅校验非空字符串，可注入 `; color:red !important` 级 CSS | color 值 allowlist（拒 `;` `url(` `expression(`） |
| T2 | 测试 | `PUT /settings/theme` + `/theme-customization` 的 requireAdmin 门无测试——中间件被误删全部现有测试仍绿（权限提升盲区） | 加 author 角色 403 断言 |
| T3 | 测试 | GC 对**已发布快照背景** blob 的保活无测试（清工作态背景后快照仍引用）——可能误删活体公开页图 | 加该场景测试 |

## 🟢 低优 / 文档侧（可批量收尾）

| # | 问题 | 处置 |
|---|---|---|
| C-poly | stationery PolaroidFrame 硬编码 `data-kind="image"` 应用 `kind` prop | 改 `data-kind={kind}` |
| C-shells | "实现了没声明不可达"措辞 vs PolaroidFrame 的 kind 分支（默认壳内 kind dispatch，非 author-selectable shell） | 文档澄清：契约保证只覆盖 author 可选壳 |
| C-doc | ADR-0026 单一真理源说"两处"实为三处（settings 读时再 sanitize）；ADR-0023 "registry 空"已 stale（v4）；grid-engine CONTRACT "45/45" vs changelog "44/44" | 文档校正 |
| D1 | apps/server 把 react/react-dom 列 dependencies 但不直接 import（经 block-kinds/static 传递） | 移到 devDeps 或删 |
| T1/T5 | format v4 up-transform 无独立单测（仅集成 round-trip）；无 v1→v4 跨版本链测试 | 加 migrate-format 单测 |
| T4/T7 | useGridInteraction grab-offset 锚点数学 + EditorPage save 闭包捕获 title 全无测试（前端零测试） | 抽 moveAnchor 为纯函数加测；renderHook 测 autosave |
| 杂 | carryover/ 未注明归档意图；drizzle.config 无 dbCredentials；blob orphan GC 仅手动 | 注记/可选 |

## 处置（owner 裁决 2026-06-12：全修；同日完成）

- **S1** ✛修：`isSafeCssValue`（拒 `</`）进 `sanitizeCustomization` **和** `applyCustomization`（渲染侧兜历史脏数据）；回归测试覆盖双闸
- **E1** ✛修：`apps/server/src/json.ts safeParse` + Hono `app.onError` 兜底 `{error}` shape；逐点处置（列表 per-row skip / tree 回退工作标题 / 换主题坏行保旧 HTML / 导出坏行降 null 不毁备份 / GC 坏行零引用）；`corrupt-rows.test.ts` 4 场景
- **H1** ✛修：`Bun.serve maxRequestBodySize 256MiB` + unzip filter 按声明尺寸中止（512MiB）+ 解压后实测复核（防伪造头）→ 413
- **E2** ✛修：`runAction` 包 publish/visibility/pin/background/copyLink → SaveIndicator 错误态；**附带修**：publish 现在在 save 失败时中止（原先会把旧状态推上公开页）
- **M1** ✛修：`isSafeCssColor`（拒 `;{}<>`、`url(`、`expression(`，≤128 字符）进 @skb/theme 单一真理源，background 端点 + importer 两处接入；3 个走私样例测试
- **C-code** ✛修：Code/Markdown 两个 EditView 的 `background:'white'` → `theme.blockBg`
- **C-img** ✛按第二选项：CONTRACT.md 新增"降级行为的运行环境边界"节 + 组件注释（静态页降级 = 原生 alt；可接受前提 = ADR-0023 blob 保活契约）
- **T2** ✛补：author 角色对 5 个门控写入全 403、读面/创作面照常 + admin 对照（helpers 抽 `signIn`）
- **T3** ✛补：快照独占引用的背景 blob GC 保活
- **T1/T5** ✛补：production registry v1→v4 链测（中性填充 / 无损往返 / 全轴显式报损）
- **T4/T7** ✛补：`moveAnchor` 提为纯导出函数 4 测；autosave 抽 `useAutosave` hook，renderHook+fake timers 4 测（首挂不存 / 合并 / **最新闭包生效** / 卸载取消）——前端零测试时代结束
- **C-poly** ✛修：PolaroidFrame `data-kind={kind}` 透传
- **C-shells** ✛修：CONTRACT.md 澄清契约只覆盖 author 可选壳
- **C-doc** ✛修：ADR-0026 "两处"→"三处"；ADR-0023 registry 空注记 stale；grid-engine CONTRACT 45/45 → 44/44 现状
- **D1** ✗不修：block-kinds 把 react 声明为 **peerDependencies**，apps/server 在 dependencies 补位是 peer 履约的标准模式——审计员误报
- **杂项** ✛：carryover/ README 顶部归档注记；drizzle.config 补 dbCredentials；blob orphan GC 手动触发为既定设计（admin 端点），不改

验证：6 包 typecheck 全过；190 测试 0 失败（server 95 / grid-engine 44 / block-kinds 27 / theme 11 / web 8 / ui-kit 5）。

## 整体评价

无 critical。架构防线大体扎实——审计员明确点赞的：PEP 全覆盖、blob 路径用 64-hex 正则防穿越、import 三道门全在写之前、markdown/code 的 XSS 已挡（react-markdown 默认不渲染裸 HTML、hljs 转义）、sanitizeCustomization 单一真理源、导出确定性、成对 transform 显式报损、grid-engine 是测试最好的单元。

两个真问题（S1 注入、E1 裸 parse）是快建七轮的典型欠账——边界校验在 happy path 写够了，但"坏数据从存储回流"和"operator 可控值进 HTML sink"两类没系统性兜。建议这两条本轮修掉，其余按表 owner 勾选。
