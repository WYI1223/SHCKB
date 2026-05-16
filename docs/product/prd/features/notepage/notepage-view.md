# Feature PRD: Notepage viewing

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-16 |
| Owner | W_YI |
| Parent | [notepage.md] |

## Overview

Reader 在 notepage 上的**阅读体验** —— 看到 author 编辑好的内容，无编辑控件干扰，跨 desktop / mobile 都清晰可读。**Author 自己进入预览模式**也走同一 view path。

本 PRD 锁的是 **view mode 下的 user-observable 行为**：block 渲染、SSR、anonymous access、private note 鉴权、阅读 keyboard navigation、reader-specific edge cases。

不锁：edit affordance（→ [notepage-editing.md]）、theme system / cascade（→ [theme-system.md] / [theme-system-user-view.md]）、responsive 投影（→ [notepage-responsive.md]）。

## User stories（reader-focused）

- As a **reader**, I want to **打开 author 公开的 URL → 立刻看到内容布局**，so that **不被加载 / 编辑控件干扰**
- As a **reader**, I want to **滚动浏览长 notepage**，so that **看完整内容不费力**
- As a **reader using screen reader**, I want to **block 内容按 reading order 朗读**，so that **结构化阅读**
- As a **reader on mobile**, I want to **canvas 1-column 流式呈现**，so that **手机屏幕能看清内容**（详 [notepage-responsive.md]）
- As a **reader browsing similar topics**, I want to **看到 author 的标题 / 元数据**，so that **快速判断 notepage 内容**
- As an **author previewing**, I want to **从 edit 切到 view 即时预览**，so that **不需 save / publish 就能验证 reader 视角**

## Functional requirements

### Must (Day-1, M2)

- **View mode rendering**:
  - 每个 block 调 plugin 的 `RenderView`（不是 `EditView`）渲染（per [ADR-0014]）
  - 无 drag handles / resize handles / palette / selection 控件
  - Block 位置由 GridState 决定（per [ADR-0003] induction 6）
- **URL routing**:
  - 公开 notepage: `/notes/:slug` 直接访问
  - 私有 notepage: `/notes/:slug` 触发登录；登录后看；未授权 user 403
  - Author 预览：同 URL `/notes/:slug` 加 query `?preview=1` 或 mode toggle；同一 GridState
- **SSR for SEO**:
  - 公开 notepage server-side render；HTML 包含完整内容 + meta tags（title / description / og:image）
  - 首屏内容在 first server response 内
- **Anonymous access for public**:
  - 公开 notepage 无需 cookie / session
  - 私有 notepage 需 session cookie
- **Author preview mode**:
  - 同一 GridState；切换 edit ↔ view 不动 data（per [notepage.md] cross-cutting invariant）
  - 切换 UI 位置：toolbar toggle / keyboard shortcut（TBD：Open question）
- **Reader keyboard navigation**:
  - Tab / Shift+Tab 在 block 间移焦点（accessibility）
  - 方向键在邻居 block 间移焦点（geometric）
  - Enter / Space 在 focused block 上触发 plugin RenderView 的 click action（如有；如 link / button）
  - `/` 触发浏览器内 find-in-page（不接管）
- **Reading state preservation**:
  - 滚动位置在 URL fragment / sessionStorage 保留；refresh 不丢
  - Author 切 edit→view 时滚动位置保留

### Should (Day-1 if scope allows)

- **Reader focus mode**: hide 其他 UI（toolbar / sidebar）专注阅读
- **Print-friendly CSS**: ctrl+P 输出干净布局
- **Copy block content**: select text in block + copy；保留 markdown 源（如 plugin 支持）

### Nice-to-have (Phase 2+)

- **Reader annotation / highlight**: 私有标注（不修改 author 原 notepage）
- **Reading time estimation**: top 显示 "5 min read"
- **Outline / TOC**: 长 notepage 显示侧栏 outline
- **Dark mode reader pref**（独立于 author theme）

## Non-functional requirements

- **Performance**:
  - Lighthouse mobile score ≥ 90 on public view（CI gate；per [ADR-0010]）
  - First Contentful Paint (FCP) < 1.5s on 3G
  - Largest Contentful Paint (LCP) < 2.5s on 3G
  - SSR HTML 大小 ≤ 200KB initial
- **SEO**:
  - 标题 / description / og:image meta 正确
  - Public notepage canonical URL；sitemap.xml 列入
- **Accessibility**:
  - WCAG AA 颜色对比度
  - Block 内 RenderView 输出符合 a11y（plugin 责任，notepage 不重定义）
- **Privacy**:
  - 私有 notepage 不被 search engine 索引（`noindex` meta）
  - Anonymous reader 不留 session

## Non-goals

- ❌ **Edit affordance** —— 归 [notepage-editing.md]
- ❌ **Theme system / SSR theme CSS bundling** —— 归 [theme-system.md] / [theme-system-user-view.md]
- ❌ **Responsive projection 细节** —— 归 [notepage-responsive.md]
- ❌ **Reader 修改 author 原内容** —— Day-1 不做；annotation Phase 2+
- ❌ **Reader 评论 / discussion** —— 归 [discussion.md]（Phase 2+）

## Acceptance criteria

### M2 acceptance

- 公开 notepage 通过 URL 访问，SSR HTML 包含完整内容
- Lighthouse mobile 90+ on view
- 私有 notepage 触发登录；未授权 user 403
- Author edit ↔ view toggle work；不丢 GridState 不丢滚动

### M3 acceptance

- 9 个 block kind 的 RenderView 全 work
- 全键盘 a11y baseline
- Print CSS shipped

### M4 acceptance

- Reader focus mode shipped
- Outline / TOC（如 Should 落地）shipped

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Notepage slug 不存在 | 404 page + "搜相关 notepage" CTA |
| Private notepage anonymous 访问 | 302 redirect to login（保留 return URL） |
| Author 删除自己已发布 notepage | 旧 URL → 410 Gone（不是 404；告诉 reader 资源曾在） |
| Notepage 渲染超大（>1000 block） | Lazy render + virtualization（Phase 2+；M2 可能直接报"too large to render"）|
| Reader 浏览器禁用 JS | SSR HTML 仍可读；交互降级（无 mode toggle / 无 plugin 交互） |
| Reader 网络断 | SSR cache + service worker 维持已访问 notepage 离线可读（Phase 2+；M2 不要求）|
| Author 在 view 中点 block 想编辑 | 切回 edit mode 自动选中该 block（如 author own this notepage） |
| Mobile reader pinch zoom | 不阻；浏览器原生处理（不接管） |

## Dependencies

PRD 层 upstream 依赖（ADR 是 downstream，归 References 段）：

- **Parent PRD**: [notepage.md](./notepage.md)
- **Sibling PRDs**: [notepage-editing.md](./notepage-editing.md) / [notepage-responsive.md](./notepage-responsive.md)
- **Other feature PRDs**: [theme-system.md](../theme-system/theme-system.md)（presentation layer + SSR theme bundling）/ [authentication.md](../authentication/authentication.md)（private notepage session 验证；system-level PEP）
- **External services**: 无 Day-1 外部依赖

## Open questions

1. **Edit ↔ view toggle UI**: toolbar / floating button / keyboard shortcut（如 `e`）？影响 author 切换流畅度
2. **Author preview URL form**: query `?preview=1` / route `/preview/:slug` / mode state only-client-side？影响 SEO（preview 不应被索引）
3. **404 vs 410 vs 403 区分**: 删除 / 私有 / 不存在 三种情况 user-observable 差异该多明显？
4. **滚动位置 persist 颗粒度**: 跨 session 还是同 session？影响 user expectation

## Surfaced ADR debts

- **Notepage 标题归属**: parent [notepage.md] open question #4 "标题在 GridState 内还是外" 影响本 PRD SEO meta / SSR 渲染。**Action**: 拍 parent question 后回填 this PRD
- **Edit ↔ view 切换 UI 决策位置**: PRD-only or ADR？倾向 PRD-only

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，**必须 align 本 PRD**。任何 ADR ↔ PRD 不一致 → ADR rework（详 [AUDIT-2026-05.md] 流程）。

- **Aligning ADRs**:
  - [ADR-0003](../../../../engineering/decisions/ADR-0003-grid-engine-contract.md) — GridState rendering
  - [ADR-0009](../../../../engineering/decisions/ADR-0009-api-style.md) — GET /notes/:slug endpoint
  - [ADR-0010](../../../../engineering/decisions/ADR-0010-performance-budget.md) — Lighthouse / FCP / LCP
  - [ADR-0013](../../../../engineering/decisions/ADR-0013-markdown-tile-editor.md) — RenderView for markdown
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — RenderView contract
- **Audit**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft；reader view 单独成 sub-PRD（Q1 reframe：view 不是 "edit mode minus controls"，有 reader-centric 独立 concerns —— SSR / SEO / private auth / 404-410-403 / etc.）
- 2026-05-16 pass 2 layer relationship fix（owner critical framing）：Dependencies 段只列 upstream PRD deps；ADRs 移到 References "Aligning ADRs" 段
- 2026-05-16 hygiene pass 3 (owner review): 相对链接深度修正
