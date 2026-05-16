# Feature PRD: Notepage editing

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-16 |
| Owner | W_YI |
| Parent | [notepage.md] |

## Overview

Author 在 notepage 上的**编辑体验** —— 把 block 放上去、调位置、改大小、删除。Notepage 的核心生产力 surface。

本 PRD 锁的是 **edit mode 下 user-observable 的 WHAT**：insert / move / resize / delete intent 的用户行为期望、算法层 invariants（per prototype 验证）、可访问性 baseline、author-side edge cases。

**不锁** UI HOW（selection 用 outline / toast 还是 inline / drag 半透明 / 等具体视觉选择都是 dev/theme 层决策）。

不锁：reader 行为（→ [notepage-view.md]）、theme 切换（→ [notepage-themes.md]）、mobile / tablet 投影（→ [notepage-responsive.md]）、单 block 内部编辑细节（→ [ADR-0013]）、agent 操作（→ [ai-integration.md]）。

## User stories（author-focused）

- As a **note author**, I want to **拖一个新 block 到 notepage 空区域**，so that **我可以快速搭起一篇笔记的骨架**
- As a **note author**, I want to **看到拖动时的视觉 snap preview**，so that **我知道松手后 block 会落在哪**
- As a **note author**, I want to **block 落到太小的 hole 时自动缩到 hole size**，so that **我不必先精确测量 hole 再决定 block size**
- As a **note author**, I want to **拖已有 block 重新摆位，size 保持不变**，so that **调整结构不被自动缩 size 干扰**
- As a **note author**, I want to **拉边缘 / 角改 block 大小**，so that **我可以让重要内容更大、辅助内容更小**
- As a **note author**, I want to **删除一个 block 后，下方 block 自动上移**，so that **canvas 不留意外空隙；视觉一致**
- As a **note author**, I want to **键盘也能完成 insert / move / resize / delete**，so that **不依赖鼠标也能用**
- As a **note author**, I want to **操作失败时知道为什么**（如 "无法放置：与 X 重叠"），so that **我能调整 / 重试**

## Functional requirements

### Must (Day-1, M2) — Algorithm contract（prototype-validated）

这些是 [ADR-0003] grid-engine + prototype（[grid-engine CONTRACT.md] / `useGridInteraction.ts`）已 validated 的算法层 invariants。PRD 不重定义，**实现必须 match**：

- **Insert hole-fill**: 拖入空 hole 时调用 `inferDropIntent(state, cursor, kind)` 返回 `{ col, row, colSpan, rowSpan }`；新 block 大小被 clamp 到 `min(default, hole_max)`；hole 太小不可放 → intent === 'reject'
- **Move 保 size**: 拖已有 block，新位置 probe **不**走 hole-fill clamp；保 source block 原 colSpan/rowSpan
- **Resize 6 axes**: 4 边（right / left / top / bottom）+ 2 角（corner = 右下 / top-left = 左上）；left / top / top-left 走 **atomic transform**（col + colSpan 或 row + rowSpan 一起改）
- **Gravity Option A**: 每个 mutating op 后 state 永远 gravity-stable（per [ADR-0003] induction 4）
- **Invalid op = silent no-op**: 任何 invariant 破坏（overlap / out-of-bounds / 等）→ `OpResult.ok=false` → state 不动（**用户如何被告知是 dev/theme 层；本 PRD 只 mandate "用户 must 知道操作失败"，不 mandate 用什么 UI**）

### Must (Day-1, M2) — User behavior expectations

PRD 层 user-observable 期望；HOW 是 dev/theme 决定：

- **Insert 入口**: 至少一种通过 palette 添加 block 的方式（form factor / 交互方式 dev/theme 决定）
- **拖动反馈**: drag 进行中 user 看到 snap preview（target region + valid/reject 区分；具体视觉 dev/theme 决定）
- **Move 完成性**: 拖到合法位置 → 松手后 block 在新位置；拖到非法位置 → block 留在原位 + user 知道为什么
- **Resize 完成性**: 拉边角 → 松手后 size 变；非法 → 不变 + user 知道为什么
- **Delete affordance**: 选中或聚焦某 block 后能触发删除；删除立即生效；下方 block gravity 上移可见
- **Reject feedback**: 任何 invariant 破坏的操作 → user 必须感知到失败 + 至少有一种途径理解为什么（toast / inline / banner / etc. dev/theme 决定）
- **Mode 切换不丢 state**: edit ↔ view 切换 / theme 切换 / viewport resize 不丢编辑中的 GridState、不丢 focus / scroll position（per [notepage.md] cross-cutting invariant）

### Must (Day-1, M2) — Accessibility baseline

- 全 keyboard 可操作：无 mouse 也能完成 insert / move / resize / delete（具体 key bindings dev/theme 决定，**应遵循 OS + Web 标准约定**——Enter / Esc / Tab / 方向键 / Delete 等惯例）
- 可被 screen reader 识别：block 有 ARIA label（包含 kind / 位置 / size 信息）；mutation 结果应可被 screen reader announce（具体 announcement 文本 dev 决定）
- 颜色对比度满足 WCAG AA（应用于所有 visual affordance；具体颜色 theme 决定）
- Touch target 大小满足 WCAG AAA（≥ 44×44 px on touch device）

### Should (Day-1 if scope allows)

- **Undo / redo**: scope TBD（详 Open questions）
- **Drop preview 显示具体 reject 原因**: 不只是颜色区分，文字 / icon 等辅助识别（form dev/theme 决定）

### Nice-to-have (Phase 2+)

- **Multi-select**（多 block 同时拖 / 删 / resize 同步）
- **Block alignment guides**（拖时显示与邻居对齐的辅助线）
- **Snap to other block edges**（除 grid snap 外的对齐）
- **Block group / nesting** —— [ADR-0003] induction 3 当前不支持

## Out of PRD scope (dev / theme decisions)

以下属于实现层决策，**本 PRD 不规定**；不同 theme / 不同 implementation 可以选不同形态：

| Concern | 例子（不是规定）|
|---|---|
| Palette form factor | toolbar 一行 / floating chip / sidebar drawer / context menu / slash command / etc. |
| Selection visual | outline / glow / background tint / shadow / etc. |
| Reject feedback UI | toast / inline error banner / status line / 仅颜色区分 / etc. |
| Drag in-flight visual | 半透明 / 自定 drag image / 默认浏览器 image / etc. |
| Resize handle visibility | always-visible / hover-only / focus-only / etc. |
| Resize handle 视觉 | bar / dot / 角块 / etc.（prototype 用 bar + 角块）|
| Specific keyboard bindings | "Tab 选下个 block" / "j/k 上下移动" / 等具体 keymap |
| Block focus visual | border / shadow / arrow indicator / etc. |
| Palette block kind 排序 | alphabetical / usage-frequency / category-grouped / etc. |
| Drag handle 位置（block 上哪一块区域可拖）| 整 block / top bar / 角点 / etc. |

**Theme extensibility**: 第三方 theme（[notepage-themes.md] Phase 2+ extensibility）可以选择以上任意形态；PRD 只保证 user behavior 在所有 theme 下一致。

## Non-functional requirements

- **Performance**:
  - Drag feedback < 16ms（60fps；per [ADR-0010] SLO）
  - Insert / move / resize op 端到端（含 server roundtrip）< 200ms p95（per [ADR-0010]）
- **Accessibility**: 详 Must section 第三项
- **Persistence latency**: edit 后 < 5s 内 commit 到 server；fail 时本地缓存重试

## Non-goals

- ❌ **View mode** —— 归 [notepage-view.md]
- ❌ **Theme system** —— 归 [notepage-themes.md]
- ❌ **Mobile / tablet 投影** —— 归 [notepage-responsive.md]
- ❌ **Block 内部 prose-flow 编辑细节** —— 归 [ADR-0013] / 各 plugin EditView
- ❌ **Block kind enumeration** —— 归 [plugin-system.md]
- ❌ **具体 UI 实现选择** —— 详上面 "Out of PRD scope"

## Acceptance criteria

### M2 acceptance

- Author 能从空白 notepage 开始，通过 palette 加 markdown block，拖到 notepage 任意位置，编辑文本，刷新页面后内容还在
- 拖 / resize / delete 三个 intent 完整 work；gravity 正确触发；invariant 破坏的操作 silent no-op + user 感知失败
- 算法 contract 全 match prototype（hole-fill / move 保 size / 6 resize axes / atomic transform / Option A）
- Keyboard a11y baseline：无 mouse 能完成所有 op；screen reader 可识别 block 结构

### M3 acceptance

- 至少 5 个 block kind 可插入 / 编辑（具体 kinds 详 [plugin-system.md]）
- Reject feedback 文字辅助识别（如 Should 落地）

### M4 acceptance

- 所有 9 个内置 block kind 在 notepage 上可编辑
- Undo / redo（如启用）shipped

## Edge cases

| 场景 | 期望行为（user-observable）|
|---|---|
| Notepage 完全空 | User 能识别可以加 block（具体 affordance：自动 open palette / hint / 空 canvas 上的 placeholder / dev 决定）|
| Notepage 满（无可用 hole 容纳新 block）| Insert 操作失败 + user 知道原因 |
| 拖到 cursor out of bounds | Visual reject feedback；松手后 block 留原位 |
| Resize 到 < 1×1 | Reject + user 知道 invalid span |
| Resize 把邻居挤出 grid | Reject，邻居不动 |
| 拖 in flight 时 server 失败 | UI rollback 到拖前状态 + user 知道失败原因 |
| 拖时网络断 | 本地 optimistic update + 重连后 server reconcile；冲突走 last-write-wins |
| 同 notepage 多 tab 打开同时编辑 | Last-write-wins；UI 不显式提示冲突（Day-1 简化；per [notepage.md] non-goals） |
| 选中 block 时 session 被取消 | Edit 操作 disabled；user 知道需重新登录 |

## Dependencies

PRD 层 upstream 依赖（ADR / CONTRACT / prototype 是 downstream，归 References 段）：

- **Parent PRD**: [notepage.md](./notepage.md)
- **Sibling PRDs**: [notepage-view.md](./notepage-view.md) / [notepage-themes.md](./notepage-themes.md) / [notepage-responsive.md](./notepage-responsive.md)
- **Other feature PRDs**: [plugin-system.md](../plugin-system/plugin-system.md)（提供 block kinds + EditView contract）/ [authentication.md](../authentication/authentication.md)（提供 edit 权限）
- **External services**: 无 Day-1 外部依赖

## Open questions

1. **Undo / redo scope**: per-block edit 内部 undo (Lexical SoT) vs notepage-level undo (GridState history) 合并还是各管各？
2. **Multi-select Day-1 or Phase 2+**: 用户做 5 块 markdown 笔记可能不需要；做 dashboard 可能需要批量调整。倾向 Phase 2+

## Surfaced ADR debts

- **Undo / redo scope GAP**: 现有 ADR 集（[ADR-0003] / [ADR-0013] / [ADR-0014]）都没明确 undo / redo 形态。**Action**: 视 Open question 1 拍后开新 ADR 或归 [ADR-0013]
- **Multi-tab 冲突策略 GAP**: Edge case 写了 "last-write-wins"，[ADR-0002] / [ADR-0009] 没显式说 conflict detection。**Action**: audit [ADR-0002] / [ADR-0009] 时 verify
- **Keyboard a11y baseline 没在 prototype validated**: prototype 完全 mouse-only；keyboard a11y 是 Day-1 production mandate 但没 implementation reference。**Action**: M2 实装时单独 prototype keyboard interaction layer + 验证

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，**必须 align 本 PRD**。任何 ADR ↔ PRD 不一致 → ADR rework（详 [AUDIT-2026-05.md] 流程）。

- **Aligning ADRs**（technical realization of this PRD's WHAT）:
  - [ADR-0003](../../../engineering/decisions/ADR-0003-grid-engine-contract.md) — gravity / drop intent / AABB invariants（核心算法承诺）
  - [ADR-0013](../../../engineering/decisions/ADR-0013-markdown-tile-editor.md) — EditView 内编辑
  - [ADR-0014](../../../engineering/decisions/ADR-0014-plugin-contract.md) — defaultSize / EditView / RenderView contract
  - [ADR-0009](../../../engineering/decisions/ADR-0009-api-style.md) — mutation endpoints
  - [ADR-0010](../../../engineering/decisions/ADR-0010-performance-budget.md) — drag fps / op latency
- **Contract**: [grid-engine CONTRACT.md](../../../../packages/grid-engine/CONTRACT.md)
- **Frozen DI**: [grid-redesign-2026-05-11.md](../../../engineering/design/_frozen/grid-redesign-2026-05-11.md) §3 + §4
- **Prototype reference**（validated algorithm core; UI choices not normative）:
  - `carryover/_reference/prototype/useGridInteraction.ts` — drag/resize state machine
  - `carryover/_reference/prototype/shared-overlays.tsx` — DropGhost / ResizePreview / ResizeHandles 视觉 semantics
  - `carryover/_reference/prototype/MiniPalette.tsx` — palette drag-insert flow（form factor not normative）
- **Audit**: [AUDIT-2026-05.md](../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc convention**: [doc-conventions.md](../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft；从 features/canvas-editing.md 拆出 edit-specific 内容
- 2026-05-16 pass 2 (owner review against prototype): WHAT vs HOW 边界 sharpen ——
  - Algorithm contract 与 prototype 验证对齐显式标注（6 resize axes / atomic transform / move 保 size / hole-fill / Option A）
  - 删除 implementation prescriptions（outline / toast / 半透明 / 具体 keymap / toolbar palette / handle visibility）—— 都是 dev/theme 层决策
  - 新增 `Out of PRD scope (dev / theme decisions)` 段显式列 10 个 HOW concern
  - User stories / Functional req Must / Edge cases 改 user-observable WHAT 表述，去 UI 实现细节
  - Keyboard a11y baseline 保留但不规定 specific bindings；标记 prototype 未 validated → AUDIT 新增 debt
  - Theme extensibility 显式：第三方 theme 可选不同 palette form factor / handle visual / 等
- 2026-05-16 pass 3 layer relationship fix（owner critical framing）：Dependencies 段只列 upstream PRD deps；ADRs / Contract / Prototype 移到 References "Aligning ADRs" 段（PRD 是 master，ADR 是 downstream）
