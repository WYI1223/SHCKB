/**
 * Instance settings + effective-theme resolution [ADR-0024].
 *
 * Effective theme = page pin ?? instance setting ?? default; unknown
 * ids degrade to default rather than fail (a theme may be removed from
 * a future build — pages must keep rendering).
 */
import { eq } from 'drizzle-orm';
import { DEFAULT_THEME_ID, THEMES, type Theme } from '@skb/theme';
import type { Db } from './db/client';
import { notepages, settings, type NotepageRow, type PublishedDoc } from './db/schema';
import { renderStaticPage } from './render/publish-html';

export function getSetting(db: Db, key: string): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

export function setSetting(db: Db, key: string, value: string): void {
  db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

export function instanceThemeId(db: Db): string {
  const v = getSetting(db, 'theme');
  return v !== null && v in THEMES ? v : DEFAULT_THEME_ID;
}

export function effectiveTheme(db: Db, page: Pick<NotepageRow, 'themeId'>): Theme {
  const id = page.themeId !== null && page.themeId in THEMES ? page.themeId : instanceThemeId(db);
  return THEMES[id] ?? THEMES[DEFAULT_THEME_ID]!;
}

/** Re-render every published page with its effective theme — the
 * invariant that public pages always wear the current theme. */
export function rerenderAllPublished(db: Db): number {
  let n = 0;
  for (const page of db.select().from(notepages).all()) {
    if (page.publishedDoc === null) continue;
    const doc = JSON.parse(page.publishedDoc) as PublishedDoc;
    db.update(notepages)
      .set({ publishedHtml: renderStaticPage(doc, page.slug, effectiveTheme(db, page)) })
      .where(eq(notepages.id, page.id))
      .run();
    n++;
  }
  return n;
}
