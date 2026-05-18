# Feature PRD: Notepage (top-level)

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-18 |
| Owner | W_YI |
| Parent PRD | [project.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

## Overview

**Notepage** 是本产品的核心 user-facing concept —— 一个 note 在 web 上的呈现单位。Notepage 不是 document-flow 页面，是 **constrained canvas**：内容以 tile（block）形式摆在 12 列 × N 行的网格底板上。

Notepage 同时承载 **author 编辑**和 **reader 阅读**两条 user journey；同一份 GridState 数据在两种 mode 下渲染不同 affordance（edit mode 有 drag handles / palette / selection；view mode 干净阅读）。Theme system 跨 mode 一致；responsive projection 跨 viewport 一致。

本 PRD 锁的是 **notepage 作为整体的 framing + 跨 sub-feature 的协同 invariant**。具体 mode / theme / responsive 细节归各 sub-PRD。

## Sub-features

| Sub-PRD | Scope | 关键 deps |
|---|---|---|
| [notepage-view.md] | Reader 阅读流：view mode UI、SSR 渲染、anonymous access、阅读 keyboard | [ADR-0009] / [ADR-0013] |
| [notepage-editing.md] | Author 编辑流：insert/move/resize/delete intent、visual affordance、edit keyboard | [ADR-0003] / [ADR-0013] / [ADR-0014] |
| [notepage-responsive.md] | Viewport projection：mobile 1-col / tablet 6-col / desktop 12-col | [ADR-0003] / [ADR-0010] |

**Theme system** 不再作为 notepage sub-PRD —— 2026-05-16 reframe 后 theme 抽出独立 horizontal subsystem，详 [theme-system.md](../theme-system/theme-system.md)。Notepage 跟 theme 的接触面通过下面 Cross-cutting invariants + Cross-feature seams 段表达。

## Cross-cutting user stories

跨 sub-feature 的 user journey；单 sub-PRD 内 user story 各自写专属于该 mode 的：

- As a **new note author**, I want to **sign up → 创建第一个 notepage → 加 markdown block → 公开**，so that **完整体验产品价值的最短路径**
- As a **reader**, I want to **打开 author 公开的 URL → 看到内容布局清晰 → 跨 desktop / mobile 都能用**，so that **author 的内容触达我**
- As a **author switching between modes**, I want to **从 edit 切到 view 预览 → 切回 edit 继续改**，so that **不需 save / publish 就能即时预览**
- As a **author using different theme**, I want to **切 theme 后立刻看到效果 → 切到 view 验证 reader 视角**，so that **theme 选择基于实际效果而非 isolated 预览**

## Cross-cutting invariants

Notepage 整体作为 coherent 产品的不变量。**任何 sub-feature 都不能破这些**：

| Invariant | 含义 | 源 |
|---|---|---|
| **GridState 单一 SoT** | 同一份 GridState 跨 view + edit mode；切 mode 不动 state；切 theme 不动 state；切 viewport 不动 state | [ADR-0003] induction 1 |
| **12-col 逻辑不变** | GridState 永远 logical 12-col；responsive 仅是 render projection；edit / view / mobile / tablet / desktop 看到的是同一 state | [ADR-0003] induction 3 + Trade-offs |
| **Mode 切换即时无 save** | Author 在 edit 改了 → 切 view 预览 → 切回 edit；中间不需 save / publish；切 mode 不 reset 选中 / 滚动位置 | （cross-cutting 新约束） |
| **Theme 跨 mode 一致** | Author 选 theme A → reader 访问 → reader 看到的就是 theme A（除非 reader 自己 override；notepage metadata 优先于 user pref；详 [theme-system-user-view.md]）| frozen DI [grid-redesign-2026-05-11.md] §9.1（frozen DI 旧术语 "frontmatter" 在 DB-backed substrate 后改为 notepage metadata） |
| **Plugin churn 不破核心 UX** | 新增 / 修改 / 删除 block kind 不破 notepage 编辑 / 阅读 / theme / responsive 任何 sub-feature | [ADR-0003] induction 3 kind-opaque |
| **同一 canonical notepage identity 跨 mode** | `/notes/:slug` 是 canonical identity（SEO / sharing / 权限基准）；edit mode 通过 query (`?edit=1`) / client state / 或 `/edit/:slug` 子 route 进入，**不**作为 canonical URL；author 访问 public URL 默认看 view mode；显式 toggle 进 edit | （owner leaning 2026-05-16；待 ratify; 详 Open questions）|
| **Notepage 标题是 page metadata 不是 block** | Title / slug / description 是 GridState **外部**的 page metadata（影响 SEO / SSR / OG meta / URL / 权限列表）；未来可允许 title block 但 title block **不**作为 canonical title | （owner leaning 2026-05-16；待 ratify; 详 Open questions）|

## Cross-feature seams（与其他 feature 协同）

Notepage 不是孤立，要跟其他 feature 协同：

| Adjacent feature | Notepage 跟它的接触面 |
|---|---|
| [theme-system.md] | Theme 是 presentation layer 子系统；通过 4-layer cascade（L0/L1/L2/L3）决定 notepage 在网页上"如何呈现"；切 theme 不丢 GridState / scroll / selection（cross-cutting invariant）；theme 跨 view + edit + responsive 三 mode 一致 |
| [plugin-system.md] | Block kinds 在 notepage 上渲染 / 编辑；plugin 提供 `EditView` / `RenderView` / `defaultSize`；plugin churn 不破 notepage |
| [authentication.md] | Edit 权限通过 session 验证；anonymous user 看 public note；private note 需 session |
| [self-host-deploy.md] | Notepage 在所有 deploy mode 都 work（Docker / single-binary / Workers）；URL 形态稳定 |
| [discussion.md]（Phase 2+） | Discussion block 内嵌在 notepage 中；reader 可成为 discussion participant |
| [ai-integration.md]（Phase 2+） | Agent 通过 semantic API 操作 notepage（per [ADR-0005]）；agent ops 同 human ops 走同 endpoint |
| [search-discovery.md]（Phase 2+） | Notepage 内容被索引；跨 notepage 链接 / wikilink 归此 PRD |

## Non-goals（notepage 整体 layer）

- ❌ **Real-time collaborative editing (CRDT)** —— per [project.md]；Day-1 单人编辑
- ❌ **跨 notepage 链接 / wikilink** —— 归 [search-discovery.md]，不在 notepage scope
- ❌ **Desktop / mobile native app** —— per [project.md]；只 web
- ❌ **Multi-user 同时编辑同 notepage** —— last-write-wins，不显式 conflict 提示
- ❌ **Notepage 内嵌 notepage**（block 嵌 block 嵌 notepage 等）—— [ADR-0003] induction 3 不支持

## Acceptance criteria（notepage 整体）

### M2 — minimum shippable notepage

- 完整 user journey：author signup → 创建空 notepage → 加 markdown block → 编辑 → 发布 → reader 访问 URL → 看到内容
- 3 个 notepage sub-PRD 各 M2 acceptance 都过（[notepage-view.md] / [notepage-editing.md] / [notepage-responsive.md]）
- Cross-feature dependency：[theme-system.md] M2 ship（3 built-in theme 可用 + 切换 + persistence；theme 是 horizontal subsystem，不属 notepage sub-PRD 但 user journey 依赖）
- Lighthouse mobile 90+ on public view
- Self-host onboarding < 10 min

### M3 — plugin breadth + a11y

- 5 个 block kind 在 notepage 上 work（per [plugin-system.md] M3）
- Edit + view 全键盘 a11y baseline
- Theme 切换 polish；switcher UI 完整

### M4 — production polish

- 9 个内置 block kind 全 work
- 5 deploy mode 全 verify（含 Workers）
- Undo/redo（如启用）shipped

## Dependencies

PRD 层 upstream 依赖（ADR 是 downstream，归 References 段）：

- **Sub-PRDs**: [notepage-view.md] / [notepage-editing.md] / [notepage-responsive.md]
- **Other feature PRDs**: [theme-system.md]（presentation layer + theme system）/ [plugin-system.md]（提供 block kinds）/ [authentication.md]（提供 edit 权限）
- **External services**: 无 Day-1 外部依赖

## Open questions（cross-cutting）

跨 sub-feature 的待决问题（sub-feature 内部 question 归各 sub-PRD）：

1. **Mode 切换 UI 位置**：edit ↔ view 切换 toggle 放 toolbar / floating button / keyboard shortcut only？影响 author 体验流畅度（form factor 归 dev/theme；本 question 只问 default 路径）
2. **Author 在 view 预览时如何快速切回 edit**：单按键？还是 toolbar 按钮？
3. **Reader 是否能临时进入 "reader edit" mode**：如 zoom / annotation（私有），不修改 author 原 notepage？Phase 2+ 但需 framing 决策

### Owner-leaning candidates（2026-05-16；待 ratify）

以下是 owner 在 PRD review 时 surface 的倾向方案，已写入 cross-cutting invariants 段作为 draft；待最终 ratify：

4. **Notepage 标题位置** → **owner leans: page metadata（GridState 外）**
   - 理由：SEO / SSR / OG meta / URL / 权限列表都需要稳定 metadata；blocks 内部可移动 / 删除 / kind 切换，不适合作 canonical title
   - 未来允许 title block 作为 in-canvas 视觉表达，但 metadata 仍是 canonical
   - **ratify action**: 写 plugin-system PRD / authentication PRD 时 verify 是否 cover；audit ADR-0002 schema 时确认 notes 表已有 title field（应已有，待 verify）

5. **`/notes/:slug` 跨 mode 形态** → **owner leans: 同 canonical identity，edit mode 是 query / route variant**
   - 理由：避免 "author 访问 public URL 默认进 edit" 跟 SEO / 分享 / 权限混在一起
   - 候选实现：`?edit=1` query / `/edit/:slug` 子 route / client-only mode state（具体 form dev 决定）
   - Author 访问 public URL → 默认 view；显式 toggle 进 edit
   - **ratify action**: audit [ADR-0009] 时 verify endpoint 表能支持；写 authentication PRD 时 cover author 跨 mode 权限路径

## Surfaced ADR debts（cross-cutting）

- **Mode 切换 UX 决策位置**: cross-cutting invariant "edit/view 切换即时无 save"目前没有 ADR 承接 —— 算 PRD-only 决策（user-observable，PRD level）？还是要 ADR 承诺持久化语义？倾向 PRD-only
- **同 URL 跨 mode**: cross-cutting invariant "`/notes/:slug` 一个 URL" 没在 [ADR-0009] 显式；[ADR-0009] 列了 endpoint 表但没说 "edit / view 共用 GET path 区分 auth"。**Action**: audit [ADR-0009] 时 verify

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，**必须 align 本 PRD**。任何 ADR ↔ PRD 不一致 → ADR rework（详 [AUDIT-2026-05.md] 流程）。

- **Aligning ADRs**（technical realization of this PRD's WHAT）：
  - [ADR-0003](../../../../engineering/decisions/ADR-0003-grid-engine-contract.md) — grid layer architecture induction
  - [ADR-0013](../../../../engineering/decisions/ADR-0013-markdown-tile-editor.md) — block 内编辑器 SoT
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — plugin contract
  - [ADR-0016](../../../../engineering/decisions/ADR-0016-css-framework.md) — CSS framework + theme carrier（GAP，本 PRD 触发 rework）
- **Project PRD**: [project.md](../../project.md)
- **Sub-PRDs**:
  - [notepage-view.md](./notepage-view.md)
  - [notepage-editing.md](./notepage-editing.md)
  - [notepage-responsive.md](./notepage-responsive.md)
- **Cross-folder PRDs**:
  - [theme-system.md](../theme-system/theme-system.md) — presentation layer + 4-layer cascade + L0 hard invariants
  - [theme-system-user-view.md](../theme-system/theme-system-user-view.md) — theme 在 notepage 上的 user-observable behavior
- **Frozen DI**: [grid-redesign-2026-05-11.md](../../../../engineering/design/_frozen/grid-redesign-2026-05-11.md)
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc cross-reference convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft；从 features/canvas-editing.md（Phase E pass 1）拆分而来 —— reframe vocab `canvas` → `notepage`（PRD product vocabulary）；hierarchical 结构 with 4 sub-PRDs；top-level 承担 framing + cross-cutting invariants + cross-feature seams 三类内容
- 2026-05-16 pass 2 layer relationship fix（owner critical framing）：PRD 是 master，ADR 是 downstream；Dependencies 段只列 upstream PRDs；ADRs 移到 References "Aligning ADRs" 段；Parent PRD 加 metadata 字段
- 2026-05-16 hygiene pass 3 (owner review)：
  - 相对链接深度修正 (`../../../engineering/` → `../../../../engineering/`；`../../../../packages/` → `../../../../../packages/`)
  - Owner-leaning candidates 段新增：(4) notepage 标题作 page metadata；(5) `/notes/:slug` 是 canonical identity，edit mode 是 variant
  - Cross-cutting invariants 同步更新：URL invariant 改 "canonical notepage identity" 表述；新增 title-as-metadata invariant
