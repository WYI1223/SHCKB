# ADR-0001: Deployment — multi-arch OCI container image as canonical artifact

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

**本 ADR 决策的是：给定 self-hostable 形态，canonical 部署 artifact 是什么，以及不同 build output 之间的 support tier 关系。**

约束（来自 project.md operator 谱）：
- 必须 cover NAS（Synology/QNAP/TrueNAS/Unraid）/ 自建主机 / Cloud VPS / Cloud PaaS / Edge
- Cross-arch：x86_64 + ARM64
- Operator 个人可维护，一键部署
- 不同 operator scale 从 1-5 用户到 10k-100k

> 注：本 ADR 初版（Phase B）误把 product vision 当 ADR 内容写。Owner review (2026-05-14) reframe 为真正的部署决策；pass 2 review (2026-05-16) 又把"canonical/secondary 二分"细化为 3-tier support 模型，并把 installer 机制剥离到 ADR-0018。

### Scope boundary

本 ADR 只回答"build 出什么 artifact、各 artifact 处于什么 support tier"。

**不**回答：
- Operator 怎么从 image / binary / bundle 走到一个 running 实例（install entry / profile selection / systemd / .env / migration / backup config 生成）→ **ADR-0018**
- DB / storage / backup 各自怎么 pluggable → ADR-0002 / ADR-0007 / ADR-0017
- Runtime sandboxing 怎么演化 → ADR-0011

## Decision

**Canonical deployment artifact = 多架构 OCI container image（linux/amd64 + linux/arm64）。**

其余 build output 按 **3-tier support 模型** 分级，**不**是平铺的 "secondary"：

| Support tier | Build output | 适用场景 | 承诺 |
|---|---|---|---|
| **Canonical** | Multi-arch OCI image (amd64 + arm64) | NAS / 自建主机 / Cloud VPS / Cloud PaaS（Fly / Render / Railway） | 默认 / 优先 CI / 全功能 / SLO 主目标 |
| **Full-parity secondary** | Bun-compiled single binary (linux-x64/arm64, darwin, windows-dev) | 不想 / 不能跑 Docker 的环境（NAS 无 Docker daemon / 超低端 VPS / 裸机主机） | 功能等价 / CI smoke gate / 用户体验同步 |
| **Supported-with-constraints** | Cloudflare Workers bundle | Edge 部署（Workers 独立 runtime，不消费 OCI image） | 限制 documented（无本地 FS / 长连接 / cron 受限 / D1 写吞吐有上限）；M4 target，除非 owner 显式降级到 Phase 2+ |

**关键术语**：避免 "escape hatch" / "适配" 这类 best-effort 措辞。Single-binary 是 full-parity secondary，**不**是降级品；Workers 是 supported-with-constraints，**不**是 best-effort —— 是承诺范围内但受 runtime 约束的支持。

### Canonical 的判定依据

Canonical 不是"我们最喜欢的"，是"覆盖最多 operator、最少摩擦的单一 artifact"。OCI image 命中：
- NAS 自托管标准方式就是容器管理器（Container Manager / Portainer / Docker UI）
- 三大 PaaS（Fly / Render / Railway）全吃 OCI image / Dockerfile
- VPS 装 Docker 后同 compose mode
- Image digest 可复现；operator 拿到的字节和 CI 测的一致

### 由 OCI-canonical flow 出的架构约束

OCI image 作 canonical 强制：

1. **12-factor config** —— 全部配置走 env var（`DATABASE_URL` / `STORAGE_*` / `BACKUP_*` / `LLM_*` / etc.），不写死路径 / 密钥
2. **Stateless image/rootfs** —— **image 和容器 rootfs 是 stateless 的**；持久状态只能存在于 **mounted volumes** 或 **external services**（managed DB / S3 / Litestream 等）—— app 进程内存里有运行时状态没问题，写盘的持久状态不能在 rootfs
3. **State 外置** —— DB（ADR-0002）+ object storage（ADR-0007）+ backup（ADR-0017）都是 mountable volume / external service，不在 image 内

这条 consequence 链是下游 ADR-0002 / 0007 / 0017 "为什么 pluggable / 为什么外置" 的根因 —— 不是巧合，是 OCI-canonical 的必然推论。

### Build outputs

共 **3 个 build output**（同 codebase，不同打包目标）：

| # | Output | Tier | CI gate |
|---|---|---|---|
| 1 | Multi-arch OCI image (amd64 + arm64) | Canonical | Full e2e + Lighthouse + smoke |
| 2 | Bun single binary (linux-x64/arm64, darwin, windows-dev) | Full-parity secondary | Smoke + 与 image parity diff |
| 3 | Cloudflare Workers bundle | Supported-with-constraints | Bundle build + Workers-specific smoke（M4 引入） |

**Workers timing**：M4 target；如 owner 在 milestone review 显式降级为 Phase 2+，则 ADR 增补 changelog 说明，**不**改本 ADR 主体决策。

### Cross-arch + OS

- Image 多架构构建：linux/amd64 + linux/arm64（CI buildx）
- Single binary：Bun cross-compile linux-x64 / linux-arm64 / darwin（dev）/ windows（dev）
- Linux 主线；macOS dev 支持；Windows 走 WSL2 或 Docker

## Consequences

**Positive**:
- 单一 canonical artifact 覆盖 5 deploy mode 里 3 个（NAS / PaaS / VPS）
- 可复现 —— image digest 锁定，operator 拿到的和 CI 测的字节一致
- 12-factor / stateless / external-state 是被 forced 出来的好约束，不是事后规训
- 3-tier 模型让 single-binary 是 first-class 不是次品；同时 Workers 的 runtime 约束被诚实标注，不糊弄
- ADR-0018 承接 installer 机制后，本 ADR 聚焦在"build 什么"，决策面收敛

**Negative / Trade-offs**:
- Image 比 single binary 重（含 runtime base layer）—— accepted；NAS / PaaS 主流场景能吃
- Workers bundle 是独立 build pipeline + 独立 smoke matrix，维护成本不可摊销到 image 上
- Cross-arch buildx + 3 output → CI build matrix 复杂度高于单一目标
- "Full-parity secondary" 承诺意味着 single-binary 不能落后 image —— CI parity diff 必须实跑

**Risks**:
- 3 个 build output 行为漂移 —— mitigate by 共享 codebase + 每 output 单独 smoke test + parity diff
- NAS 老型号 Docker 版本旧 —— mitigate by image 不依赖新 Docker 特性 + 文档标注最低 Docker 版本
- Workers 受 runtime 约束（无本地 FS / sub-request 数 / wall-clock）—— mitigate by 限制清单 documented + storage / search adapter（ADR-0007 / 0008）原生支持 Workers-friendly 后端（R2 / D1）

## Alternatives considered

- **Single-binary canonical（Pocketbase 模型）**：ultra-light，但 NAS / PaaS 压倒性 Docker-first；cross-compile 矩阵维护负担；PaaS 仍要 Dockerfile —— rejected，降级为 full-parity secondary（仍是 first-class，不是次品）。
- **Source + install-script canonical**：可复现性差；operator 机器依赖地狱（Node/Bun 版本 / 系统库）—— rejected。
- **Per-vendor builds（无 canonical）**：N 个 build target 各自维护，没有"just run this"的单一答案 —— rejected。
- **Managed SaaS（不 self-host）**：违反 product 定义（`product/prd/project.md` non-goals）—— rejected。
- **平铺 canonical / secondary 二分**：把 single-binary 和 Workers 都标 "secondary" 掩盖了两者的 support 承诺差异 —— rejected by pass 2 review（2026-05-16），改 3-tier。

## References

- Product 定义：`product/prd/project.md`（self-hostable 形态 / operator 谱 / non-goals）
- Source DI doc：`engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §0.6（deployment matrix）+ §11.11（install bootstrap，由 ADR-0018 承接）
- Related ADRs：
  - ADR-0002（DB substrate — external state）
  - ADR-0006（backend stack — Bun 决定 single-binary 可行）
  - ADR-0007（storage — external state）
  - ADR-0011（sandboxing evolution — Workers tier 的 runtime 约束相关）
  - ADR-0017（backup — external state）
  - **ADR-0018（install bootstrap — installer / profile / systemd / .env / migration / backup config 生成）**
- Retrospective：`product/retrospectives/framing-control-2026-05.md`（产品 framing 失败复盘；待写 Phase D）

## Changelog

- 2026-05-13 initial draft —— Phase B 误写成 product vision（"product environment"），非真正的 decision
- 2026-05-14 owner review reframe pass 1 —— product vision 剥离到 `product/prd/project.md`；本 ADR reframe 为真正决策："canonical deployment artifact = multi-arch Docker image + 2 secondary build output"；标题 `Product environment` → `Deployment — multi-arch Docker image as canonical artifact`
- 2026-05-16 external review reframe pass 2 —— "Docker" → "OCI container image"（更准确，不绑定特定 daemon 实现）；"canonical / secondary 二分" → **3-tier support 模型**（Canonical / Full-parity secondary / Supported-with-constraints）；删除 "escape hatch / 适配" 措辞（避免 best-effort 含义）；stateless 改成精确版（image/rootfs stateless；持久状态只能在 mounted volumes 或 external services）；修正 build output 数量为 3（image + single-binary + Workers bundle）；Workers 明确为 supported-with-constraints + M4 target；installer 机制剥离到新增的 ADR-0018，本 ADR 聚焦 build artifact 决策
