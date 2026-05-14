# ADR-0001: Product environment — self-hostable canvas-KB platform

| Field | Value |
|---|---|
| Status | accepted |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §0.5 + §0.6 |

## Context

定义本项目的产品形态 + 部署目标矩阵 + LOCKED 维度。这是所有下游决策（substrate / backend / deploy / auth / 协议等）的基础 framing。

在 framing 失败的复盘中（详 `framing-control-2026-05.md` retro），多次 gatekeeper 默认了过窄的产品定义：先是 "personal markdown wiki"，后是 "modest fullstack webapp single-deployment"。User 累积 3 次纠偏才把 framing 拉到正确范畴：**self-hostable distributable platform，多 operator 部署，多 user scale**。

## Decision

**产品定义 = Self-hostable canvas-KB platform**：

软件本身是开源 distributable artifact，由不同 operator 在不同环境部署、服务不同用户群。参考形态 = Pocketbase / Ghost self-host / Outline self-host / Lemmy / Mastodon。

### Operator 谱（3 档，架构必须 cover 整个谱）

| Operator profile | 部署环境 | 用户数 |
|---|---|---|
| **Solo / hobbyist** | NAS (Synology/QNAP/TrueNAS/Unraid) / 家里 RPi / Mini PC / 低配 VPS | 1-5 |
| **Team / company** | VPS (Tencent/Aliyun/AWS Lightsail/Hetzner) / 内部服务器 / 轻量 K8s | 100-2000 |
| **Public / creator** | Cloud platform (Fly/Render/Vercel/Cloudflare) / 自建 VPS 集群 / CDN | 10k-100k |

### 部署 mode × target 矩阵

5 mode：

| Mode | 目标 | DB 默认 | Storage 默认 |
|---|---|---|---|
| Docker compose | NAS / 自建 / VPS | SQLite | local FS |
| Single binary | NAS / 主机 / 低端 VPS | SQLite | local FS |
| Cloud PaaS | Fly.io / Render / Railway | Postgres | S3-compatible |
| Cloud VPS | Tencent/Aliyun/AWS Lightsail/Hetzner | 选 | 选 |
| Edge / Workers | Cloudflare Workers + D1 + R2 | D1 | R2 |

### 共同约束

- Cross-arch: x86_64 + ARM64
- OS: Linux 主线 / macOS dev / Windows 通过 WSL2 或 Docker
- TLS: 内置或反代 auto-detect
- Backup: 每 mode 文档化备份路径
- Migration: install 时 prompt OR 升 mode auto-migrate

### LOCKED 维度

- Self-hostable platform 形态
- Webapp shape（不是 static / 不是 desktop / 不是 toy / 不是 enterprise on-call 栈）
- DB-backed（详 ADR-0002）
- DB / Storage / Search 可配置 pluggable（详 ADR-0006/0007/0008）
- 多机型部署
- SSR for read
- Auth + multi-user 能力
- Performance 不能比同类方案明显差（详 ADR-0010）
- Plugin 扩展不能受限于 backend 语言

## Consequences

**Positive**:
- Operator 自由度高：从 NAS 个人用到公有云大规模 deploy 都可
- 软件分发模型清晰：开源 + 自托管 + 第三方贡献 plugin
- 多 operator scale 自然推出 DB / Storage / Search pluggable 决策
- Cross-arch / multi-OS / 多 PaaS 兼容性是 first-class 不是 afterthought

**Negative / Trade-offs**:
- Architecture 必须 cover 3 个 operator scale 谱 + 5 deploy mode，复杂度高于单一部署
- Plugin 扩展模型 first-class 增加 contract design 工作量
- 自我维护 docs / install / migration 工具 = Z11 deploy zone 第一天就要建

**Risks**:
- Operator 谱过宽可能导致单一 deploy mode 体验稀释；mitigate: 每 mode 单独 acceptance test
- 不同 operator 期望差异大；mitigate: 通过 plugin marketplace + theme 让差异化扩展走 plugin 不走 core

## Alternatives considered

- **SaaS 集中托管服务**：管理简单但失去 self-host 价值；user explicit reject
- **Single-deployment 个人 app**：scale 假设太窄；user 累积 push back 2 次纠偏
- **Desktop app (Tauri / Electron)**：失去 "通过域名访问 + 讨论版" 需求；不适合 KB-as-publication 形态
- **Static site + thin backend hybrid (ADR-0001 旧 spec 翻译)**：鉴权 + DB + discussion 排除纯静态可能

详细 framing critique trace 见 source DI doc §0.5 + framing-control retro。

## References

- Source DI doc: `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §0.5 + §0.6
- Related ADRs: ADR-0002 (substrate), ADR-0006 (backend stack), ADR-0007 (storage), ADR-0008 (search), ADR-0010 (performance), ADR-0011 (sandboxing)
- Retrospective: `product/retrospectives/framing-control-2026-05.md`（待写 Phase D）

## Changelog

- 2026-05-13 initial draft + accepted (LOCKED 2026-05-12 in source DI doc post 3-round user reframe)
