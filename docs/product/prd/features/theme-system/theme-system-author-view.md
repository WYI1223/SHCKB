# Feature PRD: Theme system — author view

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-18 |
| Owner | W_YI |
| Parent PRD | [theme-system.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

## Overview

**Theme 开发者视角**：在 [theme-system.md] top 的 4-layer cascade model 下，author 怎么写一个 L3 plugin new theme（或 L2 内置 theme 的 contributor）—— author paths（fork / compose / from-scratch）、cascade override 机制、scaffolding、validation、lifecycle。

本 PRD 锁的是 **theme author 视角的 user-observable WHAT**——author 能怎么操作 + 能扩展什么 + 怎么验证。

不锁（归 [theme-system.md] top 或其他 sub-PRD）：
- 4-layer cascade 总体机制 + L0 hard invariants 列表 → [theme-system.md] top
- 3 built-in theme 在 user 视角的 user-observable behavior → [theme-system-user-view.md]
- ThemePlugin / GridTheme interface 字段集精确定义 → [ADR-0016] / future render-system ADR
- Theme registry 内部数据结构 → framework code / packages/theme-system/CONTRACT.md
- Sandbox capability / lifecycle 通用机制 → [plugin-system.md] / [ADR-0011] / [ADR-0014]

## User stories（theme author）

- As a **theme author**, I want to **fork 一个 built-in theme 作起点**（copy `themes/lego-studs/` → `my-theme/`），so that **不必从零写所有 attribute**
- As a **theme author**, I want to **compose（extend + override）一个 built-in theme**（如 import lego-studs + 只 override 想改的 attribute），so that **细微调整不必整 fork**
- As a **theme author**, I want to **per-attribute override**（cascade L3 只 override 我想改的，其他 fallback 到 L2/L1），so that **不需要重写整个 theme 才能改一个 attribute**
- As a **theme author**, I want to **明确知道哪些 attribute 不能 override**（L0 hard invariants），so that **写代码时立刻知道边界，不在 runtime 才 fail**
- As a **theme author**, I want to **declare 我的 theme 需要的 capability**（如 storage read for theme asset），so that **sandbox 知道允许什么**（注：keyboard binding / gesture handler 不归 theme；想加自定 interaction 见 future keymap / gesture extension type）
- As a **theme author**, I want to **声明 theme semver + migration**，so that **theme 升版不破 user pref / notepage metadata override 兼容**
- As a **theme author writing a radical theme**, I want to **不被强加 "official base class" 包袱**，so that **fork 后我的 theme 跟 source theme 独立演化**

## Functional requirements

### Must (Day-1, M2) — Day-1 built-in scope

- **3 built-in themes** as L2 reference implementation（per frozen DI [grid-redesign-2026-05-11.md] §9）：
  - `graph-paper` / `lego-studs` / `bento-canvas`
- **Closed registry Day-1**：framework 启动时 explicit register；第三方 L3 theme 不能 runtime install（Phase 2+ 开放）
- **每个 built-in theme 是完整 TS module**：author 可读、可 copy、可 fork
- **3 themes 定位 = "reference implementation"**（L2 layer）——**不是 "official base class"**：fork 是 first-class path；compose 是 ad-hoc 便利；framework 不承诺 "改 built-in theme 不破第三方"

### Must (Day-1, M2) — Cascade override 机制（per-attribute）

Theme author 通过 **per-attribute override** 在 cascade 中放置自己的层（L3）。author 不需要实现 whole bundle；只 override 想改的 attribute，其他 attribute 自动 fallback 到 L2 → L1 → L0 enforce。

```
// pseudo-code; 具体 contract 归 ADR
export const myTheme: ThemePlugin = {
  key: 'my-theme',
  semver: '0.1.0',
  // 只 override 想改的 attribute
  cssVars: { '--accent': 'blue' },
  paletteFormFactor: 'sidebar',
  // 其他不写的 attribute 自动 fallback 到 cascade 上层
};
```

**L0 enforce**（分两层；reviewer SR2 修订）：
- **L0a hard reject**: author override 触碰 algorithm core / interaction semantics / switcher fallback / data persistence boundary（如改 GridState shape / 改 12-col / 试图 bind 自定 keymap / 隐藏 switcher）→ framework 在 register 时**hard reject** + report；不静默 fallback
- **L0b harness validation**: author override 让 a11y baseline 走破（如 hover visual 但漏 focus visual / contrast < AA / ARIA label 漏写）→ **不**是 register-time 100% reject（React rendering 静态 reject 不可行），而是走 **harness validation + certification gate**（M3 harness ship 后 fail 的 theme blocks release / cert gate；详 L0b enforcement 路径）

### Must (Day-1, M2) — Author can override（cascade L2/L3 freedom；presentation only）

Theme author 通过 cascade override 能 full control 以下 **presentation attribute**（fallback chain：L3 → L2 → L1）。**Interaction semantics 不在此范围**（详下面 "cannot override" 段；reviewer Finding 2 修订）：

| Surface 类别 | 包含 attribute | Layer |
|---|---|---|
| **静态视觉** | Slot pixel size / baseplate / block 边框 / shadow / CSS vars / 头部 / spacing | L2/L3 |
| **状态视觉** | Selection / hover / focus / drag in-flight / drop preview / resize preview / invalid / loading | L2/L3 |
| **Control 视觉** | Resize handle 视觉 / handle visibility policy / handle 位置（presentation 选择，不改 interaction） / drag handle 视觉 / inline toolbar visual / block menu visual | L2/L3 |
| **Form factor**（位置 / 形态选择，**不**含触发逻辑） | Palette form factor (toolbar / floating / sidebar) / palette 出现位置 / theme switcher form factor / mode switch form factor | L2/L3 |

**Key clarification**: 上面的 "form factor" 是 **位置 + 形态视觉**；具体**触发方式（keymap 绑定 / gesture 触发 / pointer threshold）归 framework**，theme 不动。

详 attribute enumeration 见 [theme-system.md] top "L0 / L1 / L2 / L3 layer 职责" 段。

### Must (Day-1, M2) — Author cannot override（L0 hard invariants）

详 [theme-system.md] top L0 hard invariants 段。Author 任何 path（fork / compose / from-scratch）触碰 L0 → framework reject + violation report：

- **L0a Algorithm core invariants** (register-time + runtime hard reject)：GridState SoT / 12-col / gravity / AABB / hole-fill / move 保 size / block 内容由 plugin 渲染 / 数据持久化
- **L0a Interaction semantics** (新加；reviewer Finding 2)：keyboard binding map / pointer behavior threshold / touch gesture semantic / multi-select 逻辑 / drag-and-drop state machine / insert flow / undo / redo behavior 都**不**通过 theme cascade；想改这些需 future keymap / gesture / interaction extension type（plugin-system 后续 sub-PRD 候选）
- **L0a Switcher fallback path** (新加；reviewer Finding 6)：framework 提供 accessible fallback switcher（settings page + keyboard shortcut）theme 不可隐藏 / override
- **L0b A11y baseline** (harness-validated；reviewer Finding 4)：keyboard navigability / ARIA / focus order / WCAG AA contrast / touch target / screen reader announcement——M2 framework-owned chrome 锁死 + 3 built-in 通过单测；M3 harness validation；Phase 2+ 第三方 cert

**Validation 时机**（分层；reviewer Finding 4）：
- L0a → register-time（plugin contract 静态 check）+ runtime（mutation 拦截）双层；hard reject
- L0b → framework-owned chrome compile time 锁死 + harness validation（M3+ ship axe-core / pa11y / screen reader smoke test）；不试图 100% register-time reject

### Must (Day-1, M2) — Authoring path（cascade 表达）

**Three paths supported**，cascade model 下自然 support：

| Path | Cascade 表达 | Use case |
|---|---|---|
| **Fork path** | L3 完全独立，不 inherit 任何 L2 built-in；只 inherit L1 framework default fallback | Radical 改；author 想完全自治 |
| **Compose path** | L3 extends 一个 L2 built-in + per-attribute override | 细微调；想保留 built-in 大部分 attribute |
| **From-scratch path** | L3 从零写但可选 declare "inherit L1 base attribute X" | 罕见；deep custom |

```ts
// Compose path 例
import { legoStudsTheme } from '@skb/theme-lego-studs';
export const myTheme: ThemePlugin = {
  ...legoStudsTheme,
  key: 'my-theme',
  cssVars: { ...legoStudsTheme.cssVars, '--accent': 'blue' },
  renderBlock: MyCustomBlockRender,
};

// Fork path 例（不 import built-in）
export const myRadicalTheme: ThemePlugin = {
  key: 'my-radical',
  // 完整定义所有 attribute；不 fallback 到 lego-studs
};
```

三条 path 都被 contract 支持；author 选哪条由 use case 决定。Framework **不**强加 inheritance chain（fork 后的 my-theme 跟 source theme 解耦）。

### Should (Day-1 if scope allows)

- **Theme scaffolding CLI**：`pnpm create skb-theme --base=lego-studs --name=my-theme` 自动生成 fork starter
- **Theme dev mode HMR**：theme 改 → live preview 不刷新 page
- **Theme validation tooling**：framework 启动时验证 theme 没破 L0 invariants + cssVar 没 conflict + form factor 合法
- **Cascade override 检查报告**：tooling 显示本 theme override 了哪些 attribute / 用 fallback 了哪些 attribute（debug 用）

### Nice-to-have (Phase 2+)

- **Theme marketplace** —— browse / install third-party theme
- **Theme inheritance "official"**（stable base class contract）—— 当前 fork-friendly，不承诺 inheritance；如未来生态需要可加
- **Theme A/B testing** —— per-user random assign
- **Theme variant**（dark mode 等同 theme 多 variant）—— Day-1 不做
- **Per-block theme override**（一个 block 用不同 theme）—— per [theme-system-user-view.md] nice-to-have
- **Theme compatibility 矩阵 tooling**：跨 N theme × M block kind 的 visual regression

## Non-goals

- ❌ **4-layer cascade 机制本身** —— 归 [theme-system.md] top
- ❌ **3 built-in theme user-observable behavior** —— 归 [theme-system-user-view.md]
- ❌ **Block extension** —— 归 [new-block.md]
- ❌ **Operator-pluggable CSS theming**（server-side global skin override）—— Phase 2+
- ❌ **第三方 theme Day-1 ship** —— Day-1 closed registry；第三方 Phase 2+
- ❌ **Theme 替代 plugin RenderView 内部** —— theme wrap block，但 block 内部渲染由 plugin 负责
- ❌ **"Official inheritance chain"** —— framework 不承诺 "改 built-in theme 不破第三方"
- ❌ **Theme 改 L0 invariants** —— hard line（framework reject）

## Acceptance criteria

### M2 acceptance

- 3 built-in theme 全 register + 可用（与 [theme-system-user-view.md] M2 align）
- **L0a enforcement work**：尝试 override algorithm invariant / interaction semantics / switcher fallback → register fail + clear error（register-time + runtime hard reject）
- **L0b a11y baseline (M2 scope)**：framework-owned chrome（switcher / palette default / 通用 handle）锁死 + 3 built-in theme 通过 axe-core / pa11y 单测 + manual a11y review
- Cascade per-attribute override work：author 写 only-override-cssVars theme + 验证其他 presentation attribute fallback 到 L2/L1
- 至少一个 L2 theme（lego-studs）完整 demo author path：module 可读 + 可 copy
- **L3 contract reserved**（不 M2 lock；M3 finalize；详 [theme-system.md] M2 acceptance）

### M3 acceptance

- Theme fork path 验证：copy lego-studs → my-theme demo work
- Theme compose path 验证：spread + override demo work
- Theme author 文档完整（含 cascade override 教学）
- **A11y harness 100% wired**（axe-core + screen reader smoke test + keyboard navigability smoke test）；**failing theme blocks certification / release gate**（reviewer Finding 4 修订；不试图 100% register-time reject，而是 harness-validation + gate）
- L3 ThemePlugin contract finalize（含 cascade override metadata）

### M4 acceptance

- 3 theme 全 deploy mode 验证
- Theme scaffolding CLI（如 Should 落地）work
- Cascade override 检查报告 tooling work

### Phase 2+

- 第三方 L3 theme discovery / install / 验签
- Theme marketplace

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Theme 声明 invalid key（含特殊字符 / 跟 built-in 冲突）| Register 失败 + 明确 error |
| Theme renderBlock 抛 exception | Sandbox 隔离 + 显示 "theme render error" + cascade fallback 到上一 layer 此 attribute + 提示 user |
| Theme cssVar 跟 framework reserved var 冲突 | Framework var 优先；theme 覆盖警告 dev mode（per cascade L0 enforce） |
| Theme 升版 migration 失败 | 回滚到旧版本 + theme 标 error；user pref / notepage metadata override 保留 |
| 卸载 theme 但 user pref / notepage metadata override = 此 theme | Cascade fallback：L3 missing → L2 default theme（`lego-studs`）；UI 显示 "this notepage requires theme X (uninstalled)" |
| Theme 声明 capability 超出 sandbox 允许（如要全局 fetch） | Register 失败 + 提示降低 capability |
| 两个 L3 theme 注册同 key | Register 失败（first wins / error 视 framework 决定） |
| Theme **试图 override L0** invariant（如改 GridState shape）| Framework register-time catch + reject + violation report |
| Theme 只 override 部分 attribute 但漏掉 a11y-required attribute（如 hover visual 但没 focus visual）| Validation warn；fallback 上层；M3+ harness validation 失败 → cert / release gate block（不是 register-time hard reject；reviewer SR2 修订）|

## Dependencies

PRD 层 upstream 依赖（ADR 是 downstream，归 References 段）：

- **Parent PRD**: [theme-system.md](./theme-system.md)
- **Sibling PRDs**: [theme-system-user-view.md](./theme-system-user-view.md)（对偶 user-side）
- **Cross-folder PRDs**:
  - [plugin-system.md](../plugin-system/plugin-system.md) — theme 作为 plugin extension type 的 framework 协同
  - [new-block.md](../plugin-system/new-block.md) — sibling extension type；author 视角对偶（block kind 怎么写 vs theme 怎么写）
  - [notepage-editing.md](../notepage/notepage-editing.md) — theme override form factor 时影响 edit UX user-observable
- **External services**: 无 Day-1 外部依赖

## Open questions

1. **Theme key namespace 规范**：Day-1 简单 string；Phase 2+ open registry 加 namespacing（如 `@vendor/my-theme`）？
2. **Theme assets bundling**：CSS as JS string vs separate .css file vs CSS-in-JS（emotion / 等）？这是 ADR-0016 决策，但影响 author 体验
3. **Theme 跟 framework CSS（如 Tailwind / shadcn）关系**：theme 内部用 framework classes 还是自定 cssVars？author 自由度 vs consistency
4. **Theme contract 通过 ThemePlugin 还是直接 GridTheme**：theme 是不是要走 plugin-system lifecycle（register / sandbox / capability）？倾向是（per 2026-05-16 plugin-system reframe）；细节归 ADR-0014 ThemePlugin specialization
5. **From-scratch path 是否真有 use case**：Day-1 closed 没第三方 author；M3+ 开放后 fork / compose 估计够；from-scratch 是 over-engineering 还是 must-have？
6. **Cascade override 是否支持 partial fallback declaration**：author 显式声明 "我从 L1 fallback 不从 L2"（跳层）？罕见但 fork path 可能需要

## Surfaced ADR debts

Author-view 特有的（cross-cutting debts 详 [theme-system.md] top）：

- **ThemePlugin contract 形态**: [ADR-0014] 当前 BlockPlugin only；本 PRD 落地需 ThemePlugin specialization——含 cascade override metadata（哪些 attribute override 了 / fallback chain 声明 / capability declaration / a11y compliance flag）。**Action**: ADR-0014 audit round 2 加 ThemePlugin section
- **L0 enforcement 分层机制**（reviewer SR2 sharpen）: L0a 走 register-time check + runtime guard 双层（hard reject，fast feedback）；L0b 走 framework-owned chrome compile-time 锁死 + M3+ harness validation + cert gate（不试图 100% register-time reject）。归 future ADR 决策（具体 harness 形态 / cert gate flow / violation handling）
- **Theme scaffolding CLI 归属**: tooling 是 author DX 的 should；是 framework 仓库 ship 还是独立 npm package？归 future ADR + repo structure 决策

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，必须 align 本 PRD（详 [theme-system.md] top + [AUDIT-2026-05.md] 流程）。

- **Aligning ADRs**:
  - [ADR-0016](../../../../engineering/decisions/ADR-0016-css-framework.md) — CSS framework + theme system carrier（GAP；待 cascade-aware）
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — plugin contract（待 ThemePlugin specialization + cascade metadata）
  - [ADR-0011](../../../../engineering/decisions/ADR-0011-sandboxing-evolution.md) — sandbox capability（theme capability declaration 候选承接层）
  - [ADR-0003](../../../../engineering/decisions/ADR-0003-grid-engine-contract.md) — algorithm invariants（L0 主要来源）
  - [ADR-0004](../../../../engineering/decisions/ADR-0004-block-plugin-model.md) — extension model（待 reframe 为 generic）
  - Future render-system ADR — 候选承接 theme system carrier + cascade model
- **Parent PRD**: [theme-system.md](./theme-system.md)
- **Sibling PRD**: [theme-system-user-view.md](./theme-system-user-view.md)
- **Cross-folder PRDs**: [plugin-system.md](../plugin-system/plugin-system.md) / [new-block.md](../plugin-system/new-block.md) / [notepage-editing.md](../notepage/notepage-editing.md)
- **Frozen DI**: [grid-redesign-2026-05-11.md](../../../../engineering/design/_frozen/grid-redesign-2026-05-11.md) §9 theme system LOCK
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc cross-reference convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft；Phase E Day-1 PRD #2 sub-PRD `plugin-system/new-theme.md`；theme extension 作为 plugin-system specialization；与 [new-block.md] 平级；对偶 [notepage-themes.md] (user view) 与本 PRD (author view)；fork / compose 两 path；3 built-in 定位为 reference implementation 不是 base class；显式列 theme 能动 / 不能动 surface
- 2026-05-16 **reframe to theme-system/ folder（pass 2）**：theme 抽出独立 horizontal subsystem folder；本文件从 `plugin-system/new-theme.md` git mv 到 `theme-system/theme-system-author-view.md`；按 4-layer cascade model 重写 "theme 能动什么 / 不能动什么" 段—— extension surface 表按 cascade L2/L3 freedom 分类；L0 hard invariants 引用 top；Authoring path 改写为 cascade 表达；Edge case 加 cascade fallback 行为；parent 改为 [theme-system.md]；refs 重写
