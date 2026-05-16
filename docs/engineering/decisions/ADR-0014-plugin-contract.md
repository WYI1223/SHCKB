# ADR-0014: Plugin contract details — agentOps signature + serializer + versioning

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.3 + §4.3 |

## Context

ADR-0004 锁了 BlockPlugin extension model skeleton；本 ADR 完整定义 plugin contract field 细节 + agentOp signature + serializer shape + plugin-to-plugin 通信规则 + 注册时机 + versioning。

User reframe（2026-05-13）："本质上似乎就是 tool use 的不同 block 版本的 patch" → agentOps = block-scoped LLM tool use；详 ADR-0005。

## Decision

### 完整 BlockPlugin contract

```ts
type BlockPlugin<BlockState = any> = {
  kind: string;                                  // open identifier；非闭合 union
  version: string;                               // semver
  propsSchema: z.ZodSchema;
  contentSchema: z.ZodSchema | null;
  defaultSize: { colSpan: number; rowSpan: number };
  EditView: ComponentType<BlockViewProps<BlockState>>;
  RenderView: ComponentType<BlockViewProps<BlockState>>;
  serializer: BlockSerializer<BlockState>;
  agentOps?: Record<string, AgentOpDefinition<any, BlockState>>;

  // discussion-as-block 推广扩展（详 ADR-0004）
  authRequirements?: { read?: 'public'|'auth'|'owner-only'; write?: 'auth'|'owner-only' };
  multiAuthor?: boolean;
  realtimeChannel?: string;
  contentStorageHint?: 'inline' | 'sidecar-table' | 'blob';

  // §11.15 sandbox hook（详 ADR-0011）
  permissions?: Array<'db.read' | 'db.write' | 'network' | 'fs' | 'kernel'>;
  runtimeIsolation?: 'inline' | 'worker' | 'wasm';

  // Versioning + migration
  migrations?: Array<{ fromVersion: string; toVersion: string; migrate: (row: DbRow) => DbRow }>;

  // 显示侧
  paletteEntry?: { displayName: string; icon: string; description: string };
  slashEntries?: Array<{ trigger: string; displayName: string }>;
  resizable?: boolean;

  // 可选 categorization
  category?: 'prose' | 'component' | 'render' | 'viz';

  // 可选 helper for search index（详 ADR-0008）
  extractPlainText?: (state: BlockState) => string;
};
```

### AgentOp signature

```ts
type AgentOpContext = {
  noteId: string;
  blockId: string;
  userId: string | null;                         // null = unauth；mutation 一般非 null
  storage: StorageProvider;                       // ADR-0007 capability
  search: SearchProvider;                         // ADR-0008 capability
  engine: GridEngineReadFacade;                   // 只读；write 必须走另一 op
  broadcast: (channel: string, msg: unknown) => void;  // ADR-0015 realtime
  log: (level: 'info'|'warn'|'error', msg: string) => void;
};

type AgentOpResult<NewState> =
  | { ok: true; next: NewState }
  | { ok: false; error: string; code?: 'invalid_args'|'unauthorized'|'conflict'|'not_found'|'internal' };

type AgentOpHandler<Args, BlockState> = (
  args: Args,
  current: BlockState,
  ctx: AgentOpContext
) => Promise<AgentOpResult<BlockState>>;

type AgentOpDefinition<Args, BlockState> = {
  argsSchema: z.ZodSchema<Args>;
  handler: AgentOpHandler<Args, BlockState>;
  description: string;                           // LLM 看；human-readable
  authRequired?: boolean;                        // default true
  idempotent?: boolean;                          // metadata only；framework 不强制
};

export function defineAgentOp<Args, BlockState>(
  def: AgentOpDefinition<Args, BlockState>
): AgentOpDefinition<Args, BlockState> {
  return def;                                    // TS 推断 helper
}
```

### Serializer signature

```ts
type DbRow = {
  contentInline?: string | null;                 // text content
  blobRefs?: Array<{ key: string; mime: string; size?: number; hash?: string }>;
};

type SerializerContext = { storage: StorageProvider };

type BlockSerializer<BlockState> = {
  toRow: (state: BlockState) => DbRow;                                    // 必 sync；txn 内运行
  fromRow: (row: DbRow, ctx: SerializerContext) => BlockState | Promise<BlockState>;
};
```

`toRow` 必 sync 因为 write transaction 内执行；大 binary 上传应**先于** `toRow` 完成（agentOp handler 内部通过 `ctx.storage.put()` 上传，state 中存 blob refs）。

`fromRow` 可 async（jupyter / nn-viz 等可能 fetch blob metadata）；不阻塞 txn。

### 7 个 sub-decisions（per §11.3 LOCK）

1. **agentOps opt-in**: plugin 不定义 → 框架 fallback 自动 `set_content`（基于 `contentSchema`）。简单 plugin 无需写 agentOps；复杂 plugin 自定义多 verb
2. **Human + Agent 同 API**: 人类 EditView 编辑 → 本地 React state（零 RPC）→ debounce/blur/save → commit 同一 endpoint → 同一 handler。Agent 直接 RPC 调同 endpoint
3. **agentOp full signature**: 见上
4. **Serializer no streaming**: 大 binary 走 storage；大 text DB driver 自身 handle
5. **Plugin 之间无直接 call**: 跨 plugin 交互通过 `ctx.engine.getBlock()` 读 + agent dispatch 写；**禁止** `getPlugin('other').handler.x()`
6. **Plugin 注册时机**: 显式 startup `createRegistry()`（in `apps/web/src/plugins-init.ts`）

   ```ts
   import { BlockRegistry } from '@skb/block-foundation';
   import { markdownPlugin } from '@skb/plugin-markdown';
   import { codePlugin } from '@skb/plugin-code';
   import { discussionPlugin } from '@skb/plugin-discussion';

   export function createRegistry(): BlockRegistry {
     const reg = new BlockRegistry();
     reg.register(markdownPlugin);
     reg.register(codePlugin);
     reg.register(discussionPlugin);
     return reg;
   }
   ```

7. **Plugin versioning + lazy migration**: 
   - Plugin 含 `version: string` (semver) + `migrations: []`
   - DB `blocks.plugin_version` 列；读 row 时框架检查；如 < current → 跑 applicable migrations → 再 fromRow；下次 toRow write 更新 version
   - Patch / minor → 必 backward compatible
   - Major → 必提供 migration step

### 不在 Day-1 contract（向后兼容 add Phase 2+）

- Lifecycle hooks (onInsert / onDelete / onMove / onResize): 反应链失控；Phase 2+ 通过 EventBus capability `ctx.subscribe()` 加
- Delta return: Day-1 always return full BlockState；Phase 2+ delta option
- Optimistic concurrency (expectedVersion in args): plugin 可自定，framework 不内置
- ReadOps (plugin-specific 分页 read): 标准 GET endpoint Day-1 足够；Phase 2+ 加 `readOps` 字段

### Known gaps / future ADR markers

本 ADR 锁定了 Day-1 BlockPlugin contract 的字段集，但有一处**已知 gap**：

**Plugin sidecar schema / migration carrier — intentionally deferred**

- 上方 `migrations` 字段 (`Array<{ fromVersion, toVersion, migrate: (row: DbRow) => DbRow }>`) 仅承担 **row-level content migration**（props_json / content_inline 内 shape 变化），**不**承担 sidecar **schema DDL migration**（如 `CREATE TABLE discussion_posts` / `ALTER TABLE` 等）
- `contentStorageHint: 'sidecar-table'` 是 plugin 声明 hint，但 contract **没有字段**让 plugin 携带其 sidecar 表的 DDL / schema migrations
- 这是有意 defer 的 gap —— Day-1 没有 lived implementation pressure，趁现在 lock carrier 易自造约束（详 ADR-0002 §sidecar tables）

**Blocker invariant（mechanism-driven）**：第一个需要 sidecar tables 的 plugin —— 不限定 discussion / nn-viz / kernel-session 中哪个先到 —— 在写第一行 sidecar DDL 之前，**必须通过 follow-up ADR 或综合 architecture synthesis 锁定 carrier mechanism**。具体待 lock 的内容：DDL 文件位置约定、Drizzle multi-dialect 路径、framework migration scheduler 集成点、repository access boundary 形态。

详见 ADR-0002 §"Plugin sidecar tables" / "Carrier mechanism — intentionally deferred"。

## Consequences

**Positive**:
- 单一 contract 表达所有 plugin（10 内置 + 第三方）
- agentOp signature 对齐 LLM tool use 业内标准
- Versioning 内置 → plugin marketplace evolution 不破老 row
- Capability ctx 为 sandbox（ADR-0011）留 hook

**Negative / Trade-offs**:
- Contract 较大（17+ fields）；plugin author 需要时间消化
- 部分字段（multiAuthor / realtimeChannel）只少数 plugin 用；optional 字段防 over-spec
- Versioning + migration array → plugin author 责任 + 测试负担

**Risks**:
- 新 plugin 误写 toRow 异步 → 通过 TS type signature 静态拦截 + framework runtime warn
- Plugin 越界访问 capability（如 fs without `permissions: ['fs']` declare）→ Phase 3 sandbox enforce；Day-1 trust built-in

## Alternatives considered

- **Sync handler only (no async)**: 限制 storage / search / LLM call use case；rejected per ADR-0005 agent semantic API
- **Plugin 之间允许 direct call**: 引入隐式依赖图；rejected per ADR-0004
- **Module-load auto register**: 污染 import side-effects；rejected per explicit startup register
- **No versioning Day-1**: Plugin breaking change 不可控；rejected per ADR-0004 marketplace future
- **Throw instead of Result type**: expected error 难区分 unexpected；rejected per discipline

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.3 + §4.3
- Related ADRs: ADR-0004 (plugin extension model), ADR-0005 (agent semantic API), ADR-0007 (storage ctx), ADR-0008 (search ctx + extractPlainText), ADR-0011 (sandboxing + permissions/runtimeIsolation hooks)

## Changelog

- 2026-05-13 initial draft (decision LOCKED 2026-05-13 in source DI doc post 7 sub-decision pass)
- 2026-05-16 external review (via ADR-0002 pass 3): gap noted —— Day-1 BlockPlugin contract 不携带 plugin sidecar schema / migration carrier 机制；新增 "Known gaps / future ADR markers" body 段 + blocker invariant（first sidecar plugin 实装前必须通过 follow-up ADR 锁定 carrier）；ADR-0002 / ADR-0014 互相 cross-ref。Body 修改在 proposed 阶段进行（accept 前 refine wording 不违 append-only —— append-only 绑 `accepted` 状态）
