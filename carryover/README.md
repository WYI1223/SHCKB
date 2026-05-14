# Carryover staging — 2026-05-11

> 物理 stage area，准备搬到全新 repo 的内容。本目录在当前 repo 中是 throwaway —— 你拷贝完 / 启动新 repo 之后可以删掉它。

## 目录构成

```
carryover/
├── README.md                               # 本文件
├── packages/                               # 可直接 drop-in 新 repo 的 workspace 包
│   ├── grid-engine/                        # ✅ 完整保留；headless 2D engine（已 prototype 验证）
│   ├── grid-themes/                        # ✅ 完整保留；3 个内置 theme（已 prototype 验证）
│   ├── kernel-adapter/                     # ✅ 完整保留；Pyodide 等计算 runtime 抽象（substrate-agnostic）
│   └── kernel-pyodide/                     # ✅ 完整保留；浏览器内 Python runtime（独立于 editor 形态）
├── design-docs/                            # SoT 设计文档，新 repo 直接挂 docs/design/
│   ├── grid-redesign-2026-05-11.md         # grid 心智 + 3 主题 lock
│   └── architecture-rebuild-2026-05-11.md  # framing 诊断 + Tiptap/MDX 删 + plugin model + agent API + 产品环境形态
├── _reference/                             # 参考用，不直接 drop-in；新 repo 里读了之后 plug 进新 framework
│   ├── prototype/                          # _grid-prototype 三 variant，THROWAWAY 标记，验过 β 路径
│   └── grid-prototype.astro                # Astro 路由文件；新 repo 如非 Astro 则需 adapt
└── extracted-schemas/                      # 9 个 block 的 propsSchema 提取（仅 core-definition.ts）
    ├── block-agent-flow/
    ├── block-callout/
    ├── block-code/
    ├── block-image/
    ├── block-jupyter/
    ├── block-markdown/
    ├── block-math/
    ├── block-nn-viz/
    └── block-pdf/
```

依赖关系（搬到新 repo 时要注意的）：

- `grid-engine` — 零内部依赖；只 `vitest` + `zod`(? 实际确认)
- `grid-themes` — 依赖 `@skb/grid-engine` (workspace ref)
- `kernel-pyodide` — 依赖 `@skb/kernel-adapter` (workspace ref) + `pyodide` (external)
- `kernel-adapter` — 零内部依赖
- `_reference/prototype/` — import `@skb/grid-engine`（workspace ref）；如新 repo workspace 名变了，需要 search/replace package name

## 已剥离掉

`packages/*/node_modules/` + `packages/*/dist/` + `*.tsbuildinfo` 在 copy 阶段已删；新 repo `pnpm install` 重新 hydrate。

`extracted-schemas/*/core-definition.ts` 仍有以下需要在新 plugin contract 下整理：

- `import type { BlockCoreDefinition } from '@skb/block-foundation'` — 旧 contract，新 repo 写 `BlockPlugin` (per architecture-rebuild-2026-05-11.md §4.3)
- `mdxComponent: 'Markdown'` 字段 — 删，新 contract 没这条
- `kind: 'prose' | 'component' | 'render' | 'viz'` 闭合 union — 改成 open string identifier
- 9 个文件里的 `propsSchema` (col / row / colSpan / rowSpan + 各 block 私有字段) **是要保留的核心** —— 表达每个 block 的字段约束

---

## 故意没搬的

| 删除项 | 理由 |
|---|---|
| `packages/editor-shell/` | Tiptap-coupled 全部；删 |
| `packages/editor-drag-handle/`, `editor-slash-menu/`, `editor-toolbar/` | Tiptap 扩展；删 |
| `packages/mdx-bridge/` | MDX serialization；新架构 DB-backed 不需要 |
| `packages/heavy-block-boundary/` | Astro NodeView hydration boundary；新架构需要类似但接口不同，重写比 lift 容易 |
| `packages/block-foundation/` | BlockRegistry 70% 是 plugin shape，但 BlockCoreDefinition 字段（mdxComponent + 闭合 BlockKind union）是 Tiptap/MDX-era；按 architecture-rebuild §4.3 新写 |
| `packages/block-*/src/ui-default/` (9 个) | NodeView EditorView 全部；schema 已抽 |
| `packages/block-*/src/core/{parse,serialize}.ts` (9 个) | MDX bridge serialize；用不到 |
| `apps/site/` 大部分 | Astro SSG mode；新 framework 选定后从零写（grid-prototype.astro 留 _reference） |
| `apps/api/` | FastAPI 后端；rebuild（routes 几乎全部要重写） |
| `docs/plans/wave-*-main/` | Wave 1-7 PR plan；历史；不搬 |
| `docs/decisions/ADR-0001`..`ADR-0020` | 错框架下的 ADR；新 repo 重起 ADR 编号 |
| `docs/superpowers/specs/` | spec lock 翻译错误的文档；不搬 |
| `agent-contract.md` + `.claude/agents/` + `tmp/codex-profiles.toml` | ADR-0011 27-agent pipeline；新 repo 起步极简（你 + gatekeeper Claude + 偶尔 dispatch），后期需要再建 |
| `scripts/check-*.ts` (9 个 CI gate) | D9/D10 apparatus；ADR-0011 era；不搬 |
| `.github/workflows/` | Wave-era CI；新 repo 重起 |
| `lychee` 配置 | 链接检查；起步不需要 |
| `turbo.json` | 24-package monorepo；起步用 pnpm workspaces 足够，turborepo 按需引入 |

---

## 新 repo 结构提案（PROPOSED — 2026-05-12 zone-first reframe）

**新 repo 结构权威 source = `design-docs/architecture-rebuild-2026-05-11.md` §5.5 Functional zones + 目录映射**（12 zone 表）+ §6 9-layer architecture。本节是 §5.5 + §6 + §11.10-§11.12 的目录树呈现。

```
<new-repo>/                            # 新 GitHub repo，名字 TBD
├── package.json                        # 根 workspace
├── pnpm-workspace.yaml
├── tsconfig.base.json                  # 严格 TS 配置
├── vitest.workspace.ts                 # 跨 package test runner
├── .gitignore
├── README.md                           # 项目概览（link 到 docs/design/）
│
├── docs/                                       # Z12
│   ├── design/                                 # DI docs（持续维护）
│   │   ├── grid-redesign-2026-05-11.md
│   │   ├── architecture-rebuild-2026-05-11.md
│   │   └── <未来 DI docs>
│   ├── decisions/                              # ADR (新 repo 从 ADR-0001 重起)
│   │   ├── ADR-0001-product-environment.md     # promote §0.5 (self-hostable platform)
│   │   ├── ADR-0002-substrate-db-backed.md     # promote §3 + §6 L1
│   │   ├── ADR-0003-grid-engine-contract.md    # rewrite of old ADR-0020
│   │   ├── ADR-0004-block-plugin-contract.md   # promote §4.3 (含新增 contract 字段)
│   │   ├── ADR-0005-agent-semantic-api.md      # promote §5
│   │   ├── ADR-0006-backend-stack.md           # promote §11.7 + §11.8 (TS + Bun + Hono + Drizzle)
│   │   ├── ADR-0007-storage-provider.md        # promote §11.13 (local FS + S3-compat pluggable)
│   │   ├── ADR-0008-search-provider.md         # promote §11.14 (SQLite FTS5 + Postgres tsvector + external)
│   │   ├── ADR-0009-api-style.md               # promote §11.12 (GET + POST)
│   │   ├── ADR-0010-performance-lighthouse.md  # promote §11.10 (Lighthouse 90+ + Backend SLO)
│   │   ├── ADR-0011-plugin-sandboxing.md       # promote §11.15 (inline → worker → wasm 演进路径)
│   │   └── ADR-0012-openapi-gen.md             # promote OpenAPI gen 链路
│   ├── api/                                    # REST + agent API 详细 spec（OpenAPI gen）
│   └── runbooks/                               # 个人维护手册（按 deploy mode 分）
│
├── packages/                                   # Z1 / Z2 / Z3 / Z4 / Z5 / Z10 / storage / search
│   ├── grid-engine/                            # Z1 ✅ carryover
│   ├── grid-themes/                            # Z2 ✅ carryover
│   ├── kernel-adapter/                         # Z5 ✅ carryover
│   ├── kernel-pyodide/                         # Z5 ✅ carryover
│   ├── block-foundation/                       # Z3 ✏️ 新写：BlockPlugin contract + BlockRegistry
│   ├── agent-api/                              # Z10 protocol ✏️ 新写：RPC schema + auth + TS types
│   ├── storage/                                # ✏️ 新写：StorageProvider interface + LocalFS + S3Compat adapters (§11.13)
│   ├── search/                                 # ✏️ 新写：SearchProvider interface + SqliteFts + PostgresFts + Meilisearch adapters (§11.14)
│   └── plugins/                                # Z4 (10 plugins; 每个独立 workspace package)
│       ├── markdown/                           # ✏️ CodeMirror markdown source-only
│       ├── code/                               # ✏️ CodeMirror language modes
│       ├── image/                              # ✏️ 依赖 packages/storage (S3 / local)
│       ├── callout/                            # ✏️
│       ├── math/                               # ✏️ TeX + KaTeX
│       ├── pdf/                                # ✏️ 依赖 packages/storage
│       ├── jupyter/                            # ✏️ 依赖 kernel-pyodide
│       ├── nn-viz/                             # ✏️ TensorFlow.js
│       ├── agent-flow/                         # ✏️ React Flow
│       └── discussion/                         # ✏️ 多 author + realtime + auth-required (per §4.3 + §11.9 absorbed)
│
├── apps/
│   └── web/                                    # Z6 + Z7 + Z8 + Z9 + Z10 dispatcher
│       ├── src/
│       │   ├── routes/                         # Z9 SSR routes (Hono handlers)
│       │   ├── api/                            # Z9 + Z10 endpoints
│       │   │   ├── notes/                      # POST mutation routes (per §6 L9.5)
│       │   │   ├── auth/                       # Z7 endpoints
│       │   │   └── agent/                      # Z10 dispatcher
│       │   ├── db/                             # Z6: Drizzle schemas + migrations + repositories
│       │   │   ├── schema/                     # multi-dialect Drizzle schemas
│       │   │   ├── migrations/
│       │   │   └── repositories/               # repository pattern wrappers
│       │   ├── auth/                           # Z7: sessions + multi-user + multi-provider
│       │   ├── shell/                          # Z8: grid-engine 消费层 + useGridInteraction
│       │   ├── search/                         # Z6+: SearchProvider 实例化（启动时选 adapter）
│       │   ├── storage/                        # Z6+: StorageProvider 实例化
│       │   └── styles/
│       └── package.json
│
├── deploy/                                     # Z11 ✏️ 新写 (per §0.6 5-mode matrix)
│   ├── README.md                               # 5 mode 选择导引
│   ├── install.sh                              # POSIX 通用（detect OS/arch → 推荐 mode）
│   ├── install.ps1                             # Windows PowerShell
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   └── Dockerfile
│   ├── binary/
│   │   ├── build.sh                            # bun build --compile cross-platform
│   │   └── install.sh                          # 下载 binary + systemd setup
│   ├── fly/fly.toml
│   ├── render/render.yaml
│   ├── railway/railway.toml
│   ├── cloudflare/wrangler.toml
│   ├── env.example
│   ├── migrate.sh                              # Drizzle migration CLI 入口
│   └── backup.sh                               # 各 mode 备份脚本
│
├── _reference/                                 # 不参与构建；lift 时参考
│   ├── prototype/                              # ✅ carryover
│   ├── grid-prototype-route.astro              # ✅ carryover
│   └── extracted-schemas/                      # ✅ carryover
│
└── _archive/ (optional)
    └── README.md                               # 指向旧 repo URL
```

### 设计原则（更新 2026-05-12 final reframe）

1. **Self-hostable platform 形态**（§0.5）：软件分发，operator 各自部署各自 scale；不是单一 deployment
2. **核心 vs apps 分离**：`packages/` 全部 headless / contract / pure；`apps/web/` 是组装层（Z6/Z7/Z8/Z9/Z10-dispatcher）
3. **`packages/plugins/` 内嵌**：每 plugin 独立 workspace package；consistent 治理
4. **`block-foundation` contract 包**：BlockPlugin 接口（§4.3 含 authRequirements / multiAuthor / realtimeChannel / contentStorageHint / permissions / runtimeIsolation）+ BlockRegistry；零实现
5. **`agent-api` 独立 package**：协议层 + auth + TS types；dispatcher 在 apps/web
6. **`packages/storage/` + `packages/search/` 独立 package**：StorageProvider + SearchProvider 抽象 + built-in adapters；plugin 通过 interface 用
7. **`apps/web/` 单 deployable unit**：DB / Auth / SSR / API / Shell；通过 env 选 driver
8. **DB / Storage / Search 全部 pluggable**：install 时选 SQLite/Postgres + local/S3 + FTS5/tsvector/external（§11.7 + §11.13 + §11.14）
9. **`deploy/` day-1 就建**：5 mode × 多 target matrix（§0.6）
10. **TS + Bun + Hono LOCKED backend stack**（§11.8）：plugin monolang + foot-print + cross-deploy
11. **`packages/plugins/discussion/`**：discussion 是 plugin（§11.9 absorbed by §4）
12. **不预先建 24 个包**：起步 8 packages (含 storage + search) + 10 plugins + 1 app + 1 deploy + docs = 20 entries
13. **docs/decisions/ 重起编号**：12 个 ADR 候选

### Pluggable abstractions: install-time configurability (LOCKED 2026-05-12)

Operator install 时通过 env 配置：

```bash
# DB (§11.7)
DATABASE_URL=sqlite://./data/skb.db       # 或 postgres://... 或 mysql://...

# Storage (§11.13)
STORAGE_PROVIDER=local | s3
STORAGE_LOCAL_PATH=/var/lib/skb/blobs
STORAGE_S3_ENDPOINT=...                    # cover R2 / AWS / Backblaze / Tencent / Aliyun / MinIO
STORAGE_S3_BUCKET=skb-blobs
STORAGE_S3_ACCESS_KEY=...
STORAGE_S3_SECRET_KEY=...

# Search (§11.14) — 默认绑 DB
SEARCH_PROVIDER=auto | meilisearch | typesense
SEARCH_EXTERNAL_URL=...

# Auth
AUTH_PROVIDERS=password,github,google,magic-link
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

### Backend SLO (LOCKED §11.10)

| 指标 | 目标 |
|---|---|
| Per-request read SSR CPU | < 30ms |
| Per-request write CPU | < 50ms |
| Memory baseline (idle) | < 80MB |
| Memory under load (100 concurrent) | < 200MB |
| Concurrent WebSocket / instance | > 1000 |
| Cold start (Bun binary) | < 100ms |
| Lighthouse mobile (read mode) | 90+ |

CI gate: backend perf benchmark + lighthouse-ci，< 90% target = fail。

### REST API style: GET + POST collapsed (LOCKED §11.12)

不用 PATCH / PUT / DELETE。详细 endpoint 列表见 `design-docs/architecture-rebuild-2026-05-11.md` §6 L9.5。

### 决策 driver（搬之前必须定）

| 决策 | 阻塞什么 | 候选 |
|---|---|---|
| §11.8 deploy target | `apps/web/` framework / DB driver / config | Fly.io + Astro SSR / Fly.io + Next.js / Render + Astro SSR / Cloudflare Pages+Workers+D1 / Vercel+Postgres |
| §11.7 DB 引擎 | `apps/web/src/db/` schema + ORM 选择 | SQLite (Fly volume) / SQLite (libSQL/Turso) / D1 / Postgres (Neon / Supabase) |
| Frontend framework | `apps/web/` 整体形态 | Astro SSR / Next.js / Remix / SvelteKit / vite+react-router |
| Auth library | `apps/web/src/auth/` | lucia-auth / auth.js / 自写 JWT + Argon2 / Clerk |

§11.1 (markdown tile editor) / §11.3 (plugin contract 细节) / §11.4 (WebSocket protocol) / §11.9 (discussion scope) **不阻塞 bootstrap**，可以建到 grid-engine 接入 apps/web 之后再 decide。

---

## 物理搬运 steps（你做）

1. 创建新 GitHub repo（名字 TBD；建议短，e.g. `skb` / `knowledge-canvas` / `tilenotes` / 等）
2. local clone 新 repo
3. 从本目录 (`carryover/`) 拷贝：
   - `packages/*` → 新 repo `packages/*`
   - `design-docs/*` → 新 repo `docs/design/*`
   - `_reference/*` → 新 repo `_reference/*`
   - `extracted-schemas/*` → 新 repo `_reference/extracted-schemas/*`（参考，新 plugin 写时引用）
4. 起 root `package.json` + `pnpm-workspace.yaml` + `tsconfig.base.json`
5. 起 `docs/decisions/ADR-0001` 起 ADR-0001-product-environment（promote §0.5）
6. 决策上面 4 个 driver，然后 scaffold `apps/web/`
7. 第一个 milestone：grid-engine 在 SSR app 里 mount，从 DB 读一个 hardcoded note，渲染出 12-col grid + 1 个 sample block 的 RenderView
8. 第二个 milestone：写 markdown plugin（第一个 plugin contract 实例），可在 edit 模式下增删改

旧 repo 留作 git 历史 reference；本目录 `carryover/` 删除（或推到旧 repo 一个分支保存）。

---

## 待 discuss 的几条

我没替你 decide 的：

1. **新 repo 名字**：你的选择
2. **新 repo `packages/block-foundation/` vs 直接写在 `apps/web/src/shell/contract.ts`**：是否值得独立 package？我倾向独立 package 因为 plugin contract 应该和 grid-engine 一样跨多 consumer；但起步阶段一切都在一个 app 里可能更快
3. **`plugins/` 和 `packages/` 同级 vs `packages/plugins/`**：组织层级。同级强调 plugin = extension point first-class；嵌套层级简化 workspace 设置
4. **第一个 plugin 写哪个**：markdown 最简单（核心）；image 第二（验证 blob storage 路径）；jupyter 最复杂但验证完整 plugin contract
5. **Discussion 子系统**：起步阶段是否实现 / 还是 Phase 2
6. **AI agent semantic API**：起步阶段实现到什么程度 / 还是 Phase 2

下一步 = 你看完此 README + 之上目录结构 + 提案，pushback 任何点。

---

**当前 repo 状态**：unaffected。所有 `packages/` `apps/` `docs/` 原位保留。`carryover/` 是 staging copy。
