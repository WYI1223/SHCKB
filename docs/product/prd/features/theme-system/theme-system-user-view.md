# Feature PRD: Theme system — user view

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-18 |
| Owner | W_YI |
| Parent PRD | [theme-system.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

## Overview

**Note author / reader 视角的 theme**：3 内置 theme 的视觉差异 + 切换 UX + persistence + notepage metadata override + author/reader 一致性。

本 PRD 锁的是 **theme system 在 user 视角的 user-observable behavior**——user 怎么选、怎么切、怎么持久化、怎么跨 mode + viewport 看到一致结果。

不锁（归 [theme-system.md] top 或其他 sub-PRD）：
- 4-layer cascade 机制（L0/L1/L2/L3 override 规则）→ [theme-system.md] top
- L0 hard invariants（algorithm + a11y baseline）→ [theme-system.md] top
- Theme 开发者怎么写 theme（fork / compose / from-scratch）→ [theme-system-author-view.md]
- GridTheme / ThemePlugin interface 字段 → [ADR-0016] / future render-system ADR

## User stories

- As a **note author**, I want to **从 3 个内置 theme 中选我喜欢的**，so that **canvas 视觉跟我的偏好对齐**
- As a **note author**, I want to **theme 选择记住跨 session**，so that **不必每次 refresh 重选**
- As a **note author**, I want to **个别 notepage override 全局 theme**（如某篇笔记用 bento-canvas 因为是 dashboard 风格），so that **可以 per-note 调整**
- As a **reader**, I want to **看到 author 指定的 theme**（per-notepage metadata override），so that **author 的视觉意图传达到我**
- As a **note author preview switching theme**, I want to **切 theme 立刻看到效果**，so that **基于实际效果决定，不是 isolated mockup**
- As a **note author switching theme during edit**, I want to **切换不打断我当前的操作**（不丢 selection / scroll / 打开的 EditView），so that **theme 选择跟创作流不冲突**

## Functional requirements

### Must (Day-1, M2)

- **3 内置 theme**（per frozen DI [grid-redesign-2026-05-11.md] §9，作 cascade L2 default 层）：
  - `graph-paper`：60px slot；dotted 极淡 baseplate；1px 边 + 顶 stripe block；工程画布心智
  - `lego-studs`：80px slot；凸点显式 + cell 边框 baseplate；hue tint + 浅边 block；积木心智
  - `bento-canvas`：100px slot；默认隐藏 baseplate（drag 时显）；圆角 + shadow + hue header block；dashboard 心智
- **Default theme** = `lego-studs`（per frozen DI §9.1 — 对 grid 心智表达最直观）；user 不选时 active layer = `lego-studs` 的 L2 + L1 fallback
- **Theme switcher 入口存在**：user 能切换 theme；具体 form factor（floating chip / toolbar / settings / etc.）**由 active theme 自身决定**（per cascade L2 / L3 freedom），不在本 PRD mandate
- **Persistence 三层优先级**：
  - 默认 per-user：localStorage 或 server-side user pref（具体 carrier 归 implementation；详 [ADR-0009] / [authentication.md] 决策）
  - 单 notepage 可 notepage metadata override（如 `notes.theme_key` column 或 `note.settings.theme` JSON 字段；frozen DI §9.1 旧术语 = "frontmatter"，DB-backed substrate 后改名；reviewer Finding 3 修订）
  - 优先级：notepage metadata > user pref > default theme（`lego-studs`）
- **Theme 跨 mode 一致**：
  - Author 在 edit 切 theme → 切到 view 看到同 theme
  - Reader 访问 notepage → 看到 notepage metadata theme（如指定）或 reader 自己 pref
- **Theme 切换即时**：
  - 切换 < 100ms 视觉响应；不刷新页面
  - 不丢 GridState / scroll / selection / 打开的 EditView

### Should (Day-1 if scope allows)

- **Theme switcher 进阶可用性**：可拖位置 / 可隐藏（form factor 仍 active theme 决定；这条只是 user-observable 期望）
- **Theme 切换 transition**：CSS variable 切换 + 短 transition（200ms 内）平滑视觉变化
- **Theme preview tooltip**：hover switcher option 显示 mini preview
- **Reader 自己 override**：如 reader 偏好 graph-paper 但 author 指定 bento-canvas，reader 可 client-side toggle（不写 author 的 notepage data）

### Nice-to-have (Phase 2+)

- **GUI custom theme by user**：no-code theme editor（registry interface 已为此准备）
- **Theme marketplace**：browse / install theme
- **Per-block theme override**：单 block 用不同 theme（dashboard 场景）
- **Auto theme by content type**：plugin 声明推荐 theme

## Non-functional requirements

- **Performance**:
  - Theme 切换 < 100ms 视觉响应
  - Theme assets（CSS / svg）不阻塞 FCP（per [ADR-0010]）
  - SSR 输出包含 theme CSS（reader 不见 unstyled flash）
- **Accessibility（per theme-system.md top L0 a11y baseline，user 视角 manifestation）**:
  - 3 内置 theme 都满足 WCAG AA 颜色对比
  - Theme switcher 全键盘可操作
  - Theme 切换 announce to screen reader（如 "Switched to LEGO studs theme"）

## Non-goals

- ❌ **Cascade / L0 invariants / override 机制细节** —— 归 [theme-system.md] top
- ❌ **Theme 开发者怎么写 theme** —— 归 [theme-system-author-view.md]
- ❌ **Custom theme by user (GUI editor, Day-1)** —— Phase 2+
- ❌ **Theme marketplace** —— Phase 2+
- ❌ **System dark/light mode 自动跟随** —— Day-1 user 显式选；auto-follow Phase 2+
- ❌ **Per-block theme override** —— Phase 2+

## Acceptance criteria

### M2 acceptance

- 3 内置 theme 视觉差异明显；都可用
- Theme switcher 可访问（任何 form factor）+ 可切换 + 状态可持久化
- Persistence work：refresh 后 theme 仍是 user 选择
- Notepage metadata override work：指定 `theme_key = graph-paper` 的 notepage 用此 theme
- Author 选 theme A → reader 访问看到 theme A（如 notepage metadata 未 override）
- 切换不丢 GridState / scroll / selection / EditView

### M3 acceptance

- Theme 切换 transition smooth
- Theme preview tooltip work（如 Should 落地）
- Reader self-override work（如 Should 落地）

### M4 acceptance

- 全键盘 a11y baseline 100% 完成
- Screen reader 切换 announce 完成
- 5 deploy mode 下 user-view 行为一致

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Notepage metadata override 跟 user pref 冲突 | Metadata 优先；UI 显示 "note 指定 theme: X" |
| Notepage metadata 指定无效 theme name | 回退到 user pref；console warn，不报错给 user |
| localStorage 不可用（incognito / 老浏览器） | 回退 default theme（`lego-studs`）；不报错 |
| 切换 theme 时 block 内 EditView 打开 | 切换不打断 EditView；视觉立即更新 |
| Theme A 切到 theme B，slot size 不同 → block 像素位置变 | 视觉变化预期；GridState 不变；user 不感知 "data 变了" |
| Reader override author notepage metadata theme | 仅 reader client-side；author 的 notepage 不变 |
| 多 tab 同 notepage，一 tab 切 theme | 持久化通过 storage event / server sync 到其他 tab |
| Theme uninstall（Phase 2+ scenario）而 notepage metadata override = 此 theme | 回退到 user pref；UI 显示 "this notepage requires theme X (uninstalled)" + 提示重装（具体 fallback 形态待 Phase 2+ 拍）|

## Dependencies

PRD 层 upstream 依赖（ADR 是 downstream，归 References 段）：

- **Parent PRD**: [theme-system.md](./theme-system.md)
- **Sibling PRDs**: [theme-system-author-view.md](./theme-system-author-view.md)（对偶 developer-side）
- **Cross-folder PRDs**:
  - [notepage.md](../notepage/notepage.md) — theme 在 notepage 上 render
  - [notepage-view.md](../notepage/notepage-view.md) — view mode 渲染含 SSR
  - [notepage-editing.md](../notepage/notepage-editing.md) — edit mode 切 theme 不破创作流
  - [notepage-responsive.md](../notepage/notepage-responsive.md) — theme 跨 viewport 一致
- **External services**: 无 Day-1 外部依赖

## Open questions

1. **Theme switcher 默认位置** —— 各 active theme 自治；但 framework default（L1 fallback）需要给一个 baseline form factor（如 settings page）以保 user 切 theme 后即使 L2/L3 没 override switcher 也能找到入口
2. **Reader override 是否 ship Day-1** —— 倾向不（保持 author 视觉意图），但 a11y 角度（contrast / readability）可能需要；最终归 a11y baseline 决定
3. **Theme 切换 transition 形态** —— CSS variable jump vs 200ms cross-fade？影响 user 感知"切换"还是"瞬变"；form factor 决策但跨 theme 一致才有意义
4. **Dark mode 跟随系统** —— Day-1 不做；明确 "3 theme 都不是 dark mode 变种" 还是 "未来 dark mode 是独立 theme A/B 还是 theme variant"
5. **多 device 同 user 的 user pref 同步** —— Day-1 localStorage 只 per-device；server-side sync 跟 authentication 解锁后再决策

## Surfaced ADR debts

User-view 特有的（cross-cutting debts 详 [theme-system.md] top）：

- **User pref persistence carrier**: localStorage vs server-side（authenticated user）—— 没在 [ADR-0009] 显式 cover；跟 [authentication.md] PRD 协同决策。**Action**: authentication PRD 写完后 audit
- **SSR theme inclusion 机制**: SSR 输出含 theme CSS 防 unstyled flash 是本 PRD must；但具体 SSR 机制（theme CSS 怎么 bundle 进 SSR response）归 [ADR-0010] 性能 + [ADR-0016] CSS framework 协同。**Action**: ADR-0010 / ADR-0016 audit 时 verify

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，必须 align 本 PRD（详 [theme-system.md] top Surfaced ADR debts + [AUDIT-2026-05.md] 流程）。

- **Aligning ADRs**:
  - [ADR-0016](../../../../engineering/decisions/ADR-0016-css-framework.md) — CSS framework + theme system carrier
  - [ADR-0010](../../../../engineering/decisions/ADR-0010-performance-budget.md) — performance budget（theme 切换 < 100ms + SSR 不阻塞 FCP）
  - [ADR-0009](../../../../engineering/decisions/ADR-0009-api-style.md) — API style（user pref carrier 候选）
- **Parent PRD**: [theme-system.md](./theme-system.md)
- **Sibling PRD**: [theme-system-author-view.md](./theme-system-author-view.md)
- **Cross-folder PRDs**: [notepage.md](../notepage/notepage.md) and sub-PRDs
- **Frozen DI**: [grid-redesign-2026-05-11.md](../../../../engineering/design/_frozen/grid-redesign-2026-05-11.md) §9 theme system LOCK
- **Audit register**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc cross-reference convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft（在 features/canvas-editing.md theme switching 段拆出 + 承接 frozen DI §9 LOCK）；trigger AUDIT GAP `ADR-0016 theme system carrier`
- 2026-05-16 pass 2 (owner clarify against prototype)：theme 责任扩到 affordance 自治；"floating chip 右下角" → "switcher 入口存在"；新增 "theme 内 affordance 自治"
- 2026-05-16 pass 3 layer relationship fix（owner critical framing）：Dependencies 只列 upstream PRD；ADRs 移到 References "Aligning ADRs"
- 2026-05-16 pass 4 hygiene (owner review)：相对链接深度；M2 "可拖 / 可隐藏" 移 Should
- 2026-05-16 pass 5：audience split — 本 PRD = user 视角；author 视角归 [new-theme.md]
- 2026-05-16 **reframe to theme-system/ folder（pass 6）**：theme 抽出独立 horizontal subsystem folder；本文件从 `notepage/notepage-themes.md` git mv 到 `theme-system/theme-system-user-view.md`；cross-cutting invariants / 4-layer cascade / L0 hard invariants / surfaced cross-cutting debts 全部迁到 [theme-system.md] top；本 PRD 收窄为纯 user-view scope（切换 UX / persistence / frontmatter / cross-mode 一致）；parent 改为 [theme-system.md]；refs 重写
