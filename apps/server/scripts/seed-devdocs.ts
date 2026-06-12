/**
 * Seed the in-product developer docs (MVP-7 M7-D3; reworked M7-D10 per
 * owner feedback: deeper hierarchy, richer content, and a structure
 * map that USES the canvas — every module is a block, the layout of
 * the sheet IS the architecture).
 *
 * Docs-as-bundle governance: this script is the canonical source, the
 * exported bundle (devdocs/skb-devdocs.zip) is the reviewable
 * artifact. PRD/ADR governance docs deliberately stay in git only.
 *
 * Usage:
 *   bun scripts/seed-devdocs.ts --base http://localhost:3210 \
 *     --email admin@local.dev --password dev-admin-password [--replace]
 *
 * Idempotence: aborts if a top-level 开发者文档 folder exists, unless
 * --replace is given — then the existing docs tree (pages + subfolders)
 * is deleted first and reseeded. Only touches that one folder.
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
const REPLACE = process.argv.includes('--replace');

const ROOT_NAME = '开发者文档';

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

type TreeShape = {
  folders: Array<{ id: string; name: string; parentId: string | null }>;
  notepages: Array<{ id: string; folderId: string | null; title: string }>;
};

/** --replace: remove the existing docs tree (pages first, folders
 * bottom-up — the API requires folders to be empty before delete). */
async function removeExisting(tree: TreeShape, rootId: string) {
  const inSubtree = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of tree.folders) {
      if (f.parentId !== null && inSubtree.has(f.parentId) && !inSubtree.has(f.id)) {
        inSubtree.add(f.id);
        grew = true;
      }
    }
  }
  for (const p of tree.notepages) {
    if (p.folderId !== null && inSubtree.has(p.folderId)) {
      await req('DELETE', `/api/notepages/${p.id}`);
      console.log(`  − page ${p.title}`);
    }
  }
  // delete deepest-first
  const depth = (id: string): number => {
    let d = 0;
    let cur = tree.folders.find((f) => f.id === id);
    while (cur && cur.parentId !== null) {
      d++;
      cur = tree.folders.find((f) => f.id === cur!.parentId);
    }
    return d;
  };
  const folderIds = [...inSubtree].sort((a, b) => depth(b) - depth(a));
  for (const id of folderIds) {
    await req('DELETE', `/api/folders/${id}`);
  }
  console.log(`  − folder tree ${ROOT_NAME}`);
}

// ---------- page builders ----------

type SeedBlock = {
  id: string;
  kind: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  shell?: string | null;
  content: unknown;
};

const md = (markdown: string) => ({ markdown });
const code = (language: string, source: string) => ({ language, source });

/** Markdown block shorthand: b(id, col, row, w, h, text, shell?). */
function b(id: string, col: number, row: number, colSpan: number, rowSpan: number, text: string, shell?: string): SeedBlock {
  return { id, kind: 'markdown', col, row, colSpan, rowSpan, shell: shell ?? null, content: md(text) };
}

function cb(id: string, col: number, row: number, colSpan: number, rowSpan: number, language: string, source: string): SeedBlock {
  return { id, kind: 'code', col, row, colSpan, rowSpan, shell: null, content: code(language, source) };
}

async function createPage(opts: { title: string; folderId: string; themeId: string; blocks: SeedBlock[] }): Promise<string> {
  const { id } = (await req('POST', '/api/notepages', { title: opts.title })) as { id: string };
  await req('POST', `/api/notepages/${id}/move`, { folderId: opts.folderId });
  await req('PUT', `/api/notepages/${id}/working-state`, {
    title: opts.title,
    gravityEnabled: false, // docs pages keep authored row positions
    blocks: opts.blocks,
  });
  await req('POST', `/api/notepages/${id}/theme`, { themeId: opts.themeId });
  const pub = (await req('POST', `/api/notepages/${id}/publish`)) as { slug: string };
  await req('POST', `/api/notepages/${id}/visibility`, { visibility: 'public' });
  console.log(`  ✓ ${opts.title} -> /notes/${pub.slug}`);
  return pub.slug;
}

/** In-product cross-link (dogfooding workaround: no first-class
 * inter-page links yet — recorded friction, M7-D3). */
const see = (title: string, slug?: string) => `→ 详见 [${title}](/notes/${slug ?? title})`;

// ============================================================
// 结构导图 — the canvas IS the architecture diagram (galley theme:
// module blocks wear the keyline shell like figure plates; band
// rules are cutouts printed straight on the sheet).
// ============================================================

async function seedMap(folderId: string) {
  const blocks: SeedBlock[] = [
    b('map-intro', 0, 0, 12, 2,
      '# 结构导图\n\n' +
        '**这张画布本身就是 SHCKB 的架构图**：每个块 = 一个模块，横向带 = 一层；上层消费下层，' +
        '同带并列即同层协作。每块只放一句职责与关键契约，细节进各自的详页。',
    ),

    b('map-band-app', 0, 2, 12, 1, '**◤ 应用层 `apps/` —— 可部署的两张脸**', 'cutout'),

    b('map-web', 0, 3, 3, 3,
      '### apps/web · 编辑器\n\nReact 18 + Vite SPA。职票条 / 目次页 / Properties 检查器等 chrome；' +
        '块预览用与发布完全相同的 RenderView。\n\n' + see('开发者导览'),
      'keyline'),
    b('map-reader', 3, 3, 3, 3,
      '### 读者面\n\n发布页 = publish 时渲染好的**静态 HTML** 直出（零 JS 依赖）；' +
        'SPA 侧另有总目次与读页。两者同源同主题。\n\n' + see('两态模型与发布管线'),
      'keyline'),
    b('map-server', 6, 3, 3, 3,
      '### apps/server · API\n\nBun + Hono。**PEP 单点准入**（身份只验一次）；' +
        '写入用与前端同一套 grid-engine 复验。\n\n' + see('认证与权限'),
      'keyline'),
    b('map-pipeline', 9, 3, 3, 3,
      '### 发布 / 导出管线\n\npublish 把工作态冻结成快照并渲染 HTML；' +
        '导出产出**确定性** zip（canonical JSON + blobs）。\n\n' + see('数据与存储'),
      'keyline'),

    b('map-band-pkg', 0, 6, 12, 1, '**◤ 共享包层 `packages/` —— headless、契约先行（CONTRACT.md 即承诺）**', 'cutout'),

    b('map-engine', 0, 7, 3, 3,
      '### grid-engine\n\nheadless 12 列网格引擎，纯函数。AABB 不重叠 / 重力 / hole-fill 三不变量，' +
        'property-based 测试压阵。**谁都不许绕过它改布局。**\n\n' + see('网格引擎与画布'),
      'keyline'),
    b('map-theme', 3, 7, 3, 3,
      '### @skb/theme\n\ntokens + slots + palettes + shells；7 个内置主题即参考实现。' +
        '三层外观分权的载体。\n\n' + see('主题引擎'),
      'keyline'),
    b('map-blocks', 6, 7, 3, 3,
      '### @skb/block-kinds\n\n**块即插件**：markdown / image / code 是恰好住在仓库里的插件，' +
        '只消费公开契约面。RenderView 必须静态渲染安全。\n\n' + see('块系统'),
      'keyline'),
    b('map-uikit', 9, 7, 3, 3,
      '### @skb/ui-kit\n\n工具面板 UI 原语（Select/Button/Toggle…），纯 token 消费、零 context 依赖——' +
        '块工具和 chrome 都用它拼。\n\n' + see('写一个主题'),
      'keyline'),

    b('map-band-data', 0, 10, 12, 1, '**◤ 数据层 ——「你的数据永远能完整离开」是产品立场**', 'cutout'),

    b('map-db', 0, 11, 4, 3,
      '### SQLite · Drizzle\n\nnotepages / blocks / settings / auth 诸表；启动时按序自动迁移' +
        '（当前 schema v7）。坏行逐行降级，永不炸整个请求。\n\n' + see('数据与存储'),
      'keyline'),
    b('map-blob', 4, 11, 4, 3,
      '### Blob store\n\nsha256 内容寻址、不可变文件。引用契约：content JSON 里写哈希原文 → ' +
        '平台无需理解内容也能枚举引用；GC 保守保活。\n\n' + see('数据与存储'),
      'keyline'),
    b('map-format', 8, 11, 4, 3,
      '### 导出格式 v4\n\ncanonical JSON + blobs 的 zip；每次格式变更必须**成对**提交 up/down ' +
        'transform，降级在导出端、有损必显式。\n\n' + see('备份迁移与排障'),
      'keyline'),

    b('map-governance', 0, 14, 12, 2,
      '**治理带**：行为变更的顺序永远是 **PRD →（新）ADR → CONTRACT → 代码**——PRD 是产品真理，住在 git ' +
        '`docs/product/prd/`；ADR-0019 起有效；包级承诺在 `packages/*/CONTRACT.md`。' +
        '本产品内文档由 `apps/server/scripts/seed-devdocs.ts` 可重放生成，git 里的脚本才是真理源。',
      'cutout'),
  ];
  await createPage({ title: '结构导图', folderId, themeId: 'galley', blocks });
}

// ============================================================
// 开发者导览（root）
// ============================================================

async function seedGuide(folderId: string) {
  await createPage({
    title: '开发者导览',
    folderId,
    themeId: 'workbench',
    blocks: [
      b('guide-intro', 0, 0, 12, 2,
        '# 开发者导览\n\n' +
          'SHCKB 是可自托管的画布式知识库：12 列网格 notepage、块即插件、主题引擎、确定性导出。' +
          '这页带你从 clone 到能改代码；全局心智图见 ' + see('结构导图') + '。',
      ),
      b('guide-layout', 0, 2, 5, 6,
        '## 仓库结构\n\n' +
          '- `packages/grid-engine` — headless 网格引擎（测试最厚）\n' +
          '- `packages/theme` — 主题引擎\n' +
          '- `packages/block-kinds` — 内置块 + 静态渲染入口\n' +
          '- `packages/ui-kit` — 面板 UI 原语\n' +
          '- `apps/server` — Bun + Hono + Drizzle(SQLite)\n' +
          '- `apps/web` — React 18 + Vite\n' +
          '- `docs/` — PRD / ADR / 讨论记录 / runbook\n' +
          '- `devdocs/` `examples/` — 产品内文档与示例的导出包\n\n' +
          '**改接口先改契约**：每个包的对外承诺在 `packages/<pkg>/CONTRACT.md`。',
      ),
      cb('guide-run', 5, 2, 7, 6, 'bash',
        '# 安装（仓库用 bun 管 workspace；单一 bun.lock，别用 pnpm/npm）\n' +
          'bun install\n\n' +
          '# 服务端（首启需引导管理员；密钥 ≥32 字符；从仓库根启动——\n' +
          '# SHCKB_DB_PATH 是相对 CWD 解析的）\n' +
          'SHCKB_AUTH_SECRET=$(openssl rand -base64 32) \\\n' +
          'SHCKB_ADMIN_EMAIL=admin@example.com \\\n' +
          'SHCKB_ADMIN_PASSWORD=change-me-please \\\n' +
          'SHCKB_BASE_URL=http://localhost:5173 \\\n' +
          'PORT=3210 bun --watch apps/server/src/index.ts\n\n' +
          '# 前端（代理 /api 到 SHCKB_API_TARGET）\n' +
          'cd apps/web\n' +
          'SHCKB_API_TARGET=http://localhost:3210 bun x vite --port 5173\n\n' +
          '# 全仓测试 / 类型检查\n' +
          'bun run --filter "*" test\n' +
          'bun run --filter "*" typecheck',
      ),
      b('guide-docs-tree', 0, 8, 6, 5,
        '## 文档去哪儿找\n\n' +
          '治理文档在 git，不在产品里：\n\n' +
          '- `docs/product/prd/` — 产品真理（用户可观察的 WHAT）。**PRD 是上游**，一切下游。\n' +
          '- `docs/engineering/decisions/` — ADR（HOW 的取舍）。**ADR-0001..0018 是已废弃的旧框架草稿**，只作历史追溯，不得引为依据。\n' +
          '- `AUDIT-2026-05.md` — PRD 视角的 ADR 债登记簿。\n' +
          '- `docs/engineering/design/discussions/` — 每轮 scope 与 build log。\n' +
          '- `packages/*/CONTRACT.md` — 包级契约。\n\n' +
          '顺序：**PRD →（新）ADR → CONTRACT → 代码**。',
      ),
      b('guide-pitfalls', 6, 8, 6, 5,
        '## 新人最常踩的坑\n\n' +
          '1. **改 `packages/*` 后 vite 不热更** —— 重启 vite；workspace 包的模块图不自刷新。\n' +
          '2. **`bun --watch` 服务端会被 workspace 改动带崩** —— 重启即可；记得带 `SHCKB_BASE_URL`（经 vite 代理登录的 origin 校验需要）。\n' +
          '3. **Windows 端口排除区** —— `netsh interface ipv4 show excludedportrange protocol=tcp`；3278-3377 等整段会 EADDRINUSE。\n' +
          '4. **开发凭据只属本机** —— 任何文档里的示例密钥**绝不**用于暴露主机。\n' +
          '5. **Windows 改源码别用 PowerShell 的 Get/Set-Content** —— 非 ASCII 会被编码毁掉。',
      ),
      b('guide-tests', 0, 13, 12, 3,
        '## 验证矩阵\n\n' +
          '六个包各自带测试（bun test / vitest），全仓约 190 条：grid-engine 44（含 property-based 不变量压测）、' +
          'server 95+（HTTP 全链路：auth/两态/导出导入/坏行降级/权限门）、theme / block-kinds / ui-kit / web 单元层。' +
          '加块或加主题**不需要**新增平台测试——护栏（静态渲染纯度、壳差异性、导出确定性、格式往返）已在平台侧；你只测自己的模块。' +
          'CI 习惯：提交前 `bun run --filter "*" typecheck && bun run --filter "*" test`。',
      ),
    ],
  });
}

// ============================================================
// 架构 / 网格引擎与画布
// ============================================================

async function seedEngine(folderId: string) {
  await createPage({
    title: '网格引擎与画布',
    folderId,
    themeId: 'workbench',
    blocks: [
      b('eng-intro', 0, 0, 12, 2,
        '# 网格引擎与画布\n\n' +
          '`packages/grid-engine` 是整个产品的几何真理：headless、纯函数、零 React 依赖。' +
          '画布上的一切移动/缩放/插入，前后端跑的是**同一套**代码。',
      ),
      b('eng-state', 0, 2, 5, 5,
        '## GridState 与三不变量\n\n' +
          '`GridState = { totalCols: 12, blocks: [{id, kind, col, row, colSpan, rowSpan}] }`\n\n' +
          '每次 mutation 之后必须保持：\n\n' +
          '1. **AABB 不重叠** — 任意两块包围盒不相交\n' +
          '2. **界内** — `0 ≤ col`，`col+colSpan ≤ 12`，`row ≥ 0`\n' +
          '3. **重力（可选）** — 开启时块上浮填洞，不悬空\n\n' +
          '重力是 **author 级产品功能**（每页持久化开关），关闭时悬空布局合法。',
      ),
      cb('eng-api', 5, 2, 7, 5, 'typescript',
        "// 全部纯函数：输入 state，返回新 state 或显式失败\n" +
          "insertBlock(state, block, { gravity })      // 放置（hole-fill 语义裁剪尺寸）\n" +
          "moveBlock(state, id, col, row, { gravity }) // 移动保尺寸，绝不重新触发 hole-fill\n" +
          "transformBlock(state, id, changes, opts)    // 移动+缩放一体\n" +
          "deleteBlock(state, id, opts)\n" +
          "inferDropIntent(state, col, row, size)      // 拖拽悬停意图：place | reject\n" +
          "validateState(state, { gravity })           // 全量校验 → { ok } | { ok:false, errors }\n" +
          '\n' +
          '// 失败形状统一 { ok: false, error } —— 调用方丢弃该次操作即可，\n' +
          '// 永远不会拿到一个破坏不变量的 state。',
      ),
      b('eng-drag', 0, 7, 6, 5,
        '## 拖拽模型（apps/web 侧）\n\n' +
          '- HTML5 原生 DnD 做跨元素拖动（块移动 + palette 插入）；缩放走 pointer events\n' +
          '- **预览诚实**：dragover 时用真实 `moveBlock` 做探针，幽灵显示的就是松手后的落点（含重力沉降）\n' +
          '- **抓取偏移**：`moveAnchor`（纯函数，有单测）——块相对抓取点落位，不是左上角吸到光标\n' +
          '- 预览与落点共享同一段锚点数学——所见即所得是不变量，不是巧合',
      ),
      b('eng-server', 6, 7, 6, 5,
        '## 服务端复验\n\n' +
          '`PUT /notepages/:id/working-state` 在写库前用**同一个** `validateState` 复验，' +
          '违反不变量 → 422 + 错误明细。客户端先跑过一遍不代表可信——' +
          '这是"无效变更不落地"契约的服务端兜底，也是 engine 必须 headless 的原因之一。\n\n' +
          '**未来注记**：plugin 改画布形态（非 12 列、可堆叠块）已标记为远期 engine 级扩展点候选，' +
          '在那之前 12 列语义全量锁定（plugin-system PRD 2026-06-12 注记）。',
      ),
    ],
  });
}

// ============================================================
// 架构 / 两态模型与发布管线
// ============================================================

async function seedTwoState(folderId: string) {
  await createPage({
    title: '两态模型与发布管线',
    folderId,
    themeId: 'workbench',
    blocks: [
      b('ts-intro', 0, 0, 12, 2,
        '# 两态模型与发布管线\n\n' +
          '每页有两个互不打扰的状态——这是全产品最重要的产品级不变量，' +
          '编辑器、API、导出格式、主题渲染全部围绕它成形。',
      ),
      b('ts-model', 0, 2, 6, 5,
        '## 两态\n\n' +
          '- **工作态** = `notepages` 字段 + `blocks` 行。自动保存（800ms 防抖），只有作者可见。\n' +
          '- **公开态** = `publishedDoc` 快照 + `publishedHtml`。**只**由显式 publish 写入。\n\n' +
          '改标题、挪块、换背景、改壳——公开页一概不动，直到按下 publish。' +
          '读者永远看到某次明确发布的完整切片。\n\n' +
          '唯一记录在案的偏差：目录树位置是元数据，公开侧实时投影（存在性仍走两态）。',
      ),
      cb('ts-flow', 6, 2, 6, 5, 'plaintext',
        'POST /notepages/:id/publish\n' +
          '  1. 首次发布锁定 slug（之后改题不换链接）\n' +
          '  2. 工作态 → publishedDoc 快照\n' +
          '     （含 background / 每块 shell —— 外观也入快照）\n' +
          '  3. renderStaticPage(doc, slug, effectiveTheme)\n' +
          '     → 存 publishedHtml\n' +
          '  4. 读路径零渲染成本：/notes/:slug 直出该 HTML\n' +
          '\n' +
          '编辑器侧防呆：publish 前先 save，save 失败则中止\n' +
          '——旧工作态永远不会被误推上公开页。',
      ),
      b('ts-purity', 0, 7, 6, 5,
        '## 纯函数不变量\n\n' +
          '`publishedHtml = renderStaticPage(doc, slug, effectiveTheme)`\n\n' +
          '同一（快照, 主题）必然产出同一 HTML。由此派生：\n\n' +
          '- **换主题 = 全量重渲染**所有已发布页（实例主题切换、主题自定义写入都会触发），公开页永不穿旧衣\n' +
          '- 页级**主题钉选**是 render-time 元数据：改钉选立即重渲染该页，刻意不走两态\n' +
          '- RenderView 禁网络请求/禁 author 控件/主题只经 `useTheme()` 读',
      ),
      b('ts-noleak', 6, 7, 6, 5,
        '## 读者面语义\n\n' +
          '- **No-leak 404**：不存在 / 私有 / 未发布，公开路由的响应完全一致——存在性本身是私密信息\n' +
          '- 公开目录与公开树只列 public+published，标题取自**快照**（工作态改名不可见）\n' +
          '- 坏数据行逐行降级：一个损坏快照只影响它自己，目录照常返回其余条目（mvp7 review E1）\n\n' +
          see('认证与权限'),
      ),
    ],
  });
}

// ============================================================
// 架构 / 主题引擎
// ============================================================

async function seedThemeEngine(folderId: string) {
  await createPage({
    title: '主题引擎',
    folderId,
    themeId: 'workbench',
    blocks: [
      b('th-intro', 0, 0, 12, 2,
        '# 主题引擎\n\n' +
          '`packages/theme`。主题管**内容表面**的一切视觉；编辑器 chrome 不属于主题。' +
          '7 个内置主题（graph-paper / ink / workbench / stationery / blueprint / marginalia / galley）是参考实现，不是基类。',
      ),
      b('th-anatomy', 0, 2, 5, 6,
        '## 解剖\n\n' +
          '`Theme = ThemeTokens & ThemeSlots`\n\n' +
          '- **tokens**：颜色 / 字体 / 几何（slot、pad、blockRadius…）——纯数据\n' +
          '- **slots**：`BlockFrame` / `CanvasSurface` / `PageTitle` / `globalCss`——组件级覆写，缺省即默认渲染\n' +
          '- **palettes**：主题策展的官方配色变体（类型级排除几何 token）\n' +
          '- **customizableTokens**：运营者可直接覆写的白名单（缺省全锁）\n' +
          '- **shells**：作者可选的块壳，**声明即实现**（每个壳自带 Frame 组件）\n\n' +
          '**registry.ts 是唯一 import 具体主题的模块**——槽位组件经 `useTheme()` 渲染时读 token，' +
          '这让上层覆盖能穿透到主题最深处（也是当年 Bun TDZ 循环导入的解法）。',
      ),
      b('th-axes', 5, 2, 7, 3,
        '## 三层外观分权\n\n' +
          '每层只能在上一层**策展过的空间**里选：**主题作者**定空间（tokens/slots/palettes/customizableTokens/shells）→ ' +
          '**运营者**选实例主题 + palette + 白名单覆写 → **页面作者**最后选页背景与每块的壳。' +
          '自由调色被刻意拒绝——主题完整性优先。',
      ),
      b('th-sanitize', 5, 5, 7, 3,
        '## 校验的单一真理源\n\n' +
          '`sanitizeCustomization` 服务**三处**：admin 端点、importer、settings 读取——' +
          '手编包无法走私越权覆写，存量脏数据也在读取时降级。值级安全：覆写值拒 `</`' +
          '（防 `<style>` 逃逸注入），背景色走 `isSafeCssColor`（拒 `;{}<>`、`url(`）。',
      ),
      b('th-future', 0, 8, 12, 3,
        '## 方向：层占据模型（owner ratified 2026-06-12）\n\n' +
          'cascade（L3 ?? L2 ?? L1 ?? vanilla 逐属性 fall-through）之上，插件可占据一层或多层，用户按层组合；' +
          '同层单选不合并（自由堆叠被裁定为工程灾难）；vanilla 地板不可卸。三档覆盖度契约：' +
          '**材质包**（L3，纯数据，最早开放）/ **主题包**（L2，完整 Theme 模块）/ **UI 包**（L1，chrome 重代码，契约最后冻结）。' +
          '详 `docs/product/prd/features/theme-system/theme-system.md` 层占据模型段。',
      ),
    ],
  });
}

// ============================================================
// 架构 / 块系统
// ============================================================

async function seedBlockSystem(folderId: string) {
  await createPage({
    title: '块系统',
    folderId,
    themeId: 'workbench',
    blocks: [
      b('bk-intro', 0, 0, 12, 2,
        '# 块系统\n\n' +
          '`packages/block-kinds`。**In-tree kind 就是恰好住在仓库里的插件**：' +
          'markdown / image / code 只消费公开契约面，没有任何特例分支——所以"照着抄"就是正确的扩展方式。',
      ),
      cb('bk-contract', 0, 2, 7, 6, 'typescript',
        'type BlockKindModule = {\n' +
          "  kind: string;          // 进 DB 与导出格式，永不改名\n" +
          '  label: string; glyph: string;   // palette 展示\n' +
          '  defaultSize: { colSpan: number; rowSpan: number };\n' +
          '  createContent(): C;    // content 形状归 kind 所有，平台不解释\n' +
          '  EditView: FC;          // 只挂在单个 active 块上（性能边界）\n' +
          '  RenderView: FC;        // 预览 + 公开读 + publish 静态渲染共用\n' +
          '  extractText(c): string; // 搜索/导出用纯文本\n' +
          '  tools?: BlockTool[];   // Properties 面板贡献点\n' +
          '};\n' +
          '\n' +
          '// 登记：src/registry.ts 的 BLOCK_KINDS —— 唯一接入点。\n' +
          '// palette / 检查器 / 发布渲染全部自动接上，零硬编码。',
      ),
      b('bk-purity', 7, 2, 5, 6,
        '## RenderView 纯度\n\n' +
          '- **renderToStaticMarkup-safe**：首帧必须完整，不得依赖 effect 才出内容\n' +
          '- 不发网络请求、不渲染 author-only 控件\n' +
          '- 颜色经 `useTheme()` 表面 token，**禁止硬编码**（暗色主题成立的前提）\n' +
          '- 同一 (content, theme) 产出确定性标记\n\n' +
          '依赖浏览器事件的降级 UI（如 `<img onError>` 兜底框）只在 React 运行处生效；' +
          '静态页降级为原生行为——契约边界已记录在 CONTRACT.md。',
      ),
      b('bk-blob', 0, 8, 6, 4,
        '## Blob 引用契约\n\n' +
          'kind 在 content JSON 中引用 blob **必须用小写 hex sha256 原文**。' +
          '平台据此对 kind-opaque 的内容做引用枚举：导出时与 blobs 表求交、GC 时作为保守保活清单' +
          '（误报只会多保活，永不误删活体——已发布页的背景图即使工作态清除也受快照引用保护）。',
      ),
      b('bk-degrade', 6, 8, 6, 4,
        '## 降级纪律\n\n' +
          '- **未知 kind**：内容保留、本地降级渲染占位、永不炸页（旧包导入新实例 / 插件卸载场景）\n' +
          '- **损坏 content**：读取时降级为 null，页面其余块照常（mvp7 review E1）\n' +
          '- **宿主能力**只经 `useHost()`（当前面：`uploadBlob`）——增长只许增量，不许破坏性变更',
      ),
    ],
  });
}

// ============================================================
// 架构 / 认证与权限
// ============================================================

async function seedAuth(folderId: string) {
  await createPage({
    title: '认证与权限',
    folderId,
    themeId: 'workbench',
    blocks: [
      b('au-intro', 0, 0, 12, 2,
        '# 认证与权限\n\n' +
          '单作者实例的安全模型：**PEP 单点准入** + 角色门 + 永久关闭的注册。' +
          'better-auth 是 L3 适配实现，住在稳定接缝后面。',
      ),
      b('au-pep', 0, 2, 6, 5,
        '## PEP（Policy Enforcement Point）\n\n' +
          '所有 `/api/*` 请求过同一个中间件：session → 不可变 `ctx.user` Principal（或 null = 匿名合法态）。' +
          '**handler 从不自己验身份。**\n\n' +
          '- 匿名面 = `/api/public/*`、auth、health、me；其余 401\n' +
          '- Principal 只含 id / role / name / email——**绝不**携带 token/secret\n' +
          '- 角色：admin / author；`requireAdmin` 守 settings 写入与 admin 面（export / import / GC）——' +
          '每个门都有 author-403 测试钉住',
      ),
      b('au-bootstrap', 6, 2, 6, 5,
        '## 首管理员引导\n\n' +
          '公开注册**永久关闭**。用户表为空时：\n\n' +
          '- env 提供 `SHCKB_ADMIN_EMAIL` / `SHCKB_ADMIN_PASSWORD`（≥8 字符）→ 经一个**从不挂载**的临时 signup 实例创建\n' +
          '- 缺 env → **拒绝启动**——"第一个访客成为管理员"在结构上不可能发生\n\n' +
          '表非空时引导静默跳过（幂等）。',
      ),
      b('au-secrets', 0, 7, 12, 3,
        '## 安全清单\n\n' +
          '`SHCKB_AUTH_SECRET` ≥32 字符，泄漏 = 会话伪造，生产用 `openssl rand -base64 32` 现生成；' +
          '反代/经 vite 代理时必须设 `SHCKB_BASE_URL`（better-auth origin 校验，否则登录 403）；' +
          '文档与 compose 里的开发凭据只属本机。纵深：导入包三道门全在写前、上传 zip 双重解压上限（防 zip bomb）、' +
          '运营者可控的 CSS 值过 `isSafeCssValue`/`isSafeCssColor` 双闸。',
      ),
    ],
  });
}

// ============================================================
// 架构 / 数据与存储
// ============================================================

async function seedData(folderId: string) {
  await createPage({
    title: '数据与存储',
    folderId,
    themeId: 'workbench',
    blocks: [
      b('da-intro', 0, 0, 12, 2,
        '# 数据与存储\n\n' +
          'SQLite（经 Drizzle）+ 内容寻址 blob 目录 + 确定性导出包。' +
          '立场：**你的数据永远能以可读格式完整离开本系统**。',
      ),
      cb('da-schema', 0, 2, 6, 6, 'plaintext',
        '核心表（schema v7）\n' +
          '────────────────\n' +
          'notepages  id ▏slug(发布时锁定) ▏title ▏visibility\n' +
          '           gravity_enabled ▏theme_id(钉选)\n' +
          '           background(JSON) ▏folder_id ▏sort_key\n' +
          '           published_doc(快照 JSON) ▏published_html\n' +
          'blocks     (notepage_id, id) 复合主键\n' +
          '           kind ▏col/row/col_span/row_span\n' +
          '           shell ▏content(kind-owned JSON 文本)\n' +
          'folders    id ▏name ▏parent_id(单表森林)\n' +
          'blobs      hash(sha256) ▏size ▏mime_type\n' +
          'settings   key ▏value（实例主题/themeCustomization）\n' +
          '+ better-auth 的 user/session/account 表',
      ),
      b('da-migrate', 6, 2, 6, 3,
        '## 迁移\n\n' +
          'drizzle-kit generate 产 SQL，自写 applier 启动时按序执行：baseline stamping、' +
          '降级护栏（新库拒旧码）、篡改护栏（哈希校验，CRLF 归一）。`/api/health` 暴露 schemaVersion。',
      ),
      b('da-blob', 6, 5, 6, 3,
        '## Blob store\n\n' +
          'sha256 命名的不可变文件（local-fs）；同图多引用只存一份；' +
          '64-hex 正则防路径穿越；immutable cache 头。回收是显式管理动作' + see('备份迁移与排障') + '。',
      ),
      b('da-resilience', 0, 8, 12, 3,
        '## 坏数据韧性（mvp7 review 后的系统性立场）\n\n' +
          '存储列回流的 JSON 一律 `safeParse` 降级：列表路由坏行跳过、公开树回退工作标题、' +
          '换主题坏行保旧 HTML、**导出坏行降 null 而不是让备份失败**、GC 坏行视为零引用；' +
          'Hono `app.onError` 兜底 `{error}` shape。一行坏数据的影响半径 = 它自己。',
      ),
    ],
  });
}

// ============================================================
// 扩展开发 / 写一个块
// ============================================================

async function seedNewBlock(folderId: string) {
  await createPage({
    title: '写一个块',
    folderId,
    themeId: 'workbench',
    blocks: [
      b('nb-intro', 0, 0, 12, 2,
        '# 写一个块（block kind）\n\n' +
          '在 `packages/block-kinds/src/<kind>/` 实现 `BlockKindModule`，registry 登记一行，完事——' +
          'palette、Properties 面板、发布渲染全部自动接上。契约细节见 ' + see('块系统') + '。',
      ),
      cb('nb-code', 0, 2, 7, 7, 'typescript',
        "// packages/block-kinds/src/callout/callout.tsx（示意）\n" +
          "import type { BlockKindModule } from '../types';\n" +
          '\n' +
          'export type CalloutContent = { tone: string; markdown: string };\n' +
          '\n' +
          'export const calloutModule: BlockKindModule<CalloutContent> = {\n' +
          "  kind: 'callout',            // 进 DB，永不改名\n" +
          "  label: 'Callout',\n" +
          "  glyph: '💡',\n" +
          '  defaultSize: { colSpan: 6, rowSpan: 2 },\n' +
          "  createContent: () => ({ tone: 'info', markdown: '' }),\n" +
          '  EditView,                   // 单 active 块挂载\n' +
          '  RenderView,                 // 三处共用，必须静态安全\n' +
          '  extractText: (c) => c.markdown,\n' +
          "  tools: [{ id: 'tone', label: 'Tone', View: ToneTool }],\n" +
          '};\n' +
          '\n' +
          "// 最后：src/registry.ts 的 BLOCK_KINDS 登记；\n" +
          '// 工具 View 用 @skb/ui-kit 原语拼，宿主能力只经 useHost()。',
      ),
      b('nb-rules', 7, 2, 5, 7,
        '## 七条规则\n\n' +
          '1. `kind` 字符串永不改名（DB + 导出格式）\n' +
          '2. content 形状归你所有，平台不解释\n' +
          '3. RenderView 首帧完整、无网络、无 author 控件\n' +
          '4. 颜色经 `useTheme()` 表面 token，不许硬编码\n' +
          '5. 引用 blob 用小写 hex sha256 原文\n' +
          '6. EditView 假设自己是页上唯一挂载的编辑器\n' +
          '7. 给自己的模块写测试（参考 `__tests__/code.test.ts` 的形状）——平台护栏不替你测内容逻辑',
      ),
      b('nb-verify', 0, 9, 12, 2,
        '## 验证\n\n' +
          '`bun run --filter @skb/block-kinds test` + 全仓 typecheck。平台护栏会自动覆盖你：' +
          '静态渲染纯度（slots/static 测试）、未知 kind 降级、导出确定性。视觉冒烟：dev 实例插一个块 → publish → 看静态页。',
      ),
    ],
  });
}

// ============================================================
// 扩展开发 / 写一个主题
// ============================================================

async function seedNewTheme(folderId: string) {
  await createPage({
    title: '写一个主题',
    folderId,
    themeId: 'workbench',
    blocks: [
      b('nt-intro', 0, 0, 12, 2,
        '# 写一个主题\n\n' +
          '三条路（7 个内置主题是参考实现，不是基类）：**fork** 最接近的内置改 tokens；' +
          '**组合**自有 tokens + 复用通用壳；**从零**实现完整 Theme。引擎机制见 ' + see('主题引擎') + '。',
      ),
      cb('nt-code', 0, 2, 7, 7, 'typescript',
        "// packages/theme/src/<your-theme>.tsx（示意）\n" +
          "import { useTheme } from './context';\n" +
          '\n' +
          'export const myTheme: Theme = {\n' +
          "  id: 'my-theme',            // 进 DB / 导出格式，永不改名\n" +
          "  name: 'My Theme',\n" +
          '  ...tokens,                 // canvasBg / blockBg / accent / fontFamily…\n' +
          '  // 槽位组件（可选，缺省即默认渲染）：\n' +
          '  BlockFrame, CanvasSurface, PageTitle, globalCss,\n' +
          '  // 官方配色变体：运营者只能从这里挑\n' +
          "  palettes: [{ id: 'dusk', name: 'Dusk', tokens: { accent: '…' } }],\n" +
          '  // 覆写白名单：缺省全锁\n' +
          "  customizableTokens: ['fontFamily'],\n" +
          '  // 作者可选壳：声明即实现\n' +
          '  shells: {\n' +
          "    flat: { name: 'Flat', Frame: FlatShellFrame },\n" +
          "    photo: { name: 'Photo', kinds: ['image'], Frame: PhotoFrame },\n" +
          '  },\n' +
          '};\n' +
          "// 注册：src/registry.ts（唯一 import 具体主题的模块）+ index.ts 导出",
      ),
      b('nt-rules', 7, 2, 5, 7,
        '## 分权要点\n\n' +
          '- 槽位组件读 token 用 `useTheme()`（渲染时），**别**闭包外层常量——palette 变体要能穿透到槽位深处\n' +
          '- 几何 token 不进 palette 变体（类型直接排除）\n' +
          '- 槽位必须 renderToStaticMarkup-safe + 确定性（随机量用 id 哈希，如 stationery 的微倾）\n' +
          '- 壳 id 持久化于 blocks.shell 与导出格式，永不改名；未知壳自动落回默认 Frame\n' +
          '- 主题管内容表面，**chrome 不归主题**（编辑器工具的视觉是 chrome 自己的）',
      ),
      b('nt-verify', 0, 9, 12, 2,
        '## 验证\n\n' +
          '平台护栏：**壳差异性测试**（每个声明的壳必须渲染出与默认 Frame 不同的结果）、静态纯度、palette 在深槽位生效。' +
          '视觉冒烟跑全 7+1 主题对照：同一页逐个钉选，看暗色行内 code、表格 hairline、引用块——历史上踩坑最多的三处表面。',
      ),
    ],
  });
}

// ============================================================
// 运维 / 部署与环境
// ============================================================

async function seedDeploy(folderId: string) {
  await createPage({
    title: '部署与环境',
    folderId,
    themeId: 'workbench',
    blocks: [
      b('dp-intro', 0, 0, 12, 2,
        '# 部署与环境\n\n' +
          '单容器（Dockerfile 在仓库根），SQLite + 本地 blob 目录，挂一个卷就够。' +
          '面向 Solo NAS / 小 VPS 的自托管形态。',
      ),
      cb('dp-docker', 0, 2, 7, 6, 'bash',
        '# 最小 docker 部署\n' +
          'docker build -t shckb .\n' +
          'docker run -d --name shckb -p 3000:3000 \\\n' +
          '  -v shckb-data:/app/data \\\n' +
          '  -e SHCKB_AUTH_SECRET="$(openssl rand -base64 32)" \\\n' +
          '  -e SHCKB_ADMIN_EMAIL=you@example.com \\\n' +
          '  -e SHCKB_ADMIN_PASSWORD=a-real-password \\\n' +
          '  shckb\n' +
          '\n' +
          '# 升级：拉新镜像重启即可 —— DB schema 启动时自动迁移；\n' +
          '# 升级前先做一次导出备份（见 备份迁移与排障）。\n' +
          '# SQLite 是 WAL 模式：文件级备份必须连 -wal/-shm 一起拷，\n' +
          '# 或干脆只信逻辑导出。',
      ),
      b('dp-env', 7, 2, 5, 6,
        '## 环境变量\n\n' +
          '- `SHCKB_AUTH_SECRET` — **必须**，≥32 字符\n' +
          '- `SHCKB_ADMIN_EMAIL` / `_PASSWORD` — 仅首启（用户表空时）\n' +
          '- `SHCKB_DB_PATH` / `SHCKB_BLOB_DIR` — 默认 `./data/`（相对 CWD）\n' +
          '- `SHCKB_BASE_URL` — 反代后**必须**（origin 校验）\n' +
          '- `SHCKB_WEB_DIST` — 指向 web 构建产物（容器内已设）\n' +
          '- `PORT` — 默认 3000\n\n' +
          '请求体上限 256MiB（导入包是最大合法 body）。',
      ),
      b('dp-checklist', 0, 8, 12, 3,
        '## 暴露公网前的清单\n\n' +
          '① 密钥现生成、不复用任何文档示例值；② 反代设 `SHCKB_BASE_URL=https://你的域名`；' +
          '③ 确认注册不可达（`POST /api/auth/sign-up/email` 应 4xx）；④ `/api/health` 通、schemaVersion 符合预期；' +
          '⑤ 做一次导出并在干净实例验证可导入——**没验证过恢复的备份不算备份**。',
      ),
    ],
  });
}

// ============================================================
// 运维 / 备份迁移与排障
// ============================================================

async function seedOps(folderId: string) {
  await createPage({
    title: '备份迁移与排障',
    folderId,
    themeId: 'workbench',
    blocks: [
      b('op-intro', 0, 0, 12, 2,
        '# 备份、迁移与排障\n\n' +
          '逻辑导出是唯一推荐的备份与迁移通道：canonical JSON（键序稳定、2 空格、LF）+ ' +
          '内容寻址 blobs 的 zip，字节确定（除 `exportedAt`）。',
      ),
      cb('op-backup', 0, 2, 6, 5, 'bash',
        '# 备份 = 一次导出\n' +
          'curl -H "cookie: $SESSION" -o backup.zip \\\n' +
          '  http://localhost:3000/api/admin/export\n' +
          '\n' +
          '# 恢复 = 空实例导入（三道门：空库/版本/逐页校验，\n' +
          '# 全过才写，失败不留半成品）\n' +
          'curl -X POST -H "cookie: $SESSION" \\\n' +
          '  -H "content-type: application/zip" \\\n' +
          '  --data-binary @backup.zip \\\n' +
          '  http://localhost:3000/api/admin/import\n' +
          '\n' +
          '# 降级到旧版本格式（显式报每一项损失）\n' +
          'curl "...:3000/api/admin/export?format=3&dryRun"  # 先看损失\n' +
          'curl -o old.zip "...:3000/api/admin/export?format=3"',
      ),
      b('op-format', 6, 2, 6, 5,
        '## 格式版本化纪律\n\n' +
          '- 当前 v4（v2 主题钉选 → v3 主题自定义 → v4 外观轴）\n' +
          '- 每次格式变更**必须成对**提交 up/down transform——成本翻倍是刹车不是负担\n' +
          '- **降级发生在导出端**（旧 build 不可能认识新格式）；旧包导入时自动 up 到当前版\n' +
          '- **有损必须显式**：down() 枚举每一项丢弃，响应头带损失计数\n' +
          '- 危险的从来不是降级，是原地改唯一副本——格式降级产出新文件，原数据不动',
      ),
      b('op-gc', 0, 7, 6, 4,
        '## 磁盘回收\n\n' +
          '`POST /api/admin/blobs/gc`（显式动作，不自动跑）。扫描所有工作态 content、已发布快照、页背景，' +
          '被引用的一律保活（保守方向：误报多保活，永不误删活体）；顺带清孤儿文件（失败导入残留）。' +
          '"删了图空间没小"是正常的——内容寻址共享存储，回收要等 GC。',
      ),
      b('op-debug', 6, 7, 6, 4,
        '## 排障速查\n\n' +
          '- `GET /api/health` → 版本 + schemaVersion（匿名可达）\n' +
          '- 登录 403：九成是反代/代理后没设 `SHCKB_BASE_URL`\n' +
          '- 公开页样式陈旧：切一次实例主题或重 publish 触发全量重渲染\n' +
          '- 单页快照损坏：公开 JSON 读会显式报"re-publish"，重发布即愈\n' +
          '- 启动拒绝：用户表空且没给管理员 env——这是防呆不是故障',
      ),
    ],
  });
}

// ---------- main ----------

async function main() {
  console.log(`seeding devdocs -> ${BASE}${REPLACE ? ' (replace)' : ''}`);
  await login();

  const tree = (await req('GET', '/api/tree')) as TreeShape;
  const existing = tree.folders.find((f) => f.parentId === null && f.name === ROOT_NAME);
  if (existing) {
    if (!REPLACE) {
      console.error(`top-level folder ${ROOT_NAME} already exists — aborting (rerun with --replace to reseed)`);
      process.exit(2);
    }
    await removeExisting(tree, existing.id);
  }

  const { id: rootId } = (await req('POST', '/api/folders', { name: ROOT_NAME })) as { id: string };
  const { id: archId } = (await req('POST', '/api/folders', { name: '架构', parentId: rootId })) as { id: string };
  const { id: extId } = (await req('POST', '/api/folders', { name: '扩展开发', parentId: rootId })) as { id: string };
  const { id: opsId } = (await req('POST', '/api/folders', { name: '运维', parentId: rootId })) as { id: string };

  // root
  await seedMap(rootId);
  await seedGuide(rootId);
  // 架构
  await seedEngine(archId);
  await seedTwoState(archId);
  await seedThemeEngine(archId);
  await seedBlockSystem(archId);
  await seedAuth(archId);
  await seedData(archId);
  // 扩展开发
  await seedNewBlock(extId);
  await seedNewTheme(extId);
  // 运维
  await seedDeploy(opsId);
  await seedOps(opsId);

  console.log('done.');
}

await main();
