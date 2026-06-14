/**
 * Seed the in-product developer docs for the UNIFIED BLOCK-CAPABILITY
 * architecture (frame-core slice, ADR-0029). Adds two pages under
 * 开发者文档 / 架构, alongside the (thin, pre-frame-core) 块系统 page:
 *
 *   块系统 · 抽象逻辑      — the system model: layering, the box invariant,
 *                            autofit, the skin contract (concept + code map)
 *   块系统 · 实现与权衡    — the actual code + the before→after tradeoffs and
 *                            the deferred north-star
 *
 * Docs-as-bundle governance (same as seed-devdocs.ts): this script is the
 * canonical source. Pages are plain markdown/code blocks laid out on the
 * canvas; rowSpans are sized generously (autofit OFF → scroll, never clip,
 * if an estimate is short).
 *
 * Usage:
 *   bun apps/server/scripts/seed-block-system-doc.ts --base http://localhost:4410 \
 *     --email admin@local.dev --password dev-admin-password [--replace]
 *
 * Idempotence: aborts if 「块系统 · 抽象逻辑」already exists under 架构,
 * unless --replace (then the two pages are deleted and reseeded). Only ever
 * touches those two pages.
 */

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

let cookie = '';

async function req(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { cookie };
  let payload: string | undefined;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`);
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  if (!cookie) throw new Error('sign-in returned no cookie');
}

type SeedBlock = { id: string; kind: string; col: number; row: number; colSpan: number; rowSpan: number; shell?: string | null; content: unknown };
const md = (markdown: string) => ({ markdown });
const code = (language: string, source: string) => ({ language, source });
function b(id: string, col: number, row: number, colSpan: number, rowSpan: number, text: string): SeedBlock {
  return { id, kind: 'markdown', col, row, colSpan, rowSpan, shell: null, content: md(text) };
}
function cb(id: string, col: number, row: number, colSpan: number, rowSpan: number, language: string, source: string): SeedBlock {
  return { id, kind: 'code', col, row, colSpan, rowSpan, shell: null, content: code(language, source) };
}

async function createPage(opts: { title: string; folderId: string; themeId: string; blocks: SeedBlock[] }): Promise<string> {
  const { id } = (await req('POST', '/api/notepages', { title: opts.title })) as { id: string };
  await req('POST', `/api/notepages/${id}/move`, { folderId: opts.folderId });
  await req('PUT', `/api/notepages/${id}/working-state`, { title: opts.title, gravityEnabled: true, blocks: opts.blocks });
  await req('POST', `/api/notepages/${id}/theme`, { themeId: opts.themeId });
  const pub = (await req('POST', `/api/notepages/${id}/publish`)) as { slug: string };
  await req('POST', `/api/notepages/${id}/visibility`, { visibility: 'public' });
  console.log(`  ✓ ${opts.title} -> /edit/${id}  ·  /notes/${pub.slug}`);
  return id;
}

const PAGE_ABSTRACT = '块系统 · 抽象逻辑';
const PAGE_IMPL = '块系统 · 实现与权衡';

// ====================== PAGE 1 — 抽象逻辑 ======================

function abstractBlocks(): SeedBlock[] {
  return [
    b('a-title', 0, 0, 12, 2,
      '# 块系统 · 抽象逻辑\n\n' +
      '一句话：**功能性 / 结构性能力归 host，kind / theme / UI-plugin 是只供给各自专长的薄插件**——' +
      'kind = 内容，theme = 材质(skin)，UI-plugin = frame-core/chrome。三者在**同一个 host 持有的、可测量的 block 盒**上组合。' +
      '任何一层都没有 base class；要么整体替换，要么加法扩展，**永不局部改写**。[ADR-0029]'),

    b('a-layer', 0, 2, 12, 8,
      '## 分层原则（一次收敛出来的）\n\n' +
      '三个独立的可插拔轴，过去各自为政，现在收敛到一条原则：\n\n' +
      '| 参与者 | 持有 | 供给 | 能破坏盒子吗 |\n' +
      '|---|---|---|---|\n' +
      '| **Host**（canvas + frame-core） | 几何定位、**可测量内容盒**、overflow、autofit 测量/手势 | —（枢纽） | n/a |\n' +
      '| **Kind 插件** | 内容 + 编辑 | RenderView / EditView / extractText + **autofit 策略** | 否——只供内容 |\n' +
      '| **Theme** | 材质 | 一个 **BlockSkin**（surface/border/overlay + tokens + globalCss） | 否——只给盒子穿衣 |\n' +
      '| **UI-plugin**（延后） | chrome / 页面骨架，且可**整体替换** frame-core | frame-core 实现 | 是——这正是 inherit/rewrite 轴 |\n\n' +
      '**为什么不是 base class**：3 个内置主题是 *reference implementation*，不是官方基类——fork/compose/从零写都是一等路径，框架不承诺「改基类不破下游」。' +
      'kind 同理：`BlockKindModule` 是接口 + registry（composition），不是继承链。**共享功能统一在 host，不在某个基类里**。\n\n' +
      '**收敛的触发点**：autofit 最初只给 markdown 做（实验性），但它本就是 block 基座能力；stationery 主题的 frame 把内容画进绝对定位内层、' +
      '在离屏测量时塌成 0 高——暴露出「结构本就是 theme 的权力」这个根因。归位后：结构归 host，theme 只剩材质。'),

    b('a-anatomy', 0, 10, 6, 9,
      '## 块的解剖：四方所有权\n\n' +
      '一个 block 在屏幕上的每一层，归属明确：\n\n' +
      '```\n' +
      '┌─ canvas 定位外层（host：left/top/width/height，编辑光环/手柄）\n' +
      '│  ┌─ .skb-frame-root（skin.root：tilt/filter 等纯视觉）\n' +
      '│  │   skin.behind(ctx)         ← 装饰：撕边/卷角（absolute overlay）\n' +
      '│  │  ┌─ .skb-content-box  ★不变量★（host 持有）\n' +
      '│  │  │     skin.box 视觉 + 内容\n' +
      '│  │  │     position:relative / w:100% / h:100% / overflow ← host 最后落\n' +
      '│  │  │     <RenderView>  ← kind 的内容\n' +
      '│  │  └─\n' +
      '│  │   skin.front(ctx)          ← 装饰：和纸胶带（absolute overlay）\n' +
      '│  └─\n' +
      '└─\n' +
      '```\n\n' +
      '**盒不变量**：`.skb-content-box` 永远**在正常流、撑出内容自然高、且是 overflow/clip 容器**。' +
      '这正是 stationery 用 `position:absolute; inset` 破坏掉、导致 autofit 塌缩的东西。现在由 host **最后**落这几个属性，' +
      '且 skin 的样式类型上写不出 `position/overflow/height/display`——**构造上不可破坏**，对插件 kind 也一样。'),

    b('a-autofit', 6, 10, 6, 9,
      '## autofit：限高 + grow\n\n' +
      'owner 的诠释（不是「自动高」，而是「**限高 + 往上长**」）：\n\n' +
      '- **floor**（`minRowSpan`）= 作者意图的最小高度。\n' +
      '- **fit** = 内容实测需要几行 = `ceil((内容px + chrome + 2·pad) / slot)`，**仅编辑时测、不持久**。\n' +
      '- **有效 rowSpan = `max(floor, fit)`**：内容只能整行步进往上撑，永不回退到 floor 以下。\n\n' +
      '**逐 kind 策略**（block 基座能力，不是 markdown 专属）：\n' +
      '`BlockKindModule.autofit` —— `false` = 不可用（image：要手控裁切）；`{ default: \'grow\' }` = 文本类（markdown/richtext/code）；省略 = 可用、默认 off。\n\n' +
      '**可逆（C5）**：一次编辑手势内，重力暂挂；每次测量从一个**不可变的 base 快照**重新 push（`reconcile(base, T)`），' +
      '所以打字撑高→删回来能精确归位（不留痕）。提交（失焦）时若净高变化且重力开，跑一遍压实。\n\n' +
      '**空块 = 空白**：空 markdown 渲染空（measures ~0 → 缩到 floor），读者不见编辑器术语。'),

    b('a-skin', 0, 19, 6, 8,
      '## skin 模型（材质即皮肤）\n\n' +
      'theme 不再供组件，只供一个 **BlockSkin**（owner：纸张/颜色/纹理是 block 的一种皮肤）：\n\n' +
      '- `root` / `rootStyleOf(ctx)` —— 几何填充层的纯视觉（tilt/filter）。\n' +
      '- `box` —— 内容盒的视觉（背景/边框/圆角/padding/阴影/背景图）。**类型受限**：写不出布局破坏属性。\n' +
      '- `behind(ctx)` / `front(ctx)` —— 内容前后的 `aria-hidden` 装饰层（撕边、和纸、卷角、宝丽来卡）。\n' +
      '- `kinds?` —— 限定适用的 kind（如 polaroid 只给 image）。\n\n' +
      '**`shells` → `skins`**：原来的「壳变体」就是皮肤变体。`papers`（页面底）/ `palettes`（配色）统一进 skin 是**北极星**，本轮只做 block skin。\n\n' +
      '**未知 kind 回退**：当前 theme 没有对应 skin 时，host 用**框架默认 skin**（极简卡片）——任何 kind 在任何 theme 下都能渲染（vanilla 地板不可抽走）。'),

    b('a-codemap', 6, 19, 6, 8,
      '## 代码地图（抽象 → 文件）\n\n' +
      '| 概念 | 文件 |\n' +
      '|---|---|\n' +
      '| BlockSkin 契约 / resolveSkin | `packages/theme/src/skin.ts` |\n' +
      '| host frame-core（盒不变量） | `packages/block-kinds/src/BlockFrameCore.tsx` |\n' +
      '| kind 契约（含 autofit 策略） | `packages/block-kinds/src/types.ts` |\n' +
      '| kind 注册表 | `packages/block-kinds/src/registry.ts` |\n' +
      '| 主题 skins（galley/stationery/marginalia…） | `packages/theme/src/*.tsx` |\n' +
      '| autofit 测量面 | `apps/web/src/grid/MeasureProbe.tsx` |\n' +
      '| autofit 手势（C5 reconcile） | `apps/web/src/grid/useAutofitGesture.ts` |\n' +
      '| 编辑器渲染 | `apps/web/src/grid/GridCanvas.tsx` |\n' +
      '| 发布渲染 | `packages/block-kinds/src/PublishedCanvas.tsx` |\n' +
      '| 不变量护栏测试 | `packages/block-kinds/src/__tests__/frame-invariant.test.tsx` |\n\n' +
      '决策档：[ADR-0029]（host frame-core + BlockSkin，修订 [ADR-0025] / 扩展 [ADR-0028]）。' +
      '设计与讨论：`docs/superpowers/specs/2026-06-14-…` + `docs/engineering/design/discussions/mvp9.5-scope-2026-06-14.md`（仅 git）。'),
  ];
}

// ====================== PAGE 2 — 实现与权衡 ======================

function implBlocks(): SeedBlock[] {
  return [
    b('i-title', 0, 0, 12, 2,
      '# 块系统 · 实现与权衡\n\n' +
      '上一页是抽象模型；这一页是**当前实际代码** + **前→后的权衡**与延后的北极星。'),

    b('i-core-md', 0, 2, 12, 3,
      '## host：BlockFrameCore\n\n' +
      '编辑器、发布、autofit 测量**三处用同一个组件**——所以「所测 == 所渲」由构造保证（过去三处各自 `resolveBlockFrame`，会漂移）。' +
      '关键：skin 视觉**先**铺，host 不变量（position/width/height/overflow）**最后**落，skin 永远赢不了。默认 skin（sentinel id）走框架卡片样式。'),

    cb('i-core-code', 0, 5, 12, 8, 'tsx',
      'export function BlockFrameCore({ kind, blockId, colSpan, rowSpan, autofit, skin, children }: BlockFrameCoreProps) {\n' +
      '  const theme = useTheme();\n' +
      '  const { textColor, mutedColor, hairline, accent, blockBg, surfaceInsetBg, quoteColor, kindHues, kindHueFallback } = theme;\n' +
      '  const ctx: SkinCtx = { blockId, kind, colSpan, rowSpan, tokens: { /* …上面 9 个 token… */ } };\n' +
      '  const isDefault = skin.id === DEFAULT_SKIN_ID;\n' +
      '  const { overflow: _hostOwnsOverflow, ...card } = blockCardStyle(theme, kind);\n' +
      '  const defaultBox = isDefault ? { ...card, fontSize: \'14px\', lineHeight: 1.55, color: theme.textColor } : {};\n' +
      '  return (\n' +
      '    <div className={`skb-frame-root ${skin.root?.className ?? \'\'}`} data-kind={kind}\n' +
      '         style={{ position: \'relative\', width: \'100%\', height: \'100%\', ...skin.root?.style, ...skin.rootStyleOf?.(ctx) }}>\n' +
      '      {skin.behind?.(ctx)}\n' +
      '      <div className={`skb-content-box ${skin.box?.className ?? \'\'}`}\n' +
      '           style={{ ...defaultBox, ...skin.box?.style,\n' +
      '                    position: \'relative\', width: \'100%\', height: \'100%\', overflow: blockOverflow(autofit) }}>\n' +
      '        {children}\n' +
      '      </div>\n' +
      '      {skin.front?.(ctx)}\n' +
      '    </div>\n' +
      '  );\n' +
      '}'),

    b('i-skin-md', 0, 13, 6, 5,
      '## theme：BlockSkin（类型即护栏）\n\n' +
      '`box.style` / `root.style` 不是任意 `CSSProperties`，而是**只视觉**的 `Pick<>` 子集——' +
      '物理上写不出 `position` / `overflow` / `height` / `display`。这把「盒不变量」从「约定」升级成「**编译期强制**」：' +
      '任何 skin（或第三方插件 kind）都无法重新引入 stationery 那种塌缩。\n\n' +
      '`rootStyleOf(ctx)` 给逐块视觉（如 stationery 按 blockId 算的 tilt）；`SkinRootStyle` 额外允许 `padding`（撕边留白），仍是不变量安全的。'),

    cb('i-skin-code', 6, 13, 6, 5, 'ts',
      'export type SkinBoxStyle = Pick<CSSProperties,\n' +
      '  | \'background\' | \'backgroundColor\' | \'backgroundImage\' | \'backgroundSize\'\n' +
      '  | \'backgroundRepeat\' | \'backgroundPosition\' | \'backgroundClip\'\n' +
      '  | \'border\' | \'borderTop\' | \'borderLeft\' | \'borderBottom\'\n' +
      '  | \'borderRadius\' | \'borderImage\'\n' +
      '  | \'padding\' | \'color\' | \'boxShadow\'\n' +
      '  | \'fontSize\' | \'lineHeight\' | \'scrollbarWidth\'\n' +
      '>;\n' +
      '// 注意没有 position / overflow / height / display / inset —— 不可表达 = 不可破坏\n\n' +
      'export type BlockSkin = {\n' +
      '  id: string; name: string; kinds?: string[];\n' +
      '  root?: { className?: string; style?: SkinRootStyle };\n' +
      '  rootStyleOf?: (ctx: SkinCtx) => SkinRootStyle;\n' +
      '  box?: { className?: string; style?: SkinBoxStyle };\n' +
      '  behind?: (ctx: SkinCtx) => ReactNode;\n' +
      '  front?: (ctx: SkinCtx) => ReactNode;\n' +
      '};',
    ),

    b('i-render', 0, 18, 12, 4,
      '## 三处渲染同源 + autofit 测量\n\n' +
      '`resolveSkin(theme, kind, skinId)`（作者选 → theme 默认(逐 kind) → 框架默认）在三处都包同一个 `BlockFrameCore`：\n\n' +
      '- **GridCanvas**（编辑器）：定位外层 + 交互归编辑器；frame-core 在里面。`blockModule(kind)?.autofit !== false` 决定「auto height」开关与测量面是否挂载。\n' +
      '- **PublishedCanvas**（发布/读）：同一条路径，`renderToStaticMarkup` 纯函数；持久字段 `shell` 当 skin id 读（数据未改名）。\n' +
      '- **MeasureProbe**（autofit 测量）：离屏给**确定高**格子，挂 AREA(`height:100%`→内容区) + CONTENT(`height:auto`→自然高)；' +
      '`chrome = 格高 − area`；`fit = ceil((content + chrome + 2·pad) / slot)`。frame-agnostic、不读 getComputedStyle。'),

    b('i-tradeoffs', 0, 22, 12, 10,
      '## 权衡（前 → 后）\n\n' +
      '**1. 盒结构：theme 拥有 → host 拥有。** 前：`theme.BlockFrame` 自画盒，stationery 用 `.skb-paper{position:absolute;inset:3px}`——' +
      '离屏 auto 高测量时塌成 0 → fit 恒为 1 → 6 行内容压进 1 行（galley 对照组正确量到 6）。' +
      '后：host 持盒、类型受限 skin、不变量测试逐 theme×kind×skin 把守——**这类 bug 构造上不可能**，且对插件 kind 也成立。\n\n' +
      '**2. composition，不是 base class。** 备选「theme = 完整组件树」「每 kind 自带主题变体」均被否（fork 成本失控、M×N 爆炸）。' +
      '坚持「reference-impl 不是基类 + 见过 N 种形态再冻结契约」。\n\n' +
      '**3. autofit 升为 block 基座 + 逐 kind 策略。** 前：两个 `kind === \'markdown\'` 闸门 + markdown 专属 seeding。' +
      '后：机制本就 kind-agnostic（MeasureProbe 量任意 RenderView），解闸 + `BlockKindModule.autofit` 字段声明默认（image=false、文本=grow）。\n\n' +
      '**4. 测量：auto 高 → 确定高 + AREA/CONTENT。** 前：量 frame wrapper 外层 `offsetHeight`、`fit=ceil(outer/slot)`——in-flow 主题对、' +
      '绝对定位主题塌成 0、且漏了 `2·pad` 格子内缩。后：确定高布局 + 双层量 + chrome 反推，对所有「填格型」frame 构造正确。\n\n' +
      '**5. 空块占位：到处显示 → 到处空白。** 前：「Empty markdown block」泄漏到发布页。后：空 = 空白；编辑态靠卡片框 + EditView 的「Write markdown…」提示。\n\n' +
      '**6. 无数据迁移。** 整轮是渲染层 + kind 契约重构；schema 不变（持久 `shell` 字段继续当 skin id 读）。'),

    b('i-deferred', 0, 32, 12, 7,
      '## 延后 / 北极星（记录在案，不随时间消失）\n\n' +
      '本轮是 **internal slice**：设计了统一目标，但只落地内部归位。以下进 PRD Phase-2+ 与 [ADR-0029] 的 Deferred 节：\n\n' +
      '- **UI-plugin extension type** —— L1 正式契约：UI plugin 如何注册、可替换/扩展什么。\n' +
      '- **frame-core 替换/扩展模型** —— Open/Closed：整体替换（重写）+ 加法扩展；替换者必守「让内容可测量 + 持 overflow」的盒能力；共享不变量测试为地板；**局部改写内部 = 不可**（工程灾难）。\n' +
      '- **theme 完全简化** —— 把 `CanvasSurface` / `PageTitle` 也移出 theme → theme = 纯材质（本 slice 暂留这两个结构槽）。\n' +
      '- **skin 统一** —— `papers` + `palettes` + block `skins` 并入单一 skin 概念；可能独立 skin pack。\n' +
      '- **theme asset pipeline** —— theme 打包字体/图片*文件*（今天只能 inline / data-URI）。\n' +
      '- **published-asset 安全闸门** —— theme/UI 成不受信第三方时，公开页 SVG/`url()` 的 XSS / 外链隐私闸门。\n\n' +
      '**纪律**：chrome / 结构契约**最后冻结**——先见够多形态（5 主题 + 3 个 ui-fork 分支是形态样本），再固化。'),
  ];
}

// ---------- main ----------

async function main() {
  console.log(`seeding block-system docs -> ${BASE}`);
  await login();
  const tree = (await req('GET', '/api/tree')) as {
    folders: Array<{ id: string; name: string; parentId: string | null }>;
    notepages: Array<{ id: string; folderId: string | null; title: string }>;
  };
  const dev = tree.folders.find((f) => f.name === '开发者文档' && f.parentId === null);
  if (!dev) throw new Error('no top-level 开发者文档 folder — run seed-devdocs.ts first');
  const arch = tree.folders.find((f) => f.name === '架构' && f.parentId === dev.id);
  if (!arch) throw new Error('no 架构 subfolder under 开发者文档');

  const existing = tree.notepages.filter((p) => p.folderId === arch.id && (p.title === PAGE_ABSTRACT || p.title === PAGE_IMPL));
  if (existing.length > 0) {
    if (!REPLACE) {
      console.error(`block-system doc pages already exist under 架构 — pass --replace to reseed. Aborting.`);
      process.exit(2);
    }
    for (const p of existing) {
      await req('DELETE', `/api/notepages/${p.id}`);
      console.log(`  − ${p.title}`);
    }
  }

  await createPage({ title: PAGE_ABSTRACT, folderId: arch.id, themeId: 'workbench', blocks: abstractBlocks() });
  await createPage({ title: PAGE_IMPL, folderId: arch.id, themeId: 'workbench', blocks: implBlocks() });
  console.log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
