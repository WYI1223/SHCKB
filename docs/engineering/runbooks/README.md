# Runbooks

Operational guides —— 部署 / 备份 / migrate / troubleshoot。

## 当前状态

**待 M2+ 实施时填充**。Bootstrap M1 阶段不需要 runbook（还没有 deployable artifact）。

## 预期 runbook 列表

| Runbook | 何时写 | 内容 |
|---|---|---|
| `deploy-docker.md` | M2 first ship | Docker compose mode 一键部署 step-by-step |
| `deploy-single-binary.md` | M3+ | Bun-compiled single binary 部署到 NAS / 主机 |
| `deploy-fly.md` | M4 | Fly.io 部署 |
| `deploy-render.md` | M4 | Render 部署 |
| `deploy-cloudflare.md` | M4 | Cloudflare Pages + Workers + D1 + R2 部署 |
| `backup-restore.md` | M2+ | SQLite / Postgres / object storage 备份 + 恢复 |
| `db-migration.md` | M3+ | Drizzle migration 流程（dev / staging / prod）|
| `upgrade.md` | M4+ | 跨版本 upgrade 流程；plugin migration handling |
| `troubleshoot-common.md` | M3+ | 常见问题 / 错误码 / log 解读 |

## Runbook 写作规则

- **可执行性优先** —— 每步含具体 shell 命令 / 截图 / 期望输出
- **失败处理 inline** —— 每步可能失败时直接给 recovery 步骤，不放尾巴
- **环境假设明确** —— 顶部声明 OS / 工具版本 / prerequisites
- Living docs；版本演化时更新；保持 currentness 比保持 完整性 重要
