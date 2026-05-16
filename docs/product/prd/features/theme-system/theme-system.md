# Feature PRD: Theme system (top-level)

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-16 |
| Owner | W_YI |
| Parent PRD | [project.md] |

## Overview

**Theme system** 是 notepage rendering 的 **presentation layer 子系统**。它定义 notepage 内容在网页上"如何呈现"——视觉 + design tokens + layout shell——通过 **4-layer cascade** 让 framework default / built-in theme / third-party theme plugin 各占其位、可独立 override。

Theme 通过 **read-only** 消费 engine / plugin / GridState 的 API，输出视觉。Theme **不**负责内容是什么、不负责算法运算、不负责数据结构、不负责数据持久化。

本 PRD 锁的是 **theme subsystem 整体的 framing + 4-layer cascade + L0 hard invariants + 跨 audience cross-cutting invariants**。具体 audience 细节归 sub-PRD（[theme-system-user-view.md] / [theme-system-author-view.md]）。

**关键 audience split**（与 [plugin-system.md] 对偶）：

| Audience | 看哪 |
|---|---|
| Note author / reader（产品 user） | [theme-system-user-view.md] |
| Theme 开发者（developer-user） | [theme-system-author-view.md] |

**Reframe note**：本 folder 由 2026-05-16 reframe 抽离——原 `notepage/notepage-themes.md` 和 `plugin-system/new-theme.md` 合并到本 folder。理由：theme 的 scope 已超出 notepage 的 sub-feature 边界（含 4-layer cascade / L0 hard invariants / 与 plugin-system 协同 / 跨 view+edit+responsive+plugin），是 horizontal subsystem。

## Scope

### 本 PRD 子系统负责

- **Cascade 机制**：4-layer override + per-attribute fallback 规则
- **L0 hard invariants**：theme 不可触碰的 algorithm + a11y baseline
- **3 built-in theme**（`graph-paper` / `lego-studs` / `bento-canvas`）作 reference implementation
- **Theme 作为 plugin extension type** 的 user-observable contract（与 [plugin-system.md] cross-cutting invariants 协同）
- **Cross-cutting invariants**（跨 user-view / author-view 都成立的）
- **Theme 跟 notepage / engine / plugin 协同的接触面**

### 本 PRD 子系统不负责（边界另一边谁负责）

| 不负责 | 归 | 类型 |
|---|---|---|
| 内容是什么（block kind 渲染内部） | [plugin-system.md] / [new-block.md] / 各 plugin RenderView | content |
| 算法运算（gravity / hole-fill / AABB / etc.） | [ADR-0003] grid-engine | algorithm |
| 数据结构（GridState shape / 12-col logical） | [ADR-0003] + grid-engine CONTRACT | structure |
| 数据持久化 / API | [ADR-0002] + [ADR-0009] | data |
| GridTheme / ThemePlugin interface 字段集 | [ADR-0016] 或 future render-system ADR | contract |
| Theme registry 内部数据结构 | future packages/theme-system/CONTRACT.md | implementation |
| Theme assets bundling 机制 | [ADR-0016] | implementation |
| Sandbox capability / lifecycle 通用机制 | [plugin-system.md] / [ADR-0011] / [ADR-0014] | extension framework |
| Future keymap / gesture / palette extension types | future plugin-system sub-PRDs（owner-driven，不预写） | extension types |

## 4-layer cascade model

Theme system 的核心 mental model 是 **per-attribute cascade**：每个 affordance attribute（visual / control / form factor / keymap / gesture / etc.）独立从下往上 resolve；下层显式 override 才覆盖上层；不 override 自动 fallback 到上层。

```
┌─────────────────────────────────────────────────────────┐
│ L0 Hard invariants  (algorithm core + a11y minimum)      │  ← can NEVER be overridden
│                                                          │     runtime enforce; violation → reject + report
├─────────────────────────────────────────────────────────┤
│ L1 Framework default (affordance baseline)               │  ← always present; fallback when no theme
│      ↓ per-attribute overridable                         │
│ L2 Theme default   (3 built-in: graph-paper / lego /     │  ← reference implementation
│                     bento-canvas)                        │     fork-friendly TS modules
│      ↓ per-attribute overridable                         │
│ L3 Plugin new theme (third-party fork / compose)         │  ← author full freedom
│      ↓                                                   │     除 L0 外任意 attribute 可改
│                                                          │
│ L0 enforcement always applies regardless of layer        │
└─────────────────────────────────────────────────────────┘
```

### Cascade resolution（任何 affordance attribute）

```
attribute = L3.override(attr) ?? L2.override(attr) ?? L1.default(attr)
constraint: must not violate L0 invariant(attr)
```

如 violate L0 → framework runtime reject + log violation；fallback 到上一层未 violation 的 value。

### 每层职责简述

| Layer | 谁定义 | 何时 active | 例 |
|---|---|---|---|
| **L0 Hard invariants** | Framework code + ADR-0003 / a11y standards | Always | "GridState 不可被 theme 改"；"Keyboard navigability 必须 work"；"Touch target ≥44pt" |
| **L1 Framework default** | Framework code（不可由 user 替换） | Always（fallback） | Default keymap (Tab / Enter / Esc 等)；default palette form factor；default handle visual |
| **L2 Theme default** | 3 built-in theme 各自定义 | User 选了一个 built-in theme | lego-studs 用凸点 baseplate + bar resize handle；bento-canvas 用隐藏 baseplate + dot handle |
| **L3 Plugin new theme** | Third-party / Phase 2+ ship | User 装了第三方 theme 且 active | my-theme override 任意 attribute；fork lego-studs 后改 palette form |

### Fork vs Compose（cascade model 下自然支持）

| Path | Cascade 表达 |
|---|---|
| **Fork** | L3 整 layer 完全独立；不 inherit L2；只 inherit L1 fallback（如 my-theme 不基于任何 L2，从零写） |
| **Compose** | L3 inherit L2 的某个 built-in theme；只 override 想改的 attribute |
| **From-scratch** | L3 从零写但选择是否继承 L1 default attribute |

详 [theme-system-author-view.md] 三 path 实操。

## L0 hard invariants（不可被任何 layer override）

### Algorithm core invariants（[ADR-0003]）

| Invariant | 描述 |
|---|---|
| **GridState 单一 SoT** | Theme 不写自己的 layout state；只读 GridState |
| **12-col logical coord** | Theme 不改 column count；只控制 visual projection |
| **Option A gravity** | Theme 不 disable 或改 gravity 语义 |
| **AABB no-overlap** | Theme 不允许 overlap |
| **Hole-fill semantic** | Theme 不改 insert 的 size clamp 逻辑 |
| **Move 保 size** | Theme 不让 move 重新触发 hole-fill |
| **Block 内容渲染由 plugin** | Theme wrap block，但不替代 plugin RenderView 内部 |
| **数据持久化 / API** | Theme 不绕开 API 写自己的 storage |

### A11y minimum baseline

| Invariant | 描述 |
|---|---|
| **Keyboard navigability** | 全键盘可操作；Tab / Shift+Tab focus 流转；Enter / Esc 标准交互 |
| **ARIA roles + labels** | Block / handle / palette / switcher 必须有 ARIA role + accessible label |
| **Focus order** | 视觉 order 跟 DOM tab order 一致 |
| **WCAG AA color contrast** | 文字 / 图标 vs 背景对比 ≥ AA 标准（normal text 4.5:1 / large 3:1） |
| **Touch target ≥44pt** | 任何可交互元素 touch target 最小 44pt（per Apple HIG / Material baseline） |
| **Screen reader announcement** | 状态变化（mode 切换 / theme 切换 / selection 改变）必须有 announcement |

**Enforcement 机制**（GAP，待 ADR 决策）：当前 PRD 只 mandate L0 enforcement 必须存在；具体形态（compile-time check / runtime guard / sandbox boundary）归 future ADR。详 Surfaced ADR debts。

## Cross-cutting invariants

跨 user-view + author-view 都成立的不变量。任何 sub-PRD 不能破。

| Invariant | 含义 |
|---|---|
| **Theme = presentation only** | Theme 不决定内容 / 不运算 / 不改结构 / 不绑数据 |
| **Per-attribute cascade** | 每个 affordance attribute 独立 cascade；不 whole-bundle 替换 |
| **L0 always enforced** | 任何 layer override 违反 L0 → reject + report；不静默 fallback |
| **Fork-friendly** | 3 built-in theme 是完整 TS module，author 可 copy 任意部分；framework 不锁 inheritance chain |
| **Theme switching 不丢 state** | 切 theme 不丢 GridState / scroll / selection / open EditView |
| **Theme 跨 mode 一致** | Author edit mode 切 theme A → view mode 看到 theme A（除非 reader override） |
| **Theme 跨 viewport 一致** | 同一 theme 在 desktop / tablet / mobile 视觉风格保持一致（具体 responsive projection 归 [notepage-responsive.md]） |

## Sub-PRDs

| Sub-PRD | Audience | Scope |
|---|---|---|
| [theme-system-user-view.md] | Note author / reader（产品 user） | 3 built-in theme user-observable behavior + switching + persistence + frontmatter override + a11y baseline 在 user 视角的 manifestation |
| [theme-system-author-view.md] | Theme 开发者（developer-user） | Cascade override 怎么写 + fork / compose / from-scratch path + 每 layer 能改什么 + L0 enforcement experience + scaffolding |

## Cross-feature seams

Theme system 跟其他 feature 协同：

| Adjacent feature | Theme system 跟它的接触面 |
|---|---|
| [notepage.md] | Theme 在 notepage 上 render；切 theme 不破 notepage cross-cutting invariants |
| [notepage-editing.md] | Theme 的 affordance default 决定 edit mode 的 user-observable form factor（palette / handle / drag visual） |
| [notepage-view.md] | Theme 在 view mode 渲染；frontmatter override theme 影响 SSR |
| [notepage-responsive.md] | Theme 跨 viewport 一致；具体 mobile / tablet projection 归 responsive |
| [plugin-system.md] | Theme 是 plugin 的一种 extension type；ThemePlugin specialization 归 plugin contract |
| [authentication.md]（TODO） | Reader override theme 可能需 session（per-user pref）|
| Future keymap / gesture extension | 跟 theme L2/L3 cascade override 协同（具体优先级见 plugin-system cross-cutting） |

## Non-goals（cross-cutting layer）

- ❌ **Whole-bundle cascade replacement** —— theme override 必须 per-attribute，不能 "整 theme 替换 framework default"（per cascade model）
- ❌ **L0 invariants 可由 owner config relax** —— L0 是 framework 锁死，operator / user / theme author 都不能 disable
- ❌ **Theme 决定 algorithm 行为** —— hard line（详 L0）
- ❌ **第三方 theme Day-1 ship** —— Day-1 closed registry；Phase 2+ 开放
- ❌ **Theme marketplace UI** —— Phase 2+；Day-1 不做
- ❌ **Custom theme by end-user without code**（GUI theme editor）—— Phase 2+；Day-1 theme 是 TS module
- ❌ **Plugin-defined themes 不归 plugin-system** —— Reframe correction：theme **是** plugin 的一种 extension type（per 2026-05-16 plugin-system reframe）；本 folder 是 theme subsystem 的 product PRD，跟 plugin-system 是平级 horizontal subsystem 关系，不是互斥关系
- ❌ **System dark/light mode auto-follow** —— Day-1 显式选；auto-follow Phase 2+

## Acceptance criteria（cross-cutting）

### M2 — minimum shippable theme system

- 4-layer cascade work：L1 framework default + L2 3 built-in theme 各自可用 + L3 接口存在（即便 Day-1 closed registry 也可 demo）
- L0 hard invariants runtime enforce baseline（至少 algorithm core invariants；a11y baseline 部分可 M3 完整）
- Theme switching 跨 mode + 不丢 state
- Persistence work（user pref + frontmatter override 三层优先级）
- 3 built-in theme 视觉差异明显 + 都通过 WCAG AA contrast

### M3 — a11y polish + author path

- A11y baseline 100% 满足（含 keyboard navigability + ARIA + focus order + screen reader announcement）
- L3 author authoring path 验证（fork / compose / from-scratch 各 demo work）
- Theme scaffolding CLI（如 author-view PRD 落地）work
- Cascade conflict reporting work（L0 violation 时 user 看到清晰错误）

### M4 — production polish

- 5 deploy mode 下 theme system 都 work（含 Workers runtime constraint）
- Theme uninstall + fallback workflow
- L3 third-party theme 兼容性测试 baseline

### Phase 2+

- Theme marketplace
- GUI theme editor (no-code customization)
- Per-block theme override
- Auto dark/light mode

## Dependencies

PRD 层 upstream 依赖（ADR 是 downstream，归 References 段）：

- **Parent PRD**: [project.md](../../project.md)
- **Sibling PRDs (intra-folder)**:
  - [theme-system-user-view.md](./theme-system-user-view.md)
  - [theme-system-author-view.md](./theme-system-author-view.md)
- **Other feature PRDs**:
  - [notepage.md](../notepage/notepage.md) — theme 在 notepage 上 render
  - [notepage-editing.md](../notepage/notepage-editing.md) — theme affordance 影响 edit UX
  - [notepage-view.md](../notepage/notepage-view.md) — theme 在 view mode 渲染
  - [notepage-responsive.md](../notepage/notepage-responsive.md) — theme 跨 viewport
  - [plugin-system.md](../plugin-system/plugin-system.md) — theme 作为 plugin extension type
- **External services**: 无 Day-1 外部依赖

## Open questions

1. **L0 a11y baseline 是否要给 operator 部分 relax 路径？**（如某些 deploy mode 关 touch target 检查？）—— 当前 Non-goal 拍 L0 锁死，但实际部署可能有边缘情况
2. **Cascade resolution 出现循环 dependency 怎么办？**（L3 override 引用了 L2 attribute，但 L2 也 override 了 L1，且 L0 enforce 链断了？）—— 罕见但 framework 要有 cycle detection
3. **L3 fork 是不是要支持 "继承 L1 framework default 跳过 L2"？**—— 当前 cascade 默认 inherit 链是 L3→L2→L1；fork path 可能想跳 L2
4. **Theme uninstall 时 frontmatter override = 此 theme 怎么 fallback？**—— L3 uninstall → L2 default fallback？user pref override？需要 UX 决策

## Surfaced ADR debts

本 PRD 触发的 ADR 层 framing 问题（reframe round 2 candidates）：

- **[ADR-0016] theme system carrier GAP（hard，已 surface in 原 notepage-themes）**: 本 PRD 进一步明确 carrier ADR 必须 cover：4-layer cascade model / L0 hard invariants enforcement / per-attribute override / fork-friendly module structure。**Action**: carrier ADR rework 时 cover 本 PRD requirements
- **L0 enforcement layer 机制 (new)**: PRD mandate L0 必须 enforce + violation 必须 report；但**怎么 enforce** 没决策（compile-time TS check / runtime check / sandbox guard / 多层组合）。**Action**: 新 ADR 或扩 [ADR-0011] sandboxing 时 cover
- **Override resolution ordering (new)**: 当 user 装第三方 keymap extension（future）+ theme L2 override keymap 时，谁优先？提议：独立 extension（L4 虚拟层）> L3 theme > L2 theme > L1 framework default > L0 enforce。但需 ADR 锁定。**Action**: plugin-system cross-cutting invariant 加 + 未来 ADR 承接
- **[ADR-0014] ThemePlugin specialization**: 本 PRD 落地后 ThemePlugin contract 需 cover cascade override metadata（哪些 attribute 这 theme override 了）。**Action**: ADR-0014 audit round 2 加 ThemePlugin specialization section
- **[ADR-0003] theme-agnostic 承诺 cross-ref**: cross-cutting invariant "theme 跨 mode 一致 / 跨 viewport 一致" 跟 ADR-0003 induction 3（kind-opaque / theme-agnostic）需显式 cross-ref。**Action**: ADR-0003 audit 时 verify

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，**必须 align 本 PRD**。本 PRD 直接 trigger 多条 ADR rework（详 Surfaced ADR debts + [AUDIT-2026-05.md] 流程）。

- **Aligning ADRs**:
  - [ADR-0016](../../../../engineering/decisions/ADR-0016-css-framework.md) — CSS framework + theme system carrier（**GAP**；本 PRD 触发 rework）
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — plugin contract（待加 ThemePlugin specialization）
  - [ADR-0011](../../../../engineering/decisions/ADR-0011-sandboxing-evolution.md) — sandbox capability boundary（L0 enforcement 候选承接层）
  - [ADR-0003](../../../../engineering/decisions/ADR-0003-grid-engine-contract.md) — algorithm invariants（L0 来源）
  - [ADR-0004](../../../../engineering/decisions/ADR-0004-block-plugin-model.md) — extension model（待 reframe to generic）
  - Future render-system ADR — 候选承接 theme system carrier
- **Project PRD**: [project.md](../../project.md)
- **Sibling PRDs**: [theme-system-user-view.md](./theme-system-user-view.md) / [theme-system-author-view.md](./theme-system-author-view.md)
- **Cross-folder PRDs**: [notepage.md](../notepage/notepage.md) / [plugin-system.md](../plugin-system/plugin-system.md)
- **Frozen DI**: [grid-redesign-2026-05-11.md](../../../../engineering/design/_frozen/grid-redesign-2026-05-11.md) §9 theme system LOCK
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc cross-reference convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft（reframe round）；theme 抽出独立 folder（原 notepage/notepage-themes.md + plugin-system/new-theme.md 合并）；承载 4-layer cascade model（L0 hard invariants / L1 framework default / L2 theme default / L3 plugin new theme）+ per-attribute override + fork-friendly；显式 audience split（user-view / author-view）；surface ADR debts: ADR-0016 carrier / L0 enforcement layer / override ordering / ADR-0014 ThemePlugin specialization / ADR-0003 theme-agnostic cross-ref
