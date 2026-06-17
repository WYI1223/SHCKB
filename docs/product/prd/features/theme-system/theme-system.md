# Feature PRD: Theme system (top-level)

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-18 |
| Owner | W_YI |
| Parent PRD | [project.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

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
| **Interaction semantics**（keyboard binding map / pointer behavior threshold / touch gesture / multi-select 逻辑 / drag-and-drop state machine / insert flow / undo behavior） | framework default + **future keymap / gesture / interaction extension types**（plugin-system sub-PRDs，owner-driven，不预写） | interaction logic |
| GridTheme / ThemePlugin interface 字段集 | [ADR-0016] 或 future render-system ADR | contract |
| Theme registry 内部数据结构 | future packages/theme-system/CONTRACT.md | implementation |
| Theme assets bundling 机制 | [ADR-0016] | implementation |
| Sandbox capability / lifecycle 通用机制 | [plugin-system.md] / [ADR-0011] / [ADR-0014] | extension framework |

**关键 boundary**：Theme = **presentation layer only**。Cascade override 范围只对 **presentation attribute**（visual / chrome / form factor / state visual / handle visual / palette + switcher form factor / CSS vars / layout shell）；**interaction semantics 不通过 theme cascade**——它们属 framework default + future interaction extension types，theme 不能 override。这条收窄是 2026-05-16 reviewer follow-up 的 Finding 2 修订（避免 theme 变成"交互语义插件"）。

**放权方向注记（owner 口头裁定 2026-06-12）**：当前实现（MVP-6 时点）chrome 与页面骨架只开放 token 级跟随，结构不可改——这是实现进度，不是产品立场。Owner 方向 = chrome 结构与页面骨架（标题位置/画布对齐/全幅等 layout shell 属性）**大概率要放权**给 theme/plugin 作者，"尽量不给太多限制"；与本 PRD 的 layout shell ∈ presentation domain 一致。节奏约束：chrome 结构槽位契约应在见过多种 chrome 形态后再冻结（MVP-7 UI 分叉研究 = 形态样本来源），避免把现 UI 形状固化进契约。

## 4-layer cascade model

Theme system 的核心 mental model 是 **per-attribute cascade**：每个 **presentation attribute**（visual / chrome / form factor / state visual / handle visual / palette + switcher form factor / CSS vars / layout shell）独立从下往上 resolve；下层显式 override 才覆盖上层；不 override 自动 fallback 到上层。

**注意范围**：cascade 只覆盖 **presentation attribute**。**Interaction semantics**（keyboard binding / pointer behavior / gesture handler / drag state / insert flow / undo behavior）**不进 cascade**——它们固定在 framework default + future interaction extension type（详上面 Scope 段 "Interaction semantics" 行）。

```
┌──────────────────────────────────────────────────────────────────┐
│ L0 Hard invariants  (algorithm core + a11y minimum + switcher)    │  ← can NEVER be overridden
│                                                                   │     runtime enforce; violation → reject + report
├──────────────────────────────────────────────────────────────────┤
│ L1 Framework default (presentation baseline)                      │  ← always present; fallback when no theme
│      ↓ per-attribute overridable (presentation domain only)       │
│ L2 Theme default    (3 built-in: graph-paper / lego /             │  ← reference implementation
│                      bento-canvas)                                │     fork-friendly TS modules
│      ↓ per-attribute overridable (presentation domain only)       │
│ L3 Plugin new theme (third-party fork / compose)                  │  ← presentation attribute freedom
│      ↓                                                            │     interaction semantics 仍归 framework /
│                                                                   │     future interaction extension type
│ L0 enforcement always applies regardless of layer                 │
└──────────────────────────────────────────────────────────────────┘

NOT in cascade (固定在 framework default + future extension type):
  keyboard binding map / pointer behavior / gesture handler /
  drag state machine / insert flow / undo behavior / multi-select 逻辑
```

### Cascade resolution（presentation attribute only）

```
attribute = L3.override(attr) ?? L2.override(attr) ?? L1.default(attr)
constraint: must not violate L0 invariant(attr)
scope:      attr ∈ presentation domain（visual / chrome / form factor / state visual / handle / palette/switcher form / CSS vars / layout shell）
            interaction attribute NOT in cascade domain（详 Scope 段 "Interaction semantics" 行）
```

如 violate L0 → framework runtime reject + log violation；fallback 到上一层未 violation 的 value。

**Cascade 不涵盖 interaction logic**：keyboard binding / pointer behavior / gesture handler / drag state machine / insert flow / undo behavior 都**不**通过 theme cascade resolve；它们绑 framework default + future interaction extension type。Theme 不能 override interaction semantics（reviewer Finding 2 修订）。

### 每层职责简述

| Layer | 谁定义 | 何时 active | 例 |
|---|---|---|---|
| **L0 Hard invariants** | Framework code + [ADR-0003] / a11y standards | Always | GridState invariants（详 L0a 段）；A11y baseline（详 L0b 段）；Switcher fallback path（framework-owned） |
| **L1 Framework default** | Framework code（不可由 user 替换） | Always（fallback） | Default palette form factor；default handle visual；default switcher (settings page + keyboard shortcut)；**default keymap / pointer / gesture（这些不进 cascade，固定在 L1）** |
| **L2 Theme default** | 3 built-in theme 各自定义 | User 选了一个 built-in theme | lego-studs 用凸点 baseplate + bar resize handle；bento-canvas 用隐藏 baseplate + dot handle；**仅 presentation attribute** |
| **L3 Plugin new theme** | Third-party / Phase 2+ ship（Day-1 reserved，contract 不 M2 lock）| User 装了第三方 theme 且 active | my-theme override **presentation attribute only**；fork lego-studs 后改 palette form / handle visual；**interaction semantics 始终归 framework / future interaction extension type，不能 override** |

### 层占据模型（layer occupancy；owner ratified 2026-06-12）

Cascade 的层间 fall-through 语义不变；变的是**每层由谁提供**：任何 theme/presentation plugin 可声明占据 L1 / L2 / L3 中的一层或多层，user 按层组合不同插件（如 A 插件的 L3 配色 + B 插件的 L2+L1）。

```
attr = L3(占据者) ?? L2(占据者) ?? L1(占据者) ?? vanilla(framework，不可卸)
```

- **Vanilla 地板不可抽走**：framework default 永远垫在最底层；任何占据者卸载/损坏，下层接住，页面照常渲染（与 palette 变体移除时的降级纪律同源）。插件"占据 L1"= 声明基底级 + 坐最低插件优先级，不是替换 vanilla。L0b 的 a11y 兜底与 switcher fallback path 依赖此条。
- **同层单选，不合并**：同一层多个候选 = user 单选其一；栈深恒为 3+地板。**同层多包自由堆叠 considered-and-rejected**（2026-06-12）：QA 面组合爆炸（任意两包 globalCss 即可打特异性战争），工程灾难；固定栈深把冲突面收回常数。
- **包内多层自治**：一个插件占多层（如 L2+L1）时，其内部层间协调归包作者；framework 只保证层间 fall-through 语义，不替包做一致性 QA。

**三档覆盖度契约**（占层资格由覆盖度决定；档位越低代码越重、契约越强、开放越晚——与放权节奏注记自洽）：

| 档 | 可占的层 | 性质 | 契约强度 | 现状对应 |
|---|---|---|---|---|
| **材质包**（sparse 覆盖） | L3 | 纯数据：token 子集 / 配色 / 字体 | 最弱（sanitize 白名单；叠错最坏是难看） | operator 主题自定义 = 系统自生成的 L3（MVP-5 [ADR-0026]） |
| **主题包**（完整内容主题） | L2（可顺带 L3） | 数据 + 槽位代码：完整 Theme 模块 | 中（registry + 槽位契约 + 未来 a11y harness） | 5 个 built-in theme |
| **UI 包**（chrome / 页面骨架） | L1（可顺带 L2+L3） | 重代码：整套 chrome 结构 | 最强（chrome 槽位契约，**最后冻结**，见放权方向注记） | MVP-7 三个 UI 分叉分支 = L1 候选形态样本 |

数据/代码二分给 L0 enforcement 一个干净分界：数据档（材质包）走宽松校验即可安全开放；代码档（主题包/UI 包）走 contract + harness。多包 globalCss 的 CSS 交互是 Minecraft 资源包模型没有的固有风险——同层单选 + 层间 fall-through 把它限制在最多 3 份 css 的固定叠序内。

### Fork vs Compose（cascade model 下自然支持）

| Path | Cascade 表达 |
|---|---|
| **Fork** | L3 整 layer 完全独立；不 inherit L2；只 inherit L1 fallback（如 my-theme 不基于任何 L2，从零写） |
| **Compose** | L3 inherit L2 的某个 built-in theme；只 override 想改的 attribute |
| **From-scratch** | L3 从零写但选择是否继承 L1 default attribute |

详 [theme-system-author-view.md] 三 path 实操。

## L0 hard invariants（不可被任何 layer override）

L0 分两层，enforcement 模式不同（reviewer Finding 4 修订）：

### L0a — Algorithm core invariants（[ADR-0003]；register-time + runtime hard reject）

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
| **Interaction semantics 不可 override** | Keyboard binding / pointer behavior / gesture / drag state / insert flow / undo 不通过 theme cascade；theme 触碰 → reject |
| **Framework switcher fallback path（Finding 6）** | Framework 必须提供 accessible fallback switcher（settings page 固定入口 + 固定 keyboard shortcut）；theme 不可 override 掉；保 user 永远找得到切回入口 |

**L0a enforcement**：register-time（plugin contract 静态 check + runtime type guard）+ runtime（mutation 拦截 + violation report）。失败 → reject + 不静默 fallback。

### L0b — A11y baseline（framework-owned chrome 锁死 + harness validation；不试图 100% register-time reject）

| Invariant | 描述 |
|---|---|
| **Keyboard navigability** | 全键盘可操作；Tab / Shift+Tab focus 流转；Enter / Esc 标准交互 |
| **ARIA roles + labels** | Block / handle / palette / switcher 必须有 ARIA role + accessible label |
| **Focus order** | 视觉 order 跟 DOM tab order 一致 |
| **WCAG AA color contrast** | 文字 / 图标 vs 背景对比 ≥ AA 标准（normal text 4.5:1 / large 3:1） |
| **Touch target ≥44pt** | 任何可交互元素 touch target 最小 44pt（per Apple HIG / Material baseline） |
| **Screen reader announcement** | 状态变化（mode 切换 / theme 切换 / selection 改变）必须有 announcement |

**L0b enforcement 路径**（M2 → M3 → Phase 2+ 分层承诺）：

| Stage | Enforcement 方式 |
|---|---|
| **M2** | Framework-owned chrome（switcher / palette default / 通用 handle / 通用 status announcer）必须满足 L0b；3 built-in theme 通过 axe-core / pa11y 单测 + manual a11y review |
| **M3** | A11y validation harness ship（axe-core + screen reader smoke test + keyboard navigability smoke test）；任何新 theme（含 built-in pass 2）register 前必须过 harness |
| **Phase 2+** | 第三方 theme certification before public ship；harness 集成到 CI / pre-publish step |

**Key trade-off**：L0a 锁死可 register-time + runtime 100% reject；L0b 因 React rendering 的特性无法 100% 静态 reject——必须靠 harness + cert。这条**不是承诺降级**，是真实的 enforcement boundary。详 Surfaced ADR debts L0 enforcement layer 机制。

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
| [theme-system-user-view.md] | Note author / reader（产品 user） | 3 built-in theme user-observable behavior + switching + persistence + notepage metadata override + a11y baseline 在 user 视角的 manifestation |
| [theme-system-author-view.md] | Theme 开发者（developer-user） | Cascade override 怎么写 + fork / compose / from-scratch path + 每 layer 能改什么 + L0 enforcement experience + scaffolding |

## Cross-feature seams

Theme system 跟其他 feature 协同：

| Adjacent feature | Theme system 跟它的接触面 |
|---|---|
| [notepage.md] | Theme 在 notepage 上 render；切 theme 不破 notepage cross-cutting invariants |
| [notepage-editing.md] | Theme 的 affordance default 决定 edit mode 的 user-observable form factor（palette / handle / drag visual） |
| [notepage-view.md] | Theme 在 view mode 渲染；notepage metadata override theme 影响 SSR |
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

- 4-layer cascade work：**L1 framework default 完整 + L2 3 built-in theme 各自可用**；**L3 contract reserved 但不 M2 lock**（contract finalize 在 M3+ 或 Phase 2+ third-party 开放前；reviewer Finding 5 修订）
- **L0a algorithm hard invariants** register-time + runtime enforce（GridState / 12-col / gravity / AABB / hole-fill / move 保 size / Interaction semantics 不可 override / Switcher fallback path）
- **L0b a11y baseline** M2 范围：framework-owned chrome 必须满足（switcher / palette default / 通用 handle / status announcer）+ 3 built-in theme 通过 axe-core / pa11y 单测 + manual a11y review（reviewer Finding 4 修订；M3 加 harness，Phase 2+ 加第三方 cert）
- Theme switching 跨 mode + 不丢 state
- Persistence work（**notepage metadata override** + user pref + framework default 三层优先级；详 [theme-system-user-view.md]）
- 3 built-in theme 视觉差异明显 + 都通过 WCAG AA contrast

### M3 — a11y harness + author path + L3 contract finalize

- **A11y validation harness ship**（axe-core + screen reader smoke test + keyboard navigability smoke test）；任何新 theme（含 built-in pass 2）register 前必须过 harness（reviewer Finding 4 修订）
- **L3 ThemePlugin contract finalize**（M2 reserved 之后这里 lock；待 ADR-0014 ThemePlugin specialization 落地）
- L3 author authoring path 验证（fork / compose / from-scratch 各 demo work）
- Theme scaffolding CLI（如 author-view PRD 落地）work
- Cascade conflict reporting work（L0 violation 时 user 看到清晰错误）

### M4 — production polish

- 5 deploy mode 下 theme system 都 work（含 Workers runtime constraint）
- Theme uninstall + fallback workflow
- L3 third-party theme 兼容性测试 baseline（internal dogfood；外部开放仍 Phase 2+）

### Phase 2+

- **第三方 L3 theme 公开开放**（外部 author 可 submit theme + 走 certification harness + 上 marketplace）
- Theme marketplace
- GUI theme editor (no-code customization)
- Per-block theme override
- Auto dark/light mode
- Third-party theme certification suite（含 a11y / cascade compliance / performance budget）

### Phase 2+ — Deferred: theme 简化 / skin 统一 / asset pipeline（unified-block-capability 北极星；durably 记录）

以下条目来自架构设计 spec §9 deferred 清单，已被三处 durable 归宿锁住（spec + 本 PRD + [ADR-0029]），不会随时间消失。当前 slice 只移 block frame 盒（`shells → skins`）；以下是留给未来 UI-plugin pass 的 theme 侧工作。

| Deferred item | 含义 | Spec ref |
|---|---|---|
| **Theme full simplification** | 把 `CanvasSurface` / `PageTitle` 移出 theme → theme = 纯 material（tokens + `globalCss` + `skins` + palettes）；当前 slice 后 theme 仍含这两个结构槽，完整简化随 UI-plugin pass | [spec §8](../../../../superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md) |
| **Skin unification** | `papers`（页面表面）+ `palettes`（配色变体）+ block `skins` 并入单一 skin 概念；可能独立 skin pack；当前 slice 只统一 block skin（原 `shells`） | [spec §5](../../../../superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md) |
| **Theme asset pipeline** | theme 打包字体 / 图片*文件*（`paper.png` 等）；今天仅 inline / data-URI；需要独立 asset 投递基建 | [spec §5](../../../../superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md) |

完整北极星上下文见 spec + [ADR-0029](../../../../engineering/decisions/ADR-0029-host-frame-core-blockskin.md) "Deferred / north-star" 节。

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
4. **Theme uninstall 时 notepage metadata override = 此 theme 怎么 fallback？**—— L3 uninstall → L2 default fallback？user pref override？需要 UX 决策

## Surfaced ADR debts

本 PRD 触发的 ADR 层 framing 问题（reframe round 2 candidates）：

- **[ADR-0016] theme system carrier GAP（hard，已 surface in 原 notepage-themes）**: 本 PRD 进一步明确 carrier ADR 必须 cover：4-layer cascade model / L0 hard invariants enforcement / per-attribute override / fork-friendly module structure。**Action**: carrier ADR rework 时 cover 本 PRD requirements
- **L0 enforcement layer 机制 (new)**: PRD mandate L0 必须 enforce + violation 必须 report；但**怎么 enforce** 没决策（compile-time TS check / runtime check / sandbox guard / 多层组合）。**Action**: 新 ADR 或扩 [ADR-0011] sandboxing 时 cover
- **Interaction extension internal ordering (new; reviewer SR1 修订)**: 当 user 同时装多个 future interaction extension（如 third-party keymap + gesture extension），谁优先？提议：installed extension stack 内部按 install order 或 explicit priority；**theme 不参与此优先级**（theme 已 narrow 到 presentation only，不 override interaction）。**Action**: 归 future plugin-system / interaction-extension sub-PRD 决策；本 PRD（theme-system）的 cascade 只讨论 presentation attribute ordering，不涉及 interaction priority
- **Presentation cascade override ordering (内部)**: theme cascade 自身的 L0 → L1 → L2 → L3 顺序已在 4-layer cascade model 段定义；per-attribute override；fallback 自动。**Action**: 无需新 ADR；ADR-0016 carrier 时 verify 一致
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
- 2026-06-12 **放权方向注记**：owner 口头裁定——chrome 结构与页面骨架大概率放权（"插件作者尽量不给太多限制"）；当前 token-only 跟随是实现进度非产品立场；chrome 结构槽位契约待 MVP-7 UI 分叉研究积累形态样本后再冻结。详 mvp7-scope-2026-06-12.md M7-D5
- 2026-06-12 **层占据模型 ratified**：owner 裁定——cascade 各层由插件占据（一层或多层）、user 按层组合；vanilla 地板不可卸；同层单选不合并（同层多包自由堆叠 considered-and-rejected：工程灾难）；三档覆盖度契约（材质包 L3 / 主题包 L2 / UI 包 L1）。源于 Minecraft 资源包模型讨论（fall-through 吸收、自由堆叠拒绝、数据/代码二分入 enforcement 框架）。详 mvp7-scope-2026-06-12.md M7-D8
