# Feature PRD: Plugin system (top-level)

| Field | Value |
|---|---|
| Status | draft |
| Last updated | 2026-05-18 |
| Owner | W_YI |
| Parent PRD | [project.md] |

> **ADR reference status (2026-05-18 owner framing)**: 本 PRD 引用的**所有 ADR**（含 [ADR-0001] / [ADR-0002] / [ADR-0003]）均 **pending PRD-driven rework round 2**——遵循 owner framing "需求决定架构，架构决定代码与工期"：Phase E PRD 全完成后 ADR 统一 PRD-informed rework；之前标 REWORKED 的 ADR-0001/0002/0003 也需 PRD-informed 再 audit；ADR-0007/0014/0017/0018 的 partial rework 只是 cross-ADR alignment，**不算 final**。**同步规则**：ADR 改动时必须 grep 全 PRD ADR refs 同步修订，避免 PRD ↔ ADR drift。详 [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md) 2026-05-18 entry。

## Overview

**Plugin system** = 通用 extension framework。Third-party developer 通过 plugin 给产品加新能力 —— block kind / 未来可能更多。

每个 plugin 是一个独立 TS module；声明自己是什么类型的 extension（block / 等）；framework 在启动时 register；运行时通过 capability ctx 访问需要的 resource。

本 PRD 锁的是 **extension framework 整体的 framing + 跨 extension type 的 cross-cutting invariants**。具体 extension type 细节归各 sub-PRD（[new-block.md] / 等）。

**关键 audience split**:

- **Note author / reader 视角**（产品 user）—— 看 features/notepage/* PRDs
- **Extension author 视角**（developer-user）—— 看本 PRD + sub-PRDs

**Reframe note (2026-05-16)**：theme 也是 extension 的一种，但 theme subsystem 因为 scope 大（含 4-layer cascade / L0 hard invariants / presentation layer 责任），抽到独立 horizontal subsystem folder [theme-system/](../theme-system/theme-system.md)。**Plugin-system 跟 theme-system 是平级 horizontal subsystem 关系**（不是 parent-child）。Plugin-system 提供通用 extension framework 机制（lifecycle / capability / sandbox / versioning）；theme-system 是 theme-specific product 视角（cascade + presentation + 3 built-in + a11y baseline）。Theme 作为 plugin extension type 的 lifecycle / register / capability 走 plugin-system contract；theme 自身的 product behavior + cascade 走 theme-system PRD。

## Sub-features

Day-1 cover 一类 extension（block）；theme 作为 horizontal subsystem 见 cross-folder ref。

| Sub-PRD | Extension type | 简述 |
|---|---|---|
| [new-block.md] | Block kind plugin | Author 加新的 block kind（如 markdown / image / nn-viz / 自定 widget）|

**Cross-folder（同级 horizontal subsystem）**：[theme-system.md](../theme-system/theme-system.md) — theme extension type 自身的 product PRD；走 plugin-system 通用 lifecycle / capability，但 cascade + presentation 责任在 theme-system folder。

未来可能的 extension type（owner-driven 加 sub-PRD 或独立 folder，**不**预写）：keyboard binding plugin / gesture plugin / palette form factor plugin / export adapter / import source / AI provider / etc.

**注意**：**Auth subsystem 不走 plugin extension type pattern**——它走 **4-layer abstraction**（L1 Auth subsystem + L2 AuthAdapter interface = SHCKB-owned stable；L3 AuthAdapter implementation 跟 storage/search/backup adapter 一个 pattern；L4 provider options 是 operator config）。详 [authentication.md] cross-cutting invariants 段 4-layer diagram + [auth-setup-2026-05-17.md discussion record](../../../../engineering/design/discussions/auth-setup-2026-05-17.md) Section F（terminology sharpen）+ Section G（cross-subsystem modular pattern symmetry）。Plugin-system 跟 authentication subsystem 通过 `ctx.user`（capability ctx 字段，per [ADR-0011]）协同；不通过 plugin extension type。

## Plugin vs operator-pluggable（关键 scope 边界）

**Plugin** ≠ **operator-level pluggable adapter**。Day-1 容易混淆，要明确区分：

| | Plugin（本 PRD 范围）| Operator-pluggable（**不**在本 PRD）|
|---|---|---|
| 例子 | new block kind / new theme | storage provider / search provider / backup provider / **AuthAdapter implementation (L3) + provider options (L4)**（Day-1 username-password；future OAuth / WebAuthn / OIDC as operator-enabled provider options）|
| Audience | third-party developer | operator at deploy time |
| 选择时机 | 运行时 register；user 可启用 / 禁用 | Deploy / install 时 env var 配置；运行时不切换 |
| 切换机制 | Plugin module 加载 / 卸载（register / version / migration / disable / fallback；runtime；**不**走 export-redeploy-import） | **分层**（per 2026-05-17 reviewer post-6a95eaa catch；详 discussion record Section G follow-up）：(a) **L4 option add / enable**（如新加 OAuth provider option / 切 storage local-fs → S3）→ operator config + redeploy；新选项与既有 **co-exist**；**不**触发 export-redeploy-import；(b) **L3 replacement**（如 AuthAdapter implementation 整换 / DB engine 整换 / 完整 provider model 替换）→ 才进入 export → redeploy with new config → import / migrate / link users **migration workflow** |
| 谁负责 | extension author 写代码 | operator 部署时选；adapter 内置 |
| Day-1 状态 | closed registry（内置 9 block / 3 theme），Phase 2+ 第三方加入 | closed adapter set；operator config 选 |
| PRD 归属 | features/plugin-system/ | [self-host-deploy.md] + [authentication.md]（auth provider 归 authentication subsystem 而非 self-host-deploy） |
| ADR 归属 | [ADR-0004] / [ADR-0014] / [ADR-0011] | [ADR-0007] / [ADR-0008] / [ADR-0017] / [ADR-0018] / future auth library selection ADR |

**判定**："这个东西能不能 runtime 热切换" → 能 = plugin；不能 = operator-pluggable。**注意**：operator-pluggable 内**不是所有变更**都走 export-reinstall-import；只有 L3 replacement（整换 adapter / backing implementation / 完整 provider model）才走，L4 option add / enable 是 config + redeploy + coexist（per discussion record Section G follow-up）。

## Cross-cutting invariants

跨所有 extension type 的不变量。**任何 sub-PRD 都不能破这些**：

| Invariant | 含义 | 源 |
|---|---|---|
| **不破 algorithm core** | Plugin / theme 不能改 GridState 内部 / 12-col logical / Option A gravity / AABB no-overlap | [ADR-0003] inductions |
| **不替代 data SoT** | Plugin 不绕开 DB 写自己的 storage；走 framework 的 storage provider | [ADR-0002] |
| **运行 in sandbox** | Plugin 通过 capability ctx 访问 resource（storage / search / engine read-only / 等）；不能直接 fs / network | [ADR-0011] |
| **Lifecycle 一致** | 所有 extension type 共享 register / version / migration / unload 形态 | [ADR-0014] |
| **Plugin churn 不破核心 UX** | 新增 / 修改 / 删除 extension 不破 notepage 的 view / editing / themes / responsive 任何 sub-feature | [ADR-0003] induction 3 kind-opaque + cross-cutting |
| **Versioning** | 每个 extension 含 semver；framework 支持 lazy migration（旧 row / 旧 theme state 迁移到新版本）| [ADR-0014] |

**远期方向注记（owner 口头裁定 2026-06-12，非承诺）**："不破 algorithm core" 在当前与可见的 plugin 轮内维持不变；但 owner 标记了一个远期扩展点候选——plugin 未来**可能**被允许提供不同的画布形态（非 12 列列数、可堆叠 block 等）。其难度本质 = engine 级覆写（GridState/gravity/AABB 的语义替换而非参数化），届时需要独立的 engine-extension PRD pass + 新 ADR，且默认形态永远是 12 列约束画布。在那之前本表的锁继续全量生效。

## Cross-cutting user stories（extension author 视角）

具体 author journey 见 sub-PRD；这里只列跨 type 的：

- As an **extension author**, I want to **从一个 well-defined plugin contract 起步**，so that **不必猜框架内部**
- As an **extension author**, I want to **声明我的 plugin 需要哪些 capability**（如 storage write / search query / engine read），so that **sandbox 知道允许什么**
- As an **extension author**, I want to **写 semver + migration**，so that **plugin 升版 不破旧数据**
- As an **extension author**, I want to **fork 或 compose 已有 built-in plugin 作为起点**，so that **不必每次从零写**（详 [new-block.md] / [theme-system-author-view.md]）
- As a **plugin user**（note author who installs a plugin），I want to **安装后 plugin 立刻可用 + 卸载后 data 不丢**，so that **试 plugin 不带 risk**

## Non-goals

- ❌ **Plugin marketplace UI / 第三方发布渠道** —— Phase 2+；Day-1 closed registry（plugin / theme code 跟 project source 一起部署）
- ❌ **Operator-pluggable adapter**（storage / search / backup）—— 不在本 PRD；归 [self-host-deploy.md]
- ❌ **Hot reload plugin** —— Day-1 plugin 改 → 重启 server；hot reload Phase 2+
- ❌ **Plugin 间直接 call** —— 跨 plugin 走 framework capability ctx；不允许 `getPlugin('other').handler.x()`（per [ADR-0014]）
- ❌ **Plugin 改 framework 内部**（API endpoint / DB schema / 等）—— 这些是 framework owner 决策，不开放给 plugin
- ❌ **第三方 plugin Day-1 ship** —— Day-1 closed registry；分层 ship 节奏 align project roadmap：M2 markdown block E2E + 3 built-in theme；M3 block/plugin breadth（current block candidates 以 [blocks.md](../blocks/blocks.md) 为准）；M4 full/heavy catalog PRD-driven；第三方 plugin marketplace Phase 2+ open

## Acceptance criteria

### M2 acceptance（minimum shippable extension framework）

- **Framework registry 能 register 多 block plugin**（Day-1 ship 至少 markdown 一个完整 plugin；其他 8 built-in stub 可以 register 但完整实装在 M3/M4，reviewer Finding 1 修订对齐 [project.md] M2 = "markdown block E2E"）
- **Theme plugin** Day-1 M2 ship 3 built-in（详 [theme-system.md]；theme M2 范围保留，reviewer Finding 1 nuance）
- Plugin contract 形态稳定（[ADR-0014]）；author 能读 contract 写一个简单 plugin（即便 Day-1 closed 也可 internal demo 写第 10 个 block / fork theme；**L3 third-party contract Day-1 reserved 不 lock**）
- Plugin lifecycle work：register / version / migration baseline

### M3 acceptance

- Sandbox baseline（[ADR-0011] Phase 1 inline → Phase 2 worker boundary 起步）
- **Light block kind breadth 完整 work**（详 [new-block.md] M3；exact count and catalog align with [blocks.md](../blocks/blocks.md) and project.md M3 plugin breadth）
- Plugin author 文档完整（[new-block.md] author guide + theme author guide 见 [theme-system-author-view.md]）

### M4 acceptance

- **Full/heavy built-in block catalog 全 work**（candidate heavy plugins PRD-driven；align project.md M4）
- 5 deploy mode 下 plugin 都 work（含 Workers runtime constraint）
- Plugin 卸载 / data cleanup workflow

### Phase 2+

- 第三方 plugin discovery / install
- Plugin marketplace

## Edge cases（cross-cutting）

| 场景 | 期望行为 |
|---|---|
| Plugin A 跟 plugin B 版本冲突（共享 dep）| Framework 警告；user 选保留哪一个 |
| Plugin 抛 exception | Sandbox 隔离；不 crash framework；user 看到 plugin 状态 "error"；其他 plugin / 内置功能继续 work |
| Plugin 声明 capability X 但 framework 不支持 | Plugin register 失败；明确 error message |
| Plugin 版本升级 + migration 失败 | 回滚到旧版本 + plugin 标 "needs attention"；data 不动 |
| 卸载 plugin 但留有 data（如 block 用此 plugin）| Data 保留 + 显示 "this block requires plugin X (uninstalled)"；user 可重装或导出迁移 |

## Dependencies

PRD 层 upstream 依赖（ADR 是 downstream，归 References 段）：

- **Parent PRD**: [project.md](../../project.md)
- **Sibling PRDs**:
  - [new-block.md](./new-block.md)
- **Cross-folder（同级 horizontal subsystem）**:
  - [theme-system.md](../theme-system/theme-system.md) — theme extension type product PRD（cascade + presentation）
  - [theme-system-author-view.md](../theme-system/theme-system-author-view.md) — theme author 视角（与 [new-block.md] 对偶）
- **Other feature PRDs**:
  - [notepage.md](../notepage/notepage.md) —— plugin / theme 在 notepage 上的 user-observable behavior
  - [authentication.md](../authentication/authentication.md) —— system-level PEP；**Auth subsystem 4-layer abstraction**（L1 Auth subsystem + L2 AuthAdapter interface = SHCKB-owned stable；L3 AuthAdapter implementation + L4 provider options = replaceable）；plugin-system 通过 `ctx.user` capability ctx 字段（per [ADR-0011]）跟 authentication 协同；**AuthAdapter / provider options 不是 plugin extension type**
- **External services**: 无 Day-1 外部依赖

## Open questions

1. **Plugin 安装 / 卸载 UI 形态** Day-1 不需要（closed registry）；Phase 2+ 形态待定（CLI / UI / config file?）
2. **Plugin author 文档归 plugin-system PRD 还是另立 author-guide?** 倾向归本 PRD + sub-PRDs（不另立 PRD；author-guide 是 runbook 不是 PRD）
3. **Future extension types 准入门槛**：什么 trigger 加一个 new sub-PRD？建议：当 owner 想 ship 一个 user-visible extension type 时（如 "M5 加 export-to-PDF" → 触发 plugin-system/new-export-adapter.md）

## Surfaced ADR debts

本 PRD 触发的 ADR 层 framing 问题（reframe round 2 候选）：

- **[ADR-0004] "Block plugin extension model" 名字过窄**：当前 ADR 限定 block；本 PRD 把 plugin-system 扩到 generic extension framework（含 block + theme + future）。**Action**: audit round 2 时考虑 reframe 为 "Extension model"（generic）；不本轮做
- **[ADR-0014] "Plugin contract details" 全 BlockPlugin 字段**：当前 contract 是 BlockPlugin 17+ fields；如果 plugin-system 支持多 extension type，contract 应分层（generic Plugin base + per-type specialization：BlockPlugin / ThemePlugin / etc.）。**Action**: audit round 2 时考虑分层；Day-1 BlockPlugin 已存在，ThemePlugin 待 [theme-system-author-view.md] PRD 推动定义（含 cascade override metadata）
- **[ADR-0011] sandboxing**: 当前讲 plugin sandboxing；自然扩到所有 extension type（theme 也走 sandbox）；wording 可能不需变，但 audit 时 verify

详 [AUDIT-2026-05.md] PRD-surfaced debts log。

## References

PRD 是 product truth。以下 ADRs 是 downstream 技术决策，**必须 align 本 PRD**。任何 ADR ↔ PRD 不一致 → ADR rework（详 [AUDIT-2026-05.md] 流程）。

- **Aligning ADRs**:
  - [ADR-0004](../../../../engineering/decisions/ADR-0004-block-plugin-model.md) — extension model（当前 framing 限 block；待 reframe）
  - [ADR-0014](../../../../engineering/decisions/ADR-0014-plugin-contract.md) — plugin contract（当前限 BlockPlugin；待 reframe 加 generic + per-type 分层）
  - [ADR-0011](../../../../engineering/decisions/ADR-0011-sandboxing-evolution.md) — sandbox capability boundary
  - [ADR-0005](../../../../engineering/decisions/ADR-0005-agent-semantic-api.md) — agentOps（block plugin specific）
- **Audit**: [AUDIT-2026-05.md](../../../../engineering/decisions/AUDIT-2026-05.md)
- **Doc convention**: [doc-conventions.md](../../../../process/methods/doc-conventions.md)

## Changelog

- 2026-05-16 initial draft；Phase E Day-1 PRD #2；reframe plugin-system 为通用 extension framework（不只 block kind）；hierarchical 结构 with sub-PRDs new-block / new-theme；区分 plugin vs operator-pluggable；surface ADR-0004/0014/0011 reframe debts
- 2026-05-16 **pass 2 — theme-system 抽离独立 folder**：new-theme.md `git mv` 到 `theme-system/theme-system-author-view.md`；plugin-system 收窄为 "通用 extension framework + block sub-PRD"；显式声明 plugin-system 跟 theme-system 是平级 horizontal subsystem 关系（不是 parent-child）；cross-folder ref 到 theme-system；future extension types 不预写 sub-PRD（owner-driven）
- 2026-05-17 **pass 3 — A1 framing reframe (authentication PRD round 2 触发)**：删除 future extension type 列表里 "AuthProvider" entry；改为 explicit note "AuthProvider **不**是 plugin extension type，是 operator-pluggable adapter"；plugin vs operator-pluggable 表 operator-pluggable 例子加 "auth provider"；ADR 归属表加 future auth library selection ADR；cross-folder ref to authentication.md 重写（plugin-system 跟 authentication 通过 ctx.user capability ctx 协同；不通过 plugin extension type）。详 [auth-setup-2026-05-17.md discussion record](../../../../engineering/design/discussions/auth-setup-2026-05-17.md) Section A1
- 2026-05-17 **pass 4 — authentication pass 4 round 4 sync**：cross-folder ref + future extension type note + plugin vs operator-pluggable 表 全 sync 4-layer 新术语（AuthAdapter implementation L3 + provider options L4）；详 discussion record Section F + G
- 2026-05-17 **pass 5 — 切换机制 sharpen** (per reviewer post-6a95eaa catch；详 discussion record Section G "Reviewer follow-up: pattern variants" 子段)：旧"切换机制"行写成 uniform "导出→重新安装→导入"，对 plugin/theme 不成立，对 auth/storage/search/backup/DB 也只对 L3 replacement 成立。新表述拆 (a) L4 option add/enable 是 config + redeploy + coexist (不触发 export-redeploy-import); (b) L3 replacement 才走 migration workflow。判定段同步加 nuance
- 2026-06-12 **远期方向注记**：owner 口头裁定——"不破 algorithm core" 锁现阶段不动，但标记远期 engine 级扩展点候选（非 12 列画布 / 可堆叠 block，难点 = engine 语义覆写）；届时独立 engine-extension PRD pass + 新 ADR；默认形态永远 12 列。详 mvp7-scope-2026-06-12.md M7-D5
