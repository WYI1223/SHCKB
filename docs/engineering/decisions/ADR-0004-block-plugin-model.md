# ADR-0004: Block plugin extension model — open BlockKind + BlockPlugin contract

> **DEPRECATED / LEGACY DRAFT (2026-05-23)**: This ADR is retained only as historical carryover. It MUST NOT be used as an authoritative source for product behavior, architecture, implementation plan, or technology-stack choice. Technology choices must be derived from current PRDs and product shape, then captured in new PRD-informed ADRs. Treat any Decision/Consequences/technology names below as suspect until re-ratified.

| Field | Value |
|---|---|
| Status | deprecated (legacy draft; PRD-rework required) |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §4 (§4.1-§4.5) |

## Context

Block 是 canvas 上的 tile（详 ADR-0003）。Block 种类需要扩展性：
- Day-1 ship 10 built-in plugins（markdown / code / image / callout / math / pdf / jupyter / nn-viz / agent-flow / discussion）
- 未来 operator / 第三方可加 plugin
- Plugin 不应受限 backend 语言（详 ADR-0006 Bun + TS lock 的关键理由之一）

User explicit requirement: "block 抽象出来可以做成可 extension 模式。即后期想加功能块仅需要写插件即可。"

## Decision

**Open `BlockKind` + 单一 `BlockPlugin` contract + `BlockRegistry` 集中注册**。

### Plugin contract（详细见 ADR-0014）

```ts
type BlockPlugin<BlockState = any> = {
  kind: string;                                  // open identifier，不是闭合 union
  version: string;                               // semver
  propsSchema: z.ZodSchema;
  contentSchema: z.ZodSchema | null;
  defaultSize: { colSpan: number; rowSpan: number };
  EditView: ComponentType<BlockViewProps<BlockState>>;
  RenderView: ComponentType<BlockViewProps<BlockState>>;
  serializer: BlockSerializer<BlockState>;
  agentOps?: Record<string, AgentOpDefinition<any, BlockState>>;
  authRequirements?, multiAuthor?, realtimeChannel?, contentStorageHint?,
  permissions?, runtimeIsolation?,
  migrations?,
  paletteEntry?, slashEntries?, resizable?,
  category?
};
```

详细 field semantics + helper functions 见 ADR-0014。

### Registry

```ts
// packages/block-foundation/
class BlockRegistry {
  register(plugin: BlockPlugin): void;
  get(kind: string): BlockPlugin | undefined;
  list(): BlockPlugin[];
}
```

### 内置 vs 第三方 plugin

- **Built-in plugins**（Day-1 10 个）住 `packages/plugins/<name>/`，每个一个 workspace package
- **第三方 plugin** 走同样 contract；未来 marketplace 加载（详 ADR-0011 sandboxing evolution）
- 注册方式：显式 startup register（详 ADR-0014 §6 Plugin 注册时机）

### Discussion-as-block 推论

讨论版**不是独立子系统**，是 plugin 的一个实例（`kind: 'discussion'`）。一个 note 可有多个 discussion block；配置参数（允许匿名 / 审核 / 通知）是 plugin props；多 author content + WebSocket push 通过 plugin contract 新增字段表达（`multiAuthor` / `realtimeChannel` / `authRequirements`）。

未来 "live chat tile" / "voting tile" / "calendar tile" / "wiki-link tile" / 等都走同样 plugin contract 实例化。

## Consequences

**Positive**:
- 单 extension point；plugin author 学一套 contract 覆盖所有 block 类型
- 内置 / 第三方 plugin 结构对称；不偏袒内置
- Grid-engine（ADR-0003）不知 plugin kind 存在，只看 `Block { kind: string }`；解耦干净
- Discussion 作 plugin 把多功能复杂度推到 plugin level，core 简单

**Negative / Trade-offs**:
- Plugin contract 较大（18+ fields）；plugin author 需要理解全套语义
- 第三方 plugin 安全风险随扩展性增长；通过 ADR-0011 sandboxing evolution path mitigate
- Plugin marketplace 治理（discovery / install / update / permissions）是 Phase 2+ work

**Risks**:
- Contract 演化 break 第三方 plugin；通过 plugin `version: string` + `migrations` array + semver discipline mitigate
- "Plugin 之间互调" 反模式（直接 require 别的 plugin）；contract 明确禁止；通过 grid-engine read API + agent dispatch 实现合法交互

## Alternatives considered

- **闭合 BlockKind union (旧 ADR-0009)**: TS strictness 但失去扩展性；rejected per user explicit "extension mode" requirement
- **ADR-0008 D2 block-foundation interface freeze (旧)**: 防 contract 漂移但同时阻塞扩展；rejected per same reason
- **每 plugin 独立 SDK / 协议**: 没用 single contract；plugin author 学习成本翻倍；rejected per simplicity
- **类 Notion native block 闭源固定 set**: 不符合 open self-hostable 形态；rejected per `product/prd/project.md`
- **类 VSCode extension API**: 太大太重；rejected per scope

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §4 全部
- Carryover: 9 个 block 的 propsSchema 抽取在 `carryover/extracted-schemas/`，作 plugin design reference
- Related ADRs: ADR-0003 (grid-engine), ADR-0005 (agent semantic API), ADR-0011 (sandboxing), ADR-0013 (markdown editor), ADR-0014 (plugin contract details)

## Changelog

- 2026-05-13 initial draft (decision LOCKED 2026-05-12 in source DI doc)
