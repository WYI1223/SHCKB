# ADR-0021: Auth library selection — better-auth as L3 AuthAdapter implementation

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-06-11 |
| Authors | W_YI (owner), Claude |
| Supersedes | — |
| Superseded by | — |
| Source | [mvp2-scope-2026-06-11.md](../design/discussions/mvp2-scope-2026-06-11.md) M2-D1 #2（PRD-informed：[authentication.md] Build/Buy=Buy + verify 条件） |

## Context

[authentication.md] 锁定 Build vs Buy = Buy，Better-Auth 为 preferred baseline，**pending verification**（Bun + Hono + Drizzle 约束下 verify 集成可行性）。MVP-2 auth 切片触发该 verify。自研 crypto 维持 rejected。

## Decision

**better-auth（1.6.x）作为 L3 AuthAdapter implementation**，藏在 SHCKB 的 stable seam（L1/L2）后：

- **L2 seam 形态**：`createAuth(db, opts)` 工厂（apps/server/src/auth.ts）+ PEP middleware 把 better-auth session 映射为冻结的 `ctx.user` Principal（id/role/name/email，不含 token/secret）。Handler 层只见 Principal，不见 better-auth 类型——更换 L3 只动这两个文件。
- **Wire surface**：better-auth handler 挂 `/api/auth/*`（sign-in/sign-out/session）；**挂载实例 signup 永久禁用**。
- **First-admin bootstrap**（internet-exposed mode，per [setup-time.md]）：user 表空 + 无 `SHCKB_ADMIN_EMAIL/PASSWORD` env → 拒绝启动；建用户走**临时 bootstrap 实例**（signup 开、handler 不挂载、用完即弃）。dev-local setup-screen 路径 deferred。
- **Schema 所有权**：better-auth 表（user/session/account/verification + role 附加字段）由 `@better-auth/cli generate` 产出 drizzle schema，并入本仓 migration 流（`0001_auth.sql`，per [ADR-0020]）——better-auth **不**拥有运行时 DDL。
- **MVP-2 授权模型**：单用户实例——authenticated 即可 author，anonymous 仅公开读面。`requireOwner` / 多用户 / user 管理 UI 随多用户支持进入，不提前实装（owner_id 列同步推迟）。
- **环境契约**：`SHCKB_AUTH_SECRET`（≥32 字符，缺失拒启）；`SHCKB_BASE_URL` 在任何反代后必设（含 dev 的 vite proxy——origin 校验依赖它，见 verify 记录）。

**Verify 证据**（2026-06-11）：26 个 server 测试（bun:test）覆盖 sign-in/sign-out/session 失效/错误密码/signup 阻断/bootstrap 拒启与幂等/principal 无泄漏，Bun + Hono + drizzleAdapter(bun:sqlite) 组合全绿；浏览器端登录闭环（401 重定向 → 登录 → 列表 → 登出）实测通过。

## Consequences

- better-auth 的 4 张表进入本仓 migration 历史；其版本升级若带 schema 变更，走我们的 migration 流程（CLI regenerate → drizzle-kit generate → 新 migration 文件）
- 密码 hash（scrypt）/ session token / cookie 属性由 library 拥有（per PRD"library 内部决策不进 PRD/ADR"）
- L4 provider options（OAuth/passkey 等）future：better-auth 原生支持，operator config 开启，符合 4-layer 模型
- Cookie 默认即 HttpOnly + SameSite；production `Secure` 依赖 HTTPS 终止（操作侧文档归 Phase 5）

## Alternatives considered

1. **Auth.js (core)** —— 候选第二名：framework-coupling 史较重、session/adapter 模型偏 Next 生态；better-auth 的 Hono/Bun 原生集成与 CLI schema 生成更贴本栈。
2. **自写 + 小件库（scrypt/jose）** —— 拒绝：PRD 明确 Buy；session 管理/rotation/CSRF 自担风险无收益。
3. **Lucia** —— 拒绝：项目已宣布停止维护，作者本人推荐迁移。

## References

- Source discussion: [mvp2-scope-2026-06-11.md](../design/discussions/mvp2-scope-2026-06-11.md)
- PRDs: [authentication.md](../../product/prd/features/authentication/authentication.md) / [pep.md](../../product/prd/features/authentication/pep.md) / [identity.md](../../product/prd/features/authentication/identity.md) / [setup-time.md](../../product/prd/features/self-host-deploy/setup-time.md)
- Migrations: [ADR-0020](./ADR-0020-db-migrations-upgrade.md)
- better-auth: <https://better-auth.com>
