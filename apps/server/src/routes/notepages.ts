/**
 * Notepage API per plan contract C3.
 *
 * Two-state model (mvp-scope D2): working state lives in notepages
 * fields + blocks rows; the public state is the publishedDoc snapshot,
 * written only by the explicit publish action. The public read route
 * answers 404 for private, unpublished, and missing pages with an
 * identical body (notepage.md no-leak rule).
 */
import { TOTAL_COLS, validateState, type GridState } from '@skb/grid-engine';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Db } from '../db/client';
import { blocks, notepages, type PublishedDoc } from '../db/schema';

type WorkingBlock = {
  id: string;
  kind: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  content: unknown;
};

type WorkingStateBody = {
  title: string;
  gravityEnabled: boolean;
  blocks: WorkingBlock[];
};

const NOT_FOUND = { error: 'not found' } as const;

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return base || 'note';
}

function uniqueSlug(db: Db, title: string): string {
  const base = slugify(title);
  let candidate = base;
  for (let n = 2; ; n++) {
    const hit = db.select({ id: notepages.id }).from(notepages).where(eq(notepages.slug, candidate)).get();
    if (!hit) return candidate;
    candidate = `${base}-${n}`;
  }
}

function parseWorkingState(body: unknown): WorkingStateBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.title !== 'string' || typeof b.gravityEnabled !== 'boolean' || !Array.isArray(b.blocks)) {
    return null;
  }
  const parsed: WorkingBlock[] = [];
  for (const raw of b.blocks) {
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (
      typeof r.id !== 'string' ||
      typeof r.kind !== 'string' ||
      typeof r.col !== 'number' ||
      typeof r.row !== 'number' ||
      typeof r.colSpan !== 'number' ||
      typeof r.rowSpan !== 'number' ||
      !('content' in r)
    ) {
      return null;
    }
    parsed.push({
      id: r.id,
      kind: r.kind,
      col: r.col,
      row: r.row,
      colSpan: r.colSpan,
      rowSpan: r.rowSpan,
      content: r.content,
    });
  }
  return { title: b.title, gravityEnabled: b.gravityEnabled, blocks: parsed };
}

function loadWorkingBlocks(db: Db, notepageId: string): WorkingBlock[] {
  return db
    .select()
    .from(blocks)
    .where(eq(blocks.notepageId, notepageId))
    .all()
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      col: row.col,
      row: row.row,
      colSpan: row.colSpan,
      rowSpan: row.rowSpan,
      content: JSON.parse(row.content) as unknown,
    }));
}

export function notepageRoutes(db: Db) {
  const r = new Hono();

  r.get('/notepages', (c) => {
    const rows = db.select().from(notepages).all();
    rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return c.json({
      notepages: rows.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        visibility: p.visibility,
        hasPublished: p.publishedDoc !== null,
        updatedAt: p.updatedAt.getTime(),
      })),
    });
  });

  r.post('/notepages', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { title?: unknown };
    const title = typeof body.title === 'string' && body.title.trim() !== '' ? body.title.trim() : 'Untitled';
    const id = nanoid();
    const now = new Date();
    const slug = uniqueSlug(db, title);
    db.insert(notepages)
      .values({ id, slug, title, visibility: 'private', gravityEnabled: true, createdAt: now, updatedAt: now })
      .run();
    return c.json({ id, slug }, 201);
  });

  r.get('/notepages/:id', (c) => {
    const page = db.select().from(notepages).where(eq(notepages.id, c.req.param('id'))).get();
    if (!page) return c.json(NOT_FOUND, 404);
    return c.json({
      page: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        visibility: page.visibility,
        gravityEnabled: page.gravityEnabled,
        hasPublished: page.publishedDoc !== null,
        updatedAt: page.updatedAt.getTime(),
      },
      blocks: loadWorkingBlocks(db, page.id),
    });
  });

  r.put('/notepages/:id/working-state', async (c) => {
    const page = db.select().from(notepages).where(eq(notepages.id, c.req.param('id'))).get();
    if (!page) return c.json(NOT_FOUND, 404);

    const body = parseWorkingState(await c.req.json().catch(() => null));
    if (!body) return c.json({ error: 'malformed working state' }, 400);

    // Server-side re-validation with the same engine the client ran
    // (notepage-editing algorithm contract: invalid mutation must not land).
    const state: GridState = {
      totalCols: TOTAL_COLS,
      blocks: body.blocks.map(({ content: _content, ...geom }) => geom),
    };
    const v = validateState(state, { gravity: body.gravityEnabled });
    if (!v.ok) return c.json({ error: 'layout invariant violation', details: v.errors }, 422);

    db.transaction((tx) => {
      tx.update(notepages)
        .set({ title: body.title, gravityEnabled: body.gravityEnabled, updatedAt: new Date() })
        .where(eq(notepages.id, page.id))
        .run();
      tx.delete(blocks).where(eq(blocks.notepageId, page.id)).run();
      for (const b of body.blocks) {
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
    });
    return c.json({ ok: true });
  });

  r.post('/notepages/:id/publish', (c) => {
    const page = db.select().from(notepages).where(eq(notepages.id, c.req.param('id'))).get();
    if (!page) return c.json(NOT_FOUND, 404);
    const doc: PublishedDoc = {
      title: page.title,
      gravityEnabled: page.gravityEnabled,
      blocks: loadWorkingBlocks(db, page.id),
      publishedAt: Date.now(),
    };
    db.update(notepages)
      .set({ publishedDoc: JSON.stringify(doc), updatedAt: new Date() })
      .where(eq(notepages.id, page.id))
      .run();
    return c.json({ publishedAt: doc.publishedAt });
  });

  r.post('/notepages/:id/visibility', async (c) => {
    const page = db.select().from(notepages).where(eq(notepages.id, c.req.param('id'))).get();
    if (!page) return c.json(NOT_FOUND, 404);
    const body = (await c.req.json().catch(() => ({}))) as { visibility?: unknown };
    if (body.visibility !== 'private' && body.visibility !== 'public') {
      return c.json({ error: 'visibility must be private|public' }, 400);
    }
    db.update(notepages)
      .set({ visibility: body.visibility, updatedAt: new Date() })
      .where(eq(notepages.id, page.id))
      .run();
    return c.json({ ok: true });
  });

  r.delete('/notepages/:id', (c) => {
    const page = db.select().from(notepages).where(eq(notepages.id, c.req.param('id'))).get();
    if (!page) return c.json(NOT_FOUND, 404);
    db.delete(notepages).where(eq(notepages.id, page.id)).run();
    return c.json({ ok: true });
  });

  // Public read route — anonymous principal; no-leak 404 semantics.
  r.get('/public/notes/:slug', (c) => {
    const page = db.select().from(notepages).where(eq(notepages.slug, c.req.param('slug'))).get();
    if (!page || page.visibility !== 'public' || page.publishedDoc === null) {
      return c.json(NOT_FOUND, 404);
    }
    return c.json({ slug: page.slug, doc: JSON.parse(page.publishedDoc) as PublishedDoc });
  });

  return r;
}
