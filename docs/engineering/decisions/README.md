# Architecture Decision Records (ADRs)

**Append-only** decision records。锁定后内容不改；变更走 supersede 机制。

> **GLOBAL DEPRECATION NOTICE (2026-05-23)**: ADR-0001 through ADR-0018 are deprecated legacy drafts. They are retained for historical trace only and MUST NOT be used as authoritative sources for product behavior, architecture, implementation planning, or technology-stack selection. All future technology choices must be derived from current PRDs and product shape, then captured in new PRD-informed ADRs.

## 规则

详见 [adr-discipline.md]（footer 含 link）。摘要：

- ❌ 不修改已 `accepted` 的 ADR（除 metadata 类 status 更新）
- ✅ 变更决策 → 新 ADR with `Supersedes: ADR-XXXX`；旧 ADR 改 status 为 `superseded`，加 link 到新 ADR
- ❌ 不删除（即使 superseded，保留作历史）
- ✅ Status field 可改（proposed → accepted → superseded → deprecated）；其他字段冻结
- ✅ 编号 append-only：新 ADR 取下一个号；不复用 deprecated 号

## Template

每个 ADR 形态见 [adr-discipline.md]。基本结构：

```markdown
# ADR-XXXX: <title>

| Status | proposed / accepted / superseded / deprecated |
| Date | YYYY-MM-DD |
| Authors | <name> |
| Supersedes | ADR-XXXX (if any) |
| Superseded by | ADR-XXXX (if any) |
| Source DI doc | engineering/design/_frozen/<file>.md §<section> |

## Context
## Decision
## Consequences
## Alternatives considered
## References
```

## ADR Index

**Global status (2026-05-23)**: ADR-0001..0018 全部标记为 `deprecated (legacy draft; PRD-rework required)`。旧 ADR 只作为 history / discussion trace；不得作为技术栈选择依据。后续 ADR 必须在 PRD 完成后，从当前产品形态重新推导并重新 ratify。

Historical owner review findings（仅作 trace，不构成当前决策依据）：

- [ADR-0017] 是 owner review [ADR-0002] 时新增（backup 从 substrate 剥离成独立 pluggable concern）
- [ADR-0001] owner review pass 1 (2026-05-14) 指出原稿是 product vision 不是 decision → product 定义剥离到 [project.md]；[ADR-0001] reframe 为真正决策 "canonical deployment artifact"
- [ADR-0001] external review pass 2 (2026-05-16) 把 "canonical / secondary 二分" 细化为 **3-tier support 模型**（Canonical / Full-parity secondary / Supported-with-constraints）；标题 `Docker image` → `OCI container image`；installer 机制剥离到新增 [ADR-0018]
- [ADR-0018] 是 [ADR-0001] pass 2 review 时新增（install bootstrap 从 build artifact 决策剥离成独立 concern；承接 frozen DI §11.11 LOCK）
- [ADR-0003] owner review pass 2 (2026-05-16) reframe 为 **architecture-induction-style ADR**（与 [ADR-0001] / [ADR-0002] 同形态）：删除 Public API 函数签名 / OpResult shape / per-kind defaultSize / Constraints 段（下沉到 [grid-engine CONTRACT.md]）；Decision 段重组为 6 条 induction chain。同步：新增 [grid-engine CONTRACT.md] 初版 + contracts/[README.md] 索引页 + [adr-discipline.md] 补 foundational-ADR induction-chain pattern + ADR vs CONTRACT 分工节
- [ADR-0003] friend review pass 2.1 (2026-05-16) kind-opaque 收紧 / leaf vs purity 拆 / target architecture vs carryover transitional / 12-col logical vs render projection / mental-model path 修正 / zod 措辞移除

Audit register 详 [AUDIT-2026-05.md]（footer 含 link）。

| ADR | 主题 | Status | Source frozen DI § |
|---|---|---|---|
| [ADR-0001](./ADR-0001-deployment-canonical-artifact.md) | Deployment — multi-arch OCI container image as canonical artifact | deprecated (legacy draft) | architecture-rebuild §0.6（product 定义剥离 project.md；installer 剥离 ADR-0018）|
| [ADR-0002](./ADR-0002-substrate-db-backed.md) | Substrate: DB-backed + plugin serializer | deprecated (legacy draft) | architecture-rebuild §3 + §6 L1 |
| [ADR-0003](./ADR-0003-grid-engine-contract.md) | Grid-engine layer — constrained canvas 的架构 induction（pass 2 reframe） | deprecated (legacy draft) | grid-redesign + architecture-rebuild §2（contract 下沉至 grid-engine CONTRACT.md）|
| [ADR-0004](./ADR-0004-block-plugin-model.md) | Block plugin extension model | deprecated (legacy draft) | architecture-rebuild §4 |
| [ADR-0005](./ADR-0005-agent-semantic-api.md) | AI agent semantic API（agentOps = block-scoped tool use）| deprecated (legacy draft) | architecture-rebuild §5 + §11.3 |
| [ADR-0006](./ADR-0006-backend-stack.md) | Backend stack（TS + Bun + Hono + Drizzle multi-dialect）| deprecated (legacy draft) | architecture-rebuild §11.7 + §11.8 |
| [ADR-0007](./ADR-0007-storage-abstraction.md) | Storage provider abstraction（local FS + S3-compatible）| deprecated (legacy draft) | architecture-rebuild §11.13 |
| [ADR-0008](./ADR-0008-search-abstraction.md) | Search provider abstraction（SQLite FTS5 + Postgres tsvector + external）| deprecated (legacy draft) | architecture-rebuild §11.14 |
| [ADR-0009](./ADR-0009-api-style.md) | API style: GET + POST collapsed | deprecated (legacy draft) | architecture-rebuild §11.12 |
| [ADR-0010](./ADR-0010-performance-budget.md) | Performance + Lighthouse acceptance（90+ + backend SLO）| deprecated (legacy draft) | architecture-rebuild §11.10 |
| [ADR-0011](./ADR-0011-sandboxing-evolution.md) | Plugin sandboxing evolution（inline → worker → WASM）| deprecated (legacy draft) | architecture-rebuild §11.15 |
| [ADR-0012](./ADR-0012-openapi-gen.md) | OpenAPI gen 链路（zod-first + REST + agent registry split）| deprecated (legacy draft) | architecture-rebuild §5.5 + §11.12 |
| [ADR-0013](./ADR-0013-markdown-tile-editor.md) | Markdown tile editor（Lexical WYSIWYG + DB markdown source）| deprecated (legacy draft) | architecture-rebuild §11.1 |
| [ADR-0014](./ADR-0014-plugin-contract.md) | Plugin contract details（agentOps signature / capability ctx / versioning）| deprecated (legacy draft) | architecture-rebuild §11.3 |
| [ADR-0015](./ADR-0015-agent-wire-protocol.md) | Agent wire protocol（MCP + SKILL.md 双层 + REST + SSE）| deprecated (legacy draft) | architecture-rebuild §11.4 |
| [ADR-0016](./ADR-0016-css-framework.md) | CSS framework（Tailwind 4 + cva + shadcn ui + grid-themes）| deprecated (legacy draft) | architecture-rebuild §11.16 |
| [ADR-0017](./ADR-0017-backup-strategy.md) | Backup strategy（pluggable BackupProvider）| deprecated (legacy draft) | — (owner review of ADR-0002, 2026-05-14) |
| [ADR-0018](./ADR-0018-install-bootstrap.md) | Install bootstrap（single-entry installer + profile selection + config generation）| deprecated (legacy draft) | architecture-rebuild §0.6 + §11.11（external review of ADR-0001, 2026-05-16） |
| [ADR-0019](./ADR-0019-mvp-implementation-baseline.md) | MVP implementation baseline（Bun + Hono + Drizzle/SQLite + React/Vite）| proposed | —（PRD-informed；source = [mvp-scope-2026-06-11.md](../design/discussions/mvp-scope-2026-06-11.md)；deprecation gate 后首个新 ADR）|
| [ADR-0020](./ADR-0020-db-migrations-upgrade.md) | DB migrations + instance upgrade（drizzle-kit generate + 自写 applier + 护栏 + image-tag 升级流）| proposed | —（PRD-informed；source = [mvp2-scope-2026-06-11.md](../design/discussions/mvp2-scope-2026-06-11.md)；承接 setup-time §upgrade）|
| [ADR-0021](./ADR-0021-auth-library-better-auth.md) | Auth library = better-auth as L3 AuthAdapter impl（verify 完成；signup 永禁 + bootstrap 临时实例 + schema 并入 migration 流）| proposed | —（PRD-informed；承接 authentication.md Build/Buy=Buy verify 条件）|
| [ADR-0022](./ADR-0022-blob-storage.md) | Blob storage = content-addressed immutable local-fs（sha256 id + capability-URL trade-off + GC deferred）| proposed | —（PRD-informed；承接 block-image + 两态快照引用稳定性；GC 债已由 ADR-0023 偿还）|
| [ADR-0023](./ADR-0023-export-import-format.md) | Export/import canonical format & 双向格式迁移（确定性导出 + 降级在导出端 + blob 引用契约 + GC）| proposed | —（PRD-informed；source = [mvp3-scope-2026-06-12.md](../design/discussions/mvp3-scope-2026-06-12.md)；承接 setup-time operator 迁移口径）|
| [ADR-0024](./ADR-0024-render-unification-theme.md) | Render unification & theme seam（共享组件静态渲染 + publishedHtml 纯函数 + 实例/逐页主题 + 格式 v2）| proposed | —（PRD-informed；source = [mvp4-scope-2026-06-12.md](../design/discussions/mvp4-scope-2026-06-12.md)；还 mvp2 双渲染器债，plugin-system 前置；"theme = 纯数据" 表述由 ADR-0025 修订）|
| [ADR-0025](./ADR-0025-theme-slots.md) | Theme render slots & surface tokens（theme = tokens + 槽位；几何/视觉分权；动效分层；手帐深度样板）| proposed | —（PRD-informed；source = theme-engine-v2 spec；owner 裁定 token-only 风格化不足）|
| [ADR-0026](./ADR-0026-tool-panel-theme-customization.md) | 工具面板贡献点 & 主题自定义层（module.tools 分权 + ui-kit 控件词汇 + 调色板变体/白名单覆写 + 格式 v3）| proposed | —（PRD-informed；source = [mvp5-scope-2026-06-12.md](../design/discussions/mvp5-scope-2026-06-12.md)；自由调色 rejected；plugin host API 三件套成形）|
| [ADR-0027](./ADR-0027-properties-author-appearance.md) | Selection→Properties 检查器 & 作者级外观轴（壳选项/页面背景/两态外观/格式 v4 + theme registry 解链）| proposed | —（PRD-informed；source = [mvp6-scope-2026-06-12.md](../design/discussions/mvp6-scope-2026-06-12.md)；三自定义轴各就各位）|
| [ADR-0028](./ADR-0028-autofit-gravity-carveout.md) | Autofit grow 在原子编辑会话内挂起 gravity（pushResize 下推原语 + 手势瞬态 carve-out + 提交即压实 invariant + base 快照住 web 控制器）| proposed | —（PRD-informed；source = [2026-06-13-block-autofit-height-design.md](../../superpowers/specs/2026-06-13-block-autofit-height-design.md) §4.4/§9；C5 base-snapshot+re-push 择优；C1/C3/C4 rejected；收窄 CONTRACT invariant 4）|

## 编号约定

- 4 位数字，零填充：ADR-0001 / ADR-0042 / ADR-1000
- 一旦分配，永不复用（即使 deprecated）
- Filename: `ADR-XXXX-<kebab-case-title>.md`
- 编号自然递增；无 "category prefix"（如 ADR-S001 / ADR-T001 等）—— 想分类用 tag / index

## ADR 写作风格

- 简洁：50-150 lines 目标；超 200 line 通常说明 "Context" 太长，搬部分到 frozen DI 或 living doc
- 决策**结论 + 简短 reasoning** 留 ADR；**完整 discussion / 替代方案 trace** 留 frozen DI doc
- Alternatives considered 至少列 2 个被拒选项（不必每个 deep dive；point 到 frozen DI 即可）
- References 必含 source frozen DI 链接
- Cross-reference 风格遵 [doc-conventions.md]（in-text `[bracketed identifier]` citation marker，footer link 集中）

## References

- ADR 写作 method: [adr-discipline.md](../../process/methods/adr-discipline.md)
- Doc cross-reference convention: [doc-conventions.md](../../process/methods/doc-conventions.md)
- Audit register: [AUDIT-2026-05.md](./AUDIT-2026-05.md)
- Project PRD: [project.md](../../product/prd/project.md)
