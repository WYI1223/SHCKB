# Runbook: Self-host install / upgrade / backup (MVP-2)

| Field | Value |
|---|---|
| Status | living |
| Last updated | 2026-06-11 |
| Scope | Docker compose path（[ADR-0020] 升级机制 / [setup-time.md] §1/§4 的 MVP 实装面）|

## Install (first run)

1. 准备 env（`compose.yaml` 同目录建 `.env`）：

```env
SHCKB_AUTH_SECRET=<openssl rand -base64 32 的输出>
SHCKB_ADMIN_EMAIL=you@example.com
SHCKB_ADMIN_PASSWORD=<至少 8 字符>
# 反代部署时必设（better-auth origin 校验依赖它）：
# SHCKB_BASE_URL=https://notes.example.com
```

2. `docker compose up -d --build` → `http://<host>:8080`，用 admin 凭据登录。

Internet-exposed bootstrap mode（默认且唯一模式）：user 表为空且未提供 admin env 时**拒绝启动**——不存在"第一个访客成为 admin"。首个用户创建后，admin env 不再被读取（可从 `.env` 移除密码）。

## Upgrade

```
（建议）先备份，见下节
docker compose pull        # 或源码部署时 git pull && docker compose build
docker compose up -d
```

- **迁移自动应用**：启动时按序执行未应用的 migration（事务级，失败即拒绝启动、不会半套 schema 运行）
- **验证**：`curl http://<host>:8080/api/health` → `{ok, version, schemaVersion}`，确认两个版本号符合预期
- **降级保护**：数据库 schema 比镜像新时实例拒绝启动（日志含 "database is newer than this build"）——这是保护不是故障；正确动作是回到新镜像或恢复备份

## Backup / restore

实例完整状态 = **`/data` 卷整体**（SQLite 数据库 + WAL/SHM 文件 + `blobs/` 目录）。

```
docker compose stop
docker run --rm -v shckb-data:/data -v ${PWD}:/backup alpine tar czf /backup/shckb-backup.tgz -C /data .
docker compose start
```

- ⚠️ **不要只拷 `.db` 文件**：运行中实例的大部分数据可能在 `-wal` 文件里（实测踩过）。停容器后整目录打包才是完整备份。
- Restore = 停容器 → 清空卷 → 解包回 `/data` → 启动。降级到旧版本 = 恢复对应时期的备份（不提供 down migrations，per [ADR-0020]）。

## Environment reference

| Env | Required | 含义 |
|---|---|---|
| `SHCKB_AUTH_SECRET` | ✅（≥32 字符）| Session signing secret；缺失/过短拒绝启动 |
| `SHCKB_ADMIN_EMAIL` / `SHCKB_ADMIN_PASSWORD` | 首次启动 ✅ | First-admin bootstrap（user 表非空后忽略）|
| `SHCKB_BASE_URL` | 反代后 ✅ | 公网 origin；auth origin 校验依赖 |
| `SHCKB_DB_PATH` | — | SQLite 路径（镜像内默认 `/data/shckb.db`）|
| `SHCKB_BLOB_DIR` | — | Blob 目录（默认 DB 同级 `blobs/`）|
| `SHCKB_VERSION` | — | 版本字符串（镜像 build arg 注入；`/api/health` 可见）|
| `PORT` | — | 监听端口（默认 3000）|

## References

- [ADR-0020](../decisions/ADR-0020-db-migrations-upgrade.md) — 迁移与升级决策
- [ADR-0021](../decisions/ADR-0021-auth-library-better-auth.md) — auth / bootstrap 语义
- [ADR-0022](../decisions/ADR-0022-blob-storage.md) — 备份对象含 blobs 的原因
- [setup-time.md](../../product/prd/features/self-host-deploy/setup-time.md) — operator lifecycle 产品口径
