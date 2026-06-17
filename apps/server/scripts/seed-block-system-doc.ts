/**
 * Seed in-product developer docs for the UNIFIED BLOCK-CAPABILITY
 * architecture (frame-core slice, ADR-0029). Two pages under 开发者文档 /
 * 架构, designed IMAGE-FORWARD: the spatial reasoning lives in rendered
 * figures (tools/block-doc-art → PNG blobs), while titles, real code,
 * and cross-links stay as crisp, selectable, searchable text.
 *
 *   块系统 · 抽象逻辑    — ① 一个块的解剖（缩进即包含）② 组合而非继承
 *                          ③ autofit（floor/fit/effective）
 *   块系统 · 实现与权衡  — ④ 类型即护栏 ⑤ 测量管线 ⑥ 前→后，配真实代码
 *
 * Figures are authored at the 12-col content-box width (712px) so they
 * display ~1:1 and stay legible; rendered at 2x for retina. Free
 * placement (gravityEnabled:false); image kind = autofit off → fixed box.
 *
 * Prereq: render the figures first —
 *   node tools/block-doc-art/render.mjs
 *
 * Usage:
 *   bun apps/server/scripts/seed-block-system-doc.ts --base http://localhost:4410 \
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

type Art = Record<'anatomy' | 'composition' | 'autofit' | 'firewall' | 'measure' | 'tradeoff', string>;

const PAGE_ABSTRACT = '块系统 · 抽象逻辑';
const PAGE_IMPL = '块系统 · 实现与权衡';

// ====================== PAGE 1 — 抽象逻辑（解剖 / 组合 / autofit）======================

function abstractBlocks(H: Art, implId: string): SeedBlock[] {
  return [
    b('a-title', 0, 0, 12, 3,
      '# 块系统 · 抽象逻辑\n\n' +
      '块系统的「是什么」，用三张图讲：**① 一个块的解剖（缩进即包含）· ② 组合而非继承 · ③ autofit**。' +
      '一句话——功能归 host，kind / theme / UI 是薄插件，在同一个 host 盒上组合，**无基类**。`[ADR-0029]`\n\n' +
      `👉 「怎么做 / 权衡了什么」见 [块系统 · 实现与权衡](/p/${implId})。`),

    im('a-fig1', 0, 3, 12, 13, H.anatomy,
      '图①块的解剖：canvas 定位框 → .skb-frame-root → .skb-content-box（host 拥有）→ RenderView，缩进即包含；host 最后落 position/size/overflow。'),
    im('a-fig2', 0, 16, 12, 15, H.composition,
      '图②组合而非继承：kind（内容）/ host（盒与能力）/ theme（材质）三个薄插件汇入同一个 host 盒；接口 + registry，无基类。'),
    im('a-fig3', 0, 31, 12, 12, H.autofit,
      '图③autofit：两模 follow（默认，文本 kind，高度跟随内容、1 行下限、无 floor、可逆 C5）/ fix（固定高、内容滚动、可拖拽，image 唯一模式）。'),

    b('a-close', 0, 43, 12, 4,
      '**代码地图** — ' +
      'skin 契约 `packages/theme/src/skin.ts` · host 盒 `packages/block-kinds/src/BlockFrameCore.tsx` · ' +
      'kind 契约 `…/block-kinds/src/types.ts` · 测量 `apps/web/src/grid/MeasureProbe.tsx` · ' +
      'C5 手势 `…/grid/useAutofitGesture.ts` · 不变量护栏 `…/block-kinds/src/__tests__/frame-invariant.test.tsx`。\n\n' +
      '决策档（git）：**[ADR-0029]** host frame-core + BlockSkin（修订 `[ADR-0025]` §1/§2、扩展 `[ADR-0028]`）。',
      'keyline'),
  ];
}

// ====================== PAGE 2 — 实现与权衡（代码 + 前→后）======================

const SKIN_CODE =
  'type SkinBoxStyle = Pick<CSSProperties,\n' +
  "  | 'background' | 'backgroundImage' | 'backgroundSize'\n" +
  "  | 'border' | 'borderLeft' | 'borderRadius' | 'borderImage'\n" +
  "  | 'padding' | 'color' | 'boxShadow'\n" +
  "  | 'fontSize' | 'lineHeight' | 'scrollbarWidth'>;\n" +
  '// ✗ 没有 position/overflow/height/display/inset —— 不可表达 = 不可破坏';

const CORE_CODE =
  'return (\n' +
  "  <div className={`skb-frame-root ${skin.root?.className ?? ''}`} data-kind={kind}\n" +
  "       style={{ position:'relative', width:'100%', height:'100%',\n" +
  '                ...skin.root?.style, ...skin.rootStyleOf?.(ctx) }}>\n' +
  '    {skin.behind?.(ctx)}                          {/* 撕边/卷角等装饰 */}\n' +
  "    <div className={`skb-content-box ${skin.box?.className ?? ''}`}\n" +
  '         style={{ ...defaultBox, ...skin.box?.style,    /* skin 视觉先铺 */\n' +
  "                  position:'relative', width:'100%', height:'100%',\n" +
  '                  overflow: blockOverflow(autofit) }}>  {/* ★host 最后落★ */}\n' +
  '      {children}                                  {/* kind 的 RenderView */}\n' +
  '    </div>\n' +
  '    {skin.front?.(ctx)}                           {/* 和纸胶带等装饰 */}\n' +
  '  </div>\n' +
  ');';

const DEFERRED_TEXT =
  '**延后 / 北极星 — 记录在案，不随时间消失（PRD Phase-2+ · ADR-0029 Deferred）**\n\n' +
  '本轮 = internal slice：设计统一目标，只落地内部归位。\n\n' +
  '- **UI-plugin extension type** — L1 正式契约（如何注册 / 可替换 / 可扩展）\n' +
  '- **frame-core 替换 / 扩展** — Open/Closed：整体替换 + 加法扩展，**永不局部改写**；替换者必守「可测量 + 持 overflow」盒能力\n' +
  '- **theme 完全简化** — `CanvasSurface` / `PageTitle` 也移出 theme（本轮暂留）\n' +
  '- **skin 统一** — `papers` + `palettes` + block `skins` 合一 · **theme asset pipeline** · **published-asset 安全闸门**（第三方 SVG/url XSS）\n\n' +
  '**纪律**：chrome 契约**最后冻结**——先见够多形态（5 主题 + 3 个 ui-fork 分支），再固化。';

function implBlocks(H: Art, absId: string): SeedBlock[] {
  return [
    b('i-title', 0, 0, 12, 3,
      '# 块系统 · 实现与权衡\n\n' +
      '「怎么做」「权衡了什么」，三张图配两段真实代码：**④ 类型即护栏 · ⑤ 测量管线 · ⑥ 前 → 后**。\n\n' +
      `👈 「是什么」见 [块系统 · 抽象逻辑](/p/${absId})。`),

    im('i-fig4', 0, 3, 12, 11, H.firewall,
      '图④类型即护栏：skin 的 box.style 是只含视觉属性的 Pick<>；position/overflow/height/display 在类型里根本不存在 → 编译期拦住。'),
    cb('i-code-skin', 0, 14, 12, 6, 'ts', SKIN_CODE, 'keyline'),

    im('i-fig5', 0, 20, 12, 13, H.measure,
      '图⑤测量管线：前 = 量 frame 外层 auto 高，绝对定位主题塌成 0；后 = 离屏定高探针，量 AREA/CONTENT，chrome = 格高 − area 反推，与壳无关。'),
    im('i-fig6', 0, 33, 12, 13, H.tradeoff,
      '图⑥前→后：同 6 行内容，stationery 塌成 1 行 vs host 持盒撑成 6 行；盒结构 / autofit / 测量 / 空块占位 四项权衡。'),

    cb('i-code-core', 0, 46, 12, 9, 'tsx', CORE_CODE, 'keyline'),

    b('i-deferred', 0, 55, 12, 5, DEFERRED_TEXT, 'cutout'),
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
  console.log(`seeding block-system docs (image-forward redesign) -> ${BASE}`);
  await login();

  const tree = (await req('GET', '/api/tree')) as {
    folders: Array<{ id: string; name: string; parentId: string | null }>;
    notepages: Array<{ id: string; folderId: string | null; title: string }>;
  };
  const dev = tree.folders.find((f) => f.name === '开发者文档' && f.parentId === null);
  if (!dev) throw new Error('no top-level 开发者文档 folder');
  const arch = tree.folders.find((f) => f.name === '架构' && f.parentId === dev.id);
  if (!arch) throw new Error('no 架构 subfolder under 开发者文档');

  const existing = tree.notepages.filter((p) => p.folderId === arch.id && (p.title === PAGE_ABSTRACT || p.title === PAGE_IMPL));
  if (existing.length > 0) {
    if (!REPLACE) { console.error(`pages exist — pass --replace. Aborting.`); process.exit(2); }
    for (const p of existing) { await req('DELETE', `/api/notepages/${p.id}`); console.log(`  − ${p.title}`); }
  }

  console.log('uploading figures…');
  const H: Art = {
    anatomy: await uploadPng('01-anatomy.png'),
    composition: await uploadPng('02-composition.png'),
    autofit: await uploadPng('03-autofit.png'),
    firewall: await uploadPng('04-firewall.png'),
    measure: await uploadPng('05-measure.png'),
    tradeoff: await uploadPng('06-tradeoff.png'),
  };

  // create both blanks first so each page can permalink the other (/p/:id)
  const absId = await createBlank(PAGE_ABSTRACT, arch.id);
  const implId = await createBlank(PAGE_IMPL, arch.id);
  await populate(absId, PAGE_ABSTRACT, 'galley', abstractBlocks(H, implId));
  await populate(implId, PAGE_IMPL, 'galley', implBlocks(H, absId));
  console.log('done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
