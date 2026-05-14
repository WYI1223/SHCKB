# ADR-0005: AI agent semantic API — agentOps as block-scoped LLM tool use

| Field | Value |
|---|---|
| Status | accepted |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §5 + §11.3 |

## Context

旧 spec 假设 "AI 友好：内容是 MDX 文件，agents 可直接 Read/Edit"。Framing 复盘暴露这条把"agent 编辑内容"误等同于"agent 读 disk file"，污染上下文 + 失去 semantic API 设计自由度。

需要定义 AI agent 访问 + 操作 block 的 first-class API surface，独立于 disk format。

User 元 reframe (2026-05-13)："本质上似乎就是 tool use 的不同 block 版本的 patch" —— **agentOps = LLM tool use 模式 scoped 到 plugin kind**。

## Decision

**agentOps = plugin 暴露的 block-scoped LLM tool definitions**；统一 dispatch endpoint；human UI 和 LLM agent 走**同一组 endpoint + 同一组 handler**。

### 一一对应 LLM tool use SDK

| Anthropic / OpenAI tool use | 我们的 agentOps |
|---|---|
| `tool.name` | agentOp's map key |
| `tool.description` | `AgentOpDefinition.description` |
| `tool.input_schema` (JSON Schema) | `AgentOpDefinition.argsSchema` (zod → JSON Schema) |
| Tool execution callback | `AgentOpDefinition.handler` |

详细 signature 见 ADR-0014。

### 同一 backend，多 caller 路径

```
Human UI    ─→ REST POST /api/notes/<slug>/blocks/<id>/op/<opName>
LLM agent   ─→ MCP tool/call (详 ADR-0015)
                    ↓
            ┌─────────────────────────┐
            │  agentOp handler          │
            │  (in plugin package)     │
            └─────────────────────────┘
```

Plugin 写一次 handler；两类 caller 共用。

### Discoverability

- `GET /api/agent/schema` → dump 所有 plugin 的 agentOps registry（含 description + input_schema）→ LLM 直接看到所有可用 tools
- MCP `tools/list` 同源 dump

### Plugin opt-in

- 简单 plugin（markdown / math）**不写** agentOps → 框架 fallback 自动 `set_content`（基于 contentSchema）
- 复杂 plugin（discussion / jupyter / nn-viz / agent-flow）显式定义多个 verb

### Agent 永远不见

- File paths / directory tree / DB schema / SQL query / row IDs
- 只见 plugin-native semantic verbs（如 `create_post` / `execute_cell` / `set_tex`）

## Consequences

**Positive**:
- 复用 LLM tool use 生态（Anthropic SDK / OpenAI Function calling / MCP / 任何 schema-driven LLM）
- 一份 plugin handler 服务多类 caller；DRY
- Plugin-native vocabulary 提升 LLM 操作的语义准确度
- 协议层独立 package (`packages/agent-api/`) → 未来 desktop / CLI / 第三方 client 复用

**Negative / Trade-offs**:
- Plugin 作者需要为复杂 verb 设计 args schema（template-like 但有学习成本）
- 简单 plugin "ovwrite content" use case 默认 fallback 解决，但 plugin author 仍需理解 contract 存在

**Risks**:
- LLM tool list 注入 context 量随 plugin 数量线性增长 → 通过 SKILL.md progressive disclosure 缓解（详 ADR-0015）
- 错误 args 让 plugin handler 失败 → 通过 zod runtime validate 在 dispatch 入口拦截

## Alternatives considered

- **Generic "set block state" endpoint**: agent 必须知道 plugin 内部 row shape → 违反 §5 "agent 不见 DB schema"；rejected
- **每 plugin 独立 RPC service / 进程**: 隔离好但 plugin 间集成复杂；rejected per Day-1 inline runtime（ADR-0011）
- **GraphQL agent API**: schema-driven 优势但 LLM tool use 生态偏 OpenAPI / JSON Schema；rejected per ecosystem alignment
- **Custom WebSocket protocol**: 自卷 wire；rejected per ADR-0015 MCP adoption

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §5 + §11.3
- Related ADRs: ADR-0004 (plugin model), ADR-0014 (plugin contract details), ADR-0015 (wire protocol), ADR-0012 (OpenAPI gen)

## Changelog

- 2026-05-13 initial draft + accepted (LOCKED 2026-05-12 in source DI doc; reframe to tool-use 2026-05-13)
