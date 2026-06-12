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

## Logical export / import (MVP-3)

卷备份（上节）是物理备份；`/api/admin/export` 是**逻辑备份**：git 友好的 zip
（canonical JSON 树 + content-addressed blobs，[ADR-0023]）。两者互补——卷备份
快且全（含 users），逻辑导出可读、可 diff、可跨实例迁移（**不含 users/auth**）。

- **Export**：登录 admin 后侧栏 ⤓ Export，或 `curl -b <cookie> -o export.zip http://<host>:8080/api/admin/export`
- **Import（仅空实例）**：新实例完成 first-admin bootstrap 后：
  `curl -b <cookie> -X POST --data-binary @export.zip http://<host>:8080/api/admin/import`
  实例已有任何 notepage/folder 时返回 409。导入是原子的：任一项校验失败则什么都不写入，
  响应 details 列出每个失败项。
- **保数据的版本降级路径**：新版本实例 export →（未来格式 v2 起：导出端降级格式）→ 旧版本空实例 import。
  比"恢复备份"多保住备份之后产生的数据。导出物格式版本高于实例支持时 import 明确拒绝（同 DB 降级护栏语义）。
- **Blob GC**：`curl -b <cookie> -X POST http://<host>:8080/api/admin/blobs/gc` ——
  删除未被任何 block/已发布快照引用的 blob，返回 `{deleted, freedBytes}`。

### 格式版本与跨版本迁移（MVP-4 起格式 v2，MVP-5 起 v3）

- v2 导出携带实例主题与逐页主题钉选；v3 增 manifest.settings.themeCustomization
  （operator 主题自定义，[ADR-0026]）；**新实例自动 import 旧版本导出物**（升级补默认值，无损）
- 给旧版本实例产导出物：`/api/admin/export?format=1|2`（导出端降级，[ADR-0023]/[ADR-0024]）；
  先 `&dryRun=1` 查看损失清单（非默认主题/钉选/自定义会被丢弃并逐项列出）
- **换实例主题或更改主题自定义会全量重渲染所有已发布页**（大实例上有可见停顿，属预期行为）

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
- [ADR-0023](../decisions/ADR-0023-export-import-format.md) — 逻辑导出/导入格式与降级路径
- [setup-time.md](../../product/prd/features/self-host-deploy/setup-time.md) — operator lifecycle 产品口径
