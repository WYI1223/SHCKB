# ADR-0003: Grid-engine contract — 12-col × N-row with AABB + Option A gravity

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/grid-redesign-2026-05-11.md` (entire) + `architecture-rebuild-2026-05-11.md` §2 |

## Context

旧 spec 把 grid 当成"文档排版辅助"（per-block colSpan/rowSpan attrs on text-flow editor）；framing critique（详 mental-model.md）暴露这个心智错位。User reframe 为 **constrained canvas**：not Notion / not free canvas / not Tetris puzzle，是介于三者间的"约束做 affordance 不做 cage"的形态。

参考形态：iOS Springboard / Bento dashboards / Sims build mode / Stage Manager / Tiled / RPG Maker。

需要 lock 一个 headless 2D layout engine 作为所有 plugin / theme / shell / persistence 的底层共同语言。

## Decision

**`@skb/grid-engine` headless package**，pure functions on `GridState`。

### Mental model

- 12 列 × N 行 LEGO 底板
- 每个 slot 是均匀方形像素单位（`--skb-slot-size` CSS var 控制 row height + col width）
- 每个 block 是 AABB 矩形，占 `colSpan × rowSpan` 连续 slot
- Invariant: 任意两 block 不 overlap
- Source of truth = `GridState.blocks` 数组；occupancy matrix 是 derived

### Public API

```ts
type Block = { id: string; kind: string; col: number; row: number; colSpan: number; rowSpan: number };
type GridState = { blocks: Block[]; totalCols: number };  // totalCols 默认 12

// pure functions（输入 state → 输出 OpResult）
insertBlock(state, block, opts?) → OpResult
moveBlock(state, id, col, row, opts?) → OpResult
resizeBlock(state, id, colSpan, rowSpan, opts?) → OpResult
transformBlock(state, id, changes, opts?) → OpResult   // atomic move + resize
deleteBlock(state, id, opts?) → GridState              // 不会失败

// intent inference
inferDropIntent(state, cursorCol, cursorRow, blockKind) → DropIntent  // hole-fill
maxEmptyRectContaining(state, col, row, capW, capH) → Region | null

// gravity (Option A — default invariant)
applyGravity(state) → { state, iterations, movedTotal }
canRise(state, blockId) → boolean

// validate
validateState(state) → ValidationResult
```

### Option A gravity（locked）

- 每个 state-mutating op 后 default 跑 `applyGravity` （除非 `{ gravity: false }`）
- Per-block AABB upward；每次升一行；迭代到收敛
- 保证 state 永远 gravity-stable；no surprise leap from unrelated delete
- Power user 可 opt-out via `{ gravity: false }` flag

### Hole-fill drop intent

`inferDropIntent` 找包含 cursor 的最大空 rect（不是从 cursor 向右下扩展）；clamp by plugin defaultSize。

### Constraints

- `colSpan`、`rowSpan` 是离散整数（≥ 1；no 'auto'）
- `col + colSpan ≤ totalCols`
- `row ≥ 0`（无上界）

## Consequences

**Positive**:
- Plugin / theme / shell / persistence 都消费同一个 GridState；no logic 重复
- Property-based test 验证 invariant；100 random states × 1000 ops invariant 不破
- Carryover 已验证（grid-engine + prototype），切入新 repo 几乎零迁移成本
- Theme switch + plugin swap 不影响 layout 算法

**Negative / Trade-offs**:
- 固定 12 列（不响应式自适配）；mitigate by viewport-level 12/6/1 切换（CSS-only）
- N 行无上界 → 不能简单 cap memory；mitigate by virtualization at render layer (Phase 2+)
- Discrete-only spans → 不支持 fractional / fluid sizing

**Risks**:
- 算法误差 / 收敛失败 → property test 充当 regression guard
- Performance under large N (1000+ blocks) → benchmark 在 M3+

## Alternatives considered

- **CSS Grid 作为 SoT**: `grid-area` 重合时 CSS 静默 overlap；`grid-auto-flow` 不可控；rejected
- **Continuous coordinates (Figma-style free canvas)**: 失去"对齐 affordance"；user 反复纠对；rejected per mental-model
- **Row-stream model (1D doc-flow + col)**: 旧 Wave 5 路径；和 canvas 心智不符；rejected
- **Tetris-style system-places-tiles**: 系统决定形状 → user 决定形状；mode mismatch；rejected per §2.5 rhetorical 区分

详细 mental model + 三类 alternatives 见 source DI doc grid-redesign §2 + architecture-rebuild §2。

## References

- Source DI docs:
  - `engineering/design/_frozen/grid-redesign-2026-05-11.md` (entire)
  - `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §2
- Carryover package: `carryover/packages/grid-engine/` (validated; will move to `packages/grid-engine/` in M1)
- Prototype: `carryover/_reference/prototype/` (THROWAWAY; 3 theme variants validated β path)
- Related ADRs: ADR-0004 (plugin uses grid-engine), ADR-0014 (plugin contract)

## Changelog

- 2026-05-13 initial draft (carryover package already validated; mental model LOCKED 2026-05-11)
