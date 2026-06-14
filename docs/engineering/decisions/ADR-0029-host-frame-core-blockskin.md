# ADR-0029: Host frame-core + BlockSkin — block 内容盒归 host，theme 供给纯视觉 skin

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-14 |
| Authors | W_YI (owner), Claude |
| Supersedes | [ADR-0025] §1/§2 BlockFrame 槽位分配（block 盒 → host frame-core；theme 供 BlockSkin；ADR-0025 的"几何=host"与"kind=content"两半保留） |
| Extends | [ADR-0028]（markdown autofit → block-base capability + 逐 kind `BlockKindModule.autofit` 策略） |
| Source PRDs | [plugin-system.md](../../product/prd/features/plugin-system/plugin-system.md)（UI-plugin extension type deferred 条目）/ [theme-system.md](../../product/prd/features/theme-system/theme-system.md)（skin unification / theme simplification deferred 条目） |
| Spec | [2026-06-14-unified-block-capability-architecture-design.md](../../superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md) |
| Discussion | [mvp9.5-scope-2026-06-14.md](../design/discussions/mvp9.5-scope-2026-06-14.md) |

> **注意**：本 ADR 是 PRD-informed，走 [AUDIT-2026-05.md](./AUDIT-2026-05.md) 流程注册。ADR-0025/0028 是上游决策，本 ADR 修订/扩展其相关节。

## Context

### 触发事件：stationery autofit 塌缩

MVP-9.5 只给 markdown 做了 autofit（实验性）。e2e 中发现 stationery 主题的 autofit 整个塌掉——它的 BlockFrame 把内容画在绝对定位、`inset` 的内层（`.skb-paper`）里，离屏测量拿不到确定高，`fit` 恒为 1，6 行内容被压进 1 行。已用 frame-agnostic 测量（commit `b200828`）止血，但这只是补丁。

根因是结构性的：**[ADR-0025] 把 `BlockFrame` 槽位给了 theme**，theme 因此拥有破坏内容盒不变量的物理能力（`position:absolute; inset` 让 `.skb-content-box` 脱离正常流，measureProbe 量不到真实高）。

### 分层与所有权收敛

owner 连出三个问题，收敛成一条原则：**功能性 / 结构性能力活在 host；kind / theme / UI-plugin 是薄插件，各供其专长——kind = content，theme = material/skin，UI-plugin = frame-core/chrome。无 base class；要么整体替换，要么加法扩展，永不局部改写。**

同时澄清三条：
- "继承或重写" 属于 UI-plugin 轴（L1），不是 theme；当前 UI 本就是 MVP-7 换上的 `ui-fork/free`。
- autofit 不是 markdown 专属——机制已经 kind-agnostic；只被两个 `kind === 'markdown'` 闸门 + seeding 绑在 markdown 上。
- theme 应"简化"——不持有功能性盒结构。

## Decision

### 1. Host `BlockFrameCore` 持有可测量内容盒（block 盒不变量）

新增 `BlockFrameCore`（在 `@skb/block-kinds`，编辑器与静态发布同用），取代各 theme 的 `BlockFrame` 槽位。结构：

```
<div class="skb-frame-root" style={fill cell + skin.rootStyle}>
  {skin.behind}                          // 撕边、卷角（overlay，aria-hidden）
  <div class="skb-content-box"           // ← 不变量，host 持有
       style={ ...skin.box,
               position:'relative',
               overflow:blockOverflow(autofit) }}>
    <RenderView content={…} />
  </div>
  {skin.front}                           // 和纸胶带（overlay，aria-hidden）
</div>
```

**盒不变量（功能契约）**：`.skb-content-box` 永远在正常流、撑出内容自然高、且是 overflow/clip 容器。这正是 stationery 破坏掉的东西。

**由类型强制，不是约定**（核心：构造上不可破坏）：`skin.box` 是受限视觉子集（`SkinBoxStyle`），包含 `background / border / borderRadius / padding / color / boxShadow / backgroundImage / backgroundSize / backgroundRepeat / backgroundPosition / borderImage`，**不包含** `position / overflow / height / display`。skin 物理上写不出破坏盒不变量的 CSS；host 的不变量属性最后应用。

**"所测即所渲" 由构造保证**：frame-core 在可见渲染与 MeasureProbe 里是同一个组件，消除两处 `resolveBlockFrame` 的漂移风险。

**几何不变**：canvas 仍持有定位外层（`left/top/width/height`）并给 frame-core `100%/100%`——[ADR-0025] 的"几何=host"半边保留；只把"壳盒=theme"改成"盒=host，skin=theme"。

### 2. `BlockSkin` 契约（取代 `shells`）

theme 暴露 `skins: Record<id, BlockSkin>`（取代 `shells`）+ 默认 skin + tokens + `globalCss`（不变）。

```ts
type BlockSkin = {
  id: string;                 // 持久化（取代 shell id）
  name: string;
  kinds?: string[];           // 适用的 kind；省略 = 全部
  root?: {
    className?: string;
    style?: SkinRootStyle;    // 受限：transform/filter/opacity/视觉——tilt 在这里；不许 detach
  };
  box?: {
    className?: string;
    style?: SkinBoxStyle;     // 受限：background/border/radius/padding/color/shadow——无 position/overflow/height/display
  };
  behind?: (ctx: SkinCtx) => ReactNode;  // aria-hidden overlay（撕边、卷角）
  front?:  (ctx: SkinCtx) => ReactNode;  // aria-hidden overlay（和纸胶带）
};
```

**skin 的图是装饰**——随 host 盒缩放；永不*决定* block 尺寸（那是结构 = UI-plugin 轴）。未知 kind 回退：theme 无匹配 skin 时，host 用框架默认 skin（极简卡片）。

### 3. `BlockKindModule.autofit` 字段（autofit 升为 block-base 能力）

延续 [ADR-0028] 的 `pushResize` 引擎原语，本 ADR 把 autofit 机制从 markdown 闸门解闸为 block-base 能力：

```ts
// kind 契约新增字段
autofit?: false | { default: 'off' | 'grow' | 'grow+shrink' }
```

- `false` = autofit-unavailable（不显示 toggle、不挂 probe、忽略 metadata）
- `{ default }` = 可用，新块默认该模式
- 省略 = 可用，默认 `off`

**逐 kind 策略（已定）**：

| kind | `autofit` | 理由 |
|---|---|---|
| markdown / richtext / code | `{ default: 'grow' }` | 文本内容（owner 拍板） |
| image | `false` | autofit-unavailable——图块要手控裁切 |
| 省略（未来 plugin） | 可用、默认 `off` | 能力普适，按需 opt-in |

移除两个 `kind === 'markdown'` 闸门 → toggle 与 probe 对任意可用 kind 生效。MeasureProbe 改包 frame-core——因盒不变量保证内容在流内，测量由构造稳健。

### 4. 迁移策略（非破坏）

**无数据迁移**：渲染层 + kind 契约 refactor，`blocks.autofit` / `minRowSpan`（schema v8）不变，无新 DDL。stationery-spike-first：先建 frame-core + `BlockSkin` 契约 + 不变量测试；只重建 stationery 到 frame-core + skin（最难主题先做）；迁移其余四主题 `shells → skins`；五主题全 skin 化后删除已死的 `theme.BlockFrame` / `shells` 结构槽。

## Consequences

- **stationery 类 bug 对任意 skin 或 block plugin 都不可能再发生**：类型受限使物理上写不出破坏盒不变量的 CSS
- **autofit 普适到全 kind**：block plugin 白拿可测量盒 + autofit + 当前 theme skin，无需额外声明
- **"所测即所渲" 由构造保证**：消除 MeasureProbe vs 可见渲染漂移的根本来源
- **theme 简化**：slice 后 theme = tokens + `globalCss` + `CanvasSurface` + `PageTitle` + palettes + `skins`（原 `shells`），减 `BlockFrame`；theme 尚未*完全*简化（CanvasSurface/PageTitle 留待北极星 UI-plugin pass）
- **vanilla floor 不可抽走**：theme 无匹配 skin 时 host 用默认 skin，任何 kind 在任何 theme 下都能渲染

## Deferred / north-star

以下条目本 slice **不做**，durably 记录于此（同时记于 PRD Phase 2+ 节 + spec §9）：

| Deferred item | 内容 |
|---|---|
| **UI-plugin extension type** | L1 正式契约：UI plugin 如何注册；可替换/扩展什么；lifecycle 进 plugin-system PRD |
| **Frame-core replace/extend model（Open/Closed）** | 整体替换（全有或全无）+ 加法扩展（加新层，不碰 core 盒逻辑）；替换者必须守可测量盒能力（共享不变量测试为地板）；局部改写永不开放 |
| **Theme full simplification** | 把 `CanvasSurface` / `PageTitle` 移出 theme → theme = 纯 material |
| **Skin unification** | `papers` + `palettes` + block `skins` 并入单一 skin 概念；可能独立 skin pack |
| **Theme asset pipeline** | theme 打包字体 / 图片*文件*（今天仅 inline/data-URI） |
| **Published-asset safety gate** | theme/UI 成不受信第三方时，公开页 theme SVG/`url()` 闸门 |
| **Additive block capabilities** | autofit 之外的新 block 级能力，经 frame-core 扩展槽加入 |

## Alternatives considered

1. **保持 BlockFrame 在 theme，只加类型约束** —— 拒绝：类型约束不能阻止 `position:absolute` + `inset` 模式（今天 stationery 的根因）；约束要有效必须把盒子控制权收归 host。
2. **为 stationery 单独修补 MeasureProbe** —— 拒绝：frame-agnostic 测量（b200828）已做此补丁；但根因是结构权力错配，补丁是 belt-and-suspenders，不是根治。
3. **theme 保留 BlockFrame，但禁止其用 `position:absolute`（lint 规则）** —— 拒绝：lint 只管 lint，theme 是代码，可绕过；且工程灾难没有"局部改写 core"的合法入口。

## References

- Spec: [2026-06-14-unified-block-capability-architecture-design.md](../../superpowers/specs/2026-06-14-unified-block-capability-architecture-design.md)（完整北极星 + 映射表 + stationery spike 清单）
- Discussion: [mvp9.5-scope-2026-06-14.md](../design/discussions/mvp9.5-scope-2026-06-14.md)
- 修订来源 ADR: [ADR-0025](./ADR-0025-theme-slots.md)（§1/§2 BlockFrame 槽位分配 → host；几何=host 与 kind=content 两半保留）
- 扩展来源 ADR: [ADR-0028](./ADR-0028-autofit-gravity-carveout.md)（markdown autofit → block-base capability + 逐 kind 策略）
- PRD 传播: [plugin-system.md](../../product/prd/features/plugin-system/plugin-system.md) § Phase 2+ Deferred / [theme-system.md](../../product/prd/features/theme-system/theme-system.md) § Phase 2+ Deferred
- Audit register: [AUDIT-2026-05.md](./AUDIT-2026-05.md)
