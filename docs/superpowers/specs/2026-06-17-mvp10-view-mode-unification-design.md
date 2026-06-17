# MVP-10 设计 — 视图模式统一 + 一等链接（View-Mode Unification + First-Class Links）

| Field | Value |
|---|---|
| Date | 2026-06-17 |
| Status | Design — brainstorming 已通过设计框架，待 spec review |
| Author | 主会话（brainstorming skill 产出） |
| Supersedes | MVP-10 临时定为「产品内搜索」；本轮重定（见 §1） |
| Downstream | 新 PRD-informed ADR（routing / identity / mode model）待立；`notepage/notepage-view.md` + `notepage/notepage-editing.md` PRD 待更新 |
| Consumers (later) | `search-discovery.md`（MVP-11）/ `ai-integration.md`（MVP-11+）—— 搜索结果跳转 + backlink + agent 遍历都消费本轮的导航/链接原语 |

> **Provenance / 交叉校验**：本 spec 由主会话从本 session 的设计讨论综合而成。并行有一个独立 agent 从同一 session 的**原始 transcript**（`29c9e07e-…jsonl`）冷读重建 `docs/engineering/design/discussions/mvp10-scope-2026-06-17.md`（讨论/裁定记录）。两文件刻意独立产出，落地后对照，用来照出本 spec 的盲点。本 spec = **设计**（架构/契约/分期）；那篇 = **讨论记录**（裁定时序/动机）。

---

## 1. 路线图语境（消费者优先）+ 本轮重定

**已批序列（消费者优先）**。脊梁 = 项目自己的反-lock 规矩：**在最 demanding 的消费者（搜索、AI）给 host/plugin API 施压之前，不冻结 plugin 契约**（AUDIT 方法论教训「Context 热就 lock 是反模式 / lived implementation pressure 之前不抽象 lock」）。

| 轮次 | 内容 | 依据 |
|---|---|---|
| **MVP-10** | **视图模式统一 + 一等链接**（本 spec） | backlinks / 搜索跳转脚下的共同导航地基；当前已有真 bug 施压 |
| MVP-11 | 搜索 + backlinks（词法）+ AI integration（语义/agent）；**二者内部先后 owner 未单独裁**（倾向搜索先、AI 吃搜索做底座，但未明确裁定） | 吃本轮的链接图 + 导航原语；充当 host API 需求驱动 |
| 按 trigger | 鉴权完善 | 由**部署野心**（team/public）触发，非功能触发 |
| 殿后 | 插件脊柱 C→B→F（skin 统一/theme 简化 → chrome 放权 → 深度 engine 改写：24 列/新页种） | 消费者压完 API 再冻契约 |

**为什么重定**：MVP-10 原定「搜索」。讨论中 owner 发现 backlinks 与正文链接跳转**坐在一个已损坏的导航原语上**（见 §2），且本质是「整个项目两种 view 模式不统一」。owner 裁定**先打这块地基**——这不违反消费者优先，而是发现消费者脚下缺了地基。搜索/backlinks 顺延 MVP-11，届时变成本轮原语的 trivial 消费者。

---

## 2. 问题与根因（systematic-debugging 已坐实）

### 2.1 症状
编辑器里点正文内的页间链接，会被**整页弹到发布只读页**（view），而不是停在编辑态跳到目标页的编辑态。

### 2.2 机制（证据链闭合）
- `pagelink` mark 只存 `pageId`（[`packages/block-kinds/src/richtext/schema.ts`](../../../packages/block-kinds/src/richtext/schema.ts) L100）。
- 非活动块经 RenderView 渲成**裸原生 `<a href="/p/:id">`**（[`RichtextRenderView.tsx`](../../../packages/block-kinds/src/richtext/RichtextRenderView.tsx) L106）。**apps/web 无任何点击拦截**。
- `/p/:id` 是**服务器路由、不在 SPA router**（[`apps/server/src/index.ts`](../../../apps/server/src/index.ts) L50 把 `/p/` 交服务器；[`apps/web/src/main.tsx`](../../../apps/web/src/main.tsx) 无此路由）。
- 服务器 [`notepages.ts`](../../../apps/server/src/routes/notepages.ts) L404：查不到 / 非 public / 未发布 → **404**；否则 `redirect('/notes/:slug', 302)` → SPA 冷启 → ReadPage（只渲发布快照、standalone）。

### 2.3 三个后果（比症状更深）
1. **每次点链接 = 整页重载**（不是 SPA 内跳转）。连 reader→reader 也吃全量冷启——SPA 完整性的洞。
2. **草稿 / 私有目标 = 404**：作者无法在自己的链接图里走动（只要目标没发布）。
3. **永远落在发布快照**：就算目标已发布，看到的也是上次发布版、非当前工作态。

### 2.4 根因（收紧）
**这是 layer-error，不是泛泛的「两个模式」。** `/p/:id` 这条原语**本身没错**——它是给**公开分享**设计的（改名不坏、no-leak 404、可贴站外）。错在**编辑器把这条「公开分享永链」当成了正文内导航原语**：一个「读者/对外」作用域的东西被用进「作者/编辑」作用域。

底下压着的真正的不统一 = **三轴不对称**：

| 轴 | edit | read |
|---|---|---|
| 状态 state | working（草稿） | published（快照） |
| 标识 id | **id**（`/edit/:id`） | **slug**（`/notes/:slug`） |
| 内容源 | `getNotepage(id)` | `getPublicNote(slug)` |
| chrome | Shell | Shell（`/read`）/ standalone（`/notes`） |

因 edit=id+working、read=slug+published，**根本不存在「同一页的另一个模式」**：「read 模式」= 「那份发布快照，可能不存在/过时」，而**工作态压根没有只读视图**（[`ReadPage.tsx`](../../../apps/web/src/pages/ReadPage.tsx) 注释明写 "never working state"）——作者没法像读者一样预览自己的草稿。

---

## 3. 决策：MVP-10 = 视图模式统一 + 一等链接

把上面三轴收敛成一个**正交、可继承**的 surface 模型；把链接从 richtext 的一个 mark 升成**一等、跨 kind 的能力**；所有跳转（正文链 / backlink / 搜索结果）走**一个客户端导航原语**。

---

## 4. Surface 模型

### 4.1 三正交轴
- **mode**：`edit`（改）| `read`（看）
- **state**：`working`（草稿）| `published`（发布快照）
- **frame**：`in-app`（带 chrome / Shell）| `bare`（独立无 chrome）

8 格大多无意义（edit+published、edit+bare 不成立）。**真实 3 个 surface**：

| Surface | mode | state | frame | 标识 | 路由（提案，最终在 plan 定） |
|---|---|---|---|---|---|
| **Editor** | edit | working | in-app | **id** | `/edit/:id`（沿用） |
| **In-app View** | read | working ⇄ published（可切） | in-app | **id** | `/view/:id`（取代 `/read/:slug`） |
| **Public**（分享件） | read | published | bare | **slug** | `/notes/:slug`（沿用） |

### 4.2 关键收敛
- **Editor 与 In-app View = 同一页（by id）的两个 mode**，原地 toggle——兑现历史那条已漂移的「一个 URL 跨 edit/view」notepage 不变量，但对 state 诚实：In-app View 自带 **working⇄published 档**。
  - 作者在 In-app View 的**默认档 = working**（= 补上「像读者一样看我的草稿」的草稿预览）；可切到 published 看「读者现在看到的发布版」。
- **「有 chrome 的发布页」= In-app View 的 published 档**；**「没 chrome 的发布页」= Public**。chrome 与否 = 你在工作区内 vs 在看一个独立分享件。
- **`/p/:id` 保留**，但**仅作对外/公开永链**（服务器 302 → `/notes/:slug`，给站外分享/嵌入/外部引用用）。**内部导航不再走它**（走 §5 的客户端原语）。

### 4.3 标识分法（解决 §2.3 后果 2）
- **app surface（Editor / In-app View）一律 by id**：稳定、不会撞、**永不对草稿 404**。作者/在应用内可达整张链接图，含草稿。
- **Public by slug**：可读 / SEO；改名走 `/p/:id`→slug 桥；对外未发布 = **正当 404**（对公众，草稿本就不该可达）。

> 匿名在应用内浏览（anonymous in-app read）走 public-tree 暴露的 id（`/view/:id` 的 published 档）；具体 id 可达性在 plan 核（public projection 是否带 id）。

---

## 5. 导航原语与两条不变量

### 5.1 原语
新增 host 能力（[`packages/block-kinds/src/types.ts`](../../../packages/block-kinds/src/types.ts) `HostServices`）：

```ts
// LinkRef = §6 的统一链接目标
navigateToPage(ref: LinkRef): void;
```

web host 实现：读**当前 surface**（从路由/上下文）→ 把目标解析到**同一 surface**，用 React Router `navigate` 客户端跳转，落地后按 `blockId` 滚动/高亮。

| 当前 surface | `navigateToPage({pageId:B})` | 带 `blockId` 时 |
|---|---|---|
| Editor `/edit/:id` | `/edit/B`（同 = edit/working） | 落地后滚到块 |
| In-app View `/view/:id` | `/view/B`（继承 working/published 档） | 落地后滚到块 |
| Public `/notes/:slug` | 解析 B→slug → `/notes/:Bslug`（未发布=404，对公众正当） | 同上，块须在发布快照里 |

**模式/状态整组继承**（owner 核心要求）：Editor-A→Editor-B、Public-A→Public-B、In-app-View(published)-A→同档-B。

> **Public→Public 的 id→slug**：发布是渲染步骤，可在 **publish 时把链接物化成 `/notes/:slug`**（那时 id→slug 已知），使公开页内跳转也走 client-side；`/p/:id` 302 保留为外部/过期链接的 fallback（接受整页跳）。app surface 无此问题（一律 by id）。

### 5.2 实现形状：委托点击处理器
渲染出来的链接（markdown/richtext/任何 kind）只需带统一标记（`data-skb-page` / 可选 `data-skb-block`）。画布层一个**委托点击处理器**认这些标记 → `preventDefault()` → `navigateToPage(ref)`。kind **不必各自接线**；只有**程序化跳转**（如搜索结果、backlink 列表项）才直接调 `navigateToPage`。

### 5.3 三种链接情况（同一原语）
- `blockId` 缺省 → **页链**。
- `pageId == 当前页` + `blockId` → **纯滚动高亮，不导航**（同页块链）。
- `pageId != 当前` + `blockId` → 同 surface 客户端跳页 + 落地后滚到块（跨页块链）。

### 5.4 两条不变量（写死进设计）
1. **导航一律 client-side、surgical**：Shell 是 layout route 渲 `<Outlet/>`（[`Shell.tsx`](../../../apps/web/src/shell/Shell.tsx) L128），sidebar/目录/主题/overlay/auth 常挂；页间跳转**只换 Outlet、只拉目标页 payload**，**零浏览器重载、零 app 重启、sidebar 不重拉**。
   - nuance：[`EditorPage`](../../../apps/web/src/pages/EditorPage.tsx) 的 `<Editor key={pageId}>` 会让**内容盘**按页 remount（故意的干净起点）——廉价子树重挂，非 app 重载。可选防闪：目标 payload 到达前留住旧视图 / hover 预取。
2. **链接目标 = `(pageId, blockId?)` 处处一致**：pagelink mark / backlink / 搜索结果同一类型（§6 `LinkRef`）。

### 5.5 位置层（owner：浏览位置暂存 / 回退到上次位置）
每个 `(pageId, surface, state)` 暂存 scroll + 激活块；history 后退或重入时还原。这是统一导航**之上**的体验层，较轻——但 `navigateToPage` **必须预留 stash/restore hook**（别事后补）。与 §5.3 的 scroll-to-block 共用画布滚动机制（块锚已在 DOM：[`GridCanvas.tsx`](../../../apps/web/src/grid/GridCanvas.tsx) L203 `data-block-id`）。
- MVP-10 深度建议：scroll 位置 + 激活块；finer 的「精确像素恢复」留体验打磨。

---

## 6. 链接 = 一等、跨 kind 的能力

链接不是 richtext 专属 mark，是 host/契约里的一等能力。目标类型统一：

```ts
type LinkRef = { pageId: string; blockId?: string };
```

三条缝（seam）：

| 缝 | 签名 | 方向 | 谁实现 | 何时 |
|---|---|---|---|---|
| **① 抽取 extract** | `links(content): LinkRef[]` （BlockKindModule 新增） | kind → host | 每 kind 按自己存法吐统一 LinkRef | **MVP-10** |
| **② 导航 navigate** | `HostServices.navigateToPage(ref)` | host → 渲染的链接 / 程序化 | host 唯一 client-side 原语 | **MVP-10** |
| **③ 创作 author** | `HostServices.pickLinkTarget(): Promise<LinkRef \| null>` | kind → host | 搜索驱动的通用选择器 | 签名占位 MVP-10，**实现 MVP-11** |

**kind 拥有表达，host 拥有 LinkRef 类型 + 导航 + 创作。** host 不关心 kind 怎么存链接。

### 6.1 per-kind 表达
- **markdown**：超链接 href 指 `/p/:id(#blockId)`——**零新语法**，复用永链；`links()` 解析 markdown 取这类 href → LinkRef。wikilink（`[[page]]`）= 可选 ergonomic 增强，可延后。
- **richtext**：`pagelink` mark **加 `blockId?` attr**；`links()` = 现成 [`linkedPageIds`](../../../packages/block-kinds/src/richtext/richtext.ts) L90（注释已写 "future backlink feed"）泛化为 LinkRef。`extractText`（同文件 L78）继续供搜索的 `searchableText`。
- **未来 canvas block**：链接挂在形状/区域上，照样吐 `LinkRef[]` —— 契约不变，插槽现成。

### 6.2 渲染端
渲染出的链接锚点带统一标记（`data-skb-page` / `data-skb-block`），由 §5.2 委托处理器接管。**published canvas（`PublishedCanvas`）须补同样的 `data-block-id`/标记**（trivial，与编辑器画布对齐）。

---

## 7. 导出 / 导入完整性

**今天不会破坏链接**（已核）：
- exporter 把 page/block/folder id **原样序列化**（[`exporter.ts`](../../../apps/server/src/export/exporter.ts) L95/L112）。
- importer = **空实例全量恢复 + id 原样插入**（[`importer.ts`](../../../apps/server/src/export/importer.ts) L255/L273），**无 remap、无重新生成 id**；content 是 opaque JSON 整存（L282），importer 不碰链接。
- ⇒ `pageId#blockId` 引用导入后指向同一 id，链接完好。**完整性靠「空实例 + 保 id」这条不变量撑着。**

**未来债（trigger 明确）**：一旦加 **选择性导入 / 合并导入**（memory 已记 deferred 摩擦），id 会撞 → 须 remap → 内部链接必须跟着重写。
- 因缝 ① 是**统一抽取**，未来 remap 是 host 层一次 `extract → remap(idMap) → rewrite`（给缝 ① 配对偶 `remapLinks(content, idMap): content`），**不是逐 kind 拆 JSON**。
- **MVP-10 不建 remap**；ADR 写明这条债 + trigger（见 §9）。

---

## 8. 范围（In / Out / Deferred 寄存器）

### 8.1 MVP-10 做（In）
- Surface 模型落地：Editor / In-app View（working⇄published 档）/ Public；app=id、public=slug 路由收敛；`/read/:slug` 退役并入 `/view/:id`；`/p/:id` 保留为对外永链。
- `navigateToPage(LinkRef)` 客户端原语 + 委托点击处理器 + 两条不变量 + 三种链接情况（含同页/跨页块跳）。
- 位置层（scroll + 激活块的 stash/restore，hook 预留）。
- 链接一等能力的缝 ①（`links()` 抽取，markdown + richtext 实现）+ 缝 ②（导航）；缝 ③ **签名占位**。
- `pagelink` mark 加 `blockId?`；`PublishedCanvas` 补块锚。
- 草稿预览（In-app View 的 working 档）。

### 8.2 MVP-10 不做（Out → 后续轮）
- **缝 ③ 实现**：搜索驱动的通用 `pickLinkTarget()` → **MVP-11**（依赖搜索）。MVP-10 只留最小创作口：「右键块 → 复制块链」（复用画布已有右键菜单）+ 沿用 M9 page-picker。
- **block-targeted 消费者**：搜索命中跳块 / backlink 跳块 → **MVP-11**。
- **backlinks / 搜索本身** → MVP-11（本轮只铺它们要踩的导航地基 + 链接图原语）。
- **搜索覆盖范围未决（MVP-11 继承）**：作者搜工作态（含草稿）vs 也含公开页匿名搜索——此问在本轮被 §2 的 pivot 打断、owner 未答，顺延 MVP-11 搜索 scope 再裁。

### 8.3 Deferred / Accommodated 寄存器（按 mvp9.5「deferred 不能消失」纪律 durable 记下）
| 项 | 状态 | 何时 / trigger |
|---|---|---|
| 选择性/合并导入的 link remap（`remapLinks`） | accommodated（缝①已使其 host 层单点可做） | 加选择性导入时 |
| PDF 导出的链接物化（内部链→PDF 内锚点/脚注） | accommodated（LinkRef 与渲染目标无关，别写死 HTML href） | 加 PDF 导出时 |
| agent 按链接遍历（`resolveLink(ref)→content`；`page_links` 边表 = agent 链接图索引） | accommodated（thin layer on 缝①+导航） | MVP-11 AI |
| canvas block 的链接（缝① 表达） | accommodated（契约不变） | 真 canvas block 落地时 |
| wikilink（`[[page]]`）markdown 语法糖 | deferred（ergonomic 增强） | 按需 |

---

## 9. PRD / ADR 账（PRD 先行、ADR 下游）

- **新 PRD-informed ADR**：routing / identity / mode model —— surface 模型（3 轴/3 面）、app=id·public=slug 标识分法、`navigateToPage` 客户端导航不变量、`LinkRef` + 三缝、`/p/:id` 收窄为对外永链、link 完整性的 remap 债 + trigger。取下一个空编号（ADR-0031 候选，落地时确认）。按 deprecation gate，不复用旧 ADR-0001..0018。
- **更新 PRD**：`notepage/notepage-view.md` + `notepage/notepage-editing.md` —— user-observable 的 mode 模型（edit/read 同页 toggle + working/published 档 + 草稿预览 + 链接跳转保持 mode）。这条「一个 URL 跨 edit/view」不变量已在实现中漂移；本轮要么让代码回归 PRD、要么显式更新 PRD——倾向：**更新 PRD 承认三 surface 模型**（比旧的二态 toggle 更准）。
- AUDIT 寄存器：surfaced debts（link remap）喂回 `docs/engineering/decisions/AUDIT-2026-05.md`。

---

## 10. 测试策略

- **单元**：`links(content)` 抽取（markdown href 解析 / richtext pagelink+blockId → LinkRef）；`navigateToPage` 的 surface→目标解析表（§5.1 三行 × blockId 有无）；同页块链 = 纯滚动不导航的判定。
- **集成（server）**：`/p/:id` 仍 302（对外永链不回归）；`/view/:id` 取数（working/published 档）；草稿在 app surface 可达（by id，不 404）、在 public 正当 404。
- **e2e（Playwright，真浏览器）**：① 编辑器内点页链 → **停在编辑态**跳到目标页编辑态、**无整页重载**（断言 Shell/sidebar 未重挂——可探针某个 chrome 节点的身份/计时）；② 跨页块链 → 落地滚到目标块 + 高亮；③ 同页块链 → 纯滚动；④ Public 页内链 → Public-to-Public；⑤ 浏览位置回退还原。
  - 真浏览器坑预案（mvp8 记录）：链接在 contentEditable 内的点击默认行为、focus/可见性时序、测试需手动 `afterEach(cleanup)`。
- **导出/导入**：round-trip 后内部 `pageId#blockId` 链接仍解析（守住 §7 完整性）。

---

## 11. Open questions（plan 阶段定）

1. **路由串最终形**：`/view/:id` vs 在一个路由里用 mode toggle；working/published 档用 query（`?rev=working|published`）还是路由段。
2. **In-app View 默认档**：作者默认 working（草稿预览）已定；匿名在应用内读的 id 可达性（public projection 是否带 id）待核。
3. **block 链 authoring 在 MVP-10 的量**：建议只「右键块→复制块链」最小口，picker 级深选随 MVP-11 搜索；待 owner 在 plan 终确认。
4. **位置层深度**：scroll+激活块（建议）vs 仅 scroll vs 精确像素恢复。
5. **`/read/:slug` 退役的迁移**：是否保留 301 兼容旧链接。

---

## 附：受影响文件清单（plan 用）

- web 路由/壳：`apps/web/src/main.tsx`、`shell/Shell.tsx`、`pages/EditorPage.tsx`、`pages/ReadPage.tsx`（→ 拆为 In-app View / Public）、`grid/GridCanvas.tsx`（委托点击处理器 + 块锚）。
- 契约：`packages/block-kinds/src/types.ts`（`HostServices.navigateToPage`/`pickLinkTarget`、`BlockKindModule.links`）。
- richtext：`schema.ts`（pagelink +blockId）、`richtext.ts`（`linkedPageIds`→`links`）、`RichtextRenderView.tsx`（标记输出）。
- markdown kind：`links()` 实现（解析 `/p/:id` href）。
- server：`apps/server/src/routes/notepages.ts`（`/p/:id` 保留对外；新增 `/view` 取数所需端点如缺）、`PublishedCanvas` 块锚。
- 渲染对齐：`packages/block-kinds` 的 `PublishedCanvas`（块锚 data attr）。
