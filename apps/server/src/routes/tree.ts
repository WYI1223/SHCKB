/**
 * Workspace forest API (owner decision 2026-06-12; build-log 26).
 *
 * Author side (authenticated): full folders + pages, flat lists — the
 * client assembles the tree. Mutations enforce integrity at the API
 * layer (no DB-level FKs on the self-reference): folders must be empty
 * to delete, folder moves reject cycles, page moves validate targets.
 *
 * Public side (anonymous): a live read-time projection pruned to
 * public+published pages and their ancestor folders. Existence in this
 * tree is gated by explicit publish/visibility actions; position is
 * metadata (recorded deviation from strict two-state — content only).
 */
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Db } from '../db/client';
import { folders, notepages, type PublishedDoc } from '../db/schema';
import { safeParse } from '../json';

const NOT_FOUND = { error: 'not found' } as const;

function nextSortKey(rows: Array<{ sortKey: number }>): number {
  return rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.sortKey)) + 1;
}

/** Walk parent chain; true if `candidateAncestor` is reachable from `from`. */
function isAncestorOrSelf(
  byId: Map<string, { id: string; parentId: string | null }>,
  from: string,
  candidateAncestor: string,
): boolean {
  let cur: string | null = from;
  let guard = 0;
  while (cur !== null && guard++ < 10_000) {
    if (cur === candidateAncestor) return true;
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

export function treeRoutes(db: Db) {
  const r = new Hono();

  // ----- author forest -----

  r.get('/tree', (c) => {
    const fs = db.select().from(folders).all();
    const ps = db.select().from(notepages).all();
    return c.json({
      folders: fs
        .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId, sortKey: f.sortKey }))
        .sort((a, b) => a.sortKey - b.sortKey),
      notepages: ps
        .map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          visibility: p.visibility,
          hasPublished: p.publishedDoc !== null,
          folderId: p.folderId,
          sortKey: p.sortKey,
        }))
        .sort((a, b) => a.sortKey - b.sortKey),
    });
  });

  r.post('/folders', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { name?: unknown; parentId?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name === '') return c.json({ error: 'name required' }, 400);
    const parentId = typeof body.parentId === 'string' ? body.parentId : null;
    if (parentId !== null) {
      const parent = db.select().from(folders).where(eq(folders.id, parentId)).get();
      if (!parent) return c.json({ error: 'parent folder not found' }, 404);
    }
    const siblings = db.select({ sortKey: folders.sortKey }).from(folders).all();
    const id = nanoid();
    db.insert(folders)
      .values({ id, name, parentId, sortKey: nextSortKey(siblings), createdAt: new Date() })
      .run();
    return c.json({ id }, 201);
  });

  r.patch('/folders/:id', async (c) => {
    const folder = db.select().from(folders).where(eq(folders.id, c.req.param('id'))).get();
    if (!folder) return c.json(NOT_FOUND, 404);
    const body = (await c.req.json().catch(() => ({}))) as { name?: unknown; parentId?: unknown };

    const update: Partial<{ name: string; parentId: string | null }> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return c.json({ error: 'invalid name' }, 400);
      }
      update.name = body.name.trim();
    }
    if (body.parentId !== undefined) {
      const parentId = body.parentId === null ? null : typeof body.parentId === 'string' ? body.parentId : undefined;
      if (parentId === undefined) return c.json({ error: 'invalid parentId' }, 400);
      if (parentId !== null) {
        const all = new Map(db.select().from(folders).all().map((f) => [f.id, f]));
        if (!all.has(parentId)) return c.json({ error: 'parent folder not found' }, 404);
        // a folder may not move into itself or its own subtree
        if (isAncestorOrSelf(all, parentId, folder.id)) {
          return c.json({ error: 'cannot move a folder into its own subtree' }, 400);
        }
      }
      update.parentId = parentId;
    }
    if (Object.keys(update).length === 0) return c.json({ error: 'nothing to update' }, 400);
    db.update(folders).set(update).where(eq(folders.id, folder.id)).run();
    return c.json({ ok: true });
  });

  r.delete('/folders/:id', (c) => {
    const folder = db.select().from(folders).where(eq(folders.id, c.req.param('id'))).get();
    if (!folder) return c.json(NOT_FOUND, 404);
    const childFolder = db.select({ id: folders.id }).from(folders).where(eq(folders.parentId, folder.id)).get();
    const childPage = db.select({ id: notepages.id }).from(notepages).where(eq(notepages.folderId, folder.id)).get();
    if (childFolder || childPage) {
      return c.json({ error: 'folder is not empty' }, 409);
    }
    db.delete(folders).where(eq(folders.id, folder.id)).run();
    return c.json({ ok: true });
  });

  r.post('/notepages/:id/move', async (c) => {
    const page = db.select().from(notepages).where(eq(notepages.id, c.req.param('id'))).get();
    if (!page) return c.json(NOT_FOUND, 404);
    const body = (await c.req.json().catch(() => ({}))) as { folderId?: unknown };
    const folderId = body.folderId === null ? null : typeof body.folderId === 'string' ? body.folderId : undefined;
    if (folderId === undefined) return c.json({ error: 'folderId must be a folder id or null' }, 400);
    if (folderId !== null) {
      const target = db.select().from(folders).where(eq(folders.id, folderId)).get();
      if (!target) return c.json({ error: 'target folder not found' }, 404);
    }
    const siblings = db.select({ sortKey: notepages.sortKey }).from(notepages).all();
    db.update(notepages)
      .set({ folderId, sortKey: nextSortKey(siblings), updatedAt: new Date() })
      .where(eq(notepages.id, page.id))
      .run();
    return c.json({ ok: true });
  });

  // ----- public projection (anonymous) -----

  r.get('/public/tree', (c) => {
    const fs = db.select().from(folders).all();
    const ps = db.select().from(notepages).where(eq(notepages.visibility, 'public')).all();

    const publishedPages = ps
      .filter((p) => p.publishedDoc !== null)
      .map((p) => ({
        slug: p.slug,
        // corrupt snapshot: fall back to the working title rather than
        // dropping the page from the public tree (HTML route still serves it)
        title: safeParse<PublishedDoc | null>(p.publishedDoc!, null)?.title ?? p.title,
        folderId: p.folderId,
        sortKey: p.sortKey,
      }));

    // prune: keep only folders on an ancestor path of some published page
    const byId = new Map(fs.map((f) => [f.id, f]));
    const keep = new Set<string>();
    for (const p of publishedPages) {
      let cur = p.folderId;
      let guard = 0;
      while (cur !== null && guard++ < 10_000) {
        if (keep.has(cur)) break;
        keep.add(cur);
        cur = byId.get(cur)?.parentId ?? null;
      }
    }

    return c.json({
      folders: fs
        .filter((f) => keep.has(f.id))
        .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId, sortKey: f.sortKey }))
        .sort((a, b) => a.sortKey - b.sortKey),
      notepages: publishedPages.sort((a, b) => a.sortKey - b.sortKey),
    });
  });

  return r;
}
