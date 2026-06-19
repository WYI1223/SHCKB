/**
 * Seed in-product developer docs for the VIEW-MODE + FIRST-CLASS-LINK
 * architecture (MVP-10, ADR-0031). Two pages under 开发者文档 / 架构,
 * IMAGE-FORWARD (mirrors seed-block-system-doc.ts): the spatial reasoning
 * lives in rendered figures (tools/block-doc-art → PNG blobs), while titles,
 * real code, and cross-links stay as crisp, selectable, searchable text.
 *
 *   视图与链接 · 抽象逻辑    — ① 四面两轴（全 id）② 链接是一种能力（三缝）③ 保面导航
 *   视图与链接 · 实现与权衡  — ④ 根因 = layer-error ⑤ 全 id·链接不再物化 ⑥ 单测全绿 e2e 才抓到
 *
 * Figures authored at the 12-col content-box width (712px) so they display
 * ~1:1; rendered at 2x. Free placement (gravityEnabled:false); image kind =
 * autofit off → fixed box.
 *
 * Prereq: render the figures first (node — bun can't launch the browser on Win) —
 *   node tools/block-doc-art/render.mjs
 *
 * Usage:
 *   bun apps/server/scripts/seed-view-system-doc.ts --base http://localhost:3000 \
 *     --email admin@local.dev --password dev-admin-password [--replace]
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) { console.error(`missing --${name}`); process.exit(1); }
  return v;
}
const BASE = arg('base').replace(/\/$/, '');
const EMAIL = arg('email');
const PASSWORD = arg('password');
const REPLACE = process.argv.includes('--replace');

const ART = resolve(dirname(fileURLToPath(import.meta.url)), '../../../tools/block-doc-art/out');

let cookie = '';
async function req(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { cookie };
  let payload: string | undefined;
  if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}
async function login() {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`);
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  if (!cookie) throw new Error('sign-in returned no cookie');
}
/** Upload a PNG to the content-addressed blob store → hash (POST /api/blobs). */
async function uploadPng(file: string): Promise<string> {
  const bytes = readFileSync(resolve(ART, file));
  const res = await fetch(`${BASE}/api/blobs`, { method: 'POST', headers: { cookie, 'content-type': 'image/png' }, body: bytes });
  if (!res.ok) throw new Error(`upload ${file} -> ${res.status}: ${await res.text()}`);
  const { hash } = (await res.json()) as { hash: string };
  return hash;
}

type SeedBlock = { id: string; kind: string; col: number; row: number; colSpan: number; rowSpan: number; shell?: string | null; content: unknown };
const md = (markdown: string) => ({ markdown });
const code = (language: string, source: string) => ({ language, source });
/** markdown block: b(id, col,row,w,h, text, shell?) — shell ∈ keyline|cutout|null */
function b(id: string, col: number, row: number, colSpan: number, rowSpan: number, text: string, shell?: string): SeedBlock {
  return { id, kind: 'markdown', col, row, colSpan, rowSpan, shell: shell ?? null, content: md(text) };
}
function cb(id: string, col: number, row: number, colSpan: number, rowSpan: number, language: string, source: string, shell?: string): SeedBlock {
  return { id, kind: 'code', col, row, colSpan, rowSpan, shell: shell ?? null, content: code(language, source) };
}
/** image block: im(id, col,row,w,h, blobHash, alt) — figures float bare (own card frame). */
function im(id: string, col: number, row: number, colSpan: number, rowSpan: number, blobHash: string, alt: string): SeedBlock {
  return { id, kind: 'image', col, row, colSpan, rowSpan, shell: null, content: { blobHash, alt } };
}

type Art = Record<'surfaces' | 'linkcap' | 'navigate' | 'rootcause' | 'materialize' | 'e2elesson', string>;

const PAGE_ABSTRACT = '视图与链接 · 抽象逻辑';
const PAGE_IMPL = '视图与链接 · 实现与权衡';

// ====================== PAGE 1 — 抽象逻辑（四面两轴 / 链接能力 / 保面导航）======================

function abstractBlocks(H: Art, implId: string, twoStateId: string | null): SeedBlock[] {
  const seeAlso = twoStateId
    ? `\n\n邻页：[两态模型与发布管线](/p/${twoStateId})——视图模式正是架在 working / published 两态之上。`
    : '';
  return [
    b('a-title', 0, 0, 12, 3,
      '# 视图与链接 · 抽象逻辑\n\n' +
      '视图与链接的「是什么」，三张图讲：**① 四面两轴 · ② 链接是一种能力 · ③ 保面导航**。' +
      '一句话——一个页面，四个面（2 轴：受众×范围）；全 by id，导航**守恒面**，链接是一种 **kind 无关**的能力。`[ADR-0031]`\n\n' +
      `👉 「怎么做 / 权衡了什么」见 [视图与链接 · 实现与权衡](/p/${implId})。`),

    // F1: 07-surfaces — 四面两轴 all-id (846px → rowSpan=15)
    im('a-fig1', 0, 3, 12, 15, H.surfaces,
      '图①四面两轴：两根正交轴（受众×范围）切出四面——作者侧 edit /edit/:id + view /view/:id（working，in-Shell，一体两面）；公开侧 read /read/:id（整库，in-Shell）+ note /notes/:id（单页，bare）；全 by id，slug 退出 URL。'),
    // F2: 08-link-capability — UNCHANGED (631px → rowSpan=11)
    im('a-fig2', 0, 18, 12, 11, H.linkcap,
      '图②链接是一种能力：统一货币 LinkRef{pageId, blockId?}，markdown/richtext/未来 canvas 都喂同一种；三缝——①抽取 links() ②导航 navigateToPage（已落地）③编写 pickLinkTarget（延后 MVP-11）。'),
    // F3: 09-navigate — trivial resolveTarget table, 4 surfaces (654px → rowSpan=12)
    im('a-fig3', 0, 29, 12, 12, H.navigate,
      '图③保面导航：全 id 后 resolveTarget 塌成「同面+同 id」——edit→/edit/:id，view→/view/:id，read→/read/:id（留整库浏览），note→/notes/:id（留单页），同页 block→纯滚动；客户端、Shell 常驻、面守恒。'),

    b('a-close', 0, 41, 12, 3,
      '**代码地图** — ' +
      '导航原语 `apps/web/src/nav/useNavigateToPage.ts` · 滚动 / 锚点 `…/nav/scrollToBlock.ts` · ' +
      '位置暂存 `…/nav/useScrollRestore.ts` · LinkRef + 永链 `packages/block-kinds/src/links.ts` · ' +
      'In-app View `apps/web/src/pages/InAppView.tsx`。\n\n' +
      '决策档（git）：**[ADR-0031]** view-mode navigation（四面两轴全 id + navigateToPage + Link 三缝）。' +
      seeAlso,
      'keyline'),
  ];
}

// ====================== PAGE 2 — 实现与权衡（前→后 + 真实代码）======================

const RESOLVE_CODE =
  '// 纯函数：当前 surface + LinkRef → 一个动作（已单测，副作用在 hook 里）\n' +
  'export function resolveTarget(pathname: string, ref: LinkRef): NavAction {\n' +
  '  const surface = surfaceOf(pathname);   // edit | view | read | note | other\n' +
  '  // 同页 block 目标 → 纯滚动（不导航），四面皆 by id\n' +
  "  if (surface !== 'other' && ref.blockId && ref.pageId === currentId(pathname))\n" +
  "    return { kind: 'scroll', blockId: ref.blockId };\n" +
  "  const hash = ref.blockId ? `#${encodeURIComponent(ref.blockId)}` : '';\n" +
  "  const base = surface === 'other' ? '/view' : ROUTE_OF[surface]; // edit|view|read|note\n" +
  "  return { kind: 'navigate', to: `${base}/${encodeURIComponent(ref.pageId)}${hash}` };\n" +
  '}';

const DEFERRED_TEXT =
  '**延后 / 北极星 — 记录在案（PRD Phase-2+ · ADR-0031 Deferred）**\n\n' +
  '本轮 = 视图模式统一 + 链接前两缝（抽取 / 导航）。第三缝与下游搭车后续：\n\n' +
  '- **③ 编写缝 `pickLinkTarget`** — 选目标插链接，复用 MVP-11 搜索做选择器（本轮**只留位、不定签名**——反 lock）\n' +
  '- **backlinks / 搜索** — 抽取缝已就位，MVP-11 消费\n' +
  '- **canvas block 链接** — 未来 kind 接同一个 `LinkRef`，无需改导航\n' +
  '- **导出 PDF 的链接** — LinkRef → PDF 内锚点 / 脚注（北极星）\n\n' +
  '**纪律**：author 缝**不提前固化**——先有真实链接编写压力，再定签名。';

function implBlocks(H: Art, absId: string): SeedBlock[] {
  return [
    b('i-title', 0, 0, 12, 3,
      '# 视图与链接 · 实现与权衡\n\n' +
      '「怎么做」「权衡了什么」，三张图配真实代码：**④ 根因 = layer-error · ⑤ 全 id·链接不再物化 · ⑥ 单测全绿 e2e 才抓到**。\n\n' +
      `👈 「是什么」见 [视图与链接 · 抽象逻辑](/p/${absId})。`),

    // F4: 10-rootcause — UNCHANGED (587px → rowSpan=10)
    im('i-fig4', 0, 3, 12, 10, H.rootcause,
      '图④根因 = layer-error：/p/:id 是公开分享永链，被误用成编辑器正文导航——前=裸 href→服务器 302→发布面（整页重载 / 草稿 404 / 落旧快照），后=同一 LinkRef 走 navigateToPage 客户端跳转。'),
    // F5: 11-materialize — replaced with all-id·不物化 (517px → rowSpan=9)
    im('i-fig5', 0, 13, 12, 9, H.materialize,
      '图⑤全 id·链接不再物化：/p/:id = surface-neutral 规范内链，发布不改写；前=物化 4 写点（发布/主题重钉/导入/批量重渲，已退役划掉）；后=全 id，handler→resolveTarget→/:surface/:id，无 JS 服务器 302→/notes/:id；materializeInternalLinks/publicIdToSlug 全部移除。'),
    // F6: 12-e2e-lesson — 349 replaced with 156+77+116 (717px → rowSpan=13)
    im('i-fig6', 0, 22, 12, 13, H.e2elesson,
      '图⑥单测全绿 e2e 才抓到：block 帧激活 onClick 无条件 stopPropagation 吞掉了内部链接点击，裸 /p/:id 又整页重载；单元/集成全绿（156 block-kinds + 77 web + 116 server），只有真浏览器 e2e 抓到；修复 = 帧对内部链接让路。'),

    cb('i-code', 0, 35, 12, 5, 'ts', RESOLVE_CODE, 'keyline'),

    b('i-deferred', 0, 40, 12, 4, DEFERRED_TEXT, 'cutout'),
  ];
}

// ====================== drive ======================

async function createBlank(title: string, folderId: string): Promise<string> {
  const { id } = (await req('POST', '/api/notepages', { title })) as { id: string };
  await req('POST', `/api/notepages/${id}/move`, { folderId });
  return id;
}
async function populate(id: string, title: string, themeId: string, blocks: SeedBlock[]): Promise<void> {
  // gravityEnabled:false → exact placement (figures stacked, no compaction)
  await req('PUT', `/api/notepages/${id}/working-state`, { title, gravityEnabled: false, blocks });
  await req('POST', `/api/notepages/${id}/theme`, { themeId });
  const pub = (await req('POST', `/api/notepages/${id}/publish`)) as { slug: string };
  await req('POST', `/api/notepages/${id}/visibility`, { visibility: 'public' });
  console.log(`  ✓ ${title} -> /edit/${id}  ·  /notes/${pub.slug}`);
}

async function main() {
  console.log(`seeding view-system docs (MVP-10, image-forward) -> ${BASE}`);
  await login();

  const tree = (await req('GET', '/api/tree')) as {
    folders: Array<{ id: string; name: string; parentId: string | null }>;
    notepages: Array<{ id: string; folderId: string | null; title: string }>;
  };
  const dev = tree.folders.find((f) => f.name === '开发者文档' && f.parentId === null);
  if (!dev) throw new Error('no top-level 开发者文档 folder');
  const arch = tree.folders.find((f) => f.name === '架构' && f.parentId === dev.id);
  if (!arch) throw new Error('no 架构 subfolder under 开发者文档');

  const twoState = tree.notepages.find((p) => p.folderId === arch.id && p.title === '两态模型与发布管线');
  const twoStateId = twoState?.id ?? null;

  const existing = tree.notepages.filter((p) => p.folderId === arch.id && (p.title === PAGE_ABSTRACT || p.title === PAGE_IMPL));
  if (existing.length > 0) {
    if (!REPLACE) { console.error(`pages exist — pass --replace. Aborting.`); process.exit(2); }
    for (const p of existing) { await req('DELETE', `/api/notepages/${p.id}`); console.log(`  − ${p.title}`); }
  }

  console.log('uploading figures…');
  const H: Art = {
    surfaces: await uploadPng('07-surfaces.png'),
    linkcap: await uploadPng('08-link-capability.png'),
    navigate: await uploadPng('09-navigate.png'),
    rootcause: await uploadPng('10-rootcause.png'),
    materialize: await uploadPng('11-materialize.png'),
    e2elesson: await uploadPng('12-e2e-lesson.png'),
  };

  // create both blanks first so each page can permalink the other (/p/:id)
  const absId = await createBlank(PAGE_ABSTRACT, arch.id);
  const implId = await createBlank(PAGE_IMPL, arch.id);
  await populate(absId, PAGE_ABSTRACT, 'galley', abstractBlocks(H, implId, twoStateId));
  await populate(implId, PAGE_IMPL, 'galley', implBlocks(H, absId));
  console.log('done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
