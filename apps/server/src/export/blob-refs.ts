/**
 * Blob reference enumeration, shared by export and GC [ADR-0023].
 *
 * Block content is kind-owned and opaque, so the server cannot know
 * field names. Contract instead: block kinds MUST reference blobs by
 * the verbatim lowercase-hex sha256 string in their content JSON.
 * Scanning collects every such string; callers intersect with the
 * blobs table (export) or treat the set as a conservative keep-list
 * (GC — a false positive keeps a blob alive, never deletes a live one).
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
