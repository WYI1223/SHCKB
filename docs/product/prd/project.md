# Project PRD: SHCKB — Self-Hostable Canvas Knowledge Base

| Field | Value |
|---|---|
| Status | living |
| Last updated | 2026-05-14 |
| Owner | W_YI |
| Source | `engineering/design/_frozen/architecture-rebuild-2026-05-11.md` §0.5 + §0.6 |

## Vision

一个**可自托管的 canvas 知识库平台**。Note 不是 document-flow 页面，是 2D constrained-canvas —— 内容以 tile（block）形式摆在 12 列 × N 行的网格底板上。软件本身是开源 distributable artifact，由不同 operator 在不同环境部署、服务不同用户群。

参考形态 = Pocketbase / Ghost self-host / Outline self-host / Lemmy / Mastodon（软件分发，operator 各自部署）。

## 产品定义

- **Canvas 不是文档**：内容是 2D tile placement（约束 canvas），不是 prose-flow（详 `engineering/design/mental-model.md`）
- **Self-hostable platform**：operator 自部署，不是 SaaS 集中托管
- **Plugin-extensible**：block 种类通过 plugin 扩展；加功能块 = 写 plugin（详 ADR-0004）
- **AI-native**：agent 通过 semantic API（MCP + Skills）操作 canvas，不读 raw 文件（详 ADR-0005 / ADR-0015）
- **Multi-deploy**：一个 Docker image canonical artifact 覆盖 NAS / VPS / Cloud PaaS；single-binary + Workers 作 secondary（详 ADR-0001）

## 核心原则

1. **Constrained canvas，非 Notion-shape doc-flow** —— 约束（snap / gravity / no-overlap）做 affordance 不做 cage
2. **Plugin extension first-class** —— 内置 plugin 和第三方 plugin 走同一 contract
3. **数据 SoT 在 server DB** —— 不是 git-as-DB，不是 file-as-DB（详 ADR-0002）
4. **Agent 是二等用户不是 retrofit** —— semantic API 是架构 first-class 层
5. **Performance 是 acceptance criterion** —— Lighthouse 90+ 是 CI gate（详 ADR-0010）
6. **Self-host onboarding 要简单** —— 一键部署，operator 个人可维护

## Target operators（3 档）

软件架构必须 cover 整个谱。

| Operator profile | 部署环境 | 用户数 | 性能瓶颈 |
|---|---|---|---|
| **Solo / hobbyist** | NAS (Synology/QNAP/TrueNAS/Unraid) / 家里 RPi / Mini PC / 低配 VPS | 1-5 | 内存 / CPU 吃紧；要节能 |
| **Team / company** | VPS (Tencent/Aliyun/AWS Lightsail/Hetzner) / 内部服务器 / 轻量 K8s | 100-2000 | 并发 WebSocket / 全文搜索 / 备份 |
| **Public / creator** | Cloud platform (Fly/Render/Vercel/Cloudflare) / 自建 VPS 集群 / CDN | 10k-100k | 边缘缓存 / 横向 scale / 防 DDoS / 媒体 CDN |

## Target users（operator 部署的实例的用户）

| Role | 能做什么 |
|---|---|
| **Note author** | 登录后在 canvas 上创建 / 编辑 / 组织 note；配置 note 可见性 |
| **Reader** | 通过域名匿名访问 public note；read-only |
| **Discussion participant** | 在 note 的 discussion block 里参与讨论（需轻量 auth） |

## Non-goals

- ❌ **SaaS 集中托管服务** —— 失去 self-host 价值
- ❌ **Desktop app / mobile native app** —— "通过域名访问 + 讨论版" 排除
- ❌ **Static site** —— 鉴权 + DB + discussion 排除纯静态
- ❌ **Enterprise on-call 栈**（K8s 集群 / RBAC / SSO / 多 region / 可观测性栈）—— 个人维护吃不动
- ❌ **Real-time collaborative editing**（CRDT 多人同时编辑）—— Phase 2+ 再 evaluate；Day-1 不做
- ❌ **Plugin marketplace**（browse / install / 第三方 plugin 上架）—— Phase 2+；Day-1 只 ship 内置 plugin

## Success criteria

- **M1-M4 演化路径** 每个 milestone 的 acceptance（详 `engineering/design/bootstrap-evolution.md`）
- **M2 = minimum shippable** —— 可用的"个人笔记 + 公开发布" webapp
- **Lighthouse mobile score ≥ 90** on public read mode（CI gate；详 ADR-0010）
- **Self-host onboarding < 10 分钟**（Docker 模式：`docker compose up -d` 到能用）
- **M4 = 第 2 个 operator 能按文档自部署**到他的 NAS / VPS

## Roadmap

| Milestone | 目标 | 详 |
|---|---|---|
| **M1** | Foundation skeleton —— monorepo + carryover packages drop-in | `bootstrap-evolution.md` |
| **M2** | First end-to-end slice —— login → 创建 note → markdown block → save → 公开访问（minimum shippable） | `bootstrap-evolution.md` |
| **M3** | Plugin breadth + AI —— 5 light plugins + in-app AI + MCP server | `bootstrap-evolution.md` |
| **M4** | Heavy plugins + production polish —— jupyter/nn-viz/agent-flow/discussion + 5 deploy mode 验证 | `bootstrap-evolution.md` |
| **Phase 2+** | Plugin marketplace / wikilink + backlinks / MCP Apps / 协作（CRDT）/ 等 | TBD |

## 相关文档

- **架构总览**：`engineering/design/architecture-overview.md`
- **心智模型**：`engineering/design/mental-model.md`
- **演化路径**：`engineering/design/bootstrap-evolution.md`
- **决策记录**：`engineering/decisions/`（ADR-0001 起）
- **Framing 失败复盘**：`product/retrospectives/framing-control-2026-05.md`
- **完整设计 discussion**：`engineering/design/_frozen/architecture-rebuild-2026-05-11.md`

## Feature PRDs

详 `product/prd/features/`：canvas-editing / plugin-system / ai-integration / discussion / self-host-deploy / authentication / search-discovery。

## Changelog

- 2026-05-14 initial extraction — 产品定义 / operator 谱 / non-goals / success criteria 从 ADR-0001 草稿（Phase B 误把 product vision 写成 ADR）提取到此 project PRD；ADR-0001 同步 reframe 为 "canonical deployment artifact" 决策（详 ADR-0001 changelog）
