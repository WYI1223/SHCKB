# ADR-0015: Agent wire protocol — MCP + SKILL.md 双层 + REST + SSE

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.4 |

## Context

Agent + human UI 共享 backend（ADR-0005）；需要 wire protocol cover：
- LLM agent dispatch（external IDE / Claude.ai / ChatGPT / 等 → 我们 server）
- Human UI 调 agentOp（REST）
- Server → client push（discussion new comment 等）

User push back gatekeeper 初次 MCP 评估："MCP 协议更新慢，各家私有是常态，skills 更广泛，更通用，占用上下文少"。Researcher subagent dispatch 后 2026-05-13 真实生态找到：

- MCP 2025-12 捐 Linux Foundation AAIF；写一份 MCP server 跨 Claude (Desktop/Code/.ai) / ChatGPT (Apps SDK + Responses API hosted MCP) / Cursor / Gemini CLI / VS Code / Cline / Zed / Continue / Codex / Goose 等 32+ client 接入
- MCP 迭代实际慢（2025-11-25 spec 后只 MCP Apps + Code execution 两扩展）
- Skills 同期 32+ client 接入 + ~89k skills marketplace
- **MCP + Skills 互补不互斥**：MCP = "what"（data + actions + network protocol）；Skills = "how"（procedural knowledge + progressive disclosure；不是 network protocol）
- OpenAI Responses API 原生支持 remote MCP server；Gemini SDK built-in MCP
- OAuth 2.1 + PKCE + RFC 8707 + HTTPS 是 public MCP server 强制要求（2025-06 spec update）
- Code execution with MCP pattern (Anthropic 2025-11) Drive→Salesforce 案例 token 150k → 2k (98.7% 降低)

## Decision

### Wire protocol stack：5 tier

```
Tier 1 — REST (§11.12 / ADR-0009)
  浏览器 human UI 主路径 (cookie session + CSRF)
  浏览器内 AI assistant path (a) 通过 REST/SSE 调
  Auto OpenAPI gen 供不支持 MCP 的 client 读

Tier 2 — MCP server (universal LLM client 接入)
  Transport: Streamable HTTP (单 endpoint，stateless-capable，替代旧 HTTP+SSE)
  Auth: OAuth 2.1 + PKCE + RFC 8707 Resource Indicators，HTTPS mandatory
  Endpoint: https://<operator-domain>/mcp
  Server primitives:
    - tools  = plugin agentOps 投影
    - resources = block / note URI-addressable read access
    - prompts (optional) = 预设 system prompts
  Self-hosted instance 自当 OAuth issuer (reuse 平台 user auth)

Tier 3 — SKILL.md companion (progressive disclosure)
  形态: skills/<product>/SKILL.md + YAML frontmatter + Markdown body + bundled scripts
  三层 disclosure: metadata ~100 words 常驻 / body 触发后加载 / bundled 按需
  解决 "MCP tool list 全注入 context → 准确率掉" 已知问题
  32+ skill-aware client 自动 lazy-load
  **augment** MCP 不替代它

Tier 4 — SSE (server → client push)
  独立 endpoint: GET /api/sse/subscribe?channel=...&token=...
  用于: discussion 新评论 / 通知推送 / server-side AI assistant 响应流
  MCP Streamable HTTP transport 内部已自带 SSE，复用相同基础设施

Tier 5 — WebSocket
  Day-1 不要
  Phase 2+ 协作 (CRDT) / 多用户实时编辑场景再开
```

### 双路径 (a) + (b) 形态

| Path | Wire protocol | LLM 位置 |
|---|---|---|
| (a) In-app AI assistant | REST + SSE (浏览器 ↔ server)；server 内部 in-process 调 agentOps | Server 用 LLMProvider 调外部 LLM API（operator config 选 Anthropic/OpenAI/Ollama/Together/Groq） |
| (b) External LLM client | MCP over Streamable HTTP + OAuth 2.1 | Operator 自己的 LLM IDE (Claude Desktop / Cursor / Gemini CLI / etc.) |

两条路径共享 **agentOps registry**；不同 caller 经不同 wire protocol，dispatch 到同一组 plugin handler。

### Zone implication

- Z10 Agent API `packages/agent-api/` 含 MCP server wrapper + OAuth 2.1 provider impl + SKILL.md generator + Streamable HTTP transport handler
- **NEW Z14 LLM Provider** `packages/llm-provider/` multi-adapter（Anthropic / OpenAI / Ollama / Together / Groq）—— path (a) 用

### Phase 2+ 演进

- **MCP Apps (SEP-1865)** → canvas block 渲染到 chat 里（双沙箱 iframe + postMessage）；composes on existing MCP tools
- **Code execution pattern** → 给 LLM 写 TS 调 MCP API client，不塞全部 tool 定义；上下文成本降两个数量级
- 监控 A2UI / 其他 alt 协议

## Consequences

**Positive**:
- 写一份 MCP server 跨 32+ LLM client universal 接入；零 vendor 适配
- SKILL.md progressive disclosure → context-efficient；不被 50+ agentOp 撑爆
- OpenAI Responses API + Gemini SDK 自动 work（MCP native support）
- OAuth 2.1 mandatory → 自托管 instance 安全 baseline 强
- Tier 1 REST 仍是 human UI 主路径；不混淆

**Negative / Trade-offs**:
- 多 protocol facade 增加 implementation 范围（vs single API）
- OAuth 2.1 provider impl 是 packages/agent-api 大 chunk 工作
- LLM Provider 抽象 + 多 adapter 维护
- SSE 比 WebSocket 半双工；某些 realtime 场景未来需要 upgrade（Phase 2+ 协作时）

**Risks**:
- MCP spec 演化破坏 backward compat；mitigate by `@modelcontextprotocol/sdk` pin + 跟 working group changelog
- OAuth provider 自实现 bug 风险；mitigate by 复用 community library（如 lucia-auth 或类似）
- SKILL.md spec 不稳（无版本号）；mitigate by hold reference impl + 按 anthropics/skills repo 跟进

## Alternatives considered

- **自卷 wire protocol**: pre-MCP 时代私有协议；rejected per ecosystem alignment
- **GraphQL**: 不 LLM-tool-native；rejected per agent integration shape
- **gRPC**: browser 不 native；overkill；rejected
- **Single Anthropic SDK / OpenAI SDK adapter**: vendor lock；rejected per multi-LLM operator choice
- **Skills replace MCP**: misunderstanding（Skills 不是 network protocol）；rejected per research
- **MCP replace Skills**: 失去 progressive disclosure；rejected per context efficiency
- **WebSocket Day-1 强制**: 半双工 SSE 已 cover Day-1 push 需求；rejected per YAGNI

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §11.4
- Researcher dispatch 2026-05-13: extensive source links (MCP spec / AAIF / Anthropic Skills / OpenAI Responses / etc.)
- Related ADRs: ADR-0005 (agent semantic API), ADR-0006 (Bun + Hono backend stack), ADR-0009 (REST style), ADR-0012 (OpenAPI gen), ADR-0014 (plugin contract + agentOps shape)
- External:
  - MCP spec 2025-11-25: https://modelcontextprotocol.io/specification/2025-11-25
  - Anthropic Skills repo: anthropics/skills
  - MCP TypeScript SDK: @modelcontextprotocol/sdk
  - Linux Foundation AAIF (2025-12-09)
  - OAuth 2.1 + PKCE + RFC 8707

## Changelog

- 2026-05-13 initial draft (decision LOCKED 2026-05-13 post researcher dispatch; supersede gatekeeper initial mis-evaluation of MCP vs Skills)
