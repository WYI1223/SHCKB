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
import { blobs as blobsTable, blocks, notepages, type PublishedDoc } from '../db/schema';
import { THEMES, isSafeCssColor } from '@skb/theme';
import { safeParse } from '../json';
import { NOT_FOUND_HTML, renderStaticPage } from '../render/publish-html';
import { effectiveTheme, themeCustomizations } from '../settings';

type WorkingBlock = {
  id: string;
  kind: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  /** Author-picked theme shell option id (M6-D3); null = default. */
  shell: string | null;
  /** Block-level autofit mode (Phase 3); null = off/legacy. */
  autofit: string | null;
  /** Author floor = minimum intended rowSpan (Phase 3); null = off/legacy. */
  minRowSpan: number | null;
  content: unknown;
};

type PageBackground = { color?: string; blobHash?: string };

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

function uniqueSlug(db: Db, title: string, excludeId?: string): string {
  const base = slugify(title);
  let candidate = base;
  for (let n = 2; ; n++) {
    const hit = db.select({ id: notepages.id }).from(notepages).where(eq(notepages.slug, candidate)).get();
    if (!hit || hit.id === excludeId) return candidate;
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
      !('content' in r) ||
      (r.shell !== undefined && r.shell !== null && typeof r.shell !== 'string') ||
      (r.autofit !== undefined && r.autofit !== null && typeof r.autofit !== 'string') ||
      (r.minRowSpan !== undefined && r.minRowSpan !== null && typeof r.minRowSpan !== 'number')
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
      shell: typeof r.shell === 'string' ? r.shell : null,
      autofit: typeof r.autofit === 'string' ? r.autofit : null,
      minRowSpan: typeof r.minRowSpan === 'number' ? r.minRowSpan : null,
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
      shell: row.shell,
      autofit: row.autofit,
      minRowSpan: row.minRowSpan,
      // corrupt content degrades to null — the rest of the page loads
      content: safeParse<unknown>(row.content, null),
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
        themeId: page.themeId,
        background: page.background !== null ? safeParse<PageBackground | null>(page.background, null) : null,
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
            shell: b.shell,
            autofit: b.autofit,
            minRowSpan: b.minRowSpan,
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

    // First publish locks the public slug to the title as of that
    // moment (fixes the create-time "untitled" wart). Once published,
    // the slug never changes — published links stay stable.
    const slug = page.publishedDoc === null ? uniqueSlug(db, page.title, page.id) : page.slug;

    const doc: PublishedDoc = {
      title: page.title,
      gravityEnabled: page.gravityEnabled,
      // appearance enters the snapshot (M6-D3/D4): publishedHtml stays
      // a pure function of (doc, slug, effective theme)
      background: page.background !== null ? safeParse<PageBackground | null>(page.background, null) : null,
      blocks: loadWorkingBlocks(db, page.id),
      publishedAt: Date.now(),
    };
    // Snapshot is frozen → render reader-grade HTML once, store with it.
    db.update(notepages)
      .set({
        slug,
        publishedDoc: JSON.stringify(doc),
        publishedHtml: renderStaticPage(doc, slug, effectiveTheme(db, page)),
        updatedAt: new Date(),
      })
      .where(eq(notepages.id, page.id))
      .run();
    return c.json({ publishedAt: doc.publishedAt, slug });
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

  // Per-page theme pin (MVP-4 M4-D2): null = follow instance. Changing
  // the pin re-renders the published HTML immediately — publishedHtml
  // stays a pure function of (doc, slug, effective theme).
  r.post('/notepages/:id/theme', async (c) => {
    const page = db.select().from(notepages).where(eq(notepages.id, c.req.param('id'))).get();
    if (!page) return c.json(NOT_FOUND, 404);
    const body = (await c.req.json().catch(() => ({}))) as { themeId?: unknown };
    const themeId = body.themeId === null ? null : typeof body.themeId === 'string' ? body.themeId : undefined;
    if (themeId === undefined) return c.json({ error: 'themeId must be a theme id or null' }, 400);
    if (themeId !== null && !(themeId in THEMES)) return c.json({ error: `unknown theme "${themeId}"` }, 400);

    db.update(notepages).set({ themeId, updatedAt: new Date() }).where(eq(notepages.id, page.id)).run();
    if (page.publishedDoc !== null) {
      // corrupt snapshot: pin still lands, stale HTML stays (re-publish heals)
      const doc = safeParse<PublishedDoc | null>(page.publishedDoc, null);
      if (doc !== null) {
        db.update(notepages)
          .set({ publishedHtml: renderStaticPage(doc, page.slug, effectiveTheme(db, { themeId })) })
          .where(eq(notepages.id, page.id))
          .run();
      }
    }
    return c.json({ ok: true });
  });

  // Page background (M6-D4): author-picked color and/or blob image.
  // null clears. Background is WORKING STATE (unlike the theme pin):
  // the published snapshot carries its own copy, so the public page
  // changes only on the explicit publish action (two-state model).
  r.post('/notepages/:id/background', async (c) => {
    const page = db.select().from(notepages).where(eq(notepages.id, c.req.param('id'))).get();
    if (!page) return c.json(NOT_FOUND, 404);
    const body = (await c.req.json().catch(() => ({}))) as { background?: unknown };

    let bg: PageBackground | null;
    if (body.background === null || body.background === undefined) {
      bg = null;
    } else if (typeof body.background === 'object') {
      const b = body.background as Record<string, unknown>;
      const out: PageBackground = {};
      if (b.color !== undefined) {
        if (typeof b.color !== 'string' || b.color.trim() === '' || !isSafeCssColor(b.color.trim())) {
          return c.json({ error: 'color must be a plain CSS color value' }, 400);
        }
        out.color = b.color.trim();
      }
      if (b.blobHash !== undefined) {
        if (typeof b.blobHash !== 'string') return c.json({ error: 'invalid blobHash' }, 400);
        const blob = db.select().from(blobsTable).where(eq(blobsTable.hash, b.blobHash)).get();
        if (!blob) return c.json({ error: 'blobHash not found — upload the image first' }, 422);
        out.blobHash = b.blobHash;
      }
      if (out.color === undefined && out.blobHash === undefined) {
        return c.json({ error: 'background must carry color and/or blobHash, or be null' }, 400);
      }
      bg = out;
    } else {
      return c.json({ error: 'background must be an object or null' }, 400);
    }

    db.update(notepages)
      .set({ background: bg === null ? null : JSON.stringify(bg), updatedAt: new Date() })
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

  // Public directory (owner decision 2026-06-11): anonymous readers
  // see the index of public+published pages. Titles come from the
  // PUBLISHED snapshot — working-state renames stay invisible until
  // re-publish, consistent with the two-state model.
  r.get('/public/notes', (c) => {
    const rows = db.select().from(notepages).where(eq(notepages.visibility, 'public')).all();
    const notes = rows
      .filter((p) => p.publishedDoc !== null)
      .map((p) => {
        // per-row: one corrupt snapshot must not take down the directory
        const doc = safeParse<PublishedDoc | null>(p.publishedDoc!, null);
        return doc === null ? null : { slug: p.slug, title: doc.title, publishedAt: doc.publishedAt };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null)
      .sort((a, b) => b.publishedAt - a.publishedAt);
    return c.json({ notes });
  });

  // Anonymous instance metadata: the active theme + its operator
  // customization (readers' SPA shell composes them locally — same
  // applyCustomization the server uses for static HTML).
  r.get('/public/instance', (c) => {
    const id = effectiveTheme(db, { themeId: null }).id;
    return c.json({ theme: id, customization: themeCustomizations(db)[id] ?? null });
  });

  // Public read route — anonymous principal; no-leak 404 semantics.
  r.get('/public/notes/:slug', (c) => {
    const page = db.select().from(notepages).where(eq(notepages.slug, c.req.param('slug'))).get();
    if (!page || page.visibility !== 'public' || page.publishedDoc === null) {
      return c.json(NOT_FOUND, 404);
    }
    const doc = safeParse<PublishedDoc | null>(page.publishedDoc, null);
    if (doc === null) return c.json({ error: 'published snapshot is corrupt — re-publish the page' }, 500);
    const themeId = effectiveTheme(db, page).id;
    return c.json({
      slug: page.slug,
      theme: themeId,
      customization: themeCustomizations(db)[themeId] ?? null,
      doc,
    });
  });

  return r;
}

/**
 * Canonical public read route as static HTML (rendered at publish
 * time). Mounted outside /api; identical 404 page for missing /
 * private / unpublished (no-leak).
 */
export function publicHtmlRoutes(db: Db) {
  const r = new Hono();
  r.get('/notes/:slug', (c) => {
    const page = db.select().from(notepages).where(eq(notepages.slug, c.req.param('slug'))).get();
    if (!page || page.visibility !== 'public' || page.publishedHtml === null) {
      return c.html(NOT_FOUND_HTML, 404);
    }
    return c.html(page.publishedHtml);
  });

  // First-class page permalink (M9-D1): pagelink marks store only the
  // pageId and render /p/:id — this 302 resolves to the CURRENT slug,
  // so renames never break inter-page links. Same no-leak 404 as the
  // slug route (private/unpublished/missing are indistinguishable).
  r.get('/p/:id', (c) => {
    const page = db.select().from(notepages).where(eq(notepages.id, c.req.param('id'))).get();
    if (!page || page.visibility !== 'public' || page.publishedHtml === null) {
      return c.html(NOT_FOUND_HTML, 404);
    }
    return c.redirect(`/notes/${encodeURIComponent(page.slug)}`, 302);
  });
  return r;
}
