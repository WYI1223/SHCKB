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
