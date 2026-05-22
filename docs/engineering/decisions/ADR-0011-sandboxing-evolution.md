# ADR-0011: Plugin sandboxing evolution

> **DEPRECATED / LEGACY DRAFT (2026-05-23)**: This ADR is retained only as historical carryover. It MUST NOT be used as an authoritative source for product behavior, architecture, implementation plan, or technology-stack choice. Technology choices must be derived from current PRDs and product shape, then captured in new PRD-informed ADRs. Treat any Decision/Consequences/technology names below as suspect until re-ratified.

| Field | Value |
|---|---|
| Status | deprecated (legacy draft; PRD-rework required) |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.15 |

## Context

Plugin extension model（ADR-0004）开放第三方 plugin 后，安全 / 隔离 / 权限是 first-class concern。但 Day-1 只 ship built-in 10 个 plugins（全 trusted）→ 简化处理。需要 LOCK：
1. Day-1 形态（inline / 无 sandbox）
2. Day-1 contract 留 hook（避免未来 sandbox 引入要破坏 contract）
3. 演进路径（Phase 2 → Phase 3 → Phase 4）作 strategic intent

## Decision

### 4-stage 演进

| Stage | Plugin 来源 | Runtime isolation | Permission system |
|---|---|---|---|
| **Day-1** | Built-in only（仓库 ship 的 10 个）| inline（plugin import 进 server process）| 无；built-in 全权限 |
| **Phase 2** | Operator-installed plugins（operator 自写 + 安装）| inline；trust operator | 无 |
| **Phase 3** | Marketplace 第三方 plugins | **worker thread** (Bun worker / Node worker_threads) per plugin | declare 在 plugin manifest：`permissions: ['db.read', 'db.write', 'network', 'fs', 'kernel']`；server enforce |
| **Phase 4** | 完全 sandbox（恶意 plugin 可控）| **WASM 模块** + capability-based API | strict permission；plugin 不能 access 任何未授权 capability |

### Contract hook（Day-1 写）

```ts
type BlockPlugin = {
  // ...existing
  permissions?: Array<'db.read' | 'db.write' | 'network' | 'fs' | 'kernel'>;
  runtimeIsolation?: 'inline' | 'worker' | 'wasm';  // 默认 'inline' for built-in
};
```

Built-in plugins day-1 全部 `runtimeIsolation: 'inline'`，不 enforce permissions。但**字段存在** = 未来 Phase 3+ 启用 sandbox 不需要破坏性改 contract。

### Capability-based context

详 ADR-0014 plugin `AgentOpContext`。Plugin handler 不直接 import 全局 singleton；通过 `ctx.storage` / `ctx.search` / `ctx.engine` 等访问外部。这是 Phase 3-4 capability-based permission 的 prerequisite。

### Phase 3 worker isolation 具体

Per plugin spawn 一个 worker thread；plugin handler 在 worker 里跑；server 主线程通过 message passing 与 worker 通讯。Worker 没有 direct DB / FS access；需要的 capability 通过 RPC 给 server。

### Phase 4 WASM 具体

Plugin 编译到 WASM（可能源语言 TS → AssemblyScript / Rust）；server 用 WASM runtime (wasmtime / wasmer / Bun WASM) 加载。Capability API 通过 host imports 暴露受限 subset。Plugin 不能 escape WASM sandbox。

### 与 backend stack 关系

Bun + Node 都支持 worker thread + WASM；§11.8 LOCKED Bun + TS 选择不约束 sandboxing 路径。

## Consequences

**Positive**:
- Day-1 简单；built-in 全权限；no overhead
- Contract 字段 forward-compatible；未来加 sandbox 不破坏
- Phase 3 worker 是渐进引入；不需要一次性 WASM 大改
- Operator-installed plugin (Phase 2) 不需要 sandbox（trust）；marketplace plugin (Phase 3+) 强制

**Negative / Trade-offs**:
- Day-1 不能引入第三方 untrusted plugin（marketplace Phase 2+）；clear scope
- Worker / WASM 实施有性能 overhead；trade off vs 安全是 Phase 3-4 才面对
- Capability-based permission system 需要后续设计 + UI（manifest review / install warning / etc.）

**Risks**:
- Day-1 contract 字段不足以 cover 未来 sandbox 需求；通过 Phase 3 evolution design 时 augment contract（new ADR superseding 本 ADR 部分）

## Alternatives considered

- **Day-1 直接 WASM sandbox**: 过度工程；no third-party plugin 不需要；rejected per YAGNI
- **永远 inline (no sandbox plan)**: 限死 marketplace 路径；rejected per future extensibility
- **Process-level isolation (subprocess per plugin)**: 比 worker 重；rejected per Bun worker 已足
- **Iframe / browser-style sandbox**: server-side 不适合；rejected per scope
- **Deno-style permissions (top-down flag)**: 比 capability-based 更粗；rejected per fine-grained 需求

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.15
- Related ADRs: ADR-0004 (plugin model), ADR-0006 (Bun runtime), ADR-0014 (plugin contract details with capability ctx)

## Changelog

- 2026-05-13 initial draft (decision LOCKED 2026-05-13 cascading-confirm: Day-1 hook + strategic intent)
