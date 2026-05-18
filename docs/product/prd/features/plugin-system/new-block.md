# Feature PRD: New block extension

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-18 |
| Owner | W_YI |
| Parent PRD | [plugin-system.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

## Overview

Block extension = **author 写一个新 block kind**，让它出现在 notepage 上可被 insert / edit / render。每个 block kind 是一个独立 plugin module，声明自己的 EditView（怎么编辑）/ RenderView（怎么展示）/ defaultSize（推荐大小）/ agentOps（AI 怎么操作）/ 等。

本 PRD 锁的是 **block extension author 视角的 user-observable WHAT**：author 怎么从零写一个 block / 怎么用 contract / 怎么 fork built-in block 作起点 / 跨 block kinds 的 user 体验一致性。

不锁：BlockPlugin contract 字段（归 [ADR-0014] HOW）、sandbox 实现（[ADR-0011]）、API endpoint shape（[ADR-0009]）、注册时机内部机制（[ADR-0014]）。

不锁 user（note author）视角的 block 体验 —— block 出现在 notepage 上的 user-observable 行为已 cover 在 [notepage-editing.md] / [notepage-view.md]。

## User stories（block extension author）

- As a **block author**, I want to **声明一个 new block kind X**（kind string + version + propsSchema + contentSchema），so that **framework 能识别 + 持久化 X 类型 block**
- As a **block author**, I want to **提供 EditView 和 RenderView 组件**，so that **user 在 notepage 上能编辑和阅读这个 block**
- As a **block author**, I want to **声明 defaultSize**（默认放置时的 colSpan × rowSpan），so that **user insert 时 hole-fill 用正确尺寸**
- As a **block author**, I want to **声明 agentOps**（AI 怎么用 RPC 操作这个 block），so that **AI agent 能 manipulate 这个 block**
- As a **block author**, I want to **fork 一个 built-in block 作起点**（copy markdown plugin → 改成 my-custom-prose），so that **不必从零理解整 contract**
- As a **block author**, I want to **声明 contentStorageHint**（inline / sidecar-table / blob），so that **framework 知道我的 content 怎么存**
- As a **block author**, I want to **写 migration** 让旧版本 row 自动升到新版本，so that **plugin upgrade 不丢 user data**
- As a **block author**, I want to **声明需要的 capability**（如 storage / search / engine read），so that **sandbox 准确允许**

## Functional requirements

### Must (Day-1, M2) — Day-1 milestone scope（align project roadmap）

- **M2 ship scope**：markdown plugin **完整 E2E** + registry 能 register 多 plugin（其他 8 built-in 可以 stub register 但完整实装在 M3/M4）；align [project.md] M2 = "login → markdown block → public view"
- **Roadmap target catalog**（9 built-in block kinds；分布在 M2/M3/M4 渐进 ship；per frozen DI [grid-redesign-2026-05-11.md] §6）：
  - **M2 complete**: markdown
  - **M3 5 light**: markdown + image / code / callout / math (具体清单与 [plugin-system.md] M3 align)
  - **M4 9 full**: + pdf / jupyter / nn-viz / agent-flow (heavy plugins)
- **Closed registry Day-1**：framework 启动时 explicit register（详 [ADR-0014]）；第三方 plugin 不能 runtime install
- **每个 built-in block plugin 是完整 TS module**：author 可读、可 copy、可 fork

### Must (Day-1, M2) — Extension author surface

- **每个 block plugin 必须声明**:
  - `kind: string` —— open identifier（per [ADR-0003] induction 3 kind-opaque；[ADR-0004]）
  - `version: string` —— semver
  - `propsSchema` / `contentSchema` —— zod schemas（per [ADR-0014]）
  - `defaultSize` —— `{ colSpan, rowSpan }`
  - `EditView` / `RenderView` —— React components
  - `serializer.{toRow, fromRow}` —— DB ↔ block state 转换
- **每个 block plugin 可选声明**:
  - `agentOps` —— AI tool use operations（per [ADR-0005]）
  - `migrations` —— version 升级 row migration
  - `permissions` —— capability declarations（per [ADR-0011]）
  - `extractPlainText` —— search index helper（per [ADR-0008]）
  - `contentStorageHint` —— inline / sidecar-table / blob
  - `paletteEntry` —— 在 palette UI 显示信息
  - `slashEntries` —— slash command 触发
- **跨 block 一致性**：插任意 block kind 后 user-observable 行为在 [notepage-editing.md] / [notepage-view.md] 一致

### Must (Day-1, M2) — Authoring path

- **Fork path**：author 复制一个 built-in plugin 模块（如 `packages/plugin-markdown/`）作起点
- **Compose path**：author import a built-in plugin 对象 + override 部分字段（spread + override pattern）
- **From-scratch path**：author 直接 implement BlockPlugin interface 写新 plugin
- 三条 path 都被 contract 支持；author 选哪条由 use case 决定

### Should (Day-1 if scope allows)

- **Author CLI helper**：scaffolding command 自动生成 plugin 框架（如 `pnpm create skb-plugin --kind=mywidget`）—— 详 Open questions
- **Plugin debug UI**：framework dev mode 显示注册 plugin 列表 + 状态

### Nice-to-have (Phase 2+)

- **Plugin marketplace** —— browse / install third-party block plugin
- **Plugin sandboxing 强化** —— per [ADR-0011] worker / WASM 路径
- **Plugin discovery via npm** —— scan `package.json` keywords 自动 register
- **Block kind inheritance**（official base class for derivatives）—— 当前是 fork-friendly，没承诺 inheritance chain

## Out of PRD scope (HOW / ADR / 实现层)

| Concern | 归哪 |
|---|---|
| BlockPlugin contract 字段集精确定义 | [ADR-0014] |
| Plugin registry 内部数据结构 | [ADR-0014] / framework code |
| Sandbox 实现机制（inline / worker / wasm） | [ADR-0011] |
| Plugin migration 调度算法 | [ADR-0014] |
| Per-block agentOps wire protocol | [ADR-0005] / [ADR-0015] |
| Plugin author CLI 实现 | runbook / dev tooling |
| Plugin DB schema 影响 | [ADR-0002] |

## Non-goals

- ❌ **Theme extension** —— 归 [theme-system-author-view.md]（cross-folder horizontal subsystem）
- ❌ **Operator-pluggable adapter**（storage / search / backup）—— per [plugin-system.md] scope；不是 plugin
- ❌ **Block 内部 prose-flow 编辑细节**（如 markdown 怎么 wysiwyg）—— 归 [ADR-0013] / 各 plugin EditView 内部
- ❌ **第三方 block plugin Day-1 ship** —— Day-1 9 built-in；第三方 Phase 2+
- ❌ **Block kind 命名规范 / namespacing**（如 `@vendor/my-block`）—— Phase 2+ 加 plugin discovery 时再 lock
- ❌ **Plugin 版本管理 / 升级 UI** —— Day-1 跟 framework 一起 deploy；plugin upgrade 走 redeploy；Phase 2+ 加独立升级机制

## Acceptance criteria

### M2 acceptance

- **Markdown plugin 完整 E2E work**：author 视角 contract 清晰 + Day-1 user 视角 insert / edit / render / save / reload work（端到端 demo path；align [project.md] M2 = "login → markdown block → public view"）
- Registry 能 register 多 plugin；其他 8 built-in block 可以 stub register 但完整实装在 M3/M4（reviewer Finding 1 修订）
- BlockPlugin contract 形态稳定（与 [ADR-0014] align）；**L3 third-party contract Day-1 reserved 不 M2 lock**

### M3 acceptance

- **5 light block kinds 完整 work**（markdown / image / code / callout / math 等；具体清单与 [plugin-system.md] M3 align）
- agentOps 跨 5 kinds work（AI 能 manipulate）
- Plugin author 文档完整

### M4 acceptance

- **9 built-in block kinds 全 work**（M3 5 light + M4 4 heavy：jupyter / nn-viz / agent-flow / pdf 等）+ 跨 5 deploy mode 验证
- Plugin lazy migration baseline shipped

### Phase 2+

- 第三方 plugin discovery + install
- Plugin marketplace

## Edge cases

| 场景 | 期望行为 |
|---|---|
| Plugin 声明 invalid kind name（含特殊字符 / 跟 built-in 冲突）| Register 失败 + 明确 error |
| Plugin EditView 抛 exception | Sandbox 隔离 + block 显示 "render error" 占位 + 其他 block 不受影响 |
| Plugin RenderView 渲染慢 | Lazy render + skeleton + loading indicator |
| Plugin version 升级 + migration 失败 | 回滚到旧版本 + plugin 标 error；data 不动 |
| 卸载 plugin 但 user notepage 有此 kind 的 block | Block 显示 "requires plugin X (uninstalled)" + 提示重装或导出 |
| Plugin 声明 capability 超出 sandbox 允许 | Register 失败 + 提示降低 capability 或申请升级 sandbox tier |
| 两个 plugin 注册同 kind | Register 失败（first wins / error 视 framework 决定）|

## Dependencies

PRD 层 upstream 依赖（ADR 是 downstream，归 References 段）：

- **Parent PRD**: [plugin-system.md](./plugin-system.md)
- **Sibling PRDs**: 无（plugin-system Day-1 仅 block sub-PRD；theme 见 cross-folder）
- **Cross-folder（同级 horizontal subsystem）**:
  - [theme-system-author-view.md](../theme-system/theme-system-author-view.md) —— theme author 视角（与本 PRD block author 视角对偶）
- **Other feature PRDs**:
  - [notepage-editing.md](../notepage/notepage-editing.md) —— block 在 edit mode 的 user view
  - [notepage-view.md](../notepage/notepage-view.md) —— block 在 view mode 的 user view
  - [authentication.md](../authentication/authentication.md) —— `ctx.user` 桥接（block plugin 通过 capability ctx 拿当前 user identity；per [ADR-0011] capability ctx 只读契约；ctx.user 是 immutable Value Object）
- **External services**: 无 Day-1 外部依赖

## Open questions

1. **Plugin author CLI Day-1 ship?** `pnpm create skb-plugin --kind=X` scaffolding；倾向 Should（M2 ship 简化版 + M3 polish）
2. **9 built-in block plugin 拆 separate packages 还是 monorepo 单 package?** 拆 separate 利于 fork（author copy 一个目录即可）；单 package 维护简单。倾向拆（per frozen DI 暗示）
3. **Built-in plugin discoverable to author?** 即 author 是否能 import a built-in plugin 来 compose？还是 built-in 是 framework-internal？倾向"可 import 用于 fork / compose"（不然 fork path 不成立）
4. **Plugin author 文档归 PRD 还是 runbook?** 当前 PRD 是 WHAT；author 详细 how-to 走 runbook（如 `engineering/runbooks/plugin-author-guide.md` 待 M3 写）

## Surfaced ADR debts

- **[ADR-0004] framing 限 block**: 本 PRD 是 plugin-system 一条 sub-PRD（block extension），但 [ADR-0004] 当前名字 "Block plugin extension model" 隐含 plugin = block；reframe 到 generic extension model 后，本 PRD 是 "block specialization"。**Action**: audit round 2 时考虑 reframe [ADR-0004] 名字 / scope；详 [plugin-system.md] surfaced debts
- **[ADR-0014] BlockPlugin contract 字段集合理性**: Day-1 17+ fields；audit round 2 时 verify 跟本 PRD user stories align 不漏 / 不冗。**Action**: audit time
- **Plugin sidecar carrier 仍 TBD**: per [ADR-0002] sidecar carrier intentionally deferred；本 PRD `contentStorageHint: 'sidecar-table'` 提到 sidecar pattern 但没拍 carrier。**Action**: first sidecar plugin（discussion 等）实装前必须开 carrier ADR；已在 AUDIT

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，**必须 align 本 PRD**。任何 ADR ↔ PRD 不一致 → ADR rework（详 [AUDIT-2026-05.md] 流程）。

- **Aligning ADRs**:
  - [ADR-0004](../../../../engineering/decisions/ADR-0004-block-plugin-model.md) — extension model（block specialization）
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — BlockPlugin contract details
  - [ADR-0005](../../../../engineering/decisions/ADR-0005-agent-semantic-api.md) — agentOps signature
  - [ADR-0011](../../../../engineering/decisions/ADR-0011-sandboxing-evolution.md) — sandbox capability
  - [ADR-0002](../../../../engineering/decisions/ADR-0002-substrate-db-backed.md) — blocks table + sidecar pattern
- **Frozen DI**: [grid-redesign-2026-05-11.md](../../../../engineering/design/_frozen/grid-redesign-2026-05-11.md) §6 defaults table
- **Audit**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft；Phase E Day-1 PRD #2 sub-PRD；block extension 作为 plugin-system 的 specialization；与 [new-theme.md] 平级；user-observable block 行为归 notepage/* PRDs
- 2026-05-16 **pass 2 — theme-system 抽离独立 folder**：原 sibling [new-theme.md] 已 git mv 到 [theme-system/theme-system-author-view.md]（cross-folder horizontal subsystem）；本 PRD 现在是 plugin-system 内唯一 Day-1 sub-PRD；refs to new-theme 重写为 theme-system-author-view
- 2026-05-17 **pass 3 — authentication PRD round 2 触发的 cross-ref 简化**：去 AuthProvider extension type 类比（AuthProvider 不是 plugin extension type，是 operator-pluggable adapter；详 [authentication.md] + [auth-setup-2026-05-17.md discussion record](../../../../engineering/design/discussions/auth-setup-2026-05-17.md) A1）；本 PRD cross-ref 只留 `ctx.user` 桥接（block plugin 通过 capability ctx 拿当前 user identity）
