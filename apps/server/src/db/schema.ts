/**
 * MVP schema per plan contract C2 (mvp-scope D2: two-state model).
 *
 * Working state = `notepages` row fields + `blocks` rows (normalized).
 * Public state  = `notepages.publishedDoc` JSON snapshot, written only
 * by the explicit update-public action. Public readers never read the
 * working-state tables directly.
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const notepages = sqliteTable('notepages', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull().default('Untitled'),
  visibility: text('visibility', { enum: ['private', 'public'] })
    .notNull()
    .default('private'),
  gravityEnabled: integer('gravity_enabled', { mode: 'boolean' }).notNull().default(true),
  publishedDoc: text('published_doc'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const blocks = sqliteTable('blocks', {
  id: text('id').primaryKey(),
  notepageId: text('notepage_id')
    .notNull()
    .references(() => notepages.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  col: integer('col').notNull(),
  row: integer('row').notNull(),
  colSpan: integer('col_span').notNull(),
  rowSpan: integer('row_span').notNull(),
  content: text('content').notNull(),
});

export type NotepageRow = typeof notepages.$inferSelect;
export type BlockRow = typeof blocks.$inferSelect;

/** Shape of the publishedDoc JSON snapshot. */
export type PublishedDoc = {
  title: string;
  gravityEnabled: boolean;
  blocks: Array<{
    id: string;
    kind: string;
    col: number;
    row: number;
    colSpan: number;
    rowSpan: number;
    content: unknown;
  }>;
  publishedAt: number;
};
