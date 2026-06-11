# ADR-0019: MVP implementation baseline (runtime / server / data / frontend)

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-11 |
| Authors | W_YI (owner), Claude |
| Supersedes | — |
| Superseded by | — |
| Source | [mvp-scope-2026-06-11.md](../design/discussions/mvp-scope-2026-06-11.md)（PRD-informed；非 frozen DI 推导） |

## Context

MVP build（create / observe / edit vertical slice，详 discussion record D1-D4）需要锁定第一组实装技术选择。[ADR-0001]..[ADR-0018] 已全局 deprecated（2026-05-23 gate）：任何选型必须从当前 PRD 与产品形态推导，不得由旧 ADR / frozen DI / carryover 包选择锚定。本 ADR 是 deprecation gate 之后第一个 PRD-informed ADR；与 [ADR-0006] 结论部分重合，但推导路径独立，[ADR-0006] 维持 deprecated 不复活。

驱动选型的 PRD 约束：

1. **Artifact 形态**：canonical OCI image + full-parity single-binary (tier 2)，Workers tier 3 远期（[self-host-deploy.md]）
2. **Solo NAS 低资源默认**：SQLite / local-fs / 最少运动部件（[self-host-deploy.md] operator profiles）
3. **React 是前端宿主假设**（[block-markdown.md] owner ratified 2026-05-23）
4. **数据 SoT 在 server DB**（[project.md] 核心原则 3）
5. **服务端必须能复验布局不变量**：editing PRD 的 algorithm contract 要求非法 mutation 不落库（[notepage-editing.md]）——前后端共享纯函数 engine 是最低成本路径
6. **Markdown 包选择是 spike 级**，editor replacement boundary 必须保持（[block-markdown.md]）

## Decision

| 层 | 选择 | 主要理由（对应上面约束） |
|---|---|---|
| Runtime + workspace | **Bun**（workspaces, test 用 vitest） | (1) single-binary tier-2 直接由 `bun build --compile` 承接；单工具链覆盖 install/run/bundle |
| Server framework | **Hono** | (1) Workers tier-3 可移植；轻量、middleware 模型承接 PEP seam |
| ORM + DB | **Drizzle + SQLite**（bun:sqlite driver） | (2)(4) Solo NAS 默认形态；Drizzle 多 dialect 留 Postgres 路径（Team VPS） |
| 前端 | **React 18 + Vite** | (3) PRD 假设；Vite 是 React SPA 默认工法；SSR 留待 M2 前再决策 |
| Markdown 管线 | **react-markdown + remark-gfm + rehype-sanitize**（spike 级，可换） | (6) 成熟生态、AST 级 extraction、sanitize 进管线；封装在 block-owned module 后 |
| 共享纯函数 | **`packages/grid-engine`** 同包供 client 交互与 server `validateState` 复验 | (5) monorepo 直接收益 |

适用范围：**MVP baseline**。M2 ship 前需按 PRD acceptance 复审（auth library 选择是独立的 future ADR；本 ADR 不涉及）。

## Consequences

- 全栈单语言 TS；engine 纯函数在 client（交互预览）与 server（落库前复验）跑同一份代码
- Windows host 原生 dev 依赖 Bun for Windows（1.3.14 已装）；CI / compose 路径用 Linux Bun，行为差异由 vitest + compose 验证路径兜住
- 风险：bun:sqlite 与 Drizzle 的耦合 → repository 层保持薄，DB 访问集中单模块；Bun-on-Windows 成熟度 → 内循环遇阻时 fallback Node+pnpm 只影响 dev 工具链不影响产品 artifact
- react-markdown 等包名**不构成产品承诺**：render/extract/sanitize 藏在 markdown block module 接口后，替换不触碰存储与 notepage workflow（[block-markdown.md] replacement boundary）
- carryover grid-engine CONTRACT.md 中 "future ADR-0019-grid-engine" 字样与本编号冲突，lift 时清除（编号 append-only，本 ADR 占用 0019）

## Alternatives considered

1. **Node + pnpm + Fastify/Express** —— 拒绝：single-binary tier-2 无一等承接（pkg/nexe 维护状态差）；工具链部件更多。Node 仅保留为 dev fallback。
2. **Next.js 全栈** —— 拒绝：MVP 无 SSR 需求；框架耦合与 single-binary / Workers 形态冲突；服务端复验 engine 不需要 meta-framework。
3. **无 server（localStorage / file）先行** —— 拒绝：违反数据 SoT in DB 原则；两态 publish 模型是 schema 级决策，绕开 server 即制造一次性架构（违反 "M2 架构不许 disposable"）。

## References

- Source discussion: [mvp-scope-2026-06-11.md](../design/discussions/mvp-scope-2026-06-11.md)
- PRDs: [project.md](../../product/prd/project.md) / [self-host-deploy.md](../../product/prd/features/self-host-deploy/self-host-deploy.md) / [block-markdown.md](../../product/prd/features/blocks/block-markdown.md) / [notepage-editing.md](../../product/prd/features/notepage/notepage-editing.md)
- Reasoning checks: [AGENTS.md](../../../AGENTS.md)
- Deprecated overlap（history only）: [ADR-0006](./ADR-0006-backend-stack.md)
