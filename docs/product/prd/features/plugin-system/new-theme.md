# Feature PRD: New theme extension

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-16 |
| Owner | W_YI |
| Parent PRD | [plugin-system.md] |

## Overview

Theme extension = **author 写一个新 theme**，改变 notepage 的视觉 + affordance + 交互（在 algorithm core invariants 内）。每个 theme 是独立 TS module；可 fork 已有 built-in theme，也可 compose（extend + override），也可从零写。

本 PRD 锁的是 **theme extension author 视角的 user-observable WHAT**：theme 能扩展什么 / 不能动什么 / fork 和 compose 怎么 work / 跨 theme 一致性要求。

不锁：底层 ThemePlugin / GridTheme interface 字段（HOW，归 future [ADR-0016] 扩展 / new render-system ADR）、theme registry 内部实现、theme assets 加载机制。

不锁 user（note author / reader）视角的 theme 体验 —— theme 作为 product feature 的 user-observable 行为归 [notepage-themes.md]。

**关键 audience split**：

- **Note author 视角**（user）：选 / 切 / persist theme → [notepage-themes.md]
- **Theme author 视角**（developer-user）：怎么写 theme → 本 PRD

## User stories（theme extension author）

- As a **theme author**, I want to **fork 一个 built-in theme 作起点**（copy `themes/lego-studs/` → 改成 `my-theme/`），so that **不必从零写所有 affordance + 视觉**
- As a **theme author**, I want to **compose（extend + override）一个 built-in theme**（如 import lego-studs + 只覆盖 renderBlock），so that **细微调整不必整 fork**
- As a **theme author**, I want to **full control over 视觉 + affordance + 交互**（per the "theme can change" list 下面），so that **不被狭窄 interface 限死**
- As a **theme author**, I want to **declare 我的 theme 用什么 palette form factor**（toolbar / floating / sidebar / etc.），so that **跟 notepage-editing.md "Out of PRD scope" 一致**
- As a **theme author**, I want to **声明需要的 capability**（如自定 keyboard handler 需要 keyboard input cap），so that **sandbox 知道允许什么**
- As a **theme author**, I want to **声明 theme 的 semver + migration**，so that **theme 升版不破 user pref / frontmatter override 兼容**
- As a **theme author writing a radical theme**, I want to **不被强加 "official base class" 包袱**，so that **fork 后我的 theme 跟 built-in 独立演化**

## Functional requirements

### Must (Day-1, M2) — Day-1 built-in scope

- **3 built-in themes** as theme plugins（per frozen DI [grid-redesign-2026-05-11.md] §9）:
  - `graph-paper` / `lego-studs` / `bento-canvas`
- **Closed registry Day-1**：framework 启动时 explicit register；第三方 theme 不能 runtime install
- **每个 built-in theme 是完整 TS module**：author 可读、可 copy、可 fork
- **3 themes 定位 = "reference implementation"**（不是 "official base class"）—— fork 是 first-class path；compose 是 ad-hoc 便利；framework 不承诺 "改 built-in theme 不破第三方"

### Must (Day-1, M2) — Extension surface（theme 能动什么）

Theme 能 full control 以下 surface（不限于狭窄 interface）：

| Surface | 包含 |
|---|---|
| **Slot pixel size** | 整 grid 的密度（如 graph-paper 60px / lego-studs 80px / bento 100px / my-theme 120px）|
| **Visual rendering** | Baseplate / Block 边框 + 背景 + shadow / Drop preview / Resize preview / Selection visual / Drag in-flight visual |
| **CSS vars** | 所有 design tokens（颜色 / 字体 / 圆角 / etc.）|
| **Palette form factor** | Toolbar 一行 / floating chip / sidebar drawer / slash command / context menu / etc. |
| **Resize handle 视觉 + visibility policy** | Bar / dot / 角块；always-visible / hover-only / focus-only |
| **Drag handle 位置** | 整 block / top bar / 角点 / 等 |
| **Keyboard binding map** | Theme 自定 keymap（**应遵循 OS+Web 标准约定**——Enter / Esc / Tab / 方向键 / Delete）|
| **Pointer / gesture handlers** | 自定 touch / pointer 交互（long-press menu / two-finger gesture / 等）|
| **Affordance 增项** | 自定 UI 元素（如 quick-action menu / floating insert button / minimap / etc.）—— 在 algorithm invariants 内随意加 |

### Must (Day-1, M2) — Theme 不能动什么（hard line）

**Algorithm core invariants（[ADR-0003]）** —— Theme 任何 path（fork / compose / from scratch）都不能破：

| 不能动 | 源 |
|---|---|
| **GridState SoT** | [ADR-0003] induction 1 —— theme 不能写自己的 layout state |
| **12-col logical coord** | [ADR-0003] induction 3 —— theme 不能改 column count |
| **Option A gravity** | [ADR-0003] induction 4 —— theme 不能 disable gravity 或改语义 |
| **AABB no-overlap** | [ADR-0003] induction 4 —— theme 不能允许 overlap |
| **Hole-fill semantic** | [ADR-0003] induction 4 + algorithm contract —— theme 不能改 insert 的 size clamp 逻辑 |
| **Move 保 size** | algorithm contract（[notepage-editing.md]）—— theme 不能让 move 重 hole-fill |
| **Block 内容渲染由 plugin 负责** | [ADR-0014] —— theme 不替代 plugin RenderView 内部；只 wrap |
| **数据持久化 / API** | [ADR-0009] + [ADR-0002] —— theme 不绕开 API 写自己的 storage |

### Must (Day-1, M2) — Authoring path

**Three paths supported**:

- **Fork path**（推荐 radical 改）：author copy 整 theme module（如 `packages/theme-lego-studs/`）作 `packages/theme-my-radical/` → 改任意部分
- **Compose path**（推荐细微调）：import a built-in theme 对象 + spread + override；如：
  ```ts
  // pseudo-code; 具体 contract 归 ADR
  import { legoStudsTheme } from '@skb/theme-lego-studs';
  export const myTheme: GridTheme = {
    ...legoStudsTheme,
    key: 'my-theme',
    cssVars: { ...legoStudsTheme.cssVars, '--accent': 'blue' },
    renderBlock: MyCustomBlockRender,
  };
  ```
- **From-scratch path**：author 直接 implement ThemePlugin / GridTheme interface 写新 theme

三条 path 都被 contract 支持；author 选哪条由 use case 决定。Framework **不**强加 inheritance chain（fork 后的 my-theme 跟 source theme 解耦）。

### Should (Day-1 if scope allows)

- **Theme scaffolding CLI**：`pnpm create skb-theme --base=lego-studs --name=my-theme` 自动生成 fork starter
- **Theme dev mode HMR**：theme 改 → live preview 不刷新 page
- **Theme validation**：framework 启动时验证 theme 没破 algorithm invariants（如 declared cssVar 没 conflict / palette form factor 合法）

### Nice-to-have (Phase 2+)

- **Theme marketplace** —— browse / install third-party theme
- **Theme inheritance "official"**（base class with stable contract）—— 当前是 fork-friendly，不承诺 inheritance；如未来需要可加
- **Theme A/B testing** —— per-user random assign
- **Theme variant**（dark mode 等同 theme 多 variant）—— Day-1 不做
- **Per-block theme override**（一个 block 用不同 theme）—— per [notepage-themes.md] nice-to-have

## Out of PRD scope (HOW / ADR / 实现层)

| Concern | 归哪 |
|---|---|
| ThemePlugin / GridTheme interface 字段集精确定义 | future [ADR-0016] 扩展 OR new render-system ADR |
| Theme registry 内部数据结构 | framework code |
| Theme assets bundling 机制（CSS / svg / etc.） | [ADR-0016] |
| Theme migration 调度算法 | future render-system ADR |
| Theme switcher UI 具体 form factor | per theme 自己决定（**meta**：theme 可以决定自己的 switcher UI form factor）|
| 与 framework theme（Tailwind / shadcn）交互 | [ADR-0016] |

## Non-goals

- ❌ **Block extension** —— 归 [new-block.md]
- ❌ **Operator-pluggable CSS theming**（如 server-side global skin override）—— Phase 2+
- ❌ **第三方 theme Day-1 ship** —— Day-1 3 built-in；第三方 Phase 2+
- ❌ **Theme 替代 plugin RenderView 内部** —— theme wrap block，但 block 内部渲染由 plugin 负责
- ❌ **"Official inheritance chain"** —— framework 不承诺 "改 built-in theme 不破第三方"；fork 后 my-theme 解耦
- ❌ **Theme 改 algorithm** —— hard line（详 Must 第三段）

## Acceptance criteria

### M2 acceptance

- 3 built-in theme 全 register + 可用
- Theme contract 形态稳定（待新 ADR 承接 [ADR-0016] GAP）
- 至少一个 theme（lego-studs）完整 demo path：author 视角 module 可读 + Day-1 user 视角 work（与 [notepage-themes.md] M2 align）
- 跨 theme algorithm invariants 不破：3 个 theme 下 gravity / hole-fill / overlap reject 一致

### M3 acceptance

- Theme fork path 验证：copy lego-studs → my-theme demo work
- Theme compose path 验证：spread + override demo work
- Theme author 文档完整

### M4 acceptance

- 3 theme 全 deploy mode 验证
- Theme scaffolding CLI（如 Should 落地）work

### Phase 2+

- 第三方 theme discovery / install
- Theme marketplace

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Theme 声明 invalid key（含特殊字符 / 跟 built-in 冲突）| Register 失败 + 明确 error |
| Theme renderBlock 抛 exception | Sandbox 隔离 + 显示 "theme render error" + 回退 default theme + 提示 user |
| Theme cssVar 跟 framework 冲突 | Framework var 优先；theme 覆盖警告 dev mode |
| Theme 升版 migration 失败 | 回滚到旧版本 + theme 标 error |
| 卸载 theme 但 user pref = 此 theme / frontmatter override = 此 theme | 回退 default theme + 显示 "this notepage requires theme X (uninstalled)" + 提示重装 |
| Theme 声明 capability 超出 sandbox 允许（如要全局 fetch）| Register 失败 + 提示降低 capability |
| 两个 theme 注册同 key | Register 失败（first wins / error 视 framework 决定）|
| Theme 偷偷改了 algorithm（如 renderBlock 改 col / row）| Framework runtime catch（per algorithm invariant） + theme 标 violation |

## Dependencies

PRD 层 upstream 依赖（ADR 是 downstream，归 References 段）：

- **Parent PRD**: [plugin-system.md](./plugin-system.md)
- **Sibling PRDs**: [new-block.md](./new-block.md)
- **Other feature PRDs**:
  - [notepage-themes.md](../notepage/notepage-themes.md) —— theme 作为 product feature 的 user view（本 PRD 的对偶 user-side）
  - [notepage-editing.md](../notepage/notepage-editing.md) —— theme 决定 affordance form factor 时影响 editing 体验
  - [notepage-view.md](../notepage/notepage-view.md) —— theme 在 view mode 渲染
- **External services**: 无 Day-1 外部依赖

## Open questions

1. **Theme key namespace 规范**：Day-1 简单 string；Phase 2+ open registry 加 namespacing（如 `@vendor/my-theme`）？
2. **Theme assets bundling**：CSS as JS string vs separate .css file vs CSS-in-JS（emotion / 等）？这是 ADR-0016 决策，但影响 author 体验
3. **Theme 跟 Tailwind 关系**：theme 内部用 Tailwind classes 还是自定 cssVars？author 自由度 vs consistency
4. **Theme 是不是 plugin?** Owner reframe pass 1 把 theme 归 plugin-system；但实装层 theme 是 React component 集合，比 block plugin 更接近 "library"。**Action**: future ADR-0016 rework / new render-system ADR 时拍板（这条对 PRD 没影响，影响 contract 细节）
5. **从零写 theme 是否真有 use case?** Day-1 closed 没 author；M3+ 开放后 fork / compose 估计够；from-scratch 是 over-engineering 还是 must-have？

## Surfaced ADR debts

- **[ADR-0016] theme system carrier GAP（已 surface in [notepage-themes.md]）**: 本 PRD 进一步明确 carrier ADR 需要 cover：fork / compose 两 path / wide extension surface（含 palette / handle / keymap / etc.） / algorithm invariant enforcement。**Action**: carrier ADR rework 时 cover 本 PRD requirements
- **[ADR-0014] 多 plugin type 分层**: BlockPlugin contract Day-1 已 lock；ThemePlugin contract 是新的；audit round 2 拍 generic Plugin base + per-type specialization 形态。**Action**: audit time
- **Algorithm invariant enforcement 在哪一层**: theme 不能改 algorithm 是 invariant；但 framework 怎么 enforce（compile-time? runtime check? sandbox guard?）—— 实装决策。**Action**: [ADR-0011] sandbox audit 时 cover；本 PRD 只 mandate enforcement 必须存在，不规定形态

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，**必须 align 本 PRD**。本 PRD 进一步 trigger [ADR-0016] theme system carrier rework（详 [AUDIT-2026-05.md] 流程）。

- **Aligning ADRs**:
  - [ADR-0016](../../../../engineering/decisions/ADR-0016-css-framework.md) — CSS framework + theme carrier（**GAP**；本 PRD 触发 rework + 提供 author-side requirements）
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — plugin contract（待 reframe 加 ThemePlugin specialization）
  - [ADR-0003](../../../../engineering/decisions/ADR-0003-grid-engine-contract.md) — algorithm invariants theme 不能动
  - [ADR-0011](../../../../engineering/decisions/ADR-0011-sandboxing-evolution.md) — sandbox capability
  - Future render-system ADR — 候选承接 theme system carrier
- **Frozen DI**: [grid-redesign-2026-05-11.md](../../../../engineering/design/_frozen/grid-redesign-2026-05-11.md) §9 theme system LOCK
- **Audit**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft；Phase E Day-1 PRD #2 sub-PRD；theme extension 作为 plugin-system 的 specialization；与 [new-block.md] 平级；对偶 [notepage-themes.md] (user view) 与本 PRD (author view)；fork / compose 两 path；3 built-in 定位为 reference implementation 不是 base class；显式列 theme 能动 / 不能动 surface
