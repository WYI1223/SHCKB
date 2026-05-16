# Feature PRD: Notepage responsive

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-16 |
| Owner | W_YI |
| Parent | [notepage.md] |

## Overview

Notepage 跨 viewport（desktop / tablet / mobile）的**布局投影行为** —— canvas logical coord 永远 12-col（不动 GridState），responsive 12/6/1 col 是**纯 render projection**。

本 PRD 锁的是 **viewport projection 的 user-observable 行为**：3 个 breakpoint 投影规则、mobile 编辑能力限制、touch UX baseline、reader / author 跨 viewport 一致性。

不锁：CSS Grid 实现细节（→ [ADR-0016]）、虚拟化算法（Phase 2+）、引擎 GridState 形态（→ [ADR-0003]）。

## User stories

- As a **reader on mobile**, I want to **notepage 1-col 流式呈现**，so that **手机屏幕能看清内容**
- As a **reader on tablet**, I want to **notepage 6-col 半宽呈现**，so that **平板既看得清也利用空间**
- As a **author on desktop**, I want to **notepage 12-col native 编辑**，so that **有完整的 grid 操作空间**
- As a **author switching desktop ↔ mobile**, I want to **同一 notepage 看到不同投影**，so that **不需为 mobile 单独排版**
- As a **mobile reader**, I want to **block 内容自适应宽度**，so that **不被压缩到看不清**

## Functional requirements

### Must (Day-1, M2)

- **3 viewport breakpoints**:
  - **Desktop** (≥ 1024px): 12-col native；canvas 完整 grid 视觉
  - **Tablet** (640 - 1023px): 6-col projection；每 2 logical cols 合并为 1 render col（colspan ≤ 6）
  - **Mobile** (< 640px): 1-col 流式；block 按 row 顺序竖排
- **GridState 跨 viewport 不变**:
  - Engine 永远 logical 12-col（per [ADR-0003] induction 3 + Trade-offs）
  - Mobile 1-col 视图不是另一 engine state；是同一 GridState 的 render projection
  - Resize browser 跨 breakpoint 不动 data
- **Edit 能力跨 viewport 限制**:
  - Desktop: 完整 edit affordance（per [notepage-editing.md]）
  - Tablet: 完整 edit affordance（同 desktop）
  - Mobile: 编辑能力**限制**（read-mostly mode）；具体：
    - 不能 resize block（mobile 1-col 投影下 resize 无意义）
    - 移动 block 限制为 row-level reorder（拖到不同 row 间）
    - Insert / delete 仍可用
    - 显式提示 "完整 grid 编辑请用 desktop / tablet"
- **Touch baseline**（mobile / tablet）:
  - Tap to focus block
  - Long-press to enter EditView
  - Swipe to scroll（浏览器原生，不接管）
  - Pinch zoom 允许（浏览器原生）
- **Reader / author 同视图**:
  - 同一 viewport size 下 reader 和 author 看到的 layout 一致（只 affordance 不同）

### Should (Day-1 if scope allows)

- **Smooth breakpoint transition**: resize browser 跨 breakpoint 时不闪烁
- **Orientation change handling**: mobile 横屏 → 投影到 tablet 6-col
- **Print CSS**: print 时回退到 1-col 流式（per [notepage-view.md] Should）

### Nice-to-have (Phase 2+)

- **Touch gestures advanced**（pinch resize / two-finger drag / 等手机原生手势）
- **Custom breakpoint**（operator 配置 / per-notepage 配置）
- **Mobile-native edit affordance**（不再是 "limited edit"，是 mobile-first 重设计的 edit UX）
- **Tablet pen support**（Apple Pencil / Surface Pen 优化）

## Non-functional requirements

- **Performance**:
  - Lighthouse mobile score ≥ 90（per [ADR-0010]）
  - Mobile FCP < 1.5s on 3G
  - Tablet / desktop 切换流畅，无 visible reflow
- **Accessibility**:
  - Touch target ≥ 44×44 px（per WCAG）
  - 字体大小响应 viewport（不固定 px）
- **Compatibility**:
  - 320px 最小 viewport 支持
  - 4K 最大 viewport 支持
  - 主流 mobile / tablet browser（Safari iOS / Chrome Android / iPad Safari）

## Non-goals

- ❌ **Mobile-native edit UX rewrite** —— Phase 2+；Day-1 mobile 编辑能力受限是 accepted trade-off
- ❌ **GridState 改 column 数** —— per [ADR-0003] induction 3；breakpoint 不动 engine
- ❌ **Per-block responsive override**（如某 block 在 mobile 上隐藏）—— Phase 2+
- ❌ **Native app responsive**（iOS / Android app）—— per [project.md] non-goals

## Acceptance criteria

### M2 acceptance

- 3 breakpoint 投影 work：desktop 12-col / tablet 6-col / mobile 1-col
- Mobile reader Lighthouse 90+
- Mobile edit affordance 限制正确（resize disabled / move 简化）
- Resize browser 跨 breakpoint 不丢 GridState

### M3 acceptance

- Touch baseline polish（tap / long-press / 滚动平滑）
- Smooth breakpoint transition

### M4 acceptance

- Orientation change 平滑处理
- Print CSS shipped

## Edge cases

| 场景 | 期望行为 |
|---|---|
| User resize browser 跨 breakpoint mid-edit | 视觉 reflow；GridState 不变；edit 状态 preserve |
| Mobile 1-col 投影下 user 想 resize block | Resize handle disabled；显式提示 "请用 desktop / tablet 编辑 block 大小" |
| Mobile 投影下 block 内容超长 | Block 内容自适应宽度；如有溢出 → 横向 scroll 或 wrap（plugin RenderView 责任）|
| Tablet 横屏 → 6-col；竖屏 → 1-col？还是都 6-col？ | 倾向 viewport width 决定（不是 orientation）；竖屏 tablet 通常 600-800px → 6-col |
| Touch + mouse 同设备（touch laptop）| 同时支持；不强制选一种 |
| 4K 显示器 | 仍 12-col；canvas 整体 max-width 防止拉得太宽（如 1440px）|
| 用户禁用 JS（mobile）| SSR HTML 1-col 仍可读；交互降级 |

## Dependencies

- **ADRs**:
  - [ADR-0003](../../../engineering/decisions/ADR-0003-grid-engine-contract.md) — logical 12-col + Trade-offs（"logical coord vs render projection" 精确化）
  - [ADR-0010](../../../engineering/decisions/ADR-0010-performance-budget.md) — Lighthouse mobile 90+
  - [ADR-0016](../../../engineering/decisions/ADR-0016-css-framework.md) — Tailwind responsive utilities
- **Parent**: [notepage.md](./notepage.md)
- **Sibling**: [notepage-view.md](./notepage-view.md) / [notepage-editing.md](./notepage-editing.md)（都消费 responsive 投影）

## Open questions

1. **Mobile 编辑能力范围 Day-1**: 完全 read-only（不能 insert/delete/move）vs limited edit（可 insert/delete + row reorder，no resize）vs full edit？倾向 limited
2. **Tablet 是当 desktop 还是 mobile**：6-col 投影是 tablet 专属还是 mobile 平滑过渡？影响 breakpoint 定义
3. **触屏 detect 还是 viewport detect**：iPad pro 横屏 1024px+ 但是 touch；当 desktop 还是 tablet？倾向 viewport
4. **Print 算 viewport mode 还是单独 mode**：A4 portrait 770px → tablet projection？还是单独 print mode 强制 1-col？

## Surfaced ADR debts

- **Mobile resize disabled 决策位置**: 本 PRD 列为 Must 但 [ADR-0003] Trade-offs 没显式。**Action**: 决定 PRD-only（user-observable，归 PRD）还是要 [ADR-0003] 加 Trade-off 一行。倾向 PRD-only
- **Touch baseline 决策**: tap / long-press / swipe 三个手势是 PRD level user-observable 决策，但 implement detail 可能影响 [ADR-0014] EditView 触发机制。**Action**: 写 plugin contract / [ADR-0014] audit 时 verify EditView 触发能 cover touch path

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

- Parent: [notepage.md](./notepage.md)
- Audit: [AUDIT-2026-05.md](../../../engineering/decisions/AUDIT-2026-05.md)
- Doc convention: [doc-conventions.md](../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft；从 features/canvas-editing.md mobile responsive 段拆出 + 扩展（3 breakpoint / touch baseline / 跨 viewport 一致 / mobile 编辑限制）
