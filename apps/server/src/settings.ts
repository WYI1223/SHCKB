/**
 * Instance settings + effective-theme resolution [ADR-0024].
 *
 * Effective theme = page pin ?? instance setting ?? default; unknown
 * ids degrade to default rather than fail (a theme may be removed from
 * a future build — pages must keep rendering).
 */
import { eq } from 'drizzle-orm';
import {
  DEFAULT_THEME_ID,
  THEMES,
  applyCustomization,
  sanitizeCustomization,
  type Theme,
  type ThemeCustomization,
} from '@skb/theme';
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

/** Operator theme customization, keyed by themeId (MVP-5 M5-D3).
 * Stored values are re-sanitized on read: a theme update may have
 * removed a variant or closed a token — stale choices degrade silently
 * instead of failing pages. */
export function themeCustomizations(db: Db): Record<string, ThemeCustomization> {
  const raw = getSetting(db, 'themeCustomization');
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) return {};
  const out: Record<string, ThemeCustomization> = {};
  for (const [themeId, c] of Object.entries(parsed)) {
    const theme = THEMES[themeId];
    if (!theme) continue;
    const clean = sanitizeCustomization(theme, c);
    if (clean) out[themeId] = clean;
  }
  return out;
}

export function effectiveTheme(db: Db, page: Pick<NotepageRow, 'themeId'>): Theme {
  const id = page.themeId !== null && page.themeId in THEMES ? page.themeId : instanceThemeId(db);
  const base = THEMES[id] ?? THEMES[DEFAULT_THEME_ID]!;
  return applyCustomization(base, themeCustomizations(db)[base.id]);
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
