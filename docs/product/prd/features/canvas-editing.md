# Feature PRD: Canvas-based note editing

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-16 |
| Owner | W_YI |

## Overview

Note 不是 document-flow 页面，是 **constrained canvas**——内容以 tile（block）形式摆在 12 列 × N 行的网格底板上，约束（snap / gravity / no-overlap）做 affordance 不做 cage。User 在 edit mode 通过 cursor / drag / 键盘把 block 摆到 canvas 上、调整位置和大小；在 view mode 看到的是同样的 canvas，但没有编辑 affordance。

本 PRD 锁的是 **canvas 作为放置表面的 user-observable 行为**——insert / move / resize / delete intent、视觉反馈、theme 切换、selection、edit vs view mode、mobile 投影、键盘 / a11y。

**不**锁：什么 block kinds 存在（→ plugin-system.md）、单 block 内部如何编辑（→ ADR-0013 / 各 plugin EditView）、agent 怎么操作 canvas（→ ai-integration.md）。

## User stories

- As a **note author**, I want to **拖一个新 block 到 canvas 的空区域**，so that **我可以快速搭起一篇笔记的骨架**
- As a **note author**, I want to **看到拖动时的 snap preview**，so that **我知道松手后 block 会落在哪**
- As a **note author**, I want to **block 落到太小的 hole 时自动缩到 hole size**，so that **我不必先精确测量 hole 再决定 block size**
- As a **note author**, I want to **删除一个 block 后，下方 block 自动上移**，so that **canvas 不留意外空隙；视觉一致**
- As a **note author**, I want to **拖 block 重新摆位**，so that **我可以调整笔记结构**
- As a **note author**, I want to **拉边缘改 block 大小**，so that **我可以让重要内容更大、辅助内容更小**
- As a **note author**, I want to **在 3 个内置 theme 间切换**，so that **canvas 视觉跟我的偏好对齐**
- As a **note author**, I want to **键盘上下左右选邻居 block + Enter 进入编辑**，so that **不依赖鼠标也能用**
- As a **reader**, I want to **打开公开 note 看到清晰布局**，so that **没有编辑控件干扰阅读**
- As a **reader on mobile**, I want to **canvas 1-column 流式呈现**，so that **手机屏幕能看清内容**

## Functional requirements

### Must (Day-1, M2)

- **12-col × N-row canvas** —— note 的内容区域是固定 12 列、行无上界的网格底板（per ADR-0003）
- **Insert intent**:
  - 拖 block 到 canvas 空区域 → 显示 snap preview（block 会落在哪）→ 松手 commit
  - 拖到空 hole 时 block 大小被 clamp 到 `min(default, hole_max)`；如 hole 太小到 `< 1×1` → reject 并显示原因
  - Insert 入口至少 2 种：toolbar palette（点击加 block kind）/ 拖
- **Move intent**:
  - 拖已有 block 到新位置 → snap preview → 松手 commit
  - 目标位置 overlap 另一 block → 显示 reject 反馈（红色 outline 或 toast）
- **Resize intent**:
  - 选中 block 后从边缘 / 角拉 → discrete snap（整数 col/row）
  - Resize 后若 overlap 邻居 → reject；若 shrink → 邻居 gravity 上移
- **Delete intent**:
  - 选中 block + Delete 键 / context menu 删除 → block 立刻消失 → 下方 block gravity 上移
- **Gravity behavior**:
  - 每个 mutating action 后 canvas 永远 "gravity-stable" —— 没有浮空 block（per ADR-0003 induction 4 / Option A）
  - 用户视角："block 在重力下沉到能下沉到的最高位置"
- **Theme switching**:
  - 3 个内置 theme（`graph-paper` / `lego-studs` / `bento-canvas`）可切（per frozen DI grid-redesign §9）
  - 切换不动 data；只换 render
  - 用户偏好默认 per-user 记住；single note 可 frontmatter override（per frozen DI §9.1）
- **Edit mode vs view mode**:
  - Edit mode（author 自己在 own note）：完整 drag handles / resize handles / palette / 选择反馈
  - View mode（reader 看 public note OR author 浏览模式）：无编辑控件；block 仍按 GridState 渲染
- **Mobile responsive projection**:
  - Canvas logical coord 永远 12-col（per ADR-0003 induction 3 + Trade-offs）
  - Mobile viewport (< 640px) 视觉投影为 1-col 流式（block 按 row 顺序竖排）；**不**改 GridState
  - Tablet viewport (640-1024px) 视觉投影为 6-col
- **Keyboard navigation (a11y baseline)**:
  - Tab / Shift+Tab 在 block 间移焦点
  - 方向键在邻居 block 间移焦点
  - Enter 进入选中 block 的 EditView
  - Esc 退出 EditView 回到 canvas 焦点
  - Delete 删选中 block

### Should (Day-1 if scope allows)

- **Block selection 视觉**: focused block 显式 outline；selection 状态可以 keyboard 触发
- **Drop preview 显示具体 size**（不只是位置）—— hole-fill 视觉化
- **Undo / redo**（Ctrl/Cmd+Z / Y）—— scope TBD（见 Open questions）

### Nice-to-have (Phase 2+)

- **Multi-select**（多 block 同时拖 / 删）
- **Block alignment guides**（拖时显示与邻居对齐的辅助线）
- **Custom theme**（用户写自己的 theme；目前 closed registry per frozen DI §9.1）
- **Touch gesture**（pinch resize / two-finger drag 等手机原生手势）
- **Snap to other block edges**（除 grid snap 外的对齐）
- **Block group / nesting**（block 嵌 block）—— ADR-0003 induction 3 现在不支持

## Non-functional requirements

- **Performance**:
  - Drag feedback < 16ms（60fps；per ADR-0010 SLO）
  - Insert / move / resize op 端到端（含 server roundtrip）< 200ms p95（per ADR-0010）
  - Lighthouse mobile score ≥ 90 on view mode（CI gate；per ADR-0010）
- **Accessibility**:
  - 全键盘可操作（无 mouse 也可完成 insert / move / resize / delete）
  - Block focus 有 ARIA label（"Block 3 of 8, markdown, 12×2"）
  - Screen reader 能识别 canvas 结构
  - 颜色对比度满足 WCAG AA
- **Responsive**: 320px - 4K 全 viewport 范围可用
- **Persistence latency**: edit 后 < 5s 内 commit 到 server；fail 时本地缓存重试

## Non-goals

- ❌ **Real-time collaborative editing (CRDT)** —— per project.md non-goals；Day-1 单人编辑，冲突走 last-write-wins
- ❌ **Free continuous coordinates** —— per ADR-0003；canvas 是 discrete grid，不是 Figma
- ❌ **Block 内部 prose-flow 编辑细节** —— 归 ADR-0013（markdown editor）/ 各 plugin EditView
- ❌ **Plugin marketplace / theme marketplace** —— per project.md；Day-1 closed registry
- ❌ **Block kind enumeration** —— 归 plugin-system.md PRD
- ❌ **Note 跨链接 / wikilink** —— 单 note 内部 canvas behavior；跨 note 归 search-discovery.md PRD

## Acceptance criteria

### M2 (minimum shippable canvas-editing)

- Note author 能从空白 note 开始，通过 palette 加 markdown block，拖到 canvas 任意位置，编辑文本，刷新页面后内容还在
- 拖 / resize / delete 三个 intent 完整 work；gravity 正确触发；overlap reject 正确反馈
- 3 个 theme 切换功能 work；偏好持久化
- View mode 可访问；无编辑控件
- Mobile 1-col 投影 work；Lighthouse mobile score ≥ 90

### M3 acceptance

- 至少 5 个 block kind 在 canvas 上 work（具体 kinds 详 plugin-system.md）
- 键盘全 a11y baseline 完成
- Drop preview / snap visualization polish

### M4 acceptance

- 所有内置 9 个 block kind 在 canvas 上 work
- Undo / redo（如果走 Should）shipped

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Canvas 完全空 | 显示 "draft 帮助 affordance"（小提示拖第一个 block；或 palette 默认 open） |
| Canvas 满（无可用 hole 容纳新 block） | Insert reject + UI 提示 "no space; resize 或 delete 某 block" |
| 拖到 cursor out of bounds | snap preview 显示 reject 状态（红色 outline） |
| Resize 到 < 1×1 | Reject + UI 提示 invalid span |
| Resize 把邻居挤出 grid | Reject，邻居不动 |
| 拖 in flight 时 server 失败 | UI rollback 到拖前状态 + toast 错误原因 |
| Mobile 1-col 投影下 user 想 resize | Resize disabled on mobile；switch to landscape / desktop 提示 |
| Frontmatter theme override 跟 user pref 冲突 | Frontmatter 优先；UI 显示 "note 指定 theme: X"（per frozen DI §9.1） |
| 拖时网络断 | 本地 optimistic update + 重连后 server reconcile；冲突走 last-write-wins |
| 同 note 多 tab 打开同时编辑 | Last-write-wins；UI 不显式提示冲突（Day-1 简化） |

## Dependencies

- **ADRs**:
  - [ADR-0003](../../engineering/decisions/ADR-0003-grid-engine-contract.md) grid-engine — 核心 invariant + Option A gravity + hole-fill
  - [ADR-0013](../../engineering/decisions/ADR-0013-markdown-tile-editor.md) markdown tile editor — markdown block 内部编辑 UX
  - [ADR-0014](../../engineering/decisions/ADR-0014-plugin-contract.md) plugin contract — `BlockPlugin.defaultSize` / `EditView` / `RenderView`
  - [ADR-0016](../../engineering/decisions/ADR-0016-css-framework.md) CSS framework / theme — Tailwind + shadcn + grid-themes CSS vars
  - [ADR-0002](../../engineering/decisions/ADR-0002-substrate-db-backed.md) sessions（edit 权限通过 session 验证）
  - [ADR-0009](../../engineering/decisions/ADR-0009-api-style.md) API style — mutation endpoints
  - [ADR-0010](../../engineering/decisions/ADR-0010-performance-budget.md) performance budget — drag fps / Lighthouse / SLO
- **Other PRDs**:
  - [authentication.md](./authentication.md) — who can edit；session model
  - [plugin-system.md](./plugin-system.md) — 哪些 block kinds 存在；defaultSize 数值
- **External services**: 无 Day-1 外部依赖

## Open questions

1. **Undo / redo scope**: per-block edit 内部的 undo (Lexical SoT) vs canvas-level undo (GridState 历史) 是否合并？还是各管各？
2. **Multi-select Day-1 or Phase 2+**: 用户做 5 块 markdown 笔记可能不需要；做 dashboard 可能需要批量调整。倾向 Phase 2+，待 user testing
3. **Drag handles 位置**: 整 block 拖（任意点击 + drag）vs 专门的 drag handle（block 角 / 顶部 bar）？影响 EditView 内部 click target 冲突
4. **Theme switcher UI 位置**: floating chip 右下角（per frozen DI §9.1）vs 设置页 vs note frontmatter UI？三个不互斥
5. **空 canvas 第一行 affordance**: 自动 open palette / 显式 "添加你的第一个 block" prompt / 还是完全空？影响 onboarding 体验
6. **Reader 是否能看到 theme**: note frontmatter 指定 theme 是否同步给 reader？还是 reader 用自己 pref？倾向 frontmatter 同步（一致体验）

## Surfaced ADR debts

写本 PRD 触碰到的 ADR 漏洞 / 一致性问题，喂回 AUDIT-2026-05.md（footer 含 link）：

- **ADR-0016 GAP**: theme system carrier 仍未承接（frozen DI §9.1 锁了 GridTheme interface / registry / hybrid persistence / floating chip 位置；ADR-0016 是 CSS framework 决策，没承接 theme system）。本 PRD must 列了 theme switching，必须有 ADR 承载 theme system 实装路径。**Action**: 在 plugin-system / canvas-editing PRD 拉通后，决定 theme system 走哪条路径（ADR-0016 扩展 / 新 ADR / 等 first runtime theme switch impl）
- **ADR-0013 ↔ ADR-0003 边界 verify**: 本 PRD 多次描述 "EditView 进入 / 退出 / 内部" —— 这条 boundary（canvas 层不管 block 内部）已 sync 到 ADR-0003 induction 3，但 ADR-0013 自身可能还有 PM-doc-SoT 残留措辞（AUDIT 已标 PENDING）。**Action**: audit ADR-0013 时 verify "block 内部编辑器 SoT 跟 canvas SoT 二分清晰"
- **Undo / redo scope GAP**: 现有 ADR 集（0003 / 0013 / 0014）都没明确 undo / redo 形态。Should-tier 列了但 scope 未拍。**Action**: 视 Open question 1 拍板，可能开 new ADR（如复杂）或归 ADR-0013（如归编辑器 SoT）
- **Multi-tab 冲突策略 GAP**: 本 PRD Edge case 写了 "last-write-wins，UI 不显式提示" —— 但 ADR-0002 / ADR-0009 没显式说 conflict detection。**Action**: audit ADR-0002 / 0009 时验证 last-write-wins 是否真在架构假设里
- **Mobile resize disabled 决策**: Edge case 写了 "mobile 1-col 投影下 resize disabled"，但这条决策没在 ADR-0003（Trade-offs 段没提）。**Action**: 决定是 PRD-only 决策（user-observable，归 PRD），还是要 ADR-0003 加 Trade-off 一行。倾向 PRD-only

## References

- Source frozen DI: [grid-redesign-2026-05-11.md](../../engineering/design/_frozen/grid-redesign-2026-05-11.md) §3 + §9
- Project PRD: [project.md](../project.md)
- Audit register: [AUDIT-2026-05.md](../../engineering/decisions/AUDIT-2026-05.md)
- Doc cross-reference convention: [doc-conventions.md](../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft（Phase E Day-1 PRD 第一篇；为 ADR rework round 2 提供 trigger lens）
- 2026-05-16 cross-reference 风格 sync doc-conventions.md（in-text plain identifier，footer link 集中）
