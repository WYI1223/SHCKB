# ADR-0020: DB schema migrations + instance upgrade strategy

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-11 |
| Authors | W_YI (owner), Claude |
| Supersedes | — |
| Superseded by | — |
| Source | [mvp2-scope-2026-06-11.md](../design/discussions/mvp2-scope-2026-06-11.md) M2-D4（PRD-informed：[setup-time.md] §upgrade） |

## Context

MVP-1 用幂等 `CREATE TABLE IF NOT EXISTS` bootstrap——只能建新表，不能改已有表。MVP-2 引入 auth（users/sessions）与 blob（blobs）表，是第一次真实 schema 变更；且 MVP-2 后将存在持有真实数据的 self-host 实例（owner 本人 = 第一个 Solo operator）。[setup-time.md] 要求 SHCKB upgrade 是 operator 可走的 setup-time 路径；Solo NAS profile 要求升级零手工步骤。

## Decision

**SQL 生成与应用分离**：

1. **生成**：`drizzle-kit generate` 从 schema diff 生成带序号的 SQL migration 文件（`apps/server/drizzle/`，进 git）。生成是开发期动作。
2. **应用**：**自写极简 applier**（~60 行）在 server 启动时按序执行，替代 drizzle 内置 `migrate()`。理由：baseline stamping 与版本护栏需要对 journal 的完全控制，drizzle 内置 migrator 的 journal 格式是内部实现。Applier 语义：
   - 自有 journal 表 `skb_migrations`（filename / sha256 hash / applied_at）
   - 每个 migration 在事务内执行；失败即中止启动（绝不带半套 schema 运行）
   - **Baseline stamping**：检测到 pre-migration DB（有业务表、无 journal）时，将初始 migration 标记为已应用而不执行（保护 MVP-1 存量数据）
   - **降级护栏**：journal 中存在应用不认识的 migration（DB 比 app 新）→ 拒绝启动
   - **篡改护栏**：已应用 migration 的文件 hash 与 journal 不符 → 拒绝启动
3. **更新机制（Docker self-host 形态）**：升级 = 拉新镜像 tag + `docker compose up -d`；迁移随启动自动应用；`/api/health` 暴露 `version`（app）+ `schemaVersion`（最新已应用 migration 序号），operator 可见。升级前备份建议：停容器拷 `data/`（DB 文件 + blobs 目录）。
4. **范围**：startup auto-migrate 是 Solo NAS 默认；pre-deploy validation / dry-run 归 M3（per [setup-time.md]）。

## Consequences

- 自此**任何 schema 变更必须走 migration 文件**，bootstrap DDL 退役；MVP-2 的 auth/blob 表是第一批实战
- 自写 applier 是 ~60 行受测试覆盖的代码，换取 baseline/护栏的完全控制；drizzle-kit 仍承担难的部分（schema diff → SQL）
- 回滚策略 = 恢复备份（不做 down migrations；SQLite 单文件备份成本低，down 脚本维护成本与风险高）
- 不做：auto-update / in-app update UI / single-binary self-update（[setup-time.md] M3/M4）

## Alternatives considered

1. **drizzle 内置 `migrate()`** —— 拒绝：journal 表结构与 hash 计算是内部实现，baseline stamping 与 DB-newer 护栏要 hack 内部格式；自写 applier 更小更可控。
2. **完整迁移框架（Flyway/Atlas 类）** —— 拒绝：单 SQLite 文件、单进程场景下是大炮打蚊子，且引入非 TS 工具链。
3. **继续幂等 DDL + 手写 ALTER** —— 拒绝：无版本记录、无护栏，对持真实数据的实例不可接受。
4. **Down migrations** —— 拒绝：备份恢复路径更简单可靠（见 Consequences）。

## References

- Source discussion: [mvp2-scope-2026-06-11.md](../design/discussions/mvp2-scope-2026-06-11.md)
- PRD: [setup-time.md](../../product/prd/features/self-host-deploy/setup-time.md)（§SHCKB upgrade）/ [runtime.md](../../product/prd/features/self-host-deploy/runtime.md)（backup 建议口径）
- Stack baseline: [ADR-0019](./ADR-0019-mvp-implementation-baseline.md)
