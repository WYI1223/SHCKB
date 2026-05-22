# ADR-0018: Install bootstrap — single-entry installer + profile selection + config generation

> **DEPRECATED / LEGACY DRAFT (2026-05-23)**: This ADR is retained only as historical carryover. It MUST NOT be used as an authoritative source for product behavior, architecture, implementation plan, or technology-stack choice. Technology choices must be derived from current PRDs and product shape, then captured in new PRD-informed ADRs. Treat any Decision/Consequences/technology names below as suspect until re-ratified.

| Field | Value |
|---|---|
| Status | deprecated (legacy draft; PRD-rework required) |
| Date | 2026-05-16 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §0.6 + §11.11 |

## Context

ADR-0001 决策了 build artifact（OCI image canonical / Bun binary full-parity / Workers bundle supported-with-constraints）。但 operator 从 "下载 artifact" 走到 "running 实例" 之间的 install 机制是单独的 concern：

- 不同 deploy mode（compose / single binary / Cloud PaaS / Cloud VPS / Workers）的 install path 不同
- 每个 path 需要 prompt 同一组配置（admin / domain / DB / storage / backup）然后落到 `.env`
- Bare-metal Linux 需要 service supervision；macOS dev 不需要；Workers 由 platform 托管
- Frozen DI §11.11 LOCK 了 "bootstrap script 是 product 的一部分，不是事后 add-on"；但 Phase B ADR 集没有承接此 LOCK 的载体 —— pass 2 external review (2026-05-16) 把它从 ADR-0001 剥离成独立 ADR

如果 install 机制混进 ADR-0001：deploy 决策面会持续泄漏到 build artifact ADR 里，每次新增 install 细节都要 supersede ADR-0001。**install 机制 vs build artifact 是两条正交决策轴**，应分两个 ADR。

## Decision

### 单一 install entry

```bash
# POSIX (Linux / macOS / WSL2)
curl -fsSL https://<domain>/install.sh | bash

# Windows native
iwr -useb https://<domain>/install.ps1 | iex
```

`install.sh` / `install.ps1` 是 **vendor-agnostic 基线**；不绑 deploy mode，先 detect 再 prompt。

### Install flow

```
1. detect host
   - OS (linux / darwin / windows-wsl2)
   - arch (amd64 / arm64)
   - prerequisite (docker daemon? bun? systemd?)
2. recommend profile (operator 可 override)
   - 有 docker daemon → compose profile（默认）
   - 无 docker + linux + systemd → single-binary + systemd profile
   - macOS dev → single-binary + foreground profile
   - 用户在 Cloud PaaS 终端 → 不走 install.sh，走 platform CLI（fly / render / railway）
   - Workers → 不走 install.sh，走 `wrangler deploy`（ADR 后段单列）
3. ask install location（默认 ~/skb 或 /opt/skb）
4. fetch artifact（pull image / download binary / clone repo —— 按 profile）
5. interactive prompt
   - admin email + password（写入 first-run bootstrap）
   - public domain（空 = localhost only / 无 TLS）
   - DB choice（sqlite default / postgres URL）
   - storage choice（local FS / S3-compatible URL+keys）—— ADR-0007
   - search provider（默认绑 DB；可 override 到 meilisearch）—— ADR-0008
   - backup provider（默认绑 deploy mode；详 ADR-0017）
6. generate .env from prompts（基于 env.example）
7. run migration（`migrate.sh` → Drizzle migrate）
8. start service（按 profile：compose up / systemd enable+start / foreground）
9. print
   - URL（http://localhost:PORT 或 https://<domain>）
   - admin credentials reminder
   - 下一步指引（runbook 链接 / 日志位置 / backup restore 命令）
```

### Profile 表

| Profile | 适用 | Service supervision | 默认 |
|---|---|---|---|
| `compose` | NAS / VPS / 自建（有 docker daemon） | docker compose restart policy | **install.sh 默认（如检测到 docker）** |
| `single-binary-systemd` | Linux bare-metal / 无 docker VPS | systemd unit file | linux + 无 docker 时的 fallback default |
| `single-binary-foreground` | macOS dev / 临时跑 | 无（PID 1 进程） | dev only |
| `paas` | Fly / Render / Railway | platform 托管 | 不走 install.sh，platform CLI 入口 |
| `workers` | Cloudflare Workers + D1 + R2 | platform 托管 | 不走 install.sh，`wrangler deploy` 入口 |

**Cloud VPS 默认走 `compose`**（VPS 上 docker 是 commodity；compose 比 systemd unit 维护更轻）。Operator 显式选 `single-binary-systemd` 才走 bare-metal 路径。

**Linux service supervision 默认 = systemd**。原因：发行版覆盖率 ≥ 95%；user / openrc / launchd 极少数情况可由 operator 自己包 unit，不进 install.sh 默认 path。

### 生成产物

`install.sh` 落盘的内容（install location 内）：

| 文件 / 目录 | 来源 | 说明 |
|---|---|---|
| `.env` | prompt → env.example 模板填充 | 12-factor 配置；ADR-0001 stateless 前提 |
| `docker-compose.yml` | profile=compose 时 | 复制自 `deploy/docker/` |
| `<install-dir>/skb` 或 `/usr/local/bin/skb` | profile=single-binary 时 | Bun-compiled binary（ADR-0001 secondary） |
| `/etc/systemd/system/skb.service` | profile=single-binary-systemd 时 | systemd unit |
| `<data-dir>/` | 全 profile | mounted volume（DB / blobs / backup —— ADR-0001 "持久状态只在 mounted volumes 或 external services"） |
| 首次 migration 已 run | 全 profile | Drizzle migrate 完成；DB schema = current |
| 首个 admin user 已 seed | 全 profile | 来自 prompt 的 email + password；hashed 存 DB |
| backup config（如启用） | 按 ADR-0017 BACKUP_PROVIDER | scheduler 已注册 / cron entry 已写 |

### 重入 + 升级

- `install.sh` 重跑：detect existing install，进 **upgrade flow**（pull 新 image / 新 binary → migrate.sh → restart service）；**不**覆盖 `.env` / data
- 显式 `install.sh --reinstall` 才重新 prompt（用于改 profile / 重 seed admin）
- `migrate.sh` 可独立调用（CI / runbook 场景）

### 失败回滚

- prompt 阶段失败 → 不落任何盘
- artifact fetch 失败 → 不创建 install dir
- migration 失败 → 自动 rollback（Drizzle transaction）+ 不 start service
- service start 失败 → systemd journal / docker logs 输出 + install.sh 显示首条错误指引

### Workers 独立 path

`wrangler deploy` 不走 `install.sh`；Workers 配置走 `wrangler.toml` + `wrangler secret put`。但 prompt 的语义一致（admin / domain / D1 binding / R2 binding）→ `deploy/cloudflare/setup.sh` 是 thin wrapper 调 wrangler 命令收集同一组配置。

## Consequences

**Positive**:
- Operator 一个 URL `curl ... | bash` 起步；不必读 5 mode README 决定从哪开始
- Profile 选择 explicit（detect → recommend → operator override），不在 install.sh 里黑盒
- ADR-0001 与本 ADR 边界清晰：build artifact decision 不被 install 细节稀释
- 重入安全（upgrade flow vs reinstall flow 分开）→ operator 敢重跑
- systemd 作为 Linux supervision 默认 → 与发行版生态对齐，runbook 模板一致

**Negative / Trade-offs**:
- 5 profile path → install.sh 实现复杂度高于 "只支持 compose"
- `curl ... | bash` 模式被一部分 operator 安全社区不喜欢；mitigate by 提供 `--dry-run` + 脚本 GPG 签名 + 推荐 "下载后 inspect 再 bash" 写法（runbook）
- Windows path 依赖 PowerShell + WSL2 之间的复杂度；M1 只承诺 WSL2 path，PowerShell 原生 path 是 M3+
- Workers 走独立 path → install UX 不完全统一；accepted（Workers 是 supported-with-constraints，ADR-0001）

**Risks**:
- install.sh 在 NAS 老 busybox 环境 POSIX 兼容性问题 → mitigate by 严格 sh（非 bashism） + CI 跑 dash + busybox 容器测试
- prompt 失败导致部分 state 落盘 → mitigate by 落盘分阶段事务化（temp dir → atomic rename）
- systemd 不可用时 install.sh 静默 fallback 到 foreground，operator 不知 → mitigate by 显式打印 "未检测到 systemd，已切到 foreground；推荐安装 systemd 后重跑 install.sh"

## Alternatives considered

- **每个 deploy mode 独立 install script（无 install.sh 顶层 entry）**：operator 需要先决定 mode → 读对应 README → 跑对应 script；增高入门门槛 —— rejected per §11.11 "single-entry 是 product 一部分"
- **只支持 Docker compose，其他 mode 走 platform CLI**：把 single-binary / bare-metal operator 推出门外，违反 ADR-0001 full-parity 承诺 —— rejected
- **install 用 Go / Rust 写的 binary（替代 shell）**：分发悖论（要先有 binary 才能 install binary）；shell 是 Unix 通用基线 —— rejected
- **Ansible / Nix / Terraform 当 installer**：operator 需先学 IaC 工具 —— rejected per "operator 个人可维护"约束
- **`install.sh` 不 prompt，全靠 env var 预设**：CI / batch 场景 nice-to-have；但 day-1 交互 prompt 是 onboarding UX 主路径 —— 折衷：`install.sh --non-interactive` flag 允许全 env var；交互 prompt 仍是默认

## References

- Source DI doc：`engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §0.6（deployment matrix）+ §11.11（install bootstrap LOCK）
- Related ADRs：
  - **ADR-0001（deployment canonical artifact — 决定 build 什么；本 ADR 决定怎么 install）**
  - ADR-0002（DB substrate — install 时选 SQLite / Postgres）
  - ADR-0007（storage provider — install 时选 local FS / S3-compatible）
  - ADR-0008（search provider — install 时默认绑 DB 选择）
  - ADR-0017（backup provider — install 时按 deploy mode 选默认）
- Runbook (M2+)：`engineering/runbooks/install-and-upgrade.md`、`engineering/runbooks/backup-restore.md`

## Changelog

- 2026-05-16 initial draft —— 承接 frozen DI §11.11 LOCK；从 ADR-0001 pass 2 external review 剥离出来，使 ADR-0001 专注 build artifact 决策、本 ADR 专注 install 机制决策
