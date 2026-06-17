# ADR-0031: 视图模式统一 + 一等链接（View-Mode Navigation + First-Class Links）

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-17 |
| Authors | W_YI (owner), Claude |
| Supersedes | — （本 ADR 不取代任何现有 ADR；但更新已漂移的 `notepage.md` / `notepage-view.md` "一个 URL 跨 edit/view" notepage 不变量，详见 Consequences 节）|
| Source | [2026-06-17-mvp10-view-mode-unification-design.md](../../superpowers/specs/2026-06-17-mvp10-view-mode-unification-design.md)（owner greenlight 2026-06-17；PRD-informed：`notepage/notepage-view.md` / `notepage/notepage-editing.md` 承接"编辑与预览同页 toggle / 链接跳转保持模式"用户可观测行为） |
| Plan | [2026-06-17-mvp10-view-mode-unification.md](../../superpowers/plans/2026-06-17-mvp10-view-mode-unification.md) |
| Discussion | [mvp10-scope-2026-06-17.md](../design/discussions/mvp10-scope-2026-06-17.md) |

> **注意**：本 ADR 是 PRD-informed，走 [AUDIT-2026-05.md](./AUDIT-2026-05.md) 流程注册，且**下游于** 2026-06-17 design spec（需求决定架构）。本 ADR 不取代 ADR-0001..0018（均已于 2026-05-23 deprecated），也不取代任何现有 ADR-0019..0030——它补充路由 / 标识 / 模式模型这一此前缺失的层。

## Context

### 症状与机制

编辑器内点正文页链接，跳出了 app——全页重载落在发布只读页，甚至 404。根因链：

- `pagelink` mark 渲成裸原生 `<a href="/p/:id">`，应用层无任何点击拦截。
- `/p/:id` 是服务器路由，不在 SPA router；点击 = 整页跳服务器。
- 服务器处理：查不到 / 非 public / 未发布 → **404**；否则 `302 → /notes/:slug` → SPA 冷启 → 只读发布快照页。

三个比症状更深的后果：

1. **每次点链接 = 整页重载**：连 reader→reader 也吃全量冷启，是 SPA 完整性的洞。
2. **草稿 / 私有目标 = 404**：作者无法在自己的链接图里走动（只要目标没发布）。
3. **永远落在发布快照**：就算目标已发布，看到的也是上次发布版，非工作态。

### 根因（收紧）

这是 **layer-error**，不是泛泛的"两个模式"。`/p/:id` 本身没错——它是为**公开分享**设计的（改名不坏、no-leak 404、可贴站外）。错在**编辑器把这条"公开分享永链"当成了正文内导航原语**：一个"读者/对外"作用域的东西被用进了"作者/编辑"作用域。

底下压着的真正不统一 = **三轴不对称**：

| 轴 | edit | read |
|---|---|---|
| 状态 state | working（草稿） | published（快照） |
| 标识 id | **id**（`/edit/:id`） | **slug**（`/notes/:slug`） |
| 内容源 | `getNotepage(id)` | `getPublicNote(slug)` |
| chrome | Shell | Shell（`/read`）/ standalone（`/notes`） |

edit = id + working；read = slug + published——根本不存在"同一页的另一个模式"。加之 `ReadPage` 注释明写 "never working state"，**作者没有任何办法像读者一样预览自己的草稿**——工作态压根没有只读视图。

---

## Decision

### 1. 三 surface 模型（mode × state × frame 三轴收敛）

mode（edit|read）× state（working|published）× frame（in-app|bare）共 8 格，大多无意义（edit+published、edit+bare 不成立）。收敛为 **3 个有效 surface**：

| Surface | mode | state | frame | 标识 | 路由 |
|---|---|---|---|---|---|
| **Editor** | edit | working | in-app | **id** | `/edit/:id`（沿用） |
| **In-app View** | read | working ⇄ published（可切） | in-app | **id** | `/view/:id`（新增） |
| **Public**（分享件） | read | published | bare | **slug** | `/notes/:slug`（沿用） |

关键收敛：

- **Editor 与 In-app View = 同一页（by id）的两个 mode**，原地 toggle——补上历史那条已漂移的"一个 URL 跨 edit/view" notepage 不变量，同时对 state 诚实（In-app View 自带 working⇄published 档）。
- **"有 chrome 的发布页" = In-app View 的 published 档**（工作区内）；**"无 chrome 的发布页" = Public**（独立分享件）。两者的区别 = 你在工作区内 vs 在看一个独立分享件。
- **`/p/:id` 保留**，但**仅作对外/公开永链**（服务器 302 → `/notes/:slug`，用于站外分享/嵌入/外部引用）。**内部导航不再走它**（走 §2 的客户端原语）。

### 2. 标识分法（app=id，public=slug）

- **app surface（Editor / In-app View）一律 by id**：稳定、不会撞、**永不对草稿 404**。作者在应用内可达整张链接图，含草稿。
- **Public by slug**：可读/SEO；改名走 `/p/:id`→slug 桥；对外未发布 = **正当 404**（对公众，草稿本就不该可达）。

匿名在应用内浏览（未认证 in-app read）走 slug 地址（`/read/:slug` 保留，匿名 browse 仍 slug-addressed，因为 public tree 只暴露 slug）。

### 3. `navigateToPage(LinkRef)` 客户端导航原语

新增 host 能力（`HostServices.navigateToPage`，[packages/block-kinds/src/types.ts]）：

```ts
type LinkRef = { pageId: string; blockId?: string };
navigateToPage(ref: LinkRef): void;
```

web host 实现：读**当前 surface**（从路由/上下文）→ 把目标解析到**同一 surface**，用 React Router `navigate` 客户端跳转，落地后按 `blockId` 滚动/高亮。

| 当前 surface | `navigateToPage({pageId:B})` | 带 `blockId` 时 |
|---|---|---|
| Editor `/edit/:id` | `/edit/B`（同 surface = edit/working） | 落地后滚到块 |
| In-app View `/view/:id` | `/view/B`（继承 working/published 档） | 落地后滚到块 |
| Public `/notes/:slug` | 解析 B→slug → `/notes/:Bslug`（未发布=正当 404） | 同上；块须在发布快照里 |

**模式/状态整组继承**（owner 核心要求）：Editor-A→Editor-B、View-A→View-B、Public-A→Public-B；不能在编辑时当发布页跳转。

**实现形状：委托点击处理器**。渲染出来的链接只需带统一标记（`data-skb-page` / 可选 `data-skb-block`）；画布层一个委托点击处理器认这些标记 → `preventDefault()` → `navigateToPage(ref)`。kind 不必各自接线；只有程序化跳转（如搜索结果、backlink 列表项）才直接调 `navigateToPage`。

**两条导航不变量**（写死进设计）：

1. **导航一律 client-side、surgical**：`Shell.tsx` 是 layout route 渲 `<Outlet/>`（sidebar/目录/主题/overlay/auth 常挂）；页间跳转只换 Outlet、只拉目标页 payload，**零浏览器重载、零 app 重启、sidebar 不重拉**。`EditorPage` 的 `<Editor key={pageId}>` 让内容盘按页 remount（故意的干净起点）——廉价子树重挂，非 app 重载。
2. **链接目标 = `(pageId, blockId?)` 处处一致**：pagelink mark / backlink / 搜索结果同一类型 `LinkRef`。

### 4. 同页/跨页块链接（三种情况）

`navigateToPage` 吃三种链接情况，同一原语：

- `blockId` 缺省 → **页链**（页间导航）。
- `pageId == 当前页` + `blockId` → **纯滚动高亮，不导航**（同页块链）。
- `pageId != 当前` + `blockId` → 同 surface 客户端跳页 + 落地后滚到目标块（跨页块链）。

块锚已就位：`GridCanvas.tsx` 每块已带 `data-block-id`；`PublishedCanvas` 须补齐同样标记（trivial 对齐）。

### 5. Link = 一等、跨 kind 的能力（三条缝）

链接不是 richtext 专属 mark，而是 host / 契约里的一等能力。**kind 拥有表达，host 拥有 LinkRef 类型 + 导航 + 创作**。

```ts
type LinkRef = { pageId: string; blockId?: string };
```

三条缝（seam）：

| 缝 | 签名 | 方向 | 谁实现 | 何时 |
|---|---|---|---|---|
| **① 抽取 extract** | `links(content): LinkRef[]`（`BlockKindModule` 新增可选字段） | kind → host | 每 kind 按自己存法吐统一 LinkRef | **MVP-10** |
| **② 导航 navigate** | `HostServices.navigateToPage(ref)` | host → 渲染的链接 / 程序化 | host 唯一 client-side 原语 | **MVP-10** |
| **③ 创作 author** | `HostServices.pickLinkTarget(): Promise<LinkRef \| null>` | kind → host | 搜索驱动的通用选择器（**签名占位 MVP-10，实现 MVP-11**） | 签名 MVP-10；实现 MVP-11 |

**逐 kind 抽取方案**：

- **richtext**：`pagelink` mark 加 `blockId?` attr；`links()` = 泛化 `linkedPageIds`（已有注释 "future backlink feed"）为 LinkRef。
- **markdown**：超链接 href 指 `/p/:id(#blockId)`——零新语法，复用永链；`links()` 解析 markdown 取这类 href → LinkRef。wikilink（`[[page]]`）= 可选 ergonomic 增强，延后（见 Deferred 节）。
- **未来 canvas block**：链接挂在形状/区域上，照样吐 `LinkRef[]`——契约不变，插槽现成。

### 6. 位置层（导航体验）

每个 `(pageId, surface)` 暂存 scroll + 激活块；history 后退或重入时还原。`navigateToPage` **预留 stash/restore hook**（别事后补）。MVP-10 深度：scroll 位置 + 激活块；精确像素恢复留体验打磨。hash-jump（entry 有 `location.hash`）优先于 scroll restore。

### 7. Publish-time 链接物化（Public surface）

Public 页是服务器渲染 HTML，served at `/notes/:slug`。内部链接在 publish 时把 `/p/:id(#b)` **物化成 `/notes/:slug(#b)`**（那时 id→slug 已知），使公开页内跳转走 client-side；`/p/:id` 302 保留为外部/过期链接的 fallback（接受整页跳）。app surface 无此问题（一律 by id）。

### 8. 导出 / 导入完整性（今天安全，未来债明确）

**今天不会破坏链接**（已核）：

- exporter 把 page/block/folder id 原样序列化（[exporter.ts]）。
- importer = 空实例全量恢复 + id 原样插入（[importer.ts] gate 1 拒非空实例，无 remap、无重新生成），content 是 opaque JSON 整存。
- ⇒ `pageId#blockId` 引用导入后指向同一 id，链接完好。**完整性靠"空实例 + 保 id"这条不变量撑着。**

**未来债（trigger 明确）**：一旦加**选择性导入 / 合并导入**，id 会撞 → 须 remap → 内部链接必须跟着重写。因缝 ① 是统一抽取，未来 remap 是 host 层一次 `extract → remap(idMap) → rewrite`（给缝 ① 配对偶 `remapLinks(content, idMap): content`），不是逐 kind 拆 JSON。**MVP-10 不建 remap；ADR 写明此债 + trigger（见 Deferred 节）。**

---

## Consequences

### 正面

- **layer-error 修复**：编辑器内点链接不再全页跳服务器；草稿/私有目标不再 404；不再永远落发布快照——三条后果全消除。
- **作者可以像读者一样看自己的草稿**：In-app View 的 working 档补上了一直缺失的草稿预览能力。
- **mode 整组继承**：Editor-A→Editor-B、Public-A→Public-B；不同 surface 间不窜模式。
- **link = 一等、跨 kind 能力**：kind 只吐 `LinkRef[]`，不关心如何导航；未来 canvas block、agent 遍历、backlink 索引都复用同一缝 ①——一份 link graph，人走也机器走。
- **标识分法干净**：app surface by id（草稿永不 404）；Public by slug（可读/SEO；未发布对外正当 404）。两类地址语义不混。
- **`/p/:id` 归位**：收回到其本职（公开分享永链），不再被滥用为编辑器内导航原语。

### 权衡 / 限制

- **In-app View 的 working⇄published 档切换延后**：MVP-10 只做 working（草稿预览）档；published 档（"看读者现在看到的发布版"）延后至 MVP-11 或后续（无 `getPublicNote(id)` 端点；`getPublicNote` 是 slug+public-only）。详见 Deferred 节。
- **Public surface 的块链回退到服务器 302**：Public→Public 由 publish-time 物化解决；但若目标页未发布，public surface 的 `navigateToPage` 无法 client-side 解析 id→slug，回退 `/p/:id` 302（接受整页跳；匿名读者的正当体验）。
- **In-app View 的 scroll-restore 是 best-effort**：scroll 位置存 in-memory（per session）；刷新 / 跨 tab 不保留。这是有意的：精确 persisted 位置留体验打磨。
- **`notepage.md` / `notepage-view.md` 的旧不变量已漂移**："一个 URL 跨 edit/view"这条历史不变量从未在代码里成立（`ReadPage` 一直 slug-addressed + published-only）；本 ADR 用三 surface 模型**显式更新 PRD**，让文档与已有实现和新设计对齐（而非让代码回归旧 PRD，因为旧 PRD 本身就不准确）。

---

## Deferred / Accommodated

按 mvp9.5「deferred 不能消失」纪律，durable 记录如下（同时记于 spec §8.3）：

| 项 | 状态 | 何时 / trigger |
|---|---|---|
| **In-app View published 档切换**（"看读者现在看到的发布版"，by id） | deferred（无 `getPublicNote(id)` 端点；`getPublicNote` 是 slug+public-only）| 加 by-id published 取数端点时（MVP-11 或后续）|
| **选择性/合并导入的 link remap**（`remapLinks(content, idMap): content`） | accommodated（缝 ① 已使其 host 层单点可做；不是逐 kind 拆 JSON）| 加选择性导入时 |
| **PDF 导出的链接物化**（内部链→PDF 内锚点/脚注） | accommodated（LinkRef 与渲染目标无关；别把链接写死成 HTML href）| 加 PDF 导出时 |
| **agent 按链接遍历**（`resolveLink(ref)→content`；`page_links` 边表 = agent 链接图索引） | accommodated（thin layer on 缝 ①+导航；`page_links` 边表从缝 ① 派生）| MVP-11 AI integration |
| **canvas block 的链接**（缝 ① 表达） | accommodated（契约 shape 不变；插槽现成）| 真 canvas block 落地时 |
| **wikilink 语法糖**（`[[page]]`）markdown 语法 | deferred（ergonomic 增强，零架构影响）| 按需 |
| **[ADR-0008] search-abstraction 重导** | deferred（search-abstraction ADR 是 deprecated legacy；搜索 PRD-informed 新 ADR 待 MVP-11 立）| MVP-11 搜索轮 |

---

## Alternatives Considered

1. **补丁：拦截 `/p/:id` 点击，在 SPA 内解析 302 目标** —— 拒绝：对草稿/未发布目标，302 就是 404，客户端拦截拿不到 slug；对已发布目标，仍要走服务器拿 slug，非 client-side。这不是补丁，是根因。
2. **统一用 slug 做 app surface 标识** —— 拒绝：slug 可更名；改名后旧链接在应用内 404（不是 redirect-safe）；草稿无 slug；by-id 是唯一稳定标识。
3. **在现有 `/read/:slug` 上加 draft-preview 分支（增加 working 档）** —— 拒绝：`/read/:slug` 是 slug-addressed，无法 by-id 定位草稿（草稿没有 slug）；且 slug 改名会破 in-app 跳转链。正确切法是新开 `/view/:id` by-id surface。
4. **四个 surface（有/无 chrome × published/working = 4 格）** —— 拒绝：有 chrome + published 就是 In-app View 的 published 档（一个 surface 内部可切）；不需要 4 个独立路由，chrome 与否 = 你在工作区内还是看独立分享件，这是 frame 轴，不是 surface 轴。owner ratified：published 有 chrome 并入 In-app View。
5. **`/p/:id` 改为 SPA 内路由，按需 redirect/resolve** —— 拒绝：`/p/:id` 的设计用途是对外永链（贴站外、站外 crawl、改名不坏）；把它变成 SPA 路由会丢失 no-leak 404 保证（未发布对外不该能探测存在性），且内外语义混淆。正确做法是保留其原语、禁止其被内部复用。

---

## References

- Spec: [2026-06-17-mvp10-view-mode-unification-design.md](../../superpowers/specs/2026-06-17-mvp10-view-mode-unification-design.md)（完整三轴 surface 模型 + 根因 + 导航原语 + 链接能力 + deferred 寄存器 + PRD/ADR 账）
- Plan: [2026-06-17-mvp10-view-mode-unification.md](../../superpowers/plans/2026-06-17-mvp10-view-mode-unification.md)（Tasks 1-14 实现序列；open questions 裁定；受影响文件清单）
- Discussion: [mvp10-scope-2026-06-17.md](../design/discussions/mvp10-scope-2026-06-17.md)（pivot 时序 M10-D1..D10；root-cause 证据链；消费者优先路线图裁定；open items）
- 关键根因证据文件:
  - [`packages/block-kinds/src/richtext/RichtextRenderView.tsx`](../../../packages/block-kinds/src/richtext/RichtextRenderView.tsx)（裸 `<a href="/p/:id">`，无拦截）
  - [`apps/server/src/index.ts`](../../../apps/server/src/index.ts)（`/p/` 交服务器，不在 SPA router）
  - [`apps/server/src/routes/notepages.ts`](../../../apps/server/src/routes/notepages.ts)（`/p/:id` 302 / no-leak 404）
  - [`apps/web/src/pages/ReadPage.tsx`](../../../apps/web/src/pages/ReadPage.tsx)（"never working state"注释）
  - [`apps/web/src/shell/Shell.tsx`](../../../apps/web/src/shell/Shell.tsx)（layout route + `<Outlet/>`，chrome 常挂不变量）
- 相关 ADR:
  - [ADR-0023](./ADR-0023-export-import-format.md)（export/import 全量恢复 + 保 id 不变量；本 ADR 导出/导入完整性分析的依据）
  - [ADR-0029](./ADR-0029-host-frame-core-blockskin.md)（`BlockKindModule` 字段契约模式；`HostServices` 扩展先例 §listPages/promptText/menu）
  - [ADR-0028](./ADR-0028-autofit-gravity-carveout.md) / [ADR-0030](./ADR-0030-autofit-follow-fix.md)（block 能力扩展到 `BlockKindModule` 的先例）
- PRD（同步更新）: [notepage-view.md](../../product/prd/features/notepage/notepage-view.md) / [notepage-editing.md](../../product/prd/features/notepage/notepage-editing.md)（用户可观测 mode 模型：三 surface + 链接跳转保持 mode + 草稿预览）
- Audit register: [AUDIT-2026-05.md](./AUDIT-2026-05.md)
