/**
 * Content-addressed local-fs blob store (mvp2 M2-D3; storage-provider
 * seam — S3 etc. would implement this same surface later).
 *
 * Invariants: blob id = sha256(content); files are write-once (new
 * content = new id), which is what lets published snapshots reference
 * blobs safely forever. GC arrives in MVP-3 via routes/admin.ts —
 * the store itself stays policy-free (callers own the referenced-check).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HASH_RE = /^[a-f0-9]{64}$/;

export class BlobStore {
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  /** Persist bytes; returns the content hash. Idempotent per content. */
  save(bytes: Uint8Array): { hash: string; size: number } {
    const hash = createHash('sha256').update(bytes).digest('hex');
    const finalPath = join(this.dir, hash);
    if (!existsSync(finalPath)) {
      // temp + rename: never expose a half-written blob under its hash
      const tmp = join(this.dir, `.tmp-${hash}-${process.pid}`);
      writeFileSync(tmp, bytes);
      renameSync(tmp, finalPath);
    }
    return { hash, size: bytes.byteLength };
  }

  /** Absolute path for a stored blob, or null for invalid/missing ids. */
  path(hash: string): string | null {
    if (!HASH_RE.test(hash)) return null;
    const p = join(this.dir, hash);
    return existsSync(p) ? p : null;
  }

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

  /** Remove a blob file; false if it wasn't there. */
  delete(hash: string): boolean {
    const p = this.path(hash);
    if (!p) return false;
    unlinkSync(p);
    return true;
  }
}
