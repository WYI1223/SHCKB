# MVP-10 设计 — 视图模式统一 + 一等链接（View-Mode Unification + First-Class Links）

| Field | Value |
|---|---|
| Date | 2026-06-17 |
| Status | Design — **2026-06-18 订正**（落地评审后重定）：4 面 2 轴 + 全 id（SSOT）；待 spec review |
| Author | 主会话（brainstorming skill 产出） |
| Supersedes | MVP-10 临时定为「产品内搜索」；本轮重定（见 §1） |
| Downstream | 新 PRD-informed ADR（routing / identity / mode model）待立；`notepage/notepage-view.md` + `notepage/notepage-editing.md` PRD 待更新 |
| Consumers (later) | `search-discovery.md`（MVP-11）/ `ai-integration.md`（MVP-11+）—— 搜索结果跳转 + backlink + agent 遍历都消费本轮的导航/链接原语 |

> **Provenance / 交叉校验**：本 spec 由主会话从本 session 的设计讨论综合而成。并行有一个独立 agent 从同一 session 的**原始 transcript**（`29c9e07e-…jsonl`）冷读重建 `docs/engineering/design/discussions/mvp10-scope-2026-06-17.md`（讨论/裁定记录）。两文件刻意独立产出，落地后对照，用来照出本 spec 的盲点。本 spec = **设计**（架构/契约/分期）；那篇 = **讨论记录**（裁定时序/动机）。

> **⚠️ 2026-06-18 订正（落地评审后）** — 原 spec 的「三轴 mode×state×frame → 3 surface（Editor / In-app View / Public）」在实现评审中被 owner 重定。两处关键变化已贯穿下文（§4 / §5 / §8 / §9 / §11 改写；§2 根因诊断保留有效）：
> 1. **4 面 2 轴**：受众（作者·live / 公开·published）× 范围（整库 / 单页）。作者侧 `edit` + `view`（一体两面，working，by id）；公开侧 `read`（整库外链，Shell + public-tree 浏览）+ `note`（单页外链，bare）。Shell 本就 auth-aware，故这是给现有路由**正名**、非新建。
> 2. **全 id 作 SSOT**：四面 URL 一律 by id；slug 退出 URL（alias 留作以后）。id 不变 → 比 title-派生的 slug 更 rename-safe；解析器塌成「同面 + 同 id」；**发布期 slug-物化（4 写点）随之退役**。
>
> 触发 = 运行 e2e 抓到真 bug（块帧 `stopPropagation` 吞掉委托点击，已修 `841a39b`）+ owner 两问（Q1 `/read/`→`/notes/` 逃逸；Q2 同页块链创作）。裁定时序见并行重建的 `discussions/mvp10-scope-2026-06-17.md`（M10-D11..D16）。

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

把上面三轴收敛成一个**正交、可继承**的 surface 模型（**订正后 = §4 的 2 轴 4 面 + 全 id**）；把链接从 richtext 的一个 mark 升成**一等、跨 kind 的能力**；所有跳转（正文链 / backlink / 搜索结果）走**一个客户端导航原语**。

---

## 4. Surface 模型（2026-06-18 订正：4 面 2 轴 + 全 id）

> 取代旧的「三轴 mode×state×frame → 3 surface」。旧三轴把「哪种 chrome」和「哪种内容」揉在一起；下面两根正交轴把它们拆开，落到 4 个面。

### 4.1 两根正交轴
- **受众 / 内容**：作者·**live**（working 草稿）｜ 公开·**published**（发布快照）。
- **范围（仅公开侧分）**：**整库**（要 chrome 浏览目录）｜ **单页**（bare 分享件）。

### 4.2 四个 surface（全 by id）

| Surface | 受众 | state | 范围 / chrome | 标识 | 路由 |
|---|---|---|---|---|---|
| **edit** | 作者 | working | in-Shell | **id** | `/edit/:id` |
| **view** | 作者 | working | in-Shell | **id** | `/view/:id` |
| **read** | 公开 / 匿名 | published | 整库 · in-Shell（public-tree 侧栏） | **id** | `/read/:id`（旧为 `:slug`） |
| **note** | 公开 / 匿名 | published | 单页 · bare | **id** | `/notes/:id`（旧为 `:slug`） |

### 4.3 关键收敛
- **edit ⇄ view = 一体两面**：同一页（by id）、working 草稿、编辑 / 预览两 mode，原地 toggle。兑现历史那条「一个页面跨 edit/view」不变量。view = 作者草稿只读预览（补上「像读者一样看我的草稿」）。
- **read = 整库外链；note = 单页外链**。[`Shell.tsx`](../../../apps/web/src/shell/Shell.tsx) L8-10 / L65-75 本就 **auth-aware**：匿名访客拿 `getPublicTree()`（只含 public+published 投影，[`tree.ts`](../../../apps/server/src/routes/tree.ts) L147），登录作者拿全目录。故 `/read/` 本来就是「浏览整个已发布库」。read / note 都是 published，**区别只在范围**（库要 chrome 浏览 / 单页 bare）→ chrome 有无随范围。**这是给现有路由正名，不是新建 surface。**
- **全 id 作 SSOT**：四面 URL 一律 **by id**。slug 退出 URL（以后按需作 cosmetic alias：id 为准、slug 302→id）。
  - **为什么 id 而非 slug**（订正旧 §4.3「Public by slug」的理由）：slug 由标题派生 → 改名即变 → 链接腐烂；id 不变 → 永不腐烂。**id 比 slug 更 rename-safe**，且不泄露标题（no-leak）。
- **`/p/:id` = 正文里的规范链接串**（surface-neutral，只标识页 / 块）。点击 → handler 按当前面跳 `/<surface>/:id`；无 JS → 服务器 302（默认落 `/notes/:id`，按 visibility 决定 404）。**内部导航不再依赖 slug 物化。**

### 4.4 可达性（解决 §2.3 后果 2）
- **作者侧（edit / view）by id**：稳定、不撞、**永不对草稿 404**；作者在应用内可达整张链接图（含草稿）。
- **公开侧（read / note）by id + published 闸门**：`/read/:id`、`/notes/:id` 只服务 public+published；未发布 / 私有 → **正当 404**（对公众，草稿本不该可达）。read 的 public-tree 侧栏只列已发布页。

---

## 5. 导航原语与两条不变量

### 5.1 原语
新增 host 能力（[`packages/block-kinds/src/types.ts`](../../../packages/block-kinds/src/types.ts) `HostServices`）：

```ts
// LinkRef = §6 的统一链接目标
navigateToPage(ref: LinkRef): void;
```

web host 实现：读**当前 surface**（从路由）→ 目标解析到**同一 surface 的同一 id**，用 React Router `navigate` 客户端跳转，落地后按 `blockId` 滚动 / 高亮。

**全 id 之后解析器是 trivial 的** —— `resolveTarget(当前 surface, {pageId})` = `/<同一 surface>/:pageId`：

| 当前 surface | `navigateToPage({pageId:B})` | 带 `blockId` 时 |
|---|---|---|
| edit `/edit/:id` | `/edit/B` | 落地滚到块 |
| view `/view/:id` | `/view/B` | 落地滚到块 |
| read `/read/:id` | `/read/B`（**留在整库浏览，不逃到 note**） | 落地滚到块（块须在发布快照里） |
| note `/notes/:id` | `/notes/B`（留在单页 bare） | 同上 |

**整组守面继承**（owner 核心要求）：edit→edit、view→view、**read→read、note→note**。**Q1 的 `/read/`→`/notes/` 逃逸由此结构性消失。**

> **发布期 slug-物化退役**：旧 §5.1 注靠 publish 时把 `/p/:id`→`/notes/:slug` 物化（4 写点 + `publicIdToSlug`），只因公开面用 slug 且无客户端 id→slug 映射。**全 id 后不再需要**：正文保持 `/p/:id`，handler 按面跳 `/<surface>/:id`，无 JS 时服务器 302。MVP-10 已落的 `materializeInternalLinks` / `publicIdToSlug` / 4 写点 → **移除**。（导出 / 导入的链接完整性是另一回事 = import 时 id 重映射，见 §7。）

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
- **4-surface 模型落地（全 id）**：edit / view（作者·live）+ read（整库公开，复用 Shell public-tree）+ note（单页公开，bare）；四面 URL **一律 by id**；`/read/:slug`→`/read/:id`、`/notes/:slug`→`/notes/:id`；slug 退出 URL。
- **`navigateToPage(LinkRef)` 客户端原语**（守面、trivial 解析）+ 委托点击处理器 + 两条不变量 + 三种链接情况（含同页 / 跨页块跳）。**Q1 修复**：read→read（不逃 note）。
- **发布期 slug-物化移除**（`materializeInternalLinks` / `publicIdToSlug` / 4 写点）——全 id 后冗余。
- 位置层（scroll + 激活块的 stash / restore，hook 预留）。
- 链接一等能力的缝 ①（`links()` 抽取，markdown + richtext）+ 缝 ②（导航）；缝 ③ **签名占位**。
- `pagelink` mark 加 `blockId?`；`PublishedCanvas` 补块锚。
- 草稿预览（view = 作者 working 只读）。
- **Q2 小修**：「复制块链」改成复制 `/p/:id#blockId` **路径**（现复制全 URL，markdown 解析器只认路径）。

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
| **公开 URL 的 slug alias**（id 为准、slug 302→id，给外链好看 / SEO） | deferred（全 id 已满足正确性，prettiness 后置） | 外链美观 / SEO 成需求时 |

---

## 9. PRD / ADR 账（PRD 先行、ADR 下游）

- **新 PRD-informed ADR**：routing / identity / mode model —— **4-surface 2-轴模型（受众×范围）**、**全 id 作 SSOT**（slug 退出 URL、alias 后置）、`navigateToPage` 守面客户端导航不变量、`LinkRef` + 三缝、`/p/:id` 收窄为 surface-neutral 正文链接、**slug-物化移除**、link 完整性的 remap 债 + trigger。取下一个空编号（ADR-0031 候选，落地时确认）。按 deprecation gate，不复用旧 ADR-0001..0018。
- **更新 PRD**：`notepage/notepage-view.md` + `notepage/notepage-editing.md` —— user-observable 的 mode 模型（edit/read 同页 toggle + working/published 档 + 草稿预览 + 链接跳转保持 mode）。这条「一个 URL 跨 edit/view」不变量已在实现中漂移；本轮要么让代码回归 PRD、要么显式更新 PRD——倾向：**更新 PRD 承认三 surface 模型**（比旧的二态 toggle 更准）。
- AUDIT 寄存器：surfaced debts（link remap）喂回 `docs/engineering/decisions/AUDIT-2026-05.md`。

---

## 10. 测试策略

- **单元**：`links(content)` 抽取（markdown href 解析 / richtext pagelink+blockId → LinkRef）；`navigateToPage` 的 surface→目标解析表（§5.1 三行 × blockId 有无）；同页块链 = 纯滚动不导航的判定。
- **集成（server）**：`/p/:id` 仍 302（对外永链不回归）；`/view/:id` 取数（working/published 档）；草稿在 app surface 可达（by id，不 404）、在 public 正当 404。
- **e2e（Playwright，真浏览器）**：① 编辑器内点页链 → **停在编辑态**跳到目标页编辑态、**无整页重载**（断言 Shell/sidebar 未重挂——可探针某个 chrome 节点的身份/计时）；② 跨页块链 → 落地滚到目标块 + 高亮；③ 同页块链 → 纯滚动；④ **read 页内链 → 留在 read（整库浏览，不逃 note）**、note 页内链 → 留在 note；⑤ 浏览位置回退还原。
  - 真浏览器坑预案（mvp8 记录）：链接在 contentEditable 内的点击默认行为、focus/可见性时序、测试需手动 `afterEach(cleanup)`。
- **导出/导入**：round-trip 后内部 `pageId#blockId` 链接仍解析（守住 §7 完整性）。

---

## 11. Open questions（plan 阶段定）

1. **登录作者打开 `/read/:id` / `/notes/:id` 看哪份目录**：现状给作者完整侧栏；按「read / note = 公开外链」的定性，倾向**永远走 public-tree 投影**（作者也见访客真正看到的库）——owner 未终裁，plan 定。
2. **匿名 read 的 id 可达性**：public projection 须暴露 id（`/read/:id` 取数）；plan 核 public tree 是否带 id（很可能已带，否则小加）。
3. **block 链 authoring 在 MVP-10 的量**：只「右键块 → 复制块链（路径形）」最小口，picker 级深选随 MVP-11 搜索；plan 终确认。
4. **位置层深度**：scroll + 激活块（建议）vs 仅 scroll vs 精确像素恢复。
5. **旧 slug URL 迁移**：`/read/:slug`、`/notes/:slug` 已发出去的链接是否保留 301→`:id`（dev 库无所谓；真部署再定）。
6. **view 命名**：owner 已定**留 `view`**（不改 preview）。

---

## 附：受影响文件清单（plan 用）

- web 路由/壳：`apps/web/src/main.tsx`（四面路由全 by id）、`shell/Shell.tsx`、`pages/EditorPage.tsx`、`pages/InAppView.tsx`（view）、`pages/ReadPage.tsx`（read + note，按 `surfaceOf` 守面）、`nav/useNavigateToPage.ts`（`surfaceOf` / `resolveTarget` 重分类）、`grid/GridCanvas.tsx`（委托点击处理器 + 块锚 + 复制块链路径形）。
- 契约：`packages/block-kinds/src/types.ts`（`HostServices.navigateToPage`/`pickLinkTarget`、`BlockKindModule.links`）。
- richtext：`schema.ts`（pagelink +blockId）、`richtext.ts`（`linkedPageIds`→`links`）、`RichtextRenderView.tsx`（标记输出）。
- markdown kind：`links()` 实现（解析 `/p/:id` href）。
- server：`apps/server/src/routes/notepages.ts`（`/p/:id` 收为 surface-neutral；公开取数按 **id**）、**`render/publish-html.ts` / `settings.ts`(rerenderAllPublished) / `export/importer.ts`：移除 `materializeInternalLinks` / `publicIdToSlug` 及 4 写点**、`PublishedCanvas` 块锚。
- 渲染对齐：`packages/block-kinds` 的 `PublishedCanvas`（块锚 data attr）。

---

## 12. 收尾增补（2026-06-18）：preview 作为浏览模式（chrome 切换）

> 落地 MVP-10 后、收尾前 owner 提的一轮优化。承 §4「edit ⇄ view = 一体两面」，把 view 从**单页 peek** 升成**整库浏览模式**：把 per-page 的 preview 控件从编辑器顶栏挪进左侧 chrome（sidebar），改成 edit/preview 切换；切到 preview 后，sidebar 点任意页都开 view（不是 edit）。

### 12.1 根因（承 §5 守面不变量）
§5 的守面不变量只覆盖**正文内链接**（`resolveTarget` 从 pathname 派生当前面）。但 **sidebar 的作者页行硬编码 `/edit/:id`**（[`Sidebar.tsx`](../../../apps/web/src/shell/Sidebar.tsx) L48），**不参与守面**。后果：在 `/view/A` 预览时点 sidebar 里的 B → 被弹回 `/edit/B`。于是 preview 是**单页死角**——没法像读者一样接着逛。这正是 owner 指的摩擦。

### 12.2 模型：作者面 = 从 URL 调和的轻状态（不引隐藏态）
- 作者两个 live 面 = edit / view。`authorSurfaceOf(pathname)` = `surfaceOf==='view' ? 'view' : 'edit'`（read/note/other 不是作者工作面 → 落 edit）。
- sidebar 持轻状态 `mode: 'edit'|'view'`（默认 edit）。**调和规则**：只要落在作者页面（edit/view），URL 即 SSOT —— 一个 effect 把 `mode` 同步成 `surfaceOf(pathname)`。故**在页上 toggle 与地址栏永不矛盾**（杜绝经典 mode-error 的隐藏态）。非页路由（`/` 等）`mode` 粘住上次值 → 兑现「设好模式再逛」。
- sidebar 作者页行 `to = /<mode>/:id`；toggle = `mode` 的呈现，点另一侧 = setMode +（若在页上）navigate 当前 id 到该面。
- **不落 localStorage**：reload 落 `/view/X` 时 effect 即从 URL 复原 preview；落 `/` 复位 edit（安全默认）。无跨 reload 隐藏态。

### 12.3 折叠 inline flip（单一真相）
- 删编辑器顶栏 `preview ◉`（[`EditorPage.tsx`](../../../apps/web/src/pages/EditorPage.tsx) L317）与 view 顶的 `edit ✎`（[`InAppView.tsx`](../../../apps/web/src/pages/InAppView.tsx) L61）。二者是旧 per-page flip，并入 chrome toggle。
- 编辑器 instruments 抽屉里的 `view ↗`（→ `/notes/:id` 已发布单页）**保留**——那是公开 note 面，与作者草稿 preview 不同。
- collapse 边角：sidebar 收起成 30px 轨时 toggle 随之隐藏（同所有作者控件）；要 flip 先展开。可接受（与 + page / settings 等同待遇）。

### 12.4 测试
- 单元（承 §10 纯函数风格）：`authorSurfaceOf`（edit/view→各自，read/note/other→edit）、`currentId` 导出。
- e2e（真浏览器，承 §10 ④ 教训：只有真浏览器抓 DOM 导航）：登录 → `/edit/A` → 点 chrome「preview」→ `/view/A`；点 sidebar B → **停 `/view/B`**（守 preview）；点「edit」→ `/edit/B`。
