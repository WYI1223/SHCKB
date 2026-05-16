# Feature PRD: Notepage themes

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-16 |
| Owner | W_YI |
| Parent | [notepage.md] |

## Overview

Notepage 的**视觉主题系统** —— 3 个内置 theme 改变 canvas 底板 + block 渲染视觉，但不动 data。Theme 跨 view + edit mode 一致；切换不丢 GridState。

本 PRD 锁的是 **theme system 的 user-observable 行为**：3 内置 theme 视觉、theme 切换 UI、persistence（user pref + frontmatter override）、reader / author 一致性。

不锁：底层 GridTheme interface 实现（→ [ADR-0016] 或 future render-system ADR）、theme registry 内部结构（→ CONTRACT）。

**本 PRD 直接 trigger AUDIT GAP**：`[ADR-0016]` theme system carrier 至今未承接 frozen DI [grid-redesign-2026-05-11.md] §9 LOCK；本 PRD 写完后 carrier 决策有 user-facing 依据。

## User stories

- As a **note author**, I want to **从 3 个内置 theme 中选我喜欢的**，so that **canvas 视觉跟我的偏好对齐**
- As a **note author**, I want to **theme 选择记住跨 session**，so that **不必每次 refresh 重选**
- As a **note author**, I want to **个别 notepage override 全局 theme**（如某篇笔记用 bento-canvas 因为是 dashboard 风格），so that **可以 per-note 调整**
- As a **reader**, I want to **看到 author 指定的 theme**（如 frontmatter override），so that **author 的视觉意图传达**
- As a **note author preview switching theme**, I want to **切 theme 立刻看到效果**，so that **基于实际效果决定，不是 isolated mockup**

## Functional requirements

### Must (Day-1, M2)

- **3 内置 theme**（per frozen DI [grid-redesign-2026-05-11.md] §9）：
  - `graph-paper`：60px slot；dotted 极淡 baseplate；1px 边 + 顶 stripe block；工程画布心智
  - `lego-studs`：80px slot；凸点显式 + cell 边框 baseplate；hue tint + 浅边 block；积木心智
  - `bento-canvas`：100px slot；默认隐藏 baseplate（drag 时显）；圆角 + shadow + hue header block；dashboard 心智
- **Default theme** = `lego-studs`（per frozen DI §9.1 — 对 grid 心智表达最直观）
- **Theme switcher 入口存在**: user 能切换 theme（form factor / 位置 / 是否可拖 等具体 UI 选择**由各 theme 自己决定**；frozen DI §9.1 提议右下角 floating chip 仅作 reference，不规定）
- **Theme 内 affordance 自治**: 每个 theme 可决定 palette form factor / handle visual / drag visual / selection visual / 等具体形态（per [notepage-editing.md] "Out of PRD scope"）—— theme 不只是 "换皮"，还包括 affordance 选择
- **Persistence hybrid**（per frozen DI §9.1）：
  - 默认 per-user：`localStorage['skb.grid.theme']`
  - 单 notepage 可 frontmatter override（`theme: bento-canvas`）
  - 优先级：frontmatter > user pref > default
- **Theme 跨 mode 一致**:
  - Author 在 edit 切 theme → 切到 view 看到同 theme
  - Reader 访问 notepage → 看到 frontmatter theme（如指定）或自己 pref
- **Theme 切换即时**:
  - 切换 < 100ms 视觉响应；不刷新页面
  - 不丢 GridState / 不丢 scroll / 不丢 selection

### Should (Day-1 if scope allows)

- **Theme switcher 进阶可用性**：可拖位置 / 可隐藏（form factor 仍 theme 决定；这条只是 user-observable 期望）
- **Theme 切换 transition**：CSS variable 切换 + 短 transition（200ms）平滑视觉变化
- **Theme preview tooltip**：hover switcher option 显示 mini preview
- **Reader 自己 override**：如 reader 偏好 graph-paper 但 author 指定 bento-canvas，reader 可 client-side toggle（不写 author 的 notepage）

### Nice-to-have (Phase 2+)

- **Custom theme**：user 写 own theme（registry interface 已设计但 v1 closed per frozen DI §9.1）
- **Theme marketplace**：browse / install theme
- **Per-block theme override**：单 block 用不同 theme（dashboard 场景）
- **Auto theme by content type**：plugin 声明推荐 theme

## Non-functional requirements

- **Performance**:
  - Theme 切换 < 100ms 视觉响应
  - Theme assets（CSS / svg）不阻塞 FCP（per [ADR-0010]）
  - SSR 输出包含 theme CSS（reader 不见 unstyled flash）
- **Accessibility**:
  - 3 theme 都满足 WCAG AA 颜色对比
  - Theme switcher 全键盘可操作
  - Theme 切换 announce to screen reader（"Switched to LEGO studs theme"）

## Non-goals

- ❌ **Custom theme by user (Day-1)** —— Phase 2+；registry interface 预留
- ❌ **Theme marketplace** —— Phase 2+
- ❌ **Plugin-defined themes** —— theme 是 notepage layer concern，不归 plugin
- ❌ **System dark/light mode 自动跟随** —— Day-1 user 显式选；自动跟随 Phase 2+

## Acceptance criteria

### M2 acceptance

- 3 内置 theme 视觉差异明显；都可用
- Theme switcher 可访问（任何 form factor）+ 可切换 + 状态可持久化
- Persistence work：refresh 后 theme 仍是 user 选择
- Frontmatter override work：指定 `theme: graph-paper` 的 notepage 用此 theme
- Author 选 theme A → reader 访问看到 theme A（如 frontmatter 未 override）
- 切换不丢 GridState / scroll / selection

### M3 acceptance

- Theme 切换 transition smooth
- Theme preview tooltip work
- Reader self-override（如 Should 落地）work

### M4 acceptance

- 全键盘 a11y baseline 完成
- Screen reader 切换 announce 完成

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Frontmatter override 跟 user pref 冲突 | Frontmatter 优先；UI 显示 "note 指定 theme: X"（per frozen DI §9.1） |
| Frontmatter 指定无效 theme name | 回退到 user pref；console warn，不报错给 user |
| localStorage 不可用（incognito / 老浏览器） | 回退 default theme；不报错 |
| 切换 theme 时 block 内 EditView 打开 | 切换不打断 EditView；视觉立即更新 |
| Theme A 切到 theme B，slot size 不同 → block 像素位置变 | 视觉变化预期；GridState 不变；user 不感知 "data 变了" |
| Reader override author frontmatter theme | 仅 reader client-side；author 的 notepage 不变 |
| 多 tab 同 notepage，一 tab 切 theme | localStorage 通过 storage event 同步到其他 tab |

## Dependencies

PRD 层 upstream 依赖（ADR 是 downstream，归 References 段）：

- **Parent PRD**: [notepage.md](./notepage.md)
- **Sibling PRDs**: [notepage-view.md](./notepage-view.md) / [notepage-editing.md](./notepage-editing.md) / [notepage-responsive.md](./notepage-responsive.md)（都消费 theme system）
- **External services**: 无 Day-1 外部依赖

## Open questions

1. **Theme switcher 默认位置**: 右下角 floating chip vs 顶部 toolbar vs 设置页？frozen DI 锁了右下角，但 user 可能想拖。Day-1 是否要 "可拖" 还是固定？
2. **Reader override 是否 ship Day-1**：reader 应不应该能 override author frontmatter？倾向不（保持 author 视觉意图），但 a11y 角度（contrast / readability）可能需要
3. **Theme 切换 transition 形态**：CSS variable jump vs 200ms cross-fade？影响 user 感知"切换"还是"瞬变"
4. **Dark mode 跟随系统**：Day-1 不做但 frozen DI 也没显式 non-goal；明确"3 theme 都不是 dark"还是"未来加 dark 变种"？

## Surfaced ADR debts

- **[ADR-0016] theme system carrier GAP（hard）**: 本 PRD must 列了 theme switching；frozen DI §9 LOCK 了 GridTheme interface / registry / persistence / floating chip 位置；但**没有 ADR 承接**。**Action**: 本 PRD 写完后 trigger carrier ADR 决策（[ADR-0016] 扩展 OR 新 ADR）。建议形态：新 ADR-0019（"Notepage theme system carrier"）或扩展 [ADR-0016] 加 theme system section
- **Theme 跨 mode invariant 没在 [ADR-0003]**: cross-cutting invariant "theme 跨 mode 一致" 没在 ADR-0003 induction 3（kind-opaque + theme-agnostic 承诺）显式 cross-ref theme system 形态。**Action**: audit ADR-0003 时确认 theme-agnostic 承诺跟 cross-mode 一致性 align

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，**必须 align 本 PRD**。本 PRD 直接 trigger [ADR-0016] theme system carrier rework（详 Surfaced ADR debts + [AUDIT-2026-05.md] 流程）。

- **Aligning ADRs**:
  - [ADR-0016](../../../../engineering/decisions/ADR-0016-css-framework.md) — CSS framework；theme system carrier **GAP**（本 PRD 触发 rework）
  - Future render-system ADR — 候选承接 theme system；本 PRD 是 product input
- **Frozen DI**: [grid-redesign-2026-05-11.md](../../../../engineering/design/_frozen/grid-redesign-2026-05-11.md) §9 theme system LOCK
- **Audit**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft；从 features/canvas-editing.md theme switching 段拆出 + 扩展承接 frozen DI §9 LOCK 全部内容；本 PRD 起 trigger AUDIT GAP `ADR-0016 theme system carrier`
- 2026-05-16 pass 2 (owner clarify against prototype): theme 责任范围扩到 affordance 自治 ——
  - "Theme switcher 入口存在" 替代具体 "floating chip 右下角"（form factor 由 theme 决定）
  - 新增 "Theme 内 affordance 自治"：每 theme 决定 palette form factor / handle visual / drag visual / 等
  - Frozen DI §9.1 floating chip 提议降级为 reference 不是 mandate
- 2026-05-16 pass 3 layer relationship fix（owner critical framing）：Dependencies 段只列 upstream PRD deps；ADRs 移到 References "Aligning ADRs" 段
- 2026-05-16 hygiene pass 4 (owner review): 相对链接深度修正；M2 acceptance "可拖位置 / 可隐藏" 重新锁了 HOW → 移到 Should（M2 只 mandate "switcher 可访问 + 可切换 + 状态持久化"）
