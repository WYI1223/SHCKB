/**
 * Seed the in-product developer docs (MVP-7 M7-D3) through the real
 * HTTP API — docs-as-bundle: this script is the canonical source, the
 * exported bundle (devdocs/skb-devdocs.zip) is the reviewable artifact,
 * and any instance can import or re-seed it. PRD/ADR governance docs
 * deliberately stay in git only.
 *
 * Usage:
 *   bun scripts/seed-devdocs.ts --base http://localhost:3210 \
 *     --email admin@local.dev --password dev-admin-password
 *
 * Idempotence guard: aborts if a top-level folder named 开发者文档 exists.
 */

// ---------- args ----------

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) {
    console.error(`missing --${name}`);
    process.exit(1);
  }
  return v;
}

const BASE = arg('base').replace(/\/$/, '');
const EMAIL = arg('email');
const PASSWORD = arg('password');

// ---------- API client ----------

let cookie = '';

async function req(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { cookie };
  let payload: string | undefined;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('sign-in returned no cookie');
  cookie = setCookie.split(';')[0]!;
}

// ---------- page builders ----------

type SeedBlock = {
  id: string;
  kind: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  content: unknown;
};

const md = (markdown: string) => ({ markdown });
const code = (language: string, source: string) => ({ language, source });

async function createPage(opts: { title: string; folderId: string; blocks: SeedBlock[] }): Promise<string> {
  const { id } = (await req('POST', '/api/notepages', { title: opts.title })) as { id: string };
  await req('POST', `/api/notepages/${id}/move`, { folderId: opts.folderId });
  await req('PUT', `/api/notepages/${id}/working-state`, {
    title: opts.title,
    gravityEnabled: true,
    blocks: opts.blocks,
  });
  await req('POST', `/api/notepages/${id}/theme`, { themeId: 'workbench' });
  const pub = (await req('POST', `/api/notepages/${id}/publish`)) as { slug: string };
  await req('POST', `/api/notepages/${id}/visibility`, { visibility: 'public' });
  console.log(`  ✓ ${opts.title} -> /notes/${pub.slug}`);
  return pub.slug;
}

// ---------- page 1: 开发者导览 ----------

async function seedGuide(folderId: string) {
  await createPage({
    title: '开发者导览',
    folderId,
    blocks: [
      {
        id: 'guide-intro', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 2,
        content: md(
          '# 开发者导览\n\n' +
            'SHCKB 是一个可自托管的画布式知识库：12 列网格 notepage、块即插件、主题引擎、' +
            '确定性导出。这页带你从 clone 到能改代码。**本页与姊妹页由 ' +
            '`apps/server/scripts/seed-devdocs.ts` 可重放生成**——文档本身就是产品的 dogfooding。',
        ),
      },
      {
        id: 'guide-layout-md', kind: 'markdown', col: 0, row: 2, colSpan: 5, rowSpan: 5,
        content: md(
          '## 仓库结构\n\n' +
            '- `packages/grid-engine` — headless 12 列网格引擎（纯函数，测试最厚）\n' +
            '- `packages/theme` — 主题引擎：tokens / slots / palettes / shells\n' +
            '- `packages/block-kinds` — 内置块（markdown / image / code）+ 静态渲染\n' +
            '- `packages/ui-kit` — 工具面板 UI 原语\n' +
            '- `apps/server` — Bun + Hono + Drizzle (SQLite)\n' +
            '- `apps/web` — React 18 + Vite SPA\n\n' +
            '每个包的对外承诺写在 `packages/<pkg>/CONTRACT.md`——**改接口先改契约**。',
        ),
      },
      {
        id: 'guide-run', kind: 'code', col: 5, row: 2, colSpan: 7, rowSpan: 5,
        content: code('bash',
          '# 安装（仓库用 bun 管 workspace）\n' +
            'bun install\n\n' +
            '# 服务端（首启需引导管理员；密钥 ≥32 字符）\n' +
            'SHCKB_AUTH_SECRET=$(openssl rand -base64 32) \\\n' +
            'SHCKB_ADMIN_EMAIL=admin@example.com \\\n' +
            'SHCKB_ADMIN_PASSWORD=change-me-please \\\n' +
            'PORT=3210 bun --watch apps/server/src/index.ts\n\n' +
            '# 前端开发服务器（代理 /api 到后端）\n' +
            'cd apps/web && bun x vite --port 5173\n\n' +
            '# 全仓测试 / 类型检查\n' +
            'bun run --filter "*" test\n' +
            'bun run --filter "*" typecheck',
        ),
      },
      {
        id: 'guide-docs-tree', kind: 'markdown', col: 0, row: 7, colSpan: 6, rowSpan: 4,
        content: md(
          '## 文档去哪儿找\n\n' +
            '治理文档在 git，不在产品里：\n\n' +
            '- `docs/product/prd/` — 产品真理（用户可观察的 WHAT）。**PRD 是上游**，其他一切下游。\n' +
            '- `docs/engineering/decisions/` — ADR（HOW 的取舍记录）。ADR-0019 起有效；0001–0018 是已废弃的旧框架草稿，只作历史追溯。\n' +
            '- `docs/engineering/decisions/AUDIT-2026-05.md` — PRD 视角的 ADR 债登记簿。\n' +
            '- `packages/*/CONTRACT.md` — 包级契约。\n\n' +
            '改行为的顺序永远是：**PRD → ADR → CONTRACT → 代码**。',
        ),
      },
      {
        id: 'guide-pitfalls', kind: 'markdown', col: 6, row: 7, colSpan: 6, rowSpan: 4,
        content: md(
          '## 新人最常踩的四个坑\n\n' +
            '1. **改了 `packages/*` 结构后 vite 不热更**——重启 vite，workspace 包的模块图不会自己刷新。\n' +
            '2. **`bun --watch` 的服务端会被 workspace 改动带崩**——重启时记得带 `SHCKB_BASE_URL`（经 vite 代理登录时 origin 校验需要它）。\n' +
            '3. **开发凭据只属于本机**。`admin@local.dev` / 仓库文档里的任何密钥**绝不**用于暴露主机。\n' +
            '4. **Windows 下别用 PowerShell 的 Get/Set-Content 改源码**——非 ASCII 字符会被编码毁掉；用编辑器或 bash 工具链。',
        ),
      },
    ],
  });
}

// ---------- page 2: 架构说明 ----------

async function seedArchitecture(folderId: string) {
  await createPage({
    title: '架构说明',
    folderId,
    blocks: [
      {
        id: 'arch-intro', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 2,
        content: md(
          '# 架构说明\n\n' +
            '五个不变量撑起整个系统。读懂它们，任何模块的代码都不会让你意外；' +
            '破坏它们的改动，review 必拦。',
        ),
      },
      {
        id: 'arch-twostate-md', kind: 'markdown', col: 0, row: 2, colSpan: 6, rowSpan: 5,
        content: md(
          '## ① 两态模型\n\n' +
            '每页有两个互不打扰的状态：\n\n' +
            '- **工作态** = `notepages` 字段 + `blocks` 行，自动保存，只有作者可见\n' +
            '- **公开态** = `publishedDoc` 快照，**只**由显式 publish 动作写入\n\n' +
            '改标题、挪块、换背景——公开页**一概不动**，直到你按下 Update public page。' +
            '读者永远看到的是某次明确发布的完整切片，不是半成品。\n\n' +
            '唯一的记录在案的偏差：目录树位置是元数据，公开侧实时投影。',
        ),
      },
      {
        id: 'arch-purity', kind: 'code', col: 6, row: 2, colSpan: 6, rowSpan: 5,
        content: code('typescript',
          '// ② 发布渲染是纯函数（ADR-0024）\n' +
            '//   publishedHtml = renderStaticPage(doc, slug, effectiveTheme)\n' +
            '//\n' +
            '// 同一 (快照, 主题) 必然产出同一 HTML：\n' +
            '// - 换主题 = 全量重渲染所有已发布页，永不陈旧\n' +
            '// - RenderView 禁网络请求、禁 author-only 控件\n' +
            '// - 主题只经 useTheme() 读取，不许 import 具体主题\n' +
            '\n' +
            '// 主题解析链（每处渲染同一条链）：\n' +
            'const effective = applyCustomization(\n' +
            '  THEMES[page.themeId ?? instanceTheme] ?? DEFAULT,\n' +
            '  operatorCustomization, // 白名单过滤后的运营者选择\n' +
            ');',
        ),
      },
      {
        id: 'arch-axes', kind: 'markdown', col: 0, row: 7, colSpan: 6, rowSpan: 5,
        content: md(
          '## ③ 三层外观分权\n\n' +
            '每一层只能在上一层**策展过的空间**里选：\n\n' +
            '1. **主题作者**定空间：tokens / slots / `palettes`（官方配色变体）/ ' +
            '`customizableTokens`（覆写白名单）/ `shells`（块壳选项）\n' +
            '2. **运营者**在空间里选：实例主题 + palette + 白名单 token 覆写\n' +
            '3. **页面作者**最后选：页背景（色/图）+ 每块的壳\n\n' +
            '自由调色被刻意拒绝——主题完整性优先。`shells` map 是**声明即实现**：' +
            '每个壳选项自带 Frame 组件，声明与渲染不可能脱节。',
        ),
      },
      {
        id: 'arch-auth', kind: 'markdown', col: 6, row: 7, colSpan: 6, rowSpan: 5,
        content: md(
          '## ④ 单点准入（PEP）\n\n' +
            '所有 `/api/*` 请求过同一个 PEP 中间件：session → 不可变 `ctx.user` ' +
            'Principal（或 null = 匿名）。handler **从不**自己验身份。\n\n' +
            '- 匿名面 = `/api/public/*`、auth、health、me——其余 401\n' +
            '- 角色门：`requireAdmin` 守 settings 写入与 admin 面（export / import / GC）\n' +
            '- 注册永久关闭；首管理员只经启动引导（env 提供，表空才生效）\n\n' +
            '公开读路由 404 语义无泄漏：不存在 / 私有 / 未发布，响应完全一致。',
        ),
      },
      {
        id: 'arch-export-md', kind: 'markdown', col: 0, row: 12, colSpan: 6, rowSpan: 5,
        content: md(
          '## ⑤ 数据主权：确定性导出\n\n' +
            '逻辑导出 = canonical JSON（2 空格、键序稳定、LF）+ 内容寻址 blob，' +
            'zip 字节确定（除 `exportedAt`）。\n\n' +
            '- **格式版本化**：每次格式变更必须成对提交 up/down transform\n' +
            '- **降级在导出端**：旧 build 不可能认识新格式；`?format=` 参数 + 显式报损\n' +
            '- **导入只进空实例**：三道门（空 / 版本 / 结构+逐页校验）全在任何写入之前\n\n' +
            'blob 引用契约：kind 在 content JSON 里**必须**用小写 hex sha256 原文引用 blob——' +
            '这让平台无需理解 content 也能枚举引用（导出求交、GC 保守保活）。',
        ),
      },
      {
        id: 'arch-stack', kind: 'code', col: 6, row: 12, colSpan: 6, rowSpan: 5,
        content: code('plaintext',
          '请求一生（写路径）\n' +
            '─────────────────\n' +
            'PUT /api/notepages/:id/working-state\n' +
            '  → PEP（身份 → ctx.user）\n' +
            '  → 形状校验（parseWorkingState）\n' +
            '  → 引擎复验（validateState：重叠/越界/重力）\n' +
            '    ↑ 客户端跑过的同一套纯函数\n' +
            '  → 事务写 notepages + blocks\n' +
            '\n' +
            'POST /api/notepages/:id/publish\n' +
            '  → 工作态 → publishedDoc 快照\n' +
            '  → renderStaticPage(doc, slug, effectiveTheme)\n' +
            '  → 存 publishedHtml（读路径零渲染成本）',
        ),
      },
    ],
  });
}

// ---------- page 3: 扩展开发 QA ----------

async function seedExtending(folderId: string) {
  await createPage({
    title: '扩展开发 QA',
    folderId,
    blocks: [
      {
        id: 'ext-intro', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 2,
        content: md(
          '# 扩展开发 QA\n\n' +
            '两条扩展路径：**块（block kind）**和**主题（theme）**。' +
            'In-tree 实现就是恰好住在仓库里的插件——它们只许消费公开契约面，没有任何特例分支，' +
            '所以照着抄就是对的。',
        ),
      },
      {
        id: 'ext-kind-md', kind: 'markdown', col: 0, row: 2, colSpan: 5, rowSpan: 6,
        content: md(
          '## Q: 怎么加一个新块？\n\n' +
            '在 `packages/block-kinds/src/<kind>/` 实现 `BlockKindModule`，' +
            '在 registry 登记，完事——palette、属性面板、发布渲染全部自动接上。\n\n' +
            '**规则**：\n\n' +
            '- `kind` 字符串进 DB 和导出格式，**永不改名**\n' +
            '- content 形状归 kind 所有，平台不解释\n' +
            '- `RenderView` 必须 renderToStaticMarkup-safe（首帧完整、无网络、无 author 控件）\n' +
            '- 引用 blob 必须用小写 hex sha256 原文\n' +
            '- 颜色经 `useTheme()` 的表面 token，**不许硬编码**——暗色主题才成立\n' +
            '- 未知 kind 由消费方降级（内容保留、本地降级、永不炸页）',
        ),
      },
      {
        id: 'ext-kind-code', kind: 'code', col: 5, row: 2, colSpan: 7, rowSpan: 6,
        content: code('typescript',
          "// packages/block-kinds/src/callout/callout.tsx（示意）\n" +
            "import type { BlockKindModule } from '../types';\n" +
            '\n' +
            'export type CalloutContent = { tone: string; markdown: string };\n' +
            '\n' +
            'export const calloutModule: BlockKindModule<CalloutContent> = {\n' +
            "  kind: 'callout',          // 进 DB，永不改名\n" +
            "  label: 'Callout',\n" +
            "  glyph: '💡',\n" +
            '  defaultSize: { colSpan: 6, rowSpan: 2 },\n' +
            "  createContent: () => ({ tone: 'info', markdown: '' }),\n" +
            '  EditView,                 // 只挂在单个 active 块上\n' +
            '  RenderView,               // 预览 + 公开读 + 静态渲染共用\n' +
            '  extractText: (c) => c.markdown,\n' +
            '  tools: [                  // 属性面板贡献（可选）\n' +
            "    { id: 'tone', label: 'Tone', View: ToneTool },\n" +
            '  ],\n' +
            '};\n' +
            '\n' +
            '// 最后：src/registry.ts 的 BLOCK_KINDS 里登记',
        ),
      },
      {
        id: 'ext-theme-md', kind: 'markdown', col: 0, row: 8, colSpan: 5, rowSpan: 6,
        content: md(
          '## Q: 怎么写一个主题？\n\n' +
            '三条路（内置三主题是参考实现，不是基类）：\n\n' +
            '1. **fork** 一个最接近的内置主题改 tokens\n' +
            '2. **组合**：自有 tokens + 复用通用壳（如 `FlatShellFrame`）\n' +
            '3. **从零**：实现完整 `Theme` 对象（tokens + 可选 slots）\n\n' +
            '**分权要点**：\n\n' +
            '- 几何 token（slot/pad/radius）不进 palette 变体——类型直接排除\n' +
            '- `customizableTokens` 缺省全锁，开放是显式 opt-in\n' +
            '- slot 组件读 token 用 `useTheme()`（渲染时），别闭包外层常量——' +
            'palette 变体要在 slot 深处也生效\n' +
            '- 壳进 `shells` map：声明即实现，`kinds` 可限定适用块',
        ),
      },
      {
        id: 'ext-theme-code', kind: 'code', col: 5, row: 8, colSpan: 7, rowSpan: 6,
        content: code('typescript',
          "// packages/theme/src/<your-theme>.ts（示意）\n" +
            "import { FlatShellFrame } from './shells';\n" +
            '\n' +
            'export const myTheme: Theme = {\n' +
            "  id: 'my-theme',           // 进 DB / 导出格式，永不改名\n" +
            "  name: 'My Theme',\n" +
            '  // —— tokens（canvasBg / blockBg / accent / fontFamily…）\n' +
            '  ...tokens,\n' +
            '  // —— 官方配色变体：运营者只能从这里挑\n' +
            "  palettes: [{ id: 'dusk', name: 'Dusk', tokens: { accent: '…' } }],\n" +
            '  // —— 覆写白名单：缺省全锁\n' +
            "  customizableTokens: ['fontFamily'],\n" +
            '  // —— 块壳：声明即实现（Frame 就在声明里）\n' +
            '  shells: {\n' +
            "    flat: { name: 'Flat', Frame: FlatShellFrame },\n" +
            "    photo: { name: 'Photo', kinds: ['image'], Frame: PhotoFrame },\n" +
            '  },\n' +
            '};\n' +
            '// 注册：src/registry.ts（唯一 import 具体主题的模块）',
        ),
      },
      {
        id: 'ext-test', kind: 'markdown', col: 0, row: 14, colSpan: 12, rowSpan: 3,
        content: md(
          '## Q: 改完怎么验证没破坏契约？\n\n' +
            '`bun run --filter "*" test` 里有几道专门的护栏：**静态渲染纯度**（slots.test / static.test：' +
            'renderToStaticMarkup 必须产出完整标记）、**壳差异性**（每个声明的壳必须渲染出与默认 Frame 不同的结果——' +
            '防"声明了但看不出来"）、**导出确定性**（同一实例两次导出字节一致）、**格式往返**（v1→v4→v1 无损 + 报损完整）。' +
            '加块/加主题不需要新增平台测试；你只需要测自己的模块。',
        ),
      },
    ],
  });
}

// ---------- page 4: 运维与数据 QA ----------

async function seedOps(folderId: string) {
  await createPage({
    title: '运维与数据 QA',
    folderId,
    blocks: [
      {
        id: 'ops-intro', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 2,
        content: md(
          '# 运维与数据 QA\n\n' +
            '面向自托管运营者：部署、备份、迁移、回收。原则一句话——' +
            '**你的数据永远能以可读格式完整离开本系统**。',
        ),
      },
      {
        id: 'ops-deploy-md', kind: 'markdown', col: 0, row: 2, colSpan: 5, rowSpan: 5,
        content: md(
          '## Q: 怎么部署？\n\n' +
            '单容器（Dockerfile 在仓库根），SQLite + 本地 blob 目录，挂一个卷就够。\n\n' +
            '**必须设置的 env**：\n\n' +
            '- `SHCKB_AUTH_SECRET` — ≥32 字符，泄漏 = 会话伪造\n' +
            '- `SHCKB_ADMIN_EMAIL` / `SHCKB_ADMIN_PASSWORD` — 仅首启引导用（用户表空时）\n' +
            '- `SHCKB_DB_PATH` / `SHCKB_BLOB_DIR` — 持久化位置（默认 `./data/`）\n\n' +
            '公开注册**永久关闭**——“第一个访客成为管理员”在这套启动逻辑下不可能发生：' +
            '表空 + 无 env = 拒绝启动。',
        ),
      },
      {
        id: 'ops-deploy-code', kind: 'code', col: 5, row: 2, colSpan: 7, rowSpan: 5,
        content: code('bash',
          '# 最小 docker 部署\n' +
            'docker build -t shckb .\n' +
            'docker run -d --name shckb -p 3000:3000 \\\n' +
            '  -v shckb-data:/app/data \\\n' +
            '  -e SHCKB_AUTH_SECRET="$(openssl rand -base64 32)" \\\n' +
            '  -e SHCKB_ADMIN_EMAIL=you@example.com \\\n' +
            '  -e SHCKB_ADMIN_PASSWORD=a-real-password \\\n' +
            '  shckb\n' +
            '\n' +
            '# 备份 = 一次逻辑导出（zip：canonical JSON + blobs）\n' +
            'curl -H "cookie: $SESSION" -o backup.zip \\\n' +
            '  http://localhost:3000/api/admin/export\n' +
            '\n' +
            '# 恢复 = 空实例导入\n' +
            'curl -X POST -H "cookie: $SESSION" \\\n' +
            '  -H "content-type: application/zip" \\\n' +
            '  --data-binary @backup.zip \\\n' +
            '  http://localhost:3000/api/admin/import',
        ),
      },
      {
        id: 'ops-migrate', kind: 'markdown', col: 0, row: 7, colSpan: 6, rowSpan: 5,
        content: md(
          '## Q: 升级/降级怎么保数据？\n\n' +
            '- **升级**：DB schema 迁移在启动时自动按序执行；导出格式向后兼容' +
            '（旧包导入时自动 up-transform 到当前版本）\n' +
            '- **降级**：危险的从来不是降级，是原地改唯一副本。流程 = ' +
            '新版本上 `GET /api/admin/export?format=<旧版本号>` 产出旧格式包' +
            '（**显式列出每一项丢弃的数据**，响应头带 loss 计数），旧实例空库导入\n' +
            '- `?dryRun` 先看损失清单再决定\n\n' +
            '导入失败不会留半成品——三道门全过才开始写。',
        ),
      },
      {
        id: 'ops-gc', kind: 'markdown', col: 6, row: 7, colSpan: 6, rowSpan: 5,
        content: md(
          '## Q: 磁盘怎么回收？图片删了空间没小？\n\n' +
            'blob 是内容寻址（sha256）共享存储：同一张图被十个页引用只存一份，' +
            '删一个引用不能删文件。\n\n' +
            '回收是**显式管理动作**：`POST /api/admin/blobs/gc`。' +
            '它扫描所有工作态 content、已发布快照、页背景，凡被引用的一律保活' +
            '（保守方向：误报只会多保活，**永不误删活体**——已发布页的背景图' +
            '即使工作态已清除也受快照引用保护）。\n\n' +
            '孤儿文件（如失败导入的残留）同样被这次 GC 清掉。',
        ),
      },
      {
        id: 'ops-troubleshoot', kind: 'markdown', col: 0, row: 12, colSpan: 12, rowSpan: 3,
        content: md(
          '## Q: 出问题了先看什么？\n\n' +
            '`GET /api/health` 报版本 + schema 版本（匿名可达）。' +
            '坏数据行不会炸整个实例：列表路由逐行降级（坏行跳过）、公开单页读对损坏快照' +
            '显式报错并提示重新发布、导出把坏行降级为空而不是让备份失败。' +
            '如果公开页样式陈旧，换一次实例主题或重新发布即可触发全量重渲染。',
        ),
      },
    ],
  });
}

// ---------- main ----------

async function main() {
  console.log(`seeding devdocs -> ${BASE}`);
  await login();

  const tree = (await req('GET', '/api/tree')) as { folders: Array<{ id: string; name: string; parentId: string | null }> };
  if (tree.folders.some((f) => f.parentId === null && f.name === '开发者文档')) {
    console.error('top-level folder 开发者文档 already exists — aborting (idempotence guard)');
    process.exit(2);
  }

  const { id: folderId } = (await req('POST', '/api/folders', { name: '开发者文档' })) as { id: string };
  await seedGuide(folderId);
  await seedArchitecture(folderId);
  await seedExtending(folderId);
  await seedOps(folderId);
  console.log('done.');
}

await main();
