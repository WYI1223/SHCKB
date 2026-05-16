# Feature PRD: Notepage editing

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-16 |
| Owner | W_YI |
| Parent | [notepage.md] |

## Overview

Author 在 notepage 上的**编辑体验** —— 把 block 放上去、调位置、改大小、删除。Notepage 的核心生产力 surface。

本 PRD 锁的是 **edit mode 下的 user-observable 行为**：insert / move / resize / delete intent；视觉 affordance（drop preview / drag handles / palette / selection）；edit-specific keyboard navigation；author-side edge cases。

不锁：reader 行为（→ [notepage-view.md]）、theme 切换（→ [notepage-themes.md]）、mobile / tablet 投影（→ [notepage-responsive.md]）、单 block 内部编辑细节（→ [ADR-0013]）、agent 操作（→ [ai-integration.md]）。

## User stories（author-focused）

- As a **note author**, I want to **拖一个新 block 到 notepage 空区域**，so that **我可以快速搭起一篇笔记的骨架**
- As a **note author**, I want to **看到拖动时的 snap preview**，so that **我知道松手后 block 会落在哪**
- As a **note author**, I want to **block 落到太小的 hole 时自动缩到 hole size**，so that **我不必先精确测量 hole 再决定 block size**
- As a **note author**, I want to **删除一个 block 后，下方 block 自动上移**，so that **canvas 不留意外空隙；视觉一致**
- As a **note author**, I want to **拖 block 重新摆位**，so that **我可以调整笔记结构**
- As a **note author**, I want to **拉边缘改 block 大小**，so that **我可以让重要内容更大、辅助内容更小**
- As a **note author**, I want to **键盘上下左右选邻居 block + Enter 进入编辑**，so that **不依赖鼠标也能用**
- As a **note author**, I want to **删除时有 visual confirmation**，so that **误删 visible recoverable**

## Functional requirements

### Must (Day-1, M2)

- **Insert intent**:
  - 拖 block 到 notepage 空区域 → 显示 snap preview → 松手 commit
  - 拖到空 hole 时 block 大小被 clamp 到 `min(default, hole_max)`；hole 太小 (`< 1×1`) → reject 并显示原因
  - Insert 入口至少 2 种：toolbar palette（点 block kind 添加）/ 拖 from palette
- **Move intent**:
  - 拖已有 block 到新位置 → snap preview → 松手 commit
  - 目标位置 overlap 另一 block → reject 反馈（红色 outline 或 toast）
- **Resize intent**:
  - 选中 block 后从边缘 / 角拉 → discrete snap（整数 col/row）
  - Resize 后若 overlap 邻居 → reject；若 shrink → 邻居 gravity 上移
- **Delete intent**:
  - 选中 block + Delete 键 / context menu 删除 → block 立刻消失 → 下方 block gravity 上移
- **Gravity behavior（user-observable）**:
  - 每个 mutating action 后 notepage 永远 "gravity-stable" —— 没有浮空 block（per [ADR-0003] induction 4 / Option A）
  - 用户视角："block 在重力下沉到能下沉到的最高位置"
- **Visual affordance**:
  - Selected block 显式 outline（distinct color）
  - Drag in flight 时 block 半透明 + snap preview 显示 target region
  - Resize handles 显式 visible on hover / focus（不是 always-on）
  - Palette UI：toolbar 一行显示可加 block kinds（icon + name）
- **Edit keyboard navigation**:
  - Tab / Shift+Tab 在 block 间移焦点
  - 方向键在邻居 block 间移焦点（geometric neighbor 不是 list order）
  - Enter 进入选中 block 的 EditView（详 [ADR-0013] / 各 plugin）
  - Esc 退出 EditView 回到 notepage 焦点
  - Delete 删选中 block
  - Ctrl/Cmd+A：select all blocks（如启用 multi-select）

### Should (Day-1 if scope allows)

- **Drop preview 显示具体 size**（不只是位置，hole-fill 视觉化）
- **Undo / redo**（Ctrl/Cmd+Z / Y）—— scope TBD（见 Open questions）
- **Block context menu**（右键 / 三点）：duplicate / move to top / move to bottom

### Nice-to-have (Phase 2+)

- **Multi-select**（多 block 同时拖 / 删 / resize 同步）
- **Block alignment guides**（拖时显示与邻居对齐的辅助线）
- **Snap to other block edges**（除 grid snap 外的对齐）
- **Block group / nesting** —— [ADR-0003] induction 3 不支持

## Non-functional requirements

- **Performance**:
  - Drag feedback < 16ms（60fps；per [ADR-0010] SLO）
  - Insert / move / resize op 端到端（含 server roundtrip）< 200ms p95（per [ADR-0010]）
- **Accessibility**:
  - 全键盘可操作（无 mouse 也能完成 insert / move / resize / delete）
  - Block focus 有 ARIA label（"Block 3 of 8, markdown, 12×2"）
  - Screen reader announce mutation 结果（"block moved to row 5"）
  - 颜色对比度满足 WCAG AA
- **Persistence latency**: edit 后 < 5s 内 commit 到 server；fail 时本地缓存重试

## Non-goals

- ❌ **View mode** —— 归 [notepage-view.md]
- ❌ **Theme system** —— 归 [notepage-themes.md]
- ❌ **Mobile / tablet 投影** —— 归 [notepage-responsive.md]
- ❌ **Block 内部 prose-flow 编辑细节** —— 归 [ADR-0013] / 各 plugin EditView
- ❌ **Block kind enumeration** —— 归 [plugin-system.md]

## Acceptance criteria

### M2 acceptance

- Author 能从空白 notepage 开始，通过 palette 加 markdown block，拖到 notepage 任意位置，编辑文本，刷新页面后内容还在
- 拖 / resize / delete 三个 intent 完整 work；gravity 正确触发；overlap reject 正确反馈
- 键盘 a11y baseline：Tab + 方向键 + Enter + Esc + Delete 五键 work

### M3 acceptance

- 至少 5 个 block kind 可插入 / 编辑（具体 kinds 详 [plugin-system.md]）
- Drop preview / snap visualization polish
- Block context menu shipped

### M4 acceptance

- 所有 9 个内置 block kind 在 notepage 上可编辑
- Undo / redo（如启用）shipped

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Notepage 完全空 | 显示 "draft 帮助 affordance"（小提示拖第一个 block；palette 默认 open） |
| Notepage 满（无可用 hole 容纳新 block） | Insert reject + UI 提示 "no space; resize 或 delete 某 block" |
| 拖到 cursor out of bounds | snap preview 显示 reject 状态（红色 outline） |
| Resize 到 < 1×1 | Reject + UI 提示 invalid span |
| Resize 把邻居挤出 grid | Reject，邻居不动 |
| 拖 in flight 时 server 失败 | UI rollback 到拖前状态 + toast 错误原因 |
| 拖时网络断 | 本地 optimistic update + 重连后 server reconcile；冲突走 last-write-wins |
| 同 notepage 多 tab 打开同时编辑 | Last-write-wins；UI 不显式提示冲突（Day-1 简化；per [notepage.md] non-goals） |
| 选中 block 时 owner 被取消 auth | Edit 控件 disabled；提示 "session 过期，请重新登录" |

## Dependencies

- **ADRs**:
  - [ADR-0003](../../../engineering/decisions/ADR-0003-grid-engine-contract.md) — gravity / drop intent / AABB invariants
  - [ADR-0013](../../../engineering/decisions/ADR-0013-markdown-tile-editor.md) — EditView 内编辑
  - [ADR-0014](../../../engineering/decisions/ADR-0014-plugin-contract.md) — defaultSize / EditView / RenderView contract
  - [ADR-0009](../../../engineering/decisions/ADR-0009-api-style.md) — mutation endpoints
  - [ADR-0010](../../../engineering/decisions/ADR-0010-performance-budget.md) — drag fps / op latency
- **Parent PRD**: [notepage.md](./notepage.md)
- **Sibling PRDs**: [notepage-view.md](./notepage-view.md) / [notepage-themes.md](./notepage-themes.md) / [notepage-responsive.md](./notepage-responsive.md)
- **Other PRDs**: [plugin-system.md](../plugin-system/plugin-system.md) / [authentication.md](../authentication/authentication.md)

## Open questions

1. **Undo / redo scope**: per-block edit 内部 undo (Lexical SoT) vs notepage-level undo (GridState history) 合并还是各管各？
2. **Multi-select Day-1 or Phase 2+**: 用户做 5 块 markdown 笔记可能不需要；做 dashboard 可能需要批量调整。倾向 Phase 2+
3. **Drag handles 位置**: 整 block 拖（任意点击 + drag）vs 专门 drag handle（block 角 / 顶部 bar）？影响 EditView 内 click target 冲突
4. **空 notepage 第一行 affordance**: 自动 open palette / 显式 "添加你的第一个 block" prompt / 完全空？影响 onboarding
5. **Palette UI 位置**: toolbar 顶部 / floating sidebar / context menu?

## Surfaced ADR debts

- **Undo / redo scope GAP**: 现有 ADR 集（[ADR-0003] / [ADR-0013] / [ADR-0014]）都没明确 undo / redo 形态。**Action**: 视 Open question 1 拍后开新 ADR 或归 [ADR-0013]
- **Multi-tab 冲突策略 GAP**: Edge case 写了 "last-write-wins，UI 不显式提示"，[ADR-0002] / [ADR-0009] 没显式说 conflict detection。**Action**: audit [ADR-0002] / [ADR-0009] 时 verify

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

- Parent: [notepage.md](./notepage.md)
- Source PRD pre-split: features/canvas-editing.md（已删；history 在 git）
- Audit: [AUDIT-2026-05.md](../../../engineering/decisions/AUDIT-2026-05.md)
- Doc convention: [doc-conventions.md](../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft；从 features/canvas-editing.md 拆出 edit-specific 内容；theme / responsive / view 分离到 sibling sub-PRDs
