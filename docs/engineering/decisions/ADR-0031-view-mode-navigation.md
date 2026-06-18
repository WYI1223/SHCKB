# ADR-0031: 视图模式统一 + 一等链接（View-Mode Navigation + First-Class Links）

| Field | Value |
|---|---|
| Status | proposed — **2026-06-18 订正**（落地评审后；4 面 2 轴 + 全 id；slug 退出 URL；slug-物化退役） |
| Date | 2026-06-17 |
| Revised | 2026-06-18 |
| Authors | W_YI (owner), Claude |
| Supersedes | — （本 ADR 不取代任何现有 ADR；但更新已漂移的 `notepage.md` / `notepage-view.md` "一个 URL 跨 edit/view" notepage 不变量，详见 Consequences 节）|
| Source | [2026-06-17-mvp10-view-mode-unification-design.md](../../superpowers/specs/2026-06-17-mvp10-view-mode-unification-design.md)（owner greenlight 2026-06-17；**2026-06-18 订正**：4 面 2 轴 + 全 id；PRD-informed：`notepage/notepage-view.md` / `notepage/notepage-editing.md` 承接"编辑与预览同页 toggle / 链接跳转保持模式"用户可观测行为） |
| Plan | [2026-06-17-mvp10-view-mode-unification.md](../../superpowers/plans/2026-06-17-mvp10-view-mode-unification.md) |
| Discussion | [mvp10-scope-2026-06-17.md](../design/discussions/mvp10-scope-2026-06-17.md) |

> **⚠️ 2026-06-18 订正（落地评审后）** — 本 ADR 初稿（2026-06-17）描述的是「三轴 mode×state×frame → 3 surface（Editor / In-app View / Public）+ app=id / Public=slug + publish-time slug-物化」模型。落地 e2e 测试触发 owner 重定：**Decision 节已全量更新为 4 面 2 轴 + 全 id 模型（slug 退出 URL；slug-物化退役）**。下文 Context（根因 + layer-error 诊断）保持有效，不变。Alternatives Considered 旧条目（其中旧条目 4「四个 surface」拒绝理由现已过期）随 Decision 更新注解在各条目内。
>
> 本 ADR 不取代 ADR-0001..0018（均已于 2026-05-23 deprecated），也不取代任何现有 ADR-0019..0030——它补充路由 / 标识 / 模式模型这一此前缺失的层。PRD-informed；走 [AUDIT-2026-05.md](./AUDIT-2026-05.md) 流程注册；下游于 2026-06-17 design spec。

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

### 1. 4 面 2 轴模型（2026-06-18 订正；取代旧「三轴 3 surface」）

> 旧模型（初稿 2026-06-17）：3 surface（Editor / In-app View / Public）; app=id / Public=slug。已由下方 4 面 2 轴 + 全 id 模型取代。

两根正交轴：
- **受众 / 内容**：作者·**live**（working 草稿）｜ 公开·**published**（发布快照）。
- **范围（公开侧细分）**：**整库**（带 chrome 浏览目录）｜ **单页**（bare 分享件）。

四个 surface，**全部 by id**：

| Surface | 受众 | state | 范围 / chrome | 标识 | 路由 |
|---|---|---|---|---|---|
| **edit** | 作者 | working | in-Shell | **id** | `/edit/:id` |
| **view** | 作者 | working | in-Shell | **id** | `/view/:id` |
| **read** | 公开 / 匿名 | published | 整库 · in-Shell（public-tree 侧栏）| **id** | `/read/:id`（旧 `:slug` 退役）|
| **note** | 公开 / 匿名 | published | 单页 · bare | **id** | `/notes/:id`（旧 `:slug` 退役）|

关键收敛：

- **edit ⇄ view = 一体两面**：同一页（by id）、working 草稿、编辑 / 预览两 mode，原地 toggle。补上历史那条已漂移的"一个页面跨 edit/view"不变量；view = 作者草稿只读预览（补上「像读者一样看我的草稿」）。
- **read = 整库外链；note = 单页外链**。Shell 本就 auth-aware：匿名访客拿 `getPublicTree()`（只含 public+published 投影）；`/read/` 本来就是「浏览整个已发布库」。read / note 区别仅在**范围**（整库要 chrome 浏览 / 单页 bare）；**给现有路由正名，非新建 surface**。
- **`/p/:id` = 正文里的规范链接串**（surface-neutral，只标识页 / 块）。点击 → handler 按当前面跳 `/<surface>/:id`；无 JS → 服务器 302（默认落 `/notes/:id`，按 visibility 决定 404）。**内部导航不再依赖 slug 物化。**

### 2. 标识：全 id 作 SSOT（2026-06-18 订正；slug 退出 URL）

> 旧模型（初稿）：app=id / Public=slug。已由全 id 模型取代。

**四面 URL 一律 by id**。slug 退出 URL（以后按需作 cosmetic alias：id 为准、slug 302→id）。

**为什么 id 而非 slug**：slug 由标题派生 → 改名即变 → 链接腐烂；id 不变 → 永不腐烂。**id 比 slug 更 rename-safe**，且不泄露标题（no-leak）。

- **作者侧（edit / view）by id**：稳定、不撞、**永不对草稿 404**；作者在应用内可达整张链接图（含草稿）。
- **公开侧（read / note）by id + published 闸门**：只服务 public+published；未发布 / 私有 → **正当 404**（对公众，草稿本不该可达）。

### 3. `navigateToPage(LinkRef)` 客户端导航原语

新增 host 能力（`HostServices.navigateToPage`，[packages/block-kinds/src/types.ts]）：

```ts
type LinkRef = { pageId: string; blockId?: string };
navigateToPage(ref: LinkRef): void;
```

web host 实现：读**当前 surface**（从路由）→ 目标解析到**同一 surface 的同一 id**，用 React Router `navigate` 客户端跳转，落地后按 `blockId` 滚动 / 高亮。

**全 id 之后解析器是 trivial 的** — `resolveTarget(当前 surface, {pageId})` = `/<同一 surface>/:pageId`：

| 当前 surface | `navigateToPage({pageId:B})` | 带 `blockId` 时 |
|---|---|---|
| edit `/edit/:id` | `/edit/B` | 落地滚到块 |
| view `/view/:id` | `/view/B` | 落地滚到块 |
| read `/read/:id` | `/read/B`（**留在整库浏览，不逃到 note**） | 落地滚到块（块须在发布快照里）|
| note `/notes/:id` | `/notes/B`（留在单页 bare） | 同上 |

**守面继承（整组）**（owner 核心要求）：edit→edit、view→view、**read→read、note→note**；不同 surface 间不窜模式。**Q1 的 `/read/`→`/notes/` 逃逸由此结构性消失。**

> **2026-06-18 收尾增补（chrome 守面 = preview 浏览模式）**：上面的守面继承原只覆盖**正文内链接**（`resolveTarget` 从 pathname 派生当前面）。收尾把同一不变量延伸到**左侧 chrome（sidebar）**：sidebar 的作者页行不再硬编码 `/edit/:id`，而是跟随当前作者面（edit/view）。结果 = view 从单页 peek 升成**整库浏览模式**——切到 preview 后 sidebar 点任意页都开 view。作者面是从 URL 调和的轻状态（在作者页时 URL 即 SSOT，杜绝隐藏 mode），不落 localStorage。编辑器顶 `preview ◉` / view 顶 `edit ✎` 两个 per-page flip 折叠进单个 chrome 切换。落地细节见 spec §12；用户可观测行为见 [notepage-view.md](../../product/prd/features/notepage/notepage-view.md) pass 6「Preview is a browsing mode」不变量。

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

### 7. 发布期 slug-物化退役（2026-06-18 订正）

> 旧模型（初稿 2026-06-17）：Public 页在发布时把 `/p/:id(#b)` 物化成 `/notes/:slug(#b)`（`materializeInternalLinks` / `publicIdToSlug` / 4 写点）。

**全 id 后不再需要 slug 物化**：正文保持 `/p/:id`，handler 按当前面跳 `/<surface>/:id`，无 JS 时服务器 302（默认落 `/notes/:id`，按 visibility 决定 404）。

**退役范围**：`materializeInternalLinks` 函数、`publicIdToSlug` 映射表、publish 流程 4 写点（`render/publish-html.ts` / `settings.ts(rerenderAllPublished)` / `importer.ts` 等处）。

**为什么退役**：物化的唯一动机是「公开面用 slug 且无客户端 id→slug 映射」。全 id 后四面均 by id，物化冗余且是写点负担。退役后：内部链接完整性靠 `(pageId, blockId?)` 的 id 稳定性，而非发布期的一次性转写。

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
- **作者可以像读者一样看自己的草稿**：view surface（作者·working·in-Shell）补上了一直缺失的草稿预览能力。
- **mode 整组继承**：edit→edit、view→view、read→read、note→note；不同 surface 间不窜模式。
- **link = 一等、跨 kind 能力**：kind 只吐 `LinkRef[]`，不关心如何导航；未来 canvas block、agent 遍历、backlink 索引都复用同一缝 ①——一份 link graph，人走也机器走。
- **全 id 标识干净**：四面一律 by id；id 不变 → rename-safe；草稿永不 404；未发布对外正当 404（published 闸门）。slug 退出 URL，不再引入 id→slug 映射层。
- **`/p/:id` 归位**：收回到其本职（surface-neutral 正文链接串 / 对外永链），不再被滥用为编辑器内导航原语。

### 权衡 / 限制

- **view surface published 档切换延后**：MVP-10 的 view surface 只做 working（草稿预览）档；"看读者现在看到的发布版"延后至 MVP-11 或后续（无 by-id published 取数端点）。详见 Deferred 节。
- **read / note 公开 surface 的块链目标受 published 闸门**：目标页未发布 → public surface 的 `navigateToPage` 正当 404（对匿名读者，草稿本不该可达）。
- **scroll-restore 是 best-effort**：scroll 位置存 in-memory（per session）；刷新 / 跨 tab 不保留。有意的：精确 persisted 位置留体验打磨。
- **`notepage.md` / `notepage-view.md` 的旧不变量已漂移**："一个 URL 跨 edit/view"这条历史不变量从未在代码里成立；本 ADR 以 4 面 2 轴模型**显式更新 PRD**，让文档与已有实现和新设计对齐（而非让代码回归旧 PRD，因为旧 PRD 本身就不准确）。
- **旧 slug URL 迁移**：`/read/:slug`、`/notes/:slug` 已发出去的链接如需保留，可做 301→`:id`（dev 库无所谓；真部署再定）。

---

## Deferred / Accommodated

按 mvp9.5「deferred 不能消失」纪律，durable 记录如下（同时记于 spec §8.3）：

| 项 | 状态 | 何时 / trigger |
|---|---|---|
| **view surface published 档切换**（"看读者现在看到的发布版"，by id） | deferred（无 by-id published 取数端点）| 加 by-id published 取数端点时（MVP-11 或后续）|
| **公开 URL 的 slug alias**（id 为准、slug 302→id，给外链好看 / SEO） | deferred（全 id 已满足正确性，prettiness 后置） | 外链美观 / SEO 成需求时 |
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
4. **四个 surface（有/无 chrome × published/working = 4 格）** —— ~~拒绝~~ **⚠️ 2026-06-18 订正：此条已被 owner 推翻，改为采纳**。旧拒绝理由（"有 chrome + published 并入 In-app View published 档"）在实现评审中被重定：轴分法改为「受众 × 范围」，不再是「mode × chrome」，4 个独立路由全部 by id 即为正确切法。详见 §1。
5. **`/p/:id` 改为 SPA 内路由，按需 redirect/resolve** —— 拒绝：`/p/:id` 的设计用途是对外永链（贴站外、站外 crawl、改名不坏）；把它变成 SPA 路由会丢失 no-leak 404 保证（未发布对外不该能探测存在性），且内外语义混淆。正确做法是保留其原语、禁止其被内部复用。

---

## References

- Spec: [2026-06-17-mvp10-view-mode-unification-design.md](../../superpowers/specs/2026-06-17-mvp10-view-mode-unification-design.md)（根因 + 导航原语 + 链接能力 + deferred 寄存器 + PRD/ADR 账；**2026-06-18 订正**：4 面 2 轴 + 全 id；slug-物化退役）
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
- PRD（同步更新）: [notepage-view.md](../../product/prd/features/notepage/notepage-view.md) / [notepage-editing.md](../../product/prd/features/notepage/notepage-editing.md)（用户可观测 mode 模型：edit/read 同页 toggle + 草稿预览 + 链接跳转保持 mode；已于 2026-06-18 pass 5/6 更新）
- Audit register: [AUDIT-2026-05.md](./AUDIT-2026-05.md)

---

## Changelog

- 2026-06-17 初稿（proposed）：三 surface 模型（Editor / In-app View / Public）；app=id / Public=slug；publish-time slug-物化；`navigateToPage` 守面；三条缝；位置层；导出/导入完整性债。
- 2026-06-18 **订正**（落地评审后 owner 重定）：Decision §1–2 更新为 4 面 2 轴 + 全 id（slug 退出 URL，alias 后置）；§3 resolveTarget 塌为 trivial 同面同 id；§7 发布期 slug-物化退役（`materializeInternalLinks` / `publicIdToSlug` / 4 写点）；Consequences 权衡/限制同步；Deferred 补 slug alias 行；Alternatives #4「四个 surface」拒绝理由注解为已被推翻（改为采纳）。Context / 根因 / 三条缝 / 位置层 / 导出导入完整性节保持有效，不变。
- 2026-06-18 **收尾增补**：§3 加「chrome 守面 = preview 浏览模式」注——守面不变量从正文内链接延伸到 sidebar（作者页行跟随当前面），view 升成整库浏览模式；作者面从 URL 调和（无隐藏 mode、不落 localStorage）；折叠两个 per-page flip 进单个 chrome 切换。配 spec §12 + notepage-view PRD pass 6。
