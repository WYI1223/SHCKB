# MVP-3 Export / Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Git-friendly full-instance export/import (canonical JSON tree + content-addressed blobs), a bidirectional format-migration pipeline, and blob GC — per [2026-06-12-mvp3-export-import-design.md](../specs/2026-06-12-mvp3-export-import-design.md).

**Architecture:** Export builds a deterministic in-memory file map (`path → canonical JSON text`) plus a blob map, zipped only at the route layer. Import is the exact inverse: unzip → parse → format-migrate to current → validate everything → one DB transaction. The format-migration pipeline mirrors [ADR-0020]'s shape (ordered versioned transforms) but is pure JSON→JSON, stateless, version carried in `manifest.json`. Blob reference enumeration (64-hex-string scan over kind-owned content) is shared between export and GC.

**Tech Stack:** Bun + Hono + Drizzle/bun:sqlite (existing), `fflate` (new dep — sync zip/unzip), bun:test.

**Branch:** `feat/mvp3` off `main`.

---

## File structure

| File | Responsibility |
|---|---|
| `apps/server/src/export/format.ts` | Create: FORMAT_VERSION, manifest/page/folder types, canonical JSON serializer, dir-name sanitizer |
| `apps/server/src/export/blob-refs.ts` | Create: hash-like string collector + DB-wide referenced-blob enumeration (shared by export & GC) |
| `apps/server/src/export/exporter.ts` | Create: `buildExport(db, blobStore, opts)` → deterministic bundle |
| `apps/server/src/export/migrate-format.ts` | Create: transform registry + `upgradeToVersion`/`downgradeToVersion` |
| `apps/server/src/export/importer.ts` | Create: `importBundle(db, blobStore, input)` — gates, validation, atomic write, HTML re-render |
| `apps/server/src/routes/admin.ts` | Create: `/api/admin/export` (zip), `/api/admin/import` (zip), `/api/admin/blobs/gc`; admin-role gate |
| `apps/server/src/blobstore.ts` | Modify: add `read` / `list` / `delete` |
| `apps/server/src/app.ts` | Modify: mount admin routes |
| `apps/web/src/shell/Sidebar.tsx` | Modify: Export button (admin only) |
| `apps/server/test/export-format.test.ts` | Create: format/blob-refs/pipeline unit tests |
| `apps/server/test/export-import.test.ts` | Create: exporter/importer/admin-route/GC tests incl. round-trip |
| `docs/engineering/decisions/ADR-0023-export-import-format.md` | Create: format contract + migration discipline |
| `docs/engineering/design/discussions/mvp3-scope-2026-06-12.md` | Create: scope record + build log |
| `docs/engineering/runbooks/self-host-upgrade.md` | Modify: logical backup / migrate-instance / downgrade-path / GC sections |
| `docs/engineering/decisions/AUDIT-2026-05.md` | Modify: mark blob-GC debt repaid |

Format invariants the code must uphold (from the spec): stable ordering everywhere (blocks by id; siblings by sortKey then id; manifest lists lexicographic), 2-space pretty JSON + trailing LF, export timestamp confined to `manifest.exportedAt`, `publishedHtml` never exported.

---

### Task 1: Branch, dependency, scope record

**Files:**
- Create: `docs/engineering/design/discussions/mvp3-scope-2026-06-12.md`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Create branch**

```powershell
git checkout -b feat/mvp3
```

- [ ] **Step 2: Add fflate**

In `apps/server/package.json` dependencies add:

```json
"fflate": "^0.8.2",
```

Then (Bun on PATH per session convention `$env:Path += ";$HOME\.bun\bin"`):

```powershell
bun install
```

Expected: lockfile updated, no errors.

- [ ] **Step 3: Create scope record**

`docs/engineering/design/discussions/mvp3-scope-2026-06-12.md`:

```markdown
# MVP-3 scope — export/import git 友好格式（数据自主权）

| Field | Value |
|---|---|
| Status | in progress |
| Spec | [2026-06-12-mvp3-export-import-design.md](../../../superpowers/specs/2026-06-12-mvp3-export-import-design.md)（owner ratified）|
| Branch | feat/mvp3 |

## 决策摘录（详见 spec）

- M3-D1 格式即契约：canonical 目录树（manifest + tree/ + blobs/），确定性导出
- M3-D2 格式迁移管线：镜像 [ADR-0020] 模式的纯函数管线；双向；降级在导出端；有损必须显式；up/down 成对纪律
- M3-D3 Import 仅空实例全量恢复；原子性；新格式进旧实例明确拒绝
- M3-D4 Blob 引用枚举为 export/GC 共享逻辑；块 kind 必须以小写 hex sha256 原文引用 blob（新契约，入 ADR-0023）
- M3-D5 不做：双向同步 / 增量 import / publishedHtml 导出

## Build log

（按时间追加）
```

- [ ] **Step 4: Commit**

```powershell
git add -A; git commit -m "chore(mvp3): branch scaffold — fflate dep + scope record"
```

---

### Task 2: BlobStore read / list / delete

**Files:**
- Modify: `apps/server/src/blobstore.ts`
- Test: `apps/server/test/blobs.test.ts` (append)

- [ ] **Step 1: Write failing tests** (append to `apps/server/test/blobs.test.ts`)

```ts
import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BlobStore } from '../src/blobstore';

describe('BlobStore read/list/delete', () => {
  test('read returns stored bytes, null for missing/invalid', () => {
    const store = new BlobStore(mkdtempSync(join(tmpdir(), 'skb-bs-')));
    const bytes = new TextEncoder().encode('hello blob');
    const { hash } = store.save(bytes);
    expect(store.read(hash)).toEqual(bytes);
    expect(store.read('0'.repeat(64))).toBeNull();
    expect(store.read('../etc/passwd')).toBeNull();
  });

  test('list returns sorted hashes; delete removes', () => {
    const store = new BlobStore(mkdtempSync(join(tmpdir(), 'skb-bs-')));
    const a = store.save(new TextEncoder().encode('aaa')).hash;
    const b = store.save(new TextEncoder().encode('bbb')).hash;
    expect(store.list()).toEqual([a, b].sort());
    expect(store.delete(a)).toBe(true);
    expect(store.list()).toEqual([b]);
    expect(store.delete(a)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```powershell
bun test apps/server/test/blobs.test.ts
```

Expected: FAIL — `read is not a function`.

- [ ] **Step 3: Implement** — in `apps/server/src/blobstore.ts`, extend imports to `{ existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync }` and add methods to the class:

```ts
  /** Stored bytes for a blob, or null for invalid/missing ids. */
  read(hash: string): Uint8Array | null {
    const p = this.path(hash);
    return p ? new Uint8Array(readFileSync(p)) : null;
  }

  /** All stored hashes, sorted (deterministic enumeration for export/GC). */
  list(): string[] {
    return readdirSync(this.dir)
      .filter((f) => HASH_RE.test(f))
      .sort();
  }

  /** Remove a blob file; false if it wasn't there. Caller owns the
   * referenced-check — the store stays policy-free. */
  delete(hash: string): boolean {
    const p = this.path(hash);
    if (!p) return false;
    unlinkSync(p);
    return true;
  }
```

Also update the file-top comment: `No GC in MVP-2.` → `GC arrives in MVP-3 via routes/admin.ts (store stays policy-free).`

- [ ] **Step 4: Run tests**

```powershell
bun test apps/server/test/blobs.test.ts
```

Expected: PASS (old + new).

- [ ] **Step 5: Commit**

```powershell
git add -A; git commit -m "feat(blobstore): read/list/delete for export and gc"
```

---

### Task 3: Blob reference enumeration

**Files:**
- Create: `apps/server/src/export/blob-refs.ts`
- Test: `apps/server/test/export-format.test.ts` (new file, first describe)

- [ ] **Step 1: Write failing tests** — create `apps/server/test/export-format.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { collectHashLikeStrings } from '../src/export/blob-refs';

const H1 = 'a'.repeat(64);
const H2 = 'b1c2'.repeat(16);

describe('collectHashLikeStrings', () => {
  test('finds 64-hex strings at any JSON depth', () => {
    const value = { blobHash: H1, nested: [{ x: H2 }, 'not-a-hash', 42], t: null };
    expect([...collectHashLikeStrings(value)].sort()).toEqual([H1, H2].sort());
  });

  test('ignores wrong length, uppercase, non-hex', () => {
    const value = ['A'.repeat(64), 'f'.repeat(63), 'g'.repeat(64), H1.slice(0, 32)];
    expect(collectHashLikeStrings(value).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```powershell
bun test apps/server/test/export-format.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — create `apps/server/src/export/blob-refs.ts`:

```ts
/**
 * Blob reference enumeration, shared by export and GC [ADR-0023].
 *
 * Block content is kind-owned and opaque, so the server cannot know
 * field names. Contract instead: block kinds MUST reference blobs by
 * the verbatim lowercase-hex sha256 string in their content JSON.
 * Scanning collects every such string; callers intersect with the
 * blobs table (export) or treat the set as conservative keep-list (GC
 * — false positives keep a blob alive, never delete a live one).
 */
import type { Db } from '../db/client';
import { blocks, notepages } from '../db/schema';

const SHA256_RE = /^[a-f0-9]{64}$/;

/** Every string in a JSON value that looks like a sha256 hash. */
export function collectHashLikeStrings(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (SHA256_RE.test(value)) into.add(value);
    return into;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectHashLikeStrings(v, into);
    return into;
  }
  if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) collectHashLikeStrings(v, into);
  }
  return into;
}

/** Hashes referenced by any working block or published snapshot. */
export function referencedBlobHashes(db: Db): Set<string> {
  const out = new Set<string>();
  for (const b of db.select({ content: blocks.content }).from(blocks).all()) {
    collectHashLikeStrings(JSON.parse(b.content), out);
  }
  for (const p of db.select({ publishedDoc: notepages.publishedDoc }).from(notepages).all()) {
    if (p.publishedDoc !== null) collectHashLikeStrings(JSON.parse(p.publishedDoc), out);
  }
  return out;
}
```

- [ ] **Step 4: Run tests** — expected PASS.

- [ ] **Step 5: Commit**

```powershell
git add -A; git commit -m "feat(export): blob reference enumeration shared by export and gc"
```

---

### Task 4: Canonical format module

**Files:**
- Create: `apps/server/src/export/format.ts`
- Test: `apps/server/test/export-format.test.ts` (append)

- [ ] **Step 1: Write failing tests** (append):

```ts
import { canonicalJson, sanitizeDirName, FORMAT_VERSION } from '../src/export/format';

describe('canonical format helpers', () => {
  test('FORMAT_VERSION is 1', () => {
    expect(FORMAT_VERSION).toBe(1);
  });

  test('canonicalJson: 2-space pretty print, trailing LF, no CR', () => {
    const text = canonicalJson({ a: 1, b: [1, 2] });
    expect(text.endsWith('\n')).toBe(true);
    expect(text.includes('\r')).toBe(false);
    expect(text).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}\n');
  });

  test('sanitizeDirName strips path-hostile characters', () => {
    expect(sanitizeDirName('a/b\\c:d')).toBe('a_b_c_d');
    expect(sanitizeDirName('  trailing.dots... ')).toBe('trailing.dots');
    expect(sanitizeDirName('con?*<>|"')).toBe('con_____');
    expect(sanitizeDirName('///')).toBe('___');
    expect(sanitizeDirName('   ')).toBe('_');
    expect(sanitizeDirName('方法论')).toBe('方法论');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `bun test apps/server/test/export-format.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement** — create `apps/server/src/export/format.ts`:

```ts
/**
 * Canonical export format v1 [ADR-0023]. The format is a contract:
 * key order is fixed by explicit construction below, serialization is
 * 2-space pretty JSON + LF. Determinism invariant: two exports of the
 * same instance differ ONLY in manifest.exportedAt.
 *
 * Layout:
 *   manifest.json
 *   tree/<folder dirs…>/folder.json
 *   tree/<folder dirs…>/<slug>.page.json
 *   blobs/<sha256>            (zip layer; not part of the JSON file map)
 */
import type { PublishedDoc } from '../db/schema';

export const FORMAT_VERSION = 1;

export type ExportManifest = {
  formatVersion: number;
  schemaVersion: number;
  appVersion: string;
  exportedAt: number; // the ONLY export-time field anywhere in the bundle
  counts: { folders: number; pages: number; blocks: number; blobs: number };
  pages: string[]; // page file paths, lexicographically sorted
  blobs: Array<{ hash: string; mimeType: string; size: number; createdAt: number }>; // sorted by hash
};

export type ExportFolderMeta = {
  id: string;
  name: string; // original name; the directory name is its sanitized form
  sortKey: number;
  createdAt: number;
};

export type ExportBlock = {
  id: string;
  kind: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  content: unknown; // kind-owned, verbatim
};

export type ExportPage = {
  id: string;
  slug: string; // identity; the file name is presentation derived from it
  title: string;
  visibility: 'private' | 'public';
  gravityEnabled: boolean;
  sortKey: number;
  createdAt: number;
  updatedAt: number;
  published: PublishedDoc | null; // publishedHtml is derived → never exported
  blocks: ExportBlock[]; // sorted by id
};

/** The one serializer every exported JSON file goes through. */
export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Folder name → filesystem-safe directory name (collision handling is
 * the exporter's job — it sees the sibling set). */
export function sanitizeDirName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  return cleaned === '' ? '_' : cleaned;
}
```

- [ ] **Step 4: Run tests** — expected PASS.

- [ ] **Step 5: Commit**

```powershell
git add -A; git commit -m "feat(export): canonical format v1 — types, serializer, dir sanitizer"
```

---

### Task 5: Exporter

**Files:**
- Create: `apps/server/src/export/exporter.ts`
- Test: `apps/server/test/export-import.test.ts` (new file)

- [ ] **Step 1: Write failing tests** — create `apps/server/test/export-import.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { createTestContext, json } from './helpers';
import { buildExport } from '../src/export/exporter';
import { BlobStore } from '../src/blobstore';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OPTS = { appVersion: 'test', schemaVersion: 5, exportedAt: 1_000 };

/** Build a small instance through the API: folder A ( page P1 published+public, blob in P1 ), root page P2 private. */
async function seedInstance(ctx: Awaited<ReturnType<typeof createTestContext>>, blobStore: BlobStore) {
  const folder = await json(await ctx.authed('/api/folders', { method: 'POST', body: JSON.stringify({ name: 'A' }) }));
  const p1 = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'Page One' }) }));
  await ctx.authed(`/api/notepages/${p1.id}/move`, { method: 'POST', body: JSON.stringify({ folderId: folder.id }) });
  const blobBytes = new TextEncoder().encode('fake-image-bytes');
  const up = await ctx.authed('/api/blobs', { method: 'POST', body: blobBytes, headers: { 'content-type': 'image/png' } });
  const { hash } = await json(up);
  await ctx.authed(`/api/notepages/${p1.id}/working-state`, {
    method: 'PUT',
    body: JSON.stringify({
      title: 'Page One',
      gravityEnabled: true,
      blocks: [
        { id: 'b2', kind: 'image', col: 0, row: 1, colSpan: 4, rowSpan: 3, content: { blobHash: hash, alt: 'x' } },
        { id: 'b1', kind: 'markdown', col: 0, row: 0, colSpan: 12, rowSpan: 1, content: { markdown: '# hi' } },
      ],
    }),
  });
  await ctx.authed(`/api/notepages/${p1.id}/publish`, { method: 'POST' });
  await ctx.authed(`/api/notepages/${p1.id}/visibility`, { method: 'POST', body: JSON.stringify({ visibility: 'public' }) });
  const p2 = await json(await ctx.authed('/api/notepages', { method: 'POST', body: JSON.stringify({ title: 'Page Two' }) }));
  return { folderId: folder.id, p1: p1.id, p2: p2.id, hash };
}

describe('buildExport', () => {
  test('produces manifest + folder.json + page files + referenced blobs, deterministically', async () => {
    const ctx = await createTestContext();
    const blobStore = ctx.blobStore;
    const seeded = await seedInstance(ctx, blobStore);

    const bundle = buildExport(ctx.db, blobStore, OPTS);
    const paths = [...bundle.files.keys()];
    expect(paths).toContain('manifest.json');
    expect(paths).toContain('tree/A/folder.json');
    expect(paths).toContain('tree/A/page-one.page.json');
    expect(paths).toContain('tree/page-two.page.json');
    expect([...bundle.blobs.keys()]).toEqual([seeded.hash]);

    const manifest = JSON.parse(bundle.files.get('manifest.json')!);
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.counts).toEqual({ folders: 1, pages: 2, blocks: 2, blobs: 1 });
    expect(manifest.pages).toEqual(['tree/A/page-one.page.json', 'tree/page-two.page.json']);

    const page = JSON.parse(bundle.files.get('tree/A/page-one.page.json')!);
    expect(page.blocks.map((b: { id: string }) => b.id)).toEqual(['b1', 'b2']); // sorted by id
    expect(page.published).not.toBeNull();
    expect('publishedHtml' in page).toBe(false);

    // determinism: same instance, second export differs only in exportedAt
    const again = buildExport(ctx.db, blobStore, { ...OPTS, exportedAt: 2_000 });
    for (const [p, text] of bundle.files) {
      if (p === 'manifest.json') continue;
      expect(again.files.get(p)).toBe(text);
    }
    const m2 = JSON.parse(again.files.get('manifest.json')!);
    expect({ ...m2, exportedAt: 0 }).toEqual({ ...manifest, exportedAt: 0 });
  });

  test('sibling folders with colliding sanitized names get deterministic suffixes', async () => {
    const ctx = await createTestContext();
    await ctx.authed('/api/folders', { method: 'POST', body: JSON.stringify({ name: 'a/b' }) });
    await ctx.authed('/api/folders', { method: 'POST', body: JSON.stringify({ name: 'a\\b' }) });
    const bundle = buildExport(ctx.db, ctx.blobStore, OPTS);
    const dirs = [...bundle.files.keys()].filter((p) => p.endsWith('/folder.json')).sort();
    expect(dirs).toEqual(['tree/a_b/folder.json', 'tree/a_b~2/folder.json']);
  });
});
```

Note: `createTestContext` does not currently expose `blobStore` — Step 2 extends helpers.

- [ ] **Step 2: Expose blobStore from helpers** — in `apps/server/test/helpers.ts`, add `blobStore` to `TestContext` and return it:

```ts
export type TestContext = {
  db: Db;
  app: ReturnType<typeof createApp>;
  blobStore: BlobStore;
  cookie: string;
  /** request with the admin session cookie attached */
  authed: (path: string, init?: RequestInit) => Promise<Response>;
};
```

In `createTestContext`, hoist the store into a local before `createApp`:

```ts
  const blobStore = new BlobStore(mkdtempSync(join(tmpdir(), 'skb-blobs-')));
  const app = createApp({
    db: handle.db,
    auth,
    blobStore,
    meta: { version: 'test', schemaVersion: handle.schemaVersion },
  });
```

and include `blobStore` in the returned object.

- [ ] **Step 3: Run to verify failure** — `bun test apps/server/test/export-import.test.ts` → FAIL, exporter module not found.

- [ ] **Step 4: Implement** — create `apps/server/src/export/exporter.ts`:

```ts
/**
 * Deterministic export bundle builder [ADR-0023]. Pure read of DB +
 * blob store → in-memory file map; zipping is the route's concern.
 * Iteration orders are pinned (sortKey, then id; lexicographic in the
 * manifest) so identical instances always serialize identically.
 */
import type { BlobStore } from '../blobstore';
import type { Db } from '../db/client';
import { blobs, blocks, folders, notepages, type PublishedDoc } from '../db/schema';
import { referencedBlobHashes } from './blob-refs';
import {
  FORMAT_VERSION,
  canonicalJson,
  sanitizeDirName,
  type ExportFolderMeta,
  type ExportManifest,
  type ExportPage,
} from './format';

export type ExportBundle = {
  files: Map<string, string>; // path → canonical JSON text
  blobs: Map<string, Uint8Array>; // hash → bytes
};

type FolderRow = typeof folders.$inferSelect;

/** folder id → directory path under tree/ (no prefix). Sibling name
 * collisions (post-sanitize, case-insensitive for Windows/macOS) get
 * deterministic ~2, ~3… suffixes in (sortKey, id) order. */
export function computeFolderPaths(rows: FolderRow[]): Map<string, string> {
  const byParent = new Map<string | null, FolderRow[]>();
  for (const f of rows) {
    const list = byParent.get(f.parentId) ?? [];
    list.push(f);
    byParent.set(f.parentId, list);
  }
  const paths = new Map<string, string>();
  const walk = (parentId: string | null, prefix: string) => {
    const siblings = (byParent.get(parentId) ?? []).sort(
      (a, b) => a.sortKey - b.sortKey || a.id.localeCompare(b.id),
    );
    const used = new Set<string>();
    for (const f of siblings) {
      const base = sanitizeDirName(f.name);
      let dir = base;
      for (let n = 2; used.has(dir.toLowerCase()); n++) dir = `${base}~${n}`;
      used.add(dir.toLowerCase());
      const full = prefix === '' ? dir : `${prefix}/${dir}`;
      paths.set(f.id, full);
      walk(f.id, full);
    }
  };
  walk(null, '');
  return paths;
}

export function buildExport(
  db: Db,
  blobStore: BlobStore,
  opts: { appVersion: string; schemaVersion: number; exportedAt: number },
): ExportBundle {
  const folderRows = db.select().from(folders).all();
  const pageRows = db.select().from(notepages).all();
  const blockRows = db.select().from(blocks).all();
  const blobRows = db.select().from(blobs).all();

  const files = new Map<string, string>();
  const folderPaths = computeFolderPaths(folderRows);

  for (const f of folderRows) {
    const meta: ExportFolderMeta = {
      id: f.id,
      name: f.name,
      sortKey: f.sortKey,
      createdAt: f.createdAt.getTime(),
    };
    files.set(`tree/${folderPaths.get(f.id)!}/folder.json`, canonicalJson(meta));
  }

  const blocksByPage = new Map<string, typeof blockRows>();
  for (const b of blockRows) {
    const list = blocksByPage.get(b.notepageId) ?? [];
    list.push(b);
    blocksByPage.set(b.notepageId, list);
  }

  const pagePaths: string[] = [];
  const sortedPages = [...pageRows].sort((a, b) => a.sortKey - b.sortKey || a.id.localeCompare(b.id));
  for (const p of sortedPages) {
    const dir = p.folderId === null ? '' : `${folderPaths.get(p.folderId)!}/`;
    const path = `tree/${dir}${p.slug}.page.json`;
    const page: ExportPage = {
      id: p.id,
      slug: p.slug,
      title: p.title,
      visibility: p.visibility,
      gravityEnabled: p.gravityEnabled,
      sortKey: p.sortKey,
      createdAt: p.createdAt.getTime(),
      updatedAt: p.updatedAt.getTime(),
      published: p.publishedDoc === null ? null : (JSON.parse(p.publishedDoc) as PublishedDoc),
      blocks: (blocksByPage.get(p.id) ?? [])
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((b) => ({
          id: b.id,
          kind: b.kind,
          col: b.col,
          row: b.row,
          colSpan: b.colSpan,
          rowSpan: b.rowSpan,
          content: JSON.parse(b.content) as unknown,
        })),
    };
    files.set(path, canonicalJson(page));
    pagePaths.push(path);
  }

  // referenced ∩ blobs table: the scan may over-collect hash-like
  // strings; only registered blobs are real. Missing files fail loudly.
  const referenced = referencedBlobHashes(db);
  const blobOut = new Map<string, Uint8Array>();
  const manifestBlobs: ExportManifest['blobs'] = [];
  for (const row of [...blobRows].sort((a, b) => a.hash.localeCompare(b.hash))) {
    if (!referenced.has(row.hash)) continue;
    const bytes = blobStore.read(row.hash);
    if (bytes === null) throw new Error(`blob ${row.hash} is registered and referenced but missing on disk`);
    blobOut.set(row.hash, bytes);
    manifestBlobs.push({ hash: row.hash, mimeType: row.mimeType, size: row.size, createdAt: row.createdAt.getTime() });
  }

  const manifest: ExportManifest = {
    formatVersion: FORMAT_VERSION,
    schemaVersion: opts.schemaVersion,
    appVersion: opts.appVersion,
    exportedAt: opts.exportedAt,
    counts: { folders: folderRows.length, pages: pageRows.length, blocks: blockRows.length, blobs: blobOut.size },
    pages: [...pagePaths].sort(),
    blobs: manifestBlobs,
  };
  files.set('manifest.json', canonicalJson(manifest));

  return { files, blobs: blobOut };
}
```

- [ ] **Step 5: Run tests**

```powershell
bun test apps/server/test/export-import.test.ts; bun test apps/server/test
```

Expected: new tests PASS, full server suite still green (helpers change is additive).

- [ ] **Step 6: Commit**

```powershell
git add -A; git commit -m "feat(export): deterministic bundle builder"
```

---

### Task 6: Format migration pipeline

**Files:**
- Create: `apps/server/src/export/migrate-format.ts`
- Test: `apps/server/test/export-format.test.ts` (append)

- [ ] **Step 1: Write failing tests** (append; synthetic v1↔v2 pair — production registry stays empty):

```ts
import { downgradeToVersion, upgradeToVersion, type FormatTransform, type JsonFiles } from '../src/export/migrate-format';

/** Synthetic v2: renames page field title→heading and adds subtitle. */
const SYNTHETIC: FormatTransform[] = [
  {
    to: 2,
    up(files) {
      const next: JsonFiles = new Map(files);
      for (const [path, value] of files) {
        if (!path.endsWith('.page.json')) continue;
        const { title, ...rest } = value as { title: string };
        next.set(path, { heading: title, subtitle: '', ...rest });
      }
      return next;
    },
    down(files) {
      const next: JsonFiles = new Map(files);
      const losses: string[] = [];
      for (const [path, value] of files) {
        if (!path.endsWith('.page.json')) continue;
        const { heading, subtitle, ...rest } = value as { heading: string; subtitle: string };
        if (subtitle !== '') losses.push(`${path}: subtitle "${subtitle}" dropped (v1 cannot express it)`);
        next.set(path, { title: heading, ...rest });
      }
      return { files: next, losses };
    },
  },
];

function v1Files(): JsonFiles {
  return new Map<string, unknown>([
    ['manifest.json', { formatVersion: 1 }],
    ['tree/a.page.json', { title: 'A', blocks: [] }],
  ]);
}

describe('format migration pipeline', () => {
  test('upgrade applies transforms in order and stamps version', () => {
    const out = upgradeToVersion(v1Files(), 2, SYNTHETIC);
    expect((out.get('manifest.json') as { formatVersion: number }).formatVersion).toBe(2);
    expect(out.get('tree/a.page.json')).toEqual({ heading: 'A', subtitle: '', blocks: [] });
  });

  test('upgrade to current version is a no-op', () => {
    const files = v1Files();
    expect(upgradeToVersion(files, 1, SYNTHETIC)).toBe(files);
  });

  test('downgrade reverses and reports losses explicitly', () => {
    const v2 = upgradeToVersion(v1Files(), 2, SYNTHETIC);
    (v2.get('tree/a.page.json') as { subtitle: string }).subtitle = 'extra';
    const { files, losses } = downgradeToVersion(v2, 1, SYNTHETIC);
    expect((files.get('manifest.json') as { formatVersion: number }).formatVersion).toBe(1);
    expect(files.get('tree/a.page.json')).toEqual({ title: 'A', blocks: [] });
    expect(losses).toEqual(['tree/a.page.json: subtitle "extra" dropped (v1 cannot express it)']);
  });

  test('missing transform step throws', () => {
    expect(() => upgradeToVersion(v1Files(), 3, SYNTHETIC)).toThrow('no upgrade path');
    expect(() => downgradeToVersion(new Map([['manifest.json', { formatVersion: 3 }]]), 1, SYNTHETIC)).toThrow(
      'no downgrade path',
    );
  });

  test('lossless round trip: up then down restores the original', () => {
    const original = v1Files();
    const { files, losses } = downgradeToVersion(upgradeToVersion(original, 2, SYNTHETIC), 1, SYNTHETIC);
    expect(losses).toEqual([]);
    expect(files.get('tree/a.page.json')).toEqual(original.get('tree/a.page.json'));
  });
});
```

- [ ] **Step 2: Run to verify failure** — module not found.

- [ ] **Step 3: Implement** — create `apps/server/src/export/migrate-format.ts`:

```ts
/**
 * Export-format migration pipeline [ADR-0023]. Mirrors ADR-0020's
 * shape (ordered versioned steps, applied sequentially) but is pure
 * JSON→JSON and stateless — the version lives in manifest.formatVersion.
 *
 * Discipline (owner-ratified 2026-06-12): every format change MUST
 * register exactly one up/down pair; down() MUST list every piece of
 * data it drops (no silent loss). Downgrade runs on the EXPORT side —
 * an old build cannot know a newer format.
 */
export type JsonFiles = Map<string, unknown>; // path → parsed JSON (manifest included; blobs untouched)

export type FormatTransform = {
  /** up() takes files at version `to - 1`, returns files at `to`. */
  to: number;
  up(files: JsonFiles): JsonFiles;
  /** Reverses up(); losses lists every dropped piece of data. */
  down(files: JsonFiles): { files: JsonFiles; losses: string[] };
};

/** Production registry — empty while only format v1 exists. */
export const FORMAT_TRANSFORMS: FormatTransform[] = [];

function versionOf(files: JsonFiles): number {
  const manifest = files.get('manifest.json') as { formatVersion?: unknown } | undefined;
  if (manifest === undefined || typeof manifest.formatVersion !== 'number') {
    throw new Error('manifest.json missing or has no numeric formatVersion');
  }
  return manifest.formatVersion;
}

function withVersion(files: JsonFiles, v: number): JsonFiles {
  const next = new Map(files);
  next.set('manifest.json', { ...(files.get('manifest.json') as object), formatVersion: v });
  return next;
}

export function upgradeToVersion(files: JsonFiles, target: number, transforms = FORMAT_TRANSFORMS): JsonFiles {
  let v = versionOf(files);
  if (v === target) return files;
  let cur = files;
  while (v < target) {
    const t = transforms.find((x) => x.to === v + 1);
    if (!t) throw new Error(`no upgrade path from format v${v} to v${v + 1}`);
    cur = withVersion(t.up(cur), v + 1);
    v++;
  }
  return cur;
}

export function downgradeToVersion(
  files: JsonFiles,
  target: number,
  transforms = FORMAT_TRANSFORMS,
): { files: JsonFiles; losses: string[] } {
  let v = versionOf(files);
  let cur = files;
  const losses: string[] = [];
  while (v > target) {
    const t = transforms.find((x) => x.to === v);
    if (!t) throw new Error(`no downgrade path from format v${v} to v${v - 1}`);
    const r = t.down(cur);
    losses.push(...r.losses);
    cur = withVersion(r.files, v - 1);
    v--;
  }
  return { files: cur, losses };
}
```

- [ ] **Step 4: Run tests** — expected PASS.

- [ ] **Step 5: Commit**

```powershell
git add -A; git commit -m "feat(export): bidirectional format migration pipeline (registry empty at v1)"
```

---

### Task 7: Importer

**Files:**
- Create: `apps/server/src/export/importer.ts`
- Test: `apps/server/test/export-import.test.ts` (append)

- [ ] **Step 1: Write failing tests** (append):

```ts
import { importBundle } from '../src/export/importer';

async function freshContext() {
  return createTestContext();
}

describe('importBundle', () => {
  test('round trip: export → import into empty instance → identical re-export', async () => {
    const src = await freshContext();
    await seedInstance(src, src.blobStore);
    const bundle = buildExport(src.db, src.blobStore, OPTS);

    const dst = await freshContext();
    const result = importBundle(dst.db, dst.blobStore, bundle);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.counts).toEqual({ folders: 1, pages: 2, blocks: 2, blobs: 1 });

    const again = buildExport(dst.db, dst.blobStore, OPTS);
    expect([...again.files.keys()].sort()).toEqual([...bundle.files.keys()].sort());
    for (const [p, text] of bundle.files) {
      expect(again.files.get(p)).toBe(text); // OPTS pins exportedAt → fully byte-identical
    }
    expect([...again.blobs.keys()]).toEqual([...bundle.blobs.keys()]);

    // published page is live again, HTML re-rendered
    const html = await dst.app.request('http://localhost/notes/page-one');
    expect(html.status).toBe(200);
    expect(await html.text()).toContain('Page One');
  });

  test('rejects non-empty instance', async () => {
    const src = await freshContext();
    await seedInstance(src, src.blobStore);
    const bundle = buildExport(src.db, src.blobStore, OPTS);
    const result = importBundle(src.db, src.blobStore, bundle);
    expect(result).toEqual({ ok: false, status: 409, error: 'instance is not empty', details: undefined });
  });

  test('rejects newer format with downgrade hint', async () => {
    const src = await freshContext();
    const bundle = buildExport(src.db, src.blobStore, OPTS);
    const manifest = JSON.parse(bundle.files.get('manifest.json')!);
    bundle.files.set('manifest.json', JSON.stringify({ ...manifest, formatVersion: 99 }));
    const dst = await freshContext();
    const result = importBundle(dst.db, dst.blobStore, bundle);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toContain('newer than this build');
      expect(result.error).toContain('downgrade');
    }
  });

  test('atomic: one invalid page → nothing lands', async () => {
    const src = await freshContext();
    await seedInstance(src, src.blobStore);
    const bundle = buildExport(src.db, src.blobStore, OPTS);
    const path = 'tree/page-two.page.json';
    const page = JSON.parse(bundle.files.get(path)!);
    page.blocks = [{ id: 'bad', kind: 'markdown', col: 10, row: 0, colSpan: 6, rowSpan: 1, content: {} }]; // exceeds 12 cols
    bundle.files.set(path, JSON.stringify(page));

    const dst = await freshContext();
    const result = importBundle(dst.db, dst.blobStore, bundle);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.details?.some((d) => d.includes(path))).toBe(true);
    }
    const tree = await json(await dst.authed('/api/tree'));
    expect(tree.folders).toEqual([]);
    expect(tree.notepages).toEqual([]);
  });

  test('blob hash mismatch is rejected before anything lands', async () => {
    const src = await freshContext();
    const seeded = await seedInstance(src, src.blobStore);
    const bundle = buildExport(src.db, src.blobStore, OPTS);
    bundle.blobs.set(seeded.hash, new TextEncoder().encode('tampered'));
    const dst = await freshContext();
    const result = importBundle(dst.db, dst.blobStore, bundle);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('hash mismatch');
    const tree = await json(await dst.authed('/api/tree'));
    expect(tree.notepages).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — importer module not found.

- [ ] **Step 3: Implement** — create `apps/server/src/export/importer.ts`:

```ts
/**
 * Full-restore importer [ADR-0023]: empty instance only, atomic (the
 * DB transaction is all-or-nothing; blob files are content-addressed
 * and idempotent, so pre-transaction blob writes are harmless — GC
 * sweeps orphans if the transaction fails). publishedHtml is re-
 * rendered here, never read from the bundle.
 */
import { createHash } from 'node:crypto';
import { TOTAL_COLS, validateState } from '@skb/grid-engine';
import type { BlobStore } from '../blobstore';
import type { Db } from '../db/client';
import { blobs, blocks, folders, notepages, type PublishedDoc } from '../db/schema';
import { renderPublishedHtml } from '../render/publish-html';
import { FORMAT_VERSION, type ExportManifest, type ExportPage } from './format';
import { upgradeToVersion, type JsonFiles } from './migrate-format';

export type ImportInput = {
  files: Map<string, string>; // path → JSON text
  blobs: Map<string, Uint8Array>; // hash → bytes
};

export type ImportResult =
  | { ok: true; counts: { folders: number; pages: number; blocks: number; blobs: number } }
  | { ok: false; status: number; error: string; details?: string[] };

function fail(status: number, error: string, details?: string[]): ImportResult {
  return { ok: false, status, error, details };
}

function parsePage(path: string, value: unknown, errors: string[]): ExportPage | null {
  const e = (msg: string) => {
    errors.push(`${path}: ${msg}`);
    return null;
  };
  if (typeof value !== 'object' || value === null) return e('not an object');
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string' || p.id === '') return e('missing id');
  if (typeof p.slug !== 'string' || p.slug === '') return e('missing slug');
  if (typeof p.title !== 'string') return e('missing title');
  if (p.visibility !== 'private' && p.visibility !== 'public') return e('visibility must be private|public');
  if (typeof p.gravityEnabled !== 'boolean') return e('missing gravityEnabled');
  if (typeof p.sortKey !== 'number') return e('missing sortKey');
  if (typeof p.createdAt !== 'number' || typeof p.updatedAt !== 'number') return e('missing timestamps');
  if (p.published !== null) {
    const d = p.published as Record<string, unknown> | null;
    if (typeof d !== 'object' || d === null || typeof d.title !== 'string' || !Array.isArray(d.blocks) || typeof d.publishedAt !== 'number') {
      return e('malformed published snapshot');
    }
  }
  if (!Array.isArray(p.blocks)) return e('missing blocks array');
  for (const raw of p.blocks) {
    const b = raw as Record<string, unknown>;
    if (
      typeof b !== 'object' || b === null ||
      typeof b.id !== 'string' || typeof b.kind !== 'string' ||
      typeof b.col !== 'number' || typeof b.row !== 'number' ||
      typeof b.colSpan !== 'number' || typeof b.rowSpan !== 'number' ||
      !('content' in b)
    ) {
      return e('malformed block');
    }
  }
  return value as ExportPage;
}

export function importBundle(db: Db, blobStore: BlobStore, input: ImportInput): ImportResult {
  // gate 1: empty instance (auth/users untouched by design — not part of the bundle)
  const havePages = db.select({ id: notepages.id }).from(notepages).limit(1).all();
  const haveFolders = db.select({ id: folders.id }).from(folders).limit(1).all();
  if (havePages.length > 0 || haveFolders.length > 0) return fail(409, 'instance is not empty');

  // gate 2: manifest + format version
  const manifestText = input.files.get('manifest.json');
  if (manifestText === undefined) return fail(400, 'manifest.json missing');
  let parsed: JsonFiles;
  try {
    parsed = new Map([...input.files].map(([p, text]) => [p, JSON.parse(text) as unknown]));
  } catch (err) {
    return fail(400, `bundle contains invalid JSON: ${(err as Error).message}`);
  }
  const rawVersion = (parsed.get('manifest.json') as { formatVersion?: unknown }).formatVersion;
  if (typeof rawVersion !== 'number') return fail(400, 'manifest.json has no numeric formatVersion');
  if (rawVersion > FORMAT_VERSION) {
    return fail(
      409,
      `export format v${rawVersion} is newer than this build (supports ≤ v${FORMAT_VERSION}); ` +
        'use export-side downgrade on the newer instance instead',
    );
  }
  let files: JsonFiles;
  try {
    files = upgradeToVersion(parsed, FORMAT_VERSION);
  } catch (err) {
    return fail(422, `format migration failed: ${(err as Error).message}`);
  }
  const manifest = files.get('manifest.json') as ExportManifest;

  // gate 3: structural + per-page validation (everything before any write)
  const errors: string[] = [];
  type FolderEntry = { id: string; name: string; sortKey: number; createdAt: number; parentDir: string };
  const foldersByDir = new Map<string, FolderEntry>(); // dir path under tree/ → meta
  const pages: Array<{ path: string; page: ExportPage; dir: string }> = [];

  for (const [path, value] of files) {
    if (path === 'manifest.json') continue;
    if (!path.startsWith('tree/')) {
      errors.push(`${path}: unexpected file outside tree/`);
      continue;
    }
    const rel = path.slice('tree/'.length);
    if (path.endsWith('/folder.json')) {
      const dir = rel.slice(0, -'/folder.json'.length);
      const m = value as Record<string, unknown>;
      if (typeof m.id !== 'string' || typeof m.name !== 'string' || typeof m.sortKey !== 'number' || typeof m.createdAt !== 'number') {
        errors.push(`${path}: malformed folder.json`);
        continue;
      }
      const parentDir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
      foldersByDir.set(dir, { id: m.id, name: m.name, sortKey: m.sortKey, createdAt: m.createdAt, parentDir });
    } else if (path.endsWith('.page.json')) {
      const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
      const page = parsePage(path, value, errors);
      if (page) pages.push({ path, page, dir });
    } else {
      errors.push(`${path}: unrecognized file`);
    }
  }
  for (const [dir, f] of foldersByDir) {
    if (f.parentDir !== '' && !foldersByDir.has(f.parentDir)) {
      errors.push(`tree/${dir}/folder.json: parent directory has no folder.json`);
    }
  }
  const slugs = new Set<string>();
  const ids = new Set<string>();
  for (const { path, page } of pages) {
    if (slugs.has(page.slug)) errors.push(`${path}: duplicate slug "${page.slug}"`);
    if (ids.has(page.id)) errors.push(`${path}: duplicate page id "${page.id}"`);
    slugs.add(page.slug);
    ids.add(page.id);
    const v = validateState(
      { totalCols: TOTAL_COLS, blocks: page.blocks.map(({ content: _c, ...geom }) => geom) },
      { gravity: page.gravityEnabled },
    );
    if (!v.ok) errors.push(`${path}: layout invariant violation — ${v.errors.join('; ')}`);
  }
  for (const { dir } of pages) {
    if (dir !== '' && !foldersByDir.has(dir)) errors.push(`tree/${dir}: pages present but folder.json missing`);
  }
  // blob integrity: every manifest blob must arrive with matching content
  for (const m of manifest.blobs) {
    const bytes = input.blobs.get(m.hash);
    if (bytes === undefined) {
      errors.push(`blobs/${m.hash}: listed in manifest but missing from bundle`);
      continue;
    }
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== m.hash) errors.push(`blobs/${m.hash}: hash mismatch (content hashes to ${actual})`);
  }
  if (errors.length > 0) return fail(422, 'bundle validation failed', errors);

  // writes: blobs first (content-addressed + idempotent; orphans on a
  // later transaction failure are reclaimed by GC), then one DB txn.
  for (const m of manifest.blobs) blobStore.save(input.blobs.get(m.hash)!);

  const sortedFolderDirs = [...foldersByDir.keys()].sort((a, b) => a.split('/').length - b.split('/').length);
  db.transaction((tx) => {
    for (const m of manifest.blobs) {
      tx.insert(blobs)
        .values({ hash: m.hash, mimeType: m.mimeType, size: m.size, createdAt: new Date(m.createdAt) })
        .onConflictDoNothing()
        .run();
    }
    for (const dir of sortedFolderDirs) {
      const f = foldersByDir.get(dir)!;
      const parent = f.parentDir === '' ? null : foldersByDir.get(f.parentDir)!.id;
      tx.insert(folders)
        .values({ id: f.id, name: f.name, parentId: parent, sortKey: f.sortKey, createdAt: new Date(f.createdAt) })
        .run();
    }
    for (const { page, dir } of pages) {
      const folderId = dir === '' ? null : foldersByDir.get(dir)!.id;
      const published = page.published as PublishedDoc | null;
      tx.insert(notepages)
        .values({
          id: page.id,
          slug: page.slug,
          title: page.title,
          visibility: page.visibility,
          gravityEnabled: page.gravityEnabled,
          folderId,
          sortKey: page.sortKey,
          publishedDoc: published === null ? null : JSON.stringify(published),
          publishedHtml: published === null ? null : renderPublishedHtml(published, page.slug),
          createdAt: new Date(page.createdAt),
          updatedAt: new Date(page.updatedAt),
        })
        .run();
      for (const b of page.blocks) {
        tx.insert(blocks)
          .values({
            id: b.id,
            notepageId: page.id,
            kind: b.kind,
            col: b.col,
            row: b.row,
            colSpan: b.colSpan,
            rowSpan: b.rowSpan,
            content: JSON.stringify(b.content ?? null),
          })
          .run();
      }
    }
  });

  return {
    ok: true,
    counts: {
      folders: foldersByDir.size,
      pages: pages.length,
      blocks: pages.reduce((n, p) => n + p.page.blocks.length, 0),
      blobs: manifest.blobs.length,
    },
  };
}
```

- [ ] **Step 4: Run tests**

```powershell
bun test apps/server/test/export-import.test.ts
```

Expected: PASS. If the round-trip equality fails, diff the two texts — the usual culprits are key order (must match `ExportPage` declaration order) and `Date` vs epoch-ms conversion.

- [ ] **Step 5: Commit**

```powershell
git add -A; git commit -m "feat(import): atomic full-restore importer with format upgrade + validation gates"
```

---

### Task 8: Admin routes (export zip / import zip / blob GC) + wiring

**Files:**
- Create: `apps/server/src/routes/admin.ts`
- Modify: `apps/server/src/app.ts`
- Test: `apps/server/test/export-import.test.ts` (append)

- [ ] **Step 1: Write failing tests** (append):

```ts
import { unzipSync, zipSync, strFromU8 } from 'fflate';
import { createAuth } from '../src/auth';
import { TEST_SECRET } from './helpers';

describe('admin routes', () => {
  test('export → import over HTTP round trip; GC reclaims unreferenced blob', async () => {
    const src = await freshContext();
    const seeded = await seedInstance(src, src.blobStore);
    // an orphan blob: uploaded but referenced by nothing
    const orphanUp = await src.authed('/api/blobs', {
      method: 'POST',
      body: new TextEncoder().encode('orphan-bytes'),
      headers: { 'content-type': 'image/png' },
    });
    const orphan = (await json(orphanUp)).hash as string;

    const exportRes = await src.authed('/api/admin/export');
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-type')).toBe('application/zip');
    const zipBytes = new Uint8Array(await exportRes.arrayBuffer());
    const entries = unzipSync(zipBytes);
    expect(Object.keys(entries)).toContain('manifest.json');
    expect(Object.keys(entries)).toContain(`blobs/${seeded.hash}`);
    expect(Object.keys(entries)).not.toContain(`blobs/${orphan}`); // unreferenced → not exported

    const dst = await freshContext();
    const importRes = await dst.authed('/api/admin/import', {
      method: 'POST',
      body: zipBytes,
      headers: { 'content-type': 'application/zip' },
    });
    expect(importRes.status).toBe(200);
    expect((await json(importRes)).counts.pages).toBe(2);
    const page = await dst.app.request('http://localhost/notes/page-one');
    expect(page.status).toBe(200);

    // GC on source removes the orphan, keeps the referenced blob
    const gc = await src.authed('/api/admin/blobs/gc', { method: 'POST' });
    const gcBody = await json(gc);
    expect(gcBody.deleted).toBe(1);
    expect(src.blobStore.read(orphan)).toBeNull();
    expect(src.blobStore.read(seeded.hash)).not.toBeNull();
  });

  test('unsupported ?format is rejected with a clear error', async () => {
    const ctx = await freshContext();
    const res = await ctx.authed('/api/admin/export?format=0');
    expect(res.status).toBe(400);
    expect((await json(res)).error).toContain('format v1 only');
  });

  test('import into non-empty instance → 409; garbage body → 400', async () => {
    const ctx = await freshContext();
    await seedInstance(ctx, ctx.blobStore);
    const selfZip = new Uint8Array(await (await ctx.authed('/api/admin/export')).arrayBuffer());
    const res409 = await ctx.authed('/api/admin/import', { method: 'POST', body: selfZip });
    expect(res409.status).toBe(409);
    const dst = await freshContext();
    const res400 = await dst.authed('/api/admin/import', { method: 'POST', body: new Uint8Array([1, 2, 3]) });
    expect(res400.status).toBe(400);
  });

  test('admin gate: anonymous 401, author role 403', async () => {
    const ctx = await freshContext();
    const anon = await ctx.app.request('http://localhost/api/admin/export');
    expect(anon.status).toBe(401);

    // create an author-role user via a transient signup-enabled auth
    // instance on the same db (the bootstrap.ts trick)
    const signup = createAuth(ctx.db, { secret: TEST_SECRET, baseURL: 'http://localhost', allowSignUp: true });
    await signup.api.signUpEmail({ body: { email: 'author@local.test', password: 'author-pass-1', name: 'Author' } });
    const signIn = await ctx.app.request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email: 'author@local.test', password: 'author-pass-1' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.get('set-cookie')!
      .split(/,(?=\s*[^\s;=]+=)/)
      .map((c) => c.split(';')[0]!.trim())
      .join('; ');
    const asAuthor = await ctx.app.request('http://localhost/api/admin/export', { headers: { cookie } });
    expect(asAuthor.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify failure** — 404s (routes not mounted).

- [ ] **Step 3: Implement routes** — create `apps/server/src/routes/admin.ts`:

```ts
/**
 * Admin-only surface (MVP-3): logical export/import + blob GC. The
 * role gate lives here (PEP authenticates; this is the first
 * role-differentiated authorization point).
 */
import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { eq } from 'drizzle-orm';
import type { BlobStore } from '../blobstore';
import type { Db } from '../db/client';
import { blobs } from '../db/schema';
import { referencedBlobHashes } from '../export/blob-refs';
import { buildExport } from '../export/exporter';
import { FORMAT_VERSION } from '../export/format';
import { importBundle, type ImportInput } from '../export/importer';

const requireAdmin: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') return c.json({ error: 'admin role required' }, 403);
  await next();
};

export function adminRoutes(db: Db, blobStore: BlobStore, meta: { version: string; schemaVersion: number }) {
  const r = new Hono();
  r.use('/admin/*', requireAdmin);

  r.get('/admin/export', (c) => {
    const format = c.req.query('format');
    if (format !== undefined && Number(format) !== FORMAT_VERSION) {
      return c.json(
        { error: `this build exports format v${FORMAT_VERSION} only; export-side downgrade arrives with format v2 [ADR-0023]` },
        400,
      );
    }
    const bundle = buildExport(db, blobStore, {
      appVersion: meta.version,
      schemaVersion: meta.schemaVersion,
      exportedAt: Date.now(),
    });
    // fixed mtime: zip bytes stay deterministic modulo manifest.exportedAt
    const entries: Zippable = {};
    for (const [path, text] of bundle.files) entries[path] = [strToU8(text), { mtime: new Date(0) }];
    for (const [hash, bytes] of bundle.blobs) entries[`blobs/${hash}`] = [bytes, { mtime: new Date(0) }];
    return c.body(zipSync(entries), 200, {
      'content-type': 'application/zip',
      'content-disposition': 'attachment; filename="shckb-export.zip"',
    });
  });

  r.post('/admin/import', async (c) => {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(new Uint8Array(await c.req.arrayBuffer()));
    } catch {
      return c.json({ error: 'body is not a valid zip archive' }, 400);
    }
    const input: ImportInput = { files: new Map(), blobs: new Map() };
    for (const [path, bytes] of Object.entries(entries)) {
      if (path.endsWith('/')) continue; // directory entries
      if (path.startsWith('blobs/')) input.blobs.set(path.slice('blobs/'.length), bytes);
      else input.files.set(path, strFromU8(bytes));
    }
    const result = importBundle(db, blobStore, input);
    if (!result.ok) return c.json({ error: result.error, details: result.details }, result.status as 400 | 409 | 422);
    return c.json({ ok: true, counts: result.counts });
  });

  r.post('/admin/blobs/gc', (c) => {
    const referenced = referencedBlobHashes(db);
    let deleted = 0;
    let freedBytes = 0;
    for (const row of db.select().from(blobs).all()) {
      if (referenced.has(row.hash)) continue;
      db.delete(blobs).where(eq(blobs.hash, row.hash)).run();
      blobStore.delete(row.hash);
      deleted++;
      freedBytes += row.size;
    }
    // orphan files with no table row (e.g. failed import leftovers)
    const registered = new Set(db.select({ hash: blobs.hash }).from(blobs).all().map((b) => b.hash));
    for (const hash of blobStore.list()) {
      if (registered.has(hash) || referenced.has(hash)) continue;
      blobStore.delete(hash);
      deleted++;
    }
    return c.json({ deleted, freedBytes });
  });

  return r;
}
```

- [ ] **Step 4: Mount in app** — in `apps/server/src/app.ts` add import and mount after `treeRoutes`:

```ts
import { adminRoutes } from './routes/admin';
// …
  app.route('/api', adminRoutes(db, blobStore, meta));
```

- [ ] **Step 5: Run tests**

```powershell
bun test apps/server/test
```

Expected: all server tests PASS (including the 401 case — PEP already rejects anonymous non-allowlisted /api paths before the role gate runs).

- [ ] **Step 6: Commit**

```powershell
git add -A; git commit -m "feat(admin): export/import zip endpoints + blob gc behind admin role gate"
```

---

### Task 9: Web export entry (admin only)

**Files:**
- Modify: `apps/web/src/shell/Sidebar.tsx`

- [ ] **Step 1: Add Export button** — in `Sidebar.tsx`, inside the existing `{me && (…)}` block holding the `+ Page` / `+ Folder` row, render an extra row below it for admins only:

```tsx
      {me && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => void createPage(null)} style={{ ...newButton(), flex: 1 }}>
              + Page
            </button>
            <button onClick={() => void createFolder(null)} style={{ ...newButton(), flex: 1 }}>
              + Folder
            </button>
          </div>
          {me.role === 'admin' && (
            <a
              href="/api/admin/export"
              download="shckb-export.zip"
              title="Download a full logical export (git-friendly zip)"
              style={{ ...sideButton(), textAlign: 'center', textDecoration: 'none', border: `1px dashed ${theme.mutedColor}`, borderRadius: '6px' }}
            >
              ⤓ Export
            </a>
          )}
        </div>
      )}
```

(Plain anchor: session cookie rides along; the vite dev proxy already forwards `/api`. No import UI — import is an operator action on an empty instance, documented in the runbook.)

- [ ] **Step 2: Typecheck + web tests**

```powershell
bun run --filter '@skb/shckb-web' typecheck; bun run --filter '@skb/shckb-web' test
```

Expected: clean. (If the workspace filter syntax differs, run `bun run typecheck` inside `apps/web`.)

- [ ] **Step 3: Manual verification (dev servers are running)** — sign in at `http://localhost:5173`, click Export, confirm a zip downloads and contains `manifest.json`.

- [ ] **Step 4: Commit**

```powershell
git add -A; git commit -m "feat(web): admin export entry in sidebar"
```

---

### Task 10: Documentation — ADR-0023, runbook, AUDIT, build log

**Files:**
- Create: `docs/engineering/decisions/ADR-0023-export-import-format.md`
- Modify: `docs/engineering/decisions/README.md` (index row)
- Modify: `docs/engineering/runbooks/self-host-upgrade.md`
- Modify: `docs/engineering/decisions/AUDIT-2026-05.md`
- Modify: `docs/engineering/design/discussions/mvp3-scope-2026-06-12.md` (build log)

- [ ] **Step 1: Write ADR-0023** — follow the structure of ADR-0020/0022 (Status: accepted; PRD-informed; cite `[setup-time.md]` and the MVP-3 spec). Body must record, in this order:
  1. Canonical format v1 layout + the determinism invariant (timestamp confined to `manifest.exportedAt`)
  2. Format-migration discipline: paired up/down transforms, lossy-down must enumerate losses, downgrade-on-export (with the "old build cannot know a newer format" argument), explicit non-conflict with ADR-0020 (danger was in-place mutation, not downgrade)
  3. The new content contract: **block kinds reference blobs by verbatim lowercase-hex sha256 in content JSON** — this is what makes kind-opaque blob enumeration sound; GC errs conservative (false positives keep blobs alive)
  4. Import gates: empty instance only; newer-format refusal mirrors the DB downgrade guard; atomicity via single transaction; blob writes idempotent-before-transaction with GC as orphan sweeper
  5. Alternatives rejected: per-kind blob manifests (breaks kind-opacity), tar/no-archive (zip chosen for operator familiarity + single-request HTTP), incremental import (CRDT/git boundary, owner-ratified out)

- [ ] **Step 2: Add index row** in `docs/engineering/decisions/README.md` mirroring existing rows: `ADR-0023 | Export/import canonical format & format migration | accepted (2026-06-12)`.

- [ ] **Step 3: Extend runbook** — append to `self-host-upgrade.md`:

```markdown
## Logical export / import (MVP-3)

卷备份（上节）是物理备份；`/api/admin/export` 是**逻辑备份**：git 友好的 zip
（canonical JSON 树 + content-addressed blobs，[ADR-0023]）。两者互补——卷备份
快且全（含 users），逻辑导出可读、可 diff、可跨实例迁移（不含 users/auth）。

- **Export**：登录 admin 后侧栏 ⤓ Export，或 `curl -b <cookie> -o export.zip http://<host>:8080/api/admin/export`
- **Import（仅空实例）**：新实例完成 first-admin bootstrap 后：
  `curl -b <cookie> -X POST --data-binary @export.zip http://<host>:8080/api/admin/import`
  实例已有任何 notepage/folder 时返回 409。导入是原子的：任一项校验失败则什么都不写入。
- **保数据的版本降级路径**：新版本实例 export →（未来：导出端降级格式）→ 旧版本空实例 import。
  比"恢复备份"多保住备份之后产生的数据。格式版本高于实例支持时 import 明确拒绝（同 DB 降级护栏语义）。
- **Blob GC**：`curl -b <cookie> -X POST http://<host>:8080/api/admin/blobs/gc` —
  删除未被任何 block/已发布快照引用的 blob，返回 `{deleted, freedBytes}`。
```

Also add `[ADR-0023]` to the runbook References list.

- [ ] **Step 4: AUDIT register** — in `AUDIT-2026-05.md`, find the blob-GC debt row (registered with ADR-0022) and mark it repaid: `→ repaid 2026-06-12 by [ADR-0023] blob GC (shared reference enumeration)`.

- [ ] **Step 5: Build log** — append dated entries to `mvp3-scope-2026-06-12.md` summarizing Tasks 2–9 outcomes (one line each, mirroring the MVP-2 build-log style).

- [ ] **Step 6: Commit**

```powershell
git add -A; git commit -m "docs(mvp3): ADR-0023 export/import format + runbook and audit updates"
```

---

### Task 11: Full verification + merge readiness

- [ ] **Step 1: Full test suites**

```powershell
bun test apps/server/test
bun run --filter '@skb/grid-engine' test
bun run --filter '@skb/shckb-web' test
bun run --filter '*' typecheck
```

Expected: engine 44, server 45 + new (≈60), web 5 — all green; typecheck clean.

- [ ] **Step 2: Container round-trip verification** (the MVP-2 pattern — real artifact, real volumes):
  1. `docker compose -f compose.dev.yaml up -d --build` (fresh volume) → login → create folder + 2 pages (one with an image block) → publish one → Export via UI.
  2. Tear down, `docker volume rm` the data volume, bring up a fresh instance → first-admin bootstrap → import the zip via curl → verify: sidebar tree identical, `/notes/<slug>` serves HTML, image renders.
  3. Record results in the build log.

- [ ] **Step 3: Playwright smoke on dev servers** — use a dedicated test page (lesson from MVP-2: never leave synthetic artifacts on the owner's pages); delete it afterwards.

- [ ] **Step 4: Final commit + report to owner** — do NOT merge or push; owner decides (established convention).

---

## Self-review notes

- Spec §2 determinism → exporter pinned iteration orders + Task 5 determinism test. Spec §3 pipeline rules → Task 6 (synthetic pair incl. loss reporting + missing-path throws). Spec §5 gates/atomicity → Task 7 tests (non-empty 409, newer-format 409 with hint, invalid page 422 + empty DB, hash mismatch). Spec §6 GC → Task 8 (orphan deleted, referenced kept, orphan *files* swept). Spec §7 round-trip → Tasks 7 (in-process) + 8 (over HTTP) + 11 (container). Spec §8 docs → Task 10.
- `?format` param exists and rejects non-current (spec §4) — Task 8 test 2.
- Type names consistent across tasks: `ExportBundle`/`ImportInput` (files+blobs maps), `JsonFiles`, `FormatTransform{to,up,down}`, `ExportPage`/`ExportFolderMeta`/`ExportManifest`.
- Known accepted residue: import re-render exercises the SSR/SPA dual-renderer drift debt (recorded, not solved here); blob `createdAt` round-trips via manifest.
