# ADR-0001: Deployment — multi-arch Docker image as canonical artifact

| Field | Value |
|---|---|
| Status | proposed |
| Date | 2026-05-13 |
| Authors | W_YI + gatekeeper Claude Opus 4.7 |
| Supersedes | — |
| Superseded by | — |
| Source DI doc | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §0.6 |

## Context

产品定义 = self-hostable canvas-KB platform（详 `product/prd/project.md`：3 档 operator 谱 / target users / non-goals / success criteria）。Product vision 是 owner-driven 的 premise，不是本 ADR 的决策范围。

**本 ADR 决策的是：给定 self-hostable 形态，canonical 部署 artifact 是什么。**

约束（来自 project.md operator 谱）：
- 必须 cover NAS（Synology/QNAP/TrueNAS/Unraid）/ 自建主机 / Cloud VPS / Cloud PaaS / Edge
- Cross-arch：x86_64 + ARM64
- Operator 个人可维护，一键部署
- 不同 operator scale 从 1-5 用户到 10k-100k

> 注：本 ADR 初版（Phase B）误把 product vision 当 ADR 内容写。Owner review (2026-05-14) 指出"ADR 记录的是 decision 不是 vision"——product 定义已剥离到 `product/prd/project.md`，本 ADR reframe 为真正的部署决策。

## Decision

**Canonical deployment artifact = 多架构 Docker image（linux/amd64 + linux/arm64）。**

一次构建，直接服务 3 种 deploy mode：

| Mode | 目标 | 消费方式 |
|---|---|---|
| Docker compose | NAS / 自建主机 / VPS | 直接 pull image + `docker compose up -d` |
| Cloud PaaS | Fly.io / Render / Railway | 三家都吃 Docker image / Dockerfile |
| Cloud VPS | Tencent / Aliyun / AWS Lightsail / Hetzner | VPS 装 Docker 后同 compose mode |

**两个 secondary build output**（同 codebase，不同打包目标，非 canonical）：

| Secondary | 用途 |
|---|---|
| Bun-compiled single binary | 不想 / 不能跑 Docker 的环境（NAS 无 Docker daemon / 超低端 VPS / 裸机主机） |
| Cloudflare Workers bundle | Edge 部署（Workers 是独立 runtime，不消费 Docker image） |

Single binary 和 Workers 是 escape hatch / 适配，**不是** canonical —— canonical 的判定是"覆盖最多 operator、最少摩擦的单一 artifact"。

### 由 Docker-canonical flow 出的架构约束

Docker image 作 canonical 强制：

1. **12-factor config** —— 全部配置走 env var（`DATABASE_URL` / `STORAGE_*` / `BACKUP_*` / `LLM_*` / etc.），不写死路径 / 密钥
2. **Stateless app layer** —— app 容器无本地持久状态，可随时重启 / 横向 scale
3. **State 外置** —— DB（ADR-0002）+ object storage（ADR-0007）+ backup（ADR-0017）都是 mountable volume / external service，不在 app 容器内

这条 consequence 链是下游 ADR-0002 / 0007 / 0017 "为什么 pluggable / 为什么外置" 的根因 —— 不是巧合，是 Docker-canonical 的必然推论。

### Cross-arch + OS

- Image 多架构构建：linux/amd64 + linux/arm64（CI buildx）
- Single binary：Bun cross-compile linux-x64 / linux-arm64 / darwin（dev）/ windows（dev）
- Linux 主线；macOS dev 支持；Windows 走 WSL2 或 Docker

## Consequences

**Positive**:
- 单一构建目标覆盖 5 mode 里 3 个（NAS / PaaS / VPS）—— NAS 自托管标准方式就是容器管理器；PaaS 全吃 image；VPS+Docker trivial
- 可复现 —— image digest 锁定，operator 拿到的和 CI 测的字节一致
- 12-factor / stateless / external-state 是被 forced 出来的好约束，不是事后规训
- Secondary 的 single-binary 给"反 Docker"的 NAS / 裸机 operator 留出口

**Negative / Trade-offs**:
- Image 比 single binary 重（含 runtime base layer）
- Workers 不消费 Docker image —— 是真正独立的第 4 个 build target，维护成本独立
- Cross-arch buildx + 多 secondary output → CI build matrix 复杂度高于单一目标

**Risks**:
- 三个 build output（image / binary / Workers bundle）行为漂移 —— mitigate by 共享 codebase + 每 output 单独 smoke test
- NAS 老型号 Docker 版本旧 —— mitigate by image 不依赖新 Docker 特性 + 文档标注最低 Docker 版本

## Alternatives considered

- **Single-binary canonical（Pocketbase 模型）**：ultra-light，但 NAS / PaaS 压倒性 Docker-first；cross-compile 矩阵（linux-x64/arm64/darwin/win）维护负担；PaaS 仍要 Dockerfile。Docker-canonical 反而更省 —— rejected，降级为 secondary。
- **Source + install-script canonical**：可复现性差；operator 机器依赖地狱（Node/Bun 版本 / 系统库）—— rejected。
- **Per-vendor builds（无 canonical）**：N 个 build target 各自维护，没有"just run this"的单一答案 —— rejected。
- **Managed SaaS（不 self-host）**：违反 product 定义（`product/prd/project.md` non-goals）—— rejected。

## References

- Product 定义：`product/prd/project.md`（self-hostable 形态 / operator 谱 / non-goals）
- Source DI doc：`engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §0.6（deployment matrix）
- Related ADRs：ADR-0002（DB substrate — external state）、ADR-0006（backend stack — Bun 决定 single-binary 可行）、ADR-0007（storage — external state）、ADR-0017（backup — external state）
- Retrospective：`product/retrospectives/framing-control-2026-05.md`（产品 framing 失败复盘；待写 Phase D）

## Changelog

- 2026-05-13 initial draft —— Phase B 误写成 product vision（"product environment"），非真正的 decision
- 2026-05-14 owner review reframe —— product vision 剥离到 `product/prd/project.md`；本 ADR reframe 为真正决策："canonical deployment artifact = multi-arch Docker image + 2 secondary build output"；标题 `Product environment` → `Deployment — multi-arch Docker image as canonical artifact`
