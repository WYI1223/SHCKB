/**
 * Seed in-product developer docs for the UNIFIED BLOCK-CAPABILITY
 * architecture (frame-core slice, ADR-0029). Two pages under 开发者文档 /
 * 架构, designed as CANVAS DIAGRAMS (position carries meaning), galley
 * theme — cutout bands = layers/section-rules, keyline plates = pieces:
 *
 *   块系统 · 抽象逻辑    — layer-cake + host/satellite composition + a
 *                          nesting staircase (indent = containment) + the
 *                          two capability contracts
 *   块系统 · 实现与权衡  — frame-core/skin code + a 前→后 side-by-side
 *                          tradeoff split + the deferred north-star band
 *
 * Free placement (gravityEnabled:false) so the spatial layout is exact;
 * rowSpans sized generously (autofit off → scroll, never clip).
 *
 * Usage:
 *   bun apps/server/scripts/seed-block-system-doc.ts --base http://localhost:4410 \
 *     --email admin@local.dev --password dev-admin-password [--replace]
 */

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

async function createPage(opts: { title: string; folderId: string; themeId: string; blocks: SeedBlock[] }): Promise<string> {
  const { id } = (await req('POST', '/api/notepages', { title: opts.title })) as { id: string };
  await req('POST', `/api/notepages/${id}/move`, { folderId: opts.folderId });
  // gravityEnabled:false → free spatial placement (this is a diagram, not a stack)
  await req('PUT', `/api/notepages/${id}/working-state`, { title: opts.title, gravityEnabled: false, blocks: opts.blocks });
  await req('POST', `/api/notepages/${id}/theme`, { themeId: opts.themeId });
  const pub = (await req('POST', `/api/notepages/${id}/publish`)) as { slug: string };
  await req('POST', `/api/notepages/${id}/visibility`, { visibility: 'public' });
  console.log(`  ✓ ${opts.title} -> /edit/${id}  ·  /notes/${pub.slug}`);
  return id;
}

const PAGE_ABSTRACT = '块系统 · 抽象逻辑';
const PAGE_IMPL = '块系统 · 实现与权衡';

// ====================== PAGE 1 — 抽象逻辑（层级 + 组合 + 嵌套楼梯）======================

function abstractBlocks(): SeedBlock[] {
  return [
    b('a-title', 0, 0, 12, 2,
      '# 块系统 · 抽象逻辑\n\n' +
      '**这张画布就是块系统的架构图。** 纵向 = 分层（上层消费下层）；同行并列 = 同层协作；缩进 = 嵌套包含。' +
      '一句话：功能归 host，kind/theme/UI 是薄插件，在同一个 host 盒上组合，**无基类**。[ADR-0029]'),

    // —— 组合：UI 顶 / [kind · host · theme] 中 / canvas 底 ——
    b('a-band-ui', 0, 2, 12, 1, '**◤ UI-plugin 层（L1）— chrome + frame-core 本体 · 可继承 / 重写（本轮延后）**', 'cutout'),

    b('a-kind', 0, 3, 4, 4,
      '### kind = 内容\n\n`BlockKindModule`（接口 + registry，**非继承**）。供 RenderView / EditView / extractText + **autofit 策略**。' +
      '只供内容，**碰不到盒**。', 'keyline'),
    b('a-host', 4, 3, 4, 4,
      '### ★ host · frame-core ★\n\n持有**可测量内容盒** · overflow · 几何 · autofit 测量与手势。' +
      '编辑 / 发布 / 测量**三处同源**。一切在这里组合。', 'keyline'),
    b('a-theme', 8, 3, 4, 4,
      '### theme = skin（材质）\n\n供一个 **BlockSkin**（root / box / behind / front）。类型受限纯视觉，' +
      '**碰不到盒**。原 `shells` → `skins`。', 'keyline'),

    b('a-band-canvas', 0, 7, 12, 1, '**◤ canvas — 几何（定位 / 12 列格子）· vanilla 地板，不可抽走**', 'cutout'),

    // —— 盒的解剖：嵌套楼梯（宽度递减 + 缩进 = 包含）——
    b('a-band-anatomy', 0, 8, 12, 1, '**◤ 盒的解剖 · 从外到内（每层更窄 + 缩进 = 它被外层包住）**', 'cutout'),
    b('a-nest-canvas', 0, 9, 12, 1,
      '**canvas 定位外层** — host 给 `left/top/width/height` + 编辑光环 / 拖拽 / 缩放手柄（编辑器拥有）', 'keyline'),
    b('a-nest-root', 1, 10, 10, 1,
      '**.skb-frame-root** — `skin.root`（tilt / filter 纯视觉）；`behind(ctx)` / `front(ctx)` 装饰层在此前后', 'keyline'),
    b('a-nest-box', 2, 11, 8, 2,
      '**.skb-content-box ★不变量★** — in-flow · 撑出内容自然高 · 持 `overflow`。' +
      'host **最后**落 position/size/overflow，skin 类型上写不出这些 → **构造上碰不到**', 'keyline'),
    b('a-nest-content', 3, 13, 6, 1,
      '**RenderView** — kind 的内容（markdown / richtext / image / code）', 'keyline'),

    // —— 两个能力契约 ——
    b('a-band-cap', 0, 14, 12, 1, '**◤ 两个能力契约**', 'cutout'),
    b('a-autofit', 0, 15, 6, 6,
      '### autofit · 限高 + grow\n\n' +
      '- **floor**（`minRowSpan`）= 作者意图的最小高\n' +
      '- **fit** = 实测行数 `ceil((内容+chrome+2·pad)/slot)`，仅编辑时测、不持久\n' +
      '- **有效 = `max(floor, fit)`** — 整行往上撑，不回退\n\n' +
      '逐 kind 策略：image=不可用 · 文本(md/rich/code)=grow。\n' +
      '**可逆（C5）**：手势内从不可变 base 快照重算 → 打字撑高 / 删回精确归位。', 'keyline'),
    b('a-skin', 6, 15, 6, 6,
      '### skin · 材质契约\n\n' +
      '`BlockSkin { root, box, behind, front, kinds? }`\n\n' +
      '- `box` / `root` 是**只视觉的 `Pick<>`** → 写不出 `position/overflow/height/display`\n' +
      '- 故盒不变量是**编译期强制**，不是约定\n' +
      '- `shells → skins`；`papers`/`palettes` 并入 = 北极星\n' +
      '- 未知 kind → 框架默认 skin（地板）', 'keyline'),

    b('a-codemap', 0, 21, 12, 3,
      '**◤ 代码地图** — ' +
      'skin 契约 `packages/theme/src/skin.ts` · host 盒 `packages/block-kinds/src/BlockFrameCore.tsx` · ' +
      'kind 契约 `…/block-kinds/src/types.ts` · 测量 `apps/web/src/grid/MeasureProbe.tsx` · ' +
      'C5 手势 `…/grid/useAutofitGesture.ts` · 不变量护栏 `…/block-kinds/src/__tests__/frame-invariant.test.tsx`。\n\n' +
      '决策档（git）：**[ADR-0029]**（host frame-core + BlockSkin；修订 [ADR-0025] / 扩展 [ADR-0028]）。' +
      '详见同层「实现与权衡」页。', 'cutout'),
  ];
}

// ====================== PAGE 2 — 实现与权衡（代码 + 前→后并列）======================

function implBlocks(): SeedBlock[] {
  return [
    b('i-title', 0, 0, 12, 2,
      '# 块系统 · 实现与权衡\n\n' +
      '左半=问题/前，右半=解法/后——**横向对照**。上半是真实代码，下半是权衡与延后。'),

    b('i-band-core', 0, 2, 12, 1, '**◤ host frame-core — 盒不变量：host 属性最后落，skin 永远赢不了**', 'cutout'),
    cb('i-core', 0, 3, 12, 8, 'tsx',
      'return (\n' +
      '  <div className={`skb-frame-root ${skin.root?.className ?? \'\'}`} data-kind={kind}\n' +
      '       style={{ position:\'relative\', width:\'100%\', height:\'100%\',\n' +
      '                ...skin.root?.style, ...skin.rootStyleOf?.(ctx) }}>\n' +
      '    {skin.behind?.(ctx)}                         {/* 撕边/卷角等装饰 */}\n' +
      '    <div className={`skb-content-box ${skin.box?.className ?? \'\'}`}\n' +
      '         style={{ ...defaultBox, ...skin.box?.style,   /* skin 视觉先铺 */\n' +
      '                  position:\'relative\', width:\'100%\', height:\'100%\',\n' +
      '                  overflow: blockOverflow(autofit) }}>  {/* ★host 最后落★ */}\n' +
      '      {children}                                 {/* kind 的 RenderView */}\n' +
      '    </div>\n' +
      '    {skin.front?.(ctx)}                          {/* 和纸胶带等装饰 */}\n' +
      '  </div>\n' +
      ');'),

    b('i-band-skin', 0, 11, 12, 1, '**◤ BlockSkin — 类型即护栏（写不出 position / overflow / height）**', 'cutout'),
    b('i-skin-md', 0, 12, 5, 4,
      '### 类型 = 强制\n\n`box.style` 不是任意 `CSSProperties`，是**只视觉**的 `Pick<>` 子集。' +
      '插件作者（或 skin）**物理上**写不出破坏布局的属性 → stationery 那种塌缩不可能再发生。\n\n' +
      '`rootStyleOf(ctx)` 给逐块视觉（如 tilt）。', 'keyline'),
    cb('i-skin-code', 5, 12, 7, 4, 'ts',
      'type SkinBoxStyle = Pick<CSSProperties,\n' +
      '  | \'background\' | \'backgroundImage\' | \'backgroundSize\'\n' +
      '  | \'border\' | \'borderLeft\' | \'borderRadius\' | \'borderImage\'\n' +
      '  | \'padding\' | \'color\' | \'boxShadow\'\n' +
      '  | \'fontSize\' | \'lineHeight\' | \'scrollbarWidth\'>;\n' +
      '// ✗ 没有 position/overflow/height/display/inset\n' +
      '//   不可表达 = 不可破坏'),

    // —— 权衡：前 → 后 并列 ——
    b('i-band-tradeoff', 0, 16, 12, 1, '**◤ 权衡 · 前 → 后（左：问题　右：解法）**', 'cutout'),
    b('i-before-hdr', 0, 17, 6, 1, '**前 · 结构是 theme 的权力**', 'cutout'),
    b('i-after-hdr', 6, 17, 6, 1, '**后 · 盒归 host，类型守门**', 'cutout'),

    b('i-b1', 0, 18, 6, 3,
      '**盒结构**\n\n`theme.BlockFrame` 自画盒；stationery `.skb-paper{position:absolute;inset:3px}` → ' +
      '离屏测量塌成 0 高 → **fit 恒为 1，6 行内容压进 1 行**（galley 对照量到 6）。', 'keyline'),
    b('i-a1', 6, 18, 6, 3,
      '**盒结构**\n\nhost 持盒 + 类型受限 skin + 不变量测试（逐 theme×kind×skin）→ ' +
      '**这类 bug 构造上不可能**，对第三方插件 kind 也一样。', 'keyline'),

    b('i-b2', 0, 21, 6, 2,
      '**autofit**\n\n两个 `kind === \'markdown\'` 闸门 + markdown 专属 seeding。', 'keyline'),
    b('i-a2', 6, 21, 6, 2,
      '**autofit**\n\n机制本就 kind-agnostic → 解闸 + `BlockKindModule.autofit` 字段（image=false · 文本=grow）。', 'keyline'),

    b('i-b3', 0, 23, 6, 2,
      '**测量**\n\n量 frame 外层 auto 高 → 绝对定位主题塌成 0 + 漏 `2·pad` 格内缩。', 'keyline'),
    b('i-a3', 6, 23, 6, 2,
      '**测量**\n\n确定高离屏 + AREA(`height:100%`)/CONTENT(`auto`) + `chrome=格高−area` 反推。', 'keyline'),

    b('i-b4', 0, 25, 6, 2,
      '**空块占位**\n\n「Empty markdown block」泄漏到发布页（读者看见编辑器术语）。', 'keyline'),
    b('i-a4', 6, 25, 6, 2,
      '**空块占位**\n\n空 = 空白；编辑态靠卡片框 + EditView「Write markdown…」提示。', 'keyline'),

    // —— 延后 / 北极星 ——
    b('i-band-deferred', 0, 27, 12, 1, '**◤ 延后 / 北极星 — 记录在案，不随时间消失（PRD Phase-2+ · ADR-0029 Deferred）**', 'cutout'),
    b('i-deferred', 0, 28, 12, 4,
      '**本轮 = internal slice：设计统一目标，只落地内部归位。**\n\n' +
      '- **UI-plugin extension type** — L1 正式契约（如何注册 / 可替换 / 可扩展）\n' +
      '- **frame-core 替换/扩展** — Open/Closed：整体替换 + 加法扩展，**永不局部改写**；替换者必守「可测量 + 持 overflow」盒能力\n' +
      '- **theme 完全简化** — `CanvasSurface`/`PageTitle` 也移出 theme（本轮暂留）\n' +
      '- **skin 统一** — `papers` + `palettes` + block `skins` 合一 · **theme asset pipeline**（打包字体/图片文件）· **published-asset 安全闸门**（第三方 SVG/url XSS）\n\n' +
      '**纪律**：chrome 契约**最后冻结**——先见够多形态（5 主题 + 3 个 ui-fork 分支），再固化。', 'keyline'),
  ];
}

async function main() {
  console.log(`seeding block-system docs (canvas-diagram redesign) -> ${BASE}`);
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

  await createPage({ title: PAGE_ABSTRACT, folderId: arch.id, themeId: 'galley', blocks: abstractBlocks() });
  await createPage({ title: PAGE_IMPL, folderId: arch.id, themeId: 'galley', blocks: implBlocks() });
  console.log('done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
