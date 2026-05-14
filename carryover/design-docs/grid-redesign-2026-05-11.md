# Grid 重设计 — 设计对话 2026-05-11

> **状态**: Draft / brainstorm output. Pre-ADR.
> **来源**: 用户与 orchestrator 的对话（cf-22/23/24/25 PR 完成后），用户对当前 grid 实现 + 整体架构提出根本性 critique。本文档先记录设计共识，prototype 验证后再升 ADR。
> **下一步**: prototype `@skb/grid-engine` headless package 验证算法 → 视觉 UI 实验 → ADR 起草 → 落地 PR.

---

## 1. 触发问题

cf-22/23/24/25 在工程层面 clean（14 R-rounds, 0 admin bypass, ADR 落地, CI green），但用户指出**整体架构有问题**：

> "你不觉得，现在的代码整体上就有架构上的问题吗？你有没有在用户心智、用户体验的视角下审视过？"
> "grid 本身就没做好。你过度信任带来的结果是还不如 v2，起码 v2 把 grid 做的比你完整。"
> "edit 模式还是全部都是一个大方块，markdown 应该是单独的 block，12-grid 应该像乐高积木基地。"
> "你应该考虑的，根本不是步骤问题，而是这个功能，到底好不好用，到底符不符合用户心智。"

orchestrator 的 self-audit：14 个 R-round 全部在问"测试覆盖 / ADR / contract / CI green"，**没有一个**在问"用户写一篇笔记需要点几次鼠标 / 找回某篇旧笔记要多久 / 这个交互手感对吗"。

---

## 2. Mental model（LOCKED）

Grid 不是文档排版问题，是 **2D tile placement on a discrete grid** —— 等价于：
- Tetris 不带重力
- Minecraft 物品栏的 multi-slot items
- The Sims build mode
- Tiled / RPG Maker tile editor
- StarCraft 建筑放置

具体定义：

- **12 列 × N 行的 LEGO 底板**，每个 (col, row) 是一个 slot
- **每个 slot 是均匀方形像素单位** —— `--skb-slot-size` 一个 CSS variable 同时控制 row height + col width
- **每个 block 是 AABB 矩形**，占据连续 `colSpan × rowSpan` 个 slot
- **整体 invariant**: 任意两个 block 不 overlap
- **collision detection** = 教科书 AABB：
  ```
  overlap(A, B) iff
    A.col < B.col + B.colSpan AND
    B.col < A.col + A.colSpan AND
    A.row < B.row + B.rowSpan AND
    B.row < A.row + A.rowSpan
  ```
- **Source of truth = 12×N occupancy matrix** + `Block[]`，不是 CSS Grid 的渲染状态

---

## 3. Operations + 物理（LOCKED）

### 3.1 Drop intent inference

拖动姿势包含意图信号 —— 基于 cursor pose 推断意图，再用 game-engine collision check 执行：

| Cursor 位置 | Intent |
|---|---|
| 空 slot 区域 | `place` |
| Block X 边缘附近（距右边 < 30%） | `insert-right`（找 X 右侧空 slot 区域容纳） |
| Block X 边缘附近（距左/上/下） | `insert-left` / `insert-above` / `insert-below` |
| Block X 中心 | `swap` / `replace`（待定） |
| 两个 block 之间的 gap | `insert-between` |

**关键**: 意图推断（`intent.ts`）和执行（`ops.ts`）两层分离。意图层只判断 user wants what；执行层只做 AABB validation。

### 3.2 Hole-fill smart placement（关键 UX 决策）

新 block 放入空 hole 时，**首先尝试填充 hole**，不 blindly 用 default size：

```
onDrop(cursorCol, cursorRow, blockKind):
  defaultW, defaultH = DEFAULTS[blockKind]
  holeMaxW, holeMaxH = maxEmptyRectContaining(occupancy, cursorCol, cursorRow)
  newW = min(defaultW, holeMaxW)
  newH = min(defaultH, holeMaxH)
  newCol, newRow = align to top-left of hole
  return placeBlock(newCol, newRow, newW, newH)
```

- 洞 ≥ default → 用 default size
- 洞 < default → 缩到 hole size，**不拒绝**
- 洞 = default → exact fit

### 3.3 Gravity（per-block AABB upward）

**行坍缩 + 列留洞**：vertical 方向有 gravity，horizontal 方向没有。

例子（用户给的 trace）：
```
初始：
row 0: [A, A, B]
row 1: [A, A, B]
row 2: [C, C, B]
row 3: [C, C, 0]
row 4: [D, D, D]

删 C 后：
row 0: [A, A, B]
row 1: [A, A, B]
row 2: [0, 0, B]   ← C 上半留下的洞保持空
row 3: [D, D, D]   ← D 升 1 行
```

D 升一行因为 row 3 的 (col 0-2) 全空（col 0-1 是 C 删后空，col 2 本来就空）。D 想再升不能因为 row 2 col 2 是 B。

算法：

```
function applyGravity(state):
  loop:
    moved = false
    for block in state.blocks (sorted by row ascending):
      if canRise(block, state.occupancy):
        moveUp1(block, state.occupancy)
        moved = true
    if not moved: break

function canRise(block, occupancy):
  if block.row == 0: return false
  for c in block.col .. block.col + block.colSpan - 1:
    if occupancy[c][block.row - 1] is occupied: return false
  return true
```

- Per-block AABB upward 上升
- 每次升一行
- 迭代到收敛
- **block size 不变**，只改 row

何时触发（**Option A locked 2026-05-11 prototype validation**）：
- `delete` → 必触发
- `resize` 缩小 → 必触发（释放了 cells）
- `resize` 扩大 → 必触发（保持 invariant）
- `move` → 必触发
- `insert` → **必触发**（Option A 锁定 — gravity 始终 invariant）

**为什么 Option A**：如果 insert 不跑 gravity，用户 insert 一个浮空 block 后做无关 delete，gravity 就会让那个 block 突然跳到 row 0 —— surprise leap. Option A 保证 state 永远 gravity-stable，没有 floating block 可以 leap。**用户视角**：拖块到 (col 5, row 10) → 立即 snap 到该 col 区域最高空 row。这意味着 UI 拖动时 ghost preview 应该显示 SNAPPED 位置，不是 cursor 位置。

### 3.4 Resize（任意 block 都可调宽 + 调高）

- 用户可以 resize 所有 block kind 的 colSpan + rowSpan（不限于"放进来什么 size 就锁死"）
- Discrete unit（snap 到整数 col / row）
- **必须 validate 邻居 collision**（cf-20d 现在没有，是 bug）
- Shrink 触发 gravity，expand 不触发

---

## 4. 架构（LOCKED）

### 4.1 数据 ↔ 渲染分离

```
[Data Layer]            ← Source of Truth
  blocks: Block[]
  occupancyMatrix: 12 × N
  invariant: ∀ block pair, no AABB overlap
  操作: insert / move / resize / delete + gravity
  ↓ 每次 mutation 都 validate

[Render Layer]          ← 单向消费 data
  从 data 计算每个 block 的 (left, top, width, height) 像素位置
  CSS Grid 仅作为渲染实现细节：
    grid-template-columns: repeat(12, 1fr)
    grid-template-rows: repeat(N, var(--skb-slot-size))
    每个 block 显式 grid-row-start/end + grid-column-start/end
    ABSOLUTELY NO grid-auto-flow / dense / 隐式 placement
```

**CSS Grid 不当 SoT**，因为：
- `grid-area` 重合时 CSS 直接 overlap 渲染，不报错
- `grid-auto-flow` 会自己做决策
- `grid-template-rows: auto` 行为依赖 layout 算法副作用

### 4.2 NEW headless package: `@skb/grid-engine`

```
packages/grid-engine/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── CONTRACT.md
└── src/
    ├── index.ts             barrel
    ├── types.ts             Block / Slot / Region / Occupancy / GridState / Intent
    ├── occupancy.ts         12×N matrix + cell-level ops
    ├── collision.ts         AABB overlap + findCollidingBlocks
    ├── ops.ts               insertBlock / moveBlock / resizeBlock / deleteBlock
    │                        每个返回 { ok, state, error? }
    ├── gravity.ts           applyGravity / canRise / moveUp1
    ├── intent.ts            inferDropIntent + proposedSize（hole-fill）
    ├── validate.ts          validateState / assertNoOverlap / assertInBounds
    └── __tests__/
        ├── occupancy.test.ts
        ├── collision.test.ts
        ├── ops.test.ts
        ├── gravity.test.ts
        ├── intent.test.ts
        ├── validate.test.ts
        └── property-based.test.ts    ← random ops, invariant: never overlap
```

特点：
- **完全 headless** —— 不依赖 React / CSS / DOM / Tiptap / ProseMirror
- **纯函数** —— 不存内部 state，input → output
- **可独立 unit-test** —— property-based test 100 random states × 1000 random ops，invariant 永不破
- **可独立 prototype** —— pure TypeScript REPL 验证算法

### 4.3 SoT: ProseMirror doc（alpha 方案）

候选：

- **α: PM doc 是 SoT** —— block 作为 PM node，attrs = (col, row, colSpan, rowSpan, kind)。每次 transaction 提取 Block[] → 调 grid-engine ops → invalid 则 reject transaction，valid 则 apply 新 attrs
- **β: grid-engine state 独立 React state** —— PM 只存 content，grid attrs 单独管理

**选 α**，出现问题立刻转 β。理由：保留 PM 的 transaction / undo / serialize 现成机制，重新设计成本太高。

要求：grid-engine ops 必须**纯净 + 可 dry-run**（先验证再 commit）。

---

## 5. cf-25 现状的破坏 & 必须改的事

| 现状 | 问题 | 修法 |
|---|---|---|
| `applyDropMode` 4-mode split-with-shrink (cf-20c-1) | 错的抽象 —— "目标 block 缩一半给我让位" 不是 game-engine model | 删掉。换成 intent inference + hole-fill + AABB validation |
| `rowSpan='auto'` (cf-25 D5 default) | 与 2D matrix 冲突，rowSpan 必须离散整数 | parse 时 `'auto'` → 归一化为 `1`；旧 MDX 仍可读 |
| 行高 content-driven (auto) | 与"均匀方形 slot"冲突 | 全 row 用 `var(--skb-slot-size)` 固定；content 溢出 → 默认 `overflow: auto` 滚动 |
| cf-20d resize 没 validate 邻居 collision | 用户能 resize 进相邻 block 区域 | resize ops 接 grid-engine.resizeBlock 做 AABB check |
| `useProjectGridStyleToOuter` (cf-25 R1 F2) | 把 inner style 投影到 outer wrapper —— 现在跑通了但是 indirection | grid-engine 直接给 outer wrapper 算 grid-area，删掉 useLayoutEffect 投影 |
| 空白 board 看不见 | 无 LEGO 感 | grid.css 加常驻 grid 线 + drag 时高亮空 slot |
| 每个 block 没显式 outline | 不知道边界 | BlockNodeView 加 always-visible outline |

---

## 6. Default sizes per block kind

`onDrop` 的 `DEFAULTS[kind]`，hole-fill 时取 `min(default, holeMax)`：

| kind | default colSpan × rowSpan | rationale |
|---|---|---|
| markdown | 12 × 1 | 写一段就一行 |
| image | 6 × 4 | 中等可见 |
| code | 12 × 4 | 宽 + 高 读得清 |
| callout | 12 × 1 | 突出但简短 |
| math | 12 × 2 | 公式横幅 |
| pdf | 12 × 8 | 阅读大区 |
| jupyter | 12 × 6 | notebook output 不会太挤 |
| nn-viz / agent-flow | 12 × 6 | 图谱要空间 |

prototype 阶段确认这些数字 + `--skb-slot-size` 像素值。

---

## 7. Open questions for prototype

- `--skb-slot-size` 具体像素值？（60? 80? 100? prototype 试）
- `intent.ts` 的 cursor-zone threshold（边缘 30%）合不合适？
- swap / replace intent 在 block X 中心时怎么决定？（prototype 试两种）
- gravity 算法的 worst-case 性能（很多 block 时迭代次数）？
- property-based test 能否真的 100% catch invariant violation？

---

## 8. Next steps

1. **写本文档** ✓
2. **prototype `@skb/grid-engine`** ✓（45/45 scenarios + 50k stress + Option A locked）
3. **UI prototype** ✓（3 variants A/B/C 都 deployable，user 决定 KEEP ALL THREE 作为 themes —— 见 §10）
4. **lift to packages** ← 当前
5. **ADR 起草 + wave-7 落地**

## 9. Themes（locked 2026-05-11 post UI prototype）

User 看完 3 个 variant 后决定：**全部保留作为 themes**，用户可切。这反向 confirms data ↔ render 分离的必要性。

3 个内置 theme：

| key | 名字 | slot size | baseplate | block 样式 | mental model |
|---|---|---|---|---|---|
| `graph-paper` | Graph paper | 60px | dotted 极淡 | 1px 边 + 顶 stripe | 工程画布 / 技术 |
| `lego-studs` | LEGO studs | 80px | 凸点显式 + cell 边框 | hue tint + 浅边 | 积木 / 触感 |
| `bento-canvas` | Bento canvas | 100px | 默认隐藏（drag 时显） | 圆角 + shadow + hue header | dashboard / 卡片 |

**架构 implication**：
- `@skb/grid-engine` 完全 theme-agnostic（pure logic）
- Theme 实现层：先在 `editor-shell` 内部，后续如果有跨 consumer 需求再提到 `@skb/grid-themes`
- Theme switching 不动 data，只换 render component

### 9.1 Product 决策（locked 2026-05-11 by user）

1. **Theme 存哪里**：**hybrid (d)**
   - 默认 per-user via `localStorage['skb.grid.theme']`
   - 单 doc 可在 MDX frontmatter 加 `theme: bento-canvas` override
   - frontmatter 优先，否则 fallback 到 user pref，否则 fallback 到 default

2. **默认 theme**：`lego-studs`
   - 对 grid 心智表达最直观（"啊这是个积木板，每块是一个 brick"）

3. **Theme switcher 放哪**：**floating chip**
   - 类似 prototype switcher 的浮动 pill，但生产化（hide 在 production fold）
   - 屏幕右下角默认；可拖动；可隐藏

4. **Extensibility**：**closed for now, but interface designed for future**
   - 3 theme hard-coded in v1 (`'graph-paper' | 'lego-studs' | 'bento-canvas'`)
   - **但要写好 `Theme` interface + theme registry 模式**，让未来加第 4 个 theme 不需要重构

### 9.2 Theme interface（contract，v1 closed registry）

```ts
// @skb/grid-engine 不知道 theme 存在
// theme 实现层（暂在 editor-shell）export 这个 interface

export type ThemeKey = 'graph-paper' | 'lego-studs' | 'bento-canvas';

export interface GridTheme {
  /** kebab-case unique id */
  key: ThemeKey;
  /** human-readable name */
  displayName: string;
  /** Optional short description */
  description?: string;
  /** Slot pixel size — uniform square */
  slotSize: number;
  /** CSS variable map injected at root */
  cssVars: Record<string, string>;
  /** React component to render the baseplate (grid lines / studs / blank) */
  renderBaseplate: (props: BaseplateProps) => React.ReactNode;
  /** React component to render a single block */
  renderBlock: (props: BlockRenderProps) => React.ReactNode;
  /** React component to render the drag-ghost / drop-preview */
  renderDropPreview: (props: DropPreviewProps) => React.ReactNode;
  /** Optional: theme-specific resize-handle override; default null = use shared */
  renderResizeHandle?: (props: ResizeHandleProps) => React.ReactNode;
}

export interface BaseplateProps {
  totalCols: number;
  totalRows: number;
  dragInProgress: boolean;
}

export interface BlockRenderProps {
  block: Block; // from @skb/grid-engine
  isDragging: boolean;
  isResizing: boolean;
  isFocused: boolean;
  children: React.ReactNode; // the block's actual content (markdown / image / ...)
}

export interface DropPreviewProps {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  isValid: boolean; // green / red feedback
}

export interface ResizeHandleProps {
  edge: 'right' | 'bottom' | 'corner';
  active: boolean;
}

// Registry — 暂时 closed, 但 API 形态预留 register
const themes = new Map<ThemeKey, GridTheme>();
export function registerTheme(theme: GridTheme): void {
  themes.set(theme.key, theme);
}
export function getTheme(key: ThemeKey): GridTheme {
  const t = themes.get(key);
  if (!t) throw new Error(`unknown theme: ${key}`);
  return t;
}
export function listThemes(): GridTheme[] {
  return Array.from(themes.values());
}
```

**v1 行为**：3 个 built-in theme 在 module load 时调用 `registerTheme()` 自己注册。User code 不需要 register。但接口存在 → 未来如果开放，从 user code 调 `registerTheme()` 加第 4 个 theme 即可，不需要改 core。

---

## 9. 这次对话留下的 operational lessons

orchestrator 不能再犯的错：

1. **不要把"产品决策"当"架构缺陷"** —— SKB 是 grid-canvas editor 不是 paragraph-flow notebook，是用户的产品定位，不是 bug
2. **不要把"未做"当"做错"** —— dashboard / 搜索是 roadmap 后续，不是已有架构的缺失
3. **不要把视觉 demo（v2 reference）当产品规范** —— v2 解决"看起来怎么样"，不是"用起来怎么样"
4. **每个 PR 必须问"用户体验"问题** —— 不仅是测试覆盖 / ADR / CI
5. **跳出 1D row 模型** —— grid 是 2D matrix，row 只是矩阵索引
6. **数据是 SoT，渲染是下游** —— 不能依赖 CSS / 框架/ libraries 维护 invariant
