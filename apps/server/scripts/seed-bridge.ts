/**
 * Seed the G/W/K "桥块演示 / bridge problem" notepage into the owner
 * dev库 through the real HTTP API — same honest pose as
 * seed-examples.ts (auth, working-state validation, theme, publish).
 * This is the FINAL plan step (block-autofit-height §8.5): a live
 * fixture for the owner to manually exercise the hardest reversible
 * path in a real browser.
 *
 * Topology (the §4.2-pre / §11 named regression case):
 *   G  autofit markdown  cols 0-1, row 0           (narrow grower)
 *   W  wide straddling    cols 0-5, row 1           (bridge block)
 *   K  side column        cols 4-5, row 2           (the block that
 *                                                    must NOT leak)
 * Manual exercise: type in G → W pushes down, K stays (gesture
 * reversible) → delete → both return → commit a net-grow → observe
 * the gravity-on "commit = compact" boundary (PROBE-2 / R6).
 *
 * Usage:
 *   bun apps/server/scripts/seed-bridge.ts --base http://localhost:3210 \
 *     --email admin@local.dev --password dev-admin-password
 *
 * Idempotence: aborts if a top-level folder named 桥块演示 exists.
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
const FOLDER_NAME = '桥块演示';

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

// ---------- block shapes ----------

type SeedBlock = {
  id: string;
  kind: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  shell?: string | null;
  autofit?: 'off' | 'grow' | 'grow+shrink' | null;
  minRowSpan?: number | null;
  content: unknown;
};

const md = (markdown: string) => ({ markdown });

async function createPage(opts: { title: string; folderId: string; themeId: string; blocks: SeedBlock[] }): Promise<string> {
  const { id } = (await req('POST', '/api/notepages', { title: opts.title })) as { id: string };
  await req('POST', `/api/notepages/${id}/move`, { folderId: opts.folderId });
  await req('PUT', `/api/notepages/${id}/working-state`, {
    title: opts.title,
    gravityEnabled: true, // gravity ON: the commit-compaction boundary (PROBE-2/R6) is live
    blocks: opts.blocks,
  });
  await req('POST', `/api/notepages/${id}/theme`, { themeId: opts.themeId });
  const pub = (await req('POST', `/api/notepages/${id}/publish`)) as { slug: string };
  await req('POST', `/api/notepages/${id}/visibility`, { visibility: 'public' });
  console.log(`  ✓ ${opts.title} -> /notes/${pub.slug}`);
  return pub.slug;
}

// ---------- the G/W/K page ----------

async function seedBridge(folderId: string) {
  const blocks: SeedBlock[] = [
    // G — narrow autofit markdown grower (cols 0-1, floor = 1 row).
    {
      id: 'G',
      kind: 'markdown',
      col: 0, row: 0, colSpan: 2, rowSpan: 1,
      autofit: 'grow',
      minRowSpan: 1,
      content: md(
        '**G**\n\n' +
          '在这里打字 → 我会变高、把下面的 **W** 整体下推；' +
          '删回来 → W 归位、**K** 全程不动。',
      ),
    },
    // W — the wide bridge straddling G's column AND the side column
    // (cols 0-5, row 1). Its downward push, under global gravity,
    // would historically drag K to row 0 on shrink (§4.2-pre).
    {
      id: 'W',
      kind: 'markdown',
      col: 0, row: 1, colSpan: 6, rowSpan: 1,
      autofit: 'off',
      minRowSpan: null,
      content: md('**W** — 横跨 G 列与旁列的桥块（被 G 撑高时整体下推）'),
    },
    // K — side-column block below W (cols 4-5, row 2). The block the
    // owner watches to confirm no leak within the gesture.
    {
      id: 'K',
      kind: 'markdown',
      col: 4, row: 2, colSpan: 2, rowSpan: 1,
      autofit: 'off',
      minRowSpan: null,
      content: md('**K** — 旁列块（手势内绝不应被挪动）'),
    },
    // The exercise recipe on the page itself (cols 6-11, row 1).
    {
      id: 'howto',
      kind: 'markdown',
      col: 6, row: 1, colSpan: 6, rowSpan: 3,
      autofit: 'off',
      minRowSpan: null,
      content: md(
        '## 手测脚本（最难的可逆路径）\n\n' +
          '1. 点开 **G**，连打几行 → 看 **W** 下推、**K** 不动。\n' +
          '2. 全删 → 看 W 归位、K 仍不动（手势内可逆，C5）。\n' +
          '3. 再打字撑高并**失焦提交** → 净增高：gravity-on 下会跑一遍压实' +
          '（"提交即压实"边界，PROBE-2）。\n\n' +
          '> 这页就是 §11 的 G/W/K 命名 fixture 的活体对照。',
      ),
    },
  ];
  await createPage({ title: '桥块演示 G/W/K', folderId, themeId: 'graph-paper', blocks });
}

// ---------- main ----------

async function main() {
  console.log(`seeding bridge demo -> ${BASE}`);
  await login();

  const tree = (await req('GET', '/api/tree')) as { folders: Array<{ id: string; name: string; parentId: string | null }> };
  if (tree.folders.some((f) => f.name === FOLDER_NAME && f.parentId === null)) {
    console.error(`top-level folder ${FOLDER_NAME} already exists — aborting (idempotence guard)`);
    process.exit(2);
  }

  const { id: folderId } = (await req('POST', '/api/folders', { name: FOLDER_NAME })) as { id: string };
  console.log(`folder ${FOLDER_NAME} = ${folderId}`);

  await seedBridge(folderId);
  console.log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
