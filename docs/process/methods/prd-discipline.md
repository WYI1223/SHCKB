# PRD Discipline

**Status**: living
**Last updated**: 2026-05-16

PRDs (Product Requirements Documents) 的写作规则 / 与 ADR / CONTRACT 边界 / template。

## What a PRD is for

PRD 锁的是 **WHAT** —— user-observable behavior 与 product-shape decisions。**HOW** 归 ADR / CONTRACT.md / runbook。

| | PRD | ADR | CONTRACT.md |
|---|---|---|---|
| 锁什么 | **WHAT** — user-observable behavior / product 形态 | **HOW (architectural)** — 架构选择 / 不变量 | **Surface** — types / ops / 算法 |
| 例子 | "user 拖 block 到空 hole，block 缩到 hole size" | "engine kind-opaque + Option A gravity" | `inferDropIntent(state, cursor, proposedSize) → DropIntent` |
| Audience | product reader / owner / future PRD author | engineering reader | code consumer |
| 修改规则 | Living（按 owner 思路演化） | Append-only at `accepted` | Versioned with package |
| 引用方向 | PRD 引用 ADR（"per [ADR-XXXX] ..."），不重定义 | ADR 引用 PRD 作 product source | CONTRACT 引用 ADR 作 architecture source |

## Length

- **Feature PRD**: target 80-200 lines；超 300 → 太长 → 拆 multiple PRDs
- **Project-level PRD** ([project.md]): up to ~300 lines（覆盖 vision + operator 谱 + non-goals + success criteria）
- 不嵌大段 TS interface / 函数签名 / DB schema / wire protocol 形态 —— 这些归 ADR / CONTRACT

## Cross-reference 风格

遵 [doc-conventions.md]：in-text 用 `[bracketed identifier]` citation marker（"per [ADR-0003]" / "see [canvas-editing.md]"），markdown link 集中在 Dependencies / References / Surfaced ADR debts 段。

## Structure

```markdown
# Feature PRD: <Name>

| Field | Value |
|---|---|
| Status | draft / in-progress / shipped / deprecated |
| Last updated | YYYY-MM-DD |
| Owner | <name> |
| Related ADRs | ADR-XXXX, ADR-YYYY |

## Overview
（1-2 段：该 feature 是什么；what user can do with it）

## User stories
- As <role>, I want to <action>, so that <benefit>
（典型 user journey；5-15 条；不嵌技术细节）

## Functional requirements

### Must (Day-1)
- ...

### Should (Day-1 if scope allows)
- ...

### Nice-to-have (Phase 2+)
- ...

## Non-functional requirements
- Performance budget（具体 ms / Lighthouse score / etc.）
- Accessibility（keyboard / screen reader 等）
- Security（如 feature 有 auth / privacy 维度）

## Non-goals
明确**不**做的事（防 scope creep）

## Acceptance criteria
（M-milestone 中此 feature 算 done 的可测试判定）

## Edge cases
（非典型场景 + 期望行为）

## Dependencies
- ADRs: ADR-XXXX, ADR-YYYY
- Other feature PRDs (must ship before this)
- External services

## Open questions
（未决 / 待 owner 确认；写 PRD 过程中暴露的 gap）

## Surfaced ADR debts
（写 PRD 时触碰到的 ADR 漏洞 / 一致性问题；喂回 `docs/engineering/decisions/AUDIT-2026-05.md`）

## Changelog
- YYYY-MM-DD initial draft
```

## WHAT vs HOW boundary

写 PRD 时碰到的边界判断常见错误。PRD 写 **user-observable behavior**；dev / theme / library / architecture 实现选择都归 ADR / CONTRACT / dev decision。

### ❌ Anti-pattern: PRD 写架构 / library / API 实现选择

| 不该写在 PRD | 该归哪 |
|---|---|
| "use DnDKit for drag-and-drop" | [ADR-0013] / library 选型决策 |
| "store theme in localStorage" | [ADR-0016] / theme system ADR |
| "inferDropIntent 接收 proposedSize" | [ADR-0003] / CONTRACT |
| "POST /api/blocks/insert body: {kind, col, row}" | [ADR-0009] |
| "blocks 表加 deleted_at 列" | [ADR-0002] |

### ❌ Anti-pattern: PRD 写 UI / interaction 形态实现

PRD **不**规定 selection 用什么视觉 / reject 反馈用什么 UI / drag 用什么动画 / palette 用什么 form factor / 等。这些是 dev / theme 决策：

| 不该写在 PRD（写到 PRD 里 = 越界） | PRD 该 mandate 的 user behavior 期望 |
|---|---|
| "Selected block 显式 outline" | "User 能识别当前活跃 block" |
| "Reject 反馈用红色 toast" | "User 知道操作失败 + 至少有一种途径理解原因" |
| "Drag in-flight 半透明 + 自定 image" | "User 看到 drag 跟随 cursor 的视觉反馈" |
| "Resize handle hover-only visible" | "User 能识别 resize affordance" |
| "Toolbar palette 顶部 12 col 排列" | "User 有 palette 入口添加 block"（form factor theme 决定）|
| "Tab 选下一 block / Enter 进入 EditView / Esc 退出" | "User 全键盘可操作；应遵循 OS / Web 标准 keyboard 约定" |
| "删除按钮在 block 右上角 ×" | "User 能触发删除 block" |
| "Status banner 显示 'block moved'" | "User 知道操作成功 / 失败" |

**判定方法**：去掉视觉 / 形态描述后这句话还成立吗？

- "Selected block 显式 outline" → 去 "显式 outline" 剩 "Selected block" 没有 behavior，是 visual prescription → 不该 PRD
- "User 能识别当前活跃 block" → user-observable expectation → PRD 该写

### ✅ Pattern: PRD 写 user-observable behavior + 必要 algorithm contract

| 该写在 PRD | 对应 HOW 归 |
|---|---|
| "拖 block 到空 hole 时显示 snap preview，松手后 block 落到 snap 位置" | [ADR-0003] induction 4 + dev/theme 视觉细节 |
| "user 可以选 3 个内置 theme 之一，刷新页面记住选择" | 未来 render-system ADR |
| "拖 block 跨过另一 block 时，目标位置可能被 reject" | [ADR-0003] induction 3 + 4 |
| "API 失败时 user 知道失败原因"（**不**写"如 toast"）| [ADR-0009] error contract + dev/theme UI 决策 |
| "block 删除后立刻消失，30 天内可 restore" | [ADR-0002] `deleted_at` + [ADR-0017] GC |
| "Resize 走 6 axes（4 边 + 2 角）+ atomic transform"（algorithm contract，prototype validated）| [ADR-0003] + prototype + CONTRACT |

### Algorithm contract = exception

部分 PRD 内容**应该**显式 mandate algorithm 层 invariants —— 因为这是 user-observable 行为的底层承诺，跨 implementation / theme 都不能变。

例子（应在 PRD）:

- "Resize 6 axes" —— prototype 验证；implementation 不能减到 4 axes
- "Move 保 size，不 hole-fill clamp" —— user expectation；不能让 implementation 自由改成"move 也走 hole-fill"
- "Insert hole-fill clamp" —— user expectation；implementation 不能跳过
- "Option A gravity invariant" —— architectural commitment（[ADR-0003] induction 4）

这些应在 PRD 标 "algorithm contract（prototype validated 或 ADR-X 承诺）"，区别于 UI 实现选择。

### Out of PRD scope section（推荐）

复杂 PRD（如 [notepage-editing.md]）建议加 `## Out of PRD scope (dev / theme decisions)` 段，**显式列**本 PRD 不规定但容易被误以为该规定的 UI / form factor 选择。Helps reader 区分 "PRD 没说" 与 "PRD 故意不说"。

## ADR debt surfacing

写 PRD 时**期望**会暴露 ADR 漏洞 / 一致性问题。每个 PRD 应有 `## Surfaced ADR debts` 段，把发现的问题喂回 [AUDIT-2026-05.md]（footer 含 link）：

- ADR 没覆盖某 user behavior → AUDIT 标 GAP
- ADR 与 PRD 描述的 behavior 矛盾 → AUDIT 标 REWORK
- ADR cross-ref 跟 PRD 引用对不上 → AUDIT 标 MINOR-FIX

PRD 不直接修 ADR；PRD surface debt，owner / engineer 后续走 ADR rework round 2。

## PRD 写作风格

### 颗粒度

- **User-observable**: 用户能看 / 摸 / 操作的，写进 PRD
- **Internal mechanic**: 用户无感的算法 / 数据结构 / 库选型，不写 PRD
- **Boundary case**: 性能 / a11y / security 是 user-observable（慢 / 不可用 / 数据泄露用户感知），写 PRD；具体如何达到归 ADR

### User stories 写法

- 用 "As X, I want Y, so that Z" 句式
- X 是 role（不是技术名词；写 "Note author"，不写 "API caller"）
- Y 是 action（user-observable）
- Z 是 benefit / motivation（解释 why，避免 PRD 沦为 feature 清单）

### Functional requirements 三档

- **Must (Day-1)**: 没这个 feature 不可发布
- **Should (Day-1 if scope allows)**: 应该有，但被砍掉也能 ship
- **Nice-to-have (Phase 2+)**: 明确推后

避免单 must 列表 —— 每个 feature 都"必须"，scope 会爆。

### Non-goals 必写

明确**不**做的事；防止 scope creep + 后续讨论时回头查"为什么没做 X"。

## PRD vs Living doc

| | Feature PRD | Living doc (mental-model / arch-overview) |
|---|---|---|
| 颗粒度 | 单一 feature scope | Cross-cut integration view |
| 内容 | user stories / requirements | 心智模型 / 架构图 / 演化路径 |
| 修改 | Owner-driven evolution | 跟随 ADR / PRD 演化 |
| 例子 | [canvas-editing.md] | [mental-model.md] / [architecture-overview.md] |

Feature PRD 涉及多个 ADR；living doc 给跨 PRD 的 unifying view。

## References

- Doc cross-reference convention: [doc-conventions.md](./doc-conventions.md)
- ADR writing method: [adr-discipline.md](./adr-discipline.md)
- DI doc taxonomy: [di-doc-class.md](./di-doc-class.md)
- Project PRD: [project.md](../../product/prd/project.md)
- Feature PRD examples: [features/](../../product/prd/features/)
- Audit register: [AUDIT-2026-05.md](../../engineering/decisions/AUDIT-2026-05.md)

## Changelog

- 2026-05-16 initial draft（Phase B follow-up Stage 2 起；为 Phase E PRD-informed rework 做准备）
- 2026-05-16 cross-reference 风格 sync [doc-conventions.md]（pass 1: in-text plain + footer link）
- 2026-05-16 pass 2: in-text 改为 `[bracketed identifier]` citation marker（form C）
- 2026-05-16 WHAT vs HOW boundary 段重写 + sharpen（triggered by notepage-editing.md prototype audit）：
  - 区分 architecture / library 实现选择（已有）vs UI / interaction form factor 选择（新增）
  - 新增"判定方法"："去掉视觉 / 形态描述后这句话还成立吗"
  - 新增 algorithm contract = exception 段（如 prototype-validated 算法 invariant 应在 PRD）
  - 新增 "Out of PRD scope" section 推荐（复杂 PRD 显式列不规定的 UI 决策）
