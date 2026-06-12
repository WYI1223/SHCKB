/**
 * Seed the three MVP-5 scenario examples (M5-D1) through the real HTTP
 * API — the honest path: exercises auth, tree, blobs, working-state
 * validation, theme pins, and publish exactly like a human author.
 *
 * Usage:
 *   bun scripts/seed-examples.ts --base http://localhost:3210 \
 *     --email admin@local.dev --password dev-admin-password
 *
 * Idempotence guard: aborts if a top-level folder named 示例 exists.
 * Images are deterministic procedural PNGs (no copyright, no network).
 */
import { zlibSync } from 'fflate';

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

// ---------- deterministic PNG generator ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const body = out.subarray(4, 8 + data.length);
  dv.setUint32(8 + data.length, crc32(body));
  return out;
}

type Rgb = [number, number, number];

function lerp(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

type Scene = {
  top: Rgb;
  bottom: Rgb;
  /** horizon as fraction of height; below it the "sea" band darkens + waves */
  horizon: number;
  sun: { x: number; y: number; r: number; color: Rgb } | null;
  /** wave stripe amplitude (0 = none) */
  wave: number;
};

function renderPng(width: number, height: number, scene: Scene): Uint8Array {
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowAt = y * (1 + width * 3);
    raw[rowAt] = 0; // filter: none
    const fy = y / height;
    const belowHorizon = fy > scene.horizon;
    for (let x = 0; x < width; x++) {
      const fx = x / width;
      let px: Rgb;
      if (!belowHorizon) {
        px = lerp(scene.top, scene.bottom, fy / scene.horizon);
      } else {
        const t = (fy - scene.horizon) / (1 - scene.horizon);
        px = lerp(scene.bottom, [scene.bottom[0] * 0.45, scene.bottom[1] * 0.55, scene.bottom[2] * 0.7], t);
        if (scene.wave > 0) {
          const w = Math.sin(fx * 26 + t * 40) * Math.sin(t * 9);
          const lift = w > 1 - scene.wave ? 18 : 0;
          px = [px[0] + lift, px[1] + lift, px[2] + lift];
        }
      }
      if (scene.sun) {
        const dx = (fx - scene.sun.x) * width;
        const dy = (fy - scene.sun.y) * height;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < scene.sun.r) {
          px = scene.sun.color;
        } else if (d < scene.sun.r * 2.2 && !belowHorizon) {
          const glow = 1 - (d - scene.sun.r) / (scene.sun.r * 1.2);
          px = lerp(px, scene.sun.color, glow * 0.35);
        }
      }
      const at = rowAt + 1 + x * 3;
      raw[at] = Math.max(0, Math.min(255, Math.round(px[0])));
      raw[at + 1] = Math.max(0, Math.min(255, Math.round(px[1])));
      raw[at + 2] = Math.max(0, Math.min(255, Math.round(px[2])));
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', zlibSync(raw, { level: 9 })), chunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    png.set(p, off);
    off += p.length;
  }
  return png;
}

/** The travel/diary photo set — coastal scenes across a day, plus a desk-tone shot. */
const PHOTOS: Record<string, Scene> = {
  dawn: { top: [252, 210, 170], bottom: [250, 170, 140], horizon: 0.55, sun: { x: 0.3, y: 0.5, r: 26, color: [255, 240, 210] }, wave: 0.22 },
  noon: { top: [150, 205, 245], bottom: [120, 175, 230], horizon: 0.5, sun: { x: 0.78, y: 0.18, r: 22, color: [255, 252, 235] }, wave: 0.3 },
  cliff: { top: [185, 215, 235], bottom: [140, 170, 175], horizon: 0.42, sun: null, wave: 0.34 },
  dusk: { top: [120, 90, 140], bottom: [235, 130, 100], horizon: 0.58, sun: { x: 0.5, y: 0.56, r: 30, color: [255, 200, 150] }, wave: 0.2 },
  night: { top: [25, 30, 60], bottom: [45, 60, 100], horizon: 0.62, sun: { x: 0.68, y: 0.2, r: 16, color: [240, 240, 220] }, wave: 0.14 },
  desk: { top: [235, 220, 195], bottom: [215, 195, 165], horizon: 0.75, sun: { x: 0.25, y: 0.3, r: 34, color: [245, 235, 215] }, wave: 0 },
};

// ---------- API client ----------

let cookie = '';

async function req(method: string, path: string, body?: unknown, raw?: { bytes: Uint8Array; mime: string }) {
  const headers: Record<string, string> = { cookie };
  let payload: BodyInit | undefined;
  if (raw) {
    headers['content-type'] = raw.mime;
    payload = raw.bytes;
  } else if (body !== undefined) {
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

async function uploadPhoto(name: keyof typeof PHOTOS): Promise<string> {
  const png = renderPng(480, 360, PHOTOS[name]!);
  const r = (await req('POST', '/api/blobs', undefined, { bytes: png, mime: 'image/png' })) as { hash: string };
  return r.hash;
}

async function createPage(opts: {
  title: string;
  folderId: string;
  themeId: string;
  blocks: SeedBlock[];
}): Promise<string> {
  const { id } = (await req('POST', '/api/notepages', { title: opts.title })) as { id: string };
  await req('POST', `/api/notepages/${id}/move`, { folderId: opts.folderId });
  await req('PUT', `/api/notepages/${id}/working-state`, {
    title: opts.title,
    gravityEnabled: true,
    blocks: opts.blocks,
  });
  await req('POST', `/api/notepages/${id}/theme`, { themeId: opts.themeId });
  const pub = (await req('POST', `/api/notepages/${id}/publish`)) as { slug: string };
  await req('POST', `/api/notepages/${id}/visibility`, { visibility: 'public' });
  console.log(`  ✓ ${opts.title} -> /notes/${pub.slug}`);
  return pub.slug;
}

// ---------- scenario content ----------

async function seedDiary(folderId: string) {
  const photo = await uploadPhoto('desk');
  await createPage({
    title: '六月手帐',
    folderId,
    themeId: 'stationery',
    blocks: [
      {
        id: 'diary-0610',
        kind: 'markdown',
        col: 0, row: 0, colSpan: 7, rowSpan: 3,
        content: md(
          '## 6月10日 · 周三 ☁️\n\n' +
            '把书桌彻底收拾了一遍。旧笔记本翻出来七本，有两本几乎是空的——' +
            '果然买本子的速度永远赶不上写字的速度。\n\n' +
            '下午试着把读书笔记搬到电子手帐里，纸质的归档进抽屉。' +
            '**数字和纸面各管一摊**，大概是这两年折腾下来最舒服的分工。',
        ),
      },
      {
        id: 'diary-photo',
        kind: 'image',
        col: 7, row: 0, colSpan: 5, rowSpan: 4,
        content: { blobHash: photo, alt: '午后书桌，暖黄色的光' },
      },
      {
        id: 'diary-0611',
        kind: 'markdown',
        col: 0, row: 3, colSpan: 7, rowSpan: 4,
        content: md(
          '## 6月11日 · 周四 🌤\n\n' +
            '晨跑五公里，配速比上周快了十秒。回来路上买了豆浆和烧饼，' +
            '坐在阳台上吃完才想起来今天有早会，迟到三分钟，假装信号不好。\n\n' +
            '晚上读完《禅与摩托车维修艺术》第三部分。' +
            '"良质"这个词在脑子里转了一整天：\n\n' +
            '> 你想知道怎么画一张完美的画吗？很简单，先让自己变得完美，然后自然而然地画出来。\n\n' +
            '明天试试把这个思路用在重构代码上。',
        ),
      },
      {
        id: 'diary-todo',
        kind: 'markdown',
        col: 7, row: 4, colSpan: 5, rowSpan: 3,
        content: md(
          '### 本周待办 📌\n\n' +
            '- [x] 整理书桌\n' +
            '- [x] 读完第三部分\n' +
            '- [ ] 给绿萝换盆\n' +
            '- [ ] 备份照片到硬盘\n' +
            '- [ ] 写月中复盘',
        ),
      },
      {
        id: 'diary-0612',
        kind: 'markdown',
        col: 0, row: 7, colSpan: 12, rowSpan: 3,
        content: md(
          '## 6月12日 · 周五 ☀️\n\n' +
            '周五的好处是下班那一刻的空气都是甜的。和小周约了周末去海边，查了潮汐表，' +
            '周六清晨退潮，应该能看到很大一片滩涂。相机充上电，备用电池也找出来了。\n\n' +
            '*手帐写到第三天，发现记下来的都是小事——但回头看，小事才是日子本身。*',
        ),
      },
    ],
  });
}

async function seedTravel(folderId: string) {
  const [dawn, noon, cliff, dusk, night] = await Promise.all([
    uploadPhoto('dawn'),
    uploadPhoto('noon'),
    uploadPhoto('cliff'),
    uploadPhoto('dusk'),
    uploadPhoto('night'),
  ]);
  await createPage({
    title: '海岸线三日',
    folderId,
    themeId: 'stationery',
    blocks: [
      {
        id: 'trip-intro',
        kind: 'markdown',
        col: 0, row: 0, colSpan: 12, rowSpan: 2,
        content: md(
          '# 海岸线三日 🌊\n\n' +
            '沿着东海岸自驾三天，没有计划表，看到喜欢的海湾就停。住两家民宿，吃了五顿海鲜，拍了三百多张照片——挑出最喜欢的几张贴在这里。',
        ),
      },
      { id: 'trip-p1', kind: 'image', col: 0, row: 2, colSpan: 4, rowSpan: 4, content: { blobHash: dawn, alt: '第一天清晨，粉橘色的日出' } },
      { id: 'trip-p2', kind: 'image', col: 4, row: 2, colSpan: 4, rowSpan: 4, content: { blobHash: noon, alt: '正午的海，蓝得发亮' } },
      { id: 'trip-p3', kind: 'image', col: 8, row: 2, colSpan: 4, rowSpan: 4, content: { blobHash: cliff, alt: '断崖步道望出去的灰绿色海面' } },
      {
        id: 'trip-day1',
        kind: 'markdown',
        col: 0, row: 6, colSpan: 6, rowSpan: 4,
        content: md(
          '## 第一天 · 追日出\n\n' +
            '四点半起床，摸黑开到观景台。日出比预报晚了七分钟，但云烧起来的那一刻所有人都安静了。\n\n' +
            '早饭是渔港边的小摊：现煮的海鲜面，汤头鲜得眉毛掉下来。老板娘说这个季节的梭子蟹最肥，于是中午又折回去吃了一顿。\n\n' +
            '下午沿断崖步道走了六公里，风大到说话要喊。',
        ),
      },
      { id: 'trip-p4', kind: 'image', col: 6, row: 6, colSpan: 6, rowSpan: 4, content: { blobHash: dusk, alt: '第二天傍晚，落日沉进海面' } },
      {
        id: 'trip-p5',
        kind: 'image',
        col: 0, row: 10, colSpan: 6, rowSpan: 4,
        content: { blobHash: night, alt: '夜里的灯塔和星星' },
      },
      {
        id: 'trip-day23',
        kind: 'markdown',
        col: 6, row: 10, colSpan: 6, rowSpan: 4,
        content: md(
          '## 第二、三天 · 慢下来\n\n' +
            '第二天几乎没挪窝：民宿天台、咖啡、一本没读完的书。傍晚的落日是这趟旅行的高光，连手机随手拍都好看。\n\n' +
            '第三天回程前去看了灯塔。夜里光污染很小，肉眼能看到银河的一角。\n\n' +
            '**下次想试试把三脚架带上，拍星轨。**',
        ),
      },
    ],
  });
}

async function seedCodeWalkthrough(folderId: string) {
  await createPage({
    title: 'grid-engine 重力算法讲解',
    folderId,
    themeId: 'workbench',
    blocks: [
      {
        id: 'gw-intro',
        kind: 'markdown',
        col: 0, row: 0, colSpan: 12, rowSpan: 2,
        content: md(
          '# grid-engine 重力算法讲解\n\n' +
            '约束画布（12 列网格）上的块为什么不会"悬空"？这页拆解 grid-engine 的重力模型：**下落（settle）**、**稳定性校验**、和**空洞回填**三个层次。示例代码为讲解用的简化版。',
        ),
      },
      {
        id: 'gw-concept',
        kind: 'markdown',
        col: 0, row: 2, colSpan: 5, rowSpan: 4,
        content: md(
          '## 1. 数据模型\n\n' +
            '每个块是一个 AABB（轴对齐矩形）：列、行、跨列、跨行。两个块**冲突**当且仅当它们的矩形相交。\n\n' +
            '重力的全部语义建立在一个谓词上：\n\n' +
            '*一个块是"落定的"，当它行数为 0，或再往上挪一行就会撞到别的块。*\n\n' +
            '右边是冲突检测的核心——典型的一维区间相交测试，做两次。',
        ),
      },
      {
        id: 'gw-code1',
        kind: 'code',
        col: 5, row: 2, colSpan: 7, rowSpan: 4,
        content: code(
          'typescript',
          'type Block = {\n  id: string;\n  col: number; row: number;\n  colSpan: number; rowSpan: number;\n};\n\n/** AABB 相交：两轴区间都重叠才算撞上 */\nfunction collides(a: Block, b: Block): boolean {\n  return (\n    a.col < b.col + b.colSpan &&\n    b.col < a.col + a.colSpan &&\n    a.row < b.row + b.rowSpan &&\n    b.row < a.row + a.rowSpan\n  );\n}',
        ),
      },
      {
        id: 'gw-code2',
        kind: 'code',
        col: 0, row: 6, colSpan: 7, rowSpan: 5,
        content: code(
          'typescript',
          '/** 把一个块尽可能往上挪：经典"下落"实现。\n *  注意排序——必须从上往下逐个 settle，\n *  否则下面的块会被还没落定的块挡住。 */\nfunction settle(blocks: Block[]): Block[] {\n  const sorted = [...blocks].sort((x, y) => x.row - y.row);\n  const placed: Block[] = [];\n  for (const b of sorted) {\n    let row = b.row;\n    while (row > 0) {\n      const probe = { ...b, row: row - 1 };\n      if (placed.some((p) => collides(probe, p))) break;\n      row--;\n    }\n    placed.push({ ...b, row });\n  }\n  return placed;\n}',
        ),
      },
      {
        id: 'gw-explain2',
        kind: 'markdown',
        col: 7, row: 6, colSpan: 5, rowSpan: 4,
        content: md(
          '## 2. 为什么先排序？\n\n' +
            '`settle` 的循环不是对称的：先处理靠上的块，它们落定后成为下方块的"地面"。\n\n' +
            '如果乱序处理，一个还没下落的块会把别人挡在半空，结果依赖遍历顺序——**同一份输入产生不同布局**，这是编辑器最忌讳的非确定性。\n\n' +
            '按 `row` 升序处理后，算法满足：任意输入跑一遍 `settle`，输出必然稳定（再跑一遍不变）。',
        ),
      },
      {
        id: 'gw-explain3',
        kind: 'markdown',
        col: 7, row: 10, colSpan: 5, rowSpan: 4,
        content: md(
          '## 3. 校验而非修复\n\n' +
            '服务端不信任客户端布局，但它**不替你修**：`validateState` 只判断"每个块是否落定"，不落定就 422 拒绝。\n\n' +
            '修复（settle）只发生在编辑器交互里，用户看得见；持久化层只接受已稳定的状态。\n\n' +
            '这就是"**所见即所存**"：预览用的算法和落库校验用的是同一个引擎。',
        ),
      },
      {
        id: 'gw-code3',
        kind: 'code',
        col: 0, row: 11, colSpan: 7, rowSpan: 3,
        content: code(
          'typescript',
          '/** 重力开启时的校验：人人落定，否则报块 id */\nfunction validate(blocks: Block[]): string[] {\n  return blocks\n    .filter((b) => b.row > 0)\n    .filter((b) => {\n      const probe = { ...b, row: b.row - 1 };\n      return !blocks.some(\n        (p) => p.id !== b.id && collides(probe, p),\n      );\n    })\n    .map((b) => b.id); // 非空 = 有悬空块\n}',
        ),
      },
      {
        id: 'gw-outro',
        kind: 'markdown',
        col: 0, row: 14, colSpan: 12, rowSpan: 2,
        content: md(
          '## 小结\n\n' +
            '三层各司其职：`collides` 是几何真理，`settle` 是编辑器的交互修复，`validate` 是持久化的守门人。' +
            '真实实现还要处理**重力关闭模式**（允许悬空，校验只查重叠）和**空洞回填**（删块后下方块上浮）——留作下一篇。',
        ),
      },
    ],
  });
}

// ---------- main ----------

async function main() {
  console.log(`seeding examples -> ${BASE}`);
  await login();

  const tree = (await req('GET', '/api/tree')) as { folders: Array<{ id: string; name: string; parentId: string | null }> };
  if (tree.folders.some((f) => f.name === '示例' && f.parentId === null)) {
    console.error('top-level folder 示例 already exists — aborting (idempotence guard)');
    process.exit(2);
  }

  const { id: folderId } = (await req('POST', '/api/folders', { name: '示例' })) as { id: string };
  console.log(`folder 示例 = ${folderId}`);

  await seedDiary(folderId);
  await seedTravel(folderId);
  await seedCodeWalkthrough(folderId);
  console.log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
