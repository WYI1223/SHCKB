# Markdown Auto-fit Height — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make markdown blocks limited-height + grow (no scrollbar, height tracks content within an author floor), reversibly and locally, markdown-first.

**Architecture:** New pure engine op `pushResize` (local AABB downward push, no gravity); web edit-controller holds a gesture-base layout snapshot and reconciles `rowSpan = max(floor, fit)` by re-pushing from base; gravity suspended only within the atomic edit gesture and re-established at commit (ADR-0028). Floor/fit/snapshot live in the web layer; engine stays pure/kind-opaque/floor-blind.

**Tech Stack:** Bun workspace, TypeScript, grid-engine (pure), Hono+Drizzle/SQLite server, React/Vite web, vitest (no globals — manual afterEach(cleanup)), bun:test (server), Playwright.

**Source spec:** docs/superpowers/specs/2026-06-13-block-autofit-height-design.md (ratified 2026-06-13)

---


## Phase: adr

_Depends on: "No hard code dependency — this is doc-only work and can land independently/first. Logically it is the conceptual anchor the other subsystems cite: the engine subsystem (pushResize implementation) realizes the op specified here; the web subsystem (captureLayoutSnapshot/reconcile/commit rule) realizes the carve-out's caller responsibilities. ADR-0028 should be ratified before or alongside the engine op merges so CONTRACT.md and code reference an existing ADR number. Number 0028 assumes no other in-flight ADR claims it first."_

**File structure:**
- Created: docs/engineering/decisions/ADR-0028-autofit-gravity-carveout.md — new PRD-informed ADR: pushResize op + tightly-scoped gesture-window gravity carve-out (invariant-4 redefinition limited to the atomic edit session); alternatives C1/C3/C4 rejected.
- Modified: docs/engineering/decisions/README.md — append ADR-0028 row to the ADR Index table.
- Modified: packages/grid-engine/CONTRACT.md — add pushResize to the State-mutation table (with failure modes), add an Algorithm-details "Downward push (pushResize)" subsection (push pseudocode + termination + complexity grow O(B^2*R) / shrink O(B)), extend the Versioning note, and add a changelog entry.

### Task 1: Create ADR-0028 — autofit gravity carve-out (PRD-informed)

The ratified spec (§9) requires a new PRD-informed ADR because C5 redefines gravity semantics (suspend within the atomic autofit edit session) — and per the grid-engine CONTRACT Versioning table, "架构承诺修改（gravity 语义重定义 …）" = major + **新 PRD-informed ADR**. The next free number is **ADR-0028** (ADR-0027 is the highest existing; numbers are append-only, never reused). This is doc-only work — no test loop.

**Files:**
- Create: `docs/engineering/decisions/ADR-0028-autofit-gravity-carveout.md`
- Modify: `docs/engineering/decisions/README.md`

- [ ] **Step 1: Write the full ADR body.** Create `docs/engineering/decisions/ADR-0028-autofit-gravity-carveout.md` with EXACTLY this content (header table matches the recent PRD-informed ADR format in ADR-0023/0025/0027; cross-references use Form-C bracketed `[ADR-XXXX]` markers with footer links per doc-conventions):

```markdown
# ADR-0028: Autofit grow suspends gravity within an atomic edit session

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-13 |
| Authors | W_YI (owner), Claude |
| Supersedes | —（收窄 [grid-engine CONTRACT.md] invariant 4 的 "每个 mutating op 之后 gravity-stable" 表述：增设手势瞬态窗例外）|
| Superseded by | — |
| Source | [2026-06-13-block-autofit-height-design.md](../../superpowers/specs/2026-06-13-block-autofit-height-design.md) §4.4/§9（owner ratified 2026-06-13；PRD-informed：[blocks.md] / [notepage-editing.md] 承接"块高度可由内容在作者约束内自增长"）|

## Context

markdown block 内容超过作者设的 `rowSpan` 时，今天交给主题 frame 滚动。owner reframe 为 **limited-height + grow**：块有作者意图的最小高度（floor / `minRowSpan`），内容只能整行步进往上撑，有效 `rowSpan = max(floor, fit)`（fit = `ceil(内容px / SLOT)`，前端编辑时测量、不持久 fit）。

要让"打字撑高 / 删字回收"在编辑中**可逆且局部**，红队用真引擎语义证伪了原稿假设——"撑开→推碰撞块→跑全局 `applyGravity`"。反例 `G{c0-1,r0,h1}` / `W{c0-5,r1,h1}` / `K{c4-5,r2,h1}`：grow G→h3 把横跨 grower 列+旁列的"桥块" `W` 推下，全局上重力把旁列**毫不相干**的 `K` 吸到 row0；shrink 时上重力只能向上、吸不回去 → K 从 row2 永停 row0。结论：**可逆性 ⊥ 全局 gravity-stable（Option A）**。这是布局质量 + 可逆性缺陷（结果仍 no-overlap + gravity-stable），不是引擎正确性缺陷，但它无法在不触碰 gravity 语义的前提下消除。

spec §4.4 用真引擎语义仿真 + 1000-case fuzz + 命名场景电池在 5 个可逆机制中择优，选定 **C5（base-snapshot + re-push）**：100% 手势内可逆 / 0 旁列误移 / 0 重叠 / 0 不终止，且与未来 Ctrl+Z undo 共快照基元、无 clamp bug 类。C5 在 autofit 编辑手势内**挂起 gravity**——这正是 [grid-engine CONTRACT.md] Versioning 表判定为 "gravity 语义重定义 = major + 新 PRD-informed ADR" 的变更。本 ADR 承接该判定，并把 carve-out **紧紧限定在原子编辑会话**，以免侵蚀别处的 Option-A 心智。

## Decision

### 1. Engine 新增一个纯下推原语 `pushResize`（不调 gravity）

engine 新增 mutation op：

```
pushResize(state: GridState, id: string, newRowSpan: number, opts?: OpOptions) → OpResult
```

语义：把 block `id` 的 `rowSpan` 设为 `newRowSpan`；对每个与撑开后 footprint AABB 碰撞的块，**按竖直重叠深度恰好向下推**，top-down 递归（终止性：每次推严格增大 row，grid 垂直无上界）。**永不调用 `applyGravity`**。它是 grow 与 shrink 的**同一个引擎**——caller 传 base 快照 + 目标 `newRowSpan`，shrink 即从 base 快照重推到更小目标、自然回收空间。

- **输入守卫复用 `isRegionInBounds`**（不外包给某个特定 caller 的 ceil）：`newRowSpan` 必须 integer ≥ 1 且 col/colSpan 合法，否则 reject——failure mode `invalid span` / `out of bounds` / `id not found`，与 `resizeBlock` 对齐。"永不 reject" 收窄为"**永不因垂直空间不足 reject**"（grid 垂直无上界，向下永远有空间）。
- **纯 / kind-opaque / leaf 全保持**（invariant 6/7）：op 是纯函数，**不测量 DOM**；目标 `rowSpan` 由 web 层算好作为 arg 传入。`floor`（`minRowSpan`）与 `autofit` 开关**不进 engine Block 类型**，是 web/server 层拥有的 block metadata（fit 来自 DOM 测量，调和公式 `max(floor, fit)` 是 web 层逻辑）。

### 2. Gravity carve-out（本 ADR 的核心，紧紧限定在原子编辑会话）

> **autofit grow 在原子编辑会话内临时挂起 gravity；页面在完成手势前后于静止态仍 gravity-stable，由从 base 快照重推（或提交时一遍 `applyGravity`）重建，而非连续压实。**

展开为可强制的规则：

1. **快照基元住 web 编辑控制器，不进 engine**：手势开始（块进入 autofit 编辑）对整页布局拍一张 base 快照（`captureLayoutSnapshot(state)` = 深不可变克隆）+ grower id + 其 base `rowSpan`。
2. **手势内每次调和到目标 T**：`reconcile(base, targetRowSpan) = pushResize(base, growerId, target)`，从**同一** base 重推。因为每次都从 base 重新推导，可逆性自动成立——无逆向日志、无 clamp。partial-shrink（+3→+1）结构上等于"直接从 base 推到 +1"。
3. **提交规则（PROBE-2 invariant）**：手势提交（失焦 / idle / autosave-after-gesture）时，若净 `rowSpan` delta ≠ 0 且页面 gravity-on，跑**一遍** `applyGravity` 重新压实（块真变高并保留 → 压实是正确 Option A）；gravity-off 页按推后布局提交（合法浮空，CONTRACT invariant 4 的 gravity-off 分支）。**"提交即压实" 是被强制的 invariant，不是约定。**
4. **原子性 = 硬前提**：grown 期间任何"跑 gravity 的 op"都不得插入手势（现模型每 op 后跑 gravity，插入会在非 gravity-stable 中间态重演桥块泄漏）。grow→shrink 手势须是无 gravity-op 插入的事务单元；autosave 不得在手势未结束时触发"提交即压实"。单用户 debounced-PUT 天然满足，但写成 invariant。

### 3. Invariant 4 的重定义——**只在手势窗内**

[grid-engine CONTRACT.md] invariant 4（Gravity-stable / Option A）原表述为"gravity-on 时每个 mutating op 之后 `∀ block: NOT canRise`"。本 ADR 增设**唯一**例外窗：

- **静止态（手势前/后）**：完全 Option-A 稳定，表述不变。
- **autofit 原子编辑会话内（瞬态）**：gravity **挂起**，grown 中间态合法持浮空块（一个或多个块 `canRise` 为真）。会话结束由从 base 重推（净零 → 逐位还原 base）或提交时一遍 `applyGravity`（净变高）重建 gravity-stable。
- `pushResize` 本身**从不**保证调用后 gravity-stable——它是 gravity-agnostic 原语，gravity-stability 的重建由 caller（web 控制器的提交规则）负责，正如 `{gravity:false}` 已合法持久化非 gravity-stable 布局。

invariant 1（no overlap）/ 2（in bounds）/ 3（discrete spans）/ 5（unique ids）/ 6（purity）/ 7（leaf）**全部不变**：grown 中间态仍无重叠、在界内、span 离散、id 唯一、op 纯。**无持久 schema 变更**（base 快照瞬态、住 web 层，比被淘汰的 C4 home-row 持久列省）。

### 4. 推迟不可逆是被界定、不是被消灭（PROBE-2 / R8）

C5 靠"手势内不压实"换可逆；一旦**提交了一个净变高的块**到 gravity-on 页，下一个普通 op 的 `applyGravity` 会把桥块泄漏带回（K r2→r0）。所以承诺精确表述为：**"编辑会话内可逆；提交一个净变高块后，正常 Option-A 压实生效（这是正确行为——块确实变高了）"**。owner 最怕的"打一行删掉、无关块永久移位"被解决，因为会话内删回即归位、净零不提交变高。base 快照瞬态不持久：reload / 跨手势 undo / 协作远端 op 会让 grown 布局成新 base（此后不可逆，但永不重叠）。单用户 MVP 可接受；协作 / agent 写路径须定义降级 = 无上拉缩（留洞，绝不重叠）。

## Consequences

- 本轮从"加一个 op"升级为**有界但真实的引擎项目**：一个事务性 push op（`pushResize`）+ 一条原子性 invariant + base 快照住 web 控制器 + 本 ADR。markdown-first 仍可发（web 层本就拥有 floor / fit / 快照）；泛化到全 kind 是后续 UI 门控翻转、非更多引擎活。
- carve-out 的瞬态性让 ADR 面收窄：持久 / 静止态完全 Option-A 兼容，现有所有 op（move / insert / delete / 手动 resize）与页面静止态原样不动。
- 快照基元（`captureLayoutSnapshot`）是**未来 Ctrl+Z undo 栈的预定地基**——共享的是基元而非功能（undo = 一栈快照、原样还原；autofit = 一张 gesture-base 快照、`reconcile` 重推）。本轮只发 autofit 这一个消费者，不建栈、不绑 keymap。
- `validateState` 仍 floor-blind：`rowSpan ≥ minRowSpan` 的跨字段兜底落在 web/server 路由层（落库 PUT 在 `validateState` 通过后追加该校验，违则 422），engine 保持 floor-blind。这是全系统唯一兜底落在路由层而非引擎的几何承诺。
- autofit 块在静态 / 读页用 `overflow:hidden` 裁切（非 autofit 保持 `auto`）：尊重无滚轮美学；跨主题漂移由作者手动重开页触发编辑器自愈修正。server / publish 永不测量。

## Alternatives considered

被 spec §4.4 用真引擎语义仿真 + 同种子 fuzz 淘汰的可逆机制（择优 trace 留 spec）：

1. **C1 保留全局 gravity（baseline）** —— 拒绝：70.5% 手势内可逆 / 275 旁列误移；约 30% "打字再删"永久重排无关块，不可发。
2. **C3 位移日志 + canRise 闸缩** —— 拒绝：93% 可逆 / 8 旁列误移；桥块逆向被卡（canRise 无法穿回被重占的行）。
3. **C4 anchored home-row** —— 拒绝：56.7% 可逆 / 61 旁列误移，最差；且要加持久 schema 列 + 迁移，只把"泄漏"换成"钉死"。
4. **C2 push-only + 逆向日志** —— 与 C5 目标上并列（100% / 0），但有 `min(delta,shrink)` load-bearing clamp bug 类 + 日志陈旧风险 + delta Map 状态更重，且 delta 日志弹不出可还原历史态（无法与 undo 共基元）。C5 在 owner tie-breaker（更少 bug 类 / 状态更简 / 与 undo 共基元）上胜出。

## References

- Spec: [2026-06-13-block-autofit-height-design.md](../../superpowers/specs/2026-06-13-block-autofit-height-design.md)（§4.4 机制择优 / §9 契约与 PRD 影响 / §11 测试）
- Engine 契约: [grid-engine CONTRACT.md](../../../packages/grid-engine/CONTRACT.md)（Versioning 表判定本 ADR 触发条件；invariant 4 被本 ADR 收窄）
- PRD（下游待 pass）: [blocks.md](../../product/prd/features/blocks/blocks.md) / [notepage-editing.md](../../product/prd/features/notepage/notepage-editing.md)
- 相关 ADR: [ADR-0019](./ADR-0019-mvp-implementation-baseline.md)（engine lift 基线 / invariant 4 条件化前身）
```

- [ ] **Step 2: Append the ADR-0028 row to the README index.** In `docs/engineering/decisions/README.md`, the ADR Index table currently ends at the ADR-0027 row. Add immediately after it (keep the exact pipe-table column shape used by the other PRD-informed rows — `| [ADR-XXXX](...) | 主题 | Status | Source ... |`):

```markdown
| [ADR-0028](./ADR-0028-autofit-gravity-carveout.md) | Autofit grow 在原子编辑会话内挂起 gravity（pushResize 下推原语 + 手势瞬态 carve-out + 提交即压实 invariant + base 快照住 web 控制器）| proposed | —（PRD-informed；source = [2026-06-13-block-autofit-height-design.md](../../superpowers/specs/2026-06-13-block-autofit-height-design.md) §4.4/§9；C5 base-snapshot+re-push 择优；C1/C3/C4 rejected；收窄 CONTRACT invariant 4）|
```

- [ ] **Step 3: Verify the new files are present and the index links resolve.** Run:

```bash
cd "d:/Learn/CS/github/SelfKnowledgeBaseWeb" && ls docs/engineering/decisions/ADR-0028-autofit-gravity-carveout.md && grep -c "ADR-0028" docs/engineering/decisions/README.md
```

Expected output (the file path echoed, then the count of ADR-0028 references in README = at least 1):

```
docs/engineering/decisions/ADR-0028-autofit-gravity-carveout.md
1
```

- [ ] **Step 4: Commit.** Run:

```bash
cd "d:/Learn/CS/github/SelfKnowledgeBaseWeb" && git add docs/engineering/decisions/ADR-0028-autofit-gravity-carveout.md docs/engineering/decisions/README.md && git commit -m "$(cat <<'EOF'
docs(adr): ADR-0028 — autofit grow suspends gravity within atomic edit session

New PRD-informed ADR per autofit spec §9: pushResize downward-push primitive
(never calls applyGravity) + tightly-scoped gesture-window gravity carve-out
(invariant-4 redefinition limited to the atomic edit session) + commit-time
applyGravity (PROBE-2 invariant). Alternatives C1/C3/C4 rejected. Indexed in
decisions/README.md.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: one commit created touching exactly 2 files (`ADR-0028-autofit-gravity-carveout.md` created, `README.md` modified).

### Task 2: Update grid-engine CONTRACT.md — pushResize op + Algorithm-details push subsection

Per spec §9: add `pushResize` to the State-mutation table (with failure modes), add an Algorithm-details "Downward push" subsection (push pseudocode + termination + complexity grow O(B²·R) / shrink O(B)), and reflect that gravity-semantics carve-out is now governed by ADR-0028. Doc-only. **Note:** the spec also floats an optional batch primitive `reconcileRowSpans`; the web `reconcile` contract pinned for this round is the single-grower `reconcile(base, targetRowSpan) = pushResize(base, growerId, target)`, so this task documents only `pushResize` and mentions the batch op as a deferred minor add (do not add it to the table now).

**Files:**
- Modify: `packages/grid-engine/CONTRACT.md`

- [ ] **Step 1: Add `pushResize` to the State-mutation table.** In `packages/grid-engine/CONTRACT.md`, the State-mutation table currently ends with the `deleteBlock` row. Add this row immediately after the `deleteBlock` row (preserve the existing 4-column shape `| op | signature | gravity 默认 | failure 模式 |`):

```markdown
| `pushResize` | `(state, id, newRowSpan, opts?) → OpResult` | **n/a — 从不调 applyGravity** | id not found / invalid span / out of bounds |
```

- [ ] **Step 2: Add the explanatory note under the State-mutation table.** Directly below the existing `**承诺**：mutation 不就地修改 input state；返回新 state；失败时不部分 apply。` line, insert this paragraph:

```markdown
> **`pushResize` 的特殊性（gravity-agnostic 原语；详 [ADR-0028]）**：与上表其余 mutation 不同，`pushResize` **从不**在内部调用 `applyGravity`，也**不**保证调用后 gravity-stable——它把 grower 设为 `newRowSpan`，对每个 AABB 碰撞块按竖直重叠深度向下推，top-down 递归。gravity-stability 的重建由 caller 负责：autofit web 控制器从 base 快照重推（净零手势 → 逐位还原）或在手势提交时跑一遍 `applyGravity`（净变高且页面 gravity-on）。这是 invariant 4 在原子编辑会话内的瞬态例外（[ADR-0028]）；`floor`（`minRowSpan`）/ `autofit` 开关不进 engine，目标 `rowSpan` 由 web 层算好传入（engine 不测量 DOM，invariant 6/7 保持）。"永不 reject" 收窄为"**永不因垂直空间不足 reject**"——grid 垂直无上界，向下永远有空间。
```

- [ ] **Step 3: Add the "Downward push" Algorithm-details subsection.** In the `## Algorithm details` section, the `### Gravity (Option A)` subsection ends with its trigger table and the `### Worst-case performance` subsection follows. Insert a new subsection BETWEEN them — immediately before the `### Worst-case performance` heading — with this content:

```markdown
### Downward push (`pushResize`)

`pushResize` 与现有 ops 不同：现有 resize 遇碰撞 **reject**，`pushResize` **推**。它是 grow 与 shrink 的同一引擎——caller 传 base 快照 + 目标 `newRowSpan`，shrink 即从 base 重推到更小目标、自然回收空间（从不上拉、从不填洞、从不跨列）。

```
pushResize(state, id, newRowSpan, opts?):
  grower = find(state.blocks, id)
  if grower is null:               return { ok: false, error: 'id not found: ...' }
  resized = { ...grower, rowSpan: newRowSpan }
  // 复用 isRegionInBounds：rowSpan integer ≥ 1 + col/colSpan 合法，否则 reject
  if not isRegionInBounds(state, resized):
    return { ok: false, error: 'invalid span / out of bounds: ...' }

  blocks = state.blocks.map(b => b.id === id ? resized : b)

  // top-down 递归下推消重叠（victim 选择 = 所有 AABB 碰撞 grower 新 footprint 的块）
  // worklist 按 row 升序处理，保证 top-down
  changed = true
  while changed:
    changed = false
    for pusher in blocks sorted by (row asc):
      for victim in findCollidingBlocks({...state, blocks}, pusher, pusher.id):
        if victim.row >= pusher.row:                 // 只向下推、不上拉
          overlapDepth = (pusher.row + pusher.rowSpan) - victim.row   // 竖直重叠深度
          if overlapDepth > 0:
            victim.row += overlapDepth                // 恰好按重叠深度下推
            changed = true
  return { ok: true, state: { ...state, blocks } }    // 注意：不调 withGravity / applyGravity
```

- **victim 选择**：所有与 pusher 当前 footprint AABB 碰撞且 `row ≥ pusher.row` 的块（同列或跨列重叠均算）。
- **每碰撞体推距**：恰好竖直重叠深度 `(pusher.row + pusher.rowSpan) − victim.row`，消除重叠且不过推。
- **链式传递**：被推下的块成为新 pusher，继续推它新触碰的块（worklist / 迭代到无 change）。
- **终止性**：每次推都**严格增大** victim 的 `row`；grid 垂直无上界（invariant 2：`row ≥ 0` 无上界），故无 victim 能阻塞，迭代必收敛。
- **不变量**：完成后 invariant 1（无重叠）/ 2（在界）/ 3（离散 span）/ 5/6/7 成立；invariant 4（gravity-stable）**不**由本 op 保证——是 caller 经 base-重推或提交时一遍 `applyGravity` 重建（[ADR-0028] carve-out）。
- shrink（`newRowSpan < base.rowSpan`）从 base 快照重推：被推下的块从未被新（更小）footprint 触碰 → 留在 base 位置，空间回收，**可逆性结构成立**（无逆向日志、无 clamp）。
```

- [ ] **Step 4: Add `pushResize` complexity to the Worst-case performance subsection.** In `### Worst-case performance`, the bullet list currently has an `applyGravity` bullet and a `findCollidingBlocks / maxEmptyRectContaining` bullet. Add this bullet immediately after the `applyGravity` bullet:

```markdown
- `pushResize`: grow **O(B² × R)** worst case（B = block count, R = total rows；级联下推每轮 O(B²) 碰撞扫描 × 至多 O(R) 轮）；shrink **O(B)**（从 base 重推、被推块归位，无级联放大）。无内部 `applyGravity` 调用，故不叠加 gravity 的迭代成本。
```

- [ ] **Step 5: Extend the Versioning note to point at ADR-0028.** In `## Versioning`, directly below the table (after the `简言：...` summary line), add this note:

```markdown
> **已落地的 gravity-语义变更**：[ADR-0028]（2026-06-13）按本表"架构承诺修改（gravity 语义重定义）= major + 新 PRD-informed ADR"行新增 `pushResize`（gravity-agnostic 下推原语）并把 invariant 4 收窄为"含 autofit 原子编辑会话内的瞬态挂起例外"。surface 上 `pushResize` 是"新 op"（minor），但其挂起 gravity 的语义触发了 ADR 要求——故按更强者归类、走 ADR。
```

- [ ] **Step 6: Add a changelog entry.** In `## Changelog`, append this entry as the last bullet (after the `2026-06-11 lift 落地` block):

```markdown
- 2026-06-13 autofit gravity carve-out（[ADR-0028]；source = autofit spec §4.4/§9）:
  - 新增 `pushResize(state, id, newRowSpan, opts?) → OpResult` 进 State-mutation 表——gravity-agnostic 下推原语（grow O(B²·R) / shrink O(B)），失败模式 `id not found` / `invalid span` / `out of bounds`，"永不因垂直空间不足 reject"
  - Algorithm details 增 "Downward push (`pushResize`)" 小节：push 伪代码 + victim 选择 / 每碰撞体推距（竖直重叠深度）/ 链式传递 / 终止性（每次推严格增 row）
  - invariant 4 收窄：增设 autofit 原子编辑会话内的 gravity 瞬态挂起例外（静止态仍 Option-A）；gravity-stability 由 web 控制器从 base 重推或提交时一遍 `applyGravity` 重建（PROBE-2 "提交即压实" invariant）
  - 注：可选批量原语 `reconcileRowSpans` 在 spec 中列为 perf 增项，本轮按单 grower `reconcile(base, target) = pushResize(base, growerId, target)` 落地，批量 op 留后续 minor 增项
```

- [ ] **Step 7: Verify the edits landed.** Run:

```bash
cd "d:/Learn/CS/github/SelfKnowledgeBaseWeb" && grep -c "pushResize" packages/grid-engine/CONTRACT.md && grep -c "ADR-0028" packages/grid-engine/CONTRACT.md
```

Expected output (pushResize appears across the table row, note, algorithm subsection, perf bullet, and changelog; ADR-0028 appears across the note, perf/versioning/changelog references — both counts well above zero):

```
9
4
```

(Exact counts may vary slightly if wording is adjusted; the assertion that matters is both are non-zero — `pushResize` present in the State-mutation table AND the Algorithm-details section, and `ADR-0028` cross-referenced.)

- [ ] **Step 8: Commit.** Run:

```bash
cd "d:/Learn/CS/github/SelfKnowledgeBaseWeb" && git add packages/grid-engine/CONTRACT.md && git commit -m "$(cat <<'EOF'
docs(grid-engine): CONTRACT — add pushResize op + downward-push algorithm + ADR-0028 carve-out

State-mutation table gains pushResize (gravity-agnostic downward push; failure
modes id-not-found / invalid-span / out-of-bounds). Algorithm details gain a
"Downward push" subsection (push pseudocode + termination + complexity grow
O(B^2*R) / shrink O(B)). Versioning + changelog point at ADR-0028 for the
invariant-4 gesture-window carve-out.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: one commit modifying exactly 1 file (`packages/grid-engine/CONTRACT.md`).


## Phase: engine

_Depends on: "None — this is the foundational subsystem (orderHint 1). The web subsystem (captureLayoutSnapshot, reconcile wrapper, measurement loop) depends on this op being exported; the route-guard and block-metadata/migration subsystems are independent of the engine but the web reconcile path depends on pushResize. Nothing the engine needs depends on another subsystem landing first."_

**File structure:**
- Modify `packages/grid-engine/src/ops.ts` — add the pure `pushResize(state, id, newRowSpan, opts?)` op (set rowSpan, AABB push-down by overlap depth, recurse top-down, NEVER calls applyGravity).
- Modify `packages/grid-engine/src/index.ts` — re-export `pushResize` from the ops barrel.
- Create `packages/grid-engine/src/__tests__/push-resize.test.ts` — unit + named-fixture reversibility + determinism/termination tests (vitest, mirrors existing test conventions).
- Create `packages/grid-engine/src/__tests__/push-resize.perf.test.ts` — timing harness with explicit per-op latency budget; corrects the spec's "50k" wording to the real iteration count (10k total elsewhere; this harness uses 1000 reconciles on B=500).
- Modify `packages/grid-engine/CONTRACT.md` — add `pushResize` row to the State mutation table with its failure modes + a short "Downward displacement" algorithm note (done in the final commit step).

### Task 3: `pushResize` basic push-down + no-overlap (RED → GREEN)

**Files:**
- Test: `packages/grid-engine/src/__tests__/push-resize.test.ts` (Create)
- Modify: `packages/grid-engine/src/ops.ts`
- Modify: `packages/grid-engine/src/index.ts`

- [ ] **Step 1: Write the failing basic-behavior test.** Create `packages/grid-engine/src/__tests__/push-resize.test.ts` with the import + first describe block. (More describe blocks are appended in later tasks; this file accumulates.)

```ts
/**
 * Tests for pushResize — the autofit "limited-height + grow" engine op.
 *
 * pushResize(state, id, newRowSpan, opts?) sets block.rowSpan = newRowSpan and
 * pushes every AABB-colliding block DOWN by exactly the vertical overlap depth,
 * recursing top-down. It NEVER calls applyGravity (gravity is suspended within
 * the autofit gesture; the web controller re-derives from a base snapshot).
 *
 * vitest has NO globals and does NOT auto-cleanup — these are pure-function
 * tests so no afterEach(cleanup) is needed (no DOM).
 */
import { describe, expect, test } from 'vitest';
import {
  type Block,
  type GridState,
  createEmptyState,
  insertBlock,
  pushResize,
  validateState,
} from '../index';

/** Stable string snapshot of a layout for exact-equality assertions. */
function norm(s: GridState): string {
  return [...s.blocks]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((b) => `${b.id}:${b.col},${b.row},${b.colSpan},${b.rowSpan}`)
    .join('|');
}

describe('pushResize: basic grow pushes colliders down by overlap depth', () => {
  test('grow top block pushes the block directly below down', () => {
    let s = createEmptyState(12);
    const r1 = insertBlock(s, {
      id: 'A',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error('seed A');
    s = r1.state;
    const r2 = insertBlock(s, {
      id: 'B',
      col: 0,
      row: 1,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r2.ok) throw new Error('seed B');
    s = r2.state;

    const r = pushResize(s, 'A', 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.blocks.find((b) => b.id === 'A')!.rowSpan).toBe(3);
    // A now spans rows 0-2; B was at row 1, overlap depth = (0+3)-1 = 2 → row 3.
    expect(r.state.blocks.find((b) => b.id === 'B')!.row).toBe(3);
    // gravity-off result is still a legal no-overlap layout
    expect(validateState(r.state, { gravity: false }).ok).toBe(true);
  });

  test('grow with no block below is a pure rowSpan change (no displacement)', () => {
    let s = createEmptyState(12);
    const r1 = insertBlock(s, {
      id: 'A',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error('seed A');
    s = r1.state;
    // disjoint neighbor in a different column at row 0 — must NOT move
    const r2 = insertBlock(s, {
      id: 'N',
      col: 6,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r2.ok) throw new Error('seed N');
    s = r2.state;

    const r = pushResize(s, 'A', 4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.blocks.find((b) => b.id === 'A')!.rowSpan).toBe(4);
    expect(r.state.blocks.find((b) => b.id === 'N')!.row).toBe(0);
  });

  test('does NOT mutate the input state (purity, invariant 6)', () => {
    let s = createEmptyState(12);
    const r1 = insertBlock(s, {
      id: 'A',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r1.ok) throw new Error('seed A');
    s = r1.state;
    const r2 = insertBlock(s, {
      id: 'B',
      col: 0,
      row: 1,
      colSpan: 6,
      rowSpan: 1,
      kind: 'markdown',
    });
    if (!r2.ok) throw new Error('seed B');
    s = r2.state;
    const before = norm(s);

    const r = pushResize(s, 'A', 3);
    expect(r.ok).toBe(true);
    // input snapshot unchanged after the op returned a new state
    expect(norm(s)).toBe(before);
  });

  test('does NOT run gravity: a floating sibling stays floating', () => {
    // gravity-off-style fixture (build by hand; insert+gravity would snap N up).
    const blocks: Block[] = [
      { id: 'A', col: 0, row: 0, colSpan: 6, rowSpan: 1, kind: 'markdown' },
      { id: 'B', col: 0, row: 1, colSpan: 6, rowSpan: 1, kind: 'markdown' },
      // N is disjoint AND floating (row 5, col 6-11) — pushResize must not lift it.
      { id: 'N', col: 6, row: 5, colSpan: 6, rowSpan: 1, kind: 'markdown' },
    ];
    const s: GridState = { blocks, totalCols: 12 };
    const r = pushResize(s, 'A', 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.blocks.find((b) => b.id === 'N')!.row).toBe(5);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails for the right reason.** From `packages/grid-engine`:

```
bun run test
```

Expected: the run fails at import resolution / type level because `pushResize` is not exported yet, e.g.

```
FAIL  src/__tests__/push-resize.test.ts [ src/__tests__/push-resize.test.ts ]
SyntaxError: The requested module '../index' does not provide an export named 'pushResize'
```

(If vitest instead reports the describe block erroring on `pushResize is not a function`, that is also an acceptable RED.)

- [ ] **Step 3: Implement `pushResize` in `ops.ts` (minimal, correct).** Append this function to `packages/grid-engine/src/ops.ts` (after `transformBlock`, before the `describe` helper). It deliberately ignores `opts.gravity` for the layout pass — per the COMMIT RULE the op NEVER runs gravity; `opts?` is accepted only for signature parity with sibling ops, and any future use is the caller's. The displacement is top-down and terminates because every push strictly increases a block's `row`.

```ts
/**
 * Autofit "limited-height + grow" engine op (markdown-first; kind-opaque).
 *
 * Sets block `id`'s rowSpan to `newRowSpan`, then resolves the resulting AABB
 * collisions by pushing every colliding block DOWN by exactly the vertical
 * overlap depth, recursing top-down. The SAME engine serves grow AND shrink:
 * the caller (web autofit controller) passes the gesture's BASE snapshot plus
 * a target rowSpan, so reconcile(base, target) = pushResize(base, growerId,
 * target). It is the caller's job to re-derive from the base snapshot every
 * reconcile — pushResize keeps no journal and applies no clamp.
 *
 * NEVER calls applyGravity: gravity is suspended within the atomic autofit
 * gesture. The COMMIT RULE (page-level applyGravity once on gesture commit when
 * net rowSpan delta != 0 and gravity is ON) lives in the web controller, not
 * here. `opts` is accepted for signature parity with sibling ops; the gravity
 * field is intentionally not consulted by the layout pass.
 *
 * Guards via isRegionInBounds: newRowSpan must be an integer >= 1 with valid
 * col/colSpan, else { ok:false } ('invalid span' / 'out of bounds'). Vertical
 * space is unbounded so grow never fails for lack of room. Pure: returns a new
 * GridState; never mutates the input (invariant 6). Leaf-preserving (invariant
 * 7): only `row` and the grower's `rowSpan` change; col/colSpan/kind/id never.
 */
export function pushResize(
  state: GridState,
  id: string,
  newRowSpan: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _opts?: OpOptions,
): OpResult {
  const grower = state.blocks.find((b) => b.id === id);
  if (!grower) return { ok: false, error: `no such block: ${id}` };
  if (!Number.isInteger(newRowSpan) || newRowSpan < 1) {
    return { ok: false, error: `invalid span: ${describe({ ...grower, rowSpan: newRowSpan })}` };
  }
  const grown: Block = { ...grower, rowSpan: newRowSpan };
  if (!isRegionInBounds(state, grown)) {
    return { ok: false, error: `out of bounds: ${describe(grown)}` };
  }

  // Working copy — never mutate input blocks.
  let blocks: Block[] = state.blocks.map((b) =>
    b.id === id ? grown : { ...b },
  );

  // Top-down displacement. Each iteration finds the single highest pusher that
  // overlaps a lower (or id-tie) pushee and shoves the pushee down by the exact
  // overlap depth. Deterministic order: row asc, then col asc, then id asc.
  // Terminates: every move strictly increases a block's row, the grid is
  // vertically unbounded, and no move ever decreases a row.
  const MAX_PUSHES = 100_000; // safety cap; real cascades are O(B)
  for (let guard = 0; ; guard++) {
    if (guard > MAX_PUSHES) {
      return { ok: false, error: 'pushResize did not terminate' };
    }
    const sorted = [...blocks].sort(
      (a, b) => a.row - b.row || a.col - b.col || (a.id < b.id ? -1 : 1),
    );
    let pusheeId: string | null = null;
    let depth = 0;
    outer: for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]!;
      for (let j = 0; j < sorted.length; j++) {
        if (i === j) continue;
        const b = sorted[j]!;
        if (!regionsOverlap(a, b)) continue;
        // pusher = higher top (smaller row); id-tie broken deterministically.
        const aIsPusher = a.row < b.row || (a.row === b.row && a.id < b.id);
        const pusher = aIsPusher ? a : b;
        const pushee = aIsPusher ? b : a;
        const d = pusher.row + pusher.rowSpan - pushee.row;
        if (d > 0) {
          pusheeId = pushee.id;
          depth = d;
          break outer;
        }
      }
    }
    if (pusheeId === null) break;
    const pid = pusheeId;
    const dy = depth;
    blocks = blocks.map((b) => (b.id === pid ? { ...b, row: b.row + dy } : b));
  }

  return { ok: true, state: { ...state, blocks } };
}
```

- [ ] **Step 4: Add the missing import.** `regionsOverlap` is not yet imported in `ops.ts`. Update the collision import at the top of `packages/grid-engine/src/ops.ts`:

```ts
import { findCollidingBlocks, isRegionInBounds, regionsOverlap } from './collision';
```

- [ ] **Step 5: Export `pushResize` from the barrel.** In `packages/grid-engine/src/index.ts`, add `pushResize` to the ops re-export block:

```ts
export {
  deleteBlock,
  insertBlock,
  moveBlock,
  pushResize,
  resizeBlock,
  transformBlock,
  type OpOptions,
} from './ops';
```

- [ ] **Step 6: Run the test — confirm GREEN.** From `packages/grid-engine`:

```
bun run test
```

Expected: all suites pass, including the new file. Output ends with something like:

```
 Test Files  4 passed (4)
      Tests  48 passed (48)
```

(Pre-existing baseline was 3 files / 44 tests; the 4 new tests in this task bring it to 48. Exact counts grow as later tasks add tests.)

- [ ] **Step 7: Commit.**

```
git add packages/grid-engine/src/ops.ts packages/grid-engine/src/index.ts packages/grid-engine/src/__tests__/push-resize.test.ts
git commit -m "feat(grid-engine): pushResize op — AABB top-down push-down, gravity-free"
```

---

### Task 4: span guard rejects `newRowSpan < 1` and bad ids (RED → GREEN)

**Files:**
- Test: `packages/grid-engine/src/__tests__/push-resize.test.ts` (Modify — append describe block)

- [ ] **Step 1: Append the guard tests.** Add this describe block to `packages/grid-engine/src/__tests__/push-resize.test.ts` (after the basic block):

```ts
describe('pushResize: input guards via isRegionInBounds (engine, not caller)', () => {
  function seedOne(): GridState {
    const r = insertBlock(createEmptyState(12), {
      id: 'A',
      col: 0,
      row: 0,
      colSpan: 6,
      rowSpan: 2,
      kind: 'markdown',
    });
    if (!r.ok) throw new Error('seed A');
    return r.state;
  }

  test('newRowSpan = 0 rejected (invalid span), state unchanged', () => {
    const s = seedOne();
    const before = norm(s);
    const r = pushResize(s, 'A', 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('invalid span');
    expect(norm(s)).toBe(before);
  });

  test('newRowSpan = -3 rejected (invalid span)', () => {
    const r = pushResize(seedOne(), 'A', -3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('invalid span');
  });

  test('non-integer newRowSpan (2.5) rejected (invalid span), state unchanged', () => {
    const s = seedOne();
    const before = norm(s);
    const r = pushResize(s, 'A', 2.5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('invalid span');
    expect(norm(s)).toBe(before);
  });

  test('unknown id rejected (no such block) — aligns with sibling ops', () => {
    const r = pushResize(seedOne(), 'ghost', 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('no such block');
  });
});
```

- [ ] **Step 2: Run — confirm GREEN (guards were implemented in Task 1).** From `packages/grid-engine`:

```
bun run test
```

Expected: still all green, e.g.

```
 Test Files  4 passed (4)
      Tests  52 passed (52)
```

(4 guard tests added.)

- [ ] **Step 3: Commit.**

```
git add packages/grid-engine/src/__tests__/push-resize.test.ts
git commit -m "test(grid-engine): pushResize span/id guards reject newRowSpan<1, non-int, unknown id"
```

---

### Task 5: named reversibility fixtures (G/W/K bridge, double-bridge, full-width stack, disjoint columns, same-column cascade, gravity-off)

**Files:**
- Test: `packages/grid-engine/src/__tests__/push-resize.test.ts` (Modify — append describe block)

These are the §11 named regression fixtures. Each asserts: `pushResize(base, id, T)` produces a grown layout, then `pushResize(base, id, origRowSpan)` (re-pushing from the SAME base, per C5 — NOT from the grown result) returns EXACTLY to base, AND no disjoint-column block (a block sharing no column with the grower's transitive push footprint) moved. The reconcile-from-base semantics were validated against a prototype before writing these expected values.

- [ ] **Step 1: Append a shared reversibility harness + the six fixtures.** Add to `packages/grid-engine/src/__tests__/push-resize.test.ts`:

```ts
describe('pushResize: named reversibility fixtures (C5 re-push from base)', () => {
  /**
   * Reconcile-from-base round trip:
   *   grown = pushResize(base, id, target)
   *   restored = pushResize(base, id, origRowSpan)   // SAME base, not grown
   * Asserts restored === base exactly, AND every id in `frozen` kept its row
   * (disjoint columns must never leapfrog).
   */
  function assertReversible(
    base: GridState,
    id: string,
    target: number,
    frozen: string[],
  ): void {
    const orig = base.blocks.find((b) => b.id === id)!.rowSpan;
    const baseN = norm(base);

    const grown = pushResize(base, id, target);
    expect(grown.ok).toBe(true);
    if (!grown.ok) return;
    expect(grown.state.blocks.find((b) => b.id === id)!.rowSpan).toBe(target);
    expect(validateState(grown.state, { gravity: false }).ok).toBe(true);

    // disjoint-column blocks must not have moved in the grown layout
    for (const fid of frozen) {
      expect(grown.state.blocks.find((b) => b.id === fid)!.row).toBe(
        base.blocks.find((b) => b.id === fid)!.row,
      );
    }

    // re-push from BASE back to original span → exact return to base
    const restored = pushResize(base, id, orig);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(norm(restored.state)).toBe(baseN);
  }

  test('G/W/K bridge: grow G, W bridges down, K (shares W cols) reverses cleanly', () => {
    // G{c0-1,r0,h1} W{c0-5,r1,h1} K{c4-5,r2,h1}. K shares columns with the
    // bridge W, so K is NOT disjoint; nothing here is frozen-disjoint.
    const base: GridState = {
      blocks: [
        { id: 'G', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind: 'markdown' },
        { id: 'W', col: 0, row: 1, colSpan: 6, rowSpan: 1, kind: 'markdown' },
        { id: 'K', col: 4, row: 2, colSpan: 2, rowSpan: 1, kind: 'markdown' },
      ],
      totalCols: 12,
    };
    assertReversible(base, 'G', 3, []);
  });

  test('double bridge: two stacked bridges over the grower column', () => {
    const base: GridState = {
      blocks: [
        { id: 'G', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind: 'markdown' },
        { id: 'W1', col: 0, row: 1, colSpan: 6, rowSpan: 1, kind: 'markdown' },
        { id: 'W2', col: 0, row: 2, colSpan: 8, rowSpan: 1, kind: 'markdown' },
        { id: 'K', col: 6, row: 3, colSpan: 2, rowSpan: 1, kind: 'markdown' },
      ],
      totalCols: 12,
    };
    assertReversible(base, 'G', 4, []);
  });

  test('full-width stack: every block shares all columns; cascade then reverse', () => {
    const base: GridState = {
      blocks: [
        { id: 'A', col: 0, row: 0, colSpan: 12, rowSpan: 1, kind: 'markdown' },
        { id: 'B', col: 0, row: 1, colSpan: 12, rowSpan: 1, kind: 'markdown' },
        { id: 'C', col: 0, row: 2, colSpan: 12, rowSpan: 1, kind: 'markdown' },
      ],
      totalCols: 12,
    };
    assertReversible(base, 'A', 3, []);
  });

  test('disjoint columns: right-column block R never moves', () => {
    // L{c0-2} grows; R{c6-8} shares no column with L → frozen.
    const base: GridState = {
      blocks: [
        { id: 'L', col: 0, row: 0, colSpan: 3, rowSpan: 1, kind: 'markdown' },
        { id: 'L2', col: 0, row: 1, colSpan: 3, rowSpan: 1, kind: 'markdown' },
        { id: 'R', col: 6, row: 0, colSpan: 3, rowSpan: 5, kind: 'markdown' },
      ],
      totalCols: 12,
    };
    assertReversible(base, 'L', 3, ['R']);
  });

  test('same-column cascade: A pushes B,C,D in one column', () => {
    const base: GridState = {
      blocks: [
        { id: 'A', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind: 'markdown' },
        { id: 'B', col: 0, row: 1, colSpan: 2, rowSpan: 1, kind: 'markdown' },
        { id: 'C', col: 0, row: 2, colSpan: 2, rowSpan: 1, kind: 'markdown' },
        { id: 'D', col: 0, row: 3, colSpan: 2, rowSpan: 1, kind: 'markdown' },
      ],
      totalCols: 12,
    };
    assertReversible(base, 'A', 4, []);
  });

  test('gravity-off + autofit-shrink: shrink from base recovers space, no lift', () => {
    // Start from a grown layout's base, shrink the grower below original.
    // pushResize is gravity-agnostic, so shrinking just re-derives from base:
    // the disjoint block stays put and nothing is pulled up.
    const base: GridState = {
      blocks: [
        { id: 'A', col: 0, row: 0, colSpan: 6, rowSpan: 4, kind: 'markdown' },
        { id: 'B', col: 0, row: 4, colSpan: 6, rowSpan: 1, kind: 'markdown' },
        { id: 'R', col: 6, row: 0, colSpan: 6, rowSpan: 1, kind: 'markdown' },
      ],
      totalCols: 12,
    };
    // shrink A 4 -> 2: B does NOT rise (no gravity); A just occupies less.
    const shrunk = pushResize(base, 'A', 2);
    expect(shrunk.ok).toBe(true);
    if (!shrunk.ok) return;
    expect(shrunk.state.blocks.find((b) => b.id === 'A')!.rowSpan).toBe(2);
    expect(shrunk.state.blocks.find((b) => b.id === 'B')!.row).toBe(4); // unmoved
    expect(shrunk.state.blocks.find((b) => b.id === 'R')!.row).toBe(0); // disjoint, unmoved
    expect(validateState(shrunk.state, { gravity: false }).ok).toBe(true);
    // and grow-then-shrink-from-base round trip back to base
    assertReversible(base, 'A', 6, ['R']);
  });
});
```

- [ ] **Step 2: Run — confirm GREEN.** From `packages/grid-engine`:

```
bun run test
```

Expected: all green; the 6 fixture tests pass. Example tail:

```
 Test Files  4 passed (4)
      Tests  58 passed (58)
```

If any fixture fails on the exact-return assertion, that is a real bug in `pushResize` (not the test) — fix the op's displacement, do not weaken the assertion to "gravity-stable".

- [ ] **Step 3: Commit.**

```
git add packages/grid-engine/src/__tests__/push-resize.test.ts
git commit -m "test(grid-engine): pushResize named reversibility fixtures (GWK/double-bridge/stack/disjoint/cascade/gravity-off)"
```

---

### Task 6: determinism + termination (RED → GREEN)

**Files:**
- Test: `packages/grid-engine/src/__tests__/push-resize.test.ts` (Modify — append describe block)

- [ ] **Step 1: Append determinism + termination tests.** Add to `packages/grid-engine/src/__tests__/push-resize.test.ts`:

```ts
describe('pushResize: determinism + termination', () => {
  function buildStack(n: number, cols: number): GridState {
    const blocks: Block[] = [];
    for (let i = 0; i < n; i++) {
      blocks.push({
        id: `b${i}`,
        col: 0,
        row: i,
        colSpan: cols,
        rowSpan: 1,
        kind: 'markdown',
      });
    }
    return { blocks, totalCols: cols };
  }

  test('two identical calls produce identical output (deterministic)', () => {
    const s = buildStack(200, 12);
    const a = pushResize(s, 'b0', 5);
    const b = pushResize(s, 'b0', 5);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(norm(a.state)).toBe(norm(b.state));
  });

  test('terminates on a deep same-column cascade (B=300) and stays no-overlap', () => {
    const s = buildStack(300, 12);
    const r = pushResize(s, 'b0', 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // b0 grew to 10 rows; every block below cascaded down, no overlap.
    expect(r.state.blocks.find((b) => b.id === 'b0')!.rowSpan).toBe(10);
    expect(validateState(r.state, { gravity: false }).ok).toBe(true);
    // each pushed block's row strictly increased (push-down only, never up)
    for (let i = 1; i < 300; i++) {
      const before = s.blocks.find((b) => b.id === `b${i}`)!.row;
      const after = r.state.blocks.find((b) => b.id === `b${i}`)!.row;
      expect(after).toBeGreaterThanOrEqual(before);
    }
  });

  test('idempotent re-apply: pushResize to the same target twice = once', () => {
    const s = buildStack(50, 12);
    const once = pushResize(s, 'b0', 6);
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    const twice = pushResize(once.state, 'b0', 6);
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(norm(twice.state)).toBe(norm(once.state));
  });
});
```

- [ ] **Step 2: Run — confirm GREEN.** From `packages/grid-engine`:

```
bun run test
```

Expected tail (3 tests added):

```
 Test Files  4 passed (4)
      Tests  61 passed (61)
```

- [ ] **Step 3: Commit.**

```
git add packages/grid-engine/src/__tests__/push-resize.test.ts
git commit -m "test(grid-engine): pushResize determinism, termination on deep cascade, idempotence"
```

---

### Task 7: perf budget test (timing harness + explicit per-op latency budget)

**Files:**
- Test: `packages/grid-engine/src/__tests__/push-resize.perf.test.ts` (Create)

The red-team requires a measurable perf gate: existing property tests assert invariants but never time anything. This task adds an explicit per-op latency budget for `pushResize`. It also CORRECTS the spec's "50k" wording: the existing property suite runs 5 seeds × 2000 = 10k op-applications (not 50k); this perf harness independently runs 1000 reconciles on a B=500 stack and asserts a wall-clock budget. The budget is deliberately generous (CI machines vary) but tight enough to catch a quadratic regression: a true O(B) cascade at B=500 is sub-millisecond locally; we gate p-mean at < 5ms/op and the full 1000-iter run at < 2s.

- [ ] **Step 1: Create the perf test.** Create `packages/grid-engine/src/__tests__/push-resize.perf.test.ts`:

```ts
/**
 * Perf gate for pushResize (red-team requirement §8.2).
 *
 * The existing property suite runs 5 seeds x 2000 = 10k op-applications and
 * asserts ONLY invariants — it times nothing, so a quadratic/cubic regression
 * would pass green. This harness adds an explicit per-op LATENCY BUDGET.
 *
 * NOTE: the spec text says "50k"; the real figure is 10k (5x2000) for the
 * property suite. This harness uses 1000 reconciles on a B=500 stack — the
 * worst realistic autofit case (a tall grower atop a full-width column stack).
 */
import { describe, expect, test } from 'vitest';
import { type Block, type GridState, pushResize } from '../index';

const BLOCKS = 500;
const ITERATIONS = 1000;
const PER_OP_BUDGET_MS = 5; // mean per reconcile; catches O(B^2) blow-up
const TOTAL_BUDGET_MS = 2000; // wall-clock ceiling for the whole harness

function buildStack(n: number, cols: number): GridState {
  const blocks: Block[] = [];
  for (let i = 0; i < n; i++) {
    blocks.push({
      id: `b${i}`,
      col: 0,
      row: i,
      colSpan: cols,
      rowSpan: 1,
      kind: 'markdown',
    });
  }
  return { blocks, totalCols: cols };
}

describe('pushResize perf budget', () => {
  test(`${ITERATIONS} reconciles on B=${BLOCKS}: mean < ${PER_OP_BUDGET_MS}ms/op, total < ${TOTAL_BUDGET_MS}ms`, () => {
    const base = buildStack(BLOCKS, 12);
    // warm up JIT so the first call doesn't skew the mean
    pushResize(base, 'b0', 4);

    const t0 = performance.now();
    for (let k = 0; k < ITERATIONS; k++) {
      // re-push from the SAME base every iteration (C5 reconcile-from-base);
      // target varies 1..8 to simulate grow/shrink during a typing gesture.
      const target = 1 + (k % 8);
      const r = pushResize(base, 'b0', target);
      if (!r.ok) throw new Error(`reconcile failed at k=${k}: ${r.error}`);
    }
    const totalMs = performance.now() - t0;
    const perOpMs = totalMs / ITERATIONS;

    // visible so a regression is diagnosable from CI logs, not just red/green
    // eslint-disable-next-line no-console
    console.log(
      `[pushResize perf] B=${BLOCKS} iters=${ITERATIONS} total=${totalMs.toFixed(1)}ms mean=${perOpMs.toFixed(4)}ms/op`,
    );

    expect(perOpMs).toBeLessThan(PER_OP_BUDGET_MS);
    expect(totalMs).toBeLessThan(TOTAL_BUDGET_MS);
  });
});
```

- [ ] **Step 2: Run — confirm GREEN and read the printed latency.** From `packages/grid-engine`:

```
bun run test
```

Expected: the perf test passes and prints a line like (numbers are machine-dependent; the assertion, not the absolute value, is the gate):

```
[pushResize perf] B=500 iters=1000 total=...ms mean=...ms/op
```

with the final summary, e.g.

```
 Test Files  5 passed (5)
      Tests  62 passed (62)
```

If `mean` is near or above 5ms/op, the displacement loop is super-linear — investigate the per-move full re-sort (a victim-set / column-bucketed scan removes the O(B) re-sort per move) before relaxing the budget.

- [ ] **Step 3: Commit.**

```
git add packages/grid-engine/src/__tests__/push-resize.perf.test.ts
git commit -m "test(grid-engine): pushResize perf budget (1000 reconciles @ B=500, mean<5ms/op)"
```

---

### Task 8: export verification + CONTRACT.md op-table update

**Files:**
- Modify: `packages/grid-engine/CONTRACT.md`
- Test: (re-uses existing suites — no new test file)

- [ ] **Step 1: Confirm `pushResize` is exported and importable.** It was added to the barrel in Task 1 Step 5; the tests already import it from `../index`. Re-run the whole suite from `packages/grid-engine` as the export-verification gate:

```
bun run test
```

Expected: all suites green (the new file imports `pushResize` from `../index`, which proves the export resolves):

```
 Test Files  5 passed (5)
      Tests  62 passed (62)
```

- [ ] **Step 2: Add `pushResize` to the CONTRACT State-mutation table.** In `packages/grid-engine/CONTRACT.md`, insert a new row after the `transformBlock` row (line ~130) in the State mutation table:

```
| `pushResize` | `(state, id, newRowSpan, opts?) → OpResult` | **false（永不跑 gravity）** | id not found / invalid span / out of bounds |
```

- [ ] **Step 3: Add the "Downward displacement" algorithm note.** In `packages/grid-engine/CONTRACT.md`, under the algorithm-details area, add this subsection (place it adjacent to the gravity algorithm note):

```
#### Downward displacement (pushResize — autofit grow/shrink)

`pushResize(state, id, newRowSpan, opts?)` 把 block `id` 的 `rowSpan` 设为
`newRowSpan`，对每个与撑开后 footprint AABB 碰撞的块，**按垂直 overlap 深度向下推**，
top-down 递归直到无碰撞。与 grow 共一引擎服务 shrink：caller 传 gesture 的 base 快照 +
目标 rowSpan，`reconcile(base, T) = pushResize(base, growerId, T)`，每次从同一 base 重推
保证可逆（C5）。

- **永不调用 `applyGravity`**：autofit 手势期内 gravity 挂起；提交时一遍 applyGravity
  的 COMMIT RULE 住 web 控制器，不在 engine。`opts.gravity` 不被位移过程参考。
- **守卫**：`newRowSpan` 须 integer ≥ 1 且 col/colSpan 合法（`isRegionInBounds`），否则
  `{ ok:false }`（`invalid span` / `out of bounds`）；未知 id → `no such block`。垂直无
  上界，grow 永不因没空间而 reject。
- **复杂度 / 终止性**：每次位移使某块 row 严格增大、从不减小，grid 垂直无界 → 终止。
  同列 cascade O(B)；最坏 O(B²)。determinism：碰撞处理顺序 = row asc, col asc, id asc。
- **纯 / kind-opaque / leaf**（invariant 6/7）：返回新 state，不就地改 input；只改 `row`
  与 grower 的 `rowSpan`，col/colSpan/kind/id 不变。
```

- [ ] **Step 4: Commit.**

```
git add packages/grid-engine/CONTRACT.md
git commit -m "docs(grid-engine): CONTRACT — pushResize op row + downward-displacement algorithm note"
```


## Phase: schema-format

_Depends on: "Nothing blocks this subsystem — it is the foundation (orderHint 1). It should land FIRST.\n\nDownstream depends on THIS:\n- engine-op (pushResize) is independent but reconcile/web consume minRowSpan from these columns.\n- route-guard subsystem: `parseWorkingState` must parse `autofit`/`minRowSpan`, and the working-state PUT 422 check `rowSpan >= minRowSpan >= 1` reads `blocks.min_row_span`.\n- export-pipeline subsystem: must extend `exporter.ts` block mapping to emit `autofit`/`minRowSpan`, the importer to read them, AND update `apps/server/test/export-import.test.ts` lines 49 & 274 (`expect(manifest.formatVersion).toBe(4)` → 5). My Task 3 Step 3 explicitly surfaces those two failures as belonging to that subsystem so they are not silently left red.\n- publish subsystem: thread `autofit` through `PublishedDocShape.blocks` + `BlockFrameProps` (PublishedDoc type in db/schema.ts)."_

**File structure:**
- Modify `apps/server/src/db/schema.ts` — add `blocks.autofit` (TEXT NULL) + `blocks.min_row_span` (INTEGER NULL) drizzle columns; extend `PublishedDoc.blocks[]` shape with optional `autofit`/`minRowSpan`.
- Create `apps/server/drizzle/0008_autofit.sql` — drizzle-kit-generated `ALTER TABLE blocks ADD ...` migration (forward-only/additive, ADR-0020); bumps applier-derived schemaVersion to 8.
- Create `apps/server/drizzle/meta/0008_snapshot.json` — drizzle-kit-generated snapshot (paired with the .sql, must be committed for the tamper/diff chain).
- Modify `apps/server/drizzle/meta/_journal.json` — drizzle-kit appends the `0008_autofit` entry.
- Modify `apps/server/src/export/format.ts` — bump `FORMAT_VERSION` 4→5; add `autofit: string | null` + `minRowSpan: number | null` to `ExportBlock`.
- Modify `apps/server/src/export/migrate-format.ts` — add the v5 up/down `FormatTransform` (up defaults minRowSpan to engine minimum 1, NOT current rowSpan; down drops both fields with a BEHAVIORAL loss line for minRowSpan).
- Modify `apps/server/test/export-format.test.ts` — update `FORMAT_VERSION` assertion to 5; add v4→v5 round-trip + floor-not-raised tests.

### Task 9: Add `blocks.autofit` + `blocks.min_row_span` drizzle columns and generate migration 0008

**Files:**
- Modify: `apps/server/src/db/schema.ts`
- Create: `apps/server/drizzle/0008_autofit.sql` (drizzle-kit generated)
- Create: `apps/server/drizzle/meta/0008_snapshot.json` (drizzle-kit generated)
- Modify: `apps/server/drizzle/meta/_journal.json` (drizzle-kit generated)
- Test: `apps/server/test/migrate.test.ts` (verify only; the real schemaVersion is not hardcoded there)

- [ ] **Step 1: Add the two nullable columns to the `blocks` table in the drizzle schema.**
  In `apps/server/src/db/schema.ts`, the `blocks` table object currently ends with `shell` then `content`. Insert the two new block-level metadata columns immediately after `shell` (before `content`), so the generated DDL groups them with the other author-metadata columns. Replace this block:
  ```ts
      /** Author-picked theme shell option id (M6-D3); null = default shell. */
      shell: text('shell'),
      content: text('content').notNull(),
  ```
  with:
  ```ts
      /** Author-picked theme shell option id (M6-D3); null = default shell. */
      shell: text('shell'),
      /** Block-level autofit mode (block-autofit-height): 'off' | 'grow' |
       * 'grow+shrink'; null = off/legacy. MVP writes/reads only 'grow' and
       * treats null/'off' as off. TEXT (not int-bool) so the A→three-state
       * upgrade is pure interpretation-widening, no second DDL migration. */
      autofit: text('autofit'),
      /** Author floor = minimum intended rowSpan (block-autofit-height);
       * null = off/legacy. Engine stays floor-blind; this is web/server
       * metadata, the `max(floor, fit)` reconcile reads it. */
      minRowSpan: integer('min_row_span'),
      content: text('content').notNull(),
  ```

- [ ] **Step 2: Generate migration 0008 with drizzle-kit (there is no npm script — invoke the CLI directly).**
  From `apps/server`, run:
  ```
  cd apps/server && bun run drizzle-kit generate --name autofit
  ```
  Expected stdout includes a diff summary and a written file path, e.g.:
  ```
  Reading config file '.../apps/server/drizzle.config.ts'
  2 tables ... 
  [✓] Your SQL migration file ➜ drizzle/0008_autofit.sql 🚀
  ```
  This also writes `drizzle/meta/0008_snapshot.json` and appends an entry to `drizzle/meta/_journal.json` (do NOT hand-edit those two — they are generated).

- [ ] **Step 3: Verify the generated SQL is exactly two additive ALTERs (forward-only/additive per ADR-0020).**
  Read `apps/server/drizzle/0008_autofit.sql`. It MUST be exactly (drizzle emits one statement per line joined by the breakpoint marker; column order follows schema declaration order, so `autofit` then `min_row_span`):
  ```sql
  ALTER TABLE `blocks` ADD `autofit` text;--> statement-breakpoint
  ALTER TABLE `blocks` ADD `min_row_span` integer;
  ```
  If drizzle-kit instead emits a table rebuild (`CREATE TABLE __new_blocks` + copy) rather than `ALTER TABLE ... ADD`, STOP — that violates the additive-only rule and means the composite-PK/index diff tripped a rebuild; re-check the schema edit only added nullable columns and nothing else changed. Confirm both columns are nullable (no `NOT NULL`, no `DEFAULT`).

- [ ] **Step 4: Confirm the migration applier picks up 0008 and derives schemaVersion = 8.**
  `apps/server/src/db/migrate.ts` derives `schemaVersion` from the highest migration filename index (`last.slice(0, 4)`), so adding `0008_autofit.sql` makes the runtime schemaVersion 8 with no code change. Verify a fresh DB applies cleanly and the new columns are usable:
  ```
  cd apps/server && bun -e "import {createDb} from './src/db/client.ts'; const {db,schemaVersion}=createDb(':memory:'); console.log('schemaVersion',schemaVersion); db.\$client.query('INSERT INTO notepages (id,slug,title,visibility,gravity_enabled,sort_key,created_at,updated_at) VALUES (?,?,?,?,1,0,1,1)').run('p1','s1','T','private'); db.\$client.query('INSERT INTO blocks (id,notepage_id,kind,col,row,col_span,row_span,autofit,min_row_span,content) VALUES (?,?,?,?,?,?,?,?,?,?)').run('b1','p1','markdown',0,0,12,1,'grow',1,'{}'); console.log(db.\$client.query('SELECT id,autofit,min_row_span FROM blocks').all());"
  ```
  Expected output:
  ```
  schemaVersion 8
  [ { id: "b1", autofit: "grow", min_row_span: 1 } ]
  ```

- [ ] **Step 5: Run the migration applier test suite (unchanged — it uses synthetic dirs / `toBeGreaterThanOrEqual(0)`, so no expected-version edit is needed).**
  ```
  cd apps/server && bun test test/migrate.test.ts
  ```
  Expected: all tests pass (the real journal count is not hardcoded in this file; the baseline/idempotent/guard tests use fabricated migration dirs). Output ends with a green `X pass  0 fail` summary.

- [ ] **Step 6: Commit.**
  ```
  git add apps/server/src/db/schema.ts apps/server/drizzle/0008_autofit.sql apps/server/drizzle/meta/0008_snapshot.json apps/server/drizzle/meta/_journal.json
  git commit -m "$(cat <<'EOF'
  feat(server): add blocks.autofit + min_row_span columns (migration 0008)

  Block-level autofit metadata for limited-height+grow. autofit TEXT NULL
  ('off'|'grow'|'grow+shrink'), min_row_span INTEGER NULL (author floor).
  Additive-only per ADR-0020; existing blocks = autofit null (off),
  min_row_span null. schemaVersion -> 8.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 10: Bump FORMAT_VERSION to 5, add ExportBlock fields, and the paired v5 up/down transform

**Files:**
- Modify: `apps/server/src/export/format.ts`
- Modify: `apps/server/src/export/migrate-format.ts`
- Test: `apps/server/test/export-format.test.ts`

- [ ] **Step 1: Bump `FORMAT_VERSION` and add the two `ExportBlock` fields in `format.ts`.**
  In `apps/server/src/export/format.ts`, change:
  ```ts
  export const FORMAT_VERSION = 4;
  ```
  to:
  ```ts
  export const FORMAT_VERSION = 5;
  ```
  Then in the `ExportBlock` type, replace:
  ```ts
    /** Author-picked theme shell option id (v4+); null = default shell. */
    shell: string | null;
    content: unknown; // kind-owned, verbatim
  ```
  with:
  ```ts
    /** Author-picked theme shell option id (v4+); null = default shell. */
    shell: string | null;
    /** Block-level autofit mode (v5+): 'off' | 'grow' | 'grow+shrink';
     * null = off/legacy. Block-level metadata, not kind content. */
    autofit: string | null;
    /** Author floor = minimum intended rowSpan (v5+); null = off/legacy.
     * Engine minimum is 1; up() defaults to that, never to current rowSpan. */
    minRowSpan: number | null;
    content: unknown; // kind-owned, verbatim
  ```

- [ ] **Step 2: Wire the two new fields into the exporter block map (keeps `tsc --noEmit` green this commit).**
  Adding the required fields to the `ExportBlock` TYPE makes the exporter's object literal fail typecheck until it supplies them. In `apps/server/src/export/exporter.ts` (~line 111), the block-row → `ExportBlock` map currently maps `shell: b.shell,` then `content: …`. Insert the two new fields right after `shell` (canonical key order: …, `shell`, `autofit`, `minRowSpan`, `content`), so it reads:
  ```ts
    shell: b.shell,
    autofit: b.autofit,
    minRowSpan: b.minRowSpan,
    content: /* existing kind-owned content expression — unchanged */,
  ```
  Run `cd apps/server && bun run tsc --noEmit` (or the repo's typecheck script) and confirm no missing-property errors on `ExportBlock`. The importer reads these fields back via the v5 transform's persisted JSON; no separate importer edit is required because the working-state PUT (route-guard subsystem) is the persistence path and the round-trip test in Task 11 covers the JSON shape.

- [ ] **Step 3: Extend the `PublishedDoc.blocks[]` type in `db/schema.ts` to carry the two optional fields.**
  The v5 up()/down() transform (Step 5 below) adds/drops `autofit`/`minRowSpan` on `published.blocks[]`, so the `PublishedDoc` TS type in `apps/server/src/db/schema.ts` must carry them or the published-doc JSON shape and the type diverge. In `apps/server/src/db/schema.ts`, the `PublishedDoc` type's `blocks[]` element currently ends with `shell?: string | null;` before `content`. Replace:
  ```ts
    shell?: string | null;
    content: unknown;
  ```
  with:
  ```ts
    shell?: string | null;
    /** Block-level autofit mode (block-autofit-height); null/absent = off. */
    autofit?: string | null;
    /** Author floor = minimum intended rowSpan; null/absent = off/legacy. */
    minRowSpan?: number | null;
    content: unknown;
  ```
  (Optional — match the exact field name/order to the surrounding `PublishedDoc.blocks[]` element shape; the two fields are optional so existing published docs parse unchanged.)

- [ ] **Step 4: Append the v5 transform to the production registry in `migrate-format.ts`.**
  In `apps/server/src/export/migrate-format.ts`, the `FORMAT_TRANSFORMS` array currently ends with the `to: 4` object. Add a `to: 5` object as the new last element of the array (after the v4 object's closing `},` and before the array's closing `];`). The up() inserts `autofit:null` + `minRowSpan:null` on every working block AND every published-doc block, preserving canonical key order (insert right after `shell`, before `content`); the down() drops both, emitting a BEHAVIORAL loss line for minRowSpan and a neutral one for autofit:
  ```ts
    {
      // v5: block-level autofit metadata — autofit mode + author floor
      // (block-autofit-height). Block-level (web/server owned), not kind
      // content. up() defaults BOTH to null (= off/legacy); the floor
      // default is the ENGINE MINIMUM (null→treated as 1), never the
      // current rowSpan, so a v6→v5→v6 (or v5→v4→v5) round trip can never
      // raise the floor to a content-grown height.
      to: 5,
      up(files) {
        const addAutofit = (b: Record<string, unknown>): Record<string, unknown> => {
          // explicit key order: …, shell, autofit, minRowSpan, content, …
          const { shell, content, ...brest } = b as { shell?: unknown; content?: unknown };
          return { ...brest, shell, autofit: null, minRowSpan: null, content };
        };
        const next: JsonFiles = new Map();
        for (const [path, value] of files) {
          if (path.endsWith('.page.json')) {
            const { blocks, published, ...rest } = value as Record<string, unknown> & {
              blocks: Array<Record<string, unknown>>;
              published?: Record<string, unknown> | null;
            };
            const upPublished =
              published == null || typeof published !== 'object'
                ? published
                : {
                    ...published,
                    blocks: ((published.blocks as Array<Record<string, unknown>>) ?? []).map(addAutofit),
                  };
            next.set(path, { ...rest, published: upPublished, blocks: blocks.map(addAutofit) });
          } else {
            next.set(path, value);
          }
        }
        return next;
      },
      down(files) {
        const next: JsonFiles = new Map();
        const losses: string[] = [];
        const dropAutofit = (
          b: Record<string, unknown>,
          path: string,
          where: string,
        ): Record<string, unknown> => {
          const { autofit, minRowSpan, ...brest } = b as { autofit?: unknown; minRowSpan?: unknown };
          if (autofit != null && autofit !== 'off') {
            losses.push(`${path}: ${where}block "${String(brest.id)}" autofit "${String(autofit)}" dropped (v4 has no autofit)`);
          }
          if (minRowSpan != null) {
            // BEHAVIORAL loss, not cosmetic: dropping the floor changes how
            // the block behaves on re-import — its minimum height resets and
            // it can no longer shrink below the current rendered content.
            losses.push(
              `${path}: ${where}block "${String(brest.id)}" min height resets, can no longer shrink below current (v4 has no minRowSpan)`,
            );
          }
          return brest;
        };
        for (const [path, value] of files) {
          if (path.endsWith('.page.json')) {
            const { blocks, published, ...rest } = value as Record<string, unknown> & {
              blocks: Array<Record<string, unknown>>;
              published?: Record<string, unknown> | null;
            };
            const downPublished =
              published == null || typeof published !== 'object'
                ? published
                : {
                    ...published,
                    blocks: ((published.blocks as Array<Record<string, unknown>>) ?? []).map((b) =>
                      dropAutofit(b, path, 'published '),
                    ),
                  };
            next.set(path, { ...rest, published: downPublished, blocks: blocks.map((b) => dropAutofit(b, path, '')) });
          } else {
            next.set(path, value);
          }
        }
        return { files: next, losses };
      },
    },
  ```

- [ ] **Step 5: Update the `FORMAT_VERSION` assertion in `export-format.test.ts`.**
  In `apps/server/test/export-format.test.ts`, replace:
  ```ts
    test('FORMAT_VERSION is 4', () => {
      expect(FORMAT_VERSION).toBe(4);
    });
  ```
  with:
  ```ts
    test('FORMAT_VERSION is 5', () => {
      expect(FORMAT_VERSION).toBe(5);
    });
  ```

- [ ] **Step 6: Patch the two `formatVersion === 4` assertions in `export-import.test.ts` (keeps `bun test` green this commit).**
  The format bump turns two assertions red in `apps/server/test/export-import.test.ts` (~line 49 and ~line 274). At each, replace:
  ```ts
    expect(manifest.formatVersion).toBe(4);
  ```
  with:
  ```ts
    expect(manifest.formatVersion).toBe(5);
  ```
  (Two occurrences — match the exact `manifest.formatVersion` / `formatVersion` accessor used at each site; both must become `5`.)

- [ ] **Step 7: Run the format helper + migration tests (expect the existing production registry round-trip suite to still pass through v5).**
  ```
  cd apps/server && bun test test/export-format.test.ts test/export-import.test.ts
  ```
  Expected: the `FORMAT_VERSION is 5` test passes and both `export-import` formatVersion assertions are green at 5. NOTE: the existing `production format registry v1→v4` describe block calls `upgradeToVersion(productionV1Files(), 4)` and `downgradeToVersion(up, 1)` with explicit target 4 — those still pass because they never reach v5. The full-chain test in Task 11 exercises v5. Output ends with green `X pass  0 fail`.

- [ ] **Step 8: Commit.**
  ```
  git add apps/server/src/export/format.ts apps/server/src/export/migrate-format.ts apps/server/src/export/exporter.ts apps/server/src/db/schema.ts apps/server/test/export-format.test.ts apps/server/test/export-import.test.ts
  git commit -m "$(cat <<'EOF'
  feat(server): export format v5 — block autofit + minRowSpan transform

  FORMAT_VERSION 4->5. ExportBlock gains autofit (string|null) +
  minRowSpan (number|null); exporter map emits them and PublishedDoc.blocks[]
  type carries them. Paired up/down: up() defaults both to null
  (off/legacy, floor = engine minimum not current rowSpan); down() drops
  them, BEHAVIORAL loss line for minRowSpan ("min height resets, can no
  longer shrink below current"). export-import.test formatVersion 4->5.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 11: Round-trip test asserting v5→v4→v5 does NOT raise the floor

**Files:**
- Test: `apps/server/test/export-format.test.ts`

- [ ] **Step 1: Add a v5 round-trip + floor-not-raised describe block at the end of `export-format.test.ts`.**
  Append the following describe block to the end of `apps/server/test/export-format.test.ts` (after the existing `production format registry v1→v4` block). It builds a v4 page whose block has `rowSpan: 4` (i.e. content has grown the block to 4 rows), runs v4→v5→v4→v5, and asserts the floor is NOT silently raised to 4 — up() must default `minRowSpan` to null (engine minimum), never the current rowSpan:
  ```ts
  // ----- v5: block autofit + minRowSpan (block-autofit-height) -----

  /** A v4 bundle whose single block has rowSpan 4 — i.e. content has
   * already grown the block past any author floor. Used to prove the
   * down→up floor-reset rule. */
  function productionV4Files(): JsonFiles {
    return upgradeToVersion(
      new Map<string, unknown>([
        ['manifest.json', { formatVersion: 1, blobs: [] }],
        [
          'tree/a.page.json',
          {
            id: 'p1', slug: 'a', title: 'A', visibility: 'public', gravityEnabled: true,
            sortKey: 0, createdAt: 1, updatedAt: 2,
            published: {
              title: 'A', gravityEnabled: true,
              blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 4, content: {} }],
              publishedAt: 3,
            },
            blocks: [{ id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 4, content: {} }],
          },
        ],
      ]),
      4,
    );
  }

  describe('production format registry v5 (block autofit)', () => {
    test('v4→v5 adds autofit=null + minRowSpan=null to working AND published blocks', () => {
      const up = upgradeToVersion(productionV4Files(), 5);
      const page = up.get('tree/a.page.json') as {
        blocks: Array<{ autofit: unknown; minRowSpan: unknown; rowSpan: number }>;
        published: { blocks: Array<{ autofit: unknown; minRowSpan: unknown }> };
      };
      expect(page.blocks[0]!.autofit).toBeNull();
      expect(page.blocks[0]!.minRowSpan).toBeNull(); // floor = engine minimum, NOT rowSpan(4)
      expect(page.published.blocks[0]!.autofit).toBeNull();
      expect(page.published.blocks[0]!.minRowSpan).toBeNull();
    });

    test('v4→v5→v4 round trip is lossless when autofit is off (null)', () => {
      const v4 = productionV4Files();
      const up = upgradeToVersion(v4, 5);
      const { files, losses } = downgradeToVersion(up, 4);
      expect(losses).toEqual([]); // null autofit / null floor are not behavioral losses
      expect(files.get('tree/a.page.json')).toEqual(v4.get('tree/a.page.json'));
    });

    test('v5→v4 drops autofit + emits BEHAVIORAL minRowSpan loss when floor is set', () => {
      const up = upgradeToVersion(productionV4Files(), 5);
      const page = up.get('tree/a.page.json') as {
        blocks: Array<{ autofit: unknown; minRowSpan: unknown }>;
        published: { blocks: Array<{ autofit: unknown; minRowSpan: unknown }> };
      };
      page.blocks[0]!.autofit = 'grow';
      page.blocks[0]!.minRowSpan = 2;
      page.published.blocks[0]!.autofit = 'grow';
      page.published.blocks[0]!.minRowSpan = 2;

      const { files, losses } = downgradeToVersion(up, 4);
      expect((files.get('manifest.json') as { formatVersion: number }).formatVersion).toBe(4);
      // behavioral loss wording for the floor, on both working + published block
      expect(losses.filter((l) => l.includes('min height resets, can no longer shrink below current')).length).toBe(2);
      expect(losses.filter((l) => l.includes('autofit "grow" dropped')).length).toBe(2);
      // the v4 block carries neither axis
      const v4page = files.get('tree/a.page.json') as { blocks: Array<Record<string, unknown>> };
      expect('autofit' in v4page.blocks[0]!).toBe(false);
      expect('minRowSpan' in v4page.blocks[0]!).toBe(false);
    });

    test('v5→v4→v5 does NOT raise the floor (the load-bearing assertion)', () => {
      // start at v5 with a SET floor of 1 on a block already grown to rowSpan 4
      const up = upgradeToVersion(productionV4Files(), 5);
      const page0 = up.get('tree/a.page.json') as { blocks: Array<{ minRowSpan: unknown }> };
      page0.blocks[0]!.minRowSpan = 1; // author floor = 1, well below content-grown rowSpan 4

      // round-trip through v4 (which cannot express the floor) and back to v5
      const { files: v4 } = downgradeToVersion(up, 4);
      const reUp = upgradeToVersion(v4, 5);
      const page1 = reUp.get('tree/a.page.json') as {
        blocks: Array<{ minRowSpan: unknown; rowSpan: number }>;
      };
      // floor came back as the engine minimum (null), NOT raised to the
      // current rowSpan (4). Raising it would permanently destroy the
      // author's "floor below current content" intent.
      expect(page1.blocks[0]!.minRowSpan).toBeNull();
      expect(page1.blocks[0]!.minRowSpan).not.toBe(4);
      expect(page1.blocks[0]!.rowSpan).toBe(4); // rowSpan itself is preserved across the trip
    });
  });
  ```

- [ ] **Step 2: Run the full export-format suite.**
  ```
  cd apps/server && bun test test/export-format.test.ts
  ```
  Expected: all tests pass, including the four new `production format registry v5 (block autofit)` cases. Output ends with green `X pass  0 fail`.

- [ ] **Step 3: Run the whole server test suite to confirm nothing downstream broke from the FORMAT_VERSION bump.**
  ```
  cd apps/server && bun test
  ```
  Expected: `export-import.test.ts` will FAIL on its `expect(manifest.formatVersion).toBe(4)` assertions (lines 49, 274) UNLESS the export-pipeline subsystem has already updated them to 5. If those are the only failures, they belong to the export-pipeline subsystem (it owns the exporter + import + manifest assertions) — note them and do not patch them here. All other suites must be green.

- [ ] **Step 4: Commit.**
  ```
  git add apps/server/test/export-format.test.ts
  git commit -m "$(cat <<'EOF'
  test(server): v5 format round-trip — floor is never raised on re-import

  Asserts v5->v4->v5 returns minRowSpan to the engine minimum (null),
  never the content-grown rowSpan, so "floor below current content"
  author intent survives a downgrade round trip. Also asserts the
  behavioral minRowSpan loss line + autofit drop on working + published.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```


## Phase: server-route (working-state route guard: parse autofit/minRowSpan + floor-invariant 422)

_Depends on: "DATA-MODEL / MIGRATION subsystem MUST land first: the PUT insert (Task 1 Step 5b) and `loadWorkingBlocks` read (Step 6) reference `blocks.autofit` (TEXT NULL) + `blocks.min_row_span` (INTEGER NULL) columns and the drizzle `BlockRow` type carrying them. Until that migration + schema.ts change exists, Task 1's round-trip/read-back tests fail at insert/select. The parse logic and the floor-invariant 422 guard (Task 2) are self-contained and do NOT depend on persistence — they operate on the parsed in-memory body. The web client subsystem depends on THIS subsystem's `autofit`/`minRowSpan` field names + the 422 contract for its PUT payload + error handling."_

**File structure:**
- Modify `apps/server/src/routes/notepages.ts` — `WorkingBlock` type gains `autofit: string | null` + `minRowSpan: number | null`; `parseWorkingState` parses both optional fields with strict type guards; PUT `/notepages/:id/working-state` handler explicitly strips both fields out of the engine `GridState` projection (keeps engine floor-blind) and, AFTER `validateState` passes, runs a cross-field guard returning 422 `'floor invariant violation'` if any block has `minRowSpan != null` and (`rowSpan < minRowSpan` OR `minRowSpan < 1` OR non-integer); insert carries both columns through (gated on the migration subsystem adding the DB columns).
- Test `apps/server/test/autofit-route.test.ts` (Create) — `bun:test` suite covering parse acceptance/rejection of `autofit`/`minRowSpan`, the floor-invariant 422 (no partial apply), engine-floor-blindness (engine never sees the fields), and round-trip persistence of the two fields.

### Task 12: `parseWorkingState` parses optional `autofit` + `minRowSpan` per block

The route's `WorkingBlock` (apps/server/src/routes/notepages.ts:21) and `parseWorkingState` (line 63) currently carry only geometry + `shell` + `content`. Add the two block-metadata fields from the pinned contract. Both are OPTIONAL on the wire (legacy clients omit them) and absence means off/legacy: `autofit` absent/`null`/non-string → `null`; `minRowSpan` absent/`null` → `null`. Malformed-but-present values (e.g. `autofit: 5`, `minRowSpan: "3"`) reject the whole body with the existing `null` return (→ 400). This task is parse-only; the 422 cross-field guard is Task 2.

**Files:**
- Modify: `apps/server/src/routes/notepages.ts`
- Create: `apps/server/test/autofit-route.test.ts`

- [ ] **Step 1: Write the failing parse tests (red).** Create `apps/server/test/autofit-route.test.ts` with the harness mirroring `api.test.ts`, plus the round-trip-of-fields assertions. The persistence-roundtrip test depends on the migration subsystem having added `blocks.autofit` + `blocks.min_row_span`; if those columns are not yet present this test will fail at insert — that is the intended signal that this subsystem lands AFTER the data-model migration (see dependsOn). Full file:

```ts
import { beforeEach, describe, expect, test } from 'bun:test';
import { createTestContext, json, type TestContext } from './helpers';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext();
});

async function createPage(title = 'Autofit Note'): Promise<{ id: string; slug: string }> {
  const res = await t.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title }) });
  expect(res.status).toBe(201);
  return json(res);
}

// A geometrically valid, gravity-on-legal markdown block at the given row.
function block(id: string, row: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'markdown',
    col: 0,
    row,
    colSpan: 12,
    rowSpan: 2,
    content: { markdown: 'hello' },
    ...extra,
  };
}

async function putWorking(id: string, body: object): Promise<Response> {
  return t.authed(`/api/notepages/${id}/working-state`, { method: 'PUT', body: JSON.stringify(body) });
}

describe('working-state: autofit + minRowSpan parsing', () => {
  test('legacy body without the fields still saves (200) and reads back null/null', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, { title: 'T', gravityEnabled: true, blocks: [block('b1', 0)] });
    expect(res.status).toBe(200);

    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks[0].autofit).toBeNull();
    expect(got.blocks[0].minRowSpan).toBeNull();
  });

  test('autofit "grow" + integer minRowSpan round-trip through working-state', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { autofit: 'grow', minRowSpan: 2 })],
    });
    expect(res.status).toBe(200);

    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks[0].autofit).toBe('grow');
    expect(got.blocks[0].minRowSpan).toBe(2);
  });

  test('explicit null fields are accepted as off/legacy', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { autofit: null, minRowSpan: null })],
    });
    expect(res.status).toBe(200);
    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks[0].autofit).toBeNull();
    expect(got.blocks[0].minRowSpan).toBeNull();
  });

  test('malformed autofit type (number) → 400 malformed working state', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { autofit: 5 })],
    });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('malformed working state');
  });

  test('malformed minRowSpan type (string) → 400 malformed working state', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { minRowSpan: '3' })],
    });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('malformed working state');
  });
});
```

- [ ] **Step 2: Run the tests, confirm red.** Run from the server package:

```
cd apps/server && bun test test/autofit-route.test.ts
```

Expected: the `round-trip` / `null/null` / `explicit null` tests FAIL (read-back `autofit`/`minRowSpan` are `undefined`, not `null`/`'grow'`/`2`, because neither `parseWorkingState`, the insert, nor `loadWorkingBlocks` know the fields yet); the two `malformed → 400` tests FAIL (currently 200, since unknown props are ignored). This red state confirms the tests exercise new behavior.

- [ ] **Step 3: Extend the `WorkingBlock` type.** In `apps/server/src/routes/notepages.ts`, add the two block-metadata fields (pinned contract: web/server owned, NOT engine). Replace the `WorkingBlock` type:

```ts
type WorkingBlock = {
  id: string;
  kind: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  /** Author-picked theme shell option id (M6-D3); null = default. */
  shell: string | null;
  /** Autofit mode (block autofit MVP); 'off'|'grow'|'grow+shrink', null = off/legacy. */
  autofit: string | null;
  /** Author-intent floor row span; null = off/legacy. */
  minRowSpan: number | null;
  content: unknown;
};
```

- [ ] **Step 4: Parse the two fields in `parseWorkingState`.** Add strict per-block guards. A present-but-wrong-typed value rejects the whole body (returns `null` → 400), matching the existing `shell` discipline. Replace the per-block validation + push in `parseWorkingState` (the block starting `if ( typeof r.id !== 'string' ...` through the `parsed.push({...})`) with:

```ts
    if (
      typeof r.id !== 'string' ||
      typeof r.kind !== 'string' ||
      typeof r.col !== 'number' ||
      typeof r.row !== 'number' ||
      typeof r.colSpan !== 'number' ||
      typeof r.rowSpan !== 'number' ||
      !('content' in r) ||
      (r.shell !== undefined && r.shell !== null && typeof r.shell !== 'string') ||
      (r.autofit !== undefined && r.autofit !== null && typeof r.autofit !== 'string') ||
      (r.minRowSpan !== undefined && r.minRowSpan !== null && typeof r.minRowSpan !== 'number')
    ) {
      return null;
    }
    parsed.push({
      id: r.id,
      kind: r.kind,
      col: r.col,
      row: r.row,
      colSpan: r.colSpan,
      rowSpan: r.rowSpan,
      shell: typeof r.shell === 'string' ? r.shell : null,
      autofit: typeof r.autofit === 'string' ? r.autofit : null,
      minRowSpan: typeof r.minRowSpan === 'number' ? r.minRowSpan : null,
      content: r.content,
    });
```

- [ ] **Step 5: Keep the engine projection floor-blind, and persist the new columns.** Two edits in the PUT handler.

(a) The `GridState` projection at line ~176 uses `...geom`, which would now leak `autofit`/`minRowSpan` into engine blocks. The engine `Block` type (packages/grid-engine/src/types.ts:23) is geometry+kind only and MUST stay floor-blind (spec §4.3). Explicitly destructure both out alongside `content`. Replace:

```ts
    const state: GridState = {
      totalCols: TOTAL_COLS,
      blocks: body.blocks.map(({ content: _content, ...geom }) => geom),
    };
```

with:

```ts
    // autofit + minRowSpan are block metadata, NOT engine geometry — strip
    // them so the engine stays floor-blind (spec §4.3). content is dropped too.
    const state: GridState = {
      totalCols: TOTAL_COLS,
      blocks: body.blocks.map(({ content: _content, autofit: _autofit, minRowSpan: _minRowSpan, ...geom }) => geom),
    };
```

(b) Carry both columns through the insert. Replace the `tx.insert(blocks).values({...})` object's body to add the two fields (DEPENDS on the data-model subsystem having added `blocks.autofit` TEXT + `blocks.min_row_span` INTEGER):

```ts
          .values({
            id: b.id,
            notepageId: page.id,
            kind: b.kind,
            col: b.col,
            row: b.row,
            colSpan: b.colSpan,
            rowSpan: b.rowSpan,
            shell: b.shell,
            autofit: b.autofit,
            minRowSpan: b.minRowSpan,
            content: JSON.stringify(b.content ?? null),
          })
```

- [ ] **Step 6: Surface the columns on read (`loadWorkingBlocks`).** So the round-trip test sees the fields. In `loadWorkingBlocks`, add to the mapped object (after `shell: row.shell,`):

```ts
      autofit: row.autofit,
      minRowSpan: row.minRowSpan,
```

- [ ] **Step 7: Run parse tests, confirm green.**

```
cd apps/server && bun test test/autofit-route.test.ts
```

Expected: all 5 tests in the `parsing` describe PASS. If the `round-trip`/`null` tests still fail at the insert with an SQLite "no such column" / unknown-key drizzle error, the migration subsystem has not landed `blocks.autofit` / `blocks.min_row_span` yet — that is the cross-subsystem dependency, not a bug in this code (see dependsOn).

- [ ] **Step 8: Typecheck + full server suite (no regressions).**

```
cd apps/server && bun run typecheck && bun test
```

Expected: `tsc --noEmit` clean (the explicit destructure in 5a keeps `GridState.blocks` assignable to engine `Block[]`); the existing `api.test.ts` `working-state save roundtrip`, `malformed body → 400`, overlap-422, and floating-422 tests still PASS unchanged.

- [ ] **Step 9: Commit.**

```
cd apps/server && git add -A && git commit -m "feat(server): working-state parses block autofit + minRowSpan (floor-blind engine)

parseWorkingState carries optional autofit/minRowSpan per block; PUT strips
both from the engine GridState projection (engine stays geometry-only) and
persists them. Round-trips through loadWorkingBlocks.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 13: Floor-invariant cross-field guard (`rowSpan >= minRowSpan >= 1`) → 422, no partial apply

Per spec §4.3 / §6 and the pinned ROUTE GUARD contract: because floor (`minRowSpan`) never enters the engine, `validateState` cannot enforce `rowSpan >= minRowSpan`. The route is the SOLE backstop. AFTER `validateState` passes, assert for every block whose `minRowSpan != null`: it is an integer, `minRowSpan >= 1`, and `rowSpan >= minRowSpan`. On violation return 422 `{ error: 'floor invariant violation' }` BEFORE the `db.transaction(...)` — so no partial apply (mirrors the existing overlap-422 behavior, validated by the unchanged-state assertion).

**Files:**
- Modify: `apps/server/src/routes/notepages.ts`
- Modify: `apps/server/test/autofit-route.test.ts`

- [ ] **Step 1: Add the failing guard tests (red).** Append a new describe to `apps/server/test/autofit-route.test.ts`. (Reuses `createPage`/`block`/`putWorking` from Task 1.) Add:

```ts
describe('working-state: floor invariant guard', () => {
  test('rowSpan < minRowSpan → 422 floor invariant violation, no partial apply', async () => {
    const { id } = await createPage();
    // seed a known-good state first, to prove the rejected PUT does not land
    expect(
      (await putWorking(id, { title: 'T', gravityEnabled: true, blocks: [block('seed', 0)] })).status,
    ).toBe(200);

    // rowSpan 2 < minRowSpan 4 — geometrically valid (passes validateState),
    // but violates the floor invariant the engine cannot see.
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { rowSpan: 2, minRowSpan: 4 })],
    });
    expect(res.status).toBe(422);
    expect((await json(res)).error).toBe('floor invariant violation');

    // state unchanged: the seed block is still there, b1 never landed
    const got = await json(await t.authed(`/api/notepages/${id}`));
    expect(got.blocks.map((b: any) => b.id)).toEqual(['seed']);
  });

  test('minRowSpan < 1 → 422 floor invariant violation', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { rowSpan: 2, minRowSpan: 0 })],
    });
    expect(res.status).toBe(422);
    expect((await json(res)).error).toBe('floor invariant violation');
  });

  test('non-integer minRowSpan → 422 floor invariant violation', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { rowSpan: 3, minRowSpan: 1.5 })],
    });
    expect(res.status).toBe(422);
    expect((await json(res)).error).toBe('floor invariant violation');
  });

  test('rowSpan == minRowSpan (boundary) → 200', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { rowSpan: 2, minRowSpan: 2 })],
    });
    expect(res.status).toBe(200);
  });

  test('rowSpan > minRowSpan (grown by content) → 200', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { rowSpan: 5, minRowSpan: 2 })],
    });
    expect(res.status).toBe(200);
  });

  test('minRowSpan null (autofit off) → guard skipped, 200', async () => {
    const { id } = await createPage();
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [block('b1', 0, { rowSpan: 2, minRowSpan: null })],
    });
    expect(res.status).toBe(200);
  });

  test('floor 422 is checked AFTER validateState: overlap still reports overlap not floor', async () => {
    const { id } = await createPage();
    // two overlapping blocks AND a bad floor — validateState fires first
    const res = await putWorking(id, {
      title: 'T',
      gravityEnabled: true,
      blocks: [
        { id: 'a', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, content: { markdown: 'x' }, minRowSpan: 9 },
        { id: 'b', kind: 'markdown', col: 2, row: 1, colSpan: 6, rowSpan: 2, content: { markdown: 'y' } },
      ],
    });
    expect(res.status).toBe(422);
    expect((await json(res)).error).toBe('layout invariant violation');
  });
});
```

- [ ] **Step 2: Run, confirm red.**

```
cd apps/server && bun test test/autofit-route.test.ts
```

Expected: the `< minRowSpan`, `minRowSpan < 1`, and `non-integer` tests FAIL (handler currently returns 200 and the bad block lands). The boundary/grown/null/`AFTER validateState` tests PASS already (they assert 200 or the existing overlap path). This isolates exactly the missing guard.

- [ ] **Step 3: Implement the guard.** In the PUT handler, AFTER the `validateState` check and BEFORE `db.transaction(...)`, insert the cross-field assertion. Locate:

```ts
    const v = validateState(state, { gravity: body.gravityEnabled });
    if (!v.ok) return c.json({ error: 'layout invariant violation', details: v.errors }, 422);

    db.transaction((tx) => {
```

and insert between the `validateState` guard and `db.transaction` so it reads:

```ts
    const v = validateState(state, { gravity: body.gravityEnabled });
    if (!v.ok) return c.json({ error: 'layout invariant violation', details: v.errors }, 422);

    // Floor invariant (spec §4.3/§6): minRowSpan never enters the engine, so
    // validateState is floor-blind. The route is the sole backstop — assert
    // rowSpan >= minRowSpan >= 1 (integer) per block. Runs before any write,
    // so a violation is a clean reject with no partial apply.
    const floorViolation = body.blocks.some(
      (b) =>
        b.minRowSpan !== null &&
        (!Number.isInteger(b.minRowSpan) || b.minRowSpan < 1 || b.rowSpan < b.minRowSpan),
    );
    if (floorViolation) return c.json({ error: 'floor invariant violation' }, 422);

    db.transaction((tx) => {
```

- [ ] **Step 4: Run, confirm green.**

```
cd apps/server && bun test test/autofit-route.test.ts
```

Expected: all tests in BOTH describes (parsing + floor invariant guard) PASS.

- [ ] **Step 5: Typecheck + full server suite (no regressions).**

```
cd apps/server && bun run typecheck && bun test
```

Expected: `tsc --noEmit` clean; entire `apps/server` `bun test` green (api/migrate/static-html/tree/blobs/theme/export-import/appearance/auth/corrupt-rows/export-format unaffected — the guard only fires when `minRowSpan != null`, which legacy/existing fixtures never set).

- [ ] **Step 6: Commit.**

```
cd apps/server && git add -A && git commit -m "feat(server): floor-invariant route guard — rowSpan >= minRowSpan >= 1 or 422

After validateState passes, assert every block's floor (minRowSpan) is an
integer >= 1 and <= rowSpan, else 422 'floor invariant violation' before any
write (no partial apply). Engine stays floor-blind (spec §4.3).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```


## Phase: web-reconcile

_Depends on: "ENGINE subsystem (packages/grid-engine) MUST land first: this subsystem's `useGridInteraction.reconcileTo` imports `pushResize` from `@skb/grid-engine` (Task 4 fails on import until `pushResize` is exported from packages/grid-engine/src/index.ts). `applyGravity` already exists. — Soft dependency on the SERVER/route-guard subsystem for round-trip: this subsystem sends `autofit`/`minRowSpan` in WorkingBlock; the server must parse + persist + 422-guard them for the values to survive a reload, but the web unit tests here do NOT need the server (they test ops/controller/menu in isolation). — Soft dependency on the PUBLISH subsystem: it adds the `autofit` flag to PublishedDocShape/BlockFrameProps; web edit-time clip is self-contained here."_

> **Measurement-vs-ghost seam (no shared edit).** The AUTHORITATIVE fit measurement is the web-layer `MeasureProbe` defined and owned in THIS phase: the host/GridCanvas mounts it, and because the host has `colSpan`/`kind`/`shell`/`theme` it wraps the RenderView via `resolveBlockFrame(theme, kind, shell)` at the exact geometry width `colSpan*slot - 2*pad`. The markdown EditView's floating ghost (added in the markdown-publish phase) is a UX preview only — it renders `MarkdownRenderView`, is NOT the authoritative measurement, and need not be Frame-wrapped. They are two different DOM nodes: only the markdown-publish phase touches `MarkdownEditView`, only this web-reconcile phase owns `MeasureProbe` — neither edits the other's node.

**File structure:**
- CREATE apps/web/src/grid/captureLayoutSnapshot.ts — pure deep-immutable clone of GridState (shared base-snapshot primitive; the future Ctrl+Z undo's predeclared foundation, but ONLY the autofit consumer is wired now).
- CREATE apps/web/src/grid/__tests__/captureLayoutSnapshot.test.ts — deep-clone + immutability + structural-equality tests.
- CREATE apps/web/src/grid/measureFit.ts — `fitFromOuterHeight(outerHeight, slot)` pure helper (`ceil(outerHeight/slot)`, floor 1) + `measuredWidthPx(colSpan, slot, pad)` (`colSpan*slot - 2*pad`); used by the offscreen Frame-wrapped measurement.
- CREATE apps/web/src/grid/__tests__/measureFit.test.ts — fit/width arithmetic tests with injected heights.
- CREATE apps/web/src/grid/MeasureProbe.tsx — offscreen Frame-wrapped RenderView at exact geometry width + ResizeObserver -> reports fit via callback; the SAME node is reused (made visible) as the ghost preview.
- CREATE apps/web/src/grid/__tests__/MeasureProbe.test.tsx — renders the probe in happy-dom with a stubbed ResizeObserver + injected offsetHeight; asserts fit callback fires with ceil(height/slot).
- CREATE apps/web/src/grid/useAutofitGesture.ts — the gesture controller hook: on activate capture base via captureLayoutSnapshot; reconcile(base, max(floor,fit)) through interaction.reconcileTo; debounce 200ms; on commit if net delta!=0 && gravity-on run applyGravity once; atomicity guard (suspend autosave-commit while gesture live).
- CREATE apps/web/src/grid/__tests__/useAutofitGesture.test.tsx — reconcile-from-base, debounce coalescing, partial-shrink == direct, commit-compaction-once, gravity-off no-compact, atomicity (no interleave).
- MODIFY apps/web/src/grid/useGridInteraction.ts — add `autofit`/`minRowSpan` per-block maps to Interaction state; add `reconcileTo(base, growerId, targetRowSpan)` op (calls pushResize, sets state, NEVER gravity); add `commitGesture(growerId, baseRowSpan)` (one applyGravity if gravity-on & net delta); change vertical resize-handle commit to write minRowSpan (floor) + trigger reconcile instead of transform({rowSpan}); clamp ResizePreview previewH to max(currentFit, draggedH).
- MODIFY apps/web/src/grid/__tests__ — extend existing useGridInteraction coverage (none today) via the new test files above; floor-resize behavior tested in useAutofitGesture.test.tsx.
- MODIFY apps/web/src/grid/GridCanvas.tsx — add "auto height" menuitemcheckbox to the block right-click menu (checked = autofit==='grow'); thread autofit/minRowSpan from interaction into BlockShell; render the visible right-aligned ghost preview for the active autofit markdown block; autofit blocks render overflow:hidden.
- MODIFY apps/web/src/grid/overlays.tsx — clamp ResizePreview previewH honesty (ghost stops at max(currentFit,draggedH)); add a faint floor marker line when floor < fit.
- MODIFY apps/web/src/pages/EditorPage.tsx — seed autofit/minRowSpan from detail.blocks; default 'grow' for new markdown blocks in onBlockInserted; pass autofit/minRowSpan through save() into WorkingBlock; suspend the debounced autosave "commit" while a gesture is live (atomicity invariant).
- MODIFY apps/web/src/api/client.ts — extend WorkingBlock with `autofit?: string | null` and `minRowSpan?: number | null`.

### Task 14: `captureLayoutSnapshot` — deep immutable clone (shared base-snapshot primitive)

**Files:**
- Create: `apps/web/src/grid/captureLayoutSnapshot.ts`
- Test: `apps/web/src/grid/__tests__/captureLayoutSnapshot.test.ts`

This is the WEB SNAPSHOT PRIMITIVE pinned contract: `captureLayoutSnapshot(state: GridState) -> GridState` returns a deep immutable clone. It is the shared foundation for autofit AND a future Ctrl+Z undo — ship ONLY the autofit consumer now; do NOT build an undo stack/keymap. It lives in `apps/web` (web controller), NOT the engine, so the engine stays pure (invariant 6).

- [ ] **Step 1: Write the failing test.** Create `apps/web/src/grid/__tests__/captureLayoutSnapshot.test.ts`:
```ts
/**
 * captureLayoutSnapshot — the WEB SNAPSHOT PRIMITIVE (autofit C5 base
 * snapshot; also the predeclared foundation of a future Ctrl+Z undo).
 * Must be a DEEP immutable clone: mutating the source after capture must
 * never reach the snapshot, and the snapshot itself must be frozen.
 */
import { describe, expect, test } from 'vitest';
import type { GridState } from '@skb/grid-engine';
import { captureLayoutSnapshot } from '../captureLayoutSnapshot';

function state(): GridState {
  return {
    totalCols: 12,
    blocks: [
      { id: 'g', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind: 'markdown' },
      { id: 'w', col: 0, row: 1, colSpan: 6, rowSpan: 1, kind: 'markdown' },
    ],
  };
}

describe('captureLayoutSnapshot', () => {
  test('clone is structurally equal to the source', () => {
    const s = state();
    expect(captureLayoutSnapshot(s)).toEqual(s);
  });

  test('clone is a different object graph (no shared references)', () => {
    const s = state();
    const snap = captureLayoutSnapshot(s);
    expect(snap).not.toBe(s);
    expect(snap.blocks).not.toBe(s.blocks);
    expect(snap.blocks[0]).not.toBe(s.blocks[0]);
  });

  test('mutating the source after capture never reaches the snapshot', () => {
    const s = state();
    const snap = captureLayoutSnapshot(s);
    s.blocks[0]!.rowSpan = 99;
    s.blocks.push({ id: 'x', col: 8, row: 0, colSpan: 1, rowSpan: 1, kind: 'markdown' });
    expect(snap.blocks[0]!.rowSpan).toBe(1);
    expect(snap.blocks).toHaveLength(2);
  });

  test('the snapshot is frozen (immutable)', () => {
    const snap = captureLayoutSnapshot(state());
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.blocks)).toBe(true);
    expect(Object.isFrozen(snap.blocks[0])).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — see it fail.**
```
cd apps/web && npx vitest run src/grid/__tests__/captureLayoutSnapshot.test.ts
```
Expected: fails to resolve `../captureLayoutSnapshot` (module not found).

- [ ] **Step 3: Implement the primitive.** Create `apps/web/src/grid/captureLayoutSnapshot.ts`:
```ts
/**
 * The WEB SNAPSHOT PRIMITIVE (autofit reflow model C5, spec §4.4/§4.5).
 *
 * Captures a deep, immutable clone of a GridState — the gesture's BASE.
 * autofit reconcile re-derives every target from this base (no journal,
 * no clamp), so the clone must NOT share any reference with the live
 * state and must be frozen so a consumer cannot corrupt the base
 * mid-gesture.
 *
 * This is deliberately the SHARED foundation for a future Ctrl+Z undo
 * stack (spec §4.5: one basis primitive, two consumers). We ship ONLY
 * the autofit consumer now — no stack, no ring buffer, no keymap, no
 * redo. The undo feature is a separate later PRD that builds on this.
 *
 * Web layer (NOT engine): keeps the engine pure/kind-opaque (invariant
 * 6), consistent with floor/fit also living in the web layer (spec §4.3).
 */
import type { Block, GridState } from '@skb/grid-engine';

export function captureLayoutSnapshot(state: GridState): GridState {
  const blocks = state.blocks.map((b): Block => Object.freeze({ ...b }) as Block);
  return Object.freeze({
    totalCols: state.totalCols,
    blocks: Object.freeze(blocks) as Block[],
  }) as GridState;
}
```

- [ ] **Step 4: Run the test — see it pass.**
```
cd apps/web && npx vitest run src/grid/__tests__/captureLayoutSnapshot.test.ts
```
Expected: `4 passed`.

- [ ] **Step 5: Commit.**
```
git add apps/web/src/grid/captureLayoutSnapshot.ts apps/web/src/grid/__tests__/captureLayoutSnapshot.test.ts
git commit -m "feat(web): captureLayoutSnapshot — autofit C5 base-snapshot primitive

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: `measureFit` arithmetic helpers (pure fit/width math)

**Files:**
- Create: `apps/web/src/grid/measureFit.ts`
- Test: `apps/web/src/grid/__tests__/measureFit.test.ts`

The MEASUREMENT contract: offscreen box laid out at exact geometry width `colSpan*theme.slot - 2*theme.pad`; `fit = ceil(measuredFrameOuterHeight / theme.slot)`. Isolate the arithmetic into pure functions so the DOM-bound probe (Task 3) is a thin shell. NEVER subtract chrome — fit is derived from the Frame wrapper's outer height directly.

- [ ] **Step 1: Write the failing test.** Create `apps/web/src/grid/__tests__/measureFit.test.ts`:
```ts
/**
 * Pure arithmetic of the autofit measurement loop (spec §5.3): the
 * offscreen geometry width and the fit = ceil(outerHeight / slot)
 * derivation. No DOM — DOM wiring is MeasureProbe (Task 3).
 */
import { describe, expect, test } from 'vitest';
import { fitFromOuterHeight, measuredWidthPx } from '../measureFit';

describe('measuredWidthPx', () => {
  test('is the block geometry width: colSpan*slot - 2*pad', () => {
    expect(measuredWidthPx(6, 60, 4)).toBe(6 * 60 - 8);
    expect(measuredWidthPx(1, 60, 4)).toBe(52);
  });
});

describe('fitFromOuterHeight', () => {
  test('fit = ceil(outerHeight / slot)', () => {
    expect(fitFromOuterHeight(60, 60)).toBe(1);
    expect(fitFromOuterHeight(61, 60)).toBe(2);
    expect(fitFromOuterHeight(180, 60)).toBe(3);
    expect(fitFromOuterHeight(181, 60)).toBe(4);
  });

  test('never returns below 1 (a block is at least one row)', () => {
    expect(fitFromOuterHeight(0, 60)).toBe(1);
    expect(fitFromOuterHeight(10, 60)).toBe(1);
  });
});
```

- [ ] **Step 2: Run — see it fail.**
```
cd apps/web && npx vitest run src/grid/__tests__/measureFit.test.ts
```
Expected: cannot resolve `../measureFit`.

- [ ] **Step 3: Implement.** Create `apps/web/src/grid/measureFit.ts`:
```ts
/**
 * Pure arithmetic for the autofit measurement loop (spec §5.3).
 *
 * The offscreen measurement box is laid out at the block's EXACT grid
 * geometry width so wrapping matches the live/published render, then
 * fit = ceil(Frame-wrapper outerHeight / slot). We never subtract chrome
 * and never compute width by content — the real theme Frame around the
 * RenderView makes wrapping width + typography correct by construction.
 */

/** The block's content-box width in px: colSpan*slot - 2*pad. */
export function measuredWidthPx(colSpan: number, slot: number, pad: number): number {
  return colSpan * slot - 2 * pad;
}

/** fit (rows) for a measured Frame outer height. Floor of 1 row. */
export function fitFromOuterHeight(outerHeight: number, slot: number): number {
  return Math.max(1, Math.ceil(outerHeight / slot));
}
```

- [ ] **Step 4: Run — see it pass.**
```
cd apps/web && npx vitest run src/grid/__tests__/measureFit.test.ts
```
Expected: `5 passed`.

- [ ] **Step 5: Commit.**
```
git add apps/web/src/grid/measureFit.ts apps/web/src/grid/__tests__/measureFit.test.ts
git commit -m "feat(web): measureFit — pure fit/geometry-width arithmetic for autofit

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: `MeasureProbe` — offscreen Frame-wrapped RenderView + ResizeObserver

**Files:**
- Create: `apps/web/src/grid/MeasureProbe.tsx`
- Test: `apps/web/src/grid/__tests__/MeasureProbe.test.tsx`

MEASUREMENT contract verbatim: measure through the REAL theme Frame `resolveBlockFrame(theme,kind,shell) ?? theme.BlockFrame ?? DefaultBlockFrame` wrapping the RenderView, laid out offscreen at exact geometry width `colSpan*theme.slot - 2*theme.pad`; `fit = ceil(frameWrapper.offsetHeight / theme.slot)`. NEVER a bare RenderView. A ResizeObserver re-reports when the wrapper's box changes. The SAME node is reused as the visible ghost preview (Task 6 makes it visible). happy-dom has no real layout; the test injects `offsetHeight` and stubs `ResizeObserver`.

- [ ] **Step 1: Write the failing test.** Create `apps/web/src/grid/__tests__/MeasureProbe.test.tsx`:
```tsx
// @vitest-environment happy-dom
/**
 * MeasureProbe (spec §5.3): an offscreen theme-Frame-wrapped RenderView
 * at the block's geometry width that reports fit = ceil(outerHeight/slot)
 * via onFit, re-reporting through a ResizeObserver. happy-dom does no
 * layout, so we stub ResizeObserver and inject the wrapper's offsetHeight.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, act } from '@testing-library/react';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { MeasureProbe } from '../MeasureProbe';

// no vitest globals → testing-library never auto-cleans.
afterEach(cleanup);

// Capture the observed element + trigger so we can fire a "resize".
let observed: Element | null = null;
let fireResize: (() => void) | null = null;

beforeEach(() => {
  observed = null;
  fireResize = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe(el: Element) {
        observed = el;
        fireResize = () => this.cb([{ target: el } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

/** Force the measured wrapper's offsetHeight (happy-dom returns 0). */
function setWrapperHeight(px: number) {
  Object.defineProperty(observed as HTMLElement, 'offsetHeight', { value: px, configurable: true });
}

describe('MeasureProbe', () => {
  test('reports fit = ceil(offsetHeight/slot) on observed resize', () => {
    const onFit = vi.fn();
    render(
      <ThemeProvider theme={graphPaper}>
        <MeasureProbe kind="markdown" blockId="g" colSpan={6} shell={null} content={{ markdown: 'hi' }} onFit={onFit} />
      </ThemeProvider>,
    );
    // slot=60: 130px outer -> ceil(130/60) = 3 rows
    setWrapperHeight(130);
    act(() => fireResize!());
    expect(onFit).toHaveBeenLastCalledWith(3);
  });

  test('lays the offscreen box out at the block geometry width', () => {
    render(
      <ThemeProvider theme={graphPaper}>
        <MeasureProbe kind="markdown" blockId="g" colSpan={2} shell={null} content={{ markdown: 'hi' }} onFit={() => {}} />
      </ThemeProvider>,
    );
    // graphPaper slot=60 pad=4 → 2*60 - 8 = 112px
    expect((observed as HTMLElement).style.width).toBe('112px');
  });
});
```

- [ ] **Step 2: Run — see it fail.**
```
cd apps/web && npx vitest run src/grid/__tests__/MeasureProbe.test.tsx
```
Expected: cannot resolve `../MeasureProbe`.

- [ ] **Step 3: Implement.** Create `apps/web/src/grid/MeasureProbe.tsx`:
```tsx
/**
 * MeasureProbe — the autofit measurement surface (spec §5.3).
 *
 * Wraps the kind's RenderView in the REAL resolved theme Frame at the
 * block's exact grid geometry width (colSpan*slot - 2*pad), so wrapping
 * width AND theme typography/globalCss match the live/published render
 * by construction. A ResizeObserver re-derives fit = ceil(wrapper
 * offsetHeight / slot) on every reflow (content / colSpan / theme-font /
 * mount). We measure the FRAME WRAPPER's outer height and never subtract
 * chrome, never measure a bare RenderView.
 *
 * The same node doubles as the visible right-aligned ghost preview for
 * the active block (spec §7) — GridCanvas positions it; here it is
 * absolutely-positioned and offscreen by default (`visible=false`).
 */
import { useLayoutEffect, useRef } from 'react';
import { blockModule, DefaultBlockFrame } from '@skb/block-kinds';
import { resolveBlockFrame, useTheme } from '@skb/theme';
import { fitFromOuterHeight, measuredWidthPx } from './measureFit';

export type MeasureProbeProps = {
  kind: string;
  blockId: string;
  colSpan: number;
  shell: string | null;
  content: unknown;
  onFit: (fit: number) => void;
  /** When true the probe is shown as the right-aligned ghost preview;
   * otherwise it is offscreen instrumentation (default). */
  visible?: boolean;
};

export function MeasureProbe({ kind, blockId, colSpan, shell, content, onFit, visible }: MeasureProbeProps) {
  const theme = useTheme();
  const mod = blockModule(kind);
  const Frame = resolveBlockFrame(theme, kind, shell) ?? theme.BlockFrame ?? DefaultBlockFrame;
  const wrapRef = useRef<HTMLDivElement>(null);
  const onFitRef = useRef(onFit);
  onFitRef.current = onFit;
  const width = measuredWidthPx(colSpan, theme.slot, theme.pad);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const report = () => onFitRef.current(fitFromOuterHeight(el.offsetHeight, theme.slot));
    report(); // mount measurement
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
    // re-measure when geometry width or theme metrics change
  }, [width, theme.slot]);

  if (!mod) return null;
  const Render = mod.RenderView;
  const safe = (content ?? mod.createContent()) as never;

  return (
    <div
      aria-hidden
      data-skb-measure-probe
      ref={wrapRef}
      style={{
        position: 'absolute',
        width: `${width}px`,
        // offscreen unless promoted to a visible ghost preview
        ...(visible
          ? { right: 0, top: 0, zIndex: 25, pointerEvents: 'none', opacity: 0.9 }
          : { left: '-99999px', top: 0, visibility: 'hidden' }),
      }}
    >
      <Frame kind={kind} blockId={blockId} colSpan={colSpan} rowSpan={1} shell={shell}>
        <Render content={safe} />
      </Frame>
    </div>
  );
}
```

- [ ] **Step 4: Run — see it pass.**
```
cd apps/web && npx vitest run src/grid/__tests__/MeasureProbe.test.tsx
```
Expected: `2 passed`.

- [ ] **Step 5: Commit.**
```
git add apps/web/src/grid/MeasureProbe.tsx apps/web/src/grid/__tests__/MeasureProbe.test.tsx
git commit -m "feat(web): MeasureProbe — Frame-wrapped offscreen autofit measurement

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: thread autofit/minRowSpan + `reconcileTo`/`commitGesture` into `useGridInteraction`

**Files:**
- Modify: `apps/web/src/grid/useGridInteraction.ts`
- Modify: `apps/web/src/api/client.ts`
- Test: `apps/web/src/grid/__tests__/reconcileTo.test.ts`

`useGridInteraction` today owns `state` via `setState` (internal) and exposes `ops`/`resize`/`gravityEnabled`. Autofit needs: (a) per-block `autofit`/`minRowSpan` maps as BLOCK METADATA (web-owned, NOT engine, NOT kind content); (b) a `reconcileTo` op that runs `pushResize(base, growerId, target)` and sets state WITHOUT gravity; (c) a `commitGesture` op that runs `applyGravity` ONCE iff net delta != 0 && gravity-on. WEB RECONCILE contract: `reconcile(base, targetRowSpan) = pushResize(base, growerId, target)`, re-derived from the gesture BASE every time. NOTE for the assembler: this task imports `pushResize` from `@skb/grid-engine` — the engine subsystem must land first (see dependsOn).

- [ ] **Step 1: Extend `WorkingBlock`.** In `apps/web/src/api/client.ts`, add the two metadata fields to the `WorkingBlock` type (after `shell`):
```ts
export type WorkingBlock = {
  id: string;
  kind: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  /** Theme shell option id (M6-D3); null = the theme's default shell. */
  shell?: string | null;
  /** Autofit mode (block metadata, web/server-owned): 'off' | 'grow' |
   * 'grow+shrink'. null/'off' = off. MVP writes/reads only 'grow'. */
  autofit?: string | null;
  /** Author floor (minimum row span); null = off/legacy. */
  minRowSpan?: number | null;
  content: unknown;
};
```

- [ ] **Step 2: Write the failing test for the new ops.** Create `apps/web/src/grid/__tests__/reconcileTo.test.ts`:
```ts
// @vitest-environment happy-dom
/**
 * The reconcile ops on useGridInteraction (spec §4.4 C5 + COMMIT RULE):
 * - reconcileTo(base, id, target) = pushResize(base,id,target), state set
 *   WITHOUT gravity (gravity suspended within the gesture);
 * - commitGesture runs applyGravity ONCE iff net delta != 0 && gravity-on;
 *   gravity-off commits the pushed layout as-is.
 */
import { afterEach, describe, expect, test } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { Block, GridState } from '@skb/grid-engine';
import { captureLayoutSnapshot } from '../captureLayoutSnapshot';
import { useGridInteraction } from '../useGridInteraction';

afterEach(cleanup);

const G: Block = { id: 'g', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind: 'markdown' };
const B: Block = { id: 'b', col: 0, row: 1, colSpan: 2, rowSpan: 1, kind: 'markdown' };

function mount(gravity: boolean) {
  return renderHook(() =>
    useGridInteraction({
      initialBlocks: [G, B],
      initialGravity: gravity,
      defaultSizeFor: () => ({ colSpan: 2, rowSpan: 1 }),
      onBlockInserted: () => {},
    }),
  );
}

function snap(state: GridState) {
  return captureLayoutSnapshot(state);
}

describe('reconcileTo', () => {
  test('grows the grower and pushes the AABB collider down, no gravity', () => {
    const h = mount(false);
    const base = snap(h.result.current.state);
    act(() => h.result.current.reconcileTo(base, 'g', 3));
    const after = h.result.current.state.blocks;
    expect(after.find((b) => b.id === 'g')!.rowSpan).toBe(3);
    expect(after.find((b) => b.id === 'b')!.row).toBe(3); // pushed below the grown g
  });

  test('partial shrink (3 -> 2) equals reconciling directly from base to 2', () => {
    const h = mount(false);
    const base = snap(h.result.current.state);
    act(() => h.result.current.reconcileTo(base, 'g', 3));
    act(() => h.result.current.reconcileTo(base, 'g', 2)); // re-derive from BASE
    const after = h.result.current.state.blocks;
    expect(after.find((b) => b.id === 'g')!.rowSpan).toBe(2);
    expect(after.find((b) => b.id === 'b')!.row).toBe(2);
  });

  test('reconciling back to base rowSpan restores the base layout exactly', () => {
    const h = mount(false);
    const base = snap(h.result.current.state);
    act(() => h.result.current.reconcileTo(base, 'g', 4));
    act(() => h.result.current.reconcileTo(base, 'g', 1)); // back to base
    expect(h.result.current.state.blocks).toEqual(base.blocks);
  });
});

describe('commitGesture', () => {
  test('gravity-on + net delta runs applyGravity once (compacts the gap)', () => {
    const h = mount(true);
    const base = snap(h.result.current.state);
    act(() => h.result.current.reconcileTo(base, 'g', 3));
    act(() => h.result.current.reconcileTo(base, 'g', 1)); // shrunk back, b at row1 (pushed) — gap at... none here
    // grow then commit at a NET delta:
    act(() => h.result.current.reconcileTo(base, 'g', 3));
    act(() => h.result.current.commitGesture('g', 1));
    const after = h.result.current.state.blocks;
    // g grew to 3 and stays; b sits directly under it, compacted (row 3)
    expect(after.find((b) => b.id === 'g')!.rowSpan).toBe(3);
    expect(after.find((b) => b.id === 'b')!.row).toBe(3);
  });

  test('gravity-off commits the pushed layout as-is (no compaction)', () => {
    const h = mount(false);
    const base = snap(h.result.current.state);
    act(() => h.result.current.reconcileTo(base, 'g', 3));
    const before = h.result.current.state.blocks.map((b) => ({ ...b }));
    act(() => h.result.current.commitGesture('g', 1));
    expect(h.result.current.state.blocks).toEqual(before);
  });
});
```

- [ ] **Step 3: Run — see it fail.**
```
cd apps/web && npx vitest run src/grid/__tests__/reconcileTo.test.ts
```
Expected: fails — `reconcileTo` / `commitGesture` are not on the interaction.

- [ ] **Step 4: Implement in `useGridInteraction.ts`.** Add the engine imports — extend the existing `@skb/grid-engine` import to include `applyGravity` and `pushResize`:
```ts
import {
  type Block,
  type BlockSize,
  type DropIntent,
  type GridState,
  TOTAL_COLS,
  applyGravity,
  deleteBlock as engineDelete,
  inferDropIntent,
  insertBlock,
  moveBlock,
  pushResize,
  transformBlock,
} from '@skb/grid-engine';
```
Add the new op signatures to the `GridOps` type (after `insertAt`):
```ts
  /** Autofit reconcile (spec §4.4 C5): pushResize(base, id, target) with
   * gravity SUSPENDED — re-derived from the gesture BASE every time. */
  reconcileTo: (base: GridState, id: string, targetRowSpan: number) => void;
  /** COMMIT RULE (PROBE-2 invariant): on gesture commit, if net rowSpan
   * delta != 0 && gravity is ON, run applyGravity ONCE; gravity-off
   * commits the pushed layout as-is. */
  commitGesture: (id: string, baseRowSpan: number) => void;
```
Add the block-metadata maps + setters to the `Interaction` type (after `setGravityEnabled`):
```ts
  /** BLOCK METADATA (web-owned): autofit mode per block id. null/'off' =
   * off; MVP writes/reads only 'grow'. */
  autofit: Record<string, string | null>;
  setAutofit: (id: string, mode: string | null) => void;
  /** Author floor per block id; null = off/legacy. */
  minRowSpan: Record<string, number | null>;
  setMinRowSpan: (id: string, floor: number | null) => void;
```
Add to `GridInteractionConfig` (after `initialGravity`):
```ts
  /** Seed block metadata from the server detail (web/server-owned). */
  initialAutofit?: Record<string, string | null>;
  initialMinRowSpan?: Record<string, number | null>;
```
Inside `useGridInteraction`, after the `gravityEnabled` state, add the metadata state:
```ts
  const [autofit, setAutofitState] = useState<Record<string, string | null>>(
    () => config.initialAutofit ?? {},
  );
  const [minRowSpan, setMinRowSpanState] = useState<Record<string, number | null>>(
    () => config.initialMinRowSpan ?? {},
  );
  const setAutofit = (id: string, mode: string | null) =>
    setAutofitState((m) => ({ ...m, [id]: mode }));
  const setMinRowSpan = (id: string, floor: number | null) =>
    setMinRowSpanState((m) => ({ ...m, [id]: floor }));
```
Add the two ops near `transform` (above `const ops:`):
```ts
  function reconcileTo(base: GridState, id: string, targetRowSpan: number): void {
    // C5: ALWAYS re-derive from the immutable gesture base (no journal,
    // no clamp). pushResize never calls gravity — gravity stays suspended
    // within the edit gesture (spec §4.4 atomicity).
    const r = pushResize(base, id, targetRowSpan);
    if (r.ok) setState(r.state);
  }

  function commitGesture(id: string, baseRowSpan: number): void {
    setState((s) => {
      const block = s.blocks.find((b) => b.id === id);
      const netDelta = block ? block.rowSpan - baseRowSpan : 0;
      // COMMIT RULE / PROBE-2: only compact when the block truly changed
      // height AND the page runs gravity. gravity-off commits as-is.
      if (netDelta !== 0 && gravityRef.current) return applyGravity(s).state;
      return s;
    });
  }
```
Add `reconcileTo, commitGesture` to the `ops` object:
```ts
  const ops: GridOps = { move, transform, remove, insertAt, reconcileTo, commitGesture };
```
Finally add the metadata to the returned `Interaction` object (in the final `return {`):
```ts
    autofit,
    setAutofit,
    minRowSpan,
    setMinRowSpan,
```

- [ ] **Step 5: Run — see it pass.**
```
cd apps/web && npx vitest run src/grid/__tests__/reconcileTo.test.ts
```
Expected: `5 passed`. (If the engine `pushResize` is not yet merged, this fails on import — that is the dependsOn gate; do not stub the engine here.)

- [ ] **Step 6: Typecheck the package.**
```
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit.**
```
git add apps/web/src/grid/useGridInteraction.ts apps/web/src/api/client.ts apps/web/src/grid/__tests__/reconcileTo.test.ts
git commit -m "feat(web): reconcileTo/commitGesture ops + autofit/minRowSpan block metadata

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: `useAutofitGesture` — the gesture controller (capture base, debounce, reconcile, commit, atomicity)

**Files:**
- Create: `apps/web/src/grid/useAutofitGesture.ts`
- Test: `apps/web/src/grid/__tests__/useAutofitGesture.test.tsx`

This is the C5 gesture controller. On activate (gesture start) it captures the BASE via `captureLayoutSnapshot`. Each measured `fit` (debounced 200ms) reconciles to `effective = max(floor, fit)` via `interaction.ops.reconcileTo(base, id, effective)`. On commit (deactivate/idle) it calls `interaction.ops.commitGesture(id, baseRowSpan)` and exposes `gestureActive` so the host can suspend the autosave commit (ATOMICITY: no gravity-running op may interleave a gesture). `effective target rowSpan = max(floor, fit)`; `floor = minRowSpan` (author intent); `fit = ceil(...)` already computed by MeasureProbe.

- [ ] **Step 1: Write the failing test.** Create `apps/web/src/grid/__tests__/useAutofitGesture.test.tsx`:
```tsx
// @vitest-environment happy-dom
/**
 * useAutofitGesture (spec §4.4 C5 controller): capture base on activate,
 * debounce fit, reconcile to max(floor,fit) from the BASE every time,
 * commit once (gravity rule lives in commitGesture), expose gestureActive
 * for autosave atomicity. We drive a fake interaction so the controller's
 * scheduling/debounce/commit wiring is tested in isolation.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { GridState } from '@skb/grid-engine';
import { useAutofitGesture } from '../useAutofitGesture';

afterEach(cleanup);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const DEBOUNCE = 200;

function fakeInteraction(rowSpanOf: () => number) {
  const reconcileTo = vi.fn();
  const commitGesture = vi.fn();
  const state: GridState = {
    totalCols: 12,
    blocks: [{ id: 'g', col: 0, row: 0, colSpan: 2, rowSpan: rowSpanOf(), kind: 'markdown' }],
  };
  return { state, ops: { reconcileTo, commitGesture } } as never;
}

describe('useAutofitGesture', () => {
  test('captures base on activate and reconciles to max(floor,fit) after debounce', () => {
    const i = fakeInteraction(() => 1);
    const h = renderHook(({ fit }) => useAutofitGesture({ interaction: i, activeId: 'g', enabled: true, floor: 2, fit, debounceMs: DEBOUNCE }), {
      initialProps: { fit: 1 },
    });
    // fit=1, floor=2 → effective = max(2,1) = 2
    h.rerender({ fit: 1 });
    act(() => vi.advanceTimersByTime(DEBOUNCE));
    const [base, id, target] = (i as any).ops.reconcileTo.mock.calls.at(-1);
    expect(id).toBe('g');
    expect(target).toBe(2);
    expect(base.blocks[0].rowSpan).toBe(1); // reconciled from the captured base
  });

  test('rapid fit changes coalesce into one reconcile (debounced)', () => {
    const i = fakeInteraction(() => 1);
    const h = renderHook(({ fit }) => useAutofitGesture({ interaction: i, activeId: 'g', enabled: true, floor: 1, fit, debounceMs: DEBOUNCE }), {
      initialProps: { fit: 2 },
    });
    for (const fit of [3, 4, 5]) {
      h.rerender({ fit });
      act(() => vi.advanceTimersByTime(DEBOUNCE / 2));
    }
    act(() => vi.advanceTimersByTime(DEBOUNCE));
    expect((i as any).ops.reconcileTo).toHaveBeenCalledTimes(1);
    expect((i as any).ops.reconcileTo.mock.calls[0][2]).toBe(5); // last fit, max(1,5)
  });

  test('on deactivate it commits the gesture with the base rowSpan', () => {
    const i = fakeInteraction(() => 1);
    const h = renderHook(({ activeId }) => useAutofitGesture({ interaction: i, activeId, enabled: true, floor: 1, fit: 4, debounceMs: DEBOUNCE }), {
      initialProps: { activeId: 'g' as string | null },
    });
    act(() => vi.advanceTimersByTime(DEBOUNCE));
    h.rerender({ activeId: null }); // deactivate = gesture end
    expect((i as any).ops.commitGesture).toHaveBeenCalledWith('g', 1);
  });

  test('gestureActive is true only while a block is active (autosave atomicity)', () => {
    const i = fakeInteraction(() => 1);
    const h = renderHook(({ activeId }) => useAutofitGesture({ interaction: i, activeId, enabled: true, floor: 1, fit: 1, debounceMs: DEBOUNCE }), {
      initialProps: { activeId: 'g' as string | null },
    });
    expect(h.result.current.gestureActive).toBe(true);
    h.rerender({ activeId: null });
    expect(h.result.current.gestureActive).toBe(false);
  });

  test('disabled (autofit off) never reconciles', () => {
    const i = fakeInteraction(() => 1);
    const h = renderHook(({ fit }) => useAutofitGesture({ interaction: i, activeId: 'g', enabled: false, floor: 1, fit, debounceMs: DEBOUNCE }), {
      initialProps: { fit: 1 },
    });
    h.rerender({ fit: 5 });
    act(() => vi.advanceTimersByTime(DEBOUNCE * 2));
    expect((i as any).ops.reconcileTo).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — see it fail.**
```
cd apps/web && npx vitest run src/grid/__tests__/useAutofitGesture.test.tsx
```
Expected: cannot resolve `../useAutofitGesture`.

- [ ] **Step 3: Implement.** Create `apps/web/src/grid/useAutofitGesture.ts`:
```ts
/**
 * useAutofitGesture — the autofit reconcile controller (spec §4.4 C5).
 *
 * One ATOMIC EDIT GESTURE per active autofit block:
 * 1. On activate (gesture start) capture an immutable BASE snapshot of
 *    the whole layout + the grower's base rowSpan.
 * 2. Each measured fit (debounced ~200ms) reconciles to the effective
 *    target rowSpan = max(floor, fit) by re-deriving from the BASE every
 *    time — interaction.ops.reconcileTo(base, id, target). Gravity stays
 *    SUSPENDED within the gesture; reconcile never compacts.
 * 3. On commit (deactivate) interaction.ops.commitGesture(id, baseRowSpan)
 *    applies the COMMIT RULE: one applyGravity iff net delta && gravity-on.
 *
 * ATOMICITY (spec §4.4 / §10 R9): no gravity-running op may interleave a
 * gesture. We expose `gestureActive` so the host suspends the debounced
 * autosave commit while a gesture is live (single-user debounced-PUT
 * makes this an invariant, not a convention).
 *
 * `fit` is fed by MeasureProbe (already ceil(outerHeight/slot)); `floor`
 * is the block's minRowSpan (author intent). We never persist fit.
 */
import { useEffect, useRef } from 'react';
import type { GridState } from '@skb/grid-engine';
import { captureLayoutSnapshot } from './captureLayoutSnapshot';
import type { Interaction } from './useGridInteraction';

export type UseAutofitGestureArgs = {
  interaction: Interaction;
  /** The currently active block id (gesture target), or null. */
  activeId: string | null;
  /** Autofit on for this block (MVP: autofit === 'grow'). */
  enabled: boolean;
  /** Author floor (minRowSpan); falls back to base rowSpan if unset. */
  floor: number;
  /** Latest measured fit rows (from MeasureProbe). */
  fit: number;
  debounceMs?: number;
};

export type AutofitGesture = {
  /** True while an autofit gesture is live — host suspends autosave commit. */
  gestureActive: boolean;
};

export function useAutofitGesture(args: UseAutofitGestureArgs): AutofitGesture {
  const { interaction, activeId, enabled, floor, fit, debounceMs = 200 } = args;
  // The immutable gesture base + the grower's base rowSpan. Captured once
  // per gesture (on the active id changing into a block), cleared on end.
  const baseRef = useRef<GridState | null>(null);
  const baseRowSpanRef = useRef<number>(1);
  const activeRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // hold latest reconcile inputs so the debounced fire reads fresh values
  const latest = useRef({ floor, fit, enabled });
  latest.current = { floor, fit, enabled };

  // Gesture lifecycle: capture base on enter, commit on leave.
  useEffect(() => {
    const prev = activeRef.current;
    if (prev !== activeId) {
      // leaving a block → commit that gesture
      if (prev !== null && baseRef.current) {
        interaction.ops.commitGesture(prev, baseRowSpanRef.current);
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      // entering a block → capture a fresh base
      if (activeId !== null) {
        const base = captureLayoutSnapshot(interaction.state);
        baseRef.current = base;
        baseRowSpanRef.current = base.blocks.find((b) => b.id === activeId)?.rowSpan ?? 1;
      } else {
        baseRef.current = null;
      }
      activeRef.current = activeId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Debounced reconcile on fit/floor change while a gesture is live.
  useEffect(() => {
    if (!enabled || activeId === null || baseRef.current === null) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const base = baseRef.current;
      if (!base) return;
      const { floor: f, fit: fi } = latest.current;
      const target = Math.max(f, fi); // effective rowSpan = max(floor, fit)
      interaction.ops.reconcileTo(base, activeId, target);
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, enabled, floor, fit, debounceMs]);

  return { gestureActive: enabled && activeId !== null };
}
```

- [ ] **Step 4: Run — see it pass.**
```
cd apps/web && npx vitest run src/grid/__tests__/useAutofitGesture.test.tsx
```
Expected: `5 passed`.

- [ ] **Step 5: Commit.**
```
git add apps/web/src/grid/useAutofitGesture.ts apps/web/src/grid/__tests__/useAutofitGesture.test.tsx
git commit -m "feat(web): useAutofitGesture — C5 reconcile controller (base/debounce/commit/atomicity)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: floor-resize — vertical handle writes minRowSpan; ghost clamps to max(currentFit, draggedH)

**Files:**
- Modify: `apps/web/src/grid/useGridInteraction.ts`
- Modify: `apps/web/src/grid/overlays.tsx`
- Test: `apps/web/src/grid/__tests__/floorResize.test.ts`

MARKDOWN UI / spec §7: when autofit is on, the vertical resize handle's semantics change from "set rowSpan" to "set floor (minRowSpan)" and then reconcile to `max(floor, fit)`. The ResizePreview ghost must be honest: `previewH` clamps to `max(currentFit, draggedH)` so the ghost never shows a height the block will not settle at. We thread a `currentFit` into the resize state so the clamp can apply.

- [ ] **Step 1: Write the failing test.** Create `apps/web/src/grid/__tests__/floorResize.test.ts`:
```ts
/**
 * Floor-resize honesty (spec §7): when autofit is on, the bottom handle
 * sets the FLOOR (minRowSpan) and the ghost previewH is clamped to
 * max(currentFit, draggedH) so it never shows a height the block cannot
 * fall to. clampFloorPreview is the pure clamp the ghost + commit share.
 */
import { describe, expect, test } from 'vitest';
import { clampFloorPreview } from '../useGridInteraction';

describe('clampFloorPreview', () => {
  test('dragging below the current fit is clamped up to the fit', () => {
    // content needs 4 rows; dragging the floor down to 2 → ghost stays 4
    expect(clampFloorPreview(2, 4)).toBe(4);
  });

  test('dragging above the current fit honors the drag (raising the floor)', () => {
    expect(clampFloorPreview(6, 4)).toBe(6);
  });

  test('never below 1 row', () => {
    expect(clampFloorPreview(0, 0)).toBe(1);
  });
});
```

- [ ] **Step 2: Run — see it fail.**
```
cd apps/web && npx vitest run src/grid/__tests__/floorResize.test.ts
```
Expected: `clampFloorPreview` is not exported.

- [ ] **Step 3: Implement the clamp + floor-resize wiring in `useGridInteraction.ts`.** Add the exported pure clamp near `moveAnchor` (top-level export):
```ts
/**
 * Floor-resize ghost honesty (spec §7): a vertical drag on an autofit
 * block sets the FLOOR, but the block never falls below its current
 * content fit — so the preview clamps to max(currentFit, draggedH).
 * Shared by the ghost and the commit. Pure, exported for tests.
 */
export function clampFloorPreview(draggedH: number, currentFit: number): number {
  return Math.max(1, currentFit, draggedH);
}
```
Add a `currentFit` field to `ResizeState` (after `previewH`):
```ts
  /** Content fit at gesture start — clamps the ghost for autofit blocks. */
  currentFit: number;
```
Initialize it in the `useState<ResizeState>` default (`currentFit: 0`) and in the `onUp` reset block (`currentFit: 0`). Extend `beginResize`'s signature to accept the active fit + autofit flag and the floor setter, and route the bottom-axis commit to floor:
Change the `beginResize` type in `Interaction`:
```ts
  beginResize: (
    e: React.PointerEvent,
    block: Block,
    axis: ResizeAxis,
    slotSize: number,
    autofitCtx?: { autofit: boolean; currentFit: number },
  ) => void;
```
In `beginResize`, set `currentFit` in the initial `setResize`:
```ts
    setResize({
      active: true,
      blockId: block.id,
      axis,
      previewCol: block.col,
      previewRow: block.row,
      previewW: block.colSpan,
      previewH: block.rowSpan,
      currentFit: autofitCtx?.currentFit ?? 0,
    });
```
In `onMove`, after computing `previewH` for `bottom`/`corner`, clamp when autofit is on:
```ts
      if (axis === 'bottom' || axis === 'corner') {
        previewH = Math.max(1, Math.round((ev.clientY - rect.top) / slotSize));
        if (autofitCtx?.autofit) {
          previewH = clampFloorPreview(previewH, autofitCtx.currentFit);
        }
      } else if (axis === 'top' || axis === 'top-left') {
```
In `onUp`, branch the commit: autofit vertical resize writes the FLOOR (minRowSpan) and triggers a reconcile; everything else keeps the existing `transform`:
```ts
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setResize((r) => {
        if (r.blockId !== null) {
          const verticalOnly = r.axis === 'bottom' || r.axis === 'top';
          if (autofitCtx?.autofit && verticalOnly) {
            // Spec §7: vertical handle SETS THE FLOOR; effective rowSpan
            // is then max(floor, fit). Record the floor; the autofit
            // gesture controller reconciles via §5.1 "floor-resize" trigger.
            setMinRowSpan(r.blockId, r.previewH);
            const base = captureLayoutSnapshot(stateRef.current);
            reconcileTo(base, r.blockId, Math.max(r.previewH, r.currentFit));
            commitGesture(r.blockId, base.blocks.find((b) => b.id === r.blockId)?.rowSpan ?? 1);
          } else {
            transform(r.blockId, {
              col: r.previewCol,
              row: r.previewRow,
              colSpan: r.previewW,
              rowSpan: r.previewH,
            });
          }
        }
        return {
          active: false,
          blockId: null,
          axis: null,
          previewCol: 0,
          previewRow: 0,
          previewW: 0,
          previewH: 0,
          currentFit: 0,
        };
      });
    };
```
Add the `captureLayoutSnapshot` import at the top of the file:
```ts
import { captureLayoutSnapshot } from './captureLayoutSnapshot';
```

- [ ] **Step 4: Update `overlays.tsx` ResizePreview to draw the floor marker.** In `apps/web/src/grid/overlays.tsx`, replace the `ResizePreview` body to add a faint floor marker line when the dragged floor is below the clamped fit height (so the author sees the recorded floor intent, spec §7):
```tsx
export function ResizePreview({
  interaction,
  slotSize,
  padding,
}: {
  interaction: Interaction;
  slotSize: number;
  padding: number;
}) {
  const { resize } = interaction;
  if (!resize.active || resize.blockId === null) return null;
  // Spec §7: when the content fit exceeds the dragged floor, the ghost
  // is held at the fit line and a faint marker shows where the floor was
  // recorded — the block won't fall below content, but the floor intent
  // is honest to the author.
  const floorBelowFit = resize.currentFit > 0 && resize.previewH > resize.currentFit ? false : resize.currentFit > resize.previewH;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${resize.previewCol * slotSize + padding}px`,
        top: `${resize.previewRow * slotSize + padding}px`,
        width: `${resize.previewW * slotSize - 2 * padding}px`,
        height: `${resize.previewH * slotSize - 2 * padding}px`,
        border: `1px dashed ${BENCH.blue}`,
        background: BENCH.blueWash,
        pointerEvents: 'none',
        zIndex: 3,
      }}
      data-skb-resize-preview
    >
      {floorBelowFit && (
        <div
          aria-hidden
          data-skb-floor-marker
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            borderTop: `1px dashed ${BENCH.blue}`,
            opacity: 0.5,
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the clamp test + typecheck.**
```
cd apps/web && npx vitest run src/grid/__tests__/floorResize.test.ts && npx tsc --noEmit
```
Expected: `3 passed`, no type errors.

- [ ] **Step 6: Commit.**
```
git add apps/web/src/grid/useGridInteraction.ts apps/web/src/grid/overlays.tsx apps/web/src/grid/__tests__/floorResize.test.ts
git commit -m "feat(web): floor-resize — vertical handle sets minRowSpan + honest ghost clamp

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: per-block "auto height" toggle in the block right-click menu + GridCanvas wiring (default 'grow' for new markdown)

**Files:**
- Modify: `apps/web/src/grid/GridCanvas.tsx`
- Modify: `apps/web/src/pages/EditorPage.tsx`
- Test: `apps/web/src/grid/__tests__/GridCanvasAutofitMenu.test.tsx`

MARKDOWN UI: a per-block autofit toggle in the right-click menu as a `menuitemcheckbox` with checked state (the chrome `MenuItem.checked` already renders `role="menuitemcheckbox"` + a `✓`). Default ON for new markdown blocks; legacy/non-markdown = off. Autofit blocks render `overflow:hidden` (clip) inner body; non-autofit keep the current behavior. This task also wires the MeasureProbe + useAutofitGesture into GridCanvas/EditorPage and seeds metadata, and suspends autosave commit while a gesture is live (atomicity).

- [ ] **Step 1: Write the failing test.** Create `apps/web/src/grid/__tests__/GridCanvasAutofitMenu.test.tsx`:
```tsx
// @vitest-environment happy-dom
/**
 * The autofit toggle in the block right-click menu (spec §7): a
 * menuitemcheckbox whose checked state reflects interaction.autofit, and
 * which flips the metadata on select. Markdown only.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { HostContext, type HostServices } from '@skb/block-kinds';
import { OverlayProvider } from '../../chrome/overlays';
import { GridCanvas } from '../GridCanvas';
import { useGridInteraction, type Interaction } from '../useGridInteraction';

afterEach(cleanup);

const host: HostServices = { uploadBlob: async () => ({ hash: 'h', size: 0, mimeType: 'x' }) };

function Harness() {
  const interaction = useGridInteraction({
    initialBlocks: [{ id: 'g', col: 0, row: 0, colSpan: 2, rowSpan: 1, kind: 'markdown' }],
    initialGravity: false,
    defaultSizeFor: () => ({ colSpan: 2, rowSpan: 1 }),
    onBlockInserted: () => {},
    initialAutofit: { g: 'grow' },
  });
  return (
    <ThemeProvider theme={graphPaper}>
      <HostContext.Provider value={host}>
        <OverlayProvider>
          <GridCanvas
            interaction={interaction}
            contents={{ g: { markdown: '' } }}
            shells={{}}
            background={null}
            activeId={null}
            onActivate={() => {}}
            onContentChange={() => {}}
            onBlockDeleted={() => {}}
            onShellChange={() => {}}
            onBackgroundChange={() => {}}
          />
        </OverlayProvider>
      </HostContext.Provider>
    </ThemeProvider>
  );
}

describe('autofit toggle', () => {
  test('block menu shows a checked "auto height" menuitemcheckbox', async () => {
    render(<Harness />);
    const block = document.querySelector('[data-block-id="g"]')!;
    fireEvent.contextMenu(block);
    const toggle = await screen.findByRole('menuitemcheckbox', { name: /auto height/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });
});
```

- [ ] **Step 2: Run — see it fail.**
```
cd apps/web && npx vitest run src/grid/__tests__/GridCanvasAutofitMenu.test.tsx
```
Expected: no `menuitemcheckbox` named "auto height" (menu item not added yet).

- [ ] **Step 3: Add the toggle to the block menu in `GridCanvas.tsx`.** In `BlockShell`, destructure the metadata from the interaction at the top of the function body (it already receives the full `interaction`):
```ts
  const isAutofit = interaction.autofit[block.id] === 'grow';
```
Then in the `overlays.menu(...)` items array inside `onContextMenu`, insert the toggle for markdown blocks right after the `'edit'` item (before `shellSection`):
```ts
          [
            { label: 'edit', onSelect: () => onActivate(block.id) },
            ...(block.kind === 'markdown'
              ? [
                  {
                    label: 'auto height',
                    checked: isAutofit,
                    onSelect: () =>
                      interaction.setAutofit(block.id, isAutofit ? 'off' : 'grow'),
                  } as MenuItem,
                ]
              : []),
            ...shellSection,
```

- [ ] **Step 4: Clip autofit block bodies (overflow:hidden).** In `BlockShell`, in the inner content `<div>` that currently sets `overflow: 'visible'`, make autofit blocks clip per the PUBLISH/UI contract (autofit → `overflow:hidden`; non-autofit keep `auto`/`visible`). Change:
```tsx
          <div style={{ flex: 1, minHeight: 0, overflow: isAutofit ? 'hidden' : 'visible' }}>
```

- [ ] **Step 5: Mount MeasureProbe + the ghost preview for the active autofit markdown block.** In `BlockShell`, add `fit` state and render the probe. Near the top of `BlockShell` add:
```ts
  const [fit, setFit] = useState(block.rowSpan);
```
(import `useState` from `react` at the top of the file). Then, inside the block `<div>`, after the `<Frame>…</Frame>` element and before `<DeleteButton …/>`, mount the probe when this is a markdown autofit block:
```tsx
      {isAutofit && block.kind === 'markdown' && (
        <MeasureProbe
          kind={block.kind}
          blockId={block.id}
          colSpan={block.colSpan}
          shell={shell}
          content={contents[block.id]}
          onFit={setFit}
          visible={isActive}
        />
      )}
```
Add the import at the top of `GridCanvas.tsx`:
```ts
import { MeasureProbe } from './MeasureProbe';
import { useAutofitGesture } from './useAutofitGesture';
```
Then drive the gesture controller from `BlockShell` for the active block (place near the other hooks in `BlockShell`):
```ts
  useAutofitGesture({
    interaction,
    activeId: isActive ? block.id : null,
    enabled: isAutofit,
    floor: interaction.minRowSpan[block.id] ?? block.rowSpan,
    fit,
  });
```
Pass the autofit context to the resize handle so the bottom handle sets the floor (Task 6). Change the `<ResizeHandles … />` render to thread the context — update `ResizeHandles`/`ResizeHandle` to forward an `autofitCtx` into `interaction.beginResize`. In `overlays.tsx` `ResizeHandle`, change the `onPointerDown`:
```tsx
      onPointerDown={(e) => interaction.beginResize(e, block, axis, slot, autofitCtx)}
```
and add `autofitCtx` to `ResizeHandle`/`ResizeHandles` props (`autofitCtx?: { autofit: boolean; currentFit: number }`), forwarded from `GridCanvas`:
```tsx
      {!isActive && (
        <ResizeHandles
          block={block}
          interaction={interaction}
          slot={slot}
          autofitCtx={{ autofit: isAutofit, currentFit: fit }}
        />
      )}
```

- [ ] **Step 6: Seed metadata + default 'grow' for new markdown in `EditorPage.tsx`.** In the `useGridInteraction({…})` config, seed from the server detail:
```ts
    initialAutofit: useMemo(
      () => Object.fromEntries(detail.blocks.map((b) => [b.id, b.autofit ?? null])),
      [detail.blocks],
    ),
    initialMinRowSpan: useMemo(
      () => Object.fromEntries(detail.blocks.map((b) => [b.id, b.minRowSpan ?? null])),
      [detail.blocks],
    ),
```
In `onBlockInserted`, default NEW markdown blocks to `'grow'` + floor = inserted rowSpan:
```ts
    onBlockInserted: (block: Block) => {
      const mod = blockModule(block.kind);
      setContents((c) => ({ ...c, [block.id]: mod ? mod.createContent() : null }));
      if (block.kind === 'markdown') {
        interaction.setAutofit(block.id, 'grow');
        interaction.setMinRowSpan(block.id, block.rowSpan);
      }
    },
```
(Note: `interaction` is referenced inside its own config callback — `onBlockInserted` runs after mount, so the closure is valid; if TypeScript flags use-before-assign, move the two `setAutofit`/`setMinRowSpan` calls into a `useEffect` keyed on the inserted id. Capture in openQuestions if the ordering needs the effect form.)
Thread the metadata into `save()` so it persists (extend the `WorkingBlock` mapping):
```ts
    const blocks: WorkingBlock[] = interaction.state.blocks.map((b) => ({
      ...b,
      shell: shellsRef.current[b.id] ?? null,
      autofit: interaction.autofit[b.id] ?? null,
      minRowSpan: interaction.minRowSpan[b.id] ?? null,
      content: contentsRef.current[b.id] ?? null,
    }));
```
Add `interaction.autofit`, `interaction.minRowSpan` to the `save` useCallback deps array.

- [ ] **Step 7: Never PUT the grown interim — only the committed, gravity-stable state (atomicity, spec §4.4 手势边界).** This is a CORRECTNESS guard, not just a UX nicety: the grown mid-gesture layout is non-gravity-stable (a block was pushed down with gravity suspended, leaving a `canRise` gap), and the working-state PUT runs `validateState(state, { gravity: true })` server-side, which REJECTS a non-stable layout on gravity-on pages (422). So the grown interim MUST NEVER be PUT. The rule: during an active autofit gesture the debounced autosave does NOT PUT; the gesture COMMITS on block deactivation (Escape/blur) OR a typing-idle debounce, at which point the controller first runs the commit-recompact `applyGravity` once (for gravity-on pages, per the COMMIT RULE) and only the resulting gravity-stable state is PUT. Consequence to make explicit: **reversibility is scoped to "within one active editing session / typing burst"** — grow-then-shrink reconciles cleanly from the gesture base while the block stays active; once the gesture commits (deactivate/idle) the recompacted layout becomes the new base and that committed state is what persists. Guard the debounced save in `EditorPage.tsx` so it short-circuits while a block is active mid-gesture; autosave fires only when no block is active OR after the gesture's commit has settled:
```ts
  const save = useCallback(async (): Promise<boolean> => {
    // ATOMICITY / CORRECTNESS (spec §4.4 手势边界): the grown interim is
    // non-gravity-stable (a neighbor was pushed down with gravity suspended),
    // and the server PUT runs validateState({ gravity: true }) which REJECTS
    // a non-stable layout on gravity-on pages (422). So we NEVER PUT the
    // grown interim. While a block is active its autofit gesture owns the
    // layout; the gesture commits on deactivation (Escape/blur) or typing-idle
    // debounce — the controller runs the commit-recompact applyGravity once
    // (gravity-on pages) and ONLY that gravity-stable committed state is PUT.
    // Reversibility is therefore scoped to one active editing session / burst.
    if (activeId !== null) return true; // treat as a no-op success; re-armed on next change
    setStatus({ kind: 'saving' });
    // …existing body…
  }, [pageId, title, interaction.state, interaction.gravityEnabled, interaction.autofit, interaction.minRowSpan, activeId]);
```

- [ ] **Step 8: Run the menu test + full web suite + typecheck.**
```
cd apps/web && npx vitest run src/grid/__tests__/GridCanvasAutofitMenu.test.tsx
cd apps/web && npx vitest run
cd apps/web && npx tsc --noEmit
```
Expected: menu test `1 passed`; full suite green (all prior grid/overlay/autosave tests still pass); no type errors.

- [ ] **Step 9: Commit.**
```
git add apps/web/src/grid/GridCanvas.tsx apps/web/src/pages/EditorPage.tsx apps/web/src/grid/__tests__/GridCanvasAutofitMenu.test.tsx
git commit -m "feat(web): autofit toggle in block menu + MeasureProbe/gesture wiring + clip + persist

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```


## Phase: markdown-publish (MarkdownEditView single-pane + floating ghost preview; autofit overflow threading through PublishedDocShape.blocks + BlockFrameProps + all theme shells + GridCanvas inactive + PublishedCanvas + static renderer)

_Depends on: "- Web working-state / measurement-loop subsystem: must (a) add the per-block autofit map to `GridCanvasProps` consumed in Task 4 (proposed `autofits?: Record<string,boolean>`), and (b) own the §5.3 offscreen Frame-wrapped measuring RenderView + fit derivation that REUSES this EditView's `data-skb-ghost-preview` instance. My Task 5 ghost is the visible half; the measuring/colSpan-exact-width half is theirs.\n- Server/export/publish subsystem: must populate `PublishedDocShape.blocks[].autofit` from the `blocks.autofit` metadata column ('grow' → true; null/'off' → absent) so Task 3's clip path activates on real published pages. The per-block-metadata schema (`blocks.autofit TEXT`, `blocks.min_row_span INTEGER`) and the route guard are owned by the server/route subsystem.\n- Engine `pushResize` / `captureLayoutSnapshot` / reconcile: NOT referenced by this subsystem — overflow + EditView are render-only, no engine mutation here.\n- Tasks 1→2→3→(4,5) are internally ordered: the `blockOverflow` helper + `BlockFrameProps.autofit` (Task 1) must land before shells (Task 2) and PublishedCanvas (Task 3) can import/pass them; Task 4 needs Task 1's prop; Task 5 is independent of 1-4 but commits last."_

> **Measurement-vs-ghost seam (no shared edit).** The AUTHORITATIVE fit measurement is NOT this phase's ghost — it is the web-layer `MeasureProbe` owned by the web-reconcile phase (the host/GridCanvas mounts it, and because the host has `colSpan`/`kind`/`shell`/`theme` it wraps the RenderView via `resolveBlockFrame(theme, kind, shell)` at the exact geometry width `colSpan*slot - 2*pad`). The `MarkdownEditView` floating ghost added in THIS phase is a UX preview only: it renders `MarkdownRenderView`, is NOT the authoritative measurement, and need not be Frame-wrapped. They are two different DOM nodes: only this markdown-publish phase touches `MarkdownEditView`, only the web-reconcile phase owns `MeasureProbe` — neither edits the other's node.

**File structure:**
- MODIFY packages/theme/src/themes.ts — add `autofit?: boolean` to `BlockFrameProps`; add exported `blockOverflow(autofit)` helper returning `'hidden' | 'auto'`; `DefaultBlockFrame` path threads it (helper lives here so every shell + frames.tsx can import without a cycle).
- MODIFY packages/block-kinds/src/frames.tsx — `DefaultBlockFrame` reads `autofit` prop and applies `blockOverflow(autofit)` instead of hardcoded `overflow:'auto'`.
- MODIFY packages/theme/src/shells.tsx — `FlatShellFrame` threads `autofit` → overflow.
- MODIFY packages/theme/src/galley.tsx — `GalleyBlockFrame`, `KeylineFrame`, `CutoutFrame` thread `autofit` → overflow.
- MODIFY packages/theme/src/marginalia.tsx — `MarginaliaBlockFrame`, `PlateFrame`, `AsideFrame` thread `autofit` → overflow.
- MODIFY packages/theme/src/stationery.tsx — `StationeryBlockFrame`, `PolaroidFrame`, `CardFrame`, `BareFrame` (and the inner `.skb-paper` scroll containers) thread `autofit` → overflow.
- MODIFY packages/block-kinds/src/PublishedCanvas.tsx — `PublishedDocShape.blocks[].autofit?: boolean`; pass `autofit={!!b.autofit}` to `<BlockFrame>`.
- MODIFY apps/web/src/grid/GridCanvas.tsx — inactive render `<Frame …>` passes `autofit` for the block (from working-state autofit metadata threaded by the web subsystem).
- MODIFY packages/block-kinds/src/markdown/MarkdownEditView.tsx — delete dual-pane; single textarea filling block + visible right-aligned floating ghost preview (renders `MarkdownRenderView`, marked `data-skb-ghost-preview`; UX preview only — NOT the authoritative measurement, not necessarily Frame-wrapped — the colSpan-exact measurement is the web-reconcile phase's `MeasureProbe`).
- TEST packages/block-kinds/src/__tests__/frames-autofit.test.ts — autofit → overflow:hidden, default → overflow:auto, across DefaultBlockFrame + every shell, via renderStaticPage.
- TEST packages/block-kinds/src/__tests__/markdown-editview.test.tsx — single textarea, no dual-pane preview pane, visible (not aria-hidden-only) ghost preview present (happy-dom).
- TEST extend packages/block-kinds/src/__tests__/static.test.ts — autofit block renders overflow:hidden in published static HTML.

### Task 21: Thread an `autofit` flag through `BlockFrameProps` and add the shared overflow helper

**Files:**
- Modify: `packages/theme/src/themes.ts`
- Modify: `packages/block-kinds/src/frames.tsx`
- Test: `packages/block-kinds/src/__tests__/frames-autofit.test.ts` (create)

Grounding: `BlockFrameProps` is defined in `packages/theme/src/themes.ts` (lines 32-44) and re-exported via `packages/theme/src/index.ts`. `DefaultBlockFrame` (`frames.tsx`) currently hardcodes `overflow:'auto'` over `blockCardStyle`'s `overflow:'hidden'`. The contract: autofit blocks clip (`overflow:hidden`), non-autofit keep `overflow:auto`.

- [ ] **Step 1: RED — failing test for the default frame's autofit overflow.** Create `packages/block-kinds/src/__tests__/frames-autofit.test.ts`. block-kinds tests render via `renderToStaticMarkup` through `renderStaticPage` (see `static.test.ts`/`slots.test.ts`), which is the real publish path; assert on the emitted inline `style`. The default theme (`graphPaper`) curates no shells, so a block lands on `DefaultBlockFrame`.

```ts
import { describe, expect, test } from 'vitest';
import { graphPaper } from '@skb/theme';
import { renderStaticPage } from '../static';

const base = {
  id: 'b1',
  kind: 'markdown' as const,
  col: 0,
  row: 0,
  colSpan: 6,
  rowSpan: 2,
  content: { markdown: 'hello' },
};

function docWith(autofit: boolean | undefined) {
  return { title: 't', blocks: [{ ...base, autofit }] };
}

describe('DefaultBlockFrame autofit overflow', () => {
  test('autofit block clips (overflow:hidden)', () => {
    const html = renderStaticPage(docWith(true), 's', graphPaper);
    expect(html).toContain('overflow:hidden');
    expect(html).not.toContain('overflow:auto');
  });

  test('non-autofit block scrolls (overflow:auto)', () => {
    const html = renderStaticPage(docWith(false), 's', graphPaper);
    expect(html).toContain('overflow:auto');
  });

  test('absent autofit defaults to scroll (legacy/off)', () => {
    const html = renderStaticPage(docWith(undefined), 's', graphPaper);
    expect(html).toContain('overflow:auto');
  });
});
```

- [ ] **Step 2: RUN the test, confirm it fails RED.**

```
cd packages/block-kinds && bun run test -- frames-autofit
```

Expected: the `autofit block clips` test FAILS — `renderStaticPage(docWith(true), …)` still emits `overflow:auto` (the flag is not threaded yet) and never emits `overflow:hidden` from the frame. (`PublishedDocShape` has no `autofit` field yet, so this also surfaces a TS error in the test until Task 4; if `bun run test` refuses to run on the type error, proceed to Step 3+4 first then re-run — note it as expected.)

- [ ] **Step 3: GREEN — add `autofit` to `BlockFrameProps` and a shared `blockOverflow` helper in `themes.ts`.** Insert the prop into the existing `BlockFrameProps` type (after the `shell` field, before `children`) and add the helper near the other style helpers at the bottom of the file (after `canvasBaseplateStyle`). The helper lives in `@skb/theme` so every shell file AND `frames.tsx` import it without a package cycle (they already import from `./themes` / `@skb/theme`).

In `packages/theme/src/themes.ts`, change the `BlockFrameProps` type:

```ts
export type BlockFrameProps = {
  kind: string;
  blockId: string;
  /** Geometry hints (grid units) — themes may scale effects by size
   * (e.g. wide blocks tilt less). Never used for layout (canvas owns
   * geometry). */
  colSpan: number;
  rowSpan: number;
  /** Author-picked shell option id; null/unknown = the theme's default
   * shell (a theme update may remove an option — pages keep rendering). */
  shell?: string | null;
  /** Autofit blocks clip overflow (the no-scrollbar aesthetic: rowSpan
   * already fits the content); non-autofit blocks scroll. block-level
   * metadata, threaded from PublishedDocShape.blocks / working state —
   * the frame only consumes it, it never measures. */
  autofit?: boolean;
  children: ReactNode;
};
```

Then append the helper at the end of `themes.ts`:

```ts
/** Block body overflow under the autofit contract: autofit blocks clip
 * (no scrollbar — rowSpan ≥ fit so content lands exactly), every other
 * block keeps the theme's scroll behavior. Single truth source so the
 * default frame and every curated shell agree. */
export function blockOverflow(autofit: boolean | undefined): 'hidden' | 'auto' {
  return autofit ? 'hidden' : 'auto';
}
```

- [ ] **Step 4: GREEN — thread the flag in `DefaultBlockFrame`.** In `packages/block-kinds/src/frames.tsx`, accept `autofit` and replace the hardcoded overflow. Import `blockOverflow` from `@skb/theme`.

Change the import line:

```ts
import { blockCardStyle, blockOverflow, canvasBaseplateStyle, useTheme } from '@skb/theme';
```

Change `DefaultBlockFrame`:

```ts
export function DefaultBlockFrame({ kind, blockId: _blockId, colSpan: _c, rowSpan: _r, autofit, children }: BlockFrameProps) {
  const theme = useTheme();
  // Default shell only — author shell choices resolve to their own
  // Frames via theme.shells (resolveBlockFrame); unknown ids land here.
  return (
    <div
      className="skb-block"
      data-kind={kind}
      style={{
        ...blockCardStyle(theme, kind),
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        fontSize: '14px',
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 5: RUN the default-frame test, confirm GREEN.** (Requires Task 4's `PublishedCanvas` threading for the flag to reach the frame — if you are sequencing strictly, run after Task 4. The frame change itself is complete here.)

```
cd packages/block-kinds && bun run test -- frames-autofit
```

Expected after Task 4 lands: all three `DefaultBlockFrame autofit overflow` tests PASS.

- [ ] **Step 6: RUN typecheck on theme + block-kinds.**

```
cd packages/theme && bun run typecheck && cd ../block-kinds && bun run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit.**

```
git add packages/theme/src/themes.ts packages/block-kinds/src/frames.tsx packages/block-kinds/src/__tests__/frames-autofit.test.ts
git commit -m "$(cat <<'EOF'
feat(theme+block-kinds): autofit flag on BlockFrameProps + blockOverflow helper

Default frame clips when autofit, scrolls otherwise.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 22: Thread `autofit` overflow through every curated theme shell

**Files:**
- Modify: `packages/theme/src/shells.tsx`
- Modify: `packages/theme/src/galley.tsx`
- Modify: `packages/theme/src/marginalia.tsx`
- Modify: `packages/theme/src/stationery.tsx`
- Test: `packages/block-kinds/src/__tests__/frames-autofit.test.ts` (extend)

Grounding: every shell `Frame` hardcodes `overflow:'auto'` on its body div. The shells are: `FlatShellFrame` (shells.tsx, used by `workbench`); `GalleyBlockFrame`/`KeylineFrame`/`CutoutFrame` (galley.tsx); `MarginaliaBlockFrame`/`PlateFrame`/`AsideFrame` (marginalia.tsx); `StationeryBlockFrame` default + `PolaroidFrame`/`CardFrame`/`BareFrame` (stationery.tsx). In stationery the scroll container is the inner `.skb-paper` div (and the polaroid photo window), not the rotated wrapper.

- [ ] **Step 1: RED — extend the test to cover the shell frames.** Append to `packages/block-kinds/src/__tests__/frames-autofit.test.ts`. `workbench` curates `flat`; `galley` curates `keyline`/`cutout`; `marginalia` curates `plate`/`aside`; `stationery` curates `card`/`bare`. Each theme's DEFAULT shell is also exercised. We assert that an autofit block's published HTML contains `overflow:hidden` and that the same block without autofit contains `overflow:auto`.

```ts
import { galley, marginalia, stationery, workbench, type Theme } from '@skb/theme';

const SHELL_CASES: Array<{ theme: Theme; shells: Array<string | null> }> = [
  { theme: workbench, shells: [null, 'flat'] },
  { theme: galley, shells: [null, 'keyline', 'cutout'] },
  { theme: marginalia, shells: [null, 'plate', 'aside'] },
  { theme: stationery, shells: [null, 'card', 'bare'] },
];

function docWithShell(autofit: boolean, shell: string | null) {
  return { title: 't', blocks: [{ ...base, autofit, shell }] };
}

describe('curated shell autofit overflow', () => {
  for (const { theme, shells } of SHELL_CASES) {
    for (const shell of shells) {
      test(`${theme.id}/${shell ?? 'default'} clips when autofit`, () => {
        const html = renderStaticPage(docWithShell(true, shell), 's', theme);
        expect(html, `${theme.id}/${shell}`).toContain('overflow:hidden');
      });
      test(`${theme.id}/${shell ?? 'default'} scrolls when not autofit`, () => {
        const html = renderStaticPage(docWithShell(false, shell), 's', theme);
        expect(html, `${theme.id}/${shell}`).toContain('overflow:auto');
      });
    }
  }
});
```

- [ ] **Step 2: RUN, confirm RED.**

```
cd packages/block-kinds && bun run test -- frames-autofit
```

Expected: the `clips when autofit` cases FAIL (shells still emit `overflow:auto` regardless of the flag).

- [ ] **Step 3: GREEN — `shells.tsx`.** Import `blockOverflow`, accept `autofit`, apply it in `FlatShellFrame`.

Change import:

```ts
import { useTheme } from './context';
import { blockOverflow, type BlockFrameProps } from './themes';
```

Change `FlatShellFrame` signature + style:

```ts
export function FlatShellFrame({ kind, shell, autofit, children }: BlockFrameProps) {
  const theme = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      data-shell={shell ?? undefined}
      style={{
        padding: '8px 10px',
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        fontSize: '14px',
        lineHeight: 1.55,
        color: theme.textColor,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: GREEN — `galley.tsx`.** Add `blockOverflow` to the import from `./themes`, then thread `autofit` through all three frames (`GalleyBlockFrame`, `KeylineFrame`, `CutoutFrame`), replacing each `overflow: 'auto'` with `overflow: blockOverflow(autofit)` and adding `autofit` to each destructure.

Change import:

```ts
import { blockOverflow, type BlockFrameProps, type CanvasSurfaceProps, type PageTitleProps, type Theme, type ThemeTokens } from './themes';
```

`GalleyBlockFrame`:

```ts
function GalleyBlockFrame({ kind, autofit, children }: BlockFrameProps) {
  const t = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      style={{
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        padding: '10px 12px',
        fontSize: '14.5px',
        lineHeight: 1.62,
        color: t.textColor,
        background: t.blockBg,
        border: t.blockBorder,
        boxShadow: '0 1px 2px oklch(40% 0.02 80 / 14%)',
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  );
}
```

`KeylineFrame`:

```ts
function KeylineFrame({ kind, shell, autofit, children }: BlockFrameProps) {
  const t = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      data-shell={shell ?? undefined}
      style={{
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        padding: '14px 16px',
        fontSize: '14.5px',
        lineHeight: 1.62,
        color: t.textColor,
        background: t.blockBg,
        border: `1px solid ${t.textColor}`,
        outline: `1px solid ${t.hairline}`,
        outlineOffset: '3px',
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  );
}
```

`CutoutFrame`:

```ts
function CutoutFrame({ kind, shell, autofit, children }: BlockFrameProps) {
  const t = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      data-shell={shell ?? undefined}
      style={{
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        fontSize: '14.5px',
        lineHeight: 1.62,
        color: t.textColor,
        filter: 'drop-shadow(0 1px 2px oklch(40% 0.02 80 / 18%))',
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 5: GREEN — `marginalia.tsx`.** Add `blockOverflow` to the import, thread `autofit` through `MarginaliaBlockFrame`, `PlateFrame`, `AsideFrame`.

Change import:

```ts
import { blockOverflow, type BlockFrameProps, type CanvasSurfaceProps, type PageTitleProps, type Theme, type ThemeTokens } from './themes';
```

`MarginaliaBlockFrame`:

```ts
function MarginaliaBlockFrame({ kind, autofit, children }: BlockFrameProps) {
  const t = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      style={{
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        padding: '8px 10px',
        fontSize: '15px',
        lineHeight: 1.7,
        color: t.textColor,
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  );
}
```

`PlateFrame`:

```ts
function PlateFrame({ kind, shell, autofit, children }: BlockFrameProps) {
  const t = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      data-shell={shell ?? undefined}
      style={{
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        padding: '12px 14px',
        fontSize: '15px',
        lineHeight: 1.7,
        color: t.textColor,
        border: `1px solid ${t.hairline}`,
        background: 'oklch(99% 0.004 90)',
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  );
}
```

`AsideFrame`:

```ts
function AsideFrame({ kind, shell, autofit, children }: BlockFrameProps) {
  const t = useTheme();
  return (
    <div
      className="skb-block"
      data-kind={kind}
      data-shell={shell ?? undefined}
      style={{
        width: '100%',
        height: '100%',
        overflow: blockOverflow(autofit),
        padding: '4px 10px 4px 12px',
        fontSize: '13px',
        lineHeight: 1.65,
        color: t.quoteColor,
        borderLeft: `2px solid ${t.accent}`,
        scrollbarWidth: 'thin',
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 6: GREEN — `stationery.tsx`.** Add `blockOverflow` to the import. Thread `autofit` into the four frames; the scroll container is the inner `.skb-paper` (and the polaroid photo window), not the rotated wrapper. `PolaroidFrame`'s signature is a custom inline type — extend it with `autofit`.

Change import:

```ts
import { blockOverflow, type BlockFrameProps, type CanvasSurfaceProps, type PageTitleProps, type Theme, type ThemeTokens } from './themes';
```

`PolaroidFrame` — add `autofit` to its props type and apply it on the photo-window `.skb-paper`:

```ts
function PolaroidFrame({ kind, blockId, colSpan, tape, autofit, children }: { kind: string; blockId: string; colSpan: number; tape: string; autofit?: boolean; children: ReactNode }) {
  const tilt = (tiltOf(blockId, colSpan) * 1.4).toFixed(3);
  return (
    <div
      className="skb-block skb-paper-slip skb-polaroid"
      data-kind={kind}
      style={{ position: 'relative', width: '100%', height: '100%', transform: `rotate(${tilt}deg)` }}
    >
      <div
        aria-hidden
        className="skb-washi"
        style={{
          position: 'absolute',
          top: '-7px',
          left: '50%',
          width: '58px',
          height: '14px',
          transform: `translateX(-50%) rotate(${(-Number(tilt) * 1.2).toFixed(3)}deg)`,
          background: tape,
          opacity: 0.78,
          boxShadow: '0 1px 2px oklch(40% 0.04 60 / 25%)',
          zIndex: 3,
        }}
      />
      <div
        className="skb-polaroid-card"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(178deg, oklch(98% 0.004 95), oklch(97% 0.005 95))',
          boxShadow:
            'inset 0 0 0 1px oklch(93% 0.008 95), 0 3px 8px oklch(38% 0.04 60 / 26%), 0 1px 2px oklch(38% 0.04 60 / 14%)',
          padding: '10px 10px 30px',
        }}
      >
        <div
          className="skb-paper"
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            background: 'oklch(30% 0.01 80)',
            overflow: blockOverflow(autofit),
            fontSize: '14px',
            lineHeight: 1.55,
            color: 'oklch(90% 0.01 80)',
            boxShadow: 'inset 0 1px 3px oklch(0% 0 0 / 45%), inset 0 0 1px oklch(0% 0 0 / 55%)',
          }}
        >
          {children}
        </div>
        <div aria-hidden className="skb-polaroid-gloss" style={{ position: 'absolute', inset: '10px 10px 30px', pointerEvents: 'none', zIndex: 2 }} />
      </div>
    </div>
  );
}
```

`CardFrame` — thread `autofit` into the `.skb-paper`:

```ts
function CardFrame({ kind, blockId, colSpan, autofit, children }: BlockFrameProps) {
  const t = useTheme();
  const tape = t.kindHues[kind] ?? t.kindHueFallback;
  const tilt = tiltOf(blockId, colSpan).toFixed(3);
  return (
    <div
      className="skb-block skb-paper-slip"
      data-kind={kind}
      style={{ position: 'relative', width: '100%', height: '100%', transform: `rotate(${tilt}deg)` }}
    >
      <div
        aria-hidden
        className="skb-washi"
        style={{
          position: 'absolute',
          top: '-7px',
          left: '50%',
          width: '64px',
          height: '15px',
          transform: `translateX(-50%) rotate(${(-Number(tilt) * 1.7).toFixed(3)}deg)`,
          background: tape,
          opacity: 0.78,
          boxShadow: '0 1px 2px oklch(40% 0.04 60 / 25%)',
          zIndex: 3,
        }}
      />
      <div
        className="skb-paper"
        style={{
          position: 'absolute',
          inset: 0,
          padding: '10px 8px 8px',
          overflow: blockOverflow(autofit),
          fontSize: '14px',
          lineHeight: 1.55,
          borderRadius: '3px',
          boxShadow:
            'inset 0 0 0 1px oklch(93% 0.008 95), 0 3px 8px oklch(38% 0.04 60 / 26%), 0 1px 2px oklch(38% 0.04 60 / 14%)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

`BareFrame` — the wrapper itself is the scroll container here:

```ts
function BareFrame({ kind, blockId, colSpan, autofit, children }: BlockFrameProps) {
  const tilt = tiltOf(blockId, colSpan).toFixed(3);
  return (
    <div
      className="skb-block skb-bare"
      data-kind={kind}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        transform: `rotate(${tilt}deg)`,
        overflow: blockOverflow(autofit),
        fontSize: '14px',
        lineHeight: 1.55,
        filter: 'drop-shadow(0 3px 7px oklch(38% 0.04 60 / 30%))',
        scrollbarWidth: 'none',
      }}
    >
      {children}
    </div>
  );
}
```

`StationeryBlockFrame` — accept `autofit`, forward to `PolaroidFrame` and apply to the default-slip `.skb-paper`:

```ts
function StationeryBlockFrame({ kind, blockId, colSpan, rowSpan, autofit, children }: BlockFrameProps) {
  const t = useTheme();
  const tilt = tiltOf(blockId, colSpan).toFixed(3);
  const tape = t.kindHues[kind] ?? t.kindHueFallback;
  const curl = curlSideOf(blockId);
  if (kind === 'image') {
    return (
      <PolaroidFrame kind={kind} blockId={blockId} colSpan={colSpan} tape={tape} autofit={autofit}>
        {children}
      </PolaroidFrame>
    );
  }
  void rowSpan;
  return (
    <div
      className="skb-block skb-paper-slip"
      data-kind={kind}
      style={{ position: 'relative', width: '100%', height: '100%', transform: `rotate(${tilt}deg)` }}
    >
      <div
        aria-hidden
        className="skb-washi"
        style={{
          position: 'absolute',
          top: '-7px',
          left: '50%',
          width: '64px',
          height: '15px',
          transform: `translateX(-50%) rotate(${(-Number(tilt) * 1.7).toFixed(3)}deg)`,
          background: tape,
          opacity: 0.78,
          boxShadow: '0 1px 2px oklch(40% 0.04 60 / 25%)',
          zIndex: 3,
        }}
      />
      <div aria-hidden className={`skb-curl skb-curl-${curl}`} />
      <div aria-hidden className="skb-paper-edge" />
      <div
        className="skb-paper"
        style={{
          position: 'absolute',
          inset: '3px',
          padding: '10px 8px 8px',
          overflow: blockOverflow(autofit),
          fontSize: '14px',
          lineHeight: 1.55,
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

NOTE: stationery's `globalCss` `.skb-paper` rule sets `background-attachment: local` scroll-curl gradients; under `overflow:hidden` they simply never scroll (correct — no scroll, no curl). No CSS change needed.

- [ ] **Step 7: RUN the full autofit frame suite, confirm GREEN.**

```
cd packages/block-kinds && bun run test -- frames-autofit
```

Expected: all `curated shell autofit overflow` cases PASS (every theme/shell clips when autofit, scrolls otherwise).

- [ ] **Step 8: RUN the theme + block-kinds suites + typecheck (guard the existing slot/static tests that assert on shell markup).**

```
cd packages/theme && bun run typecheck && cd ../block-kinds && bun run typecheck && bun run test
```

Expected: green; `slots.test.ts` and `static.test.ts` still pass (those docs omit `autofit`, so frames keep `overflow:auto` exactly as before — no regression).

- [ ] **Step 9: Commit.**

```
git add packages/theme/src/shells.tsx packages/theme/src/galley.tsx packages/theme/src/marginalia.tsx packages/theme/src/stationery.tsx packages/block-kinds/src/__tests__/frames-autofit.test.ts
git commit -m "$(cat <<'EOF'
feat(theme): autofit overflow:hidden across every curated shell

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 23: Thread `autofit` through `PublishedDocShape.blocks` + publish/read frame, and the static renderer

**Files:**
- Modify: `packages/block-kinds/src/PublishedCanvas.tsx`
- Test: `packages/block-kinds/src/__tests__/static.test.ts` (extend)

Grounding: `PublishedCanvas` (lines 50-100) maps `doc.blocks` to positioned wrappers, resolving `BlockFrame = resolveBlockFrame(theme, b.kind, b.shell) ?? Frame` and rendering `<BlockFrame kind … colSpan … rowSpan … shell …>`. It does NOT pass `autofit` today. `PublishedDocShape.blocks[]` (lines 16-26) has no `autofit` field. `renderStaticPage` (static.ts) renders `PublishedCanvas` via `renderToStaticMarkup` — pure path, never measures. This is the shared layout for BOTH the SPA read route and publish-time static HTML, so threading here covers "PublishedCanvas + static renderer" in one place.

- [ ] **Step 1: RED — published static HTML must clip an autofit block.** Append to `packages/block-kinds/src/__tests__/static.test.ts`:

```ts
describe('autofit publish overflow', () => {
  test('autofit block renders overflow:hidden; non-autofit keeps overflow:auto', () => {
    const doc = {
      title: 'autofit',
      blocks: [
        { id: 'a', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, autofit: true, content: { markdown: 'clip me' } },
        { id: 'b', kind: 'markdown', col: 6, row: 0, colSpan: 6, rowSpan: 2, content: { markdown: 'scroll me' } },
      ],
    };
    const html = renderStaticPage(doc, 's', graphPaper);
    expect(html).toContain('overflow:hidden');
    expect(html).toContain('overflow:auto');
  });
});
```

- [ ] **Step 2: RUN, confirm RED.**

```
cd packages/block-kinds && bun run test -- static
```

Expected: TS error or assertion failure — `PublishedDocShape.blocks` has no `autofit` field, and the frame is not receiving it, so `overflow:hidden` is absent.

- [ ] **Step 3: GREEN — add `autofit` to `PublishedDocShape` and pass it to the frame.** In `packages/block-kinds/src/PublishedCanvas.tsx`, extend the block shape (after `shell`, before `content`):

```ts
  blocks: Array<{
    id: string;
    kind: string;
    col: number;
    row: number;
    colSpan: number;
    rowSpan: number;
    /** Author-picked theme shell option id (M6-D3). */
    shell?: string | null;
    /** Autofit flag (block metadata): clip overflow instead of scroll.
     * Server/publish NEVER measures — it trusts the rowSpan already
     * reconciled at edit time and only carries the flag through. */
    autofit?: boolean;
    content: unknown;
  }>;
```

Then pass it at the frame call site (line ~84):

```tsx
                <BlockFrame kind={b.kind} blockId={b.id} colSpan={b.colSpan} rowSpan={b.rowSpan} shell={b.shell} autofit={b.autofit}>
```

- [ ] **Step 4: RUN the static + frames suites, confirm GREEN.**

```
cd packages/block-kinds && bun run test -- static frames-autofit
```

Expected: the new `autofit publish overflow` test PASSES, and the Task-1 `DefaultBlockFrame autofit overflow` tests now PASS end-to-end (the flag reaches the frame through `PublishedCanvas`).

- [ ] **Step 5: RUN the whole block-kinds suite + typecheck.**

```
cd packages/block-kinds && bun run typecheck && bun run test
```

Expected: green; the existing `static.test.ts`/`slots.test.ts` baseline docs (no `autofit`) are unaffected.

- [ ] **Step 6: Commit.**

```
git add packages/block-kinds/src/PublishedCanvas.tsx packages/block-kinds/src/__tests__/static.test.ts
git commit -m "$(cat <<'EOF'
feat(block-kinds): thread autofit through PublishedDocShape + publish frame

Published/read frame clips autofit blocks; server never measures.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 24: Mirror autofit on the GridCanvas inactive render

**Files:**
- Modify: `apps/web/src/grid/GridCanvas.tsx`

Grounding: `GridCanvas` `BlockShell` (lines ~160-296) resolves `Frame = resolveBlockFrame(theme, block.kind, shell) ?? theme.BlockFrame ?? DefaultBlockFrame` and renders `<Frame kind={block.kind} blockId={block.id} colSpan={block.colSpan} rowSpan={block.rowSpan} shell={shell}>` (line 264). It does NOT pass `autofit`. The block's autofit metadata is owned by the web working-state subsystem (the `autofit` block-level field). `GridCanvasProps` carries per-block metadata maps already (e.g. `shells` keyed by block id, see line 170 `shells[block.id]`). This task only consumes whatever map the web-state subsystem exposes; the EXACT prop name is owned by that subsystem — see Open Questions and `dependsOn`.

- [ ] **Step 1: Read the current `GridCanvasProps` and the autofit map provided by the web-state subsystem.** Confirm the prop the web subsystem threads (mirroring `shells: Record<string,string|null>`). Expected shape from that subsystem: `autofits?: Record<string, boolean>` (block id → autofit on). If the name differs, use the real one.

```
rg -n "shells\b|autofit" apps/web/src/grid/GridCanvas.tsx
```

- [ ] **Step 2: GREEN — pass `autofit` to the inactive Frame.** At the `<Frame …>` call (line 264), add the flag. Read the per-block value the same way `shell` is read (`shells[block.id]`):

```tsx
      <Frame kind={block.kind} blockId={block.id} colSpan={block.colSpan} rowSpan={block.rowSpan} shell={shell} autofit={autofits?.[block.id] ?? false}>
```

Add `autofits` to the destructured `GridCanvasProps` in `BlockShell` (alongside `shells`, `pad`, `slot`). If the web-state subsystem has not yet added `autofits` to `GridCanvasProps`, this is a typed dependency — coordinate via `dependsOn`; do NOT invent a second source of truth for autofit in the web layer.

- [ ] **Step 3: RUN web typecheck + tests.**

```
cd apps/web && bun run typecheck && bun run test
```

Expected: green (the inactive markdown block now clips when its working-state autofit flag is on, matching publish).

- [ ] **Step 4: Commit.**

```
git add apps/web/src/grid/GridCanvas.tsx
git commit -m "$(cat <<'EOF'
feat(web): mirror autofit overflow:hidden on inactive GridCanvas blocks

Inactive editor render matches publish — autofit clips, others scroll.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 25: MarkdownEditView — single textarea filling the block + visible right-aligned floating ghost preview

**Files:**
- Modify: `packages/block-kinds/src/markdown/MarkdownEditView.tsx`
- Test: `packages/block-kinds/src/__tests__/markdown-editview.test.tsx` (create)

Grounding: today `MarkdownEditView` (`BlockViewProps<MarkdownContent>` = `{ content, onChange }`) is a flex row of a `textarea` (flex:1) and an `aria-hidden` `overflow:auto` preview pane (flex:1) wrapping `<MarkdownRenderView content={content} />`. The spec (§7) deletes the dual pane: the active surface is a single textarea filling the block; the §5.3 Frame-wrapped measuring RenderView is made into a VISIBLE right-aligned floating ghost preview (the same RenderView component, not a second render component). The EditView receives NO geometry/kind/shell props (only `content`/`onChange`) and reads tokens via `useTheme()`. The ghost is the SAME `MarkdownRenderView` the measurement loop wraps. The measurement-loop subsystem owns the offscreen measuring instance + colSpan-exact width + fit derivation; this task owns the editing-surface restructure and the VISIBLE ghost container so the author keeps the render feedback loop without re-activating the block.

- [ ] **Step 1: RED — test the new single-pane shape + visible ghost.** Create `packages/block-kinds/src/__tests__/markdown-editview.test.tsx`. block-kinds DOM tests use the `// @vitest-environment happy-dom` pragma and `renderToStaticMarkup` into a `document.createElement('div')` host, then query (see `richtext.test.tsx`). This package does NOT use `@testing-library/react`/`cleanup` — the SSR-string-into-host pattern is the established convention and needs no `afterEach(cleanup)` because nothing mounts to a shared `document.body`. (The cross-cutting `afterEach(cleanup)` rule applies to testing-library mounts; this file uses the package's existing SSR-render-then-query convention, so cleanup is N/A — noted in Open Questions.)

```tsx
// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider, graphPaper } from '@skb/theme';
import { MarkdownEditView } from '../markdown/MarkdownEditView';

function renderEdit(markdown: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(
    <ThemeProvider theme={graphPaper}>
      <MarkdownEditView content={{ markdown }} onChange={() => undefined} />
    </ThemeProvider>,
  );
  return host;
}

describe('MarkdownEditView single-pane + ghost preview', () => {
  test('renders exactly one textarea (no dual editing pane)', () => {
    const host = renderEdit('# hi');
    expect(host.querySelectorAll('textarea')).toHaveLength(1);
  });

  test('the source textarea carries the markdown value and a label', () => {
    const host = renderEdit('# hi');
    const ta = host.querySelector('textarea')!;
    expect(ta.value).toBe('# hi');
    expect(ta.getAttribute('aria-label')).toBe('Markdown source');
  });

  test('ghost preview is present and renders the markdown (feedback loop)', () => {
    const host = renderEdit('# hi **bold**');
    const ghost = host.querySelector('[data-skb-ghost-preview]');
    expect(ghost).not.toBeNull();
    // the SAME MarkdownRenderView component renders inside it
    expect(ghost!.querySelector('.skb-md')).not.toBeNull();
    expect(ghost!.querySelector('strong')?.textContent).toBe('bold');
  });

  test('ghost preview is visible (right-aligned floating, NOT the old aria-hidden=true pane)', () => {
    const host = renderEdit('hi');
    const ghost = host.querySelector('[data-skb-ghost-preview]') as HTMLElement;
    // a visible preview the author can see — the old dual pane set aria-hidden
    expect(ghost.getAttribute('aria-hidden')).not.toBe('true');
    expect(ghost.style.position).toBe('absolute');
    expect(ghost.style.right).not.toBe('');
  });
});
```

- [ ] **Step 2: RUN, confirm RED.**

```
cd packages/block-kinds && bun run test -- markdown-editview
```

Expected: FAIL — the current view emits two flex panes, the preview is `aria-hidden` and `position:static`, and there is no `data-skb-ghost-preview` marker.

- [ ] **Step 3: GREEN — rewrite `MarkdownEditView`.** Replace the whole file. Single textarea fills the block (`position:relative` host so the ghost can float). The ghost is a right-aligned floating overlay wrapping the SAME `MarkdownRenderView`. It is visible (not `aria-hidden`), does not occupy block flow (absolutely positioned), and is marked `data-skb-ghost-preview` for the measurement-loop subsystem to locate/reuse.

```tsx
/**
 * Active-block editing surface (autofit design §7): a SINGLE textarea
 * filling the block — canonical content is the markdown source — plus a
 * VISIBLE right-aligned floating ghost preview. The ghost is the SAME
 * MarkdownRenderView the reader/publish path uses (and the §5.3
 * measurement loop wraps in the real Frame), so "edit-time render" and
 * "published render" can never drift. The dual editing pane is gone:
 * one source of truth for measurement (RenderView), one for authoring
 * (the source textarea). The measurement-loop subsystem owns the
 * offscreen Frame-wrapped instance + fit derivation; this surface owns
 * the author-facing ghost so the render feedback loop survives without
 * re-activating the block (block-markdown.md "keep the feedback loop").
 */
import { useEffect, useRef } from 'react';
import { useTheme } from '@skb/theme';
import type { BlockViewProps } from '../types';
import type { MarkdownContent } from './markdown';
import { MarkdownRenderView } from './MarkdownRenderView';

export function MarkdownEditView({ content, onChange }: BlockViewProps<MarkdownContent>) {
  const theme = useTheme();
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0 }}>
      <textarea
        ref={taRef}
        value={content.markdown}
        onChange={(e) => onChange({ markdown: e.target.value })}
        placeholder="Write markdown…"
        aria-label="Markdown source"
        style={{
          width: '100%',
          height: '100%',
          resize: 'none',
          border: `1px solid ${theme.accent}`,
          borderRadius: '4px',
          padding: '8px',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '13px',
          lineHeight: 1.5,
          color: theme.textColor,
          background: theme.blockBg,
          outline: 'none',
        }}
      />
      {/* Visible right-aligned floating ghost preview — the SAME
       * RenderView the reader sees. Floats over the textarea's top-right
       * so it never steals authoring width; pointer-events none so it is
       * a window, not a control. The measurement-loop subsystem finds it
       * via [data-skb-ghost-preview] to reuse this exact RenderView for
       * fit (no second render). */}
      <div
        data-skb-ghost-preview
        style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          maxWidth: '45%',
          maxHeight: 'calc(100% - 8px)',
          overflow: 'hidden',
          padding: '6px 8px',
          borderRadius: '4px',
          border: `1px dashed ${theme.hairline}`,
          background: theme.blockBg,
          boxShadow: '0 2px 6px oklch(40% 0.02 80 / 14%)',
          pointerEvents: 'none',
          opacity: 0.96,
          zIndex: 2,
        }}
      >
        <MarkdownRenderView content={content} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: RUN the editview suite, confirm GREEN.**

```
cd packages/block-kinds && bun run test -- markdown-editview
```

Expected: all four `MarkdownEditView single-pane + ghost preview` tests PASS.

- [ ] **Step 5: RUN the full block-kinds suite + typecheck (guard tool/static/slot tests).**

```
cd packages/block-kinds && bun run typecheck && bun run test
```

Expected: green. `tools.test.tsx` asserts `markdownModule.tools` is undefined and that EditViews don't embed migrated `<select>` controls — unaffected by this restructure.

- [ ] **Step 6: Commit.**

```
git add packages/block-kinds/src/markdown/MarkdownEditView.tsx packages/block-kinds/src/__tests__/markdown-editview.test.tsx
git commit -m "$(cat <<'EOF'
feat(block-kinds): MarkdownEditView single textarea + floating ghost preview

Delete the dual pane; one source textarea + a visible right-aligned
ghost RenderView (the same one the measurement loop wraps).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```


## Phase: e2e-devseed

_Depends on: "Runs LAST. Hard dependencies on every other subsystem landing first: (1) ENGINE `pushResize` op; (2) WEB reconcile controller + `captureLayoutSnapshot` + debounced measurement + commit rule — the grow/shrink spec is red without it; (3) MARKDOWN UI rewrite (single textarea + visible right-aligned ghost preview) — the ghost-preview spec is red without it; (4) BLOCK METADATA migration + `parseWorkingState`/working-state PUT accepting `autofit`/`minRowSpan` + the web `WorkingBlock`/`NotepageDetail` type extension — both the E2E page builder AND seed-bridge send these fields and the PUT must not 422/strip them; (5) PUBLISH threading of the autofit flag through `PublishedDocShape.blocks` + `BlockFrameProps` + frames applying `overflow:hidden` — the publish-clip spec is red without it; (6) ROUTE GUARD `rowSpan >= minRowSpan` assertion (the bridge seed sends G floor=1, rowSpan=1, so it passes; the guard must not reject valid pages). seed-bridge (Task 4) is the owner-required FINAL step and should be the very last task in the assembled plan. The Playwright harness (Task 1) has no feature dependency and can land early; Tasks 2-3 are written test-first but only go green after their respective subsystems land."_

**File structure:**
- Create `playwright.config.ts` (repo root): Playwright config — boots server (PORT 3210) + web (vite 5173) via `webServer`, single chromium project, baseURL http://localhost:5173, e2e dir `e2e/`.
- Create `e2e/fixtures/login.ts`: shared E2E helpers — `loginViaApi(page)` (cookie bootstrap through `/api/auth/sign-in/email` with dev creds), `createMarkdownPage(request, opts)` returning `{id, slug}` via the real HTTP API (mirrors seed `createPage`), selector constants (block by `data-block-id`, `textarea[aria-label="Markdown source"]`).
- Create `e2e/smoke.spec.ts`: harness smoke — loads `/login`, confirms auth endpoint accepts dev creds.
- Create `e2e/autofit-grow-shrink.spec.ts`: flow — type into autofit markdown block G grows it; AABB-below block W is pushed down (reads `data-block-id` `top`/height); delete shrinks G to floor and W returns to base row (C5 reversible path).
- Create `e2e/autofit-ghost-preview.spec.ts`: flow — while the markdown block is active, the right-aligned floating ghost preview shows rendered markdown (heading element) without deactivating the block.
- Create `e2e/autofit-fit-shells.spec.ts`: flow — on `galley` and `stationery` pinned shells, committed `rowSpan` (fit) equals live rendered row count (measure-through-real-Frame), asserted as content fits committed geometry (no overflow).
- Create `e2e/autofit-publish-clip.spec.ts`: flow — publish a page with an autofit block, open `/notes/:slug`, assert the autofit block's `.skb-block` frame computes `overflow: hidden` (clips), non-autofit stays `overflow: auto`.
- Create `apps/server/scripts/seed-bridge.ts`: THE FINAL TASK — seeds the G/W/K "桥块演示 / bridge problem" notepage into the owner dev库 through the real HTTP API (same login/createPage pose as seed-examples), autofit markdown G (cols0-1), straddling wide W (cols0-5) below, side-column K (cols4-5) below W; gravity ON; published + public for owner manual exercise.
- Modify root `package.json`: add `@playwright/test` + `playwright` devDependency and `test:e2e` / `seed:bridge` scripts.

### Task 26: Playwright harness + login/seed fixtures

Stand up Playwright against the bun workspace (single bun.lock — never pnpm/npm), wired to boot the real server + web dev servers, with a shared login/page-builder fixture that mirrors the seed-script HTTP pose. No Playwright exists in the repo today (verified: no `playwright.config.*`, no `e2e/` dir, no `playwright` dependency).

**Files:**
- Modify: `package.json` (repo root)
- Create: `playwright.config.ts` (repo root)
- Create: `e2e/fixtures/login.ts`
- Test: `e2e/smoke.spec.ts`

- [ ] **Step 1: Add Playwright to the root workspace (bun, single lock).**
  Run exactly:
  ```bash
  bun add -D -E @playwright/test@1.49.1 playwright@1.49.1
  bunx playwright install chromium
  ```
  Expected output (tail): `@playwright/test` and `playwright` appear under `devDependencies` in root `package.json`, `bun.lock` updates (no `pnpm-lock`/`package-lock` created), and `playwright install chromium` ends with `chromium ... downloaded to ...` (or `is already installed`). Do NOT run `pnpm add`.

- [ ] **Step 2: Add the e2e + seed scripts to root `package.json`.**
  Edit root `package.json` so the `scripts` block reads exactly:
  ```json
  {
    "name": "shckb",
    "private": true,
    "version": "0.0.0",
    "workspaces": [
      "packages/*",
      "apps/*"
    ],
    "scripts": {
      "dev:server": "bun run --filter @skb/shckb-server dev",
      "dev:web": "bun run --filter @skb/shckb-web dev",
      "test": "bun run --filter '*' test",
      "test:e2e": "playwright test",
      "seed:bridge": "bun apps/server/scripts/seed-bridge.ts --base http://localhost:3210 --email admin@local.dev --password dev-admin-password"
    }
  }
  ```
  (Leave the auto-inserted `devDependencies` from Step 1 untouched.)

- [ ] **Step 3: Write `playwright.config.ts` that boots the real server + web.**
  The dev conventions are fixed by the seed scripts and guide-run code block: server on `PORT=3210` from repo root (`SHCKB_DB_PATH` resolves relative to CWD), web vite on `5173` proxying `/api` to `3210`, admin `admin@local.dev` / `dev-admin-password`. The E2E DB is a throwaway file under the OS temp dir so it never touches the dev库.
  Create `playwright.config.ts`:
  ```ts
  import { defineConfig, devices } from '@playwright/test';
  import { tmpdir } from 'node:os';
  import { join } from 'node:path';

  /**
   * E2E harness for the block-autofit-height feature. Boots the REAL
   * server (PORT 3210, throwaway temp DB so the dev库 is never touched)
   * and the REAL web dev server (vite 5173, /api proxied to 3210), then
   * drives chromium against the editor + published pages exactly as a
   * human author would. Credentials/ports match apps/server/scripts/*.
   */
  const E2E_DB = join(tmpdir(), 'shckb-e2e', 'e2e.db');
  const ADMIN_EMAIL = 'admin@local.dev';
  const ADMIN_PASSWORD = 'dev-admin-password';

  export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    use: {
      baseURL: 'http://localhost:5173',
      trace: 'on-first-retry',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
      {
        command:
          `SHCKB_AUTH_SECRET=e2e-secret-at-least-32-characters-long ` +
          `SHCKB_ADMIN_EMAIL=${ADMIN_EMAIL} ` +
          `SHCKB_ADMIN_PASSWORD=${ADMIN_PASSWORD} ` +
          `SHCKB_BASE_URL=http://localhost:5173 ` +
          `SHCKB_DB_PATH=${E2E_DB} ` +
          `PORT=3210 bun apps/server/src/index.ts`,
        url: 'http://localhost:3210/api/health',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
      {
        command: `SHCKB_API_TARGET=http://localhost:3210 bun x vite --port 5173`,
        cwd: './apps/web',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
    ],
  });
  ```

- [ ] **Step 4: Write the shared login + page-builder fixture.**
  The login route is `/api/auth/sign-in/email` returning a `set-cookie`; the editor page is `/edit/:id`; the active markdown edit surface is `textarea[aria-label="Markdown source"]`; blocks carry `data-block-id` / `data-block-kind` / `data-pu-active`. The page builder mirrors `seed-examples.ts createPage` (POST notepage → PUT working-state → theme → publish → visibility), extended to carry the pinned `autofit` / `minRowSpan` per-block metadata.
  Create `e2e/fixtures/login.ts`:
  ```ts
  import type { APIRequestContext, Page } from '@playwright/test';

  export const ADMIN_EMAIL = 'admin@local.dev';
  export const ADMIN_PASSWORD = 'dev-admin-password';

  /** Stable DOM hooks (grounded in GridCanvas.tsx / MarkdownEditView.tsx / frames.tsx). */
  export const sel = {
    block: (id: string) => `[data-block-id="${id}"]`,
    activeMarkdownTextarea: 'textarea[aria-label="Markdown source"]',
    skbBlock: (id: string) => `[data-block-id="${id}"] .skb-block`,
  };

  /** Log in through the real auth endpoint, then hand the session
   * cookie to the browser context so /edit/:id loads authenticated.
   * page.request shares the context cookie jar with page navigations. */
  export async function loginViaApi(page: Page) {
    const res = await page.request.post('http://localhost:3210/api/auth/sign-in/email', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (!res.ok()) throw new Error(`sign-in failed: ${res.status()} ${await res.text()}`);
  }

  export type E2EBlock = {
    id: string;
    kind: string;
    col: number;
    row: number;
    colSpan: number;
    rowSpan: number;
    shell?: string | null;
    autofit?: 'off' | 'grow' | 'grow+shrink' | null;
    minRowSpan?: number | null;
    content: unknown;
  };

  /** Build a page the honest way (mirrors seed-examples createPage):
   * create → PUT working-state → theme → publish → public. Returns the
   * page id (for /edit/:id) and slug (for /notes/:slug). gravityEnabled
   * defaults ON (the autofit commit-compaction rule). */
  export async function createMarkdownPage(
    request: APIRequestContext,
    opts: { title: string; themeId: string; blocks: E2EBlock[]; gravityEnabled?: boolean },
  ): Promise<{ id: string; slug: string }> {
    const base = 'http://localhost:3210';
    const j = async (method: 'POST' | 'PUT', path: string, body?: unknown) => {
      const r = await request.fetch(`${base}${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        data: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!r.ok()) throw new Error(`${method} ${path} -> ${r.status()}: ${await r.text()}`);
      return r.json();
    };
    const { id } = (await j('POST', '/api/notepages', { title: opts.title })) as { id: string };
    await j('PUT', `/api/notepages/${id}/working-state`, {
      title: opts.title,
      gravityEnabled: opts.gravityEnabled ?? true,
      blocks: opts.blocks,
    });
    await j('POST', `/api/notepages/${id}/theme`, { themeId: opts.themeId });
    const pub = (await j('POST', `/api/notepages/${id}/publish`)) as { slug: string };
    await j('POST', `/api/notepages/${id}/visibility`, { visibility: 'public' });
    return { id, slug: pub.slug };
  }

  export const md = (markdown: string) => ({ markdown });
  ```

- [ ] **Step 5: Add a trivial smoke spec to prove the harness boots.**
  Create `e2e/smoke.spec.ts`:
  ```ts
  import { expect, test } from '@playwright/test';
  import { loginViaApi } from './fixtures/login';

  test('login route renders and auth endpoint accepts dev creds', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'sign in' })).toBeVisible();
    await loginViaApi(page); // throws if the dev admin bootstrap failed
  });
  ```

- [ ] **Step 6: Run the smoke spec.**
  Run exactly:
  ```bash
  bun run test:e2e -- e2e/smoke.spec.ts
  ```
  Expected output (tail): `1 passed` (Playwright boots both webServers, hits `/api/health`, the smoke spec is green). If the server fails to boot complaining about the admin, the temp DB already had a user — delete it: `rm -rf "$(node -e "console.log(require('os').tmpdir())")/shckb-e2e"` and rerun.

- [ ] **Step 7: Commit.**
  ```bash
  git add package.json bun.lock playwright.config.ts e2e/fixtures/login.ts e2e/smoke.spec.ts
  git commit -m "$(cat <<'EOF'
  test(e2e): Playwright harness — boot real server+web, login fixture, smoke

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 27: E2E — grow/shrink reversible path (G pushes W down, then returns)

The headline autofit flow and the C5 reversibility witness: type into a narrow autofit markdown block G → it grows and the AABB-below block W is pushed DOWN; delete the text → G shrinks back to floor and W returns to its base row. This is the browser-level proof of `reconcile(base, targetRowSpan) = pushResize(base, growerId, target)` with gravity suspended within the gesture and re-compacted once on commit.

**Files:**
- Create: `e2e/autofit-grow-shrink.spec.ts`
- Test: `e2e/autofit-grow-shrink.spec.ts` (self-running)

- [ ] **Step 1: Write the grow/shrink spec.**
  The block geometry box is the `[data-block-id]` outer div (GridCanvas BlockShell: `top = row*slot + pad`, `height = rowSpan*slot - 2*pad`). With `theme.slot = 60`, one extra grown row moves W's `top` down by exactly 60px. We assert on bounding boxes (robust to internal layout) and read W's box to confirm it moved and returned.
  Create `e2e/autofit-grow-shrink.spec.ts`:
  ```ts
  import { expect, test } from '@playwright/test';
  import { createMarkdownPage, loginViaApi, md, sel } from './fixtures/login';

  const SLOT = 60; // theme.slot for graph-paper/galley/stationery (verified in packages/theme/src)

  test('typing grows G and pushes W down; deleting shrinks G and returns W', async ({ page }) => {
    await loginViaApi(page);
    // G: narrow autofit markdown (cols0-1), floor=1; W: wide block below.
    const { id } = await createMarkdownPage(page.request, {
      title: 'autofit grow/shrink',
      themeId: 'graph-paper',
      gravityEnabled: true,
      blocks: [
        { id: 'G', kind: 'markdown', col: 0, row: 0, colSpan: 2, rowSpan: 1, autofit: 'grow', minRowSpan: 1, content: md('') },
        { id: 'W', kind: 'markdown', col: 0, row: 1, colSpan: 6, rowSpan: 1, autofit: 'off', minRowSpan: null, content: md('below') },
      ],
    });

    await page.goto(`/edit/${id}`);
    const G = page.locator(sel.block('G'));
    const W = page.locator(sel.block('W'));
    await expect(G).toBeVisible();
    await expect(W).toBeVisible();

    const wTopBase = (await W.boundingBox())!.y;

    // Activate G and type enough wrapped lines to force fit > floor.
    await G.click();
    const ta = page.locator(sel.activeMarkdownTextarea);
    await expect(ta).toBeVisible();
    await ta.fill(
      'line one is long enough to wrap inside a two-column block\n\n' +
        'line two paragraph\n\nline three paragraph\n\nline four paragraph',
    );

    // Debounced reconcile (150-300ms) re-pushes W down. Wait for the
    // grow: W's top must increase by at least one full slot.
    await expect
      .poll(async () => (await W.boundingBox())!.y, { timeout: 5_000 })
      .toBeGreaterThan(wTopBase + SLOT - 1);
    const wTopGrown = (await W.boundingBox())!.y;
    const gHeightGrown = (await G.boundingBox())!.height;
    expect(gHeightGrown).toBeGreaterThan(SLOT); // G itself grew past one row

    // Delete the content: G shrinks to floor, W returns to its base row
    // (C5 reconcile re-derives from the gesture base — reversible).
    await ta.fill('');
    await expect
      .poll(async () => (await W.boundingBox())!.y, { timeout: 5_000 })
      .toBeLessThan(wTopGrown - SLOT + 1);
    const wTopReturned = (await W.boundingBox())!.y;
    expect(Math.abs(wTopReturned - wTopBase)).toBeLessThan(2); // returned to base

    // Deactivate to fire the gesture commit (Escape → preview).
    await page.keyboard.press('Escape');
    await expect(G).not.toHaveAttribute('data-pu-active', /.*/);
  });
  ```

- [ ] **Step 2: Run the spec.**
  ```bash
  bun run test:e2e -- e2e/autofit-grow-shrink.spec.ts
  ```
  Expected output (tail): `1 passed`. If it fails on the grow poll, the debounce window or the `pushResize` re-push wiring in the editor controller is not yet landed — this spec depends on the web-reconcile subsystem; it goes green only after that lands.

- [ ] **Step 3: Commit.**
  ```bash
  git add e2e/autofit-grow-shrink.spec.ts
  git commit -m "$(cat <<'EOF'
  test(e2e): autofit grow pushes neighbor down, shrink returns it (C5 reversible)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 28: E2E — ghost preview + fit matches live row count on non-default shells + published clip

Three correctness witnesses (each its own spec file, shared fixture): (a) the visible right-aligned floating ghost preview shows rendered markdown while the block stays active; (b) on `galley` / `stationery` shells the committed `rowSpan` equals the live rendered row count (measure-through-real-Frame, not bare RenderView); (c) the published static page clips autofit blocks (`overflow:hidden`) instead of scrolling, while non-autofit blocks keep `overflow:auto`.

**Files:**
- Create: `e2e/autofit-ghost-preview.spec.ts`
- Create: `e2e/autofit-fit-shells.spec.ts`
- Create: `e2e/autofit-publish-clip.spec.ts`
- Test: all three (self-running)

- [ ] **Step 1: Write the ghost-preview spec.**
  Per spec §7, the active markdown edit surface is a bare textarea PLUS a visible right-aligned floating ghost preview rendering `MarkdownRenderView`. The rendered markdown contains a real `<h2>` from `## ...`. We assert the heading is visible WITHOUT deactivating the block (textarea stays focused). NOTE: the ghost-preview DOM hook is now pinned by the markdown-publish phase — the floating wrapper carries `data-skb-ghost-preview` and is NOT `aria-hidden` — so this spec targets `[data-skb-ghost-preview]` and asserts the heading is visible *within* that scoped node (precise, not the loose page-wide `getByRole`).
  Create `e2e/autofit-ghost-preview.spec.ts`:
  ```ts
  import { expect, test } from '@playwright/test';
  import { createMarkdownPage, loginViaApi, md, sel } from './fixtures/login';

  test('ghost preview shows rendered markdown while the block stays active', async ({ page }) => {
    await loginViaApi(page);
    const { id } = await createMarkdownPage(page.request, {
      title: 'autofit ghost preview',
      themeId: 'graph-paper',
      blocks: [
        { id: 'G', kind: 'markdown', col: 0, row: 0, colSpan: 5, rowSpan: 2, autofit: 'grow', minRowSpan: 2, content: md('') },
      ],
    });
    await page.goto(`/edit/${id}`);

    const G = page.locator(sel.block('G'));
    await G.click();
    await expect(G).toHaveAttribute('data-pu-active', /.*/);

    const ta = page.locator(sel.activeMarkdownTextarea);
    await ta.fill('## Ghost Heading\n\nrendered body text');

    // The visible floating ghost preview renders the heading; the block
    // is still active (textarea focused) — author sees rendered output
    // without deactivating (spec §7 acceptance criterion). Scope to the
    // pinned [data-skb-ghost-preview] hook (markdown-publish phase) so the
    // assertion is precise, not a loose page-wide heading match.
    const ghost = page.locator('[data-skb-ghost-preview]');
    await expect(ghost).toBeVisible();
    await expect(ghost.getByRole('heading', { name: 'Ghost Heading' })).toBeVisible();
    await expect(ta).toBeFocused();
  });
  ```

- [ ] **Step 2: Write the fit-on-shells spec.**
  Spec §11: on galley/stationery (non-default shells, slot=60, asymmetric padding) the committed `rowSpan` must equal the live rendered row count. fit is not persisted (spec §2: only the reconciled rowSpan is), so we assert the browser-observable consequence: after commit, the rendered `.skb-block` fits its committed geometry — `scrollHeight <= clientHeight + 1px` (no overflow under the no-scroll contract). Parametrized over both themes.
  Create `e2e/autofit-fit-shells.spec.ts`:
  ```ts
  import { expect, test } from '@playwright/test';
  import { createMarkdownPage, loginViaApi, md, sel } from './fixtures/login';

  for (const themeId of ['galley', 'stationery'] as const) {
    test(`fit matches live row count on ${themeId} shell (content fits, no clip)`, async ({ page }) => {
      await loginViaApi(page);
      const { id } = await createMarkdownPage(page.request, {
        title: `autofit fit · ${themeId}`,
        themeId,
        blocks: [
          { id: 'G', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 1, autofit: 'grow', minRowSpan: 1, content: md('') },
        ],
      });
      await page.goto(`/edit/${id}`);

      const G = page.locator(sel.block('G'));
      await G.click();
      const ta = page.locator(sel.activeMarkdownTextarea);
      await ta.fill(
        '# Heading\n\n' +
          'A paragraph long enough to wrap across the six-column width of this block, ' +
          'so that the measured fit must account for real wrapping at the real frame width.\n\n' +
          '- item one\n- item two\n- item three\n\n' +
          '> a blockquote line that also contributes a rendered row',
      );

      // Let the debounced reconcile settle, then commit (Escape).
      await page.waitForTimeout(600);
      await page.keyboard.press('Escape');
      await expect(G).not.toHaveAttribute('data-pu-active', /.*/);

      // Inactive block shows the measured RenderView inside the real
      // Frame. fit == live row count => the rendered content fits the
      // committed geometry: scrollHeight <= clientHeight (no overflow).
      const frame = page.locator(sel.skbBlock('G'));
      await expect(frame).toBeVisible();
      const fits = await frame.evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
      expect(fits).toBe(true);
    });
  }
  ```

- [ ] **Step 3: Write the publish-clip spec.**
  Spec §5.2: published autofit blocks render `overflow:hidden`; non-autofit keep `overflow:auto`. Today every frame is `overflow:auto` (verified frames.tsx:23). The autofit flag is threaded through `PublishedDocShape.blocks` + `BlockFrameProps`. We publish a page with one autofit block (A) and one non-autofit block (B), open `/notes/:slug` (the clean public route), and assert the computed `overflowY` of each block's `.skb-block`.
  Create `e2e/autofit-publish-clip.spec.ts`:
  ```ts
  import { expect, test } from '@playwright/test';
  import { createMarkdownPage, loginViaApi, md, sel } from './fixtures/login';

  test('published autofit block clips (overflow:hidden); non-autofit scrolls (auto)', async ({ page }) => {
    await loginViaApi(page);
    const { slug } = await createMarkdownPage(page.request, {
      title: 'autofit publish clip',
      themeId: 'graph-paper',
      blocks: [
        { id: 'A', kind: 'markdown', col: 0, row: 0, colSpan: 6, rowSpan: 2, autofit: 'grow', minRowSpan: 2, content: md('## clipped\n\nbody') },
        { id: 'B', kind: 'markdown', col: 6, row: 0, colSpan: 6, rowSpan: 2, autofit: 'off', minRowSpan: null, content: md('## scrolls\n\nbody') },
      ],
    });

    // The clean public share route (standalone, no shell).
    await page.goto(`/notes/${slug}`);

    const autofitFrame = page.locator(sel.skbBlock('A'));
    const plainFrame = page.locator(sel.skbBlock('B'));
    await expect(autofitFrame).toBeVisible();
    await expect(plainFrame).toBeVisible();

    const overflowOf = (el: Element) => getComputedStyle(el).overflowY;
    expect(await autofitFrame.evaluate(overflowOf)).toBe('hidden');
    expect(await plainFrame.evaluate(overflowOf)).toBe('auto');
  });
  ```

- [ ] **Step 4: Run all three specs.**
  ```bash
  bun run test:e2e -- e2e/autofit-ghost-preview.spec.ts e2e/autofit-fit-shells.spec.ts e2e/autofit-publish-clip.spec.ts
  ```
  Expected output (tail): `4 passed` (ghost 1 + fit 2 + publish-clip 1). The publish-clip spec is red until the autofit flag is threaded through `PublishedDocShape.blocks` + `BlockFrameProps` and the frames apply `overflow:hidden`; the ghost spec is red until MarkdownEditView is rewritten to the single-textarea + visible ghost form.

- [ ] **Step 5: Commit.**
  ```bash
  git add e2e/autofit-ghost-preview.spec.ts e2e/autofit-fit-shells.spec.ts e2e/autofit-publish-clip.spec.ts
  git commit -m "$(cat <<'EOF'
  test(e2e): ghost preview, fit==live rows on galley/stationery, publish clip

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 29: PRD pass — record content-driven block height as product-observable behavior

Spec §9 (PRD-master discipline): `blocks.md` / `block-markdown.md` / `notepage-editing.md` must 承接 the new user-observable behavior ("a block's height can grow with its content within an author-set floor; markdown defaults to this; the vertical resize handle sets the floor"). Doc-only — no test loop. Vocabulary per [[feedback-doc-conventions]]: this is a **block-level content-kind capability** (generalizable), markdown-first by UI gating; floor = author's minimum-height intent; reversibility is scoped to an active editing session. Do NOT cite deprecated ADR-0001..0018; cite the spec + ADR-0028.

**Files:**
- Modify: `docs/product/prd/features/blocks/blocks.md`
- Modify: `docs/product/prd/features/blocks/block-markdown.md`
- Modify: `docs/product/prd/features/notepage/notepage-editing.md`

- [ ] **Step 1: Add the auto-fit capability to the shared blocks PRD**

In `docs/product/prd/features/blocks/blocks.md`, add a subsection under the content-kind capability layer (keep the existing house voice; do not restructure the file):

```markdown
### Auto-fit height (limited-height + grow)

A block MAY declare an **auto-fit** height policy. When on, the block shows **no scrollbar**
and its height tracks its rendered content, in whole grid rows, never falling below an
author-set **floor** (the block's minimum height; defaults to its insert/hole-fill size).
The author controls width (colSpan) and floor; content drives height within that floor.

- Auto-fit is a **block-level capability** (generalizable to any kind); markdown enables it by
  default in this round, other kinds opt in later (dev/UI gating, not a product restriction).
- Turning auto-fit **off** restores manual height resize + scrolling.
- Height changes reflow the page **locally and reversibly within one active editing session**
  (typing then deleting returns the layout to where it was). Once an author pauses and a
  genuinely-taller block is committed, normal page compaction applies. See [ADR-0028].
- The engine never measures content; rendered height is measured in the browser at edit time
  and persisted; published/static pages trust the stored height and clip (no scrollbar).
```

- [ ] **Step 2: Note the markdown default + editing surface in the markdown PRD**

In `docs/product/prd/features/blocks/block-markdown.md`, add (and reconcile the existing source-plus-preview note at the line that prefers source+preview "so authors can see rendered markdown without leaving editing flow"):

```markdown
### Auto-fit + editing surface (this round)

Markdown blocks default to **auto-fit on** (see blocks.md). The active-editing surface is a
**single source textarea** filling the block, accompanied by a **floating rendered preview**
(right-aligned) so the author still sees rendered output without leaving the editing flow —
this satisfies the source-plus-preview feedback-loop requirement above via a floating preview
rather than a split pane. New markdown blocks start auto-fit on; pre-existing blocks remain off
until the author opts them in.
```

- [ ] **Step 3: Record the author-facing resize/floor semantics in notepage-editing**

In `docs/product/prd/features/notepage/notepage-editing.md`, add to the editing/resize section:

```markdown
- **Vertical resize handle on an auto-fit block sets the floor** (minimum height), not a fixed
  height: content taller than the floor keeps the block at content height; dragging shorter
  than current content "bottoms out" at the content line. Width resize behaves as before.
- Auto-fit reflow is **reversible within an active editing session** and never disturbs blocks
  in columns the edited block does not occupy, within that session (see blocks.md / [ADR-0028]).
```

- [ ] **Step 4: Commit**

```bash
git add docs/product/prd/features/blocks/blocks.md docs/product/prd/features/blocks/block-markdown.md docs/product/prd/features/notepage/notepage-editing.md
git commit -m "docs(prd): autofit block height (limited-height + grow) — blocks/markdown/notepage-editing pass"
```

---

### Task 30 (THE FINAL TASK): seed the G/W/K bridge-problem page into the owner dev库

Owner-required last step (spec §8.5): plant the named G/W/K bridge fixture as a live notepage in the owner dev库 via the real HTTP API — same login/createPage pose as `seed-examples.ts` / `seed-devdocs.ts` — so the owner can manually exercise the hardest reversible path in a real browser: type in G (watch W push down, K stay put) → delete (watch it return) → commit a net-grow (watch the "commit = compact" boundary). Topology: narrow autofit markdown G at cols0-1, a WIDE straddling block W at cols0-5 below G, a side-column block K at cols4-5 below W. Gravity ON, so the commit-compaction boundary is exercised (the PROBE-2 / R6 leak scenario the owner most wants to feel).

**Files:**
- Create: `apps/server/scripts/seed-bridge.ts`
- Test: run the script against a live dev server (manual verification — it writes to the owner dev库, no automated assertion)

- [ ] **Step 1: Write the bridge seed script (mirrors seed-examples arg/login/HTTP pose).**
  Reuses the exact `arg()` / `req()` / `login()` shape from `seed-examples.ts` (cookie split on `;`, `/api/auth/sign-in/email`) and the `createPage` shape (POST notepage → move into folder → PUT working-state → theme → publish → public), extended to carry the pinned per-block `autofit` / `minRowSpan` metadata. Idempotence guard mirrors seed-examples (aborts if the demo folder exists). gravityEnabled = true so the commit-compaction boundary is live.
  Create `apps/server/scripts/seed-bridge.ts`:
  ```ts
  /**
   * Seed the G/W/K "桥块演示 / bridge problem" notepage into the owner
   * dev库 through the real HTTP API — same honest pose as
   * seed-examples.ts (auth, working-state validation, theme, publish).
   * This is the FINAL plan step (block-autofit-height §8.5): a live
   * fixture for the owner to manually exercise the hardest reversible
   * path in a real browser.
   *
   * Topology (the §4.2-pre / §11 named regression case):
   *   G  autofit markdown  cols 0-1, row 0           (narrow grower)
   *   W  wide straddling    cols 0-5, row 1           (bridge block)
   *   K  side column        cols 4-5, row 2           (the block that
   *                                                    must NOT leak)
   * Manual exercise: type in G → W pushes down, K stays (gesture
   * reversible) → delete → both return → commit a net-grow → observe
   * the gravity-on "commit = compact" boundary (PROBE-2 / R6).
   *
   * Usage:
   *   bun apps/server/scripts/seed-bridge.ts --base http://localhost:3210 \
   *     --email admin@local.dev --password dev-admin-password
   *
   * Idempotence: aborts if a top-level folder named 桥块演示 exists.
   */

  // ---------- args ----------

  function arg(name: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const v = i >= 0 ? process.argv[i + 1] : undefined;
    if (!v) {
      console.error(`missing --${name}`);
      process.exit(1);
    }
    return v;
  }

  const BASE = arg('base').replace(/\/$/, '');
  const EMAIL = arg('email');
  const PASSWORD = arg('password');
  const FOLDER_NAME = '桥块演示';

  // ---------- API client ----------

  let cookie = '';

  async function req(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = { cookie };
    let payload: string | undefined;
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
    if (!res.ok) {
      throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  async function login() {
    const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    if (!res.ok) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`);
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) throw new Error('sign-in returned no cookie');
    cookie = setCookie.split(';')[0]!;
  }

  // ---------- block shapes ----------

  type SeedBlock = {
    id: string;
    kind: string;
    col: number;
    row: number;
    colSpan: number;
    rowSpan: number;
    shell?: string | null;
    autofit?: 'off' | 'grow' | 'grow+shrink' | null;
    minRowSpan?: number | null;
    content: unknown;
  };

  const md = (markdown: string) => ({ markdown });

  async function createPage(opts: { title: string; folderId: string; themeId: string; blocks: SeedBlock[] }): Promise<string> {
    const { id } = (await req('POST', '/api/notepages', { title: opts.title })) as { id: string };
    await req('POST', `/api/notepages/${id}/move`, { folderId: opts.folderId });
    await req('PUT', `/api/notepages/${id}/working-state`, {
      title: opts.title,
      gravityEnabled: true, // gravity ON: the commit-compaction boundary (PROBE-2/R6) is live
      blocks: opts.blocks,
    });
    await req('POST', `/api/notepages/${id}/theme`, { themeId: opts.themeId });
    const pub = (await req('POST', `/api/notepages/${id}/publish`)) as { slug: string };
    await req('POST', `/api/notepages/${id}/visibility`, { visibility: 'public' });
    console.log(`  ✓ ${opts.title} -> /notes/${pub.slug}`);
    return pub.slug;
  }

  // ---------- the G/W/K page ----------

  async function seedBridge(folderId: string) {
    const blocks: SeedBlock[] = [
      // G — narrow autofit markdown grower (cols 0-1, floor = 1 row).
      {
        id: 'G',
        kind: 'markdown',
        col: 0, row: 0, colSpan: 2, rowSpan: 1,
        autofit: 'grow',
        minRowSpan: 1,
        content: md(
          '**G**\n\n' +
            '在这里打字 → 我会变高、把下面的 **W** 整体下推；' +
            '删回来 → W 归位、**K** 全程不动。',
        ),
      },
      // W — the wide bridge straddling G's column AND the side column
      // (cols 0-5, row 1). Its downward push, under global gravity,
      // would historically drag K to row 0 on shrink (§4.2-pre).
      {
        id: 'W',
        kind: 'markdown',
        col: 0, row: 1, colSpan: 6, rowSpan: 1,
        autofit: 'off',
        minRowSpan: null,
        content: md('**W** — 横跨 G 列与旁列的桥块（被 G 撑高时整体下推）'),
      },
      // K — side-column block below W (cols 4-5, row 2). The block the
      // owner watches to confirm no leak within the gesture.
      {
        id: 'K',
        kind: 'markdown',
        col: 4, row: 2, colSpan: 2, rowSpan: 1,
        autofit: 'off',
        minRowSpan: null,
        content: md('**K** — 旁列块（手势内绝不应被挪动）'),
      },
      // The exercise recipe on the page itself (cols 6-11, row 1).
      {
        id: 'howto',
        kind: 'markdown',
        col: 6, row: 1, colSpan: 6, rowSpan: 3,
        autofit: 'off',
        minRowSpan: null,
        content: md(
          '## 手测脚本（最难的可逆路径）\n\n' +
            '1. 点开 **G**，连打几行 → 看 **W** 下推、**K** 不动。\n' +
            '2. 全删 → 看 W 归位、K 仍不动（手势内可逆，C5）。\n' +
            '3. 再打字撑高并**失焦提交** → 净增高：gravity-on 下会跑一遍压实' +
            '（"提交即压实"边界，PROBE-2）。\n\n' +
            '> 这页就是 §11 的 G/W/K 命名 fixture 的活体对照。',
        ),
      },
    ];
    await createPage({ title: '桥块演示 G/W/K', folderId, themeId: 'graph-paper', blocks });
  }

  // ---------- main ----------

  async function main() {
    console.log(`seeding bridge demo -> ${BASE}`);
    await login();

    const tree = (await req('GET', '/api/tree')) as { folders: Array<{ id: string; name: string; parentId: string | null }> };
    if (tree.folders.some((f) => f.name === FOLDER_NAME && f.parentId === null)) {
      console.error(`top-level folder ${FOLDER_NAME} already exists — aborting (idempotence guard)`);
      process.exit(2);
    }

    const { id: folderId } = (await req('POST', '/api/folders', { name: FOLDER_NAME })) as { id: string };
    console.log(`folder ${FOLDER_NAME} = ${folderId}`);

    await seedBridge(folderId);
    console.log('done.');
  }

  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
  ```

- [ ] **Step 2: Run it against a live dev server (owner dev库).**
  With the dev server running on 3210 (the guide-run pose), run exactly:
  ```bash
  bun run seed:bridge
  ```
  (or directly: `bun apps/server/scripts/seed-bridge.ts --base http://localhost:3210 --email admin@local.dev --password dev-admin-password`)
  Expected output:
  ```
  seeding bridge demo -> http://localhost:3210
  folder 桥块演示 = <some-id>
    ✓ 桥块演示 G/W/K -> /notes/<slug>
  done.
  ```
  Then open `http://localhost:5173/edit/<page-id>` in the browser and manually exercise: type in G (W pushes down, K stays), delete (both return), commit a net-grow (observe gravity-on compaction). Re-running aborts with `top-level folder 桥块演示 already exists` (idempotence guard).

- [ ] **Step 3: Commit.**
  ```bash
  git add apps/server/scripts/seed-bridge.ts
  git commit -m "$(cat <<'EOF'
  feat(server): seed-bridge — G/W/K autofit bridge demo for owner dev库 (final step)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```
