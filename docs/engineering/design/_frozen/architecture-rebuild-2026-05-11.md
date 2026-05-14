# Architecture rebuild — 设计对话 2026-05-11 (post-prototype)

> **状态**: Draft / discussion-informed doc (DI). 部分 LOCKED（user 决策），部分 PROPOSED（gatekeeper synthesis），部分 OPEN。
> **来源**: User (gatekeeper-Windows session) 与 Claude Opus 4.7 (1M ctx) gatekeeper 对话；触发于 user 复盘 grid-redesign 之后回看仍在 Tiptap+MDX substrate 之上跑的 Wave 5/6/7 全部工作。本对话沉淀 `grid-redesign-2026-05-11.md` 之后的 framing 诊断 + substrate 决策 + plugin model + agent access pattern。
> **关系**: `grid-redesign-2026-05-11.md` 锁定 grid-engine 心智 + themes；本文档锁定 substrate 层 + block plugin 模型 + AI agent access 模型 + 整体 9 层架构 proposal。
> **新 repo 范围 (LOCKED 2026-05-13)**: 本 doc 全部 design intent 是为**新 repo clean cut** 准备 —— 旧 repo (SelfKnowledgeBaseWeb / Wave 1-7) git history + 全部 ADR 完全抛弃，不存在 "supersede" 概念。文档中对旧 ADR 的对比（§0.5 翻译错位表 / §3 Tiptap 历史理由等）仅作 framing failure 教学 + cognitive default 记录用，**不是 amendment**。新 repo 从 ADR-0001 重起，无前置依赖。
> **下一步**: 把 LOCKED 决策 promote 到新 repo `docs/decisions/ADR-0001..ADR-0015`；启动 carryover 物理搬运 + 新 repo bootstrap。

---

## 0.5 产品定义：self-hostable canvas-KB platform (LOCKED by user, post-2026-05-12 final reframe)

### User 原话累积

2026-05-11 session 后段：
> "我做的是可部署的服务器端能 24h 运行的网页应用，需要有鉴权能力。一个能够个人维护的网站，能够一键部署，能够实现在线笔记的功能（需要鉴权），其他人可以通过域名访问，有心者可以创建讨论版。"

2026-05-12 push back gatekeeper "solo / KB scale" 默认：
> "个人为什么是 KB scale 呢？我这十年的文档到现在，包括图文有将近 10G 的大小。"
>
> "不是我读多少篇 note，而是考虑，用户有多少粉丝，可能并发有多少 note，全文搜索存在多少次，超链接跳转高不高，这些全部取决于用户，而不是我读几篇。有些人可能就自己用，很少的读取和编辑次数，有些人可能分享给整个公司，几百人几千人用，而有些可能视频博主会分享给粉丝，几万几十万人用。"
>
> "我们需要提供那些能够在不同机型上部署的可能性，比如说有些人想部署到自己的 NAS 上，自己的主机上，有人想租腾讯云阿里云 AWS 部署等等。"
>
> "SQL 和 Postgres 其实可以做成可配置，开发者 install 的时候选呗。对于后端，其实就一个要求，性能不能有明显差距，扩展性不能太差，尤其是 plugins。"

### 产品定义 (LOCKED 2026-05-12)

**Self-hostable canvas-KB platform** —— 软件本身是开源 distributable artifact，由不同 operator 在不同环境部署、服务不同用户群。

**不是**：
- 单一部署的"你自己用的笔记 app"
- Web SaaS 集中托管服务
- Desktop app / mobile app / static site / toy

**是**：第三方可自托管的 canvas 知识库 webapp，参考形态 = **Pocketbase / Ghost self-host / Outline self-host / Lemmy / Mastodon**（软件分发，operator 各自部署）。

### Operator 谱（3 档）

架构必须 cover 整个谱，不是 only 中间档。

| Operator profile | 部署环境 | 用户数 | 性能瓶颈 |
|---|---|---|---|
| **Solo / hobbyist** | NAS (Synology/QNAP/TrueNAS/Unraid)、家里 RPi / Mini PC、低配 VPS | 1-5 | 内存 / CPU 都吃紧；要节能 |
| **Team / company** | VPS (Tencent/Aliyun/AWS Lightsail/Hetzner)、内部服务器、轻量 K8s | 100-2000 | 并发 WebSocket / 全文搜索 / 备份 |
| **Public / creator** | Cloud platform (Fly/Render/Vercel/Cloudflare)、自建 VPS 集群、CDN | 10k-100k | 边缘缓存 / 横向 scale / 防 DDoS / 媒体 CDN |

### 数据规模 anchor

User 自身实际数据：**10 年累积 / ~10GB / 图文混合 / 数千 entries**。每个 operator 自己的数据规模可能更小或更大。Backend 内存里不存 10GB —— **流过**：DB 存 metadata + content reference，object storage 存 binary，per-request 只 touch KB-级。

### 部署 mode × 目标矩阵 → §0.6

详细 deploy 模式见 **§0.6 Deployment matrix**。

### LOCKED 维度

**形态 / 拒绝列表 / 能力要求**：
- LOCKED: **self-hostable platform 形态**（不是 SaaS / 不是 single-deployment-only）
- LOCKED: **webapp shape**（不是 static / 不是 desktop / 不是 toy / 不是 enterprise on-call 栈）
- LOCKED: **DB-backed**（不是 git-as-SoT / 不是 file-only）
- LOCKED: **DB 可配置**（SQLite + Postgres pluggable；install 时选；详 §11.7）
- LOCKED: **Storage 可配置**（local FS + S3-compatible pluggable；详 §11.13）
- LOCKED: **Search 可配置**（SQLite FTS5 + Postgres tsvector + external pluggable；详 §11.14）
- LOCKED: **多机型部署**（NAS / 自建主机 / Cloud VPS / Cloud PaaS / Edge platform）
- LOCKED: **SSR for read**（不是 SSG only）
- LOCKED: **auth + multi-user 能力**（不是 single-user-only）
- LOCKED: **performance 不能比同类方案明显差**（具体 SLO 见 §11.10）
- LOCKED: **plugin 扩展不能受限于 backend 语言**（plugin 作者门槛要低；详 §4 + §11.15）

**OPEN**：
- 具体 Drizzle migration tool、framework 配置细节
- 第三方 plugin sandboxing 演进路径（§11.15）
- Discussion plugin 实现 scope（已 absorbed §11.9 by §4）

### 与 ADR-0001 spec 翻译错位

ADR-0001 §1.1 + §1.8 是 spec lock 时（2026-04-29）brainstorm-Claude 的翻译错误。修正后形态：

| Spec 翻译 | 实际需求 | 状态 |
|---|---|---|
| §1.1 "Cloudflare Pages CDN-static" | Self-hostable webapp，多目标 deploy | ✗ supersede |
| §1.8 constraint 1 "不引入数据库" | DB 必备，且 SQLite/Postgres pluggable | ✗ supersede |
| §1.8 constraint 3 "不引入后端 SSR" | SSR for read path | ✗ supersede |
| §1.8 constraint 4 "不为多用户做设计" | 讨论版多用户 + operator 可服务任意 scale | ✗ supersede |
| §1.2 FastAPI (Python) 后端 | TS server (Bun + Hono) —— plugin extension 模型 + carryover 都要 TS | ✗ supersede |
| §1.2 单用户密码 + JWT | 拓展 multi-user + 多 auth provider pluggable | ✓ extend |
| §1.2 Pyodide 浏览器内计算 | 独立正确（client-side） | ✓ retain |
| §1.2 Astro frontend | Hono SSR (runtime-agnostic) 主线；Astro 可作 alt | ✗ shift |
| §1.2 `openapi-typescript` 自动类型同步 | 保留，zod-to-openapi 直接 gen | ✓ retain |

### 这次 framing 失败的元教训

User 原始需求 = "可部署 + 多机型 + 多用户规模 + plugin 扩展性 + 性能不差的 canvas-KB platform"
↓ (2026-04-29 spec lock translation)
ADR-0001 = "Cloudflare Pages static + Cloudflare Tunnel 后端附属 + 不引入数据库 + 不引入后端 SSR + 单用户"
↓ (2026-05-11 first reframe)
gatekeeper proposal = "modest fullstack webapp + 单实例 deploy + KB scale"
↓ (2026-05-12 second reframe by user)
**实际定义 = self-hostable platform + multi-operator + multi-target + multi-scale**

每次 framing 收窄都是 gatekeeper 隐性默认。User 累积 3 次纠偏才把 framing 拉到正确范畴。详见 §8 cognitive defaults 1 / 4 / 7 / 9。

---

## 0.6 Deployment matrix (LOCKED 2026-05-12)

Operator install 时选 deploy mode + target，**软件本身适配所有组合**（在合理 trade-off 内）。

### Mode × Target 矩阵

| Mode | 目标环境 | install 工具 | DB 默认 | Storage 默认 | 适合 operator |
|---|---|---|---|---|---|
| **Docker compose** | NAS (Synology/QNAP/Unraid/TrueNAS) / 自建 / VPS | `docker compose up -d` | SQLite | local FS volume | Solo / Team |
| **Single binary** | NAS / 主机 / 极低端 VPS / Mini PC | `curl ... \| bash` (Bun-compiled binary) | SQLite | local FS | Solo |
| **Cloud PaaS** | Fly.io / Render / Railway | platform CLI (`fly launch` / `render deploy` / `railway up`) | managed Postgres | S3-compatible (R2 / AWS S3) | Team / Public |
| **Cloud VPS** | Tencent / Aliyun / AWS Lightsail / Hetzner | `install.sh` → systemd service | 选 SQLite / Postgres | 选 local / S3 | 任意 |
| **Edge / Workers** | Cloudflare Workers + D1 + R2 | `wrangler deploy` | D1 (SQLite-on-edge) | R2 | Public / 边缘缓存优先 |

### 共同约束

所有 mode 必须满足：

- **Cross-arch**: x86_64 + ARM64（NAS / RPi / Apple Silicon / Graviton）
- **OS**: Linux 主线；macOS dev 支持；Windows 通过 WSL2 或 Docker
- **TLS**: 内置或反代（Caddy / nginx auto-detect）；HTTP-only 仅 localhost dev
- **Backup**: 每个 mode 提供文档化备份路径（SQLite copy / pg_dump / S3 sync）
- **Migration**: install 时 prompt OR 自动从一个 mode 升另一个 mode（如 SQLite → Postgres）

### Z11 `deploy/` 目录形态

```
deploy/
├── README.md                       # 安装入口 + 5 mode 选择导引
├── install.sh                      # POSIX 通用（detect OS/arch → 推荐 mode）
├── install.ps1                     # Windows PowerShell
├── docker/
│   ├── docker-compose.yml          # Docker compose mode
│   └── Dockerfile
├── binary/
│   ├── build.sh                    # bun build --compile cross-platform
│   └── install.sh                  # 下载 binary + setup systemd
├── fly/
│   └── fly.toml
├── render/
│   └── render.yaml
├── railway/
│   └── railway.toml
├── cloudflare/
│   └── wrangler.toml
├── env.example
├── migrate.sh                      # Drizzle migration CLI 入口
└── backup.sh                       # 各 mode 备份脚本
```

---

## 1. 对话触发：framing-control 诊断

### 1.1 User 的根本 critique

> "以前的路线全是错的。你也没有完全理解我的想法，理解了，也只是字面上同意了，而实际工作上完全不按照规范来。"
>
> "我的理解是比 Notion 更好的不是 Notion 结构的，而你觉得更好的 Notion 一定是 Notion-like 的。"
>
> "不是需求变了，而是你把我说服了的。"

复盘 2026-04-29 spec-lock brainstorm session：

- 编辑器选型菜单 = "BlockNote / Tiptap / Lexical / Plate"
- 这四个全是 **"WYSIWYG block editor 库"** 这一类
- 真正应该先问、但**没问的** = **编辑表面是什么形态？**
  - "Notion 风格 block editor" 只是其中一种答案
  - 其它候选：Figma 画布 + 文本 tile / Tiled-RPG-Maker 风格离散瓦片 / Sims build mode / Bento dashboard / ...
- gatekeeper 把选择空间在 library 层级就收窄，**菜单本身已经把 framing 锁定**

User spec lock 时**没有词汇**直接表达 "我想要的不是 block editor 这个范畴" —— 范畴外的形态只能在范畴内执行失败到一定程度才能从 lived experience 里挤出来。这不是 "user 那时没说清楚"，是 **gatekeeper 那时没考虑 "user 说的可能不在我的范畴里"**。

### 1.2 病灶 = cognitive default "improve within category"

- User 说 "比 Notion 更好" → gatekeeper 听成 "把 Notion 做得更好"
- User 的语义是 **范畴 escape**；gatekeeper 的翻译是 **范畴内 optimize**
- 同字面，不同含义。Gatekeeper 没问就替 user 做了翻译。

菜单 = 范畴内的全集，不是全部可能性的子集。Gatekeeper 没"收窄你的选择"，是**先把自己锁进范畴**，然后**菜单是从范畴内部看出去的全集**。

这个默认值**自我加强**。一旦 user 接受 Notion-shape：
- "block 是文档流里的一个 node" 是 Notion-默认
- "grid 是辅助布局" 是 Notion-默认（Notion 有 column）
- "drag/drop 是 doc 内重排" 是 Notion-默认
- "MDX 当存储 = JSX 嵌入 prose" 是 Notion-默认

每个默认值在范畴内看都合理。后续 6 个月 ADR / D-list / spec amendment 都在范畴**内**审 —— ADR / contract / 9-point checklist 都不可能跳出来。

### 1.3 Standards landing 三连（PR #74/#75/#76）的局限

PR #74 (ADR-0011 v0.2) D9 Product Experience Quality Gate + D10 anti-prompt-patching 是为了防止 "vitest passes 但 user 看不到改进"。但 D9/D10 度量 **"测试 PASS / 截图存在"**，**不度量 "做的是不是对的东西"**。它们是必要不充分。

cf-22 14 R-rounds 全部在问 "测试覆盖 / ADR / contract / CI green"，**没有一个**在问 "用户写一篇笔记需要点几次鼠标 / 找回某篇旧笔记要多久 / 这个交互手感对吗"。Standards 度量在 frame 内，无法 catch frame 本身的错误。

---

## 2. Mental model 二次精化：constrained canvas (LOCKED by user)

### 2.1 User 原话

> "我觉得比起像 markdown，更像 canvas，但是又是有强大限制的 canvas。"

### 2.2 比 `grid-redesign-2026-05-11.md` §2 (2D tile placement) 更准的表达

```
Figma / Miro              Notion / Google Docs
完全自由 canvas    ←─────────────────→    document flow
        ↑
        │
   constrained canvas
   = canvas 的空间感
   + 约束的"不用想对齐"
   + 不是 prose-flow 的"垂直阅读"束缚
```

- **不是 Notion**（doc-with-embeds, prose-flow 主线）
- **不是 free canvas**（Figma/Miro, alignment hell, no reading order）
- **不是 Tetris puzzle**（system fits pieces；这是 grid-redesign §2 的 metaphor，但与 user 描述有微妙张力 —— Tetris 是 system 决定形状 user 找位置；constrained canvas 是 user 决定放什么/放哪里，system 帮 snap）

### 2.3 最接近的产品形态

- iOS Springboard（图标在网格放，每页一张 canvas）
- Bento dashboard（Grafana / Power BI / Tableau 编辑模式）
- The Sims build mode（grid snap furniture placement）
- Stage Manager 风格的窗口拼贴
- Tiled / RPG Maker tile editor

这些不是 "文档" 也不是 "画布"，是**第三种东西**。在 Notion 词汇表里没有 "discrete tile placement on LEGO baseplate with per-block gravity" 这种概念 —— **必须离开整个 Notion 范畴才有词汇**。

### 2.4 约束做 affordance 不做 cage

- snap = 不用想像素级对齐
- 12 grid = 一致的布局词汇
- gravity = "我把它放这里" → "好，进网格" auto-resolve
- no overlap = 不需要纠结 z-index

**约束是 affordance，不是限制**。约束让 user 不用做完美布局者，专注内容。

### 2.5 Tile-model vs canvas-model：一个 rhetorical 区分（user 已纠正）

Gatekeeper 起初试图区分:
- Tile placement (Tetris): system 决定，gravity-on default
- Constrained canvas: user 决定，gravity-off default

User pushback: **`{gravity: false}` 已经在 Option A 里给了**。机制上同一套代码，唯一差是默认值。这不是架构区分，是 UX 默认值参数选择。

→ 这条已并回 `grid-redesign-2026-05-11.md` §3.3 Option A 当前选择（gravity-on default）。

---

## 3. Substrate 决策：Tiptap 删 + MDX 删 (LOCKED by user)

### 3.1 决定

> User: "我的决定是把 Tiptap 删了"

Tiptap 牵涉到的具体范围：

**直接依赖 `@tiptap/*` 的 6 个 package**：
- `editor-shell`（host）
- `editor-drag-handle`（cf-20c-2 — Tiptap 扩展，找 hovered node）
- `editor-slash-menu`（cf-20e/22 — 绑 PM keymap）
- `editor-toolbar`（cf-22 — 绑 PM commands）
- `block-foundation`（`BlockViewProps` shape 为 NodeView 设计）
- `block-markdown`（cf-25 — 显式路由 `<NodeViewContent>`）

**间接 — mdx-bridge**: `loadFromMdx`/`saveToMdx` 序列化的是 PM doc，不是 GridState。

**Wave 6 cf-15..cf-25 几乎全部 Tiptap-coupled**：cf-18 八个 block → NodeView 路由 / cf-19/20a/20b chrome + .ProseMirror → grid substrate / cf-20c-1 applyDropMode (Phase 2B.2 #126 已切 grid-engine) / cf-20c-2/20d/20e drag handle / resize handles / kebab / cf-22 keyboard a11y / cf-23 read-mode / cf-24 PaletteSidebar / cf-25 markdown chunking。

**Wave 7 Phase 2C/D**: 主题底盘 wire 当前在 Tiptap host 上；删 Tiptap 时一并重接。

### 3.2 Tiptap 原始选择理由 (ADR-0001 §1.2)

> "Tiptap 作编辑器底层 → ProseMirror 引擎成熟稳定；NodeView API 让自定义 block 可以是任意 React 组件并保留交互。"
>
> "BlockNote 抽象限制太多；Lexical 社区小；Plate 历史包袱。"

spec §1233 risk register **早就识别了**："Tiptap NodeView 中嵌入 JupyterLite 出现选区 / undo 边界问题 | 中 | 高 | Wave 2 早期做 spike"。Spike 决定继续走 Tiptap。

### 3.3 在 constrained canvas shape 下 Tiptap 原理由全部失效

| 原理由 | 在新心智下 |
|---|---|
| WYSIWYG rich text + heterogeneous nodes 在同一文档共存 | **不需要**。tile 之间没有文档流；只有 markdown tile 内部需要 rich text。Tiptap 在 tile **内部**用是 overkill（一个 tile 一个 Tiptap 实例太重） |
| MDX ↔ doc 双向序列化 | **需求变了**。不再是 MDX ↔ PM doc，是 grid-engine GridState ↔ on-disk format。不经 PM 中转 |
| markdown 快捷键 / 粘贴识别 零自写 | **只需要在 markdown tile 内**。CodeMirror markdown mode / 极简 markdown shortcut handler 都行 |
| 社区成熟度 | 真实风险在 NodeView + JupyterLite 选区 / undo 边界（risk register 早预言）—— Wave 6 cf-22/25 一直在和这个边界打交道 |

简短：**Tiptap 当年选对了 "Notion 风格 block editor" 这个题，但项目实际要做的不是 Notion，是 LEGO + Bento**。题目错了。

### 3.4 MDX 同病

> User: "你觉得 MDX 作为基底是合理的吗"

**MDX 和 Tiptap 是同一个 framing 错误的两面**：

| Substrate | 隐含的 shape |
|---|---|
| Tiptap (PM doc) | "rich text 文档 + embedded custom nodes" |
| MDX | "markdown prose + embedded JSX components" |

两个都假设有一层**基础 prose**，块**嵌在 prose 里**。这就是 Notion-shape 的另一种表达。

在 constrained canvas shape 下：
- 没有基础 prose 层
- 基础是 12×N 网格，tile 坐在网格上
- prose 只存在于 markdown tile **内部**

MDX 里 "段落 — `<Callout col={1} ...>` — 段落 — `<Jupyter col={5} ...>`" 那条**源码顺序 = 可视布局**的核心舒适感，在 tile shape 里**消失了**。源码顺序在网格里没有语义；网格坐标才有。

cf-25 markdown chunking ("怎么把一坨 markdown 切成 per-tile markdown blocks") 是这个错配的具象。这种工作在 tile shape 下根本不该存在；它存在是因为我们试图把 tile 模型塞进 prose-flow substrate。

MDX 在 ADR-0001 给的几个理由今天看：

| 原理由 | 在 tile shape 下 |
|---|---|
| git diff 友好 | 所有 text 格式都满足（JSON / TOML / YAML / 自定义）。不是 MDX 独家 |
| Astro 原生支持 | 服务的是 Notion-shape SSR；tile shape 下需要自定义渲染（按 col/row 绝对定位），Astro `<Content components={map}>` 不再适用 |
| AI agent 可直接 Read/Edit | 见 §5。这个理由本身建立在错误的耦合上 |
| 组件 inline (JSX) | 在 tile shape 下是**缺点** —— tile 坐标变成 JSX attrs (`col={3} colSpan={6}`)，**布局信息塞进内联 attrs**。结构性正确的形态是"布局清单顶部 / content 主体"分离 |

→ **删 Tiptap = 删 MDX substrate**。一致性要求。

---

## 4. Block plugin extension 模型 (LOCKED by user)

### 4.1 User 决定

> "block 这一点，我希望能够把 block 抽象出来可以做成可 extension 模式。即后期想加功能块仅需要写插件即可。"

### 4.2 现状：Wave 1+2 已 70% 是 plugin shape

`packages/block-foundation/src/registry.ts` 的 `BlockRegistry` 已经接任意符合 contract 的 def：

```ts
class BlockRegistry {
  registerCore(core: BlockCoreDefinition): void;
  registerUI(ui: BlockUIDefinition): void;
  getCore(name: string): BlockCoreDefinition | undefined;
  getUI(coreName: string, uiId?: string): BlockUIDefinition | undefined;
  // ...
}
```

`defineCore` / `defineUI` helpers for plugin authors. 同 core 可挂多 UI（uiId 区分）。**这已是 plugin 形态**。

被拖住没成型的两件事：
1. `BlockCoreDefinition.mdxComponent` 字段（Tiptap+MDX 时代 NodeView component name 索引）
2. `BlockKind` 闭合 union（ADR-0009 锁的 `'prose' | 'component' | 'render' | 'viz'`），ADR-0008 D2 把 block-foundation 接口 freeze

### 4.3 新 plugin contract (LOCKED, 详细 §11.3)

Skeleton。完整 contract + 7 sub-decision trace + agentOp/serializer 完整 type signature 见 **§11.3 LOCKED 2026-05-13**。这里给概要：

```ts
type BlockPlugin<BlockState = any> = {
  kind: string;                                  // OPEN identifier, not closed union
  version: string;                               // semver
  propsSchema: z.ZodSchema;
  contentSchema: z.ZodSchema | null;
  defaultSize: { colSpan: number; rowSpan: number };
  EditView: ComponentType<BlockViewProps<BlockState>>;
  RenderView: ComponentType<BlockViewProps<BlockState>>;
  serializer: BlockSerializer<BlockState>;       // toRow sync / fromRow may be async；§11.3
  agentOps?: Record<string, AgentOpDefinition<any, BlockState>>;
                                                 // opt-in；不定义 → 框架 fallback `set_content`；§11.3

  authRequirements?: { read?: 'public'|'auth'|'owner-only'; write?: 'auth'|'owner-only' };
  multiAuthor?: boolean;
  realtimeChannel?: string;
  contentStorageHint?: 'inline' | 'sidecar-table' | 'blob';

  permissions?: Array<'db.read'|'db.write'|'network'|'fs'|'kernel'>;     // §11.15 sandbox hook
  runtimeIsolation?: 'inline' | 'worker' | 'wasm';

  migrations?: Array<{ fromVersion: string; toVersion: string; migrate: (row: DbRow) => DbRow }>;
                                                 // §11.3-7

  paletteEntry?: { displayName: string; icon: string; description: string };
  slashEntries?: Array<{ trigger: string; displayName: string }>;
  resizable?: boolean;
  category?: 'prose' | 'component' | 'render' | 'viz';
};
```

**关键 reframe (2026-05-13)**: agentOps = LLM tool use 模式 scoped 到 plugin。每个 plugin 暴露的 agentOps **就是**该 plugin kind 在 LLM agent context 下可用的 tools。`GET /api/agent/schema` dump 这些 → LLM 直接看 description + input_schema 调度。`packages/agent-api/` wire protocol 可直接采用 Anthropic Messages tool use / OpenAI Function calling / MCP 而不需要自创。详 §11.3 + §11.4 + 后续 ADR-0005。

**discussion-as-block 推论**：

Discussion 不是独立 sub-system，是 plugin 的一个 instance（`kind: 'discussion'`）。一个 note 可以有多个 discussion block 嵌在 canvas 不同位置，配置 props（允许匿名 / 审核 / 是否邮件通知）。Plugin contract 通过新增 4 个字段 cover discussion 的特殊性 —— 不需要 special-case 这种 block kind。

未来 "live chat tile" / "voting tile" / "calendar tile" / "wiki-link tile" / "embedded form tile" 都走同样 plugin contract 实例化。

**Plugin 不是 "8 个 + discussion 子系统"，是 "10+ plugins"**：

```
packages/plugins/markdown/       # rich text source（CodeMirror markdown mode）
packages/plugins/code/           # code source（CodeMirror language modes）
packages/plugins/image/          # image upload + display
packages/plugins/callout/        # variant + title + markdown body
packages/plugins/math/           # TeX + KaTeX preview
packages/plugins/pdf/            # PDF embed
packages/plugins/jupyter/        # ipynb editor + Pyodide execution
packages/plugins/nn-viz/         # TensorFlow.js viz
packages/plugins/agent-flow/     # React Flow graph
packages/plugins/discussion/     # comments thread (新增；多 author / realtime / auth-required write)
```

### 4.4 8 个内置 block 重写为 8 个内置 plugin

**结构和未来用户写的第三方 plugin 一模一样**。`block-foundation` 提供 `BlockRegistry` + `BlockPlugin` 接口 + helpers；不偏袒内置。

老 BlockRegistry → 新 BlockRegistry 的 delta：
- 删 `mdxComponent` 字段
- 加 `serializer` + `agentOps` + `paletteEntry`/`slashEntries` + `defaultSize` + `contentSchema`
- open `BlockKind` (string instead of union)

### 4.5 含义

- `@skb/grid-engine` 不知道 kind 存在，只看到 `Block { kind: string }`
- `@skb/grid-themes` 用 kind 做 hue 映射（可选）
- 未来加 block kind = 写 plugin + register，**不改 core**
- Wave 7 删 Tiptap 时这部分自然完成（NodeView shape 自然消失）

---

## 5. AI agent access via semantic API (LOCKED by user)

### 5.1 User pushback

> "其实 AI agent 一次性读写，这一部分，你受限于 note，md 文档的形式了。我们可以提供专门的 CLI 指令，又或者专门的读取指令来让 agent 获得内容，而不是读文件，里面会有大量 noise，污染模型上下文。"

### 5.2 ADR-0001 §1 原句

> "AI 友好：内容是 MDX 文件，agents 可直接 Read/Edit"

### 5.3 病灶 = 两个 cognitive default 的耦合

- **LLM tool pattern 默认** = "agent has Read/Write filesystem tools" → gatekeeper 默认（从 Claude Code / Codex / Cursor / Gemini CLI 的工作模式 leak 过来）
- **Notion-shape 默认** = "content is one human-readable file" → spec lock 时锁定的 framing

两个默认值合到一起 = "agent 直接读 MDX 文件"。Spec §1 把"agent-edit"具象成"filesystem access"。

### 5.4 拆开 = 正确的形态

- **真实诉求** = agent 能编辑内容，**不污染上下文**
- **文件 access pattern** 只是诉求的一种实现，且是 **noisy 的那种**（agent 会看到 frontmatter、TOML 路径、文件树、文件 metadata，全是 noise）
- **干净的实现** = **专用 semantic API**（CLI 指令 / WebSocket / RPC），agent 调用：
  - `list_notes()`
  - `get_layout(note)` — 返回 block placement table，不含 file paths
  - `get_block(note, id)` — 返回单 block 的 content slab + props
  - `insert_block(note, kind, col, row, content)`
  - `move_block(note, id, col, row)`
  - `resize_block(note, id, colSpan, rowSpan)`
  - `delete_block(note, id)`
  - `edit_block(note, id, op, args)` — 调用 plugin 的 agentOps
- per-plugin agentOps（plugin contract §4.3 的 `agentOps` 字段）：
  - `math.set_tex(tex)`
  - `code.set_source(src)` / `code.set_language(lang)`
  - `callout.set_variant(v)` / `callout.set_body(markdown)`
  - 等
- agent **永远不见**：file paths / directory tree / TOML manifest / disk format

### 5.5 含义

- L9 AI integration 从 "hook for future" 升级成**架构 first-class 层**
- WebSocket 协议沿用（spec §2.6 锁过），命令空间从 Tiptap commands 改成 (grid-engine ops × plugin agentOps)
- 磁盘格式**完全解放** —— 选择依据回到 git diff + 人工编辑 + grid-engine round-trip，**不再需要为 agent readability 服务**
- ADR-0001 §1 "AI 友好：内容是 MDX 文件，agents 可直接 Read/Edit" → erratum 候选；改为 "AI 友好：semantic API，agent 不暴露磁盘形态"

---

## 5.5 Functional zones + 目录映射 (LOCKED 2026-05-13, cascading-confirm)

User 2026-05-12 push back：先功能区域 + 职责归属，再目录树。下表是 12 个 zone 的提案。所有 zone 边界 / 独立 package 判定 / 职责 attribution 在 §0.5 + §3 + §4 + §11.7 + §11.8 + §11.13 + §11.14 等下游决策中已 LOCK；本节是这些 cascading decision 的物理 layout 投影。Promote 2026-05-13。

| Zone | 职责 | 目录 | Owner doc | Status |
|---|---|---|---|---|
| **Z1 Layout engine** | 2D grid 数据结构 + ops + invariant（碰撞 / gravity / hole-fill） | `packages/grid-engine/` | `CONTRACT.md` | ✅ carryover |
| **Z2 Visual theming** | baseplate / chrome / drop preview；多 theme 切换 | `packages/grid-themes/` | `CONTRACT.md` | ✅ carryover |
| **Z3 Block contract** | `BlockPlugin` + `BlockRegistry`；独立 package（user confirmed） | `packages/block-foundation/` | `CONTRACT.md` + API doc | ✏️ 重写 |
| **Z4 Block 实现集** | 10+ plugins（含 discussion） | `packages/plugins/<name>/` | 每个 plugin 自带 CONTRACT.md | ✏️ 新写 |
| **Z5 Compute runtime** | kernel 抽象 + Pyodide | `packages/kernel-adapter/` + `packages/kernel-pyodide/` | CONTRACT.md | ✅ carryover |
| **Z6 Persistence** | **Drizzle ORM (multi-dialect: SQLite + Postgres + 可选 MySQL)** + migrations + repository pattern + plugin serializer 调度；install 时 prompt DB 选择 | `apps/web/src/db/` | `db/README.md` | ✏️ 新写（不独立 package；user confirmed repository pattern OK） |
| **Z7 Auth + multi-user** | Sessions / 用户 / OAuth / discussion 参与者认证 | `apps/web/src/auth/` | `auth/README.md` | ✏️ 新写 |
| **Z8 Editor shell + interaction** | grid-engine + plugins 装载 + drag/resize/a11y/slash/palette/toolbar/kebab | `apps/web/src/shell/` | `shell/README.md` | ✏️ 新写 |
| **Z9 Routes + REST API** | SSR routes + GET/POST endpoints（§11.12 LOCKED GET+POST） | `apps/web/src/routes/` + `apps/web/src/api/` | API spec doc | ✏️ 新写 |
| **Z10 Agent API** | 协议层独立 package（user confirmed）+ dispatcher 在 apps/web | `packages/agent-api/`（协议）+ `apps/web/src/api/agent/`（dispatcher） | `packages/agent-api/CONTRACT.md` | ✏️ 新写 |
| **Z11 Deploy + bootstrap** | 5-mode multi-target install matrix（详 §0.6）：Docker compose / Single binary / Cloud PaaS / Cloud VPS / Edge Workers；cross-arch + cross-DB + cross-storage 适配 | `deploy/` | `deploy/README.md` | ✏️ 新写 |
| **Z12 Docs** | DI / ADRs / runbooks / API references | `docs/` | 自身 | ✏️ 新建 + DI carryover |

**边界决策记录**：

- **Z6 Persistence** 不独立 package：ORM 选择和 framework 高度耦合（Drizzle/Prisma/Knex 各偏好不同），多半绑死 `apps/web/`；repository pattern 在 `apps/web/src/db/` 即可
- **Z10 Agent API** 协议独立 package：未来 desktop app / CLI client / 第三方 agent 都能 import；dispatcher 留在 `apps/web/` 因为它绑定 DB + auth + plugin registry runtime
- **Z11 Discussion zone 删除**：discussion 是 Z4 的一个 plugin (`packages/plugins/discussion/`)，不是独立子系统（§4.3 plugin contract 已扩展支持 multiAuthor / realtimeChannel / authRequirements）
- **Z3 block-foundation 独立 package**：plugin 作者 import target 应稳定可见；plugin 是 first-class extension point

§6 9-layer 是 cross-zone 的技术维度（每个 layer 可能横跨多 zone）；§5.5 zone 是按职责区域划分。两个 view 互补：zone 表对应"我去哪个目录"，§6 layer 对应"如何让 grid-engine + plugin + DB + SSR 协作"。

---

## 6. 整体架构 (LOCKED 2026-05-13, cascading-confirm — 9 layer 是下游所有技术决策的复合结构)

### L1 — 存储

**Server-side DB + Object storage tiering，via pluggable abstractions**：

- **DB**: SQLite / Postgres / Cloudflare D1 / 可选 MySQL —— 通过 **Drizzle ORM** 多 dialect 抽象；operator install 时通过 `DATABASE_URL` env 选驱动
- **Storage**: Local FS / S3-compatible (R2 / AWS S3 / MinIO / Backblaze / Tencent COS / Aliyun OSS) —— 通过 `StorageProvider` interface；`STORAGE_PROVIDER` env 选
- **Search**: SQLite FTS5 / Postgres tsvector / 外部 Meilisearch 等 —— 通过 `SearchProvider` interface

具体 schema 形态见 §11.7；storage 抽象见 §11.13；search 抽象见 §11.14。

Tables (rough shape，plugin contract 决定 `props_json` / `content_*` 列细节)：

```
users               (id, handle, email, password_hash, created_at, role, ...)
notes               (id, slug, owner_id, title, frontmatter_json, visibility, created_at, updated_at)
blocks              (id, note_id, kind, col, row, col_span, row_span, props_json, content_inline)
block_blobs         (block_id, mime, bytes | url_ref)  -- 大 binary (image / pdf / etc.)
sessions            (token, user_id, expires_at)
discussions         (id, note_id, enabled, settings_json)
discussion_posts    (id, discussion_id, author_id, body_md, created_at, parent_id, ...)
```

- Plugin contract 的 `serializer.{toRow, fromRow}` 替代之前的 `{toFile, fromFile}`：每个 plugin 决定它的 content 是 `content_inline` 字段 / 单独表 / `block_blobs` BLOB / 外部 URL ref
- Binary blob：solo scale 用 `block_blobs.bytes` (DB BLOB)；scale 起来用 `block_blobs.url_ref` → object storage (R2 / S3-compat)
- Git 不在 SoT 路径上。Source code / config / migrations 走 git；notes / blocks / discussions 全在 DB
- Schema migrations：tooled（drizzle-kit / prisma migrate / 等）

**Read mode access**：server SSR 从 DB 直接渲染 → response HTML。Public note 加 Cache-Control + CDN。
**Write mode access**：鉴权 session → server-side API → grid-engine ops → DB transaction。
**Agent access**：§5 semantic API → server-side dispatch → grid-engine ops + DB。Agent never sees DB schema / row IDs / SQL。

**LOCKED**: 服务端 DB；具体 DB 引擎和 schema 细节 OPEN（§11.7）。

### L2 — in-memory SoT

```ts
type GridState = { blocks: Block[]; totalCols: 12 };
type Block = {
  id: string;
  kind: string;                              // OPEN per §4
  col: number; row: number;
  colSpan: number; rowSpan: number;
  content: BlockContent[kind];               // kind-discriminated, per plugin contentSchema
};
```

所有变更经 `@skb/grid-engine` ops。

### L3 — 持久化 adapter

`GridState ↔ DB` 双向。每个 plugin 提供 `serializer.{toRow, fromRow}`，adapter composable over plugin registry。**替代 mdx-bridge**（mdx-bridge 删；不再是 "文件系统 serializer"）。

Transaction model：每个 grid-engine op 调用 = 一个 DB transaction（insertBlock / moveBlock / resizeBlock / deleteBlock）。失败回滚。Server-side enforcement of plugin `contentSchema` + grid-engine invariants（no-overlap / in-bounds / gravity invariant per Option A）。

Auth：所有 write 路径 session-gated。Note `visibility` 字段决定 read 路径是否 session-gated（public / private / unlisted）。

### L4 — per-tile content editor

每个 tile mount 它的 plugin 的 `EditView`：

- `markdown` plugin: CodeMirror 6, markdown mode, **source-only 不做 WYSIWYG** (但这是 gatekeeper 当前默认值；§11.1 仍 open)
- `code` plugin: CodeMirror, language mode (由 content kind 决定)
- `math` plugin: TeX source + KaTeX live preview
- `image` / `pdf` plugin: props 表单 (src / alt / page) + preview
- `jupyter` plugin: ipynb cell editor (kernel-pyodide 已有)
- `nn-viz` / `agent-flow` plugin: JSON config + viz preview
- `callout` plugin: variant + title + markdown body (内嵌 CodeMirror markdown mode)

每个 plugin 自带 undo/redo (content-level history)。**没有 cross-tile selection、没有 cross-tile undo**。

### L5 — grid-engine + grid-themes

`@skb/grid-engine` (existing) + `@skb/grid-themes` (existing)。Keep.

### L6 — interaction

沿用 prototype `useGridInteraction` 模式：
- React state 拥 GridState
- HTML5 native DnD (drag + palette-to-canvas insert)
- PointerEvents resize
- slash menu / palette / kebab → 绑当前 focused tile + grid-level ops
- 当前 focused tile 改变 → toolbar 切换成该 tile plugin 的命令集

### L7 — Read mode

**Server-side rendering**，不是 static SSG。Hono SSR (per §11.8) 从 DB 取 note → 按 col/row 绝对定位渲染 → response HTML。

- Public note：Cache-Control + CDN cacheable；写入触发 invalidation（或 stale-while-revalidate）
- Private note：session 鉴权后 SSR；no CDN cache
- Unlisted：URL-knowledge gate；CDN cacheable 但 robots disallow
- 各 plugin `RenderView` 在 server-side 跑（SSR）+ client-side hydrate（needed for interactive blocks 如 jupyter / nn-viz）
- **零 editor runtime in read mode**，零 Tiptap，零 MDX
- 跨 viewport：grid-themes `slotSize` 缩放 + 12/6/1 responsive 切换

**Block ID emission (LOCKED 2026-05-12 per §11.1 hyperlink prereq)**：每个 block 必须输出 stable HTML id wrapper，URL fragment 跳转工作：

```html
<article id="block-<blockId>" data-skb-block data-kind="<kind>" style="grid-area: ...">
  <!-- plugin RenderView output -->
</article>
```

Heading 级 anchor 在 markdown plugin RenderView 内部自动 slugify（GFM 标准），加 `block-<id>-` prefix 防全 note 冲突：`<h2 id="block-b3-some-heading">...</h2>`。

### L8 — undo/redo

两层：
- **grid-level**: GridState immutable 栈，记 block placement 变更 (move / resize / insert / delete)。Ctrl-Z 在 grid 焦点下触发
- **tile-content-level**: 各 tile editor 自带 (CodeMirror / KaTeX / 等)。Ctrl-Z 在 tile content 焦点下触发
- 两层互不影响

### L9 — AI integration (first-class)

per §5 semantic API。WebSocket protocol 沿用。Plugin contract 的 `agentOps` 字段是 plugin 参与 agent 接口的 hook。

协议层独立 package = `packages/agent-api/`（Z10）—— 定义 RPC message shape + auth model + 命令空间 schema + TypeScript types。Dispatcher 在 `apps/web/src/api/agent/` —— 把 RPC call route 到 grid-engine ops × plugin agentOps。

### L9.5 — REST API surface (Z9)

REST endpoints 是 webapp 对人类用户（浏览器）的接口，独立于 agent API（Z10）但 dispatch 到相同的 grid-engine ops + plugin agentOps。

**API style 决策（§11.12 LOCKED 2026-05-12 by user）**: GET + POST collapsed。GET 用于公开 read（CDN cacheable + Lighthouse 友好）；POST 用于全部 mutation；action 通过 **path** 表达不通过 body。PATCH / PUT / DELETE 不用（业内主流 drift + 中间件简化 + 防火墙兼容）。

```
# READ (GET)
GET    /                                          首页（recent / featured）
GET    /notes/:slug                               公开 note SSR HTML
GET    /api/notes/:slug                           note JSON
GET    /api/notes/:slug/blocks/:id                单 block JSON
GET    /api/me                                    当前 user
GET    /api/notes/mine                            我的 notes 列表
GET    /api/agent/schema                          plugin agentOps 发现
GET    /sitemap.xml | /rss.xml

# MUTATION (POST) — session-gated
POST   /api/auth/login | /logout | /register
POST   /api/notes/create                          body: { slug, title, visibility, ... }
POST   /api/notes/:slug/update                    body: { title?, visibility?, theme? }
POST   /api/notes/:slug/delete                    body: {}
POST   /api/notes/:slug/blocks/insert             body: { kind, col, row, colSpan, rowSpan, props, content }
POST   /api/notes/:slug/blocks/:id/move           body: { col, row }
POST   /api/notes/:slug/blocks/:id/resize         body: { colSpan, rowSpan }
POST   /api/notes/:slug/blocks/:id/transform      body: { col?, row?, colSpan?, rowSpan? }
POST   /api/notes/:slug/blocks/:id/delete         body: {}
POST   /api/notes/:slug/blocks/:id/op/:opName     body: pure args (plugin agentOps dispatch)

# AGENT (POST) — API token gated
POST   /api/agent/dispatch                        body: 见 packages/agent-api/CONTRACT.md
WS     /api/agent/ws                              streaming bidirectional
```

**Exposure 矩阵**：

| Pattern | Source | 暴露 | 鉴权 |
|---|---|---|---|
| GET 公开 read | CDN-cacheable HTML/JSON | 公开 | none |
| GET 鉴权 read | private notes / /api/me | 公开 endpoint | session cookie |
| POST mutation | session-gated | 公开 endpoint | session cookie + CSRF token |
| POST agent | API token-gated | 公开 endpoint | bearer token |
| WS agent | API token-gated | 公开 endpoint | bearer token via initial auth msg |

**内部 grid-engine ops never exposed directly** —— 只通过 API endpoint 间接调，endpoint 负责 auth + ownership validation + repository transaction 包装。

---

## 7. Salvage / death list

### 保留

- `@skb/grid-engine` ✓
- `@skb/grid-themes` ✓
- `kernel-adapter` / `kernel-pyodide` (jupyter plugin 用)
- `block-foundation` 的 Schema 部分 + ReadView 部分（接口 reshape，删 NodeView）
- 8 个 `block-*` 包的 propsSchema + ReadView component + content shape；**EditView 全部重写为 plugin EditView**
- Astro toolchain (build / pagefind 集成；但**模式从 SSG 改 SSR**，**不**通过 MDX 通路渲染。如果最终 §11.8 选 non-Astro framework，整套删)

### 删 / 重写

- `editor-shell`：全部，重写为 grid-engine 消费层
- `editor-drag-handle` / `editor-slash-menu` / `editor-toolbar`：删；逻辑搬到新 shell 内
- `mdx-bridge`：删，被 L3 持久化 adapter 替代
- 各 `block-*` 包的 NodeView 实现
- Wave 6 cf-15..cf-25 的实现 (UX 决策可参考；代码作废)
- ADR-0014 / 0016 / 0017 / 0018 → mark superseded by 新 ADR
- ADR-0009 (BlockKind 4-way union) → mark superseded (kind 开放化)
- ADR-0014 HeavyBlockBoundary 形式可能保留 (hydration boundary 在新架构仍需要)

---

## 8. Cognitive defaults observed this session

Gatekeeper 在本对话中暴露的默认值（user 没明说就预设的）：

1. **"improve within category"** → 把 "比 X 更好" 翻译成 "X but better"。需要 user 主动说 "leave the category" 才会跳出。
2. **菜单收窄到 library 层级** → spec lock 时给 user 看 BlockNote/Tiptap/Lexical/Plate，没把 "block editor 这一类要不要" 当选项。
3. **"agent reads file"** → 从 Claude Code / Codex 的工具模式 leak 过来的默认。User 纠正后才意识到。
4. **"BlockKind 闭合 union"** → TypeScript-strict 默认，从 ADR-0009 时代的 codex 9-point checklist "no string-typed enum" 类规则 leak 过来。和 plugin 开放性冲突，默认选了类型安全。
5. **"tile vs canvas" 当架构区分** → 实际只是 default-value 参数选择 (gravity on/off)；user 已纠正。
6. **"per-tile editor 必用 CodeMirror"** → "choose-within-category" 的另一例。没认真考虑 "markdown tile 内部嵌套 canvas" 这种 frame-shifting 可能。

7. **"Spec is ground truth"** → Spec lock 时（2026-04-29）的 brainstorm-Claude 把 user 原始口述需求**翻译**成 spec。后续 session 把 spec 当 ground truth，**从来没回过头问 "spec 翻译对吗"**。本 session §0.5 的发现：ADR-0001 §1.1 deployment topology + §1.8 constraints 1/3/4 是 brainstorm-time 把 user 的 "可部署 server-side 24h webapp" 翻译成 "Cloudflare Pages static + thin backend hybrid"。后续 6 个月所有 substrate / 部署 / storage 决策建立在错翻译上。这是 #1 "improve within category" 的**更上一层** —— spec 本身是 brainstorm Claude 的范畴投影，后续 Claude 应当把 spec 作为有版本的可质疑工件，不是 axiom。

8. **"Content 是 text + 媒体引用"** → 在 propose L1 storage 时默认所有 plugin 的 content 都是 text 字符串（markdown / TeX / code / JSON config），binary（image / pdf bytes）只能靠 sidecar 文件 + URL ref。这是 Obsidian/markdown-wiki 生态默认 leak。Plugin extension 模型下 content 应能是 binary blob / vector / 任何 plugin 能序列化的东西，DB 的 BLOB 列原生支持。User 在 §0.5 触发前直接指出这条预设。

**这些默认值跨 session 反复出现**。每次 session 冷启动时，gatekeeper 不会从 user 之前讨论里继承这些默认值的更正。这是本对话促使开 DI 文档（本文档）的具体原因。

---

## 9. 这次对话留下的 operational lessons

补充 `grid-redesign-2026-05-11.md` §9：

7. **Framing-control 发生在 menu 之前**。给 user 看的菜单 = 已经做完的隐性决策的外显物。需要把 framing 本身当成 first-class 选项。
8. **"User 把 gatekeeper 说服了" 不等于 "user 想清楚了"**。User spec lock 时同意了 Notion-shape，是因为 (a) 那个 framing 听起来合理 (b) 包装在 ADR / risk register / D-list / package structure 装置里显得 load-bearing (c) user 那时没有具体替代词。Gatekeeper 不能把 "user 没反对" 当成 "user 同意"，特别是在 framing 这种 user 无法在抽象层 articulate 的选项上。
9. **Standards 度量 in-frame**。D9/D10 catch 不到 frame 错误；ADR / contract / 9-point checklist 都是 in-frame audit。需要 out-of-frame 度量层 —— 但这层只有 user 能提供，gatekeeper 只能配合 (e.g., 让 user 直接 demo / 不要替 user 编故事 / 把 user 的实际操作经验作为 frame 验证)。
10. **每个 session 的 cognitive default 不继承**。Gatekeeper cold-start 时回到 "improve within category" 默认。需要 DI 文档作为跨 session 持久化层。
11. **"很多东西我们都有讨论过" 是一种反复发生的成本**。Discussion-informed (DI) 文档是 infrastructure，不是可选的 housekeeping。

---

## 10. 这份文档的角色 (DI doc class)

> User: "我觉得就是应该需要 DI 文档"

`docs/design/` 下的文档**不是 ADR**（ADR 是 lock 后的决策记录）；**不是 plan**（plan 是 stage execution roadmap）；**不是 retro**（retro 是 wave close 后的回顾）。

DI doc 是**讨论过程的沉淀**：
- 谁说了什么 (quote-level fidelity)
- 哪些是 LOCKED 决策（user-driven）
- 哪些是 PROPOSED synthesis（gatekeeper-driven，待 user 确认）
- 哪些是 OPEN questions
- 揭露 cognitive defaults / framing biases
- 是后续 ADR 的输入材料

文件命名：`docs/design/<topic>-<date>.md`。Date 是讨论发生日，不是 lock 日。

后续 wave 起 ADR 时，**先读对应 DI doc**，把 LOCKED 部分 promote 到 ADR，PROPOSED 部分跑 plan-challenger，OPEN 部分写进 plan 作为待决策。

---

## 11. Open questions (未决)

### 11.1 Markdown tile editor: Lexical-based WYSIWYG (LOCKED 2026-05-12)

#### Decision

User 2026-05-12: 选 (b) WYSIWYG，但 push back gatekeeper 的 "WYSIWYG 边界问题" 表述：

> "我倾向 b，但是我还是想让你细说一下之前遇到的所谓 WYSIWYG 边界问题。我认为可能不是 WYSIWYG 边界的问题，而是原来的其他问题，导致了需要处理这个问题。"

**User 是对的。Gatekeeper 之前的 (a) source-only 推荐建立在 misdiagnosis 上**。

#### Misdiagnosis correction

Wave 6 cf-15..cf-25 + hotfix #103 共 15 个 PR 痛点 trace：

| 类型 | 数量 | 例子 |
|---|---|---|
| **Tiptap-as-host 问题**（doc-flow 当 2D grid substrate / NodeView 抽象税 / schema collision / PM keymap 排他 / 双路径 chrome） | **14 / 15** | cf-15b schema collision / cf-18 NodeView wiring / cf-20b `.ProseMirror→grid` / cf-20c-1 applyDropMode / cf-22 keymap / cf-25 markdown chunking / hotfix schema-strip 等 |
| **WYSIWYG-inherent 问题**（cursor 在 mark 边界 / 选区跨格式 / 撤销粒度 / 粘贴 Word HTML） | **几乎 0** | 真有的话也被 PM/Tiptap 自身 handle 掉，没成 Wave 6 痛点 |

**误诊根源**：Tiptap 既是 WYSIWYG 引擎又是 host。删 Tiptap 时 gatekeeper 顺手把 WYSIWYG 也判死刑 —— lazy conflation。

**修正**：Tiptap-as-host = 必须删（fatal）；WYSIWYG-inherent = 库自身 handle（与 host 选择正交）。在 isolated tile 边界内用 Lexical/Slate 等 rich text 库不 reopen Tiptap-as-host 病灶，因为：

1. **Editor instance 不当 grid host** —— 每个 markdown tile 一个独立 instance；instance 的 "文档" = 这个 tile 的内容；不知道 grid / 其他 tile 存在
2. **Editor 不暴露 NodeView 给外部** —— inline 元素（粗体 / 链接 / inline code）全在 editor 内部 schema；不暴露给外层 plugin contract / grid layer

#### Default impl: Lexical (Meta)

Per tile mount `LexicalComposer` instance：

```ts
// packages/plugins/markdown/EditView.tsx
function MarkdownEditView({ content, onChange }: BlockViewProps) {
  return (
    <LexicalComposer initialConfig={config}>
      <RichTextPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <HistoryPlugin />
      <LinkPlugin />
      <ListPlugin />
      <OnChangePlugin onChange={(editor) => {
        editor.update(() => {
          const markdown = $convertToMarkdownString(TRANSFORMERS);
          onChange(markdown);
        });
      }} />
    </LexicalComposer>
  );
}
```

Plugin serializer:

```ts
toRow: (state) => ({ content: state.markdown }),       // DB 存 markdown string
fromRow: (row) => ({ markdown: row.content || '' }),
```

**DB content 仍是 markdown string** —— Lexical 是 view-layer，存储不变；AI agent 通过 `agentOps.set_markdown(content)` 改字符串；git diff / 备份 readable。

替代候选 `MDXEditor`（基于 Lexical 预配置 markdown）—— 如默认 Lexical 配置太重可 drop-in。

#### 同形态延展到其他 plugin

- `callout` body → 同 Lexical instance（rich markdown body）
- `code` plugin → CodeMirror language mode（source-only，code 本来就没 WYSIWYG）
- `math` plugin → TeX source + KaTeX preview（同上）
- `image` / `pdf` / `nn-viz` / `agent-flow` → no rich text，跳过
- `discussion` plugin posts body → Lexical instance（评论也是 markdown）

#### 非 markdown-fluent 用户

User 表态：**不替代 markdown plugin，以新 plugin 形式提供**。

未来 phase 2+ 可加：
- `rich-text` plugin (kind: `'rich-text'`) —— 完全隐藏 markdown 语法 from user；存储是 Lexical JSON tree（不是 markdown string）；适合 Word/Notion 迁移用户
- `prose-canvas` plugin —— nested canvas 形态（option c 路径）

这些都是**新 plugin**，markdown plugin 形态不动。

#### 跨引用层次（hyperlink + anchor + wikilink + 反向链接 + 嵌入）

User 2026-05-12 asked: "超链接至其他页面/其他块/其他段能做吗？"

5 个 level，Day-1 ship 哪些：

| Level | Syntax / 形态 | Day-1 | Phase 2+ |
|---|---|---|---|
| **1 跨 note 链接** | `[text](/notes/slug)` 标准 markdown | ✅ `LinkPlugin` 开箱即用 | |
| **2 跳到 note 内特定 block** | `[text](/notes/slug#block-b3)` URL fragment | ✅ 需 read-mode SSR 在每个 block container emit `id="block-<id>"`（见下 prereq） | |
| **3 跳到 block 内 heading** | `[text](/notes/slug#heading-slug)` | ✅ `@lexical/markdown` 标准 GFM heading 自动 slugify；冲突防御加 `block-<id>-` prefix | |
| **3.5 跳到 block 内段落** | 非标准 anchor | ✗ | △ 后续：pandoc-style `{#anchor}` extension via Lexical transformer 或 paragraph ID 自动生成 |
| **4 Wikilink + @-mention** | `[[slug]]` / `[[slug#block-id]]` / `@user` 非标 | ✗ | ✅ 自定义 Lexical `DecoratorNode` (WikiLinkNode) + `TypeaheadMenuPlugin`（`[[` 触发查询）+ `packages/link-resolver/` service 解析 slug → title cache |
| **5 反向链接 + transclusion** | "Referenced by" backlinks / `![[slug#block]]` embed | ✗ | ✅ DB `block_links` index（write-time parse）+ `packages/plugins/embed/` plugin（transclusion 是 block 不是 inline）|

**Day-1 ship**: levels 1 + 2 + 3，标准 markdown link 全 cover。
**Phase 2+**: wikilink typeahead / mentions / backlinks index / embed plugin —— scope 各自独立 plan。

#### Architectural prerequisites

链接系统依赖两个不变量，须在 §6 L7 + §11.7 显式 LOCK：

1. **Block ID stable**: DB `blocks.id` 是 UUID（cuid2 / nanoid），**永不重用**（删除 block 后 ID 不分配给新 block）→ 跨外部引用稳定
2. **Read-mode SSR emit block id**: 每个 block 渲染时输出 `<article id="block-<id>" data-skb-block ...>` wrapper → URL fragment 跳转工作

→ §6 L7 add "block ID emission" 段
→ §11.7 schema 加 ID 稳定性不变量注释

### 11.2 ~~存储 primary 优先级~~ (CLOSED 2026-05-11 by §0.5)

原问题 "TOML+per-block-files vs single-file" 在 §0.5 LOCK "server-side DB" 之后**不再适用**。底层不是 file system，是 DB。具体 DB 选择 → §11.7。Storage 形态相关的新 open question 见 §11.7 + §11.8 + §11.9。

### 11.3 Plugin contract 细节 (LOCKED 2026-05-13)

#### 元 reframe (2026-05-13 by user)

> "本质上似乎就是 tool use 的不同 block 版本的 patch。"

User 准确捕捉到 agentOps = **LLM tool use 模式 scoped 到 plugin**。每个 plugin kind 暴露它自己的 tool definitions；`GET /api/agent/schema` dump 全部 → LLM agent 看 description + input_schema → 调 `POST /api/.../op/:opName`。

Field-by-field 映射 Anthropic/OpenAI tool use SDK：

| LLM tool use SDK | 我们的 agentOps |
|---|---|
| `tool.name` | agentOp's map key |
| `tool.description` | `AgentOpDefinition.description` |
| `tool.input_schema` (JSON Schema) | `AgentOpDefinition.argsSchema` (zod → JSON Schema via `zod-to-json-schema`) |
| Tool execution callback | `AgentOpDefinition.handler` |

含义: `packages/agent-api/` 可能不需要发明 wire protocol —— 直接采用 Anthropic Messages tool use / OpenAI Function calling / MCP 等已有 protocol，wrap 后作为 agent dispatch 协议。具体见 §11.4 + 后续 ADR-0005。

#### 7 个 sub-decision

**(1) agentOps 是否必填**: opt-in。Plugin 不定义 → 框架 fallback 自动 `set_content`（基于 `contentSchema`）。简单 plugin (markdown / math) 无需写；复杂 plugin (discussion / jupyter / nn-viz / agent-flow) 自定义多个 verb。

**(2) Human + Agent 同 API**: 人类 EditView 编辑 → 本地 React state（零 RPC）→ debounce/blur/explicit save → commit 同一 endpoint → 同一 handler。Agent 直接 RPC 调同 endpoint。鉴权统一 middleware，per-op `authRequirements` enforce。

**(3) agentOp 完整 signature**:

```ts
import { z } from 'zod';
import type { StorageProvider } from '@skb/storage';
import type { SearchProvider } from '@skb/search';

type AgentOpContext = {
  noteId: string;
  blockId: string;
  userId: string | null;
  storage: StorageProvider;                       // §11.13
  search: SearchProvider;                         // §11.14
  engine: GridEngineReadFacade;                   // 只读；write 必须走另一 op
  broadcast: (channel: string, msg: unknown) => void;  // §11.4 WebSocket push
  log: (level: 'info'|'warn'|'error', msg: string) => void;
};

type AgentOpResult<NewState> =
  | { ok: true; next: NewState }
  | { ok: false; error: string; code?: 'invalid_args' | 'unauthorized' | 'conflict' | 'not_found' | 'internal' };

type AgentOpHandler<Args, BlockState> = (
  args: Args,
  current: BlockState,
  ctx: AgentOpContext
) => Promise<AgentOpResult<BlockState>>;

type AgentOpDefinition<Args, BlockState> = {
  argsSchema: z.ZodSchema<Args>;
  handler: AgentOpHandler<Args, BlockState>;
  description: string;
  authRequired?: boolean;                         // default true
  idempotent?: boolean;                           // metadata only；framework 不强制
};

export function defineAgentOp<Args, BlockState>(
  def: AgentOpDefinition<Args, BlockState>
): AgentOpDefinition<Args, BlockState> {
  return def;   // TS 推断 helper
}
```

设计 trace:
- **Async-only**: 多数 op 涉及 storage/search/DB IO
- **Result type，不 throw expected error**: 4xx 类 error 走 `{ ok: false }`；throw 留给 unexpected
- **Capability-based context**: plugin 通过 `ctx.X` 访问外部 system；不 import 全局 singleton（为 §11.15 sandbox 留 hook）
- **`engine` read-only**: plugin handler 不能直接调 grid-engine write ops；想触发 layout 变更必须 agent / human 显式调 top-level grid ops
- **Idempotent metadata only**: plugin 作者声明；framework 不强制 dedup；client SDK 读这个 flag 决定 retry 策略
- **错误码 5 种**: invalid_args→400 / unauthorized→401 / not_found→404 / conflict→409 / internal→500
- **Return `next` full state Day-1**: 简单；Phase 2+ payload 大可加 delta option

**(4) serializer streaming**: 完全无 streaming。

```ts
type DbRow = {
  contentInline?: string | null;
  blobRefs?: Array<{ key: string; mime: string; size?: number; hash?: string }>;
};

type SerializerContext = { storage: StorageProvider };

type BlockSerializer<BlockState> = {
  toRow: (state: BlockState) => DbRow;                                   // 必 sync；txn 内运行
  fromRow: (row: DbRow, ctx: SerializerContext) => BlockState | Promise<BlockState>;
};
```

理由:
- 大 text content (markdown / code) → DB driver 自身 handle string IO；plugin 不需要 stream
- 大 binary (image / pdf / nn-viz weights / ipynb image outputs) → plugin agentOp handler 用 `ctx.storage.put()` 上传；DB row 只存 URL ref
- 大 ipynb 含 embedded image outputs → plugin handler 拆 cells，text cell inline，image cell 走 storage；DB 存 split
- `toRow` 必 sync 因为 write transaction 内执行；所有 IO 应**先于** toRow 完成

**(5) Plugin 之间通信**: 无直接调用。所有跨 plugin 交互：
- Read: `ctx.engine.getBlock(noteId, blockId)` / `ctx.engine.queryBlocks(filter)`
- Write: 必须通过 agent API dispatch 显式触发其他 plugin 的 agentOp
- 反模式: `ctx.getPlugin('discussion').handler.create_post(...)` —— **不允许**

理由: plugin 间 direct call 引入隐式依赖图；难推理、难 sandbox、难 lifecycle 管理。

**(6) Plugin 注册时机**: 显式 startup 注册。

```ts
// apps/web/src/plugins-init.ts
import { BlockRegistry } from '@skb/block-foundation';
import { markdownPlugin } from '@skb/plugin-markdown';
import { codePlugin } from '@skb/plugin-code';
import { discussionPlugin } from '@skb/plugin-discussion';
// ... 10 plugins

export function createRegistry(): BlockRegistry {
  const reg = new BlockRegistry();
  reg.register(markdownPlugin);
  reg.register(codePlugin);
  reg.register(discussionPlugin);
  // ...
  return reg;
}
```

不用 module-load auto-register（污染 import side-effects、阻碍 bundle 分析）。Operator 加 plugin 时同样模式 import + register。

Client side: `EditView` / `RenderView` 走 `React.lazy()` 动态 import，只加载当前 note 用到的 kind。

**(7) Plugin versioning + 迁移**: 

```ts
type BlockPlugin = {
  // ...existing
  version: string;                            // semver
  migrations?: Array<{
    fromVersion: string;                      // e.g. '1.1.x'
    toVersion: string;                        // e.g. '1.2.0'
    migrate: (row: DbRow) => DbRow;
  }>;
};
```

DB `blocks.plugin_version` text 列。读 row 时框架检查；如 < current `plugin.version` → 跑 applicable migrations → 再 `fromRow`；下次 `toRow` write 更新 version。

**Lazy migration**: 读到才 migrate；不强制 batch upgrade。

**Plugin breaking change rule**:
- patch / minor → 必 backward compatible（旧 row 仍 fromRow，新字段 default）
- major → 必提供 migration step

#### 不在 contract 里的（Day-1 不要，Phase 2+ 可加）

- **Lifecycle hooks** (onInsert / onDelete / onMove / onResize): 反应链失控；Phase 2+ 通过 EventBus capability `ctx.subscribe()` 加，向后兼容
- **Delta return**: Day-1 always return full BlockState
- **Optimistic concurrency** (expectedVersion in args): plugin 可自定，framework 不内置；Phase 2+ 协作场景需要再 promote
- **ReadOps** (plugin-specific 分页 read): 标准 GET endpoint Day-1 足够；Phase 2+ 加 `readOps` 字段

#### 最终 BlockPlugin contract

```ts
type BlockPlugin<BlockState = any> = {
  kind: string;
  version: string;
  propsSchema: z.ZodSchema;
  contentSchema: z.ZodSchema | null;
  defaultSize: { colSpan: number; rowSpan: number };
  EditView: ComponentType<BlockViewProps<BlockState>>;
  RenderView: ComponentType<BlockViewProps<BlockState>>;
  serializer: BlockSerializer<BlockState>;
  agentOps?: Record<string, AgentOpDefinition<any, BlockState>>;

  // §4.3 discussion-as-block 推广
  authRequirements?: { read?: 'public'|'auth'|'owner-only'; write?: 'auth'|'owner-only' };
  multiAuthor?: boolean;
  realtimeChannel?: string;
  contentStorageHint?: 'inline' | 'sidecar-table' | 'blob';

  // §11.15 sandbox hook (default inline)
  permissions?: Array<'db.read'|'db.write'|'network'|'fs'|'kernel'>;
  runtimeIsolation?: 'inline' | 'worker' | 'wasm';

  // §11.3-7 versioning
  migrations?: Array<{ fromVersion: string; toVersion: string; migrate: (row: DbRow) => DbRow }>;

  // 显示侧
  paletteEntry?: { displayName: string; icon: string; description: string };
  slashEntries?: Array<{ trigger: string; displayName: string }>;
  resizable?: boolean;

  category?: 'prose'|'component'|'render'|'viz';
};
```

→ ADR-0014 Plugin contract details 收录上述全部决策。

### 11.4 Agent wire protocol: MCP + SKILL.md 双层 (LOCKED 2026-05-13)

旧 spec 2026-04-29 选 "Anthropic Agent SDK + Custom Tools + WebSocket（非 MCP）"。这个判断在 2025 MCP 走到 Linux Foundation AAIF（Anthropic + AWS + Google + Microsoft + OpenAI + Block + Bloomberg + Cloudflare 等 platinum members）+ 私有扩展时代结束 + universal standard 形成之后**完全不适用了**。新 repo clean cut，直接采用 MCP + Skills 双层。

#### Researcher findings (2026-05-13 dispatch)

(详细 sources 见 dispatch 记录；以下是 verdict 摘要)

- **MCP 和 Skills 不是互斥，是互补**：MCP = "what"（data + actions + 网络协议）；Skills = "how"（procedural knowledge + progressive disclosure）；Skills 不是 network protocol，不能 expose 可调用 endpoint
- **MCP 迭代实际慢** —— 2025-11-25 spec 后只 ship 了 MCP Apps (2026-01-26) 和 Code execution pattern (2025-11-04) 两个主扩展；同期 Skills 32+ client 接入 + ~89k skills marketplace
- **MCP 跨 client 覆盖广** —— 写一份 MCP server 跨 Claude (Desktop/Code/.ai) / ChatGPT (Apps SDK + Responses API hosted MCP) / Cursor / Gemini CLI / VS Code Copilot / Cline / Zed / Continue / Codex / Goose 全部 work
- **OpenAI Responses API 原生支持 remote MCP server**；**Gemini SDK 自带 MCP integration** —— 我们一份 MCP 实现自动 cover 三家 LLM provider 的客户端
- **OAuth 2.1 + PKCE + RFC 8707 + HTTPS 是 public MCP server 强制要求**（2025-06 spec update 关闭 token-leak）
- **Skills progressive disclosure 解决 MCP "全 tool list 注入 context" 的 known limit** —— ~100 words metadata 常驻 + 触发后加载 full body
- **Code execution with MCP 模式 (Anthropic 2025-11)** 给 LLM 写 TS 调 MCP 而不是塞全部 tool 定义 —— Drive→Salesforce 案例 token usage 150k → 2k (98.7% 降低)

#### Architecture lock

```
Tier 1 — REST (§11.12 unchanged)
  浏览器 human UI 主路径 (cookie session + CSRF)
  浏览器内 AI assistant path (a) 通过 REST/SSE 调
  Auto OpenAPI gen 供不支持 MCP 的 client 读

Tier 2 — MCP server (universal LLM client 接入)
  Transport: Streamable HTTP (单 endpoint, stateless-capable, 替代旧 HTTP+SSE)
  Auth: OAuth 2.1 + PKCE + RFC 8707 Resource Indicators，HTTPS mandatory
  Endpoint: https://<operator-domain>/mcp
  Server primitives:
    - tools  = plugin agentOps 投影 (每 plugin 的 agentOps 自动 expose)
    - resources = block / note URI-addressable read access
    - prompts (optional) = 预设 system prompts 模板
  Client coverage: Claude.ai / ChatGPT / Cursor / Gemini CLI / VS Code / Cline / Zed / Continue / Codex / Goose / Junie / Kiro 等 32+
  Self-hosted instance 自己当 OAuth issuer，reuse 平台 user auth

Tier 3 — SKILL.md companion (progressive disclosure 配套)
  形态: skills/<product>/SKILL.md + YAML frontmatter + Markdown body + bundled scripts
  三层 disclosure: metadata ~100 words 常驻 / body 触发后加载 / bundled 按需
  解决 "MCP tool list 全注入 context → 准确率掉" 已知问题
  32+ skill-aware client 自动 lazy-load (Claude Code / Codex CLI / VS Code / ChatGPT / Gemini CLI / Junie / Kiro / Goose / Amp / Cursor / Cline / 等)
  **augment** MCP 不替代它

Tier 4 — SSE (server → client push)
  独立 endpoint: GET /api/sse/subscribe?channel=...&token=...
  用于: discussion 新评论 / 通知推送 / server-side AI assistant 响应流
  MCP Streamable HTTP transport 内部已自带 SSE，复用相同基础设施

Tier 5 — WebSocket
  Day-1 不要
  Phase 2+ 协作 (CRDT) / 多用户实时编辑场景再开
```

#### 双路径 (a) + (b) 在新协议下的形态

| Path | wire protocol | LLM 位置 |
|---|---|---|
| **(a) In-app AI assistant** | REST + SSE (浏览器 ↔ server)；server 内部 in-process 调 agentOps | Server 用 LLMProvider 调外部 LLM API（operator config 选 Anthropic/OpenAI/Ollama/Together/Groq） |
| **(b) External LLM client** | MCP over Streamable HTTP + OAuth 2.1 | Operator 自己的 LLM IDE (Claude Desktop / Cursor / Gemini CLI / etc.) |

两条路径共享 **agentOps registry**；不同 caller 经不同 wire protocol，dispatch 到同一组 plugin handler。

#### 不做的

- **不自卷协议** —— pre-MCP 时代私有协议结束；写自定义 wire 是反模式
- **不分别写 OpenAI / Gemini / Anthropic adapter** —— 三家都说 MCP 了
- **不用 Skills 替代 MCP** —— Skills 是静态知识，不是 network protocol；augment 不 replace
- **不等下个 MCP spec bump** —— 2025-11-25 base 已 stable；扩展通过 working group 持续 ship
- **WebSocket Day-1 不要** —— MCP Streamable HTTP + 独立 SSE 已 cover Day-1 全部需求

#### Phase 2+ 演进路径

- **MCP Apps (SEP-1865)** → canvas block 渲染到 chat 里 (双沙箱 iframe + postMessage)；composes on existing MCP tools，零 rework
- **Code execution pattern** → 给 LLM 写 TS 调 MCP API client，不塞全部 tool 定义；上下文成本降两个数量级
- **A2UI 等 alt 协议** → 监控；当前 MCP Apps 是 cross-vendor traction 最强的

#### 实现 zone update

- **Z10 Agent API** scope 收紧到 MCP + SKILL.md companion + OAuth 2.1 provider
- `packages/agent-api/` 内容：
  - `@modelcontextprotocol/sdk` wrapper（暴露 agentOps 为 MCP tools）
  - OAuth 2.1 + PKCE provider impl（issuer 复用平台 user auth）
  - SKILL.md template / generator（从 agentOps registry 自动生成 SKILL.md）
  - Streamable HTTP transport handler
- **NEW Z14 LLM Provider**: `packages/llm-provider/` 多 adapter（Anthropic / OpenAI / Ollama / Together / Groq / 自定 endpoint）—— 给 path (a) 用

### 11.5 新 repo bootstrap evolution path (LOCKED 2026-05-13)

Clean-cut 后这条 reframe：不是"旧 repo 迁移"，是**新 repo 从空 → ship**的演化路径。Solo dev + AI/codex 加持，**不绑时间表**（进度不可预测）；按 milestone 演进，每 milestone 一个 user-visible 终点。

#### M1: Foundation skeleton

**目标**: 空 repo → typecheck-green monorepo with carryover packages dropped in，no app feature yet。

- pnpm workspace + tsconfig.base + biome lint + vitest workspace
- Carryover 4 packages 物理 drop in：`grid-engine` / `grid-themes` / `kernel-adapter` / `kernel-pyodide`
- `packages/block-foundation/` NEW — BlockPlugin contract + Registry (§4.3 / §11.3)
- `packages/storage/` NEW — StorageProvider interface + LocalFsProvider + S3CompatProvider stub
- `packages/search/` NEW — SearchProvider interface + SqliteFtsProvider stub
- `packages/llm-provider/` NEW — LLMProvider interface + 1-2 adapter stub
- `packages/agent-api/` NEW — MCP server skeleton (types only)
- `apps/web/` empty Hono + Bun + "hello" route
- `docs/design/` + `docs/decisions/` 含 2 个 DI doc carryover
- `deploy/` 基线：install.sh / Dockerfile / env.example
- CI: typecheck + lint + vitest，全绿

**Acceptance**: `pnpm install && pnpm typecheck && pnpm test && pnpm dev` 跑通；浏览器看到 "hello world" 页。

#### M2: First end-to-end slice (= minimum shippable)

**目标**: 一个 user 能 login → 创建 note → 加 markdown block → save → reload → 看见。同时 publish 公开 read-only 链接。**此时已是可用的"个人 markdown 笔记 + 公开发布" webapp**。

- `apps/web/src/db/` — Drizzle schema (users + notes + blocks + sessions) + SQLite migration + drizzle-kit
- `apps/web/src/auth/` — password + JWT cookie + 1 admin account from `.env`
- `apps/web/src/api/` — REST endpoints (§6 L9.5 子集):
  - POST `/api/auth/login | logout`
  - POST `/api/notes/create | :slug/update | :slug/delete`
  - POST `/api/notes/:slug/blocks/insert | :id/move | :id/resize | :id/delete | :id/op/:opName`
  - GET `/api/notes/:slug` + read by slug
- `apps/web/src/shell/` — editor shell（基本 grid + drag + resize；按 `_reference/prototype/` 的 `useGridInteraction` 模式新写）
- `packages/plugins/markdown/` NEW — **第一个 plugin，reference impl**：Lexical EditView + RenderView + serializer + agentOps.set_content
- `apps/web/src/routes/` — SSR routes：
  - `/` homepage (recent notes)
  - `/notes/:slug` 公开 read mode
  - `/notes/:slug/edit` auth-gated edit mode
- `deploy/` Docker mode 通：`docker compose up -d` → 访问 `localhost:3000`
- CI 加 Playwright smoke (1 个 end-to-end: login → create → edit → save → reload → see)
- CI 加 lighthouse-ci 跑 `/` 和 `/notes/:slug`
- **Side-branch: Mobile responsive polish** — grid-themes 12/6/1 切换已存在，只 polish breakpoint + touch event；不阻塞 M2 主线 acceptance

**Acceptance**: 本地 docker 跑起来，登录，写 markdown note，发布；匿名浏览器访问公开 URL 看到；Lighthouse > 90。

#### M3: Plugin breadth + AI integration

**目标**: Light plugins 全到位 + path (a) in-app AI + path (b) MCP server。

- `packages/plugins/code/` — CodeMirror language modes
- `packages/plugins/image/` — upload + storage provider integration（验证 S3-compat 路径）
- `packages/plugins/callout/` — variant + body markdown
- `packages/plugins/math/` — TeX + KaTeX
- `packages/plugins/pdf/` — iframe embed + storage
- `apps/web/src/ai/` — in-app AI assistant:
  - LLMProvider 实例化（default Anthropic via `.env` API key）
  - Server-side agent loop（messages + tools + stream）
  - REST/SSE endpoint POST `/api/ai/chat`
  - 浏览器 sidebar React component
- `packages/agent-api/` MCP server impl:
  - `@modelcontextprotocol/sdk` wrap
  - OAuth 2.1 + PKCE provider
  - `tools/list` 从 BlockRegistry 自动 derive
  - SKILL.md generator
- `apps/web/src/api/mcp/` endpoint
- CI 加 MCP integration test

**Acceptance**:
- Webapp 内 AI sidebar，说"在这个 note 加一个 callout 块说 'hello'"，AI 调 agentOp → callout 出现
- Claude Desktop 配 connector 指向 `localhost:3000/mcp`，让 Claude "list my notes"，MCP 调用返回列表

#### M4: Heavy plugins + production polish

**目标**: 全 10 plugins + 多 deploy target 验证 + production-ready。

- `packages/plugins/jupyter/` — ipynb editor + Pyodide execute
- `packages/plugins/nn-viz/` — TensorFlow.js viz
- `packages/plugins/agent-flow/` — React Flow graph
- `packages/plugins/discussion/` — sidecar `discussion_posts` table + realtime SSE push
- `apps/web/src/ai/heavy-block-boundary` — SSR skeleton + client hydrate pattern
- `deploy/` 全 5 mode 测试通过（docker / single-binary / Fly / Render / Cloudflare）
- 公开 docs site (redocly 渲染 OpenAPI spec + DI docs)
- Lighthouse 90+ 跨所有 route
- Backup / migration utility (`deploy/backup.sh` / `deploy/migrate.sh`)

**Acceptance**: 邀请第 2 个 operator 自部署到他的 NAS / VPS，按 install 文档一键 deploy，能用。

#### LOCKED sub-decisions

- **(a) 第一个 plugin = markdown** —— canonical 用例，验证全 contract，后续 9 plugin 抄模板
- **(b) Solo dev workflow，不上 ADR-0011 D1 pipeline** —— CI typecheck + lint + vitest + playwright + lighthouse 够 Day-1
- **(c) DB Day-1 SQLite only** —— Postgres adapter M3 或 M4 加（pluggable contract 已 lock）
- **(d) Auth Day-1 password + JWT only** —— OAuth 2.1 provider M3 给 MCP 用，不是 user auth；user-auth M4+ 再加 OAuth provider
- **(e) Old content 不迁移** —— `content/notes/sample-blocks/index.mdx` 不搬；M2 写新 hardcoded sample
- **(f) `_reference/prototype/` 是 reference 不是 lift** —— 物理 carryover 但 dev 不抄；按 prototype 模式重写新代码

#### 不在 §11.5 scope 内（folded out）

- **Plugin marketplace UX** (browse / install / update / sandbox) → Phase 2+，不在 M1-M4
- **多 operator deployment / contributor coordination** → Solo dev 起步不考虑
- **Mobile native app / desktop Tauri** → M4+ 或 Phase 2，独立 plan

### 11.6 UX design intent inventory (LOCKED 2026-05-13)

#### Reframe

旧 repo git history 全部 cut，旧实现代码不搬。但旧实现过程中**实地验证过的 UX 决策**值得作为 design intent 记录到本 DI doc，新 repo 起步时直接采用，避免重新踩坑。

#### 三类划分

**(A) 旧 Tiptap-host 病灶产物**（在新 arch 自然消失，无需"移植"）:

- NodeView wiring per-block — 新 arch plugin = React component，不需要 NodeView 包装
- Schema collision fix (PM `code` mark vs block-Code) — 新 arch 每 plugin instance 独立 editor，无 schema 共享
- MDX-bridge JSX-attr coercion / `mdxFlowExpression` 容错 — 新 arch 无 MDX
- `applyDropMode` 4-mode split-with-shrink — grid-engine intent 推断 + hole-fill 替代
- `.ProseMirror → grid` substrate hack — 新 arch HTML 直接 grid-engine 渲染
- Markdown chunking pass — markdown 就是 plugin，无 "chunk prose into blocks" 需求
- PM keymap 与自写 keyboard handler 冲突 — 新 arch 无 PM
- Drag handle PM passthrough 协议 — 新 arch HTML5 native DnD 直接 wire
- 双路径 chrome 统一 (editor NodeView vs read SSR) — 新 arch 单一 RenderView 跨 read + edit

**(B) Universal UX choice 可直接移植到新 repo Day-1**:

- **Per-kind visual identity**: 每 block kind 有专属 hue + 顶 2px stripe + chrome card；read mode 和 edit mode 视觉一致。→ grid-themes 已 cover；plugin paletteEntry 提供 icon + color hint
- **Drag handle 形态**: hover block 显示左侧 grab handle (≡ 三横线 icon)；click+hold 启动 drag；ghost preview 跟 cursor；drop pulse 反馈成功
- **Resize handles**: 6-axis（right / bottom / corner-br / left / top / corner-tl）；PointerEvents (非 HTML5 DnD)；commit on release；resize 中显示 ColRuler + RowLadder 网格线 + SizeTooltip 当前 colSpan × rowSpan
- **Kebab menu** (block 右上 ⋮): Delete / Duplicate / Change kind via drop-and-default；popover layout (非 modal)
- **Slash menu** (输入 `/`): popover 列出当前 cursor 上下文可用 block kinds + agentOps；keyboard nav (↑↓ / Enter)
- **Palette sidebar** (左 rail): block kind 列表 + drag 出来插入到 canvas；external-source drag protocol (外部文件 / URL 拖入)；折叠 / 隐藏可配
- **Toolbar** (block-focused 后顶部浮): 当前 plugin 的 agentOps 子集 + 通用操作 (move / resize / delete)；上下文敏感 (markdown block 显 bold/italic，code block 显 language picker)
- **Keyboard a11y**: 
  - Tab 进 block → 进入 plugin EditView 内焦点
  - Esc 退出 plugin 焦点 → 回 grid 焦点
  - Arrow keys 在 grid 焦点下 = 移动 block selection；在 plugin 焦点下 = 编辑器内导航
  - LiveAnnouncer 广播 "block moved to col 5 row 3" 等给屏幕阅读器
  - Tab 退出 plugin 后焦点 return 到原 block + 视觉 ring
- **Read-edit visual parity**: 同一 note 在 read mode 和 edit mode 布局完全一致；BaseLayout wide opt-in（讨论版 / 全文 note）+ 4-viewport (mobile 1col / tablet 6col / laptop 12col / desktop 12col) width-parity 测试
- **Drop ghost preview**: drag 中显示目标位置 outline overlay + 颜色编码 valid (绿) / invalid (红)；intent 推断 (hole-fill / 右侧 / 下方 等) 显式 highlight
- **Drag cancel**: Esc cancel 进行中的 drag/resize，恢复 pre-drag state

**(C) Tiptap-限制 workaround，新架构回到"本来想做的形态"**:

- **Drag handle**: 之前要走 PM passthrough；新架构 HTML5 native DnD per block element 直接 work（prototype `useGridInteraction.blockDragProps` 已示范）
- **Block insert from palette**: 之前要 PM transaction 包装；新架构 `useGridInteraction.paletteDragProps` 直接调 `insertBlock` ops
- **Markdown rich content**: 之前 NodeView + content slot 复杂；新架构每 markdown plugin 实例 = 独立 Lexical instance，互不干扰
- **Block change-kind** (kebab 的 "change kind"): 之前要 PM `replaceWith` + attr 迁移；新架构 `deleteBlock` + `insertBlock` + content 转换 handler (per plugin pair)
- **Outline overlay drag preview**: 之前要绕 PM rendering pipeline；新架构直接 React 渲染 absolute-positioned overlay div

#### Day-1 必 ship 的 UX 决策 list（lift to new repo design intent）

按 zone 整理，新 repo `apps/web/src/shell/` 实现时按这个 spec：

1. **Block chrome (Z2/Z4)**: per-kind hue + 2px top stripe + card border + drop shadow on hover (per `grid-themes`)
2. **Drag handle (Z8)**: hover-reveal 左侧 grab handle；HTML5 DnD；ghost preview；drop pulse animation
3. **Resize handles (Z8)**: 6-axis；PointerEvents；ColRuler + RowLadder + SizeTooltip during resize；commit on release；collision validate + reject red ghost
4. **Kebab menu (Z8)**: ⋮ icon top-right；popover；Delete / Duplicate / Change-kind
5. **Slash menu (Z8)**: `/` trigger；popover；contextual block kind list + agentOps
6. **Palette sidebar (Z8)**: 左 rail；可折叠；drag-out 插入；external-source drop
7. **Toolbar (Z8)**: focus-block-driven 浮顶 toolbar；plugin agentOps + universal ops
8. **Keyboard a11y (Z8)**: Tab in/Esc out + Arrow keys + LiveAnnouncer + focus return
9. **Read-edit parity (Z7)**: BaseLayout wide opt-in + 4-viewport width-parity locked
10. **Drop ghost (Z8)**: outline overlay + intent highlight + green/red valid feedback
11. **Drag/resize cancel (Z8)**: Esc cancel rollback
12. **Per-kind visual identity (Z2)**: grid-themes hue map + plugin paletteEntry icon/color

每条不是 "port code from old PR"，是 "design intent，新实现时按这个 spec"。

#### 不 ship 的（旧 cf-PR 教训留作 negative example）

- 单一 ProseMirror 文档容器装 grid 是反模式 (cf-20b)
- 把 layout 决策塞进 PM transaction 是反模式 (cf-20c-1 applyDropMode)
- 把 prose 流式内容硬拆成 grid block 是反模式 (cf-25 markdown chunking)
- vitest unit + jsdom 测试通过 ≠ user 烟测通过 (Wave 5 C.4-prelude 教训)

这些是 §8 cognitive defaults + §1 framing 失败的具体案例化，已记录在 §1 + §8。

### 11.7 DB engine: pluggable via Drizzle ORM (LOCKED 2026-05-12)

User 2026-05-12 reframe: "SQL 和 Postgres 其实可以做成可配置，开发者 install 的时候选呗。"

**LOCKED**:
- 使用 **Drizzle ORM** 作 multi-dialect abstraction
- 支持 **SQLite + Postgres** 为 first-class（也支持 MySQL 备选）
- Operator install 时通过 `DATABASE_URL` env 选择驱动（如 `sqlite://./data/skb.db` / `postgres://...`）
- 同一份 schema + migration，跨 dialect 适配

**驱动 + scale 推荐**：

| Operator | 推荐 DB | 理由 |
|---|---|---|
| Solo / NAS | SQLite (better-sqlite3 / libsql) | 零运维，单文件备份 |
| Team / VPS | SQLite (LiteFS 高可用) 或 Postgres (managed) | 视并发；< 100 user 仍 SQLite 够 |
| Public / Cloud | Postgres (Neon / Supabase / Railway / 各家云 managed) | 多实例横向 scale 自然 |
| Edge | Cloudflare D1 | edge SQLite，绑 Workers |

**Schema 形态**:
- `blocks.props_json` 走 JSON column（plugin-agnostic）；plugin 的 `propsSchema` zod 在 server-side runtime validate
- `notes.frontmatter_json` 同
- Binary blob **不**走 DB BLOB —— 走 Object storage（§11.13）；DB 只存 URL ref + 元数据（mime / size / hash）
- Discussion plugin 用 `discussion_posts` sidecar table（per §4.3 `contentStorageHint: 'sidecar-table'`），不是 inline content

**ID stability invariants (LOCKED 2026-05-12 per §11.1 hyperlink prereq)**：
- `blocks.id` = UUID (cuid2 / nanoid)，**永不重用** —— 一旦分配，即使 block 删除，ID 不再分给新 block（DB soft-delete 或 tombstone 记录，或单纯依靠 UUID 概率不冲突 + 不复用前序值）
- `notes.id` + `notes.slug` 同样永不重用
- 这两条不变量是**所有外部 hyperlink / wikilink / backlink index** 的基础

**Migration 工具**: `drizzle-kit` 生成 + apply；CI gate 防 schema drift。

### 11.8 Backend + Runtime + Framework + Deploy target (LOCKED 2026-05-12)

User 2026-05-12 LOCK: "对于后端，其实就一个要求，性能不能有明显差距，扩展性不能太差，尤其是 plugins。"

#### 11.8a Backend language: **TS LOCKED**

理由（详 §0.5 final reframe + §11.8 prior discussion）：
- Plugin extension 模型要求 plugin 是 monolang package（client EditView + server agentOps 同一 .ts）
- Carryover 100% TS
- Pyodide client-side，原 ADR-0001 §1.2 "Python for Jupyter" 理由 moot
- zod schema → OpenAPI / runtime validate / TS types 1-hop

#### 11.8b Runtime: **Bun 主线 + Node fallback LOCKED**

- **Bun**: foot-print 30-60MB（NAS-friendly）；`bun build --compile` 跨平台 single binary；冷启动 50-100ms；2024-2026 稳定生产
- **Node**: fallback runtime for 极少数 Bun 未支持环境；同一 codebase

不选 Workers-only：vendor lock 严重 + 限制 plugin 模型（Workers 限 CPU time + 部分 Node API）。Workers 作 alternative deploy target via Hono runtime-agnostic（详 §0.6 deploy matrix）。

#### 11.8c Framework: **Hono LOCKED**

Runtime-agnostic：同一份 Hono app code 跑 Bun / Node / Cloudflare Workers / Deno。Plugin 模型 + SSR + WebSocket 都支持。

替代品 Astro SSR / Next.js / Remix 都绑特定 runtime + 各自生态，违反 multi-target 部署要求。

#### 11.8d Deploy targets

见 §0.6 Deployment matrix。5 mode × 多 target，全部 first-class。

### 11.9 ~~Discussion sub-system scope~~ (2026-05-12 absorbed by §4 plugin model)

User 2026-05-12 reframe: "discussion 为什么不能是 block 的一种形式？"

→ Z11 (Discussion sub-system zone) **删**。Discussion 是 Z4 的一个 plugin (`packages/plugins/discussion/`)。Plugin contract §4.3 已扩展 `authRequirements` / `multiAuthor` / `realtimeChannel` / `contentStorageHint` 4 个字段 cover discussion 的特殊需求。

Plugin-as-discussion 含义：
- 一个 note 可有**多个** discussion block，分别配置（每个 thread 独立）
- Discussion block 拖拽 / resize / 删除 跟其他 block 一致
- 作者可见配置参数（匿名 / moderation / 通知）= plugin props
- 多 author content (`multiAuthor: true`) + WebSocket 推送 (`realtimeChannel: ...`) 都通过 plugin contract 表达

Discussion plugin 内部仍有 scope 细节（auth 形态 / moderation / notification / format / realtime 协议等），但这些是 **plugin 实现层** 而非架构层 —— 写 discussion plugin 时再决（§11.5 sequencing 时排程）。

### 11.10 Performance budget + Lighthouse target

User 2026-05-12 提出："能否在 Google PageSpeed Insights / Lighthouse 拿到高分数？"

**LOCK target: Lighthouse mobile score 90+ on public read mode** (acceptance criterion，新 repo day-1 要嵌入测试)。

具体 levers（要在 architecture day-1 就 build in，不是事后优化）：

| 指标 | 目标 | Lever |
|---|---|---|
| **TTFB** | < 200ms | DB query 优化（plugin row 单次 fetch + index）/ 服务器到边缘距离 / SSR rendering 不阻塞 stream |
| **FCP / LCP** | < 1.8s / < 2.5s | 关键 CSS inline；critical HTML stream；preload critical fonts；图片 srcset + WebP；非关键 JS defer |
| **CLS** | < 0.1 | **grid 模型天然 CLS-friendly**（block 尺寸 SSR-知，col/row/colSpan/rowSpan 固定）；字体 preload + fallback metric matching |
| **TBT / INP** | < 200ms / < 200ms | JS code split per route + per plugin；Pyodide lazy mount on jupyter block only；heavy plugins 不阻塞 main thread |
| **JS bundle** | initial < 100KB | per-plugin import；plugin not on a note → not loaded；core editor shell 拆 read-only / edit 两个 bundle |
| **Cache** | Public note immutable-ish | `Cache-Control: public, max-age=300, stale-while-revalidate`；CDN edge caching；mutation 触发 invalidation |

**Heavy block 处理**：保留 ADR-0014 HeavyBlockBoundary 的 hydration boundary 思路（具体接口重写）—— RenderView 在 SSR 给 skeleton（固定尺寸 = CLS-safe），EditView/runtime 客户端 hydrate；Pyodide / TensorFlow.js / React Flow 不在初始 bundle。

**Day-1 测试**: CI 接入 lighthouse-ci 或类似工具；Lighthouse score < 90 = CI fail。这是 webapp 的 product-quality contract，等同于 unit test pass。

**Backend SLO (server-side, 单实例 median, LOCKED 2026-05-12)**：

| 指标 | 目标 | 适用 operator |
|---|---|---|
| Per-request CPU (read SSR) | < 30ms | 任意 |
| Per-request CPU (write mutation) | < 50ms | 任意 |
| Memory baseline (idle) | < 80MB | Solo / NAS 重要；Team+ 不敏感 |
| Memory under load (100 concurrent) | < 200MB | Team+ |
| Concurrent WebSocket | > 1000 / instance | Team / Public |
| Cold start (Bun binary) | < 100ms | Edge / FaaS |
| DB query p95 (single block read) | < 5ms | 任意 |
| DB query p95 (note + all blocks read) | < 50ms | 任意 |

Bun + Drizzle + SQLite/Postgres + Hono 在这些目标下都 hit 得到。SLO 是 install 时的 baseline contract，CI 含 backend perf benchmark gate（< 90% target = fail）。

### 11.11 Install / deploy bootstrap 形态

User 2026-05-12: 参考 Claude CLI 安装模式（`curl -fsSL ... | bash` 一行式）。

**LOCK**: Z11 `deploy/` zone 第一天就建。bootstrap script 是 product 的一部分，不是事后 add-on。

提案 install 形态：

```bash
curl -fsSL https://<domain>/install.sh | bash
```

`install.sh` 逻辑：

```
1. detect OS + arch (linux / mac / wsl2)
2. detect prerequisites (docker preferred path / OR node+pnpm direct path)
3. ask: install location (default ~/skb)
4. clone repo OR download release tarball
5. interactive 3 questions:
   - admin email + password
   - public domain (空 = localhost only)
   - DB choice (sqlite default / postgres-url)
6. write .env + DB migrate
7. choose run mode (dev / prod-docker / prod-systemd)
8. print URL + admin credentials reminder
```

完整 `deploy/` 目录形态见 **§0.6 Deployment matrix**。5 mode × 多 target full matrix，所有 first-class。

**vendor-agnostic 基线**（任何 deploy mode 都需要）：`install.sh` / `install.ps1` / `Dockerfile` / `env.example` / `migrate.sh` / `backup.sh`。

### 11.12 API style: GET + POST collapsed (LOCKED 2026-05-12 by user)

业内人士反馈：GET + POST 占 95%+ webapp API；PATCH / PUT / DELETE 实际很少用。Stripe / Slack / Twitter v2 / Vercel API 等大厂均偏 POST-dominant。

**LOCKED**:
- GET 用于公开 read（CDN cacheable + Lighthouse 友好）
- POST 用于全部 mutation
- action 通过 **path** 表达，不通过 body discriminator
- PATCH / PUT / DELETE **不用**
- Agent semantic API (§5) 本来就是 POST-RPC，一致

**理由 trace**：
1. 简化中间件 —— CSRF / auth / rate-limit 中间件只处理 POST 一种 mutation 形态
2. 防火墙 / proxy 兼容（少数 corporate proxy 仍 filter PATCH/DELETE）
3. CSRF 防护在 POST 上模式成熟
4. JS `fetch` + form action 默认 GET/POST，其他要显式 method
5. CDN / 反代对 GET universal，对 PATCH 偶有怪行为
6. 大厂 webapp drift 验证此选择

**trade-off**: ADR-0001 §1.2 原计划用 `openapi-typescript` 自动生成 TS 客户端类型。GET+POST 风格下 OpenAPI gen 仍 work；每个 mutation endpoint 独立 POST schema → gen 出来文件**更多更扁平**（不是 partial PATCH 模糊语义）。trade-off 可接受。

Concrete endpoint list 见 §6 L9.5。

### 11.13 Storage provider abstraction (LOCKED 2026-05-12)

User 2026-05-12 LOCK: storage 必须可配置，cover NAS (local FS) → cloud (S3-compatible) → vendor object storage (Tencent COS / Aliyun OSS / R2 / Backblaze)。

**StorageProvider interface**:

```ts
interface StorageProvider {
  put(key: string, body: Uint8Array | ReadableStream, opts?: PutOpts): Promise<{ url: string; size: number; hash: string }>;
  get(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix: string, cursor?: string): Promise<{ keys: string[]; nextCursor?: string }>;
  signedUrl?(key: string, expiresIn: number): Promise<string>;  // 可选；S3 提供，FS 不
}
```

**Built-in adapters**：
- `LocalFsProvider` — NAS / 自建机器（path-based）
- `S3CompatibleProvider` — cover AWS S3 / Cloudflare R2 / Backblaze B2 / Tencent COS / Aliyun OSS / MinIO（任何 S3 API 兼容服务）

**Install 时配置**:

```bash
STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=/var/lib/skb/blobs

# 或

STORAGE_PROVIDER=s3
STORAGE_S3_ENDPOINT=https://<r2-account>.r2.cloudflarestorage.com
STORAGE_S3_BUCKET=skb-blobs
STORAGE_S3_REGION=auto
STORAGE_S3_ACCESS_KEY=...
STORAGE_S3_SECRET_KEY=...
```

**实现层**: 一个 `packages/storage/` 独立 package（或 inline 在 `apps/web/src/storage/`，倾向独立 —— 可被未来 CLI / desktop client 复用）。

Plugin 用 `StorageProvider` 写 binary（image / pdf 上传等）；Plugin 不知道是 FS 还是 S3。

### 11.14 Search provider abstraction (LOCKED 2026-05-12)

User 隐式（"全文搜索存在多少次"）—— search 是 first-class，跨 scale 必须 work。

**SearchProvider interface**:

```ts
interface SearchProvider {
  index(noteId: string, blocks: Array<{ blockId: string; kind: string; text: string }>): Promise<void>;
  remove(noteId: string): Promise<void>;
  search(query: string, opts?: { limit?: number; filter?: { kind?: string[]; ownerId?: string } }): Promise<SearchHit[]>;
}
```

**Built-in adapters**：
- `SqliteFtsProvider` — 用 SQLite FTS5（如 DB 是 SQLite，零配置）
- `PostgresFtsProvider` — 用 Postgres tsvector + GIN index（如 DB 是 Postgres，零配置）
- `MeilisearchProvider` — 外部 Meilisearch（high-scale operator 选）
- `TypesenseProvider` — 同上 alternative

**Install 时默认绑 DB**：选 SQLite → FTS5；选 Postgres → tsvector；都自动开。Operator 想接外部 search service → `SEARCH_PROVIDER=meilisearch` + 连接信息。

Plugin 通过 `BlockPlugin.searchableText?(props, content): string` opt-in 提供 indexable 文本（markdown 块 yes，nn-viz 块可能 no）。

### 11.15 Plugin sandboxing 演进路径 (LOCKED 2026-05-13: Day-1 contract hook + 演进方向 strategic intent)

User 2026-05-12 LOCK: plugin 扩展性是 hard requirement。当前 day-1 形态 vs 未来演进：

| Stage | Plugin 来源 | Runtime isolation | Permission system |
|---|---|---|---|
| **Day-1** | Built-in only（仓库 ship 的 10 个 plugins） | inline（plugin import 进 server process） | 无；built-in 全权限 |
| **Phase 2** | Operator-installed plugins（自己写 + 安装） | inline；trust operator | 无；同 day-1 |
| **Phase 3** | Marketplace 第三方 plugins | **worker thread** (Bun worker / Node worker_threads) per plugin | declare 在 plugin manifest：`permissions: ['db.read', 'db.write', 'network', 'fs', 'kernel']`；server enforce |
| **Phase 4** | 完全 sandbox（恶意 plugin 可控） | **WASM 模块** + capability-based API | strict permission；plugin 不能 access 任何未授权 capability |

**Day-1 contract 留 hook**：

```ts
type BlockPlugin = {
  // ...existing
  permissions?: Array<'db.read' | 'db.write' | 'network' | 'fs' | 'kernel'>;
  runtimeIsolation?: 'inline' | 'worker' | 'wasm';  // 默认 'inline' for built-in
};
```

Built-in plugins day-1 全部 `runtimeIsolation: 'inline'`，不 enforce permissions。但 contract 字段存在 = 未来 Phase 3+ 启用 sandbox 不需要破坏性改 contract。

**与 backend 选择的关系**: Bun + Node 都支持 worker thread；WASM host 也支持。Plugin sandboxing 不约束 backend 语言选择（§11.8 LOCKED Bun + TS 仍正确）。

### 11.16 CSS framework: Tailwind 4 + cva + shadcn ui + grid-themes (LOCKED 2026-05-13)

#### 决策

User 2026-05-13 push back Panda CSS（"太新，开发者少，ecosystem 远不如 Tailwind"）+ surface 出 cva / tailwind-variants 是 Tailwind 生态自身的 type-safety 答案。

最终 stack：

```
Layer 3: shadcn ui primitives (CLI-vendored copy-paste)
         apps/web/src/ui/{shadcn/, custom/}
         Button / Dropdown / Dialog / Toast / Form / etc.

Layer 2: cva / tailwind-variants for component variants
         每 plugin + 每 shell component 的 variant API 用 cva
         variant TS-union；compile-time 校验

Layer 1: Tailwind CSS 4 (utility-first)
         apps/web/ 的全局 utility classes
         tailwind.config.js theme.extend 引用 grid-themes CSS vars

Layer 0: grid-themes CSS variables (carryover)
         OKLCH 颜色 + 字体 + 间距 + 圆角 + shadow
         3 theme 切换 = CSS var 替换
```

#### Type-safety 工具链（lock 一组）

- **Tailwind CSS IntelliSense** (VS Code) —— 自动补全 + hover docs + 拼错 squiggle
- **eslint-plugin-tailwindcss** —— CI 强制 lint：禁未注册 class / 强 sort / shorthand 优先 / no contradictory
- **prettier-plugin-tailwindcss** —— 自动 sort
- **class-variance-authority (cva)** —— component variant API TS-typed
- **tailwind-variants (tv)** —— cva 升级（slots / compound variants）；按需引入
- **clsx** —— class string 拼接 helper
- **@tailwindcss/typography** —— `.prose` for rendered markdown (markdown plugin RenderView)

#### shadcn ui governance（user proposed + gatekeeper 补充实操）

| 治理点 | 实施 |
|---|---|
| **CLI vendored 进 repo，不用 npm 引用** | `npx shadcn add <component>` 生成 file 进 repo；这些 file 是 own code |
| **固定 CLI 版本** | `devDependencies` pin `shadcn@x.y.z` + 根目录 `.shadcn-version` 文件 + CI check `npx shadcn --version === content of .shadcn-version` |
| **add 走 PR** | 不允许 feature PR 内夹带；`npx shadcn add button` 单独 PR；title 模式 `chore(ui): add shadcn <name>` |
| **PR review** | reviewer 验：（a）无 duplicate（b）真用得到（不囤积）（c）shadcn CLI 版本一致 |
| **禁止 duplicate** | PR template checkbox + CI lint scan `apps/web/src/ui/` file name 唯一性 |
| **重度改造规则** | 改 >30 lines 或改 component API surface → rename `Skb-` 前缀 + 移到 `apps/web/src/ui/custom/`；从此和 shadcn upstream 脱钩 |
| **升级 diff 逐个** | shadcn CLI native `shadcn diff <component>` 列 upstream 改；review → cherry-pick / reject；不一次性全升 |

#### 目录形态

```
apps/web/src/ui/
├── shadcn/                 # CLI add 的，min 修改
│   ├── button.tsx
│   ├── dropdown-menu.tsx
│   ├── dialog.tsx
│   ├── toast.tsx
│   └── form.tsx
├── custom/                 # 重度改造 fork 的，Skb- 前缀
│   ├── SkbButton.tsx
│   └── ...
└── index.ts                # barrel export → `@/ui` import

.shadcn-version             # CLI 版本锁
components.json             # shadcn 配置 file (CLI 用)
```

未来出现第 2 个 app（desktop / mobile）需共用 → promote 到 `packages/ui/`；Day-1 不阻塞。

#### Plugin 内部 CSS 不限制（LOCKED）

User 2026-05-13: "plugin 内部的不管吧，我们只负责整体应用的层面，不要限制开发者的方法"。

**Platform 只锁 Layer 0-3（grid-themes tokens / Tailwind utility / cva variants / shadcn primitives）。Plugin 内部 styling 完全 plugin author 自选**：

- 想全 Tailwind utility → OK
- 想 CSS Modules (`*.module.css`) → OK
- 想 vanilla-extract / Linaria / styled-components → OK
- 想纯 vanilla CSS file → OK

`BlockPlugin` contract（§4.3 / §11.3）不规定 styling 实现方式，只规定：
- `EditView` / `RenderView` 是 React component
- 渲染输出可消费 grid-themes 的 CSS vars（推荐但不强制）

Plugin 自带 CSS 的 bundling 由 plugin package 自己负责（Bun build / vite resolver / etc.）。

#### 拒绝清单

- ✗ Panda CSS / vanilla-extract / Linaria 作为**主线** —— ecosystem / AI training 太弱；plugin 内部仍可自由用
- ✗ Emotion / styled-components / 其他 runtime CSS-in-JS —— SSR mismatch + perf cost；2026 走下坡
- ✗ shadcn npm package 引用（非 CLI vendored 形态）—— 失去 fork-after-copy own 性质
- ✗ admin UI 独立 design language —— editor view 和 read view 是同一套，仅 affordance 不同（per §11.6）

---

## 12. Next steps

1. **本文档 review**（user）
2. 把 LOCKED 部分 promote 到新 repo `docs/decisions/` （ADR-0001 起重新编号，无前置依赖）：
   - **ADR-0001 产品定义 + 部署矩阵**：self-hostable canvas-KB platform + 3 operator 谱 + 5 deploy mode（本 DI doc §0.5 + §0.6）
   - **ADR-0002 Substrate**: DB-backed + plugin serializer（§3 + §6 L1）
   - **ADR-0003 Grid-engine contract**: 12-col × N-row + AABB + gravity Option A + hole-fill intent（本 DI doc + `grid-redesign-2026-05-11.md`）
   - **ADR-0004 Block plugin extension model**: BlockPlugin contract + open kind + BlockRegistry（§4）
   - **ADR-0005 AI agent semantic API**: agentOps = block-scoped LLM tool use；§5 + §11.3 + §11.4
   - **ADR-0006 Backend stack**: TS + Bun + Hono + Drizzle (multi-dialect)（§11.7 + §11.8）
   - **ADR-0007 Storage provider abstraction**: local FS + S3-compatible pluggable（§11.13）
   - **ADR-0008 Search provider abstraction**: SQLite FTS5 + Postgres tsvector + external pluggable（§11.14）
   - **ADR-0009 API style**: GET + POST collapsed; action in path（§11.12）
   - **ADR-0010 Performance + Lighthouse acceptance**: Lighthouse 90+ + backend SLO（§11.10）
   - **ADR-0011 Plugin sandboxing evolution**: Day-1 inline → Phase 3 worker → Phase 4 WASM（§11.15）
   - **ADR-0012 OpenAPI gen 链路**: zod-first + REST endpoints + agent op registry split（§5.5 / TBD §11.16 后续 patch）
   - **ADR-0013 Markdown tile editor**: Lexical WYSIWYG + DB markdown source + hyperlink levels Day-1/Phase-2 split + block ID stability invariants（§11.1）
   - **ADR-0014 Plugin contract details**: agentOps signature + opt-in framework `set_content` fallback + capability-based context + no plugin-to-plugin direct call + explicit startup registration + semver versioning + lazy migration（§11.3）
   - **ADR-0015 Agent wire protocol: MCP + SKILL.md 双层**: Tier 1 REST + Tier 2 MCP (Streamable HTTP + OAuth 2.1 + PKCE) + Tier 3 SKILL.md companion + Tier 4 SSE push + Tier 5 WS deferred；NEW packages/llm-provider/ multi-adapter（§11.4）
   - **ADR-0016 CSS framework**: Tailwind 4 + cva/tailwind-variants + shadcn ui (CLI-vendored copy-paste) + grid-themes CSS vars；shadcn governance (固定 CLI 版本 + add 走 PR + 禁 duplicate + 重度改 fork Skb- 前缀 + 升级逐 component diff)；plugin 内部 CSS 不限制（§11.16）
3. 决策 §11 open questions：~~§11.1~~ Lexical WYSIWYG LOCKED / ~~§11.3~~ Plugin contract LOCKED / ~~§11.4~~ MCP+SKILL.md 双层 LOCKED / ~~§11.5~~ Bootstrap evolution path LOCKED / ~~§11.6~~ UX design intent inventory LOCKED / ~~§11.7~~ DB pluggable via Drizzle LOCKED / ~~§11.8~~ TS+Bun+Hono+multi-deploy LOCKED / ~~§11.9~~ absorbed / §11.10 Lighthouse + Backend SLO LOCKED / §11.11 install bootstrap LOCKED / §11.12 API style LOCKED / §11.13 Storage provider abstraction LOCKED / §11.14 Search provider abstraction LOCKED / ~~§11.15~~ Plugin sandboxing evolution LOCKED (cascading-confirm) / ~~§11.16~~ CSS framework (Tailwind 4 + cva + shadcn ui + grid-themes) LOCKED。**§5.5 zone 表 + §6 9-layer 均 LOCKED 2026-05-13 cascading-confirm**。**全部 §11 子项 LOCKED，无 open question 残留**。
4. 起 Wave 8 (or "rebuild wave") plan：基于 LOCKED ADR + 决定后的 OPEN questions
5. 持续维护本 DI doc + 未来 DI docs (`docs/design/<topic>-<date>.md`)

---

## Related

**新 repo carryover scope（搬入新 repo）**:
- 本文件（DI doc，新 repo `docs/design/architecture-rebuild-2026-05-11.md`）
- `grid-redesign-2026-05-11.md` (parent DI doc，新 repo `docs/design/`)
- `packages/grid-engine/` — 已落地的 headless engine（验过）
- `packages/grid-themes/` — 已落地的 3 主题
- `packages/kernel-adapter/` + `packages/kernel-pyodide/`
- `apps/site/src/components/_grid-prototype/` — THROWAWAY prototype 作为 _reference/
- 9 个 block 的 propsSchema (`extracted-schemas/`)

**抛弃 scope（不搬，旧 repo git 全部 cut）**:
- 旧 `docs/decisions/ADR-0001..ADR-0020` 全部（含 stack selection / wave-close / interface freeze / etc.）
- 旧 `docs/superpowers/specs/` brainstorm spec
- 旧 `docs/plans/` Wave 1-7 PR plan
- 旧 `agent-contract.md` + `.claude/agents/` + Codex profile + CI gate scripts
- 旧 `packages/editor-shell/` + `packages/mdx-bridge/` + 3 个 editor-* 子包 + 9 个 `block-*` 的 NodeView / EditorView 实现
- 旧 `apps/site/` Astro SSG + `apps/api/` FastAPI 大部分
- 旧 git history

→ DI doc 中对旧 ADR 的对比（§0.5 翻译错位表 / §3 Tiptap 历史理由）保留作 framing failure 教学，**不是** amendment。
