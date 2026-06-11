# `@skb/grid-engine` — Contract

Headless 2D AABB layout engine. Pure functions over `GridState`. Source-of-truth document for **types, operations, invariants, and consumer guidance**.

- **Source code**: `packages/grid-engine/src/`（2026-06-11 自 carryover 提升，target contract 同步落地；MVP 决策详 [ADR-0019](../../docs/engineering/decisions/ADR-0019-mvp-implementation-baseline.md)）
- **Product 层依据**: [notepage-editing.md](../../docs/product/prd/features/notepage/notepage-editing.md)（algorithm contract 的 product-facing obligations）
- **Indexed at**: [`docs/engineering/contracts/README.md`](../../docs/engineering/contracts/README.md)

> 文档约定：本 CONTRACT.md 记录的是 engine 对外的**包契约**——types / ops / invariants 与 consumer 应当遵守的使用规则。
> 历史注记：本文件早期版本引用 [ADR-0003] 等作为架构依据；ADR-0001..0018 已于 2026-05-23 全局 deprecated（仅作 historical trace）。"kind-opaque / pure / dependency-leaf" 等承诺现以本 CONTRACT + 相关 PRD 为准，待新 PRD-informed 架构 ADR 承接。
> 演化规则：breaking change（types / op signature / invariant 承诺）走 PR review + 更新本文件；架构承诺级变更走新 ADR。

---

## Types

### `Block`

```ts
type Block = {
  id: string;        // stable, unique within a GridState; cuid2 / nanoid; 永不重用 (per ADR-0002 invariants)
  kind: BlockKind;   // 详 BlockKind 节；engine 不解释语义 (ADR-0003 induction 3)
  col: number;       // 0-indexed; 0 ≤ col < totalCols
  row: number;       // 0-indexed; row ≥ 0；无上界
  colSpan: number;   // integer ≥ 1; col + colSpan ≤ totalCols
  rowSpan: number;   // integer ≥ 1；无上界
};
```

Maps 1:1 to ADR-0002 `blocks` table（`col_span` / `row_span` snake_case 由 ORM 处理）。

### `BlockKind`（2026-06-11 起为现行 contract）

```ts
type BlockKind = string;   // open identifier；engine 视为 passthrough tag
```

Engine 不要求 exhaustive built-in kinds；不做 `kind → X` lookup。Kind 语义（default size / render / content）属 block-kind module 层（[blocks.md] shared block contract）。

### `BlockSize`

```ts
type BlockSize = { colSpan: number; rowSpan: number };
```

Caller（block-kind module / editor host）向 `inferDropIntent` 传入的 proposed size。

### `GridState`

```ts
type GridState = {
  blocks: Block[];      // source of truth
  totalCols: number;    // production: 12 (per ADR-0003 mental model); test-parameterizable
};
```

### `Region`

```ts
type Region = { col: number; row: number; colSpan: number; rowSpan: number };
```

AABB rectangle without identity（用于 intent / query 返回值）。

### `Occupancy`

```ts
type Occupancy = (string | null)[][];   // occupancy[col][row] = block.id | null
```

**Derived**, not SoT。来自 `buildOccupancy(state)`；每次 mutation 后重 derive，不就地 mutate。

### `OpResult`

```ts
type OpResult =
  | { ok: true; state: GridState }
  | { ok: false; error: string };
```

Day-1 shape: `error: string`（human-readable，含 op 上下文如 `'out of bounds: id=foo, col=15'`）。

**潜在演化**（待 first consumer 强需求 trigger）：加 `code: 'overlap'|'out_of_bounds'|'not_found'|'invalid_span'` discriminator 以便 caller 程序化分流。ADR-0014 `AgentOpResult` 已有 `code?` field；如演化二者风格对齐。

### `DropIntent`

```ts
type DropIntent = {
  intent: 'place' | 'reject';
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;     // 已 hole-fill clamp: min(default, holeMax)
  reason?: string;     // populated when intent === 'reject'
};
```

Day-1 carryover shape：单一 `place / reject` 二分。Frozen DI §3.1 提到的多 intent 类型（`insert-right` / `insert-left` / `swap` / `replace` / `insert-between`）属于 **render-layer affordance**，不在 engine layer；如未来需要，由 editor / UI layer 自己根据 cursor pose + `DropIntent.intent === 'place'` 加工。

### `ValidationResult` / `ValidateOptions`

```ts
type ValidationResult = { ok: boolean; errors: string[] };
type ValidateOptions = { gravity?: boolean };   // default true
```

`validateState(state, opts?)` 返回。检查 bounds / overlap / unique id / span，且当 `opts.gravity !== false` 时检查 gravity stability。用途：CI / property-based test guard / **server 落库前对 client working state 的复验**。

### `OpOptions`

```ts
type OpOptions = { gravity?: boolean };  // default true (Option A)
```

`gravity: false` 是 author-facing 产品功能（notepage 级 gravity toggle，owner ratified 2026-06-11），不只是 test 后门。Gravity-off 的 page 合法持久化非 gravity-stable 布局。

---

## Operation set

按 ADR-0003 induction 5 三类能力面分组：

### State mutation

| op | signature | gravity 默认 | failure 模式 |
|---|---|---|---|
| `insertBlock` | `(state, block, opts?) → OpResult` | true | out of bounds / duplicate id / overlap |
| `moveBlock` | `(state, id, newCol, newRow, opts?) → OpResult` | true | id not found / out of bounds / overlap |
| `resizeBlock` | `(state, id, newColSpan, newRowSpan, opts?) → OpResult` | true | id not found / invalid span / out of bounds / overlap |
| `transformBlock` | `(state, id, changes, opts?) → OpResult` | true | atomic move + resize；任一 invariant break → reject |
| `deleteBlock` | `(state, id, opts?) → GridState` | true | 无 failure mode（不存在的 id 静默 no-op） |

**承诺**：mutation 不就地修改 input state；返回新 state；失败时不部分 apply。

### Invariant query / intent inference

| op | signature | 描述 |
|---|---|---|
| `inferDropIntent` | `(state, cursorCol, cursorRow, proposedSize) → DropIntent` | cursor pose + caller-provided proposed size → intent；含 hole-fill clamp；engine **不**做 `kind → defaultSize` lookup（per ADR-0003 induction 3） |
| `maxEmptyRectContaining` | `(state, col, row, capW, capH) → Region \| null` | hole-fill 查最大空 rect（with cap） |
| `maxEmptyRectAt` | `(state, col, row) → Region \| null` | 无 cap 版 |
| `canRise` | `(state, blockId) → boolean` | gravity check：该 block 是否还能升一行 |
| `findCollidingBlocks` | `(state, region) → Block[]` | 给定 region 返回所有 AABB overlap 的 blocks |
| `isRegionEmpty` | `(state, region) → boolean` | 给定 region 是否空 |
| `isRegionInBounds` | `(state, region) → boolean` | 给定 region 是否在 grid 边界内 |
| `regionsOverlap` | `(a, b) → boolean` | 两 region AABB overlap 判断 |

### Validation

| op | signature | 描述 |
|---|---|---|
| `validateState` | `(state, opts?) → ValidationResult` | 显式检 invariant（含 gravity stability，可 `{gravity:false}` opt-out）；property test / CI / server 复验 |

### Gravity

| op | signature | 描述 |
|---|---|---|
| `applyGravity` | `(state) → { state, iterations, movedTotal }` | per-block AABB upward 每次升 1 行迭代到收敛 |

### Construction / derivation helpers

| op | signature | 描述 |
|---|---|---|
| `createEmptyState` | `(totalCols?: number) → GridState` | factory；default `totalCols = TOTAL_COLS = 12` |
| `buildOccupancy` | `(state) → Occupancy` | derive matrix from blocks |
| `totalRows` | `(state) → number` | max(block.row + block.rowSpan) over blocks |

### Exported constants（2026-06-11 起为现行 contract）

```ts
const TOTAL_COLS = 12;
```

仅 `TOTAL_COLS`。`DEFAULT_SIZES` 已随 lift 移出 engine——engine kind-opaque，default sizes 归 block-kind module（web 层 `BlockKindModule.defaultSize`）。

---

## Invariants

每 mutation op 之后保持（property-based test enforced；45/45 scenarios + 50k stress validated on carryover code）：

### Invariant 1: No AABB overlap

∀ blocks `a, b ∈ state.blocks` where `a.id ≠ b.id`:

```
NOT (a.col < b.col + b.colSpan AND
     b.col < a.col + a.colSpan AND
     a.row < b.row + b.rowSpan AND
     b.row < a.row + a.rowSpan)
```

### Invariant 2: In bounds

∀ block:
- `0 ≤ block.col`
- `block.col + block.colSpan ≤ state.totalCols`
- `block.row ≥ 0`

### Invariant 3: Discrete spans

∀ block: `block.colSpan` 和 `block.rowSpan` 是 integers ≥ 1。

### Invariant 4: Gravity-stable (Option A) — 以 notepage 的 gravity setting 为条件

Gravity **enabled**（默认）时：每个 mutating op 之后，state 满足 `∀ block: NOT canRise(state, block.id)`。

Gravity **disabled**（author-facing notepage 级 toggle；owner ratified 2026-06-11）时：caller 对所有 ops 传 `{ gravity: false }`，state 可合法包含 floating blocks；invariant 1-3、5-7 仍全部成立。`validateState` 须传 `{ gravity: false }` 与之对应。

历史注记：早期表述 "state is always gravity-stable" 以 toggle 常开为前提；现行 contract 把 stability 条件化到 page 的 gravity setting。

### Invariant 5: Unique ids

∀ blocks `a, b ∈ state.blocks` where `a ≠ b`: `a.id ≠ b.id`。

### Invariant 6: Pure-function determinism + reentrance

Engine 显式承诺（per ADR-0003 induction 2 推论）——不是 leaf 位置的自动副作用，是必须主动保持的行为承诺：

- Same `(state, op, args)` → same `(new state, result)` —— 确定性
- **不**调 `Math.random()` / `Date.now()` / `crypto.randomUUID()` —— 需要的随机 / 时间 / id 由 caller 在 args 里传入
- **不**读 `globalThis` / `process.env` / `window` / 任何 ambient context
- **不**做 IO —— 无 fetch / fs / network / IndexedDB / 等
- **无模块级 mutable state** —— 无 `let x = ...` 在 top-level；无内部 cache / memoization across calls
- **Reentrant** —— 多 caller 并发 / 交错调用，每个 call site 看到的行为与其他 call site 无关

### Invariant 7: Monorepo dependency leaf (structural)

Engine 在 monorepo package import 关系图上不指向其他 `@skb/*` package，**且不引入任何 runtime library**：

- ✅ 允许 import：TypeScript 标准库 + 类型工具（**type-level only，无 runtime 行为**）
- ❌ 不允许 import：**任何 runtime library（含 zod / immer / lodash / 等）** / 任何 `@skb/*` package / React / DOM / Drizzle / Lexical / Hono / fetch / IndexedDB / framework / runtime API

**Escape hatch**：若 implementation 判断需要 runtime lib，必须在 PR review 中显式说明理由 + 验证不破 invariant 6（purity / determinism / no side effect / reentrance）。默认 reject —— grid-engine 是 layout math，不需要 runtime validation / parsing；caller 在边界验证输入即可。

Invariant 6 是行为承诺，invariant 7 是结构约束。Invariant 7 为 invariant 6 提供必要支撑但不充分——leaf 不阻止源码写 `Math.random()`；purity 必须独立保持。Runtime lib 禁令是 invariant 6+7 的合并 enforcement —— zod 这类 lib 不仅破 leaf 形态，更直接破 purity（throws / coerces / 等）。

---

## Algorithm details

### AABB overlap detection

教科书形态（见 invariant 1）。`findCollidingBlocks(state, region)` 线性扫 blocks。

### Hole-fill placement

Caller 把 proposed size 算好传给 engine。Engine 不查 kind→default。

```
// caller side (editor host / server):
proposed = BLOCK_KINDS[blockKind].defaultSize   // block-kind module registry

// engine side:
inferDropIntent(state, cursorCol, cursorRow, proposed):
  holeMaxW, holeMaxH = maxEmptyRectContaining(state, cursorCol, cursorRow)
  newW = min(proposed.colSpan, holeMaxW)
  newH = min(proposed.rowSpan, holeMaxH)
  newCol, newRow = align to top-left of containing hole
  return { intent: 'place', col: newCol, row: newRow, colSpan: newW, rowSpan: newH }
```

- 洞 ≥ proposed → 用 proposed size
- 洞 < proposed → 缩到 hole size（不 reject）
- 洞 = proposed → exact fit
- 无可放 hole → `{ intent: 'reject', reason: '...' }`

### Gravity (Option A)

```
applyGravity(state):
  loop:
    moved = false
    for block in state.blocks (sorted by row ascending):
      if canRise(state, block.id):
        moveUp1(block)
        moved = true
    if not moved: break
  return { state: newState, iterations: count, movedTotal: count }

canRise(state, blockId):
  block = find(blockId)
  if block.row === 0: return false
  for c in block.col .. block.col + block.colSpan - 1:
    if occupancy[c][block.row - 1] !== null: return false
  return true
```

- Per-block AABB upward 上升
- 每次升一行；迭代到收敛
- Block size 不变，只改 `row`
- 默认每个 mutating op 后跑（Option A；ADR-0003 induction 4）；`{ gravity: false }` 显式 opt-out

**Trigger 表**（per Option A invariant）：

| Op | Gravity 触发 | 理由 |
|---|---|---|
| `delete` | ✓ | 释放 cells，邻居可升 |
| `resize` 缩小 | ✓ | 同上 |
| `resize` 扩大 | ✓ | 保持 invariant；调用者可能想知道是否触发 reflow |
| `move` | ✓ | 同上 |
| `insert` | ✓ | **Option A 关键** —— 保证 state 永远 gravity-stable，no surprise leap |

### Worst-case performance

- `applyGravity`: O(B² × R) worst case（B = block count, R = total rows）；典型 O(B × log B)。Property-based test 包括 1000-op 序列 + 50k stress；large-N benchmark Phase 2+
- `findCollidingBlocks` / `maxEmptyRectContaining`: O(B) and O(C × R) respectively

---

## Consumer guidance

### Editor host（client；MVP: `apps/web`）

Editor 持有 `GridState`，调 mutation ops 后用返回的 new state 重 render。Block 在 DOM 中位置由 theme 决定：

```ts
left   = block.col * SLOT_SIZE
top    = block.row * SLOT_SIZE
width  = block.colSpan * SLOT_SIZE
height = block.rowSpan * SLOT_SIZE
```

`SLOT_SIZE` 由 theme 决定；engine 不持 slot size（theme-agnostic）。`kind → defaultSize` lookup 在 caller side（block-kind module registry），**不**在 engine。

### Server 复验（MVP: `apps/server`）

MVP 采用 working-state 整体保存（debounced PUT）。Server 在持久化前用同一份 engine 复验：

```
1. body → GridState（blocks + totalCols=12）
2. validateState(state, { gravity: page.gravityEnabled }) → ValidationResult
3. ok → transactional persist；否则 422 + errors（不部分 apply）
```

未来若改 per-op mutation endpoints（agent/API path 等），同样模式：tx 内 load → engine op → persist or rollback。

### Plugin / agent 消费（future）

Plugin 经 capability ctx 以 read-only 形态消费 engine、agent 写路径经 server pipeline——方向见 [plugin-system.md] / [pep.md]（browser vs agent path）；具体 contract 待新 PRD-informed ADR，本 CONTRACT 不预锁。

---

## Versioning

Internal package；semver 但 contract surface 演化规则：

| 变更类型 | 版本 bump | 是否要新 ADR |
|---|---|---|
| Type shape 增字段（兼容 add） | minor | 否 |
| 新 op | minor | 否 |
| Op signature 修改 | major | 否（如不破架构承诺） |
| 架构承诺修改（gravity 语义重定义 / kind-opaque 放弃 / purity 放弃 / `kind` 收回 closed union） | major | **是**（走新 PRD-informed ADR） |

简言：**架构承诺（kind-opaque / pure / leaf / gravity 语义）变更走 ADR；surface（types / op set）演化走本文件 + PR review**。

---

## References

- **MVP 决策**: [ADR-0019](../../docs/engineering/decisions/ADR-0019-mvp-implementation-baseline.md) + [mvp-scope-2026-06-11.md](../../docs/engineering/design/discussions/mvp-scope-2026-06-11.md)
- **Product 层依据**: [notepage-editing.md](../../docs/product/prd/features/notepage/notepage-editing.md) / [notepage.md](../../docs/product/prd/features/notepage/notepage.md) / [blocks.md](../../docs/product/prd/features/blocks/blocks.md)
- **Historical trace（deprecated，不作 authority）**: [ADR-0003] / [ADR-0002] / [ADR-0004] / [ADR-0014]（见 [decisions/README.md](../../docs/engineering/decisions/README.md) global deprecation notice）；source DI [`grid-redesign-2026-05-11.md`](../../docs/engineering/design/_frozen/grid-redesign-2026-05-11.md)
- **Carryover 原位置**: `carryover/packages/grid-engine/src/`（已提升；carryover 副本仅 history）
- **Contracts 索引**: [`docs/engineering/contracts/README.md`](../../docs/engineering/contracts/README.md)

---

## Changelog

- 2026-05-16 initial draft（从 carryover `src/types.ts` + `src/ops.ts` + frozen DI grid-redesign §3-4 + §6 提炼；同 ADR-0003 pass 2 reframe commit 落地；package source 仍在 carryover，Phase F 提升）
- 2026-05-16 pass 2.1 friend review fixes（同 ADR-0003 pass 2.1 commit）:
  - **BlockKind target = `string`** —— carryover closed union 降级为 transitional 实现细节；明确 consumer 不应依赖 exhaustive union
  - **`inferDropIntent` target signature = `(state, cursor, proposedSize)`** —— engine 不再吃 kind；caller 自己 lookup `kind → BlockPlugin.defaultSize`（ADR-0014）后传 proposed size；carryover 现签名标 transitional
  - **`DEFAULT_SIZES` 不在 contract target** —— 移出 exported constants；carryover 实装作为 transitional helper 保留至 lift 时机
  - **Hole-fill algorithm 伪代码 sync** —— caller-side lookup + engine-side clamp 二阶段分明
  - **Invariant 6 拆 + 加 invariant 7** —— invariant 6 是 pure / determinism / reentrance 行为承诺（显式 list 禁用项：random / Date / globalThis / IO / module-level state）；invariant 7 是 monorepo dep leaf 结构约束；二者关系（结构支撑行为但不充分）写明
  - **API endpoint 段加 insert flow** —— 显式 demo caller side 怎么做 `kind → defaultSize` lookup，把 engine kind-opaque 边界落到 wire-level usage
- 2026-06-11 lift 落地（MVP Task 2；[ADR-0019] + mvp-scope D7/D8）:
  - Source 自 carryover 提升至本目录 `src/`；target contract 全部落地为现行（`BlockKind = string` / `inferDropIntent(state, cursor, size)` / `DEFAULT_SIZES` 移出 engine）
  - `validateState(state, opts?)` 新增 gravity-stability 检查（默认开，`{gravity:false}` opt-out）——承接 server 落库前复验
  - Invariant 4 条件化：gravity stability 以 notepage 的 author-facing gravity toggle 为条件（owner ratified 2026-06-11）
  - 清除 ProseMirror / editor-shell / "future ADR-0019-grid-engine" 残留；deprecated ADR 引用全部降级为 historical trace
  - 测试 44/44 green（carryover 42 + 签名适配 + gravity validate 新增）
